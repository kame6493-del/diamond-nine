import {useState} from 'react';
import {ArrowRight,Flame,Play,Sparkles,Trophy,Users} from 'lucide-react';
import {formatAvg,formatIP,playerMap,teamById} from './data';
import {battingAverage,ops,rankings,type BatStats,type GameResult,type GameState} from './engine';
import {currencyName} from './progression';
import './manager.css';

const score=(g:GameResult,club:string)=>g.home===club?[g.homeRuns,g.awayRuns]:[g.awayRuns,g.homeRuns];
export function GameRecap({game,state}:{game:GameResult;state:GameState}){
 const [tab,setTab]=useState(state.club===game.home||state.club===game.away?state.club:game.home);
 const name=(id:string)=>id===state.club?state.name:teamById(id).short;
 const box=game.box,bats=box?.batting.filter(b=>b.team===tab)??[],arms=box?.pitching.filter(p=>p.team===tab)??[];
 const hero=[...(box?.batting.filter(b=>b.team===tab)??[])].sort((a,b)=>(b.hits+2*b.hr+b.rbi)-(a.hits+2*a.hr+a.rbi))[0];
 const ace=[...arms].sort((a,b)=>(b.outs-b.er*3+b.so)-(a.outs-a.er*3+a.so))[0];
 return <div className="game-recap">
  <div className="recap-score"><div><small>AWAY</small><strong>{name(game.away)}</strong><b>{game.awayRuns}</b></div><span>FINAL<br/><small>{game.innings}回</small></span><div><small>HOME</small><strong>{name(game.home)}</strong><b>{game.homeRuns}</b></div></div>
  <div className="table-scroll"><table className="data-table box-score"><thead><tr><th>TEAM</th>{Array.from({length:game.innings},(_,i)=><th key={i}>{i+1}</th>)}<th>R</th></tr></thead><tbody>{[game.away,game.home].map((id,side)=><tr key={id}><th>{name(id)}</th>{game.line[side].map((r,i)=><td key={i}>{r===-1?'×':r}</td>)}<td className="stat-highlight">{side===0?game.awayRuns:game.homeRuns}</td></tr>)}</tbody></table></div>
  {box?<><div className="segments recap-teams">{[game.away,game.home].map(id=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{name(id)}</button>)}</div>
   <div className="recap-stars">{hero&&<div className="recap-hero"><Trophy size={24}/><div><small>この試合の注目打者</small><strong>{playerMap[hero.playerId].name}</strong></div><b>{hero.hits}安打 <em>{hero.hr}本塁打 · {hero.rbi}打点</em></b></div>}{ace&&<div className="recap-hero pitcher"><Trophy size={24}/><div><small>この試合の注目投手</small><strong>{playerMap[ace.playerId].name}</strong></div><b>{formatIP(ace.outs)}回<em>{ace.er===0?'無失点':`自責${ace.er}`} · {ace.so}奪三振</em></b></div>}</div>
   <details className="recap-log" open><summary>試合が動いた場面 <span>{box.highlights.length}プレー</span></summary>{box.highlights.length?<ol>{box.highlights.map((h,i)=><li key={i} className={`${h.team===state.club?'my-play':''} ${h.turningPoint?'turning':''}`}><span>{h.inning}回{h.team===game.away?'表':'裏'}</span><div><strong>{playerMap[h.batter].name}<small>{h.play}{h.inning>=9&&h.team===game.home&&h.homeScore>h.awayScore&&i===box.highlights.length-1?' · サヨナラ':h.turningPoint?(h.awayScore===h.homeScore?' · 同点':' · 勝ち越し'):''}</small></strong><p>{name(h.team)} ＋{h.runs}点</p></div><b>{h.awayScore} − {h.homeScore}</b></li>)}</ol>:<p>両チーム無得点。投手戦で決着はつかず。</p>}</details>
   <details className="recap-box" open><summary>この試合の個人成績</summary><div className="table-scroll"><table className="data-table"><caption>{name(tab)} · 打撃</caption><thead><tr>{['選手','打数','安打','本塁打','打点','四球','三振','盗塁'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{bats.map(b=><tr key={b.playerId}><th data-player-id={b.playerId}>{playerMap[b.playerId].name}</th>{[b.ab,b.hits,b.hr,b.rbi,b.bb,b.so,b.sb].map((n,i)=><td key={i} className={i===1&&n>=2?'stat-highlight':''}>{n}</td>)}</tr>)}</tbody></table><table className="data-table"><caption>{name(tab)} · 投球</caption><thead><tr>{['投手','投球回','被安打','自責点','四球','三振','結果'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{arms.map(p=><tr key={p.playerId}><th data-player-id={p.playerId}>{playerMap[p.playerId].name}</th><td>{formatIP(p.outs)}</td>{[p.hits,p.er,p.bb,p.so].map((n,i)=><td key={i}>{n}</td>)}<td>{p.wins?'勝':p.losses?'敗':p.saves?'S':'—'}</td></tr>)}</tbody></table></div></details>
  </>:<p className="fine-print">この試合の詳細記録はありません。更新後の試合から保存します。詳細は今季と直近1季、シーズン成績とスコアは8季分を保持します。</p>}
 </div>;
}
export function PlayReview({before,after,onScout,onTeam,onContinue,onSeason}:{before:GameState;after:GameState;onScout:()=>void;onTeam:()=>void;onContinue:()=>void;onSeason:()=>void}){
 const games=after.season.results.filter(g=>g.day>before.season.day),[chosen,setChosen]=useState(games.length-1),game=games[chosen];
 const wins=games.filter(g=>{const [a,b]=score(g,after.club);return a>b;}).length,draws=games.filter(g=>g.homeRuns===g.awayRuns).length;
 const currentRank=rankings(after.season,teamById(after.club).league).findIndex(t=>t.team===after.club)+1;
 const bat=games.flatMap(g=>g.box?.batting.filter(b=>b.team===after.club)??[]);
 const sum=bat.reduce((a,b)=>{for(const key of ['ab','hits','hr','rbi','bb','hbp','sf','doubles','triples'] as const)a[key]=(a[key]??0)+b[key];return a;},{ab:0,hits:0,hr:0,rbi:0,bb:0,hbp:0,sf:0,doubles:0,triples:0} as BatStats);
 return <div className="play-review"><div className="eyebrow">{after.season.completed?'143 GAMES COMPLETE':'YOUR TEAM, YOUR STORY'}</div><h2>{after.season.completed?'一年の戦いが、成績になった。':(wins>0?`${games.length}試合の活躍を、振り返ろう。`:'次の勝利へ、この試合から。')}</h2><div className="review-record"><strong>{wins}<small>勝</small> {games.length-wins-draws}<small>敗</small> {draws}<small>分</small></strong><span>リーグ {currentRank}位 · {games.length===1?`第${after.season.day}戦`:`第${before.season.day+1}〜${after.season.day}戦`}</span></div>
 <div className="review-rewards"><span><Sparkles size={17}/><b>＋{(after.gems-before.gems).toLocaleString()}</b>{currencyName(after)}</span><span>育成 <b>＋{after.franchise.points-before.franchise.points}pt</b></span>{after.season.completed&&<span><Trophy size={16}/>完走 UR券 ＋1</span>}</div>
 <p className="fine-print">今回進めた{games.length}試合の打撃成績</p><div className="manager-stats" aria-label="今回の進行で記録した打撃成績">{[['打率',sum.ab?formatAvg(battingAverage(sum)):'—'],['本塁打',sum.hr],['打点',sum.rbi],['OPS',sum.ab?formatAvg(ops(sum)):'—']].map(([key,v])=><div key={key}><small>{key}</small><b>{v}</b></div>)}</div>
 <div className="review-next"><button className="btn gold" onClick={after.season.completed?onSeason:onContinue}>{after.season.completed?<Trophy size={16}/>:<Play size={16}/>} {after.season.completed?'シーズン成績を見る':'クラブハウスへ'}</button>{after.gems>=300&&<button className="btn primary" onClick={onScout}><Sparkles size={16}/>1枚スカウトへ</button>}<button className="btn outline" onClick={onTeam}><Users size={16}/>編成を見直す</button></div>
 <div className="section-title"><h3><Flame size={18}/>試合を振り返る</h3><small>スコアを選んで詳細へ <ArrowRight size={13}/></small></div><div className="review-games" role="group" aria-label="振り返る試合">{[...games].reverse().map((g,reverseIndex)=>{const i=games.length-1-reverseIndex,[a,b]=score(g,after.club);return <button key={g.day} className={chosen===i?'selected':''} aria-pressed={chosen===i} onClick={()=>setChosen(i)}><small>GAME {g.day}</small><b>{a} − {b}</b><span>{a>b?'WIN':a<b?'LOSE':'DRAW'} · {teamById(g.home===after.club?g.away:g.home).short}</span></button>;})}</div>
 {game&&<GameRecap key={game.day} game={game} state={after}/>}</div>;
}


