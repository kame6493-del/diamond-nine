// オンラインランキング(2026-11-03 vc40)の試験。通信はしない(rank-fake.ts の Firestore の代わりを使う)。
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialSandboxState,simulateDays,nextSeason,type GameState} from '../src/pro/engine';
import {finishPostseason} from '../src/pro/postseason';
import {seasonGames} from '../src/pro/leagues';
import {RANK_LEAGUES,autoDisplayName,bestYear,buildEntry,championSeason,cleanName,fromWire,hasNgWord,toWire,validDisplayName,validEntry,type RankEntry} from '../src/pro/rank-entry';
import {BUSY_MSG,deleteMine,listTop,myBest,rename,stats,submit,useBackend,displayName} from '../src/pro/ranking';
import {fakeBackend,seedRows} from '../src/pro/rank-fake';
import {rankPromptFor} from '../src/pro/RankRegisterPrompt';
import {LineupView,RankingScreen} from '../src/pro/RankingScreen';

type Test=(name:string,run:()=>void|Promise<void>)=>void;

// node には localStorage が無いので、試験の間だけメモリの物を置く
const mem=new Map<string,string>();
const storage={getItem:(k:string)=>mem.has(k)?mem.get(k)!:null,setItem:(k:string,v:string)=>{mem.set(k,String(v));},removeItem:(k:string)=>{mem.delete(k);},clear:()=>mem.clear(),key:(i:number)=>[...mem.keys()][i]??null,get length(){return mem.size;}};
// 他の試験に影響しないよう、ランキングの試験の間だけ置いて、終わったら外す
const G=globalThis as unknown as {localStorage?:typeof storage};
const withStorage=(run:()=>void|Promise<void>)=>async()=>{
 const had=G.localStorage;if(!had)G.localStorage=storage;
 try{await run();}finally{useBackend(null);mem.clear();if(!had)delete G.localStorage;}
};
const resetStorage=()=>{for(const k of [...mem.keys()])if(k.startsWith('d9r'))mem.delete(k);};

// firestore.rules の d9Lineup・d9Rotation と同じ正規表現(ルールを書きかえたらここも)
const RULE_B=/^([^,;]{1,20},(捕|一|二|三|遊|外|DH),[0-9]{1,3},[0-9]{1,2},[0-9]{1,2},[0-9]{1,2},[0-9]{1,2};){8}[^,;]{1,20},(捕|一|二|三|遊|外|DH),[0-9]{1,3},[0-9]{1,2},[0-9]{1,2},[0-9]{1,2},[0-9]{1,2}$/;
const RULE_SP=/^([^,;]{1,20},[0-9]{1,3},[0-9]{1,3},[0-9]{1,2},[0-9]{1,2},[0-9]{1,2};){5}[^,;]{1,20},[0-9]{1,3},[0-9]{1,3},[0-9]{1,2},[0-9]{1,2},[0-9]{1,2}$/;

// 1年目に日本一になった育成モードのセーブ(強い名簿で回す。届かなければ年を足す)
let champ:{before:GameState;after:GameState}|null=null;
function championSave(){
 if(champ)return champ;
 let s:GameState={...initialSandboxState(),mode:'career',seed:7919}; // seed 7919 は1年目に日本一(11/3 に確かめた)
 for(let y=0;y<30;y++){
  const mid=simulateDays(s,seasonGames(s.season));
  const done=finishPostseason(mid);
  if(bestYear(done,'npb')!==null){champ={before:mid,after:done};return champ;}
  s=nextSeason(done);
 }
 throw new Error('30年で日本一になれなかった');
}

