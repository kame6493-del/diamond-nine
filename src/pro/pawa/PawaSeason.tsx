import {useState,type ReactNode} from 'react';
import {ChevronRight,Trophy} from 'lucide-react';
import {formatAvg,playerMap,teamById} from '../data';
import {era,nextMatchPreview,rankings,type GameState,type Season} from '../engine';
import {circuitLabel,circuitOf,leagueFor,leagueProgress,NPB_TITLES_TO_MLB,seasonGames,spaceUnlocked,titleFor,type Circuit} from '../leagues';
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
import {SimpleStats} from '../SimpleApp';
import {PawaCard} from './PawaCard';
import type {Player} from '../data';

/** 金の月桂樹(左右の枝)。参考画像の順位表示の飾り。 */
export function Laurel(){
 const leaves=(side:1|-1)=>Array.from({length:7},(_,i)=>{const a=(252-i*18)*Math.PI/180,r=38,mx=50+r*Math.cos(a),y=50-r*Math.sin(a)+(i%2?2:-2),x=side===1?mx:100-mx;const t=Math.atan2(-Math.cos(a),-Math.sin(a))*180/Math.PI;const rot=side===1?t-90:90-t;return <ellipse key={side+'-'+i} cx={x} cy={y} rx="3.6" ry="8.5" transform={`rotate(${rot} ${x} ${y})`}/>;});
 return <svg className="nv-laurel-svg" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="nv-lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff2b8"/><stop offset=".5" stopColor="#e2b04c"/><stop offset="1" stopColor="#9c6c1c"/></linearGradient></defs><g fill="url(#nv-lg)">{leaves(1)}{leaves(-1)}</g></svg>;
}
const pad=(n:number)=>String(n).padStart(2,'0');
const pct=(w:number,l:number)=>w+l?formatAvg(w/(w+l)):'.000';

