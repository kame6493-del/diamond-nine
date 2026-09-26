import {saveGameFile} from './native-files';
import {androidEdition} from './platform-economy';
import {PointShop} from './PointShop';
import {spaceUnlocked,circuitLabel,circuitOf,seasonGames,leagueFor,leagueProgress,titleFor,NPB_TITLES_TO_MLB,type Circuit} from './leagues';
import {switchLeague} from './engine';
import {AchievementsPanel} from './CareerAchievements';
import {VictoryShare} from './VictoryShare';
import {TeamSeasonStats} from './TeamSeasonStats';
import {LeagueSeasonStats} from './LeagueSeasonStats';
import {SeasonAd} from './SeasonAd';
import {formatUZR,playerSeasonUZR} from './fielding-stats';
import {achievementNames,recordAchievements} from './achievements';
import {firstTitleCelebration,type TitleCelebration as TitleCelebrationEvent} from './title-celebration';
import {TitleCelebration} from './TitleCelebration';
import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Check,ChevronRight,Download,Layers3,Play,RotateCcw,Settings,Sparkles,Upload,Users,Volume2,VolumeX,X} from 'lucide-react';
import {formatAvg,formatIP,normalizeName,playerMap,players,teamById,type Player} from './data';
import {battingAverage,effectiveOverall,era,loadState,migrateState,nextMatchPreview,nextSeason,ops,rankings,saveKeyFor,simulateDays,type GameState,type Season} from './engine';
import {buildByStrategy,trainPlayer} from './franchise';
import {finishPostseason,stageLabel} from './postseason';
import {bestUpgrade,equipScoutedPlayer} from './career-roster';
import {CardAbilities} from './CardAbilities';
import {ReplacementPreview} from './ReplacementPreview';
import {PlayerHoverPreview} from './PlayerHoverPreview';
import {pitchingRoleLabel} from './wiki-players';
import {SIMPLE_SCOUT_COST,MLB_SCOUT_CHANCE,MLB_GUARANTEE_EVERY,mlbScoutCountdown,collectSimpleRewards,drawSimplePlayer,moveSimplePlayer,replacementPool,replaceSimplePlayer} from './simple-game';
import type {Profile} from './progression';
import './simple.css';
import {DeckTeam,TradingCard} from './CardDeck';
import {PlayerCatalog} from './PlayerCatalog';
import {gameSound,prepareGameAudio,stopGameAudio} from './game-audio';
import {readResetBackup,resetTeam,restoreResetBackup,completeResetTeam} from './reset-team';
import './arcade.css';
import {PlayerDetails} from './PlayerDetails';
import {ScoutCharge,ScoutArrival,scoutDuration} from './ScoutEffects';
import {scoutPresentation} from './scout-presentation';
import {StarterScout} from './StarterScout';
import {starterScoutActive,pickStarterCard,finishStarterScout} from './starter-scout';
import {mlbPlayers} from './mlb-players';
import './scout.css';
import {setUiTheme,useUiTheme} from './ui-theme';
import './season-report.css';
import {BeginnerTutorial} from './BeginnerTutorial';

type Page='season'|'team'|'scout'|'catalog';
const count=(n:number)=>n.toLocaleString('ja-JP');
const bonus=(s:GameState,id:string)=>Math.min(5,Math.max(0,(s.owned[id]??1)-1))+(s.training[id]??0);
const tabs=[{id:'season',label:'試合・成績',icon:Play},{id:'team',label:'チーム',icon:Users},{id:'scout',label:'スカウト',icon:Sparkles}] as const;

function Dialog({title,onClose,children,className=''}:{title:string;onClose:()=>void;children:ReactNode;className?:string}){
 const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const old=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  document.body.style.overflow='hidden';ref.current?.focus({preventScroll:true});
  const key=(e:KeyboardEvent)=>{
   if(!ref.current?.contains(document.activeElement))return;
   if(e.key==='Escape'){e.preventDefault();close.current();}
   if(e.key==='Tab'){
    const nodes=Array.from(ref.current.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,summary,a[href]')).filter(node=>node.getClientRects().length);
    if(!nodes?.length)return;
    if(e.shiftKey&&(document.activeElement===nodes[0]||document.activeElement===ref.current)){e.preventDefault();nodes[nodes.length-1].focus();}
    else if(!e.shiftKey&&document.activeElement===nodes[nodes.length-1]){e.preventDefault();nodes[0].focus();}
   }
  };
  document.addEventListener('keydown',key);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',key);old?.focus({preventScroll:true});};
 },[]);
 return <div className="simple-overlay" onClick={onClose}><div className={`simple-dialog ${className}`} ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><header><h2>{title}</h2><button className="s-icon" onClick={onClose} aria-label="閉じる"><X size={20}/></button></header>{children}</div></div>;
}

