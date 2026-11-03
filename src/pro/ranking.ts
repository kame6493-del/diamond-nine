// DIAMOND NINE オンラインランキング(通信の部分)。組み込み先は src/pro/ranking.ts を想定。
// らくがき運動会の app/www/online.js と同じ作り: 匿名ログイン + Firestore だけ、SDK は gstatic から必要な時に読む(バンドルを太らせない)。
// 読み取りを減らす: 上位20件を端末に60分覚える / 自分の記録は端末に覚えて読まない / 混み合い(429)・つながらない時は1日以内の古い覚えを出す。
// ルールは d9_ranking_1103/firestore.rules。並びは y(年数)の小さい順 → at(登録時刻)の早い順。
import {HOF_LEAGUE,RANK_LEAGUES,autoDisplayName,cleanName,fromWire,toWire,validDisplayName,validEntry,type RankEntry,type RankLeague} from './rank-entry';

const V='12.4.0';
const FB=`https://www.gstatic.com/firebasejs/${V}/`;
import {firebaseConfig} from './ranking-config';

/* eslint-disable @typescript-eslint/no-explicit-any */
let F:any=null,db:any=null,user:any=null;
const PATH='d9_rank';
export const FIRST_PAGE=20,MORE_PAGE=30;   // ルールの上限は1回50件
const TOP_MS=60*60*1000,STALE_MS=24*3600*1000;

const LS={
 get<T>(k:string):T|null{try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;}},
 set(k:string,v:unknown){try{localStorage.setItem(k,JSON.stringify(v));}catch{/* 保存できなくても遊べる */}},
 del(k:string){try{localStorage.removeItem(k);}catch{/* */}},
};

// ---------- 混み合い(無料枠切れ = resource-exhausted / 429)・つながらない ----------
export const BUSY_MSG='いまは混み合っていて、ランキングが一時的に見られません。ゲームはそのまま遊べます。';
const BUSY_KEY='d9r_busy_until';
export const isBusy=()=>{const u=LS.get<number>(BUSY_KEY);return !!(u&&Date.now()<u);};
const markBusy=(ms:number)=>LS.set(BUSY_KEY,Date.now()+ms);
const isQuota=(e:any)=>/resource-exhausted|quota|429/i.test(String(e?.code??'')+' '+String(e?.message??''));
const busyError=()=>Object.assign(new Error(BUSY_MSG),{code:'busy',busy:true});
export const stats={reads:0};
const count=(s:any)=>{stats.reads+=s?.docs?Math.max(1,s.docs.length):1;return s;};
async function guard<T>(fn:()=>Promise<T>,ms=9000):Promise<T>{
 if(isBusy())throw busyError();
 let tm:ReturnType<typeof setTimeout>|undefined;
 try{
  const r:any=await Promise.race([fn(),new Promise((_,rej)=>{tm=setTimeout(()=>rej(Object.assign(new Error('timeout'),{code:'timeout'})),ms);})]);
  // 枠切れ・圏外の時、getDocs がエラーにならず端末の控え(空)を返すことがある。読めなかった扱いにする
  if(r?.metadata?.fromCache)throw Object.assign(new Error('offline'),{code:'unavailable'});
  return r;
 }catch(e:any){
  if(isQuota(e)){markBusy(5*60*1000);throw busyError();}
  if(e?.code==='timeout'||e?.code==='unavailable'){markBusy(2*60*1000);throw busyError();}
  throw e;
 }finally{clearTimeout(tm);}
}

