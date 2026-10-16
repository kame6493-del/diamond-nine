// 2026-09-25 の案(Play Console には未登録・販売したことは無い)。ID は別の中身で使い回さないため残すだけ。
// Price proposals for Play Console; never use these values to initiate a payment.
export const pointProducts = [
 {id:'points_3000',points:3000,proposedPriceYen:120},
 {id:'points_13000',points:13000,proposedPriceYen:480},
 {id:'points_28000',points:28000,proposedPriceYen:980},
] as const;
export interface StoreProduct {id:string;price:string}
export interface AndroidPointStore {catalog():Promise<{products:StoreProduct[]}>}
declare global {interface Window {diamondPointStore?:AndroidPointStore}}

// ---- 2026-10-16 ポイントのパック(消耗型・1回きりの購入。新しい ID) ----
// スカウト1回 = 3,000pt、10連 = 30,000pt。大きいパックほど1回あたりが安い(160円 → 100円)。
// 画面の価格はストアの表示価格を優先。priceYen は日本の Play Console に登録する税込価格で、
// ストアの価格が取れないとき(ブラウザ版の案内)と、未成年の月の上限の計算にだけ使う。
export interface PointPack {id:string;points:number;priceYen:number;tag?:string}
export const pointPacks:readonly PointPack[] = [
 {id:'pt_pack_3000',points:3000,priceYen:160},
 {id:'pt_pack_10000',points:10000,priceYen:480},
 {id:'pt_pack_21000',points:21000,priceYen:980},
 {id:'pt_pack_69000',points:69000,priceYen:3000,tag:'10連2回分＋3回'},
 {id:'pt_pack_126000',points:126000,priceYen:5000,tag:'10連4回分＋2回'},
 {id:'pt_pack_300000',points:300000,priceYen:10000,tag:'10連10回分'},
] as const;
export const pointPackIds = pointPacks.map(p=>p.id);
export const packById = (id:string) => pointPacks.find(p=>p.id===id);
const SCOUT = 3000;
export const packDraws = (p:PointPack) => p.points/SCOUT;
// 1回(3,000pt)あたりの円。いちばん小さいパックとの比べで「おトク」を出す。
export const yenPerDraw = (p:PointPack) => Math.round(p.priceYen/packDraws(p));
export const packBonusPercent = (p:PointPack) => {
 const base = pointPacks[0].points/pointPacks[0].priceYen;
 return Math.round((p.points/p.priceYen/base-1)*100);
};

// ---- 未成年の課金(業界の自主基準にならう) ----
// 初めて買う前に年齢の区分を聞き、15歳以下は月 5,000円・16〜17歳は月 10,000円まで。端末に覚える(セーブとは別)。
// プレミアムパス(premium_pass・買い切り)の日本の税込価格。月の上限に数える(2026-10-16)。
export const PREMIUM_PASS_PRICE_YEN = 480;
export type AgeBand = 'u16'|'u18'|'adult';
export const AGE_BANDS:{id:AgeBand;label:string;limitYen:number|null}[] = [
 {id:'u16',label:'15歳以下',limitYen:5000},
 {id:'u18',label:'16〜17歳',limitYen:10000},
 {id:'adult',label:'18歳以上',limitYen:null},
];
export const monthlyLimit = (band:AgeBand|null) => AGE_BANDS.find(b=>b.id===band)?.limitYen ?? null;
export const monthKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
export interface SpendRecord {month:string;yen:number}
export const parseSpend = (raw:string|null):SpendRecord|null => {
 try{const v=raw?JSON.parse(raw):null;return v&&typeof v.month==='string'&&Number.isFinite(v.yen)&&v.yen>=0?v:null;}catch{return null;}
};
export const spentThisMonth = (r:SpendRecord|null, month:string) => r?.month===month ? r.yen : 0;
export const addSpend = (r:SpendRecord|null, month:string, yen:number):SpendRecord => ({month,yen:spentThisMonth(r,month)+Math.max(0,yen)});
// 年齢が未回答なら買えない(先に聞く)。上限があれば今月の合計+この値段で判定する。
export const canSpend = (band:AgeBand|null, spent:number, yen:number) => {
 if(!band)return false;
 const limit = monthlyLimit(band);
 return limit===null || spent+yen<=limit;
};
const AGE_KEY='diamond-nine-age-band',SPEND_KEY='diamond-nine-monthly-spend';
const read=(k:string)=>{try{return typeof localStorage==='undefined'?null:localStorage.getItem(k);}catch{return null;}};
const write=(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{/* この回だけ */}};
export const readAgeBand = ():AgeBand|null => {const v=read(AGE_KEY);return v==='u16'||v==='u18'||v==='adult'?v:null;};
export const saveAgeBand = (band:AgeBand) => write(AGE_KEY,band);
export const readSpent = (now=new Date()) => spentThisMonth(parseSpend(read(SPEND_KEY)),monthKey(now));
export const recordSpend = (yen:number, now=new Date()) => write(SPEND_KEY,JSON.stringify(addSpend(parseSpend(read(SPEND_KEY)),monthKey(now),yen)));