export function SimpleStats({season,club,onPlayer,lineup=[],pitchers=[]}:{season:Season;club:string;onPlayer:(p:Player)=>void;lineup?:string[];pitchers?:string[]}){
 const [view,setView]=useState<'bat'|'pit'>('bat');
 const viewScroll=useRef<number|null>(null);
 const changeView=(next:'bat'|'pit')=>{if(next!==view){viewScroll.current=window.scrollY;setView(next);}};
 useLayoutEffect(()=>{if(viewScroll.current!==null){window.scrollTo({top:viewScroll.current,behavior:'auto'});viewScroll.current=null;}},[view]);
 const bats=Object.values(season.batting).filter(b=>b.team===club);
 const arms=Object.values(season.pitching).filter(p=>p.team===club);
 const batIds=[...new Set([...lineup,...bats.map(b=>b.playerId)])];
 const pitIds=[...new Set([...pitchers,...arms.map(p=>p.playerId)])];
 const batMap=new Map(bats.map(b=>[b.playerId,b])),pitMap=new Map(arms.map(p=>[p.playerId,p]));
 return <div className="season-player-stats">
  <div className="season-stat-switch" role="group" aria-label="表示する個人成績"><button aria-pressed={view==='bat'} onClick={()=>changeView('bat')}>打撃成績</button><button aria-pressed={view==='pit'} onClick={()=>changeView('pit')}>投手成績</button></div>
  <div className="s-stat-columns">
   <section className={'s-panel season-stat-panel'+(view==='bat'?' is-active':'')} aria-label="打撃成績"><h2>打撃成績</h2>
    <table className="s-stats batting-uzr-table"><thead><tr><th>選手</th>{['打率','本塁打','打点','OPS','盗塁','UZR'].map(h=><th key={h}>{h}</th>)}</tr></thead>
     <tbody>{batIds.map(id=>{const b=batMap.get(id),uzr=playerSeasonUZR(season,club,id);return <tr key={id}>
      <th><button title={playerMap[id].name} data-player-id={id} onClick={()=>onPlayer(playerMap[id])}>{playerMap[id].name}</button></th><td>{b?.ab?formatAvg(battingAverage(b)):'—'}</td><td>{b?.hr??0}</td><td>{b?.rbi??0}</td><td>{b?.pa?formatAvg(ops(b)):'—'}</td><td>{b?.sb??0}</td><td className={'uzr-value '+(uzr!==null&&uzr>0?'positive':uzr!==null&&uzr<0?'negative':'')}>{formatUZR(uzr)}</td>
     </tr>;})}</tbody>
    </table>
    <p className="s-uzr-note">UZRはリーグ平均を0とした守備貢献。プラスほど失点を防いでいます。守備なし・未記録は「—」。</p>
    {!batIds.length&&<p className="s-empty">試合を進めると成績が表示されます。</p>}
   </section>
   <section className={'s-panel season-stat-panel'+(view==='pit'?' is-active':'')} aria-label="投手成績"><h2>投手成績</h2><table className="s-stats"><thead><tr><th>選手</th>{['奪三振','防御率','投球回','セーブ'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{pitIds.map(id=>{const p=pitMap.get(id);return <tr key={id}><th><button title={playerMap[id].name} data-player-id={id} onClick={()=>onPlayer(playerMap[id])}>{playerMap[id].name}</button></th><td>{p?.so??0}</td><td>{p?.outs?era(p).toFixed(2):'—'}</td><td>{formatIP(p?.outs??0)}</td><td>{p?.saves??0}</td></tr>;})}</tbody></table>{!pitIds.length&&<p className="s-empty">試合を進めると成績が表示されます。</p>}</section>
  </div>
 </div>;
}

export function SimpleSeason({state,busy,progress,onPlay,onPost,onNext,onPlayer,message,onSwitchLeague}:{state:GameState;busy:boolean;progress:number;onPlay:(n:number)=>void;onPost:()=>void;onNext:()=>void;onPlayer:(p:Player)=>void;message:string;onSwitchLeague?:(circuit:Circuit)=>void}){
 const [archive,setArchive]=useState(0);
 const season=state.history.find(s=>s.number===archive)??state.season;
 const current=season===state.season,table=rankings(season,leagueFor(season,state.club)),mine=table.find(t=>t.team===state.club)!;
 const next=current?nextMatchPreview(state):null,latest=season.results.at(-1);
 const ownScore=latest?.[latest.home===state.club?'homeRuns':'awayRuns'],otherScore=latest?.[latest.home===state.club?'awayRuns':'homeRuns'];
 const post=season.postseason,champion=post?.champion,space=circuitOf(season)==='SPACE',major=circuitOf(season)!=='NPB',total=seasonGames(season),career=leagueProgress(state);
 const challengeRevealed=major||career.mlbUnlocked||career.npbStreak>0||recordAchievements(state).achievements?.npbLeague!==undefined;
 const achievements=recordAchievements(state).achievements??{},recentAchievement=(Object.keys(achievementNames) as Array<keyof typeof achievementNames>).filter(id=>achievements[id]===season.number).at(-1);
 const report=useRef<HTMLDivElement>(null),wasComplete=useRef(season.completed);
 useEffect(()=>{
  if(season.completed&&!wasComplete.current)report.current?.scrollIntoView({block:'start',behavior:'auto'});
  wasComplete.current=season.completed;
 },[season.completed]);
 const endActions=current&&season.completed&&<div className="s-season-end">{post?.stage==='complete'?<><p>{champion===state.club?`${titleFor(season)}、おめでとう！`:`${titleFor(season)}：${champion?teamById(champion,season).short:'—'}`}</p><button className="s-primary" disabled={busy} onClick={()=>{setArchive(0);onNext();window.scrollTo({top:0,behavior:'auto'});}}>{!major&&career.mlbUnlocked&&state.leagueChoice!=='NPB'?'海外リーグ挑戦へ進む':'次のシーズンへ'}<ChevronRight size={18}/></button></>:<><p>{total}試合が終了しました。</p><button className="s-primary" disabled={busy} onClick={onPost}>王座決定戦の終了まで<ChevronRight size={18}/></button></>}</div>;
 return <div className={'s-season-view'+(season.completed?' is-complete':'')}>
  <div className="s-page-title"><div><p className="s-kicker">{circuitLabel(circuitOf(season))} · SEASON {String(season.number).padStart(2,'0')}</p><h1>{season.completed?'シーズンの成績':'試合を進めよう。'}</h1></div>{state.history.length>0&&<select aria-label="表示するシーズン" value={archive} onChange={e=>setArchive(Number(e.target.value))}><option value={0}>今シーズン</option>{state.history.map(s=><option value={s.number} key={s.number}>{s.number}年目 · {circuitLabel(circuitOf(s))}</option>)}</select>}</div>
  {current&&<details className="season-goals"><summary><span><small>目標・達成記録</small><strong>{space?'宇宙王座決定戦優勝':major?'世界王座決定戦優勝':career.mlbUnlocked?'海外リーグ挑戦が解放！':challengeRevealed?'リーグ優勝3連覇':'リーグ初優勝'}</strong>{recentAchievement&&<span className="goal-new-record" role="status">{season.number}年目に{achievementNames[recentAchievement]}を達成！</span>}</span><b>{!major&&challengeRevealed&&!career.mlbUnlocked?`${career.npbStreak} / ${NPB_TITLES_TO_MLB} 連覇`:season.day?`現在 ${table.indexOf(mine)+1}位`:'開幕前'}</b><ChevronRight size={18}/></summary><div className="season-goals-body">
  {!challengeRevealed&&<p className="season-goal-intro">まずはレギュラーシーズンでリーグ1位を目指そう。達成した年は、ここに記録されます。</p>}
  {current&&challengeRevealed&&<section className={'league-challenge '+(major?'league-major':career.mlbUnlocked?'league-unlocked':'')} aria-label="リーグ挑戦">
   <div><span>{space?'LEAGUE 03':major?'LEAGUE 02':'LEAGUE 01'}</span><h2>{space?'宇宙リーグ · 最高難易度':major?'海外リーグ挑戦':career.mlbUnlocked?'国内リーグ · 海外リーグ挑戦も選べます':'国内リーグ · リーグ優勝3連覇への道'}</h2><p>{space?'銀河の果てから、未知の野球生命体が集結。地球で鍛えたチームで、異星の強豪たちを打ち破れ。宇宙一を懸けた最高難易度のリーグが始まる。':major?'チームを育てて世界王座決定戦へ。国内リーグに戻って立て直すこともできます。':career.mlbUnlocked?'国内リーグで育成を続けるか、海外リーグへ挑戦するか選べます。':'リーグ1位を3年連続で達成すると海外リーグへ。プレーオフ・国内王座決定戦の結果は問いません。'}</p>{career.mlbUnlocked&&<div className="league-switch"><button className="s-button" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.(major?'NPB':'MLB');}}>{major?'国内リーグで立て直す':'海外リーグに挑戦する'}</button>{space&&<button className="s-button" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.('MLB');}}>海外リーグに戻る</button>}<small>途中の成績を保存して、いつでも再開できます。</small></div>}</div>
   {!major&&<div className="title-streak" role="progressbar" aria-label="リーグ優勝の連覇" aria-valuemin={0} aria-valuemax={NPB_TITLES_TO_MLB} aria-valuenow={career.npbStreak}><div>{Array.from({length:NPB_TITLES_TO_MLB},(_,i)=>i+1).map(n=><span className={n<=career.npbStreak?'won':''} key={n}>★</span>)}</div><b>{career.npbStreak} / {NPB_TITLES_TO_MLB} 連覇</b></div>}
  </section>}
  <AchievementsPanel state={state} season={season} expanded/>
  </div></details>}
  {current&&spaceUnlocked(state)&&!space&&<section className="space-unlock"><div><small>最高難易度 · 未知との対戦</small><h2>宇宙リーグ、解放。</h2><p>世界一になったあなたへ、宇宙から挑戦状が届いた。相手は未知の野球生命体。地球代表として、銀河の球場へ乗り込もう！</p></div><button className="s-primary" disabled={busy} onClick={()=>{setArchive(0);onSwitchLeague?.('SPACE');}}>宇宙リーグに挑戦する<ChevronRight size={18}/></button></section>}
  <div className="season-report-start" ref={report}>
  {endActions}
  <section className="s-season-card" aria-label="シーズンの進行"><div className="s-season-top"><div><span>{season.day?`${table.indexOf(mine)+1}位`:'開幕前'}</span><h2>{state.name}</h2><p><b>{mine.w}</b> 勝 <b>{mine.l}</b> 敗 <b>{mine.d}</b> 分</p></div><div className="s-game-count"><b>{season.day}</b><span>/ {total} 試合</span></div></div><div className="s-progress" role="progressbar" aria-label="シーズン進行" aria-valuenow={season.day} aria-valuemin={0} aria-valuemax={total}><i style={{width:`${season.day/total*100}%`}}/></div>
   {current&&!season.completed&&<><p className="s-next-opponent">次の相手：{next&&teamById(next.opponent,season).short}{next&&<span>先発 {playerMap[next.mine].name}</span>}{major&&next&&<span>相手先発 {playerMap[next.theirs].name}</span>}</p><div className="s-play-actions"><button className="s-primary" disabled={busy} onClick={()=>onPlay(total)}><Play size={17} fill="currentColor"/>シーズン終了まで</button></div></>}
   {busy&&<p className="s-working" role="status">試合を計算しています… {progress}%</p>}
  </section>
  <div className="s-inline-result" role="status">{message&&current?<span>{message}</span>:latest?<span>直近の試合 <b>{ownScore} − {otherScore}</b> {teamById(latest.home===state.club?latest.away:latest.home,season).short}戦</span>:<span>試合でポイントを貯めて、新しい選手を迎えよう。</span>}</div>
  <TeamSeasonStats season={season} club={state.club}/>
  <SimpleStats key={circuitOf(season)+season.number} season={season} club={state.club} onPlayer={onPlayer} lineup={current?state.lineup:[]} pitchers={current?state.pitchers:[]}/>
  </div>
  {post?.stage==='complete'&&<details className="s-fold postseason-results"><summary>{major?'プレーオフ':'短期決戦'}の結果を見る</summary>{post.series.filter(s=>s.higher===state.club||s.lower===state.club||s.stage==='world'||s.stage==='japan').map(s=><p key={s.id}><span>{space&&s.stage==='world'?'宇宙王座決定戦':stageLabel(s.stage)}</span><b>{s.higher===state.club?state.name:teamById(s.higher,season).short} {s.wins[0]} − {s.wins[1]} {s.lower===state.club?state.name:teamById(s.lower,season).short}</b></p>)}{!post.series.some(s=>s.higher===state.club||s.lower===state.club)&&<p>プレーオフ進出ならず。次のシーズンで再挑戦。</p>}</details>}
  {!current&&<AchievementsPanel state={state} season={season}/>}
  <VictoryShare state={state} season={season}/>
  <LeagueSeasonStats key={circuitOf(season)} season={season} club={state.club} clubName={season.shareTeam?.name??state.name}/>
  {current&&season.completed&&!busy&&<SeasonAd/>}
 </div>;
}

