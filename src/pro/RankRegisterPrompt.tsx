// 優勝したときに出す「ランキングに登録」。SimpleApp の commitPlayedSeason の後(TitleCelebration を閉じた後)に、
// rankPromptFor(before, after) が値を返したら Dialog で出す。
// 2026-11-03 vc41: 見出しは「◯年で優勝!ランキングに登録」。宇宙リーグを初めて制覇した時は、宇宙リーグ制覇の記録(1回きり)も一緒に残す。
import {useState} from 'react';
import type {GameState} from './engine';
import {HOF_LEAGUE,bestYear,buildEntry,championYearsLabel,cleanTeamName,rankLeague,rankLeagueOf,saveTeamName,validDisplayName,validTeamName,cleanName,type RankLeague} from './rank-entry';
import {BUSY_MSG,available,displayName,myBest,myHof,rename,submit,submitHof} from './ranking';
import {circuitOf} from './leagues';
import './ranking.css';

/** 今の試合でそのリーグの「一番早い優勝」が決まった時だけ、そのリーグを返す(育成モードだけ・端末の自己ベストより早い時か、宇宙リーグ制覇の記録がまだの時)。 */
export function rankPromptFor(before:GameState,after:GameState):RankLeague|null{
 if(!available()||after.mode!=='career')return null;
 const s=after.season;
 const justWon=s.completed&&s.postseason?.stage==='complete'&&s.postseason.champion===after.club&&before.season.postseason?.stage!=='complete';
 if(!justWon)return null;
 const lg=rankLeagueOf(circuitOf(s)).id,y=bestYear(after,lg);
 if(y===null||y!==s.number)return null;            // 2回目以降の優勝(記録は前の年のまま)は出さない
 const mine=myBest(lg);
 return !mine||y<mine.y||(lg===HOF_LEAGUE&&!myHof())?lg:null;
}

export function RankRegisterPrompt({state,league,version,onClose,onOpenRanking}:{state:GameState;league:RankLeague;version:string;onClose:()=>void;onOpenRanking:(lg:RankLeague)=>void}){
 const info=rankLeague(league),y=bestYear(state,league),hof=league===HOF_LEAGUE&&!myHof();
 const [name,setName]=useState(displayName()),[team,setTeam]=useState(saveTeamName(state,league)),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[done,setDone]=useState(false);
 const send=async()=>{
  const n=cleanName(name),tn=cleanTeamName(team);
  if(!validDisplayName(n)){setMsg('この名前は使えません(12文字まで・使えない言葉あり)。');return;}
  if(!validTeamName(tn)){setMsg('このチーム名は使えません(20文字まで・使えない言葉あり)。');return;}
  const entry=buildEntry(state,league,n,version,tn);
  if(!entry){setMsg('この記録は登録できませんでした。');return;}
  setBusy(true);setMsg('');
  try{
   if(n!==displayName())await rename(n);
   const mine=myBest(league),parts:string[]=[];
   if(!mine||entry.y<mine.y){const r=await submit(league,entry);if(r==='wait'){setMsg('少し待ってからもう一度押してください。');return;}parts.push(r==='sent'?'最短優勝のランキングに登録しました。':'登録済みの記録の方が早いので、そのままです。');}
   if(hof){const r=await submitHof(entry);parts.push(r==='sent'?'宇宙リーグ制覇の記録を残しました(1回きり)。':'宇宙リーグ制覇の記録は、もう残してあります。');}
   setDone(true);setMsg(`あなたは${championYearsLabel(entry.y)}。`+parts.join(''));
  }catch(e:any){setMsg(e?.busy?BUSY_MSG:'登録できませんでした。ネットにつながっているか確かめてください。');}
  finally{setBusy(false);}
 };
 return <div className="d9r d9r-prompt">
  <p className="d9r-big">{info.label}を<b>{y}年</b>で優勝!<br/>ランキングに登録</p>
  <p className="d9r-lead">{championYearsLabel(y??0)}の記録を、オンラインランキング(最短優勝)に登録できます。{hof&&'初めての宇宙リーグ制覇なので、名前・チーム名・オーダーを「宇宙リーグ制覇」の記録にも1回だけ残します(あとから書きかえできません)。'}送るのは表示名・チーム名・年数・この年の成績とオーダーだけです。</p>
  {!done?<>
   <label className="d9r-field">表示名<input value={name} maxLength={12} onChange={e=>setName(e.target.value)} disabled={busy}/></label>
   <label className="d9r-field">チーム名<input value={team} maxLength={20} onChange={e=>setTeam(e.target.value)} disabled={busy}/></label>
   <button className="d9r-primary" onClick={send} disabled={busy||!name.trim()||!team.trim()}>{championYearsLabel(y??0)}!ランキングに登録</button>
   <button className="d9r-link" onClick={onClose} disabled={busy}>あとで(ランキングの画面からも登録できます)</button>
  </>:<>
   <button className="d9r-primary" onClick={()=>onOpenRanking(league)}>ランキングを見る</button>
   <button className="d9r-link" onClick={onClose}>閉じる</button>
  </>}
  {msg&&<p className="d9r-note" role="status">{msg}</p>}
 </div>;
}