// 試験と撮影の時だけ、Firestore の代わり(rank-fake.ts)を差しこむ。本番では使わない。
export interface RankBackend {F:any;db:any;user:{uid:string}}
const injected=():RankBackend|null=>{try{return (globalThis as any).__D9R_BACKEND__??null;}catch{return null;}};
export function useBackend(b:RankBackend|null){(globalThis as any).__D9R_BACKEND__=b;F=b?.F??null;db=b?.db??null;user=b?.user??null;}
export const available=()=>!!firebaseConfig||!!injected();
export async function init():Promise<void>{
 if(db)return;
 const fake=injected();
 if(fake){F=fake.F;db=fake.db;user=fake.user;LS.set('d9r_uid',user.uid);return;}
 if(!firebaseConfig)throw Object.assign(new Error('ランキングは準備中です'),{code:'off'});
 await guard(async()=>{
  const [a,au,fs]=await Promise.all([import(/* @vite-ignore */FB+'firebase-app.js'),import(/* @vite-ignore */FB+'firebase-auth.js'),import(/* @vite-ignore */FB+'firebase-firestore.js')]);
  F={...a,...au,...fs};
  // 同じ名前のアプリを2回作らない(画面を開き直した時)
  const app=F.getApps().find((x:any)=>x.name==='d9rank')??F.initializeApp(firebaseConfig,'d9rank');
  db=F.getFirestore(app);
  user=(await F.signInAnonymously(F.getAuth(app))).user;
  LS.set('d9r_uid',user.uid);
 },12000);
}
/** ログイン前でも、前に使った uid で自分の行がわかるようにする */
export const uid=()=>user?.uid??LS.get<string>('d9r_uid')??'';

// ---------- 表示名(端末に1つ。初回は自動) ----------
const NAME_KEY='d9r_name';
export function displayName():string{let n=LS.get<string>(NAME_KEY);if(!n||!validDisplayName(n)){n=autoDisplayName();LS.set(NAME_KEY,n);}return n;}

// ---------- 上位の表 ----------
export interface RankRow extends RankEntry {uid:string;at:number}
interface TopCache {at:number;rows:RankRow[];more:boolean;stale?:boolean}
const topKey=(lg:RankLeague)=>'d9r_top_'+lg;
const toRow=(d:any):RankRow|null=>{const x=d.data(),e=fromWire(x);return e?{...e,uid:d.id,at:x.at?.toMillis?x.at.toMillis():0}:null;};
const order=(a:RankRow,b:RankRow)=>a.y-b.y||a.at-b.at||a.uid.localeCompare(b.uid);

/** 上位20件(端末に60分)。more=true で続き30件を足して最大50件。混み合い時は1日以内の覚えを stale 付きで返す。 */
export async function listTop(lg:RankLeague,more=false):Promise<TopCache>{
 const c=LS.get<TopCache>(topKey(lg));
 if(c&&Date.now()-c.at<TOP_MS&&(!more||c.rows.length>FIRST_PAGE||!c.more))return c;
 try{
  await init();
  let q=F.query(F.collection(db,PATH,lg,'runs'),F.orderBy('y'),F.orderBy('at'),F.limit(more?MORE_PAGE:FIRST_PAGE));
  const base=more&&c&&Date.now()-c.at<TOP_MS?c.rows:[];
  if(base.length){const last=base[base.length-1];q=F.query(q,F.startAfter(last.y,F.Timestamp.fromMillis(last.at)));}
  const snap=count(await guard(()=>F.getDocs(q)));
  // 時刻をミリ秒に丸めて続きを読むので、境目の1件が重なることがある。uid で1件にする
  const rows=[...new Map([...base,...snap.docs.map(toRow).filter((r:RankRow|null):r is RankRow=>!!r)].map(r=>[r.uid,r])).values()].sort(order).slice(0,50);
  const out:TopCache={at:base.length?c!.at:Date.now(),rows,more:snap.docs.length===(more?MORE_PAGE:FIRST_PAGE)&&rows.length<50};
  LS.set(topKey(lg),out);
  return out;
 }catch(e:any){
  if(e?.busy&&c&&Date.now()-c.at<STALE_MS)return {...c,stale:true};
  throw e;
 }
}

// ---------- 自分の記録(端末に覚える。読みに行かない) ----------
interface MyBest {y:number;n:string}
const myKey=(lg:RankLeague)=>'d9r_my_'+uid()+'_'+lg;
export const myBest=(lg:RankLeague)=>LS.get<MyBest>(myKey(lg));
/** 表の中の自分の順位(1〜50)。表に無ければ null(画面は「51位以下」) */
export const myPlace=(rows:RankRow[])=>{const i=rows.findIndex(r=>r.uid===uid());return i<0?null:i+1;};