export function SimplePlayerCard({player,state}:{player:Player;state:GameState}){return <div className="s-player-card"><TradingCard player={player} state={state}/></div>;}

export function SimpleScout({state,onDraw,onEquip,drawing,hasDrawn,onSeason,onPlayer,onSkip}:{state:GameState;onDraw:()=>void;onEquip:(id:string)=>void;drawing:boolean;hasDrawn:boolean;onSeason:()=>void;onPlayer?:(p:Player)=>void;onSkip?:()=>void}){
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{if(drawing)panel.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});},[drawing]);
 const pull=hasDrawn?state.lastPulls[0]:null,player=pull?playerMap[pull.playerId]:null;
 const upgrade=player?bestUpgrade(state,player.id):null,canDraw=state.gems>=SIMPLE_SCOUT_COST;
 const remaining=mlbScoutCountdown(state),major=!!player?.mlb&&!drawing;
 const {tier,overall}=scoutPresentation(player,state.owned,state.training);
 return <div className="mobile-scout">
  <div className="s-page-title"><div><p className="s-kicker">SCOUT</p><h1>スカウト</h1><p>新たな選手を獲得しよう！</p></div></div>
  <section ref={panel} className={'s-scout-panel scout-tier-'+tier+' '+(major?'major-reveal':'')}><div className="s-scout-main">
   <div className={'s-scout-result '+(drawing?'drawing':'')} aria-live="polite" aria-busy={drawing}>
    {drawing&&<ScoutCharge tier={tier} onSkip={onSkip}/>}
    {player&&!drawing?<>
     
     <ScoutArrival key={'arrival-'+state.pulls} tier={tier} overall={overall} major={major}/>
     <span className="s-new-label">{pull!.isNew?'新しい選手が加入！':pull!.copies<=6?'選手が成長！':'ポイント ＋80'}</span>
     <div className={'scout-reveal animate__animated '+(tier==='rainbow'?'animate__zoomInDown':tier==='gold'?'animate__bounceIn':'animate__flipInY')} key={state.pulls+'-'+state.franchise.tickets+'-'+pull?.copies}><TradingCard player={player} state={state} onPlayer={onPlayer}/></div>
     {!pull!.isNew&&pull!.copies<=6&&<p>重複獲得で能力 ＋1（最大＋5）</p>}
     {upgrade?<div className="s-equip-offer"><ReplacementPreview player={playerMap[upgrade.oldId]} state={state} position={upgrade.pitching?upgrade.position:`${upgrade.index+1}番 · ${upgrade.position}`} mode={upgrade.pitching?'pitcher':'batter'} onPlayer={onPlayer}/><button className="s-button" onClick={()=>onEquip(player.id)}><Users size={16}/>この選手と入れ替える</button></div>:[...state.lineup,...state.pitchers].includes(player.id)?<p className="s-equipped"><Check size={16}/>チームに編成済み</p>:<p>控えに加入しました。チーム画面で起用できます。</p>}
    </>:!drawing&&<div className="s-unopened"><div className="s-baseball" aria-hidden="true">⚾</div><h2>選手カードを1枚獲得</h2><p>国内・海外の選手が登場</p></div>}
   </div>
   <button className="s-primary s-draw" disabled={!canDraw||drawing} onClick={onDraw}><Sparkles size={19}/>{drawing?'スカウト中…':hasDrawn?'もう1人引く':'1人引く'}<span>{count(SIMPLE_SCOUT_COST)+' pt'}</span></button>
   <p className="s-scout-cost">所持 {count(state.gems)} pt</p>
   {!canDraw&&<><p className="scout-missing">次のスカウトまで あと{count(SIMPLE_SCOUT_COST-state.gems)} pt</p><button className="s-text-link" onClick={onSeason}>試合を進めてポイントを貯める<ChevronRight size={15}/></button></>}
   <div className="scout-guarantee"><div><span>海外選手確定まで</span><b>あと{remaining}回</b></div><div className="scout-guarantee-track" role="progressbar" aria-label="海外選手確定までのスカウト進行" aria-valuemin={0} aria-valuemax={MLB_GUARANTEE_EVERY} aria-valuenow={MLB_GUARANTEE_EVERY-remaining}><i style={{width:(MLB_GUARANTEE_EVERY-remaining)/MLB_GUARANTEE_EVERY*100+'%'}}/></div><small>ポイントでのスカウトで進行 · シーズンをまたいで引き継ぎ</small></div>
  </div><div className="s-scout-note">1人 3,000 pt。30人目は海外選手確定。<details><summary>獲得できる選手・抽選確率</summary><p>国内リーグ {players.length-mlbPlayers.length}人／海外リーグ {mlbPlayers.length}人。通常は国内リーグ {100-MLB_SCOUT_CHANCE*100}%・海外リーグ {MLB_SCOUT_CHANCE*100}%で、各グループ内は同じ確率です。30回ごとの確定時は未所持の海外選手から同じ確率で抽選し、全員所持の場合は海外選手全員が対象になります。</p></details></div></section>
 </div>;
}