export function PawaSeason({state,busy,progress,onPlay,onPost,onNext,onPlayer,message,onSwitchLeague,daily}:{state:GameState;busy:boolean;progress:number;onPlay:(n:number)=>void;onPost:()=>void;onNext:()=>void;onPlayer:(p:Player)=>void;message:string;onSwitchLeague?:(circuit:Circuit)=>void;daily?:ReactNode}){
 const [archive,setArchive]=useState(0);
 const season:Season=state.history.find(s=>s.number===archive)??state.season;
 const current=season===state.season,league=leagueFor(season,state.club),table=rankings(season,league),mine=table.find(t=>t.team===state.club)!,rank=table.indexOf(mine)+1;
 const circuit=circuitOf(season),space=circuit==='SPACE',major=circuit!=='NPB',total=seasonGames(season),career=leagueProgress(state);
 const next=current?nextMatchPreview(state):null,post=season.postseason,champion=post?.champion;
 const nameOf=(id:string)=>id===state.club?(season.shareTeam?.name??state.name):teamById(id,season).short;
 const markOf=(id:string)=>id===state.club?'D':teamById(id,season).mark;
 const achievements=recordAchievements(state).achievements??{},recent=(Object.keys(achievementNames) as Array<keyof typeof achievementNames>).filter(id=>achievements[id]===season.number).at(-1);
 const challengeRevealed=major||career.mlbUnlocked||career.npbStreak>0||achievements.npbLeague!==undefined;
 const seasons=[...state.history.map(s=>s.number),state.season.number].sort((a,b)=>a-b).slice(-8);
 const games=season.results.filter(g=>g.home===state.club||g.away===state.club).slice(-5).reverse();
 const stats=teamSeasonStats(season,state.club),{ranks}=teamSeasonRanks(season,state.club);
 const leader=table[0],gb=(t:typeof leader)=>((leader.w-t.w)+(t.l-leader.l))/2;
 const runRank=(key:'rf'|'ra')=>[...table].sort((a,b)=>key==='rf'?b.rf-a.rf:a.ra-b.ra).findIndex(t=>t.team===state.club)+1;
 const starter=(team:string,id:string)=>{const p=season.pitching[`${team}|${id}`];return {era:p?.outs?era(p).toFixed(2):'—',w:p?.wins??0,so:p?.so??0};};
 const opp=next?table.find(t=>t.team===next.opponent):null;
 const goal=space?'宇宙王座決定戦優勝':major?'世界王座決定戦優勝':career.mlbUnlocked?'海外リーグ挑戦が解放！':challengeRevealed?'リーグ優勝3連覇':'リーグ初優勝';

 return <div className={'nv-season'+(season.completed?' is-complete':'')}>
  <section className="nv-hero">
   <p className="nv-kicker">{circuitLabel(circuit)} · SEASON {pad(season.number)}</p>
   <h1>{season.completed?'シーズン終了':'試合を進めよう。'}</h1>
  </section>

  {seasons.length>1&&<nav className="nv-season-chips" aria-label="表示するシーズン">{seasons.map(n=>{const on=(archive||state.season.number)===n;return <button key={n} aria-pressed={on} onClick={()=>setArchive(n===state.season.number?0:n)}>{n===seasons[0]||on?<><small>SEASON</small>{pad(n)}</>:pad(n)}</button>;})}</nav>}

  {current&&autumnEventActive(new Date())&&<section className="nv-event" aria-label={AUTUMN_EVENT.name}><span>期間限定 〜{autumnEventEndLabel()}</span><h2>{AUTUMN_EVENT.name} 開催中！</h2><p>期間中にシーズンを終えるたび、ボーナス ＋{AUTUMN_EVENT.bonus.toLocaleString('ja-JP')} pt。</p></section>}

  <section className="nv-panel nv-rank-panel" aria-label="シーズンの進行">
   <div className="nv-rank-main">
    <div className={"nv-laurel"+(season.day?"":" is-pre")}><Laurel/><b>{season.day?rank:'—'}</b><span>{season.day?'位':'開幕前'}</span></div>
    <div className="nv-record">
     <p><b>{mine.w}</b>勝 <b>{mine.l}</b>敗 <b>{mine.d}</b>分</p>
     <p className="nv-pct">勝率 <b>{pct(mine.w,mine.l)}</b><span>{state.name}</span></p>
    </div>
   </div>
   <div className="nv-progress-label"><span>リーグ進行状況</span><b>{season.day} / {total} 試合</b></div>
   <div className="nv-bar" role="progressbar" aria-label="シーズン進行" aria-valuenow={season.day} aria-valuemin={0} aria-valuemax={total}><i style={{width:`${season.day/total*100}%`}}/></div>
  </section>

  {current&&!season.completed&&next&&<section className="nv-panel nv-next" aria-label="次の対戦相手">
   <header><h2>次の対戦相手</h2></header>
   <div className="nv-next-team"><span className="nv-mark">{markOf(next.opponent)}</span><div><b>{nameOf(next.opponent)}</b>{opp&&<small>{table.indexOf(opp)+1}位 · {opp.w}勝 {opp.l}敗 {opp.d}分</small>}</div></div>
   <div className="nv-matchup">
    {[{team:state.club,id:next.mine,title:'先発投手',owner:state.name},{team:next.opponent,id:next.theirs,title:'相手先発',owner:nameOf(next.opponent)}].map((side,i)=>{const p=playerMap[side.id],s=starter(side.team,side.id);return <div key={i} className="nv-pitcher">
     {p&&<PawaCard player={p} state={state} size="s" base={side.team!==state.club} onClick={()=>onPlayer(p)} label={`${p.name}の詳細`}/>}
     <div><small>{side.title}</small><button type="button" onClick={()=>p&&onPlayer(p)}>{p?.name??'—'}</button><dl><div><dt>防御率</dt><dd>{s.era}</dd></div><div><dt>勝</dt><dd>{s.w}</dd></div><div><dt>奪三振</dt><dd>{s.so}</dd></div></dl></div>
    </div>;})}
    <span className="nv-vs" aria-hidden="true">VS</span>
   </div>
  </section>}

  {current&&!season.completed&&<div className="nv-play">
   <button className="nv-gold" disabled={busy} onClick={()=>onPlay(1)}><b>1試合</b><small>進める</small></button>
   <button className="nv-gold" disabled={busy} onClick={()=>onPlay(10)}><b>10試合</b><small>進める</small></button>
   <button className="nv-gold" disabled={busy} onClick={()=>onPlay(total)}><b>シーズン終了まで</b><small>進める</small></button>
  </div>}
  {busy&&<div className="nv-working" role="status"><span>試合を計算しています… {progress}%</span><div className="nv-bar"><i style={{width:progress+'%'}}/></div></div>}
  {(message&&current)&&<p className="nv-message" role="status">{message}</p>}

  {current&&season.completed&&<section className="nv-panel nv-season-end">{post?.stage==='complete'?<><Trophy aria-hidden="true"/><p>{champion===state.club?`${titleFor(season)}、おめでとう！`:`${titleFor(season)}：${champion?nameOf(champion):'—'}`}</p><button className="nv-gold nv-wide" disabled={busy} onClick={()=>{setArchive(0);onNext();}}>{!major&&career.mlbUnlocked&&state.leagueChoice!=='NPB'?'海外リーグ挑戦へ進む':'次のシーズンへ'}<ChevronRight size={18}/></button></>:<><p>{total}試合が終了しました。</p><button className="nv-gold nv-wide" disabled={busy} onClick={onPost}>王座決定戦の終了まで<ChevronRight size={18}/></button></>}</section>}

  {current&&spaceUnlocked(state)&&!space&&<section className="nv-panel nv-unlock nv-unlock-space"><small>最高難易度 · 未知との対戦</small><h2>宇宙リーグ解放！</h2><p>世界一になったあなたへ、宇宙から挑戦状が届いた。地球代表として、銀河の球場へ乗り込もう！</p><button className="nv-gold nv-wide" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.('SPACE');}}>宇宙リーグに挑戦する<ChevronRight size={18}/></button></section>}

  {current&&daily}

  {current&&<details className="nv-panel nv-goals"><summary><span><small>目標・達成記録</small><strong>{goal}</strong>{recent&&<em role="status">{season.number}年目に{achievementNames[recent]}を達成！</em>}</span><b>{!major&&challengeRevealed&&!career.mlbUnlocked?`${career.npbStreak} / ${NPB_TITLES_TO_MLB} 連覇`:season.day?`現在 ${rank}位`:'開幕前'}</b><ChevronRight size={18}/></summary>
   <div className="nv-goals-body">
    {!challengeRevealed&&<p>まずはレギュラーシーズンでリーグ1位を目指そう。達成した年は、ここに記録されます。</p>}
    {challengeRevealed&&<div className="nv-challenge"><span>{space?'LEAGUE 03':major?'LEAGUE 02':'LEAGUE 01'}</span><h3>{space?'宇宙リーグ · 最高難易度':major?'海外リーグ挑戦':career.mlbUnlocked?'国内リーグ · 海外リーグ挑戦も選べます':'国内リーグ · リーグ優勝3連覇への道'}</h3><p>{space?'銀河の果てから、未知の野球生命体が集結。宇宙一を懸けた最高難易度のリーグ。':major?'チームを育てて世界王座決定戦へ。国内リーグに戻って立て直すこともできます。':career.mlbUnlocked?'国内リーグで育成を続けるか、海外リーグへ挑戦するか選べます。':'リーグ1位を3年連続で達成すると海外リーグへ。プレーオフ・国内王座決定戦の結果は問いません。'}</p>
     {!major&&<div className="nv-stars" role="progressbar" aria-label="リーグ優勝の連覇" aria-valuemin={0} aria-valuemax={NPB_TITLES_TO_MLB} aria-valuenow={career.npbStreak}>{Array.from({length:NPB_TITLES_TO_MLB},(_,i)=><span key={i} className={i<career.npbStreak?'won':''}>★<small>{i<career.npbStreak?'優勝':'—'}</small></span>)}</div>}
     {career.mlbUnlocked&&<div className="nv-switch"><button className="nv-navy" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.(major?'NPB':'MLB');}}>{major?'国内リーグで立て直す':'海外リーグに挑戦する'}</button>{space&&<button className="nv-navy" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.('MLB');}}>海外リーグに戻る</button>}<small>途中の成績を保存して、いつでも再開できます。</small></div>}
    </div>}
    <AchievementsPanel state={state} season={season} expanded/>
   </div>
  </details>}

  {games.length>0&&<section className="nv-panel nv-results" aria-label="最近の試合結果"><header><h2>最近の試合結果</h2></header><ul>{games.map(g=>{const home=g.home===state.club,ours=home?g.homeRuns:g.awayRuns,theirs=home?g.awayRuns:g.homeRuns,other=home?g.away:g.home,res=ours>theirs?'W':ours<theirs?'L':'D';return <li key={g.day}><small>第{g.day+1}戦</small><span className="nv-mark">{markOf(other)}</span><span className="nv-results-team">{nameOf(other)}</span><b className={'nv-wl nv-'+res}>{res}</b><strong>{ours} - {theirs}</strong></li>;})}</ul></section>}

  <section className="nv-panel nv-team-stats" aria-label="チーム成績"><header><h2>チーム成績</h2><span>{stats.games}試合</span></header>
   <dl>{[['得点',String(mine.rf),runRank('rf')],['失点',String(mine.ra),runRank('ra')],['打率',stats.avg===null?'—':formatAvg(stats.avg),ranks.avg],['防御率',stats.era===null?'—':stats.era.toFixed(2),ranks.era],['本塁打',String(stats.hr),ranks.hr],['盗塁',String(stats.sb),ranks.sb]].map(([label,value,r])=><div key={label as string}><dt>{label}</dt><dd>{value}</dd>{r?<small className={r===1?'is-first':''}>({r}位)</small>:<small>—</small>}</div>)}</dl>
  </section>

  <section className="nv-panel nv-standings" aria-label="リーグ順位表"><header><h2>リーグ順位表</h2><span>{(leagueStatsNames as Record<string,string>)[league]??circuitLabel(circuit)}</span></header>
   <table><thead><tr><th>順位</th><th>チーム</th><th>勝-敗-分</th><th>勝率</th><th>差</th></tr></thead>
    <tbody>{table.map((t,i)=><tr key={t.team} className={t.team===state.club?'is-mine':''}><td><span className={'nv-place nv-place-'+(i+1)}>{i+1}</span></td><td><span className="nv-mark">{markOf(t.team)}</span>{nameOf(t.team)}</td><td>{t.w}-{t.l}-{t.d}</td><td>{pct(t.w,t.l)}</td><td>{i?gb(t).toFixed(1):'-'}</td></tr>)}</tbody></table>
  </section>

  {post?.stage==='complete'&&<section className="nv-panel nv-post" aria-label="ポストシーズン"><header><h2>{major?'プレーオフ':'ポストシーズン'}</h2></header>{post.series.filter(s=>s.higher===state.club||s.lower===state.club||s.stage==='world'||s.stage==='japan').map(s=><p key={s.id}><span>{space&&s.stage==='world'?'宇宙王座決定戦':stageLabel(s.stage)}</span><b><i>{markOf(s.higher)}</i>{nameOf(s.higher)} <strong>{s.wins[0]} - {s.wins[1]}</strong> {nameOf(s.lower)}<i>{markOf(s.lower)}</i></b></p>)}{!post.series.some(s=>s.higher===state.club||s.lower===state.club)&&<p>プレーオフ進出ならず。次のシーズンで再挑戦。</p>}</section>}

  <SimpleStats key={circuit+season.number} season={season} club={state.club} onPlayer={onPlayer} lineup={current?state.lineup:[]} pitchers={current?state.pitchers:[]}/>
  {!current&&<AchievementsPanel state={state} season={season}/>}
  <VictoryShare state={state} season={season}/>
  <LeagueSeasonStats key={circuit} season={season} club={state.club} clubName={season.shareTeam?.name??state.name}/>
  {current&&<FeedbackCard seasons={state.history.length}/>}
  {current&&season.completed&&!busy&&<SeasonAd/>}
 </div>;
}