/** 登録。端末の自己ベストより速い時だけ送る。結果: sent(書いた)/ notBetter(遅いか同じ)/ wait(10秒に1回の制限) */
export async function submit(lg:RankLeague,entry:RankEntry):Promise<'sent'|'notBetter'|'wait'>{
 if(!validEntry(entry,lg))throw new Error('この記録は登録できない形です');
 const mine=myBest(lg);
 if(mine&&entry.y>=mine.y)return 'notBetter';
 await init();
 const ref=F.doc(db,PATH,lg,'runs',uid());
 try{
  await guard(()=>F.setDoc(ref,{...toWire(entry),at:F.serverTimestamp(),nt:F.serverTimestamp()}));
 }catch(e:any){
  if(e?.busy||!/permission/i.test(String(e?.code??e?.message)))throw e;
  // 断られた: サーバーの方が速い(別の端末の記録など)か、10秒以内の書きこみ。1件だけ読んで確かめる
  const s=count(await guard(()=>F.getDoc(ref)));
  if(s.exists()&&s.data().y<=entry.y){LS.set(myKey(lg),{y:s.data().y,n:s.data().n});return 'notBetter';}
  return 'wait';
 }
 LS.set(myKey(lg),{y:entry.y,n:entry.n});
 patchTop(lg,{...entry,uid:uid(),at:Date.now()});
 return 'sent';
}
// 登録した時は、覚えている表に自分の行を入れなおす(読みに行かずに順位が見える)
function patchTop(lg:RankLeague,row:RankRow){
 const c=LS.get<TopCache>(topKey(lg));if(!c)return;
 c.rows=[...c.rows.filter(r=>r.uid!==row.uid),row].sort(order).slice(0,50);
 LS.set(topKey(lg),c);
}

/** 表示名を変える。端末の名前と、登録済みのリーグの行(表示名だけ)を書きかえる。 */
export async function rename(name:string):Promise<void>{
 const n=cleanName(name);
 if(!validDisplayName(n))throw new Error('この名前は使えません(12文字まで・使えない言葉あり)');
 LS.set(NAME_KEY,n);
 const leagues=RANK_LEAGUES.map(l=>l.id).filter(lg=>myBest(lg));
 if(!leagues.length)return;
 await init();
 for(const lg of leagues){
  await guard(()=>F.updateDoc(F.doc(db,PATH,lg,'runs',uid()),{n,nt:F.serverTimestamp()}));
  LS.set(myKey(lg),{...myBest(lg)!,n});
  const c=LS.get<TopCache>(topKey(lg));
  if(c){c.rows=c.rows.map(r=>r.uid===uid()?{...r,n}:r);LS.set(topKey(lg),c);}
 }
}

