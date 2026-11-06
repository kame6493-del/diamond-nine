// DIAMOND NINE オンラインランキングの画面。SimpleApp の Dialog の中に入れて使う(<Dialog title="ランキング" ...><RankingScreen .../></Dialog>)。
// 流れ: タブ(海外・宇宙・国内の最短優勝、宇宙リーグ制覇)→ 上位20(もっと見るで50まで)と自分の記録 → 行を押すと優勝した時のオーダー。
// 2026-11-03 vc41 持ち主「最短で〇年で優勝した、みたいな年数を競う感じに」「オーダーも見れるような感じで」:
// 各行の先頭に「◯年で優勝」(宇宙リーグ制覇は「◯年で制覇」)を大きく、そのあとに名前とチーム名、行の右に「オーダーを見る」。
import {shownKmh} from './velocity-display';
import {useEffect,useState} from 'react';
import type {GameState} from './engine';
import {HOF_LEAGUE,RANK_LEAGUES,bestYear,buildEntry,championSeason,championYearsLabel,rankLeague,saveTeamName,validTeamName,cleanTeamName,type RankLeague} from './rank-entry';
import {BUSY_MSG,available,displayName,listHof,listTop,myBest,myHof,myPlace,rename,submit,submitHof,uid,type RankRow} from './ranking';
import './ranking.css';

export type RankTab=RankLeague|'hof';
const TABS:{id:RankTab;label:string}[]=[...RANK_LEAGUES.map(l=>({id:l.id as RankTab,label:l.label.replace('リーグ','')})),{id:'hof',label:'宇宙制覇'}]; // 360px 幅に4つ並ぶよう「リーグ」を省く
const day=(ms:number)=>{if(!ms)return '';const d=new Date(ms);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;};

export function RankingScreen({state,version,initial='mlb'}:{state:GameState;version:string;initial?:RankTab}){
 const [tab,setTab]=useState<RankTab>(initial);
 const [rows,setRows]=useState<RankRow[]|null>(null);
 const [more,setMore]=useState(false),[stale,setStale]=useState(false);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [open,setOpen]=useState<RankRow|null>(null);
 const [name,setName]=useState(displayName()),[editing,setEditing]=useState(false);
 const [team,setTeam]=useState(saveTeamName(state,HOF_LEAGUE)||'');
 const [note,setNote]=useState('');
 const hof=tab==='hof',lg:RankLeague=hof?HOF_LEAGUE:tab;

 const load=async(next=false)=>{
  if(!available()){setError('ランキングは準備中です。');setRows([]);return;}
  setBusy(true);setError('');
  try{const r=hof?await listHof(next):await listTop(lg,next);setRows(r.rows);setMore(r.more);setStale(!!r.stale);}
  catch(e:any){setError(e?.busy?BUSY_MSG:'ランキングを読みこめませんでした。ネットにつながっているか確かめてください。');setRows(r=>r??[]);}
  finally{setBusy(false);}
 };
 useEffect(()=>{setRows(null);setOpen(null);setNote('');void load();},[tab]); // eslint-disable-line react-hooks/exhaustive-deps

 const info=rankLeague(lg),place=rows?myPlace(rows):null,mine=hof?null:myBest(lg),hofMine=myHof();
 // まだ送っていない自分の記録(過去に優勝していて、そのシーズンのオーダーが残っている)
 const y=bestYear(state,lg),hasLineup=y!==null&&!!championSeason(state,lg);
 const canSend=hof?hasLineup&&!hofMine:hasLineup&&(!mine||y!<mine.y);
 const send=async()=>{
  if(hof&&!validTeamName(cleanTeamName(team))){setNote('このチーム名は使えません(20文字まで・使えない言葉あり)。');return;}
  const entry=buildEntry(state,lg,name,version,hof?cleanTeamName(team):undefined);
  if(!entry){setNote('この記録は登録できません(優勝した年のオーダーが残っていません)。');return;}
  setBusy(true);
  try{
   if(hof){const r=await submitHof(entry);setNote(r==='sent'?`残しました。あなたは${championYearsLabel(entry.y,true)}。`:'宇宙リーグ制覇の記録は1回きりで、もう残してあります。');if(r==='sent')await load();}
   else{const r=await submit(lg,entry);setNote(r==='sent'?`登録しました。あなたは${championYearsLabel(entry.y)}。`:r==='wait'?'少し待ってからもう一度押してください。':'登録済みの記録の方が早いので、そのままです。');if(r==='sent')await load();}
  }
  catch(e:any){setNote(e?.busy?BUSY_MSG:String(e?.message??e));}
  finally{setBusy(false);}
 };
 const saveName=async()=>{
  setBusy(true);
  try{await rename(name);setEditing(false);setNote(hof?'表示名を変えました(宇宙リーグ制覇の記録は残した時の名前のままです)。':'表示名を変えました。');if(rows&&!hof)setRows(rows.map(r=>r.uid===uid()?{...r,n:name}:r));}
  catch(e:any){setNote(e?.busy?BUSY_MSG:String(e?.message??e));}
  finally{setBusy(false);}
 };

 if(open)return <LineupView row={open} league={info.label} hof={hof} onBack={()=>setOpen(null)}/>;
 const myLine=hof?(hofMine&&hofMine.y>0?`あなたは${championYearsLabel(hofMine.y,true)}${place?`・${place}位`:''}`:hofMine?'記録は残してあります':y!==null?`あなたは${championYearsLabel(y,true)}(まだ残していません)`:'まだ宇宙リーグを制覇していません')
  :mine?`あなたは${championYearsLabel(mine.y)}・${place?place+'位':'51位以下'}`:y!==null?`あなたは${championYearsLabel(y)}(未登録)`:'まだ優勝していません';
 return <div className="d9r">
  <div className="d9r-tabs" role="tablist">{TABS.map(t=><button key={t.id} role="tab" aria-selected={t.id===tab} onClick={()=>setTab(t.id)} disabled={busy}>{t.label}</button>)}</div>
  <p className="d9r-lead">{hof?<>宇宙リーグを<b>何年で制覇したか</b>の記録。1人1回きり(最初の制覇)で、あとから書きかえできません。</>:<>{info.label}の<b>最短優勝</b>({info.title}まで何年か)。</>}年数の少ない順、同じ年数なら先に達成した人が上。</p>
  <div className="d9r-me">
   <span>あなた</span>
   {editing?<><input value={name} maxLength={12} onChange={e=>setName(e.target.value)} aria-label="表示名"/><button onClick={saveName} disabled={busy||!name.trim()}>保存</button></>
    :<><b>{name}</b><button className="d9r-link" onClick={()=>setEditing(true)}>名前を変える</button></>}
   <em>{myLine}</em>
  </div>
  {canSend&&hof&&<label className="d9r-field">チーム名(残すと変えられません)<input value={team} maxLength={20} onChange={e=>setTeam(e.target.value)} disabled={busy}/></label>}
  {canSend&&<button className="d9r-primary" onClick={send} disabled={busy}>{hof?`${championYearsLabel(y!,true)}!記録を残す(1回きり)`:`${championYearsLabel(y!)}!ランキングに登録`}</button>}
  {note&&<p className="d9r-note" role="status">{note}</p>}
  {stale&&<p className="d9r-note">混み合っているため、少し前の表を出しています。</p>}
  {error&&<p className="d9r-note" role="alert">{error}</p>}
  {rows===null?<p className="d9r-note">読みこみ中…</p>:rows.length===0&&!error?<p className="d9r-note">まだ登録がありません。最初の1人になれます。</p>:
   <ol className="d9r-list">{rows.map((r,i)=><li key={r.uid} className={r.uid===uid()?'is-me':''}>
    <button onClick={()=>setOpen(r)} aria-label={`${i+1}位 ${championYearsLabel(r.y,hof)} ${r.n} ${r.tn} オーダーを見る`}>
     <span className="d9r-rank">{i+1}</span>
     <span className="d9r-years"><span><b>{r.y}</b>年で{hof?'制覇':'優勝'}</span><small>{day(r.at)}</small></span>
     <span className="d9r-who"><b>{r.n}</b><small>{r.tn}</small></span>
     <span className="d9r-open">オーダー<br/>を見る ›</span>
    </button></li>)}</ol>}
  {more&&<button className="d9r-more" onClick={()=>load(true)} disabled={busy}>もっと見る(50位まで)</button>}
 </div>;
}