export function registerRankingTests(add:Test){
 const test:Test=(name,run)=>add(name,withStorage(run));
 test('ranking: the first title year comes from achievements and the lineup from shareTeam, career mode only',()=>{
  const {after}=championSave(),y=bestYear(after,'npb')!;
  assert.equal(y,1,'seed 7919 は1年目に日本一');
  assert.equal(championSeason(after,'npb')?.number,y);
  assert.equal(bestYear({...after,mode:'free'},'npb'),null,'以前のクラブは載せない');
  assert.equal(bestYear(after,'mlb'),null);
  const e=buildEntry(after,'npb','かんとく','1.4.7 (40)')!;
  assert.ok(e,'登録の中身が作れる');
  assert.equal(e.y,y);assert.equal(e.b.length,9);assert.equal(e.sp.length,6);
  assert.equal(e.rec.w+e.rec.l+e.rec.d,143);
  assert.ok(validEntry(e,'npb'));
  const w=toWire(e);
  assert.match(w.b,RULE_B,'打順の文字列はルールの正規表現に合う');
  assert.match(w.sp,RULE_SP,'先発の文字列はルールの正規表現に合う');
  assert.ok(JSON.stringify(w).length<1200,'1件は1.2KBより小さい');
  const back=fromWire(w)!;
  assert.deepEqual(back.b.map(x=>[x.n,x.pos,x.o,x.c,x.p,x.s,x.f]),e.b.map(x=>[x.n,x.pos,x.o,x.c,x.p,x.s,x.f]),'戻すと同じ打順');
  assert.deepEqual(back.sp.map(x=>[x.n,x.o,x.v]),e.sp.map(x=>[x.n,x.o,x.v]));
 });
 test('ranking: malformed entries and names are refused before sending',()=>{
  const e=buildEntry(championSave().after,'npb','かんとく','1.4.7 (40)')!;
  const bad=(f:(x:RankEntry)=>void)=>{const x=structuredClone(e);f(x);return validEntry(x,'npb');};
  assert.equal(bad(x=>{x.b.pop();}),false,'打順8人');
  assert.equal(bad(x=>{x.b[1]={...x.b[0]};}),false,'同じ選手2人');
  assert.equal(bad(x=>{x.b[0].pos='捕';x.b[1].pos='捕';}),false,'捕手2人');
  assert.equal(bad(x=>{x.y=0;}),false,'0年');
  assert.equal(bad(x=>{x.n='しね';}),false,'NG ワードの表示名');
  assert.equal(bad(x=>{x.b[0].n='a,b';}),false,'区切りの文字を含む選手名');
  assert.equal(bad(x=>{x.sp[0].v=171;}),false,'球速171');
  assert.equal(validEntry({...e,y:3,rec:{w:100,l:62,d:0}},'mlb'),false,'海外3年目はありえない');
  assert.equal(fromWire({...toWire(e),b:'x'}),null,'崩れた行は表に出さない');
  assert.ok(hasNgWord('シネ太郎')&&hasNgWord('f u c k')&&hasNgWord('ｈｔｔｐ'),'カタカナ・空白・全角も見る');
  assert.equal(hasNgWord('東京ルーキーズ'),false);
  assert.equal(cleanName('  あいうえおかきくけこさしすせ '),'あいうえおかきくけこさし');
  assert.match(autoDisplayName(()=>0),/^監督1000$/);assert.match(autoDisplayName(()=>.9999),/^監督9999$/);
  assert.ok(validDisplayName('監督1234'));assert.equal(validDisplayName(''),false);assert.equal(validDisplayName('a'.repeat(13)),false);
  assert.deepEqual(RANK_LEAGUES.map(l=>l.label),['海外リーグ','宇宙リーグ','国内リーグ'],'持ち主の言葉の順(海外・宇宙・国内)');
 });
 test('ranking: the register prompt appears only for a new fastest title, and never while ranking is off',()=>{
  resetStorage();useBackend(null);
  const {before,after}=championSave();
  assert.equal(rankPromptFor(before,after),null,'設定が空(null)の間は出さない');
  useBackend(fakeBackend('me'));
  assert.equal(rankPromptFor(before,after),'npb');
  assert.equal(rankPromptFor(after,after),null,'読み込み直しでは出ない');
  assert.equal(rankPromptFor({...before,mode:'free'},{...after,mode:'free'}),null,'以前のクラブでは出ない');
  mem.set('d9r_my_me_npb',JSON.stringify({y:bestYear(after,'npb'),n:'x'}));
  mem.set('d9r_uid',JSON.stringify('me'));
  assert.equal(rankPromptFor(before,after),null,'端末の自己ベストと同じなら出ない');
  useBackend(null);resetStorage();
 });
 test('ranking: register, list (cached), slower record, rename and delete with the fake Firestore',async()=>{
  resetStorage();
  const fake=fakeBackend('me');useBackend(fake);
  seedRows(fake,'npb',[{uid:'a',...toWire(buildEntry(championSave().after,'npb','先輩','1.4.6 (39)')!),y:1},{uid:'b',...toWire(buildEntry(championSave().after,'npb','後輩','web')!),y:3}]);
  const e=buildEntry(championSave().after,'npb',displayName(),'1.4.7 (40)')!;
  assert.match(displayName(),/^監督\d{4}$/,'初回の表示名は「監督」+4桁');
  assert.equal(await submit('npb',{...e,y:2}),'sent');
  assert.equal(myBest('npb')?.y,2);
  assert.equal(await submit('npb',{...e,y:5}),'notBetter','遅い記録は送らない');
  const before=stats.reads;
  const top=await listTop('npb');
  assert.deepEqual(top.rows.map(r=>r.y),[1,2,3],'年数の小さい順');
  assert.equal(top.rows[1].uid,'me');
  assert.equal(top.rows[1].b.length,9,'スタメンは表の行に入っている(押しても読まない)');
  const reads=stats.reads-before;
  await listTop('npb');
  assert.equal(stats.reads-before,reads,'60分以内の2回目は読みに行かない');
  await rename('新しい名前');
  assert.equal(fake.store.get('d9_rank/npb/runs/me').n,'新しい名前');
  await assert.rejects(()=>rename('しねしね'),/使えません/);
  assert.equal(await deleteMine(),'deleted');
  assert.equal(fake.store.has('d9_rank/npb/runs/me'),false,'自分の記録が消える');
  assert.equal(fake.store.has('d9_rank/npb/runs/a'),true,'他の人の記録は残る');
  assert.equal(myBest('npb'),null);
  useBackend(null);resetStorage();
 });
 test('ranking: when Firestore is busy (quota) the game shows the busy note and an old table, never an exception to the game',async()=>{
  resetStorage();
  let busy=false;
  const fake=fakeBackend('me');useBackend(fake);
  seedRows(fake,'mlb',[{uid:'a',...toWire(buildEntry(championSave().after,'npb','先輩','web')!),rec:{w:100,l:62,d:0},y:4}]);
  const first=await listTop('mlb');assert.equal(first.rows.length,1);
  // 60分たったことにして、混み合いで読めない時
  const c=JSON.parse(mem.get('d9r_top_mlb')!);c.at-=61*60*1000;mem.set('d9r_top_mlb',JSON.stringify(c));
  const slow=fakeBackend('me',{busy:true});seedRows(slow,'mlb',[]);useBackend(slow);busy=true;
  const stale=await listTop('mlb');
  assert.ok(busy&&stale.stale,'1日以内の古い表を出す');
  assert.equal(stale.rows.length,1);
  mem.delete('d9r_top_mlb');
  await assert.rejects(()=>listTop('mlb'),(e:{message:string})=>e.message===BUSY_MSG);
  assert.match(BUSY_MSG,/ゲームはそのまま遊べます/);
  useBackend(null);resetStorage();
 });
 test('ranking: screens render (list shell, lineup with 9 batters and 6 starters)',()=>{
  resetStorage();useBackend(fakeBackend('me'));
  const {after}=championSave();
  const html=renderToStaticMarkup(createElement(RankingScreen,{state:after,version:'web'}));
  assert.match(html,/海外リーグ/);assert.match(html,/宇宙リーグ/);assert.match(html,/国内リーグ/);assert.match(html,/最短優勝/);
  const e=buildEntry(after,'npb','かんとく','web')!;
  const row={...e,uid:'x',at:Date.UTC(2026,10,3)};
  const lineup=renderToStaticMarkup(createElement(LineupView,{row,league:'国内リーグ',onBack:()=>{}}));
  assert.equal((lineup.match(/<tr>/g)??[]).length,2+9+6,'見出し2行・打順9人・先発6人');
  assert.match(lineup,/優勝したときのスタメン/);
  useBackend(null);resetStorage();
 });
}
