import type {CSSProperties} from 'react';
import {grade,teamById,type Player,type Ratings} from '../data';
import {ownedRatings,ratingOverall} from '../development';
import type {GameState} from '../engine';
import {JerseyArt} from '../CardDeck';
import {pitchingRoleLabel} from '../wiki-players';

export type Tier='standard'|'gold'|'rainbow';
// Same thresholds as the scout reveal (scout-presentation.ts).
export const tierFor=(player:Player,overall:number):Tier=>overall>=95?'rainbow':overall>=85||player.mlb?'gold':'standard';
export const roleLabel=(p:Player)=>p.mlb?.twoWay?'投/DH':p.role==='pitcher'?pitchingRoleLabel(p):(p.positions[0]??'DH');
export const cardRatings=(p:Player,state:GameState,base=false):Ratings=>base?p.ratings:ownedRatings(p,state.owned,state.training);
const cap=(n:number)=>Math.min(99,n);
/** 名前を「…」で切らずに入れるための文字の大きさ(スマホの狭い欄だけ CSS の var(--nm) で使う)。
 *  全角1字=1、半角=0.55、空白=0.35 として、欄の幅 maxPx に収まる大きさ(base 以下・10px 以上)。 */
export function fitName(name:string,maxPx:number,base:number):CSSProperties{
 let units=0;for(const ch of name)units+=ch===' '||ch==='　'?.35:/[ -~｡-ﾟ]/.test(ch)?.55:1;
 return {'--nm':`${Math.max(10,Math.min(base,Math.floor(maxPx/Math.max(1,units)*10)/10))}px`} as CSSProperties;
}

/** 能力ランクの札(参考画像のパワプロ風の色の角丸)。数字は横に小さく。 */
export function Rank({value,label,showValue=false}:{value:number;label?:string;showValue?:boolean}){
 const g=grade(cap(value));
 return <span className="pw-rank-wrap" aria-label={`${label??''} ${g} ${cap(value)}`.trim()}><i className="pw-rank" data-rank={g} aria-hidden="true">{g}</i>{showValue&&<em>{cap(value)}</em>}</span>;
}

/** 守備位置のチップ(捕=青、内野=黄、外野=緑、DH=紫)と投手の役割のチップ(先・中・抑)。 */
const posKind=(pos:string)=>pos==='捕'?'c':['一','二','三','遊','内'].includes(pos)?'if':pos==='外'?'of':pos==='DH'?'dh':'p';
export function PosChip({pos,label}:{pos:string;label?:string}){
 return <i className={'pw-pos pw-pos-'+posKind(pos)} aria-label={label??pos}>{pos==='DH'?'指':pos}</i>;
}
export function RoleChip({role}:{role:'先'|'中'|'抑'}){
 return <i className={'pw-role pw-role-'+role} aria-label={role==='先'?'先発':role==='中'?'中継ぎ':'抑え'}>{role}</i>;
}

/** OVR の盾(紺の盾に金の縁と月桂樹。数字は文字で載せる)。 */
export function OvrShield({value,size='m'}:{value:number;size?:'s'|'m'|'l'}){
 const leaf=(side:1|-1)=>Array.from({length:5},(_,i)=>{const a=(235-i*16)*Math.PI/180,x0=50+40*Math.cos(a),x=side===1?x0:100-x0,y=58-40*Math.sin(a);const r=side===1?(i*16-55):-(i*16-55);return <ellipse key={side+'-'+i} cx={x} cy={y} rx="4" ry="8" transform={`rotate(${r} ${x} ${y})`}/>;});
 return <span className={'pw-ovr pw-ovr-'+size} aria-label={`総合 ${value}`}>
  <svg viewBox="0 0 100 104" aria-hidden="true"><defs>
   <linearGradient id="pw-ovr-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff1a8"/><stop offset=".5" stopColor="#f2b52c"/><stop offset="1" stopColor="#a8670c"/></linearGradient>
   <linearGradient id="pw-ovr-navy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24438f"/><stop offset="1" stopColor="#0d1f52"/></linearGradient></defs>
   <g fill="url(#pw-ovr-gold)">{leaf(1)}{leaf(-1)}</g>
   <path d="M50 4 86 17v38c0 22-17 36-36 45C31 91 14 77 14 55V17Z" fill="url(#pw-ovr-navy)" stroke="url(#pw-ovr-gold)" strokeWidth="6" strokeLinejoin="round"/>
  </svg>
  <small>OVR</small><b>{value}</b>
 </span>;
}

