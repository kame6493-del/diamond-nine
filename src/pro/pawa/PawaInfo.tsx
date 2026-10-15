import {X} from 'lucide-react';
import {formatAvg,formatIP,playerMap,teamById,type Player} from '../data';
import {battingAverage,era,ops,type BatStats,type GameState,type PitStats,type Season} from '../engine';
import {leagueFor} from '../leagues';
import {leagueSeasonStats,leagueStatsNames} from '../league-stats';

// 試合・成績やチーム編成で使う、ゲーム内の記録から作る小さな情報(作り話の数字は出さない)。

/** 2チームの対戦成績(a から見た勝敗と得失点)。 */
export function headToHead(season:Season,a:string,b:string){
 let w=0,l=0,d=0,rf=0,ra=0;
 for(const g of season.results){
  if(!((g.home===a&&g.away===b)||(g.home===b&&g.away===a)))continue;
  const mine=g.home===a?g.homeRuns:g.awayRuns,theirs=g.home===a?g.awayRuns:g.homeRuns;
  rf+=mine;ra+=theirs;if(mine>theirs)w++;else if(mine<theirs)l++;else d++;
 }
 return {w,l,d,rf,ra,games:w+l+d};
}

/** 自チームの試合の内訳(ホーム・ビジター・1点差・今の連勝/連敗)。 */
export function splitRecord(season:Season,club:string){
 const games=season.results.filter(g=>g.home===club||g.away===club);
 const blank=()=>({w:0,l:0,d:0});
 const home=blank(),away=blank(),close=blank();
 let streak=0,kind='';
 for(const g of games){
  const isHome=g.home===club,o=isHome?g.homeRuns:g.awayRuns,t=isHome?g.awayRuns:g.homeRuns,r=o>t?'w':o<t?'l':'d';
  const bucket=isHome?home:away;bucket[r]++;
  if(Math.abs(o-t)===1)close[r]++;
  if(r==='d'){streak=0;kind='';}else if(r===kind)streak++;else{kind=r;streak=1;}
 }
 return {home,away,close,streak,kind};
}

/** その選手の今季の成績行(自チームの行が無ければ所属球団の行)。 */
export function seasonLines(season:Season,club:string,p:Player):{bat?:BatStats;pit?:PitStats;own:boolean}{
 const bat=season.batting[`${club}|${p.id}`],pit=season.pitching[`${club}|${p.id}`];
 if(bat||pit)return {bat,pit,own:true};
 return {bat:season.batting[`${p.team}|${p.id}`],pit:season.pitching[`${p.team}|${p.id}`],own:false};
}

/** 自チームでの通算(保存されている過去のシーズン+今季)。 */
export function careerLines(state:GameState,id:string){
 const seasons=[state.season,...state.history.filter(s=>s.number!==state.season.number)];
 let n=0;const b={games:0,pa:0,ab:0,hits:0,doubles:0,triples:0,hr:0,rbi:0,bb:0,hbp:0,sf:0,sb:0};const p={games:0,wins:0,losses:0,saves:0,outs:0,er:0,so:0};
 for(const s of seasons){
  const x=s.batting[`${state.club}|${id}`],y=s.pitching[`${state.club}|${id}`];
  if(x||y)n++;
  if(x)for(const k of Object.keys(b) as (keyof typeof b)[])b[k]+=x[k];
  if(y)for(const k of Object.keys(p) as (keyof typeof p)[])p[k]+=y[k];
 }
 return {seasons:n,stored:seasons.length,bat:b,pit:p};
}

const avgText=(b:{ab:number;hits:number}|undefined)=>b?.ab?formatAvg(b.hits/b.ab):'—';

