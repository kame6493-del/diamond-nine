// 守備位置の呼び名(2026-11-06 夜 持ち主「外野は、センター・レフト・ライトの中・左・右表記にしてよ。どこがどれかわからない」)。
// データの上では外野は '外' のまま。グラウンドの絵(field-sim の fieldMap)と同じく、打順の並びで 1人目=左・2人目=中・3人目=右。
// 内野は日本の略し方(投・捕・一・二・三・遊)、DH は「指」。
export const OF_NAMES=['左','中','右'] as const;
/** スタメンの守備位置の呼び名(id → 投/捕/一/二/三/遊/左/中/右/指)。 */
export function positionNames(lineup:string[],defense:Record<string,string>):Record<string,string>{
 let of=0;const out:Record<string,string>={};
 for(const id of lineup){const p=defense[id];out[id]=p==='外'?OF_NAMES[of++%3]:p==='DH'?'指':p;}
 return out;
}
/** 1つの守備位置の短い呼び名(外野の誰か分からない時は「外野」、内野のどこでもは「内野」)。 */
export const shortPos=(pos:string)=>pos==='DH'?'指':pos==='外'?'外野':pos==='内'?'内野':pos;
/** 守れる位置(適性)の並び。外野は 左・中・右、内野(どこでも)は 一・二・三・遊 に開く。 */
export function aptitudeNames(positions:readonly string[]):string[]{
 const out:string[]=[];
 for(const p of positions){const add=p==='外'?[...OF_NAMES]:p==='内'?['一','二','三','遊']:[p==='DH'?'指':p];for(const a of add)if(!out.includes(a))out.push(a);}
 return out;
}