function PlayerInfo({player,state,onChange,onClose,onAwaken,catalog=false}:{player:Player;state:GameState;onChange:(s:GameState)=>void;onClose:()=>void;onAwaken:()=>void;catalog?:boolean}){return <Dialog title="選手情報" className="player-dialog" onClose={onClose}><PlayerDetails player={player} state={state} onChange={onChange} onAwaken={onAwaken} catalog={catalog}/></Dialog>;}

function UiThemeSwitch(){
 const theme=useUiTheme();
 return <button type="button" className="s-button ui-theme-switch" onClick={()=>setUiTheme(theme==='stadium'?'classic':'stadium')}>{theme==='stadium'?'デザイン:ナイター(新) → 以前のデザインに戻す':'デザイン:以前 → ナイター(新)にする'}</button>;
}
function SimpleSettings({state,onChange,onClose,onProfileChange,onReset,onRestore,onCompleteReset,canRestore,onTutorial}:{state:GameState;onChange:(s:GameState)=>void;onClose:()=>void;onProfileChange?:(p:Profile)=>void;onReset:()=>void;onRestore:()=>void;onCompleteReset:()=>void;canRestore:boolean;onTutorial:()=>void}){
 const [name,setName]=useState(state.name),[error,setError]=useState('');const input=useRef<HTMLInputElement>(null);
 const download=()=>{void saveGameFile(new File([JSON.stringify(state)],`diamond-nine-${state.mode==='career'?'career':'free'}-${state.season.number}.json`,{type:'application/json'})).catch(()=>setError('書き出せませんでした。もう一度お試しください。'));};
 return <Dialog title="設定" onClose={onClose}>{androidEdition&&<PointShop/>}<a className="s-guide-entry" href="/guide.html" target="_blank" rel="noopener noreferrer"><span>はじめての方へ<strong>遊び方ガイド</strong></span><ChevronRight size={18}/></a><UiThemeSwitch/><button type="button" className="s-button tutorial-restart" onClick={onTutorial}>チュートリアルを見直す</button><label className="s-field">チーム名<input value={name} maxLength={20} onChange={e=>setName(e.target.value)}/></label><button className="s-button" disabled={!name.trim()} onClick={()=>{onChange({...state,name:name.trim()});onClose();}}>保存</button><hr/><div className="reset-zone"><h3>最初からチームをつくる</h3><p>退避してやり直すか、獲得カードを含めて完全に消すか選べます。</p><button className="s-button reset-team" onClick={onReset}><RotateCcw size={16}/>退避してリセット</button>{canRestore&&<button className="s-button" onClick={onRestore}>リセット前のチームに戻す</button>}<button className="s-button complete-reset" onClick={onCompleteReset}>カードも消して完全リセット</button></div><hr/><h3>セーブデータ</h3><p>進行はこの端末・ブラウザに自動保存されます。別の端末や公開URLへ引き継ぐときは、書き出したデータを移動先で読み込んでください。</p><div className="s-settings-actions"><button className="s-button" onClick={download}><Download size={16}/>書き出す</button><button className="s-button" onClick={()=>input.current?.click()}><Upload size={16}/>読み込む</button><input hidden ref={input} type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>10_000_000)throw new Error();const s=migrateState(JSON.parse(await file.text()));if(!s)throw new Error();if((s.mode==='career')!==(state.mode==='career')){setError('別のモードのセーブです。先にクラブを切り替えてください。');return;}onChange(collectSimpleRewards(s));onClose();}catch{setError('このセーブデータを読み込めませんでした。');}finally{e.target.value='';}}}/></div>{error&&<p role="alert">{error}</p>}<details className="s-source"><summary>ゲームについて・以前のクラブ</summary><p>国内・海外の選手カードを集め、チームを育てる野球シミュレーションです。</p><p>打席ごとの結果を集計して成績を計算します。国内リーグは143試合・延長12回。リーグ優勝3連覇後は海外リーグの30球団・162試合（独自日程）に昇格。カリフォルニア枠で海外Aリーグ西地区に参加します。海外リーグは延長決着制で、通常シーズンの延長のみ二塁に走者を置きます。両リーグDH制。対戦相手は国内リーグより海外リーグで強い補正があります。故障・加齢・トレードは未実装です。過去8季の成績を保存します。</p><p>効果音・獲得ボイス：Kenney / Leszek Szary（CC0） · カード演出：Animate.css</p><a href="/THIRD_PARTY_ASSETS.txt" target="_blank" rel="noreferrer">素材の出典とライセンス ↗</a>{onProfileChange&&<button className="s-button" onClick={()=>onProfileChange(state.mode==='career'?'free':'career')}>{state.mode==='career'?'以前のクラブに切り替える':'育成モードに切り替える'}</button>}</details></Dialog>;
}

