// 優勝したときに出す「ランキングに登録」(下書き)。組み込み先は src/pro/RankRegisterPrompt.tsx を想定。
// SimpleApp の commitPlayedSeason の後(TitleCelebration を閉じた後)に、rankPromptFor(before, after) が値を返したら Dialog で出す。
import {useState} from 'react';
import type {GameState} from './engine';
import {bestYear,buildEntry,rankLeague,rankLeagueOf,validDisplayName,cleanName,type RankLeague} from './rank-entry';
import {BUSY_MSG,available,displayName,myBest,rename,submit} from './ranking';
import {circuitOf} from './leagues';
import './ranking.css';

/** 今の試合でそのリーグの「一番早い優勝」が決まった時だけ、そのリーグを返す(育成モードだけ・端末の自己ベストより早い時だけ)。 */
export function rankPromptFor(before:GameState,after:GameState):RankLeague|null{
 if(!available()||after.mode!=='career')return null;
 const s=after.season;
 const justWon=s.completed&&s.postseason?.stage==='complete'&&s.postseason.champion===after.club&&before.season.postseason?.stage!=='complete';
 if(!justWon)return null;
 const lg=rankLeagueOf(circuitOf(s)).id,y=bestYear(after,lg);
 if(y===null||y!==s.number)return null;            // 2回目以降の優勝(記録は前の年のまま)は出さない
 const mine=myBest(lg);
 return !mine||y<mine.y?lg:null;
}

export function RankRegisterPrompt({state,league,version,onClose,onOpenRanking}:{state:GameState;league:RankLeague;version:string;onClose:()=>void;onOpenRanking:(lg:RankLeague)=>void}){
 const info=rankLeague(league),y=bestYear(state,league);
 const [name,setName]=useState(displayName()),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[done,setDone]=useState(false);
 const send=async()=>{
  const n=cleanName(name);
  if(!validDisplayName(n)){setMsg('この名前は使えません(12文字まで・使えない言葉あり)。');return;}
  const entry=buildEntry(state,league,n,version);
  if(!entry){setMsg('この記録は登録できませんでした。');return;}
  setBusy(true);setMsg('');
  try{
   if(n!==displayName())await rename(n);
   const r=await submit(league,entry);
   if(r==='sent'){setDone(true);setMsg('登録しました。');}
   else setMsg(r==='wait'?'少し待ってからもう一度押してください。':'登録済みの記録の方が早いので、そのままです。');
  }catch(e:any){setMsg(e?.busy?BUSY_MSG:'登録できませんでした。ネットにつながっているか確かめてください。');}
  finally{setBusy(false);}
 };
 return <div className="d9r d9r-prompt">
  <p className="d9r-big">{info.label}を<b>{y}年目</b>で制覇</p>
  <p className="d9r-lead">オンラインランキング(最短優勝)に登録できます。送るのは表示名・チーム名・年数・この年の成績とスタメンだけです。</p>
  {!done?<>
   <label className="d9r-field">表示名<input value={name} maxLength={12} onChange={e=>setName(e.target.value)} disabled={busy}/></label>
   <button className="d9r-primary" onClick={send} disabled={busy||!name.trim()}>ランキングに登録</button>
   <button className="d9r-link" onClick={onClose} disabled={busy}>あとで(ランキングの画面からも登録できます)</button>
  </>:<>
   <button className="d9r-primary" onClick={()=>onOpenRanking(league)}>ランキングを見る</button>
   <button className="d9r-link" onClick={onClose}>閉じる</button>
  </>}
  {msg&&<p className="d9r-note" role="status">{msg}</p>}
 </div>;
}
