import {useMemo,useState,type ReactNode} from 'react';
import {ChevronRight,Trophy,X} from 'lucide-react';
import {formatAvg,playerMap,teamById,type Player} from '../data';
import {battingAverage,era,nextMatchPreview,rankings,type GameState,type Season} from '../engine';
import {circuitLabel,circuitOf,leagueFor,leagueProgress,leagueTeams,NPB_TITLES_TO_MLB,seasonGames,spaceUnlocked,titleFor,type Circuit} from '../leagues';
import {stageLabel} from '../postseason';
import {achievementNames,recordAchievements} from '../achievements';
import {AchievementsPanel} from '../CareerAchievements';
import {FeedbackCard} from '../FeedbackCard';
import {VictoryShare} from '../VictoryShare';
import {LeagueSeasonStats} from '../LeagueSeasonStats';
import {SeasonAd} from '../SeasonAd';
import {teamSeasonStats} from '../team-stats';
import {teamSeasonRanks,leagueStatsNames} from '../league-stats';
import {AUTUMN_EVENT,autumnEventActive,autumnEventEndLabel} from '../autumn-event';
import {seasonGoals} from '../ambitions';
import {PawaStats} from './PawaStats';
import {leagueGoal} from '../league-goal';
import {LeagueGoalCard} from './PawaGoals';
import {fitName} from './PawaCard';
import {DAILY_MISSIONS,useDaily} from '../daily';
import {formatUZR} from '../fielding-stats';
import {seasonConditions} from '../conditions';
import {leagueSeasonStats} from '../league-stats';
import {TeamSheet,headToHead,splitRecord} from './PawaInfo';
import type {Watchable} from '../watch';
import '../watch.css';

const pad=(n:number)=>String(n).padStart(2,'0');
const pct=(w:number,l:number)=>w+l?formatAvg(w/(w+l)):'.000';
const leagueName=(league:string)=>(leagueStatsNames as Record<string,string>)[league]??league;

/** 順位の札(1位=金・2位=銀・3位=銅) */
export function Place({n}:{n:number}){return <span className={'pw-place pw-place-'+n}>{n}</span>;}
/** 球団の頭文字(イタリックの色文字)。実在のロゴは使わず、ゲーム内の略号を文字で出す。 */
export function Mark({mark,color}:{mark:string;color?:string}){return <span className="pw-mark" style={color?{color}:undefined}>{mark}</span>;}

/** 表の球団名。スマホでは欄に収まる大きさに縮めて、「…」で切らない(宇宙リーグの長い名前・自分の球団名)。 */
const TName=({name}:{name:string})=><span className="pw-tname-t" style={fitName(name,86,14)}>{name}</span>;

