// DIAMOND NINE オンラインランキングの画面(下書き)。組み込み先は src/pro/RankingScreen.tsx を想定。
// SimpleApp の Dialog の中に入れて使う(<Dialog title="ランキング" ...><RankingScreen .../></Dialog>)。
// 流れ: リーグのタブ(海外・宇宙・国内)→ 上位20(もっと見るで50まで)と自分の順位 → 行を押すと優勝した時のスタメン。
import {useEffect,useState} from 'react';
import type {GameState} from './engine';
import {RANK_LEAGUES,bestYear,buildEntry,championSeason,rankLeague,type RankLeague} from './rank-entry';
import {BUSY_MSG,available,displayName,listTop,myBest,myPlace,rename,submit,uid,type RankRow} from './ranking';
import './ranking.css';

const day=(ms:number)=>{if(!ms)return '';const d=new Date(ms);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;};

export function RankingScreen({state,version,initial='mlb'}:{state:GameState;version:string;initial?:RankLeague}){
 const [lg,setLg]=useState<RankLeague>(initial);
 const [rows,setRows]=useState<RankRow[]|null>(null);
 const [more,setMore]=useState(false),[stale,setStale]=useState(false);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [open,setOpen]=useState<RankRow|null>(null);
 const [name,setName]=useState(displayName()),[editing,setEditing]=useState(false);
 const [note,setNote]=useState('');

 const load=async(next=false)=>{
  if(!available()){setError('ランキングは準備中です。');setRows([]);return;}
  setBusy(true);setError('');
  try{const r=await listTop(lg,next);setRows(r.rows);setMore(r.more);setStale(!!r.stale);}
  catch(e:any){setError(e?.busy?BUSY_MSG:'ランキングを読みこめませんでした。ネットにつながっているか確かめてください。');setRows(r=>r??[]);}
  finally{setBusy(false);}
 };
 useEffect(()=>{setRows(null);setOpen(null);setNote('');void load();},[lg]); // eslint-disable-line react-hooks/exhaustive-deps

 const info=rankLeague(lg),place=rows?myPlace(rows):null,mine=myBest(lg);
 // まだ送っていない自分の記録(過去に優勝していて、そのシーズンのスタメンが残っている)
 const y=bestYear(state,lg),canSend=y!==null&&(!mine||y<mine.y)&&!!championSeason(state,lg);
 const send=async()=>{
  const entry=buildEntry(state,lg,name,version);
  if(!entry){setNote('この記録は登録できません(優勝した年のスタメンが残っていません)。');return;}
  setBusy(true);
  try{const r=await submit(lg,entry);setNote(r==='sent'?'登録しました。':r==='wait'?'少し待ってからもう一度押してください。':'登録済みの記録の方が早いので、そのままです。');if(r==='sent')await load();}
  catch(e:any){setNote(e?.busy?BUSY_MSG:String(e?.message??e));}
  finally{setBusy(false);}
 };
 const saveName=async()=>{
  setBusy(true);
  try{await rename(name);setEditing(false);setNote('表示名を変えました。');if(rows)setRows(rows.map(r=>r.uid===uid()?{...r,n:name}:r));}
  catch(e:any){setNote(e?.busy?BUSY_MSG:String(e?.message??e));}
  finally{setBusy(false);}
 };

 if(open)return <LineupView row={open} league={info.label} onBack={()=>setOpen(null)}/>;
 return <div className="d9r">
  <div className="d9r-tabs" role="tablist">{RANK_LEAGUES.map(l=><button key={l.id} role="tab" aria-selected={l.id===lg} onClick={()=>setLg(l.id)} disabled={busy}>{l.label}</button>)}</div>
  <p className="d9r-lead">{info.label}の<b>最短優勝</b>({info.title}まで何年目か)。同じ年数なら先に達成した人が上。</p>
  <div className="d9r-me">
   <span>あなた</span>
   {editing?<><input value={name} maxLength={12} onChange={e=>setName(e.target.value)} aria-label="表示名"/><button onClick={saveName} disabled={busy||!name.trim()}>保存</button></>
    :<><b>{name}</b><button className="d9r-link" onClick={()=>setEditing(true)}>名前を変える</button></>}
   <em>{mine?`${mine.y}年目・${place?place+'位':'51位以下'}`:y!==null?`${y}年目(未登録)`:'まだ優勝していません'}</em>
  </div>
  {canSend&&<button className="d9r-primary" onClick={send} disabled={busy}>{y}年目の記録をランキングに登録</button>}
  {note&&<p className="d9r-note" role="status">{note}</p>}
  {stale&&<p className="d9r-note">混み合っているため、少し前の表を出しています。</p>}
  {error&&<p className="d9r-note" role="alert">{error}</p>}
  {rows===null?<p className="d9r-note">読みこみ中…</p>:rows.length===0&&!error?<p className="d9r-note">まだ登録がありません。最初の1人になれます。</p>:
   <ol className="d9r-list">{rows.map((r,i)=><li key={r.uid} className={r.uid===uid()?'is-me':''}>
    <button onClick={()=>setOpen(r)} aria-label={`${i+1}位 ${r.n} ${r.y}年目 スタメンを見る`}>
     <span className="d9r-rank">{i+1}</span>
     <span className="d9r-who"><b>{r.n}</b><small>{r.tn}</small></span>
     <span className="d9r-years"><span><b>{r.y}</b>年目</span><small>{day(r.at)}</small></span>
    </button></li>)}</ol>}
  {more&&<button className="d9r-more" onClick={()=>load(true)} disabled={busy}>もっと見る(50位まで)</button>}
 </div>;
}

/** 優勝したときのスタメン(打順9人と先発6人)。通信しない(表の行に入っている)。 */
export function LineupView({row,league,onBack}:{row:RankRow;league:string;onBack:()=>void}){
 return <div className="d9r d9r-lineup">
  <button className="d9r-link" onClick={onBack}>← ランキングに戻る</button>
  <h3>{row.n}<small>{row.tn}</small></h3>
  <p className="d9r-lead">{league}を<b>{row.y}年目</b>で制覇 ・ {row.rec.w}勝{row.rec.l}敗{row.rec.d?`${row.rec.d}分`:''} ・ {day(row.at)}</p>
  <h4>優勝したときのスタメン</h4>
  <table><thead><tr><th>打順</th><th>守</th><th>選手</th><th>総合</th><th>ミート</th><th>パワー</th><th>走力</th><th>守備</th></tr></thead>
   <tbody>{row.b.map((p,i)=><tr key={p.i}><td>{i+1}</td><td>{p.pos}</td><td className="d9r-name">{p.n}</td><td><b>{p.o}</b></td><td>{p.c}</td><td>{p.p}</td><td>{p.s}</td><td>{p.f}</td></tr>)}</tbody></table>
  <h4>先発投手</h4>
  <table><thead><tr><th></th><th>選手</th><th>総合</th><th>球速</th><th>制球</th><th>スタミナ</th><th>変化球</th></tr></thead>
   <tbody>{row.sp.map((p,i)=><tr key={p.i}><td>{i+1}</td><td className="d9r-name">{p.n}</td><td><b>{p.o}</b></td><td>{p.v}km/h</td><td>{p.ct}</td><td>{p.st}</td><td>{p.bk}</td></tr>)}</tbody></table>
  <p className="d9r-small">能力はシーズン終了時の値です。</p>
 </div>;
}
