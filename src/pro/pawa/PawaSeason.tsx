import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {ChevronRight,Trophy} from 'lucide-react';
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
import {SimpleStats} from '../SimpleApp';

const pad=(n:number)=>String(n).padStart(2,'0');
const pct=(w:number,l:number)=>w+l?formatAvg(w/(w+l)):'.000';
const leagueName=(league:string)=>(leagueStatsNames as Record<string,string>)[league]??league;

/** 順位の札(1位=金・2位=銀・3位=銅) */
export function Place({n}:{n:number}){return <span className={'pw-place pw-place-'+n}>{n}</span>;}
/** 球団の頭文字(イタリックの色文字)。実在のロゴは使わず、ゲーム内の略号を文字で出す。 */
export function Mark({mark,color}:{mark:string;color?:string}){return <span className="pw-mark" style={color?{color}:undefined}>{mark}</span>;}

/** 確認のモーダル(参考画像「1年進めますか?」) */
export function Confirm({title,body,ok,onOk,onCancel}:{title:string;body:ReactNode;ok:string;onOk:()=>void;onCancel:()=>void}){
 const ref=useRef<HTMLDivElement>(null),cancel=useRef(onCancel);cancel.current=onCancel;
 useEffect(()=>{const old=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLButtonElement>('.pw-confirm-ok')?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape')cancel.current();};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);old?.focus({preventScroll:true});};},[]);
 return <div className="pw-modal" onClick={onCancel}><div ref={ref} className="pw-confirm" role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><h2>{title}</h2><div className="pw-confirm-body">{body}</div><div className="pw-confirm-actions"><button className="pw-btn pw-gray" onClick={onCancel}>キャンセル</button><button className="pw-btn pw-yellow pw-confirm-ok" onClick={onOk}>{ok}</button></div></div></div>;
}

type Leader={id:string;team:string;value:number;text:string};
function leaders(season:Season,club:string,clubMark:string){
 const games=Math.max(1,Math.max(...season.standings.map(t=>t.w+t.l+t.d)));
 const bats=Object.values(season.batting),arms=Object.values(season.pitching);
 const top=<T,>(rows:T[],key:(r:T)=>number,dir:1|-1=-1)=>[...rows].sort((a,b)=>(key(a)-key(b))*dir).slice(0,5);
 const qualified=bats.filter(b=>b.pa>=games*3.1),starters=arms.filter(p=>p.outs>=games*3);
 const row=(b:{playerId:string;team:string},value:number,text:string):Leader=>({id:b.playerId,team:b.team,value,text});
 const markOf=(team:string)=>team===club?clubMark:teamById(team,season).mark;
 return {markOf,lists:[
  {title:'打率',rows:top(qualified,b=>battingAverage(b)).map(b=>row(b,battingAverage(b),formatAvg(battingAverage(b))))},
  {title:'本塁打',rows:top(bats,b=>b.hr).map(b=>row(b,b.hr,String(b.hr)))},
  {title:'打点',rows:top(bats,b=>b.rbi).map(b=>row(b,b.rbi,String(b.rbi)))},
  {title:'防御率',rows:top(starters,p=>era(p),1).map(p=>row(p,era(p),era(p).toFixed(2)))},
  {title:'奪三振',rows:top(arms,p=>p.so).map(p=>row(p,p.so,String(p.so)))},
 ].filter(l=>l.rows.length&&l.rows[0].value>0||l.title==='防御率'&&l.rows.length)};
}

export function PawaSeason({state,busy,progress,onPlay,onPost,onNext,onPlayer,message,onSwitchLeague,daily}:{state:GameState;busy:boolean;progress:number;onPlay:(n:number)=>void;onPost:()=>void;onNext:()=>void;onPlayer:(p:Player)=>void;message:string;onSwitchLeague?:(circuit:Circuit)=>void;daily?:ReactNode}){
 const [archive,setArchive]=useState(0),[ask,setAsk]=useState(false),[view,setView]=useState<string|null>(null),[rankTab,setRankTab]=useState(0);
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
 const seasons=[...state.history.map(s=>s.number),state.season.number].sort((a,b)=>a-b).slice(-8);
 const games=season.results.filter(g=>g.home===state.club||g.away===state.club);
 const last=games.at(-1);
 const streak=(()=>{let n=0,kind='';for(const g of [...games].reverse()){const ours=g.home===state.club?g.homeRuns:g.awayRuns,theirs=g.home===state.club?g.awayRuns:g.homeRuns,k=ours>theirs?'W':ours<theirs?'L':'D';if(!kind)kind=k;if(k!==kind)break;n++;}return {n,kind};})();
 const stats=teamSeasonStats(season,state.club),{ranks}=teamSeasonRanks(season,state.club);
 const leagues=useMemo(()=>[...new Set(leagueTeams(season).map(t=>t.league))],[season]);
 const shown=view&&leagues.includes(view)?view:league,shownTable=rankings(season,shown),leader=shownTable[0];
 const gb=(t:typeof leader)=>((leader.w-t.w)+(t.l-leader.l))/2;
 const runRank=(key:'rf'|'ra')=>[...table].sort((a,b)=>key==='rf'?b.rf-a.rf:a.ra-b.ra).findIndex(t=>t.team===state.club)+1;
 const goals=current?seasonGoals(state):[];
 const lead=useMemo(()=>leaders(season,state.club,clubMark),[season,state.club]);
 const board=lead.lists[Math.min(rankTab,lead.lists.length-1)];
 const stage=space?'宇宙リーグ':major?'海外リーグ':'国内リーグ';
 const stageText=!major?(career.mlbUnlocked?'海外リーグに挑戦できます':`${NPB_TITLES_TO_MLB}連覇で海外リーグへ あと${Math.max(0,NPB_TITLES_TO_MLB-career.npbStreak)}回`):space?'宇宙王座決定戦の優勝を目指そう':'世界王座決定戦の優勝を目指そう';
 const rankPill=(r:number|null|undefined)=>r?<i className={'pw-rankpill pw-rankpill-'+Math.min(r,4)}>{r}位</i>:<i className="pw-rankpill">—</i>;

 return <div className={'nv-season'+(season.completed?' is-complete':'')}>
  {seasons.length>1&&<nav className="pw-season-chips" aria-label="表示するシーズン">{seasons.map(n=>{const on=(archive||state.season.number)===n;return <button key={n} aria-pressed={on} onClick={()=>setArchive(n===state.season.number?0:n)}><small>SEASON</small>{pad(n)}</button>;})}</nav>}

  {current&&autumnEventActive(new Date())&&<section className="pw-event" aria-label={AUTUMN_EVENT.name}><span>期間限定 〜{autumnEventEndLabel()}</span><h2>{AUTUMN_EVENT.name} 開催中！</h2><p>期間中にシーズンを終えるたび、ボーナス ＋{AUTUMN_EVENT.bonus.toLocaleString('ja-JP')} pt。</p></section>}

  <div className="pw-top">
   <section className="pw-panel pw-team-card" aria-label="チーム">
    <img src="/assets/pro/pawa/app-icon.webp" alt="" width={84} height={86}/>
    <div><p className="pw-label">チーム名</p><h2>{clubName}</h2><p className="pw-label">{season.completed?'シーズンの成績':'今シーズンの成績'}</p><dl className="pw-wld"><div><dt>勝</dt><dd>{mine.w}</dd></div><div><dt>負</dt><dd>{mine.l}</dd></div><div><dt>分</dt><dd>{mine.d}</dd></div></dl></div>
   </section>
   <section className="pw-panel pw-progress-card" aria-label="シーズン進行度">
    <p className="pw-label">シーズン進行度</p>
    <p className="pw-sub">{circuitLabel(circuit)} · SEASON {pad(season.number)}</p>
    <div className="pw-bar pw-bar-green" role="progressbar" aria-label="シーズン進行" aria-valuenow={season.day} aria-valuemin={0} aria-valuemax={total}><i style={{width:`${season.day/total*100}%`}}/></div>
    <p className="pw-big"><b>{season.day}</b> / {total} <small>試合</small></p>
    <p className="pw-rank-now">{season.day?<>現在 <b>{rank}</b>位 <span>勝率 {pct(mine.w,mine.l)}</span></>:'開幕前'}</p>
   </section>
  </div>

  {current&&!season.completed&&<section className="pw-go" aria-label="試合を進める">
   {next&&<p className="pw-next">次の相手 <Mark mark={markOf(next.opponent)} color={colorOf(next.opponent)}/><b>{nameOf(next.opponent)}</b><span>先発 {playerMap[next.mine]?.name}</span></p>}
   <button className="pw-btn pw-yellow pw-year" disabled={busy} onClick={()=>setAsk(true)}><span className="pw-ball" aria-hidden="true"/>{busy?'試合を計算しています…':'1年進める'}</button>
   {busy&&<div className="pw-working" role="status"><span>試合を計算しています… {progress}%</span><div className="pw-bar"><i style={{width:progress+'%'}}/></div></div>}
  </section>}
  {message&&current&&<p className="pw-message" role="status">{message}</p>}

  {current&&season.completed&&<section className="pw-panel pw-season-end">{post?.stage==='complete'?<><Trophy aria-hidden="true"/><p>{champion===state.club?`${titleFor(season)}、おめでとう！`:`${titleFor(season)}：${champion?nameOf(champion):'—'}`}</p><button className="pw-btn pw-yellow pw-wide" disabled={busy} onClick={()=>{setArchive(0);onNext();}}>{!major&&career.mlbUnlocked&&state.leagueChoice!=='NPB'?'海外リーグ挑戦へ進む':'次のシーズンへ'}<ChevronRight size={20}/></button></>:<><p>{total}試合が終了しました。</p><button className="pw-btn pw-yellow pw-wide" disabled={busy} onClick={onPost}>王座決定戦の終了まで<ChevronRight size={20}/></button></>}</section>}

  {current&&spaceUnlocked(state)&&!space&&<section className="pw-panel pw-unlock"><img src="/assets/pro/pawa/emblem-space.webp" alt=""/><h2>宇宙リーグ解放！</h2><p>世界一になったあなたへ、宇宙から挑戦状が届いた。地球代表として、銀河の球場へ乗り込もう！</p><button className="pw-btn pw-purple pw-wide" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.('SPACE');}}>宇宙リーグに挑戦する<ChevronRight size={20}/></button></section>}

  <div className="pw-two">
   {current&&<section className="pw-panel pw-goals" aria-label="今シーズンの目標"><header><h2>今シーズンの目標</h2><span>{goals.filter(g=>g.claimed).length} / {goals.length}</span></header>
    <ul>{goals.slice(0,6).map(g=><li key={g.id} className={g.claimed?'is-done':''}><i aria-hidden="true">{g.claimed?'✓':''}</i><span><b>{g.detail}</b><small>{g.title}</small></span><em>＋{g.reward}pt</em></li>)}</ul>
    {goals.length>6&&<details><summary>ほかの目標（{goals.length-6}）</summary><ul>{goals.slice(6).map(g=><li key={g.id} className={g.claimed?'is-done':''}><i aria-hidden="true">{g.claimed?'✓':''}</i><span><b>{g.detail}</b><small>{g.title}</small></span><em>＋{g.reward}pt</em></li>)}</ul></details>}
   </section>}
   <section className="pw-panel pw-stage" aria-label="リーグ挑戦ステージ"><header><h2>リーグ挑戦ステージ</h2></header>
    <div className={'pw-stage-badge pw-stage-'+circuit}><span>{stage}</span><b>{season.day?rank:'—'}<small>位</small></b></div>
    <p className="pw-stage-text">{stageText}</p>
    {!major&&<div className="pw-stars" role="progressbar" aria-label="リーグ優勝の連覇" aria-valuemin={0} aria-valuemax={NPB_TITLES_TO_MLB} aria-valuenow={career.npbStreak}>{Array.from({length:NPB_TITLES_TO_MLB},(_,i)=><span key={i} className={i<career.npbStreak?'won':''}>★</span>)}</div>}
    {current&&career.mlbUnlocked&&<div className="pw-switch"><button className="pw-btn pw-blue" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.(major?'NPB':'MLB');}}>{major?'国内リーグで立て直す':'海外リーグに挑戦する'}</button>{space&&<button className="pw-btn pw-white" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.('MLB');}}>海外リーグに戻る</button>}</div>}
   </section>
  </div>

  <div className="pw-two">
   <section className="pw-panel pw-streak" aria-label="現在の連勝"><header><h2>現在の連勝・連敗</h2></header>
    {streak.n?<p className={'pw-streak-n pw-streak-'+streak.kind}><b>{streak.n}</b>{streak.kind==='W'?'連勝中':streak.kind==='L'?'連敗中':'引き分け'}</p>:<p className="pw-note">まだ試合がありません</p>}
   </section>
   <section className="pw-panel pw-last" aria-label="直近の試合結果"><header><h2>直近の試合結果</h2>{last&&<span>第{last.day+1}戦</span>}</header>
    {last?(()=>{const home=last.home===state.club,ours=home?last.homeRuns:last.awayRuns,theirs=home?last.awayRuns:last.homeRuns,other=home?last.away:last.home,res=ours>theirs?'WIN':ours<theirs?'LOSE':'DRAW';return <div className="pw-last-body"><div><Mark mark={clubMark} color="#0d6efa"/><small>{clubName}</small></div><p><b className={'pw-res pw-res-'+res}>{res}</b><strong>{ours} - {theirs}</strong></p><div><Mark mark={markOf(other)} color={colorOf(other)}/><small>{nameOf(other)}</small></div></div>;})():<p className="pw-note">試合を進めると表示されます</p>}
   </section>
  </div>

  {current&&daily}

  {current&&<details className="pw-panel pw-records"><summary>達成記録{recent&&<em role="status">{season.number}年目に{achievementNames[recent]}を達成！</em>}<ChevronRight size={18}/></summary><AchievementsPanel state={state} season={season} expanded/></details>}

  <section className="pw-panel pw-standings" aria-label="リーグ順位"><header><h2>リーグ順位</h2></header>
   {leagues.length>1&&<div className="pw-seg" role="tablist">{leagues.map(l=><button key={l} role="tab" aria-selected={shown===l} className={shown===l?'is-on':''} onClick={()=>setView(l)}>{leagueName(l)}</button>)}</div>}
   <table><thead><tr><th>順位</th><th>チーム</th><th>勝</th><th>負</th><th>分</th><th>勝率</th><th>差</th></tr></thead>
    <tbody>{shownTable.map((t,i)=><tr key={t.team} className={t.team===state.club?'is-mine':''}><td><Place n={i+1}/></td><td><Mark mark={markOf(t.team)} color={colorOf(t.team)}/><span className="pw-tname">{nameOf(t.team)}</span></td><td>{t.w}</td><td>{t.l}</td><td>{t.d}</td><td>{pct(t.w,t.l)}</td><td>{i?gb(t).toFixed(1):'-'}</td></tr>)}</tbody></table>
  </section>

  <section className="pw-panel pw-team-stats" aria-label="チーム成績"><header><h2>チーム成績</h2><span>{leagueName(league)}内の順位</span></header>
   <div className="pw-team-total"><p><b>{mine.w}</b>勝 <b>{mine.l}</b>敗 <b>{mine.d}</b>分</p><p>勝率 <b>{pct(mine.w,mine.l)}</b></p>{season.day>0&&<Place n={rank}/>}</div>
   <h3>チーム打撃成績</h3>
   <dl>{([['打率',stats.avg===null?'—':formatAvg(stats.avg),ranks.avg],['本塁打',String(stats.hr),ranks.hr],['打点',String(stats.rbi),ranks.rbi],['盗塁',String(stats.sb),ranks.sb],['出塁率',stats.obp===null?'—':formatAvg(stats.obp),ranks.obp],['得点',String(mine.rf),runRank('rf')]] as const).map(([label,value,r])=><div key={label}><dt>{label}</dt><dd>{value}</dd>{rankPill(r)}</div>)}</dl>
   <h3>チーム投手成績</h3>
   <dl>{([['防御率',stats.era===null?'—':stats.era.toFixed(2),ranks.era],['失点',String(mine.ra),runRank('ra')]] as const).map(([label,value,r])=><div key={label}><dt>{label}</dt><dd>{value}</dd>{rankPill(r)}</div>)}</dl>
  </section>

  {lead.lists.length>0&&<section className="pw-panel pw-leaders" aria-label="個人成績ランキング"><header><h2>個人成績ランキング</h2><span>全球団</span></header>
   <div className="pw-seg pw-seg-small" role="tablist">{lead.lists.map((l,i)=><button key={l.title} role="tab" aria-selected={board===l} className={board===l?'is-on':''} onClick={()=>setRankTab(i)}>{l.title}</button>)}</div>
   <ol>{board.rows.map((r,i)=><li key={r.id} className={r.team===state.club?'is-mine':''}><Place n={i+1}/><button onClick={()=>playerMap[r.id]&&onPlayer(playerMap[r.id])}>{playerMap[r.id]?.name??'—'}</button><Mark mark={lead.markOf(r.team)} color={colorOf(r.team)}/><b>{r.text}</b></li>)}</ol>
   <small className="pw-note-left">打率は規定打席(試合数×3.1)、防御率は規定投球回(試合数)以上。</small>
  </section>}

  {post?.stage==='complete'&&<section className="pw-panel pw-post" aria-label="ポストシーズン"><header><h2>{major?'プレーオフ':'ポストシーズン'}の結果</h2></header>{post.series.filter(s=>s.higher===state.club||s.lower===state.club||s.stage==='world'||s.stage==='japan').map(s=><p key={s.id}><span>{space&&s.stage==='world'?'宇宙王座決定戦':stageLabel(s.stage)}</span><b><Mark mark={markOf(s.higher)} color={colorOf(s.higher)}/>{nameOf(s.higher)} <strong>{s.wins[0]} - {s.wins[1]}</strong> {nameOf(s.lower)}<Mark mark={markOf(s.lower)} color={colorOf(s.lower)}/></b></p>)}{!post.series.some(s=>s.higher===state.club||s.lower===state.club)&&<p>プレーオフ進出ならず。次のシーズンで再挑戦。</p>}</section>}

  <details className="pw-panel pw-mystats"><summary>自チームの個人成績<ChevronRight size={18}/></summary>
   <SimpleStats key={circuit+season.number} season={season} club={state.club} onPlayer={onPlayer} lineup={current?state.lineup:[]} pitchers={current?state.pitchers:[]}/>
  </details>
  {!current&&<AchievementsPanel state={state} season={season}/>}
  <VictoryShare state={state} season={season}/>
  <LeagueSeasonStats key={circuit} season={season} club={state.club} clubName={clubName}/>
  {current&&<FeedbackCard seasons={state.history.length}/>}
  {current&&season.completed&&!busy&&<SeasonAd/>}
  {ask&&<Confirm title="1年進めますか？" body={<p>{season.day?`残り${total-season.day}試合と`:`${total}試合と`}ポストシーズンを一気に進めます。<br/>よろしいですか？</p>} ok="1年進める" onCancel={()=>setAsk(false)} onOk={()=>{setAsk(false);onPlay(total);}}/>}
 </div>;
}
