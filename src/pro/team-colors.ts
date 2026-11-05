// チームのイメージカラー(2026-11-05)。持ち主「ユニの色とか良い感じにして。イメージカラーで」。
// 試合の人形のユニフォーム・帽子、スコアボード・打者と投手の帯・スタメンの画面のチーム名を、同じ色にそろえる。
//  - 国内の12球団: 一般によく知られた色に近い色(主の色=上着、差し色=帽子のつば・ライン)。名前は地名のまま。
//  - 海外(mlb-*): データの color(各球団の色)を主の色に、差し色は白か紺。
//  - 宇宙人の球団: 番号から決まった色相で、互いに見分けやすい色。
//  - 自分のチーム: 球団を作った時に選んだ色(franchise.color)。
// 両チームの色が近すぎる時は、ビジター(先攻)を「白い上着+チームの色の帽子」の形にして見分ける(uniformsFor)。
// ChatGPT イメージの見本帳(gpt_ui_1105/d9gpt1105_uniform_*)の色の組み合わせを元にした。
import {circuitOf,type Circuit} from './leagues';
import {mlbLeagueTeams} from './mlb-opponents';

export interface TeamColor {main:string;sub:string}
// 色は ChatGPT イメージの見本帳(gpt_ui_1105/d9gpt1105_uniform_0.png)のカラーコードのまま。
const NPB:Record<string,TeamColor>={
 t:{main:'#ffd400',sub:'#000000'},// 黄と黒
 g:{main:'#ff7f00',sub:'#000000'},// オレンジと黒
 db:{main:'#0057d8',sub:'#ffffff'},// 青
 c:{main:'#e60012',sub:'#8c001a'},// 赤
 s:{main:'#00a651',sub:'#0b1b45'},// 緑と紺
 d:{main:'#0045a0',sub:'#ffffff'},// 青
 h:{main:'#ffc400',sub:'#000000'},// 黄と黒
 f:{main:'#00a7e1',sub:'#0b2d5c'},// 水色と紺
 b:{main:'#0b2151',sub:'#d6a600'},// 紺と金
 e:{main:'#8c001a',sub:'#ffffff'},// えんじ
 l:{main:'#0b2d5c',sub:'#7ec8ff'},// 紺と水色
 m:{main:'#000000',sub:'#ffffff'},// 黒と白
};
const hsl=(h:number,s:number,l:number)=>{const a=s*Math.min(l,1-l),f=(n:number)=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));};return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');};
const SPACE_IDS=['108','109','110','111','112','113','114','115','116','117','118','119','120','121','133','134','135','136','137','138','139','140','141','142','143','144','145','146','147','158'];
/** 宇宙人の球団の色: 30球団を色相環に等間隔(7つ飛ばしで隣どうしが似ないように)、明るさを3段に。 */
function spaceColor(id:string):TeamColor{
 const i=Math.max(0,SPACE_IDS.indexOf(id.replace('mlb-','')));const h=(i*7*12)%360,l=[.42,.5,.34][i%3];
 return {main:hsl(h,.75,l),sub:hsl((h+180)%360,.6,.72)};
}
const darkOrLight=(hex:string)=>{const [r,g,b]=rgb(hex);return .299*r+.587*g+.114*b<140?'#ffffff':'#1a1a1a';};
export function rgb(hex:string):[number,number,number]{const n=parseInt(hex.slice(1),16);return [n>>16&255,n>>8&255,n&255];}
/** 球団の色。circuit が SPACE の時は宇宙人の球団の色。club/clubColor は自分のチーム。 */
export function teamColor(team:string,opts:{circuit?:Circuit;club?:string;clubColor?:string}={}):TeamColor{
 if(opts.club&&team===opts.club&&opts.clubColor&&/^#[0-9a-fA-F]{6}$/.test(opts.clubColor))return {main:opts.clubColor,sub:darkOrLight(opts.clubColor)};
 if(team.startsWith('mlb-')){
  if(opts.circuit==='SPACE')return spaceColor(team);
  const c=mlbLeagueTeams.find(t=>t.id===team)?.color??'#174a85';return {main:c,sub:darkOrLight(c)==='#ffffff'?'#e8e8e8':'#1a2a4a'};
 }
 return NPB[team]??{main:'#1f5fd0',sub:'#ffffff'};
}
/** 状態から(自分のチームの色・リーグ)。 */
export function teamColorIn(state:{club:string;franchise?:{color?:string;established?:boolean};season:Parameters<typeof circuitOf>[0]},team:string):TeamColor{
 return teamColor(team,{circuit:circuitOf(state.season),club:state.club,clubColor:state.franchise?.established?state.franchise.color:undefined});
}
// ---- 色の近さ(CIE76 の ΔE。sRGB → Lab) ----
function lab(hex:string){
 const f=(c:number)=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
 const [r,g,b]=rgb(hex).map(f);
 const X=(r*.4124+g*.3576+b*.1805)/.95047,Y=r*.2126+g*.7152+b*.0722,Z=(r*.0193+g*.1192+b*.9505)/1.08883;
 const t=(v:number)=>v>.008856?Math.cbrt(v):7.787*v+16/116;
 return [116*t(Y)-16,500*(t(X)-t(Y)),200*(t(Y)-t(Z))];
}
export function colorDistance(a:string,b:string){const x=lab(a),y=lab(b);return Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2]);}
/** 見分けにくいとみなす近さ(ΔE)。 */
export const TOO_CLOSE=28;
/** 1チームのユニフォーム: body=上着(と靴下)、cap=帽子。away=ビジター用(白い上着+チームの色の帽子)。 */
export interface Uniform {body:string;cap:string;away:boolean}
const AWAY_BODY='#eef2f7';
/** 両チームのユニフォーム(0=先攻・ビジター、1=後攻・ホーム)。色が近い時はビジターを白い上着にする。
 *  それでも近い時(ホームが白に近い色)は、ビジターの上着を差し色にする。 */
export function uniformsFor(away:TeamColor,home:TeamColor):[Uniform,Uniform]{
 const h:Uniform={body:home.main,cap:home.main,away:false};
 if(colorDistance(away.main,home.main)>=TOO_CLOSE)return [{body:away.main,cap:away.main,away:false},h];
 // ビジター用: 白い上着。帽子は差し色(差し色が白に近い時は主の色)。見本帳の「ビジター(白ベース+差し色)」。
 const cap=colorDistance(away.sub,AWAY_BODY)<TOO_CLOSE?away.main:away.sub;
 if(colorDistance(AWAY_BODY,home.main)>=TOO_CLOSE)return [{body:AWAY_BODY,cap,away:true},h];
 return [{body:away.sub,cap:away.main,away:true},h];
}
/** 暗い地(スコアボード・帯)の上で読める文字の色: 暗すぎる色は明るくする。 */
export function readableOnDark(hex:string){
 const [r,g,b]=rgb(hex),y=.299*r+.587*g+.114*b;if(y>=110)return hex;
 const k=Math.min(1,(110-y)/110+.35);const m=(c:number)=>Math.round(c+(255-c)*k);
 return '#'+[m(r),m(g),m(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
/** 明るい地(スタメンの画面の白い札)の上で読める文字の色。 */
export function readableOnLight(hex:string){
 const [r,g,b]=rgb(hex),y=.299*r+.587*g+.114*b;if(y<=150)return hex;
 const k=Math.min(.7,(y-150)/150+.25);const m=(c:number)=>Math.round(c*(1-k));
 return '#'+[m(r),m(g),m(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