export default function SimpleApp({profile='career',onProfileChange}:{profile?:Profile;onProfileChange?:(p:Profile)=>void}){
 const loaded=useMemo(()=>loadState(profile),[profile]);
 const [state,setState]=useState(()=>collectSimpleRewards(loaded.state));
 const [celebration,setCelebration]=useState<TitleCelebrationEvent|null>(null);
 const starter=starterScoutActive(state);
 const [tutorialReplay,setTutorialReplay]=useState(0);
 const uiTheme=useUiTheme();
 const [sound,setSound]=useState(()=>{try{return localStorage.getItem('diamond-nine-sound')!=='off';}catch{return true;}}),[resetId,setResetId]=useState(0);
 const [canRestore,setCanRestore]=useState(()=>{try{return !!readResetBackup(profile,localStorage);}catch{return false;}});
 const impact=()=>{if(sound)gameSound('join');};
 const [page,setPage]=useState<Page>('season'),[selected,setSelected]=useState<string|null>(null),[settings,setSettings]=useState(false),[confirmCompleteReset,setConfirmCompleteReset]=useState(false);
 const [message,setMessage]=useState(''),[saveError,setSaveError]=useState(loaded.warning),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[drawing,setDrawing]=useState(false),[hasDrawn,setHasDrawn]=useState(false);
 const lock=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const finishDraw=useRef<(()=>void)|null>(null),soundRef=useRef(sound);soundRef.current=sound;
 useEffect(()=>{if(page==='scout'&&sound)void prepareGameAudio();},[page,sound]);
 useEffect(()=>{try{const serialized=JSON.stringify(state);if(localStorage.getItem(saveKeyFor(profile))!==serialized)localStorage.setItem(saveKeyFor(profile),serialized);setSaveError('');}catch{setSaveError('保存できません。設定からデータを書き出してください。');}},[state,profile]);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);finishDraw.current=null;stopGameAudio();},[]);
 // Synchronize other open tabs so a reset cannot be overwritten by stale cards.
 useEffect(()=>{
  const sync=(event:StorageEvent)=>{
   if(event.storageArea!==localStorage)return;
   try{
    if(event.key===saveKeyFor(profile)){
     const raw=localStorage.getItem(saveKeyFor(profile)),incoming=raw?migrateState(JSON.parse(raw)):null;
     if(incoming&&(incoming.mode==='career')===(profile==='career')){
      if(timer.current)clearTimeout(timer.current);finishDraw.current=null;stopGameAudio();lock.current=false;setBusy(false);setDrawing(false);setHasDrawn(false);setSelected(null);setSettings(false);setConfirmCompleteReset(false);setCelebration(null);setMessage('');setResetId(v=>v+1);setState(current=>JSON.stringify(current)===JSON.stringify(incoming)?current:incoming);
     }
    }
    if(event.key?.startsWith(saveKeyFor(profile)))setCanRestore(!!readResetBackup(profile,localStorage));
   }catch{setSaveError('別タブの保存を反映できませんでした。画面を再読み込みしてください。');}
  };
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[profile]);
 const askCompleteReset=()=>{setSettings(false);setConfirmCompleteReset(true);};
 const completeReset=()=>{
  if(lock.current)return;
  try{const fresh=completeResetTeam(profile,localStorage);setState(fresh);setCelebration(null);setHasDrawn(false);setSettings(false);setSelected(null);setConfirmCompleteReset(false);setCanRestore(false);setResetId(v=>v+1);setPage('team');setMessage('完全リセットしました。スタートスカウトで最初の主力を選べます。');}
  catch{setSaveError('完全リセットを完了できませんでした。保存状態を確認してください。');setConfirmCompleteReset(false);}
 };
 const reset=()=>{if(lock.current)return;try{const fresh=resetTeam(state,profile,localStorage);setState(fresh);setCelebration(null);setHasDrawn(false);setSettings(false);setSelected(null);setCanRestore(true);setResetId(v=>v+1);setPage('team');setMessage('チームをリセットしました。');impact();}catch{setSaveError('退避または保存ができなかったため、リセットを中止しました。設定から書き出してください。');setSettings(false);}};
 const restore=()=>{if(lock.current)return;try{setState(restoreResetBackup(state,profile,localStorage));setCelebration(null);setHasDrawn(false);setSettings(false);setSelected(null);setResetId(v=>v+1);setPage('team');setMessage('リセット前のチームに戻しました。');}catch{setSaveError('チームを復元できませんでした。');setSettings(false);}};
 const toggleSound=()=>{if(sound)stopGameAudio();soundRef.current=!sound;setSound(v=>{try{localStorage.setItem('diamond-nine-sound',v?'off':'on');}catch{}return !v;});};
 const change=(s:GameState)=>{if(!lock.current){setCelebration(null);setState(collectSimpleRewards(s));}};
 // Detect only a newly earned title from this play action; loading/importing is silent.
 const commitPlayedSeason=(next:GameState)=>{const earned=firstTitleCelebration(state,next);setState(next);setCelebration(earned);return earned;};
 // Persist the offer and selected card before playing the reveal. Reloads,
 // imports and a second open tab resume the same one-time reward.
 const commitStarter=(index:number|null,name=state.name):boolean=>{
  const teamName=name.trim();
  if(lock.current||!teamName||teamName.length>20)return false;
  try{
   const raw=localStorage.getItem(saveKeyFor(profile));
   const current=raw?migrateState(JSON.parse(raw)):state;
   if(!current||(current.mode==='career')!==(profile==='career'))throw new Error('Invalid save');
   if(!starterScoutActive(current)||JSON.stringify(current.starterScout?.choices)!==JSON.stringify(state.starterScout?.choices)||(index!==null&&current.starterScout?.selected)){
    setState(current);return false;
   }
   const renamed={...current,name:teamName};
   const next=index===null?finishStarterScout(renamed):pickStarterCard(renamed,index);
   if(next===renamed)return false;
   const ready=index===null?equipScoutedPlayer(next,next.starterScout!.selected!):next;
   localStorage.setItem(saveKeyFor(profile),JSON.stringify(ready));setState(ready);
   if(index===null){stopGameAudio();setPage('season');setHasDrawn(false);setMessage('主力選手がチームに加入しました。最初のシーズンを始めよう！');window.scrollTo({top:0,behavior:'auto'});}
   return true;
  }catch{setSaveError('保存できませんでした。空き容量を確認して、もう一度お試しください。設定からデータを書き出すこともできます。');return false;}
 };
 const go=(p:Page)=>{if(starter)return;if(page==='scout'&&p!==page)stopGameAudio();setPage(p);window.scrollTo({top:0,behavior:'smooth'});};
 const play=(days:number)=>{
  if(lock.current||state.season.completed)return;
  if(soundRef.current)void prepareGameAudio();
  lock.current=true;setBusy(true);setProgress(0);let current=state;const from=state.season.day,target=Math.min(seasonGames(state.season),from+days);
  const step=()=>{try{
   current=simulateDays(current,Math.min(7,target-current.season.day));setProgress(Math.round((current.season.day-from)/(target-from)*100));
   if(current.season.day<target)timer.current=setTimeout(step,20);
   else{current=collectSimpleRewards(finishPostseason(current));const a=state.season.standings.find(t=>t.team===state.club)!,b=current.season.standings.find(t=>t.team===state.club)!;const game=current.season.results.at(-1)!;const score=game.home===state.club?`${game.homeRuns} − ${game.awayRuns}`:`${game.awayRuns} − ${game.homeRuns}`;setMessage(`${target-from===1?`${teamById(game.home===state.club?game.away:game.home,current.season).short}戦 ${score}`:`${target-from}試合：${b.w-a.w}勝 ${b.l-a.l}敗 ${b.d-a.d}分`}　獲得ポイント ＋${count(current.gems-state.gems)} pt${current.season.completed?` · ${circuitOf(current.season)==='SPACE'?'宇宙王座決定戦':circuitOf(current.season)==='MLB'?'世界王座決定戦':'プレーオフ・国内王座決定戦'}まで終了！`:''}`);const earned=commitPlayedSeason(current);if(!earned&&(b.w>a.w||current.season.completed)&&soundRef.current)gameSound('win');lock.current=false;setBusy(false);}
  }catch{setMessage('試合を進められませんでした。編成をご確認ください。');setBusy(false);lock.current=false;}};
  timer.current=setTimeout(step,30);
 };
 const post=()=>{if(lock.current)return;if(soundRef.current)void prepareGameAudio();lock.current=true;setBusy(true);setProgress(0);timer.current=setTimeout(()=>{try{const next=collectSimpleRewards(finishPostseason(state));commitPlayedSeason(next);setMessage(`${circuitOf(next.season)==='SPACE'?'宇宙王座決定戦':circuitOf(next.season)==='MLB'?'世界王座決定戦':'プレーオフ・国内王座決定戦'}まで終了しました。獲得ポイント ＋${count(next.gems-state.gems)} pt`);}catch{setMessage('短期決戦を進められませんでした。');}finally{lock.current=false;setBusy(false);}},30);};
 const draw=()=>{
  if(lock.current||state.gems<SIMPLE_SCOUT_COST)return;
  lock.current=true;
  // Commit before the reveal; skipping/reloading never rerolls or charges twice.
  const next=drawSimplePlayer(state);setState(next);setHasDrawn(true);setDrawing(true);
  const {tier}=scoutPresentation(playerMap[next.lastPulls[0].playerId],next.owned,next.training);
  stopGameAudio();if(soundRef.current){gameSound('draw');if(tier!=='standard')gameSound('impact',.65);}
  finishDraw.current=()=>{
   if(!finishDraw.current)return;finishDraw.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;
   stopGameAudio();if(soundRef.current){gameSound(tier==='standard'?'reveal':tier);if(tier==='rainbow')gameSound('voice',.5);}
   setDrawing(false);lock.current=false;
  };
  timer.current=setTimeout(()=>finishDraw.current?.(),scoutDuration(tier));
 };
 return <div className={'simple-app'+(uiTheme==='stadium'?' stadium':'')}><header className="s-header"><a href="#" onClick={e=>{e.preventDefault();go('season');}} className="s-brand"><img className="s-brand-icon" src="/assets/pro/diamond-nine-logo-v1.png" alt="" width={44} height={44}/><b>DIAMOND NINE</b></a><div><span className="s-wallet">{count(state.gems)} <small>pt</small></span><button className="s-icon sound-toggle" aria-label={sound?"効果音をオフにする":"効果音をオンにする"} onClick={toggleSound}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button className="s-icon" aria-label="設定を開く" onClick={()=>setSettings(true)} disabled={busy||drawing}><Settings size={19}/></button></div></header><nav className="s-nav" aria-label="メインメニュー">{tabs.map(t=><button key={t.id} aria-current={(page==='catalog'?'team':page)===t.id?'page':undefined} onClick={()=>go(t.id)} disabled={busy||drawing||starter}><t.icon size={18}/>{t.label}</button>)}</nav><main className="s-main">{saveError&&<div className="s-save-error" role="alert">{saveError}<button onClick={()=>setSettings(true)}>設定を開く</button></div>}<BeginnerTutorial state={state} profile={profile} page={page} replay={tutorialReplay} busy={busy||drawing} onPage={go} onAuto={()=>change(buildByStrategy(state,'balanced'))} onPlay={()=>play(seasonGames(state.season))}/>{starter?<StarterScout key={resetId+'-'+state.starterScout!.choices.join('-')} state={state} sound={sound} onPick={(index,name)=>commitStarter(index,name)} onFinish={name=>commitStarter(null,name)} onPlayer={p=>setSelected(p.id)}/>:<>{page==='season'&&<SimpleSeason state={state} busy={busy} progress={progress} onPlay={play} onPost={post} onNext={()=>{change(nextSeason(state));setMessage('新しいシーズンが始まりました。');}} onSwitchLeague={target=>{change(switchLeague(state,target));setMessage(circuitLabel(target)+'に切り替えました。選手・育成・ポイントは引き継いでいます。');}} onPlayer={p=>setSelected(p.id)} message={message}/ >}{page==='catalog'&&<PlayerCatalog state={state} onBack={()=>go('team')} onPlayer={p=>setSelected(p.id)}/ >}{page==='team'&&<DeckTeam key={resetId} state={state} onChange={change} onPlayer={p=>setSelected(p.id)} onImpact={impact} onCatalog={()=>go('catalog')} onReset={reset} onRestore={restore} onCompleteReset={askCompleteReset} canRestore={canRestore}/ >}{page==='scout'&&<SimpleScout state={state} onSkip={()=>finishDraw.current?.()} onDraw={draw} onEquip={id=>change(equipScoutedPlayer(state,id))} drawing={drawing} hasDrawn={hasDrawn} onSeason={()=>go('season')} onPlayer={p=>setSelected(p.id)}/ >}</>}</main><footer className="s-footer">自動保存 · 国内・海外の選手 · 非公式ゲーム<div className="s-public-links"><a href="/guide.html" target="_blank" rel="noopener noreferrer">遊び方ガイド</a><a href="/welcome.html" target="_blank" rel="noopener noreferrer">ゲームを紹介する</a><a href="/privacy.html" target="_blank" rel="noopener noreferrer">データ・プライバシー</a></div></footer>{selected&&<PlayerInfo player={playerMap[selected]} state={state} catalog={page==='catalog'} onChange={change} onClose={()=>setSelected(null)} onAwaken={()=>{if(sound)gameSound('awaken');}}/ >}{settings&&<SimpleSettings onTutorial={()=>{setSettings(false);setTutorialReplay(v=>v+1);window.scrollTo({top:0,behavior:'auto'});}} state={state} onChange={change} onClose={()=>setSettings(false)} onProfileChange={onProfileChange} onReset={reset} onRestore={restore} onCompleteReset={askCompleteReset} canRestore={canRestore}/ >}{confirmCompleteReset&&<Dialog title="完全リセット" onClose={()=>setConfirmCompleteReset(false)}><div className="complete-reset-dialog"><h3>このクラブの獲得カードをすべて消します。</h3><p>所持カード {Object.keys(state.owned).length}人分・重複獲得・覚醒・ポイント・シーズン成績と、リセット前の復元用データを削除します。</p><p>初期配布の26人、覚醒なし、0ポイントに戻り、スタートスカウトで1人を選んで再スタートします。</p><p><strong>完全リセット後は元に戻せません。</strong></p><div><button className="s-button" onClick={()=>setConfirmCompleteReset(false)}>キャンセル</button><button className="s-button complete-reset" onClick={completeReset}>所持カードを消して最初から</button></div></div></Dialog>}{celebration&&<TitleCelebration celebration={celebration} sound={sound} onToggleSound={toggleSound} onClose={()=>setCelebration(null)}/>}<PlayerHoverPreview owned={page==='catalog'?{}:state.owned} training={page==='catalog'?{}:state.training}/></div>;
}
