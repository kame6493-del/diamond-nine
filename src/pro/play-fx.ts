// 試合のプレーの演出(2026-11-05)。持ち主「ドパガキが喜ぶような演出にして。それも ChatGPT に作らせて」。
// 見た目は ChatGPT イメージの見本帳(gpt_ui_1105/d9gpt1105_effects_1〜5)を元にした: 斜めの金の太い文字・濃い縁取り・光の筋・火花・
// 紙吹雪・虹の弧。段階を付け、ふつうの物は小さく、珍しい物ほど大きく長く。
// 決まり: タップ待ちにしない(時間で消える)。強い光の点滅はしない(光は1回広がって消える)。グラウンドの枠の中だけに出して下の操作を隠さない。
// 倍速では短く、8倍以上はホームラン・サヨナラだけを小さく、「次の打席へ」「試合終了まで」では出さない。強さは設定で 派手・ふつう・控えめ。
import type {LiveEvent} from './engine';

export type FxTier='small'|'mid'|'big';
export type FxKind='K'|'DP'|'TP'|'FINE'|'LASER'|'HR'|'GRAND'|'COMEBACK'|'WALKOFF';
export interface Fx {kind:FxKind;tier:FxTier;title:string;sub?:string;ms:number}
export type FxLevel='flashy'|'normal'|'calm';
export const FX_LEVELS:FxLevel[]=['flashy','normal','calm'];
export const fxLevelLabel:Record<FxLevel,string>={flashy:'派手',normal:'ふつう',calm:'控えめ'};
export const FX_KEY='diamond-nine-fx-level';
export function readFxLevel(storage?:Pick<Storage,'getItem'>):FxLevel{try{const v=(storage??localStorage).getItem(FX_KEY);return v==='normal'||v==='calm'?v:'flashy';}catch{return 'flashy';}}
export function saveFxLevel(v:FxLevel,storage?:Pick<Storage,'setItem'>){try{(storage??localStorage).setItem(FX_KEY,v);}catch{/* 覚えられなくても遊べる */}}

const TIER:Record<FxKind,FxTier>={K:'small',DP:'small',FINE:'small',LASER:'small',HR:'mid',COMEBACK:'mid',GRAND:'big',TP:'big',WALKOFF:'big'};
const TITLE:Record<FxKind,string>={K:'三振!',DP:'ゲッツー!',TP:'トリプルプレー!',FINE:'ファインプレー!',LASER:'レーザービーム!',HR:'ホームラン!',GRAND:'満塁ホームラン!',COMEBACK:'逆転!',WALKOFF:'サヨナラ!'};
/** 1倍の時の長さ(ミリ秒)。サヨナラは試合の終わりなので少し長い。 */
const BASE_MS:Record<FxTier,number>={small:1100,mid:1600,big:2200};
/** その打席の演出(無ければ null)。いちばん珍しい物を1つだけ。comeback=この打席で逆転した、walkoff=サヨナラ。 */
export function fxFor(e:LiveEvent,o:{comeback:boolean;walkoff:boolean;speed:number;level:FxLevel}):Fx|null{
 const p=e.play;let kind:FxKind|null=null,sub:string|undefined;
 if(o.walkoff)kind='WALKOFF';
 else if(e.kind==='TP')kind='TP';
 else if(e.kind==='HR'&&e.runs>=4)kind='GRAND';
 else if(e.kind==='HR')kind='HR';
 else if(o.comeback)kind='COMEBACK';
 else if(e.kind==='DP'&&p?.bb==='gb')kind='DP';
 else if(p?.fine)kind='FINE';
 else if(p?.laser)kind='LASER';
 else if(e.kind==='DP')kind='DP';
 else if(e.kind==='K')kind='K';
 if(!kind)return null;
 if(kind==='DP'||kind==='TP')sub=p?.seq;
 const tier=TIER[kind];
 // 8倍以上: ホームラン・サヨナラだけを小さく短く。
 if(o.speed>=8){if(kind!=='HR'&&kind!=='GRAND'&&kind!=='WALKOFF')return null;return {kind,tier:'small',title:TITLE[kind],sub,ms:700};}
 // ふつう: 三振は出さない。控えめ: 中と大だけ。
 if(o.level==='normal'&&kind==='K')return null;
 if(o.level==='calm'&&tier==='small')return null;
 const ms=(kind==='WALKOFF'?2800:BASE_MS[tier])/Math.sqrt(Math.min(4,Math.max(1,o.speed)));
 return {kind,tier,title:TITLE[kind],sub,ms:Math.round(ms)};
}