/** 総合値の箱(一覧の左端に大きく)。色: 95以上=虹・85以上(海外)=金・70以上=銀・それ未満=銅。文字でも「総合」と出す。 */
export function OvrBox({value,player,size='m'}:{value:number;player?:Player;size?:'m'|'l'}){
 const metal=value>=95?'rainbow':value>=85||player?.mlb?'gold':value>=70?'silver':'bronze';
 return <span className={'pw-ovrbox pw-ovrbox-'+size} data-metal={metal} aria-label={`総合 ${value}`}><small aria-hidden="true">総合</small><b aria-hidden="true">{value}</b></span>;
}

/** 選手カード: 枠の色(通常=青・金・虹)、総合のランク札、チーム色のユニフォームの絵、背番号と名前。人の絵は描かない。 */
export function PawaCard({player,state,base=false,size='m',onClick,label}:{player:Player;state:GameState;base?:boolean;size?:'s'|'m'|'l';onClick?:()=>void;label?:string}){
 const ratings=cardRatings(player,state,base),overall=ratingOverall(player,ratings),tier=tierFor(player,overall);
 const team=teamById(player.team),pos=roleLabel(player),number=player.mlb?.number??player.roster?.number;
 const body=<>
  <span className="nc-ovrtop"><small>総合</small><b>{overall}</b></span>
  <span className="nc-pos">{pos.length>2?pos.slice(0,2):pos}</span>
  <span className="nc-art"><JerseyArt player={player}/></span>
  <span className="nc-plate"><b>{player.name}</b>{size!=='s'&&<small>{team.short}{player.mlb?' · 海外':''}</small>}</span>
 </>;
 const cls=`nv-card nc-${size} nc-${tier}`;
 const style={'--team-tint':team.color} as CSSProperties;
 return onClick?<button type="button" className={cls} style={style} onClick={onClick} aria-label={label??`${player.name} 総合${overall}`}>{body}</button>:<div className={cls} style={style} aria-label={label}>{body}</div>;
}

/** 能力の並び(野手: ミート・パワー・走力・肩・守備 / 投手: 球速・制球・スタミナ・変化)。 */
export function GradeRow({player,ratings,mode=player.role,big=false,values=true}:{player:Player;ratings:Ratings;mode?:'batter'|'pitcher';big?:boolean;values?:boolean}){
 const list=mode==='pitcher'?[['球速',null],['制球',ratings.control],['スタミナ',ratings.stamina],['変化',ratings.breaking]] as const:[['ミート',ratings.contact],['パワー',ratings.power],['走力',ratings.speed],['肩',ratings.arm],['守備',ratings.field]] as const;
 return <div className={'nv-grades'+(big?' is-big':'')}>{list.map(([label,value])=>value===null
  ?<div key={label} className="nv-grade nv-velocity"><small>{label}</small><b>{player.ratings.velocity}</b><em>km/h</em></div>
  :<div key={label} className="nv-grade"><small>{label}</small><Rank value={value} label={label} showValue={values}/></div>)}</div>;
}

/** 能力を1行ずつ大きく見せる一覧(スカウト結果など、すぐ読みたい所)。項目名・ランク・数値・目盛り。 */
export function StatList({player,ratings,mode=player.role}:{player:Player;ratings:Ratings;mode?:'batter'|'pitcher'}){
 const rows=mode==='pitcher'?[['制球',ratings.control],['スタミナ',ratings.stamina],['変化',ratings.breaking]] as const:[['ミート',ratings.contact],['パワー',ratings.power],['走力',ratings.speed],['肩',ratings.arm],['守備',ratings.field]] as const;
 return <dl className="pw-statlist">
  {mode==='pitcher'&&<div><dt>球速</dt><dd><b className="pw-statlist-velo">{player.ratings.velocity}<small>km/h</small></b></dd></div>}
  {rows.map(([label,v])=>{const n=cap(v);return <div key={label}><dt>{label}</dt><dd><Rank value={n} label={label}/><b>{n}</b><span className="pw-statbar" aria-hidden="true"><i data-rank={grade(n)} style={{width:`${n}%`}}/></span></dd></div>;})}
 </dl>;
}
