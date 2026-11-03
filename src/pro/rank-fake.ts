// 試験と撮影のための Firestore の代わり(メモリの中だけ)。ranking.ts が使う関数だけを、同じ名前・同じ形で持つ。
// ルールの一部(本人の場所だけ・年数が小さくなる時だけ更新・読みは50件まで)も真似て、断る時は permission-denied を投げる。
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {RankBackend} from './ranking';

interface Ts {ms:number;toMillis():number}
const ts=(ms:number):Ts=>({ms,toMillis:()=>ms});
const SERVER={__server:true};
const deny=()=>Object.assign(new Error('permission-denied'),{code:'permission-denied'});

export function fakeBackend(uid='me-uid',opts:{busy?:boolean;now?:()=>number}={}):RankBackend&{store:Map<string,any>;writes:number;reads:number}{
 const store=new Map<string,any>();
 const now=opts.now??(()=>Date.now());
 const api:any={store,writes:0,reads:0};
 const fill=(d:any):any=>Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v===SERVER?ts(now()):v]));
 const busy=()=>{if(opts.busy)throw Object.assign(new Error('Quota exceeded.'),{code:'resource-exhausted'});};
 const F={
  serverTimestamp:()=>SERVER,
  Timestamp:{fromMillis:(ms:number)=>ts(ms)},
  collection:(_db:any,...path:string[])=>({path:path.join('/')}),
  doc:(_db:any,...path:string[])=>({path:path.join('/'),id:path[path.length-1]}),
  orderBy:(f:string)=>({orderBy:f}),
  limit:(n:number)=>({limit:n}),
  startAfter:(y:number,at:Ts)=>({after:[y,at.ms]}),
  query:(base:any,...parts:any[])=>({...base,parts:[...(base.parts??[]),...parts]}),
  async getDocs(q:any){
   busy();
   const lim=q.parts.filter((p:any)=>p.limit).at(-1)?.limit??1000;
   if(lim>50)throw deny();
   const after=q.parts.find((p:any)=>p.after)?.after;
   let rows=[...store.entries()].filter(([k])=>k.startsWith(q.path+'/')&&!k.slice(q.path.length+1).includes('/')).map(([k,v])=>({id:k.split('/').pop(),v}));
   rows.sort((a,b)=>a.v.y-b.v.y||a.v.at.ms-b.v.at.ms);
   if(after)rows=rows.filter(r=>r.v.y>after[0]||r.v.y===after[0]&&r.v.at.ms>after[1]);
   rows=rows.slice(0,lim);api.reads+=Math.max(1,rows.length);
   return {metadata:{fromCache:false},docs:rows.map(r=>({id:r.id,data:()=>r.v}))};
  },
  async getDoc(ref:any){busy();api.reads++;const v=store.get(ref.path);return {exists:()=>!!v,data:()=>v};},
  async setDoc(ref:any,data:any){
   busy();if(ref.id!==uid)throw deny();
   const old=store.get(ref.path),d=fill(data);
   if(old&&!(d.y<old.y&&now()-old.at.ms>=10000))throw deny();
   store.set(ref.path,d);api.writes++;
  },
  async updateDoc(ref:any,data:any){
   busy();if(ref.id!==uid)throw deny();
   const old=store.get(ref.path);if(!old)throw Object.assign(new Error('not-found'),{code:'not-found'});
   store.set(ref.path,{...old,...fill(data)});api.writes++;
  },
  async deleteDoc(ref:any){busy();if(ref.id!==uid)throw deny();if(ref.path.startsWith('d9_space_once/'))throw deny();store.delete(ref.path);api.writes++;},
  // 宇宙リーグ制覇の記録: d9_space_once と d9_space_hof を一緒に作るだけ。どちらかが既にあれば全部断る(ルールと同じ)
  writeBatch:()=>{const ops:Array<[any,any]>=[];return {set:(ref:any,data:any)=>{ops.push([ref,data]);},async commit(){
   busy();
   for(const [ref] of ops){if(ref.id!==uid||store.has(ref.path))throw deny();}
   const paths=ops.map(([r])=>r.path);
   if(!paths.some(p=>p.startsWith('d9_space_once/'))||[...store.keys()].includes('d9_space_once/'+uid))throw deny();
   for(const [ref,data] of ops)store.set(ref.path,fill(data));api.writes+=ops.length;
  }};},
 };
 Object.assign(api,{F,db:{fake:true},user:{uid}});
 return api;
}

/** 撮影用: 他の人の記録を並べる */
export function seedRows(b:ReturnType<typeof fakeBackend>,lg:string,rows:Array<Record<string,any>>){
 rows.forEach((r,i)=>b.store.set(lg==='hof'?`d9_space_hof/${r.uid??'u'+i}`:`d9_rank/${lg}/runs/${r.uid??'u'+i}`,{...r,at:ts(r.atMs??Date.UTC(2026,10,1)+i*3600_000),nt:ts(r.atMs??Date.UTC(2026,10,1))}));
}