/** 優勝したときのオーダー(打順9人と先発6人)。通信しない(表の行に入っている)。 */
export function LineupView({row,league,hof=false,onBack}:{row:RankRow;league:string;hof?:boolean;onBack:()=>void}){
 return <div className="d9r d9r-lineup">
  <div className="d9r-lhead"><button className="d9r-link" onClick={onBack}>← 戻る</button><p className="d9r-big">{league}を<b>{row.y}年</b>で{hof?'制覇':'優勝'}</p></div>
  <h3><b>{row.n}</b><span>{row.tn}</span></h3>
  <p className="d9r-small">{row.rec.w}勝{row.rec.l}敗{row.rec.d?`${row.rec.d}分`:''} ・ {day(row.at)}</p>
  <h4>優勝したときのオーダー<small>能力はシーズン終了時</small></h4>
  <table><thead><tr><th>打順</th><th>守</th><th>選手</th><th>総合</th><th>ミート</th><th>パワー</th><th>走力</th><th>守備</th></tr></thead>
   <tbody>{row.b.map((p,i)=><tr key={p.i}><td>{i+1}</td><td>{p.pos}</td><td className="d9r-name">{p.n}</td><td><b>{p.o}</b></td><td>{p.c}</td><td>{p.p}</td><td>{p.s}</td><td>{p.f}</td></tr>)}</tbody></table>
  <h4>先発投手</h4>
  <table><thead><tr><th></th><th>選手</th><th>総合</th><th>球速</th><th>制球</th><th>スタミナ</th><th>変化球</th></tr></thead>
   <tbody>{row.sp.map((p,i)=><tr key={p.i}><td>{i+1}</td><td className="d9r-name">{p.n}</td><td><b>{p.o}</b></td><td>{p.v?shownKmh(p.v):p.v}</td><td>{p.ct}</td><td>{p.st}</td><td>{p.bk}</td></tr>)}</tbody></table>
 </div>;
}