export function PawaSeason({state,busy,progress,onPlay,onPost,onNext,onPlayer,message,onSwitchLeague,daily,dailyReady=0,onShowResult,goalsOpen:goalsOpenProp,onGoals,playSlot,adSlot,watch=[],onWatch}:{watch?:Watchable[];onWatch?:(key:string)=>void;playSlot?:ReactNode;adSlot?:ReactNode;goalsOpen?:boolean;onGoals?:(open:boolean)=>void;state:GameState;busy:boolean;progress:number;onPlay:(n:number)=>void;onPost:()=>void;onNext:()=>void;onPlayer:(p:Player)=>void;message:string;onSwitchLeague?:(circuit:Circuit)=>void;daily?:ReactNode;dailyReady?:number;onShowResult?:()=>void}){
 const [teamSheet,setTeamSheet]=useState<string|null>(null);
 const [archive,setArchive]=useState(0),[view,setView]=useState<string|null>(null),[goalsOpenLocal,setGoalsOpenLocal]=useState(false);
 const goalsOpen=goalsOpenProp??goalsOpenLocal,setGoalsOpen=onGoals??setGoalsOpenLocal;
 const lgGoal=leagueGoal(state),dailyRec=useDaily();
 const season:Season=state.history.find(s=>s.number===archive)??state.season;
 const current=season===state.season,league=leagueFor(season,state.club),table=rankings(season,league),mine=table.find(t=>t.team===state.club)!,rank=table.indexOf(mine)+1;
 const circuit=circuitOf(season),space=circuit==='SPACE',major=circuit!=='NPB',total=seasonGames(season),career=leagueProgress(state);
 const next=current?nextMatchPreview(state):null,post=season.postseason,champion=post?.champion;
 const clubName=season.shareTeam?.name??state.name,clubMark='D';
 const nameOf=(id:string)=>id===state.club?clubName:teamById(id,season).short;
 const colorOf=(id:string)=>id===state.club?'#0d6efa':teamById(id,season).color;
 const markOf=(id:string)=>id===state.club?clubMark:teamById(id,season).mark;
 const achievements=recordAchievements(state).achievements??{},recent=(Object.keys(achievementNames) as Array<keyof typeof achievementNames>).filter(id=>achievements[id]===season.number).at(-1);
 const challengeRevealed=major||career.mlbUnlocked||career.npbStreak>0||achievements.npbLeague!==undefined;
 const games=season.results.filter(g=>g.home===state.club||g.away===state.club);
 const last=games.at(-1);
 const stats=teamSeasonStats(season,state.club),{ranks,uzrRank}=teamSeasonRanks(season,state.club);
 const leagues=useMemo(()=>[...new Set(leagueTeams(season).map(t=>t.league))],[season]);
 const shown=view&&leagues.includes(view)?view:league,shownTable=rankings(season,shown),leader=shownTable[0];
 const gb=(t:typeof leader)=>((leader.w-t.w)+(t.l-leader.l))/2;
 const runRank=(key:'rf'|'ra')=>[...table].sort((a,b)=>key==='rf'?b.rf-a.rf:a.ra-b.ra).findIndex(t=>t.team===state.club)+1;
 const goals=current?seasonGoals(state):[];
 const stage=space?'宇宙リーグ':major?'海外リーグ':'国内リーグ';
 const stageText=!major?(career.mlbUnlocked?'海外リーグに挑戦できます':`${NPB_TITLES_TO_MLB}連覇で海外リーグへ あと${Math.max(0,NPB_TITLES_TO_MLB-career.npbStreak)}回`):space?'宇宙王座決定戦の優勝を目指そう':'世界王座決定戦の優勝を目指そう';
 const rankPill=(r:number|null|undefined)=>r?<i className={'pw-rankpill pw-rankpill-'+Math.min(r,4)}>{r}位</i>:<i className="pw-rankpill">—</i>;

 const [tab,setTab]=useState<'game'|'table'|'bat'|'pit'|'team'|'more'>('game');
 const lastGame=last&&(()=>{const home=last.home===state.club,ours=home?last.homeRuns:last.awayRuns,theirs=home?last.awayRuns:last.homeRuns,other=home?last.away:last.home,res=ours>theirs?'WIN':ours<theirs?'LOSE':'DRAW';return {ours,theirs,other,res};})();
 const form=games.slice(-10).map(g=>{const home=g.home===state.club,o=home?g.homeRuns:g.awayRuns,t=home?g.awayRuns:g.homeRuns;return o>t?'W':o<t?'L':'D';});
 const standings=(compact:boolean)=><table className={'pw-stand'+(compact?' is-compact':'')}><thead><tr><th>位</th><th>チーム</th><th>勝</th><th>負</th><th>分</th><th>勝率</th><th>差</th><th>得点</th><th>失点</th><th>得失</th></tr></thead>
  <tbody>{shownTable.map((t,i)=><tr key={t.team} className={t.team===state.club?'is-mine':''}><td><Place n={i+1}/></td><td><button className="pw-tname" onClick={()=>setTeamSheet(t.team)} aria-label={`${nameOf(t.team)}の詳細`}><Mark mark={markOf(t.team)} color={colorOf(t.team)}/><TName name={nameOf(t.team)}/></button></td><td>{t.w}</td><td>{t.l}</td><td>{t.d}</td><td>{pct(t.w,t.l)}</td><td>{i?gb(t).toFixed(1):'-'}</td><td>{t.rf}</td><td>{t.ra}</td><td className={t.rf-t.ra>0?'is-plus':t.rf-t.ra<0?'is-minus':''}>{t.rf-t.ra>0?'+':''}{t.rf-t.ra}</td></tr>)}</tbody></table>;
 const lg=useMemo(()=>leagueSeasonStats(season,shown as never).rows,[season,shown]);
 const conds=current&&!season.completed&&season.day>0?seasonConditions(state):[];
 const ownBat=Object.values(season.batting).filter(b=>b.team===state.club&&playerMap[b.playerId]),ownPit=Object.values(season.pitching).filter(p=>p.team===state.club&&playerMap[p.playerId]);
 const qual=ownBat.filter(b=>b.pa>=Math.max(1,Math.floor(season.day*3.1*.5)));
 const best=<T,>(list:T[],v:(x:T)=>number,low=false)=>list.length?[...list].sort((a,b)=>low?v(a)-v(b):v(b)-v(a))[0]:undefined;
 const avgTop=best(qual,b=>battingAverage(b)),hrTop=best(ownBat,b=>b.hr),winTop=best(ownPit,p=>p.wins),eraTop=best(ownPit.filter(p=>p.outs>=Math.max(3,Math.floor(season.day*1.5))),p=>era(p),true);
 const nextInfo=next?(()=>{const row=table.findIndex(t=>t.team===next.opponent),t=table[row];const vs=headToHead(season,state.club,next.opponent);return {rank:row+1,t,vs};})():null;
 const split=splitRecord(season,state.club);
 const leagueIds=new Set(leagueTeams(season).filter(t=>t.league===league).map(t=>t.id));
 // リーグの個人順位: 1位の選手と、自チームで一番上の選手の順位
 const topRows=(tab==='bat'?([['打率',Object.values(season.batting).filter(b=>leagueIds.has(b.team)&&b.pa>=Math.max(1,Math.floor(season.day*3.1*.5))).map(b=>({id:b.playerId,team:b.team,v:battingAverage(b)})),(v:number)=>formatAvg(v),false],['本塁打',Object.values(season.batting).filter(b=>leagueIds.has(b.team)).map(b=>({id:b.playerId,team:b.team,v:b.hr})),(v:number)=>String(v),false],['打点',Object.values(season.batting).filter(b=>leagueIds.has(b.team)).map(b=>({id:b.playerId,team:b.team,v:b.rbi})),(v:number)=>String(v),false],['盗塁',Object.values(season.batting).filter(b=>leagueIds.has(b.team)).map(b=>({id:b.playerId,team:b.team,v:b.sb})),(v:number)=>String(v),false]] as const)
  :([['防御率',Object.values(season.pitching).filter(p=>leagueIds.has(p.team)&&p.outs>=Math.max(3,Math.floor(season.day*3))).map(p=>({id:p.playerId,team:p.team,v:era(p)})),(v:number)=>v.toFixed(2),true],['勝利',Object.values(season.pitching).filter(p=>leagueIds.has(p.team)).map(p=>({id:p.playerId,team:p.team,v:p.wins})),(v:number)=>String(v),false],['奪三振',Object.values(season.pitching).filter(p=>leagueIds.has(p.team)).map(p=>({id:p.playerId,team:p.team,v:p.so})),(v:number)=>String(v),false],['セーブ',Object.values(season.pitching).filter(p=>leagueIds.has(p.team)).map(p=>({id:p.playerId,team:p.team,v:p.saves})),(v:number)=>String(v),false]] as const)).map(([label,list,fmt,low])=>{const sorted=[...list].filter(x=>playerMap[x.id]).sort((a,b)=>low?a.v-b.v:b.v-a.v);const top=sorted[0],i=sorted.findIndex(x=>x.team===state.club);return {label,top,fmt,ours:i>=0?{...sorted[i],rank:1+sorted.filter(x=>low?x.v<sorted[i].v-1e-9:x.v>sorted[i].v+1e-9).length}:null};});
 const lgTop=<div className="pw-lgtop"><h3 className="pw-sub-h">リーグの個人順位<small>1位と、チームで一番上の選手</small></h3><table><tbody>{topRows.map(r=><tr key={r.label}><th>{r.label}</th><td>{r.top?<><button style={fitName(playerMap[r.top.id].name,84,13)} data-player-id={r.top.id} onClick={()=>onPlayer(playerMap[r.top!.id])}>{playerMap[r.top.id].name}</button><small>{r.top.team===state.club?clubName:teamById(r.top.team,season).short}</small><b>{r.fmt(r.top.v)}</b></>:'—'}</td><td>{r.ours?<><button style={fitName(playerMap[r.ours.id].name,84,13)} data-player-id={r.ours.id} onClick={()=>onPlayer(playerMap[r.ours!.id])}>{playerMap[r.ours.id].name}</button><b>{r.fmt(r.ours.v)}</b><i>{r.ours.rank}位</i></>:'—'}</td></tr>)}</tbody></table></div>;
 const teamStrip=<dl className="pw-tstrip">{([['打率',stats.avg===null?'—':formatAvg(stats.avg),ranks.avg],['本塁打',String(stats.hr),ranks.hr],['防御率',stats.era===null?'—':stats.era.toFixed(2),ranks.era],['得点',String(mine.rf),runRank('rf')],['失点',String(mine.ra),runRank('ra')]] as const).map(([l,v,r])=><div key={l}><dt>{l}</dt><dd>{v}</dd>{season.day>0&&rankPill(r)}</div>)}</dl>;
 const leaderBtn=(label:string,id:string|undefined,value:string)=><div className="pw-tlead"><small>{label}</small><b>{id?value:'—'}</b>{id&&<button style={fitName(playerMap[id].name,76,12)} data-player-id={id} onClick={()=>onPlayer(playerMap[id])}>{playerMap[id].name}</button>}</div>;
 const tabs=[['game','試合'],['table','順位'],['bat','打者'],['pit','投手'],['team','チーム'],['more','記録']] as const;

 return <div className={'nv-season pw-fit-season'+(season.completed?' is-complete':'')}>
  <div className="pw-subtabs" role="tablist" aria-label="試合・成績の表示">{tabs.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'is-on':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
  {!current&&<p className="pw-archive-note"><span>{season.number}シーズン目({circuitLabel(circuit)})を表示中</span><button className="pw-btn pw-white pw-mini" onClick={()=>setArchive(0)}>今シーズンに戻る</button></p>}

  {tab==='game'&&<div className="pw-game-grid"><div className="pw-game-main">
   <section className="pw-panel pw-sum2" aria-label="今シーズン">
    <div className="pw-sum2-rank">{season.day?<><b>{rank}</b><small>位</small></>:<small>開幕前</small>}</div>
    <div className="pw-sum2-main"><p className="pw-sub">{circuitLabel(circuit)} · {season.number}シーズン目 · {clubName}</p>
     <p className="pw-sum2-wld"><b>{mine.w}</b>勝<b>{mine.l}</b>敗<b>{mine.d}</b>分<span>勝率 <b>{pct(mine.w,mine.l)}</b></span></p>
     <div className="pw-summary-progress"><div className="pw-bar pw-bar-green" role="progressbar" aria-label="シーズン進行" aria-valuenow={season.day} aria-valuemin={0} aria-valuemax={total}><i style={{width:`${season.day/total*100}%`}}/></div><span><b>{season.day}</b>/{total}試合</span></div>
    </div>
   </section>
   {current&&autumnEventActive(new Date())&&<p className="pw-sc-event"><b>{AUTUMN_EVENT.name}</b> 〜{autumnEventEndLabel()} · 1日1回、シーズン終了で +{AUTUMN_EVENT.bonus.toLocaleString('ja-JP')} pt</p>}
   {current&&!season.completed&&<section className="pw-go2" aria-label="試合を進める">
    {next&&<p className="pw-next2">次 <button className="pw-next2-team" onClick={()=>setTeamSheet(next.opponent)}><Mark mark={markOf(next.opponent)} color={colorOf(next.opponent)}/><b>{nameOf(next.opponent)}</b></button>戦{nextInfo&&nextInfo.t&&season.day>0&&<span className="pw-next2-info">({nextInfo.rank}位{nextInfo.vs.games>0&&` · 対戦${nextInfo.vs.w}勝${nextInfo.vs.l}敗`})</span>} · 先発 <button className="pw-next2-p" data-player-id={next.mine} onClick={()=>playerMap[next.mine]&&onPlayer(playerMap[next.mine])}>{playerMap[next.mine]?.name}</button></p>}
    {busy?<div className="pw-working" role="status"><span>試合を計算しています… {progress}%</span><div className="pw-bar"><i style={{width:progress+'%'}}/></div></div>
    :playSlot??<button className="pw-btn pw-yellow pw-wide pw-year-btn" onClick={()=>onPlay(total)}>1年進める<small>{season.day?`残り${total-season.day}試合`:`${total}試合`}をまとめて</small></button>}
   </section>}
   {current&&season.completed&&<section className="pw-panel pw-season-end2">{post?.stage==='complete'?<><p><Trophy aria-hidden="true" size={20}/>{champion===state.club?`${titleFor(season)}、おめでとう！`:`${titleFor(season)}：${champion?nameOf(champion):'—'}`}</p>{onWatch&&watch.length>0&&<button className="wt-entry" onClick={()=>onWatch(watch[0].key)}>今年の名場面を観る<small>{watch.length}試合・監督もできる</small></button>}<div className="pw-go2-btns">{onShowResult&&<button className="pw-btn pw-white" onClick={onShowResult}>結果を見る</button>}<button className="pw-btn pw-yellow" disabled={busy} onClick={()=>{setArchive(0);onNext();}}>{!major&&career.mlbUnlocked&&state.leagueChoice!=='NPB'?'海外リーグへ':'次のシーズンへ'}<ChevronRight size={18}/></button></div></>:<><p>{total}試合が終了しました。</p><button className="pw-btn pw-yellow pw-wide" disabled={busy} onClick={onPost}>王座決定戦の終了まで<ChevronRight size={18}/></button></>}</section>}
   {current&&spaceUnlocked(state)&&!space&&<button className="pw-btn pw-purple pw-wide" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.('SPACE');}}>宇宙リーグ解放！ 挑戦する<ChevronRight size={18}/></button>}
   {message&&current&&<p className="pw-message2" role="status">{message}</p>}
   {current&&adSlot&&<div className="pw-home-ad">{adSlot}</div>}
   {lastGame&&<section className="pw-last2" aria-label="直近の試合"><span className={'pw-res pw-res-'+lastGame.res}>{lastGame.res}</span><b>{lastGame.ours} - {lastGame.theirs}</b><span className="pw-last2-vs">vs <Mark mark={markOf(lastGame.other)} color={colorOf(lastGame.other)}/><TName name={nameOf(lastGame.other)}/></span><span className="pw-last2-form" aria-label="直近10試合">{form.map((r,i)=><i key={i} data-r={r}>{r==='W'?'○':r==='L'?'●':'△'}</i>)}</span></section>}
   <section className="pw-panel pw-mini-stand" aria-label="リーグ順位">{standings(true)}</section>
   </div><div className="pw-game-side"><i className="pw-side-spacer" aria-hidden="true"/>
   {current&&<LeagueGoalCard goal={lgGoal} onOpen={()=>setGoalsOpen(true)}/>}
   {current&&<button className="pw-today-line" onClick={()=>setGoalsOpen(true)} aria-label="今日の目標を開く"><span className="pw-lg-tag">今日</span>{DAILY_MISSIONS.map(m=>{const ok=dailyRec.claimed.includes(m.id)||dailyRec.done.includes(m.id);return <span key={m.id} className={ok?'is-ok':''}><i aria-hidden="true">{ok?'✓':''}</i>{({play:'試合',scout:'スカウト',share:'シェア',team:'編成',result:'結果'} as Record<string,string>)[m.id]??m.label}</span>;})}<em>{DAILY_MISSIONS.filter(m=>dailyRec.done.includes(m.id)||dailyRec.claimed.includes(m.id)).length}/{DAILY_MISSIONS.length}</em></button>}
   {season.day>0&&<section className="pw-panel pw-side-box" aria-label="チーム成績"><h3>チーム成績<small>{leagueName(league)}内の順位</small></h3>{teamStrip}</section>}
   {season.day>0&&<section className="pw-panel pw-side-box" aria-label="チームの主力"><h3>チームの主力<small>今季</small></h3><div className="pw-tleads">{leaderBtn('打率',avgTop?.playerId,avgTop?formatAvg(battingAverage(avgTop)):'—')}{leaderBtn('本塁打',hrTop?.playerId,String(hrTop?.hr??0))}{leaderBtn('勝利',winTop?.playerId,String(winTop?.wins??0))}{leaderBtn('防御率',eraTop?.playerId,eraTop?era(eraTop).toFixed(2):'—')}</div></section>}
   {conds.length>0&&<section className="pw-panel pw-side-box pw-conds" aria-label="今の調子"><h3>今の調子<small>第{conds[0].from}〜{conds[0].through}戦</small></h3><ul>{conds.map(c=><li key={c.playerId} className={c.boost<0?'is-cold':'is-hot'}><button style={fitName(playerMap[c.playerId]?.name??'',100,13)} data-player-id={c.playerId} onClick={()=>onPlayer(playerMap[c.playerId])}>{playerMap[c.playerId]?.name}</button><em>{c.boost===5?'絶好調':c.boost>0?'好調':'不調'} {c.boost>0?'+':''}{c.boost}</em></li>)}</ul></section>}
   {season.day>0&&<section className="pw-panel pw-side-box pw-side-split" aria-label="試合の内訳"><h3>内訳</h3><p><span>ホーム <b>{split.home.w}-{split.home.l}</b></span><span>ビジター <b>{split.away.w}-{split.away.l}</b></span><span>1点差 <b>{split.close.w}-{split.close.l}</b></span><span>得失点差 <b className={mine.rf-mine.ra>0?'is-plus':mine.rf-mine.ra<0?'is-minus':''}>{mine.rf-mine.ra>0?'+':''}{mine.rf-mine.ra}</b></span>{split.streak>1&&<span>{split.streak}{split.kind==='w'?'連勝中':'連敗中'}</span>}</p></section>}

  </div>
   {current&&<button className="pw-goals-open pw-goals2" onClick={()=>setGoalsOpen(true)}><span className="pw-goals-icon" aria-hidden="true">★</span><span><b>目標・達成記録</b></span>{dailyReady>0&&<em>報酬 {dailyReady}</em>}<ChevronRight size={20}/></button>}
  </div>}

  {tab==='table'&&<section className="pw-panel pw-standings" aria-label="リーグ順位">
   {leagues.length>1&&<div className="pw-seg" role="tablist">{leagues.map(l=><button key={l} role="tab" aria-selected={shown===l} className={shown===l?'is-on':''} onClick={()=>setView(l)}>{leagueName(l)}</button>)}</div>}
   <div className="pw-split2"><div>{standings(false)}
   {leagues.filter(l=>l!==shown).map(l=>{const t=rankings(season,l),top=t[0];return <div key={l} className="pw-other-league"><h3 className="pw-sub-h">{leagueName(l)}<small>押すとチームの詳細</small></h3><table className="pw-stand is-compact"><tbody>{t.map((r,i)=><tr key={r.team} className={r.team===state.club?'is-mine':''}><td><Place n={i+1}/></td><td><button className="pw-tname" onClick={()=>setTeamSheet(r.team)}><Mark mark={markOf(r.team)} color={colorOf(r.team)}/><TName name={nameOf(r.team)}/></button></td><td>{r.w}</td><td>{r.l}</td><td>{r.d}</td><td>{pct(r.w,r.l)}</td><td>{i?(((top.w-r.w)+(r.l-top.l))/2).toFixed(1):'-'}</td><td>{r.rf}</td><td>{r.ra}</td><td className={r.rf-r.ra>0?'is-plus':r.rf-r.ra<0?'is-minus':''}>{r.rf-r.ra>0?'+':''}{r.rf-r.ra}</td></tr>)}</tbody></table></div>;})}
   {post?.stage==='complete'&&<div className="pw-post2">{post.series.filter(s=>s.higher===state.club||s.lower===state.club||s.stage==='world'||s.stage==='japan').map(s=>{const w=current?watch.find(x=>x.series===s.id):undefined;return <p key={s.id}><span>{space&&s.stage==='world'?'宇宙王座決定戦':stageLabel(s.stage)}</span><b>{nameOf(s.higher)} <strong>{s.wins[0]}-{s.wins[1]}</strong> {nameOf(s.lower)}</b>{w&&onWatch&&<button className="wt-watch-btn" onClick={()=>onWatch(w.key)} aria-label={`${space&&s.stage==='world'?'宇宙王座決定戦':stageLabel(s.stage)}を観る`}>観る</button>}</p>;})}{!post.series.some(s=>s.higher===state.club||s.lower===state.club)&&<p>プレーオフ進出ならず。</p>}</div>}</div>
   <div>{lg.some(r=>r.games>0)&&<><h3 className="pw-sub-h">チーム成績の比較<small>押すとチームの詳細</small></h3><div className="pw-st-scroll"><table className="pw-stand pw-lgstats"><thead><tr><th>チーム</th><th>打率</th><th>本</th><th>盗</th><th>得点</th><th>失点</th><th>得失</th><th>防御率</th><th>対戦</th></tr></thead><tbody>{lg.map(r=>{const vs=r.team===state.club?null:headToHead(season,state.club,r.team);return <tr key={r.team} className={r.team===state.club?'is-mine':''}><td><button className="pw-tname" onClick={()=>setTeamSheet(r.team)}><Mark mark={markOf(r.team)} color={colorOf(r.team)}/><TName name={nameOf(r.team)}/></button></td><td>{r.avg==null?'—':formatAvg(r.avg)}</td><td>{r.hr}</td><td>{r.sb}</td><td>{r.rf}</td><td>{r.ra}</td><td className={r.rf-r.ra>0?'is-plus':r.rf-r.ra<0?'is-minus':''}>{r.rf-r.ra>0?'+':''}{r.rf-r.ra}</td><td>{r.era==null?'—':r.era.toFixed(2)}</td><td className="pw-vs">{vs?`${vs.w}-${vs.l}`:'—'}</td></tr>;})}</tbody></table></div></>}</div></div>
  </section>}

  {(tab==='bat'||tab==='pit')&&<section className="pw-panel pw-mystats" aria-label={tab==='bat'?'打者成績':'投手成績'}>
   <div className={'pw-split2 pw-split-stats is-'+tab}><div><PawaStats key={circuit+season.number+tab} view={tab} season={season} club={state.club} onPlayer={onPlayer} lineup={current?state.lineup:[]} pitchers={current?state.pitchers:[]}/></div>
   {season.day>0&&<div className="pw-stats-team"><h3 className="pw-sub-h">チーム{tab==='bat'?'打撃':'投手'}<small>{leagueName(league)}内の順位</small></h3><dl className="pw-tstrip">{(tab==='bat'?([['打率',stats.avg===null?'—':formatAvg(stats.avg),ranks.avg],['本塁打',String(stats.hr),ranks.hr],['打点',String(stats.rbi),ranks.rbi],['盗塁',String(stats.sb),ranks.sb],['出塁率',stats.obp===null?'—':formatAvg(stats.obp),ranks.obp]] as const):([['防御率',stats.era===null?'—':stats.era.toFixed(2),ranks.era],['失点',String(mine.ra),runRank('ra')],['奪三振',String(ownPit.reduce((n,p)=>n+p.so,0)),null],['セーブ',String(ownPit.reduce((n,p)=>n+p.saves,0)),null],['与四球',String(ownPit.reduce((n,p)=>n+p.bb,0)),null]] as const)).map(([l,v,r])=><div key={l}><dt>{l}</dt><dd>{v}</dd>{r!==null&&rankPill(r)}</div>)}</dl>{lgTop}</div>}</div>
  </section>}

  {tab==='team'&&<section className="pw-panel pw-team-stats" aria-label="チーム成績"><header><h2>チーム成績</h2><span>{leagueName(league)}内の順位</span></header>
   <div className="pw-split2"><div><dl>{([['打率',stats.avg===null?'—':formatAvg(stats.avg),ranks.avg],['本塁打',String(stats.hr),ranks.hr],['打点',String(stats.rbi),ranks.rbi],['盗塁',String(stats.sb),ranks.sb],['出塁率',stats.obp===null?'—':formatAvg(stats.obp),ranks.obp],['得点',String(mine.rf),runRank('rf')],['防御率',stats.era===null?'—':stats.era.toFixed(2),ranks.era],['失点',String(mine.ra),runRank('ra')],['得失点差',`${mine.rf-mine.ra>0?'+':''}${mine.rf-mine.ra}`,[...table].sort((a,b)=>(b.rf-b.ra)-(a.rf-a.ra)).findIndex(t=>t.team===state.club)+1]] as const).map(([label,value,r])=><div key={label}><dt>{label}</dt><dd>{value}</dd>{rankPill(r)}</div>)}<div><dt>チームUZR</dt><dd className={stats.uzr!==null&&stats.uzr>0?'is-plus':stats.uzr!==null&&stats.uzr<0?'is-minus':''}>{formatUZR(stats.uzr)}</dd>{rankPill(uzrRank)}</div></dl>
   <p className="pw-note-left">UZRはリーグ平均を0とした守備の貢献。プラスほど失点を防いでいます。</p></div>
   <div>{season.day>0&&<><h3 className="pw-sub-h">内訳</h3><dl className="pw-tstrip pw-tstrip-split">{([['ホーム',`${split.home.w}-${split.home.l}`],['ビジター',`${split.away.w}-${split.away.l}`],['1点差',`${split.close.w}-${split.close.l}`],['1試合の得点',(mine.rf/Math.max(1,mine.w+mine.l+mine.d)).toFixed(2)],['1試合の失点',(mine.ra/Math.max(1,mine.w+mine.l+mine.d)).toFixed(2)]] as const).map(([l,v])=><div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}</dl>
   <h3 className="pw-sub-h">対戦成績<small>押すとチームの詳細</small></h3><table className="pw-stand pw-vs-table"><thead><tr><th>相手</th><th>勝</th><th>負</th><th>分</th><th>得点</th><th>失点</th></tr></thead><tbody>{table.filter(t=>t.team!==state.club).map(t=>{const v=headToHead(season,state.club,t.team);return <tr key={t.team}><td><button className="pw-tname" onClick={()=>setTeamSheet(t.team)}><Mark mark={markOf(t.team)} color={colorOf(t.team)}/><TName name={nameOf(t.team)}/></button></td><td>{v.w}</td><td>{v.l}</td><td>{v.d}</td><td>{v.rf}</td><td>{v.ra}</td></tr>;})}</tbody></table>
   {(()=>{const others=[...new Set(season.results.filter(g=>g.home===state.club||g.away===state.club).map(g=>g.home===state.club?g.away:g.home))].filter(id=>!table.some(t=>t.team===id));if(!others.length)return null;const v=others.map(id=>headToHead(season,state.club,id)).reduce((a,b)=>({w:a.w+b.w,l:a.l+b.l,d:a.d+b.d}),{w:0,l:0,d:0});return <p className="pw-note-left">交流戦 {v.w}勝{v.l}敗{v.d?`${v.d}分`:''}</p>;})()}</>}</div></div>
  </section>}

  {tab==='more'&&<>
   {state.history.length>0&&<label className="pw-season-select"><span>シーズンを振り返る</span><select aria-label="表示するシーズン" value={archive} onChange={e=>setArchive(Number(e.target.value))}><option value={0}>今シーズン（{state.season.number}シーズン目）</option>{[...state.history].sort((x,y)=>y.number-x.number).map(h=>{const r=rankings(h,leagueFor(h,state.club)).findIndex(t=>t.team===state.club)+1;return <option key={h.number} value={h.number}>{h.number}シーズン目 · {r}位（{circuitLabel(circuitOf(h))}）</option>;})}</select></label>}
   {!current&&<AchievementsPanel state={state} season={season}/>}
   <VictoryShare state={state} season={season}/>
   <LeagueSeasonStats key={circuit} season={season} club={state.club} clubName={clubName}/>
   {current&&<FeedbackCard seasons={state.history.length}/>}
  </>}
  {current&&season.completed&&!busy&&tab==='more'&&<SeasonAd/>}
  {teamSheet&&<TeamSheet season={season} state={state} team={teamSheet} onClose={()=>setTeamSheet(null)} onPlayer={p=>{setTeamSheet(null);onPlayer(p);}}/>}
  {goalsOpen&&<div className="pw-modal pw-sheet-modal" onClick={()=>setGoalsOpen(false)}><div className="pw-sheet" role="dialog" aria-modal="true" aria-label="目標・達成記録" onClick={e=>e.stopPropagation()}>
   <header className="pw-sheet-head"><h2>目標・達成記録</h2><button className="pw-close" onClick={()=>setGoalsOpen(false)} aria-label="閉じる"><X size={22}/></button></header>
   <LeagueGoalCard goal={lgGoal} big/>
   {daily}
   <section className="pw-panel pw-goals" aria-label="今シーズンの目標"><header><h2>今シーズンの目標</h2><span>{goals.filter(g=>g.claimed).length} / {goals.length} 達成</span></header>
    <ul>{goals.map(g=><li key={g.id} className={g.claimed?'is-done':''}><i aria-hidden="true">{g.claimed?'✓':''}</i><span><b>{g.detail}</b><small>{g.title}</small></span><em>＋{g.reward}pt</em></li>)}</ul>
   </section>
   <section className="pw-panel pw-stage" aria-label="リーグ挑戦"><header><h2>リーグ挑戦</h2></header>
    <div className={'pw-stage-badge pw-stage-'+circuit}><span>{stage}</span><b>{season.day?rank:'—'}<small>位</small></b></div>
    <p className="pw-stage-text">{stageText}</p>
    {!major&&<div className="pw-stars" role="progressbar" aria-label="リーグ優勝の連覇" aria-valuemin={0} aria-valuemax={NPB_TITLES_TO_MLB} aria-valuenow={career.npbStreak}>{Array.from({length:NPB_TITLES_TO_MLB},(_,i)=><span key={i} className={i<career.npbStreak?'won':''}>★</span>)}</div>}
    {career.mlbUnlocked&&<div className="pw-switch"><button className="pw-btn pw-blue" disabled={busy} onClick={()=>{setGoalsOpen(false);setArchive(0);onSwitchLeague?.(major?'NPB':'MLB');}}>{major?'国内リーグで立て直す':'海外リーグに挑戦する'}</button>{space&&<button className="pw-btn pw-white" disabled={busy} onClick={()=>{setGoalsOpen(false);setArchive(0);onSwitchLeague?.('MLB');}}>海外リーグに戻る</button>}</div>}
   </section>
   <section className="pw-panel" aria-label="達成記録"><header><h2>達成記録</h2>{recent&&<span>{season.number}年目に{achievementNames[recent]}を達成！</span>}</header><AchievementsPanel state={state} season={season} expanded/></section>
  </div></div>}
 </div>;
}
