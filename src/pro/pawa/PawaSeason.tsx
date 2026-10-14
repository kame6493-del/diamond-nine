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
import {formatUZR} from '../fielding-stats';

const pad=(n:number)=>String(n).padStart(2,'0');
const pct=(w:number,l:number)=>w+l?formatAvg(w/(w+l)):'.000';
const leagueName=(league:string)=>(leagueStatsNames as Record<string,string>)[league]??league;

/** 順位の札(1位=金・2位=銀・3位=銅) */
export function Place({n}:{n:number}){return <span className={'pw-place pw-place-'+n}>{n}</span>;}
/** 球団の頭文字(イタリックの色文字)。実在のロゴは使わず、ゲーム内の略号を文字で出す。 */
export function Mark({mark,color}:{mark:string;color?:string}){return <span className="pw-mark" style={color?{color}:undefined}>{mark}</span>;}

export function PawaSeason({state,busy,progress,onPlay,onPost,onNext,onPlayer,message,onSwitchLeague,daily,dailyReady=0,onShowResult}:{state:GameState;busy:boolean;progress:number;onPlay:(n:number)=>void;onPost:()=>void;onNext:()=>void;onPlayer:(p:Player)=>void;message:string;onSwitchLeague?:(circuit:Circuit)=>void;daily?:ReactNode;dailyReady?:number;onShowResult?:()=>void}){
 const [archive,setArchive]=useState(0),[view,setView]=useState<string|null>(null),[goalsOpen,setGoalsOpen]=useState(false);
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

 return <div className={'nv-season'+(season.completed?' is-complete':'')}>
  {state.history.length>0&&<label className="pw-season-select"><span>シーズンを振り返る</span><select aria-label="表示するシーズン" value={archive} onChange={e=>setArchive(Number(e.target.value))}><option value={0}>今シーズン（{state.season.number}シーズン目）</option>{[...state.history].sort((x,y)=>y.number-x.number).map(h=>{const r=rankings(h,leagueFor(h,state.club)).findIndex(t=>t.team===state.club)+1;return <option key={h.number} value={h.number}>{h.number}シーズン目 · {r}位（{circuitLabel(circuitOf(h))}）</option>;})}</select></label>}

  {current&&autumnEventActive(new Date())&&<section className="pw-event" aria-label={AUTUMN_EVENT.name}><span>期間限定 〜{autumnEventEndLabel()}</span><h2>{AUTUMN_EVENT.name} 開催中！</h2><p>期間中にシーズンを終えるたび、ボーナス ＋{AUTUMN_EVENT.bonus.toLocaleString('ja-JP')} pt。</p></section>}

  <section className="pw-panel pw-summary" aria-label="今シーズン">
   <div className="pw-summary-top"><img src="/assets/pro/pawa/app-icon.webp" alt="" width={64} height={66}/><div><p className="pw-sub">{circuitLabel(circuit)} · {season.number}シーズン目</p><h2>{clubName}</h2></div><p className="pw-summary-rank">{season.day?<><b>{rank}</b>位</>:<small>開幕前</small>}</p></div>
   <dl className="pw-wld"><div><dt>勝</dt><dd>{mine.w}</dd></div><div><dt>負</dt><dd>{mine.l}</dd></div><div><dt>分</dt><dd>{mine.d}</dd></div><div><dt>勝率</dt><dd>{pct(mine.w,mine.l)}</dd></div></dl>
   <div className="pw-summary-progress"><div className="pw-bar pw-bar-green" role="progressbar" aria-label="シーズン進行" aria-valuenow={season.day} aria-valuemin={0} aria-valuemax={total}><i style={{width:`${season.day/total*100}%`}}/></div><span><b>{season.day}</b> / {total} 試合</span></div>
  </section>

  {current&&!season.completed&&<section className="pw-go" aria-label="試合を進める">
   {next&&<p className="pw-next">次の相手 <Mark mark={markOf(next.opponent)} color={colorOf(next.opponent)}/><b>{nameOf(next.opponent)}</b><span>先発 {playerMap[next.mine]?.name}</span></p>}
   <button className="pw-btn pw-yellow pw-year" disabled={busy} onClick={()=>onPlay(total)}><span className="pw-ball" aria-hidden="true"/>{busy?'試合を計算しています…':season.day?'残りの試合を進める':'1年進める'}</button>
   {busy&&<div className="pw-working" role="status"><span>試合を計算しています… {progress}%</span><div className="pw-bar"><i style={{width:progress+'%'}}/></div></div>}
  </section>}
  {message&&current&&<p className="pw-message" role="status">{message}</p>}

  {current&&season.completed&&<section className="pw-panel pw-season-end">{onShowResult&&<button className="pw-btn pw-white pw-wide pw-result-open" onClick={onShowResult}>シーズン結果をまとめて見る</button>}{post?.stage==='complete'?<><Trophy aria-hidden="true"/><p>{champion===state.club?`${titleFor(season)}、おめでとう！`:`${titleFor(season)}：${champion?nameOf(champion):'—'}`}</p><button className="pw-btn pw-yellow pw-wide" disabled={busy} onClick={()=>{setArchive(0);onNext();}}>{!major&&career.mlbUnlocked&&state.leagueChoice!=='NPB'?'海外リーグ挑戦へ進む':'次のシーズンへ'}<ChevronRight size={20}/></button></>:<><p>{total}試合が終了しました。</p><button className="pw-btn pw-yellow pw-wide" disabled={busy} onClick={onPost}>王座決定戦の終了まで<ChevronRight size={20}/></button></>}</section>}

  {current&&spaceUnlocked(state)&&!space&&<section className="pw-panel pw-unlock"><img src="/assets/pro/pawa/emblem-space.webp" alt=""/><h2>宇宙リーグ解放！</h2><p>世界一になったあなたへ、宇宙から挑戦状が届いた。地球代表として、銀河の球場へ乗り込もう！</p><button className="pw-btn pw-purple pw-wide" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.('SPACE');}}>宇宙リーグに挑戦する<ChevronRight size={20}/></button></section>}

  {current&&<button className="pw-goals-open" onClick={()=>setGoalsOpen(true)}><span className="pw-goals-icon" aria-hidden="true">★</span><span><b>目標・達成記録</b><small>今日の目標 · 今シーズンの目標 · リーグ挑戦</small></span>{dailyReady>0&&<em>報酬 {dailyReady}</em>}<ChevronRight size={20}/></button>}

  {last&&<section className="pw-panel pw-last" aria-label="直近の試合結果"><header><h2>直近の試合</h2><span>第{last.day+1}戦</span></header>
   {(()=>{const home=last.home===state.club,ours=home?last.homeRuns:last.awayRuns,theirs=home?last.awayRuns:last.homeRuns,other=home?last.away:last.home,res=ours>theirs?'WIN':ours<theirs?'LOSE':'DRAW';return <div className="pw-last-body"><div><Mark mark={clubMark} color="#0d6efa"/><small>{clubName}</small></div><p><b className={'pw-res pw-res-'+res}>{res}</b><strong>{ours} - {theirs}</strong></p><div><Mark mark={markOf(other)} color={colorOf(other)}/><small>{nameOf(other)}</small></div></div>;})()}
  </section>}

  <section className="pw-panel pw-standings" aria-label="リーグ順位"><header><h2>リーグ順位</h2></header>
   {leagues.length>1&&<div className="pw-seg" role="tablist">{leagues.map(l=><button key={l} role="tab" aria-selected={shown===l} className={shown===l?'is-on':''} onClick={()=>setView(l)}>{leagueName(l)}</button>)}</div>}
   <table><thead><tr><th>順位</th><th>チーム</th><th>勝</th><th>負</th><th>分</th><th>勝率</th><th>差</th></tr></thead>
    <tbody>{shownTable.map((t,i)=><tr key={t.team} className={t.team===state.club?'is-mine':''}><td><Place n={i+1}/></td><td><Mark mark={markOf(t.team)} color={colorOf(t.team)}/><span className="pw-tname">{nameOf(t.team)}</span></td><td>{t.w}</td><td>{t.l}</td><td>{t.d}</td><td>{pct(t.w,t.l)}</td><td>{i?gb(t).toFixed(1):'-'}</td></tr>)}</tbody></table>
  </section>

  <section className="pw-panel pw-team-stats" aria-label="チーム成績"><header><h2>チーム成績</h2><span>{leagueName(league)}内の順位</span></header>
   <h3>チーム打撃成績</h3>
   <dl>{([['打率',stats.avg===null?'—':formatAvg(stats.avg),ranks.avg],['本塁打',String(stats.hr),ranks.hr],['打点',String(stats.rbi),ranks.rbi],['盗塁',String(stats.sb),ranks.sb],['出塁率',stats.obp===null?'—':formatAvg(stats.obp),ranks.obp],['得点',String(mine.rf),runRank('rf')]] as const).map(([label,value,r])=><div key={label}><dt>{label}</dt><dd>{value}</dd>{rankPill(r)}</div>)}</dl>
   <h3>チーム投手成績</h3>
   <dl>{([['防御率',stats.era===null?'—':stats.era.toFixed(2),ranks.era],['失点',String(mine.ra),runRank('ra')]] as const).map(([label,value,r])=><div key={label}><dt>{label}</dt><dd>{value}</dd>{rankPill(r)}</div>)}</dl>
   <h3>チーム守備</h3>
   <dl><div><dt>チームUZR</dt><dd className={stats.uzr!==null&&stats.uzr>0?'is-plus':stats.uzr!==null&&stats.uzr<0?'is-minus':''}>{formatUZR(stats.uzr)}</dd>{rankPill(uzrRank)}</div></dl>
   <p className="pw-note-left">UZRはリーグ平均を0とした守備の貢献。プラスほど失点を防いでいます。</p>
  </section>

  {post?.stage==='complete'&&<section className="pw-panel pw-post" aria-label="ポストシーズン"><header><h2>{major?'プレーオフ':'ポストシーズン'}の結果</h2></header>{post.series.filter(s=>s.higher===state.club||s.lower===state.club||s.stage==='world'||s.stage==='japan').map(s=><p key={s.id}><span>{space&&s.stage==='world'?'宇宙王座決定戦':stageLabel(s.stage)}</span><b><Mark mark={markOf(s.higher)} color={colorOf(s.higher)}/>{nameOf(s.higher)} <strong>{s.wins[0]} - {s.wins[1]}</strong> {nameOf(s.lower)}<Mark mark={markOf(s.lower)} color={colorOf(s.lower)}/></b></p>)}{!post.series.some(s=>s.higher===state.club||s.lower===state.club)&&<p>プレーオフ進出ならず。次のシーズンで再挑戦。</p>}</section>}

  <section className="pw-panel pw-mystats" aria-label="個人成績"><header><h2>個人成績</h2><span>{clubName}</span></header>
   <PawaStats key={circuit+season.number} season={season} club={state.club} onPlayer={onPlayer} lineup={current?state.lineup:[]} pitchers={current?state.pitchers:[]}/>
  </section>
  {!current&&<AchievementsPanel state={state} season={season}/>}
  <VictoryShare state={state} season={season}/>
  <LeagueSeasonStats key={circuit} season={season} club={state.club} clubName={clubName}/>
  {current&&<FeedbackCard seasons={state.history.length}/>}
  {current&&season.completed&&!busy&&<SeasonAd/>}
  {goalsOpen&&<div className="pw-modal pw-sheet-modal" onClick={()=>setGoalsOpen(false)}><div className="pw-sheet" role="dialog" aria-modal="true" aria-label="目標・達成記録" onClick={e=>e.stopPropagation()}>
   <header className="pw-sheet-head"><h2>目標・達成記録</h2><button className="pw-close" onClick={()=>setGoalsOpen(false)} aria-label="閉じる"><X size={22}/></button></header>
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