/** 球団の詳細(順位表のチーム名を押すと開く)。 */
export function TeamSheet({season,state,team,onClose,onPlayer}:{season:Season;state:GameState;team:string;onClose:()=>void;onPlayer:(p:Player)=>void}){
 const league=leagueFor(season,team),rows=leagueSeasonStats(season,league as never).rows,me=rows.find(r=>r.team===team);
 const mine=team===state.club,name=mine?(season.shareTeam?.name??state.name):teamById(team,season).short;
 const rankOf=(key:'avg'|'hr'|'sb'|'obp'|'era'|'rf'|'ra'|'so',low=false)=>{const v=me?.[key];if(v==null)return null;return 1+rows.filter(r=>r[key]!=null&&(low?(r[key] as number)<(v as number)-1e-10:(r[key] as number)>(v as number)+1e-10)).length;};
 const vs=mine?null:headToHead(season,state.club,team);
 const bats=Object.values(season.batting).filter(b=>b.team===team&&playerMap[b.playerId]).sort((a,b)=>b.pa-a.pa).slice(0,6);
 const pits=Object.values(season.pitching).filter(p=>p.team===team&&playerMap[p.playerId]).sort((a,b)=>b.outs-a.outs).slice(0,6);
 const cells:[string,string,number|null][]=me?[['打率',me.avg==null?'—':formatAvg(me.avg),rankOf('avg')],['本塁打',String(me.hr),rankOf('hr')],['盗塁',String(me.sb),rankOf('sb')],['出塁率',me.obp==null?'—':formatAvg(me.obp),rankOf('obp')],['得点',String(me.rf),rankOf('rf')],['失点',String(me.ra),rankOf('ra',true)],['防御率',me.era==null?'—':me.era.toFixed(2),rankOf('era',true)],['奪三振',String(me.so),rankOf('so')]]:[];
 const nameBtn=(id:string)=><button className="pw-ts-name" data-player-id={id} onClick={()=>onPlayer(playerMap[id])}>{playerMap[id].name}</button>;
 return <div className="pw-modal pw-sheet-modal" onClick={onClose}><div className="pw-sheet pw-team-sheet" role="dialog" aria-modal="true" aria-label={`${name}の詳細`} onClick={e=>e.stopPropagation()}>
  <header className="pw-sheet-head"><h2>{name}</h2><button className="pw-close" onClick={onClose} aria-label="閉じる"><X size={22}/></button></header>
  {me?<>
   <p className="pw-ts-rec"><b>{me.rank??'—'}</b><small>位</small><span><b>{me.w}</b>勝<b>{me.l}</b>敗<b>{me.d}</b>分</span><span>勝率 <b>{me.pct==null?'.000':formatAvg(me.pct)}</b></span>{me.rank&&me.rank>1&&me.gamesBehind!=null&&<span>首位と <b>{me.gamesBehind.toFixed(1)}</b>差</span>}<em>{(leagueStatsNames as Record<string,string>)[league]??league}</em></p>
   <dl className="pw-ts-grid">{cells.map(([l,v,r])=><div key={l}><dt>{l}</dt><dd>{v}</dd>{r&&<i className={'pw-rankpill pw-rankpill-'+Math.min(r,4)}>{r}位</i>}</div>)}</dl>
  </>:<p className="pw-note">まだ試合をしていません。</p>}
  {vs&&<p className="pw-ts-vs">{state.name}から見た対戦 <b>{vs.w}勝{vs.l}敗{vs.d?`${vs.d}分`:''}</b> 得点 <b>{vs.rf}</b> 失点 <b>{vs.ra}</b></p>}
  {bats.length>0&&<><h4>主な打者</h4><table className="pw-ts-table"><thead><tr><th>選手</th><th>打率</th><th>本</th><th>点</th><th>OPS</th></tr></thead><tbody>{bats.map(b=><tr key={b.playerId}><th>{nameBtn(b.playerId)}</th><td>{avgText(b)}</td><td>{b.hr}</td><td>{b.rbi}</td><td>{b.pa?formatAvg(ops(b)):'—'}</td></tr>)}</tbody></table></>}
  {pits.length>0&&<><h4>主な投手</h4><table className="pw-ts-table"><thead><tr><th>選手</th><th>防御率</th><th>勝-敗</th><th>S</th><th>回</th></tr></thead><tbody>{pits.map(p=><tr key={p.playerId}><th>{nameBtn(p.playerId)}</th><td>{p.outs?era(p).toFixed(2):'—'}</td><td>{p.wins}-{p.losses}</td><td>{p.saves}</td><td>{formatIP(p.outs)}</td></tr>)}</tbody></table></>}
 </div></div>;
}

export {battingAverage};