// ---------- 宇宙リーグ制覇の記録(1人1回きり。rank-entry.ts の HOF_LEAGUE の説明) ----------
const HOF_PATH='d9_space_hof',ONCE_PATH='d9_space_once',HOF_TOP='d9r_top_hof';
const hofKey=()=>'d9r_hof_'+uid();
/** この端末(uid)で、もう残したか。残した時の年数・名前・チーム名を覚える。 */
export const myHof=()=>LS.get<{y:number;n:string;tn:string}>(hofKey());
/** 宇宙リーグ制覇の一覧(早く制覇した順)。listTop と同じく上位20件を60分覚え、混み合い時は古い覚えを出す。 */
export async function listHof(more=false):Promise<TopCache>{
 const c=LS.get<TopCache>(HOF_TOP);
 if(c&&Date.now()-c.at<TOP_MS&&(!more||c.rows.length>FIRST_PAGE||!c.more))return c;
 try{
  await init();
  let q=F.query(F.collection(db,HOF_PATH),F.orderBy('y'),F.orderBy('at'),F.limit(more?MORE_PAGE:FIRST_PAGE));
  const base=more&&c&&Date.now()-c.at<TOP_MS?c.rows:[];
  if(base.length){const last=base[base.length-1];q=F.query(q,F.startAfter(last.y,F.Timestamp.fromMillis(last.at)));}
  const snap=count(await guard(()=>F.getDocs(q)));
  const rows=[...new Map([...base,...snap.docs.map(toRow).filter((r:RankRow|null):r is RankRow=>!!r)].map(r=>[r.uid,r])).values()].sort(order).slice(0,50);
  const out:TopCache={at:base.length?c!.at:Date.now(),rows,more:snap.docs.length===(more?MORE_PAGE:FIRST_PAGE)&&rows.length<50};
  LS.set(HOF_TOP,out);
  return out;
 }catch(e:any){
  if(e?.busy&&c&&Date.now()-c.at<STALE_MS)return {...c,stale:true};
  throw e;
 }
}
/** 宇宙リーグ制覇の記録を残す。1回きり: sent(書いた)/ already(もう残してある。上書きしない)。 */
export async function submitHof(entry:RankEntry):Promise<'sent'|'already'>{
 if(!validEntry(entry,HOF_LEAGUE))throw new Error('この記録は登録できない形です');
 if(myHof())return 'already';
 await init();
 const id=uid(),batch=F.writeBatch(db);
 batch.set(F.doc(db,ONCE_PATH,id),{at:F.serverTimestamp()});
 batch.set(F.doc(db,HOF_PATH,id),{...toWire(entry),at:F.serverTimestamp()});
 try{await guard(()=>batch.commit());}
 catch(e:any){
  if(e?.busy||!/permission/i.test(String(e?.code??e?.message)))throw e;
  // 断られた = もう残してある(別の端末・消した後など)。端末にも覚えて、二度と送らない
  LS.set(hofKey(),{y:0,n:'',tn:''});return 'already';
 }
 LS.set(hofKey(),{y:entry.y,n:entry.n,tn:entry.tn});
 const c=LS.get<TopCache>(HOF_TOP);
 if(c){c.rows=[...c.rows.filter(r=>r.uid!==id),{...entry,uid:id,at:Date.now()}].sort(order).slice(0,50);LS.set(HOF_TOP,c);}
 return 'sent';
}

/** 自分の記録を全部消す(設定の「ランキングの記録を消す」用)。 */
export async function deleteMine():Promise<'deleted'|'none'>{
 // 一度もランキングを使っていない端末は、ログインもせずに終わる(新しい ID を作らない)
 if(!uid()&&!RANK_LEAGUES.some(l=>LS.get(topKey(l.id))))return 'none';
 await init();
 for(const {id} of RANK_LEAGUES){
  await guard(()=>F.deleteDoc(F.doc(db,PATH,id,'runs',uid())));
  LS.del(myKey(id));
  const c=LS.get<TopCache>(topKey(id));
  if(c){c.rows=c.rows.filter(r=>r.uid!==uid());LS.set(topKey(id),c);}
 }
 // 宇宙リーグ制覇の記録(名前・チーム名・オーダー)も消す。1回きりの印(d9_space_once、時刻だけ)は残るので、もう一度は残せない
 if(myHof()){
  await guard(()=>F.deleteDoc(F.doc(db,HOF_PATH,uid())));
  const c=LS.get<TopCache>(HOF_TOP);
  if(c){c.rows=c.rows.filter(r=>r.uid!==uid());LS.set(HOF_TOP,c);}
  LS.set(hofKey(),{y:0,n:'',tn:''});
 }
 return 'deleted';
}

/** 登録に付けるアプリの版。アプリ版は「1.4.7 (40)」、ブラウザ版は「web」。取れなければ「app」。 */
export async function appVersion():Promise<string>{
 try{
  const cap=(globalThis as any).Capacitor;
  if(!cap?.isNativePlatform?.())return 'web';
  const info=await cap.Plugins?.App?.getInfo?.();
  return info?`${info.version} (${info.build})`.slice(0,24):'app';
 }catch{return 'app';}
}
