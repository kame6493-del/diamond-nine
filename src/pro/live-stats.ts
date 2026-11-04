// 試合中の成績(2026-11-04 vc43、持ち主「試合中に1打席の結果が出た際に、打率とか防御率とか動くようにしてください」)。
// 画面に出す今季の成績 = 試合の直前の表(レギュラーシーズン、短期決戦の時は短期決戦の表) + この試合のここまで。
// 試合の後にシーズンへ入る数(managed.ts の commitManaged)は、直前の表に試合の成績表を足した物なので、最後に必ず一致する。
// 防御率は今までどおり自責点(engine.ts の era と同じ er*27/outs)。投球回が0の時は「-」。
import {formatAvg,formatIP} from './data';
import type {BatStats,PitStats} from './engine';

export interface BatLine {ab:number;hits:number;hr:number;rbi:number;pa:number;sb:number}
export interface PitLine {outs:number;er:number;so:number;wins:number;saves:number}
/** 直前の表とこの試合の分を足す(片方が無い時はある方だけ)。 */
export function batLine(season?:BatStats,today?:BatStats):BatLine{
 const n=(k:keyof BatLine)=>(season?.[k]??0)+(today?.[k]??0);
 return {ab:n('ab'),hits:n('hits'),hr:n('hr'),rbi:n('rbi'),pa:n('pa'),sb:n('sb')};
}
export function pitLine(season?:PitStats,today?:PitStats):PitLine{
 const n=(k:keyof PitLine)=>(season?.[k]??0)+(today?.[k]??0);
 return {outs:n('outs'),er:n('er'),so:n('so'),wins:n('wins'),saves:n('saves')};
}
export const avgText=(b:BatLine)=>b.ab?formatAvg(b.hits/b.ab):'---';
export const eraValue=(p:PitLine)=>p.outs?p.er*27/p.outs:null;
/** 防御率の表示。投球回が0の時は「-」。 */
export const eraText=(p:Pick<PitLine,'outs'|'er'>)=>p.outs?(p.er*27/p.outs).toFixed(2):'-';
export const ipText=(p:PitLine)=>formatIP(p.outs);

// ---- 変わった所 ----
// up=その選手にとって良くなった(打率が上がる・本塁打/打点/奪三振/投球回が増える・防御率が下がる)、down=悪くなった。
export type Move='up'|'down';
export interface BatMove {avg?:Move;hr?:Move;rbi?:Move;from:BatLine;to:BatLine}
export interface PitMove {era?:Move;ip?:Move;so?:Move;er?:Move;from:PitLine;to:PitLine}
const cmp=(a:number,b:number,higherIsBetter=true):Move|undefined=>a===b?undefined:(b>a)===higherIsBetter?'up':'down';
export function batMove(from:BatLine,to:BatLine):BatMove|null{
 // 打率は表示の桁(3桁)で比べる。打数が増えても表示が同じなら動かさない(.250→.250 は出さない)。
 const fa=from.ab?Math.round(from.hits/from.ab*1000):null,ta=to.ab?Math.round(to.hits/to.ab*1000):null;
 const m:BatMove={from,to,avg:ta===null?undefined:fa===null?(ta>0?'up':'down'):cmp(fa,ta),hr:cmp(from.hr,to.hr),rbi:cmp(from.rbi,to.rbi)};
 return m.avg||m.hr||m.rbi?m:null;
}
export function pitMove(from:PitLine,to:PitLine):PitMove|null{
 const fe=from.outs?Math.round(from.er*2700/from.outs):null,te=to.outs?Math.round(to.er*2700/to.outs):null;
 const m:PitMove={from,to,era:te===null?undefined:fe===null?(to.er>0?'down':'up'):cmp(fe,te,false),ip:cmp(from.outs,to.outs),so:cmp(from.so,to.so),er:cmp(from.er,to.er,false)};
 // 「-」から初めて数が出た時は、0.00 なら良くなった・自責点があれば悪くなった。0回のまま失点した(防御率は「-」のまま)時も、自責点の増えは出す。
 return m.era||m.ip||m.so||m.er?m:null;
}
/** その時の「この試合の成績」の写し(試合の計算は先の打席まで進んでいるので、見せた時の数を取っておく)。 */
export function snapshot<T extends BatStats|PitStats>(table:Record<string,T>|undefined):Record<string,T>{
 const out:Record<string,T>={};for(const [k,v] of Object.entries(table??{}))out[k]={...v};return out;
}
