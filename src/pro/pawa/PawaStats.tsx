import {useMemo,useState} from 'react';
import {formatAvg,formatIP,playerMap,type Player} from '../data';
import {battingAverage,era,ops,type Season} from '../engine';
import {playerAge} from '../development';
import {formatUZR,playerSeasonUZR} from '../fielding-stats';

type Col<T>={key:string;label:string;value:(r:T)=>number|null;show:(r:T)=>string;low?:boolean};
type Bat={id:string;p:Player;pa:number;ab:number;h:number;hr:number;rbi:number;sb:number;bb:number;so:number;avg:number|null;ops:number|null;uzr:number|null;games:number};
type Pit={id:string;p:Player;g:number;gs:number;w:number;l:number;sv:number;outs:number;so:number;bb:number;era:number|null};

/** 個人成績(打者と投手を切り替え)。上に主な数字を大きく、下はタップで並べ替えられる表(見出しと選手名は固定)。 */
export function PawaStats({season,club,onPlayer,lineup=[],pitchers=[]}:{season:Season;club:string;onPlayer:(p:Player)=>void;lineup?:string[];pitchers?:string[]}){
 const [view,setView]=useState<'bat'|'pit'>('bat');
 const [batSort,setBatSort]=useState<{key:string;desc:boolean}>({key:'order',desc:false});
 const [pitSort,setPitSort]=useState<{key:string;desc:boolean}>({key:'order',desc:false});
 const bats=useMemo(()=>{
  const lines=new Map(Object.values(season.batting).filter(b=>b.team===club).map(b=>[b.playerId,b]));
  const ids=[...new Set([...lineup,...lines.keys()])].filter(id=>playerMap[id]);
  return ids.map((id):Bat=>{const b=lines.get(id);return {id,p:playerMap[id],pa:b?.pa??0,ab:b?.ab??0,h:b?.hits??0,hr:b?.hr??0,rbi:b?.rbi??0,sb:b?.sb??0,bb:b?.bb??0,so:b?.so??0,games:b?.games??0,avg:b?.ab?battingAverage(b):null,ops:b?.pa?ops(b):null,uzr:playerSeasonUZR(season,club,id)};});
 },[season,club,lineup.join()]);
 const pits=useMemo(()=>{
  const lines=new Map(Object.values(season.pitching).filter(p=>p.team===club).map(p=>[p.playerId,p]));
  const ids=[...new Set([...pitchers,...lines.keys()])].filter(id=>playerMap[id]);
  return ids.map((id):Pit=>{const p=lines.get(id);return {id,p:playerMap[id],g:p?.games??0,gs:p?.starts??0,w:p?.wins??0,l:p?.losses??0,sv:p?.saves??0,outs:p?.outs??0,so:p?.so??0,bb:p?.bb??0,era:p?.outs?era(p):null};});
 },[season,club,pitchers.join()]);
 const games=Math.max(1,season.day);
 // 打率と防御率の1位は、出場の少ない選手を外す(規定打席・規定投球回の考え方)。
 const qualifiedBat=bats.filter(b=>b.pa>=Math.max(1,Math.floor(games*3.1*.5)));
 const qualifiedPit=pits.filter(p=>p.outs>=Math.max(3,Math.floor(games*.5*3)));
 const top=<T,>(list:T[],value:(r:T)=>number|null,low=false)=>list.filter(r=>value(r)!==null).sort((a,b)=>(low?1:-1)*((value(a) as number)-(value(b) as number)))[0];
 const batCols:Col<Bat>[]=[
  {key:'avg',label:'打率',value:r=>r.avg,show:r=>r.avg===null?'—':formatAvg(r.avg)},
  {key:'hr',label:'本塁打',value:r=>r.hr,show:r=>String(r.hr)},
  {key:'rbi',label:'打点',value:r=>r.rbi,show:r=>String(r.rbi)},
  {key:'h',label:'安打',value:r=>r.h,show:r=>String(r.h)},
  {key:'ops',label:'OPS',value:r=>r.ops,show:r=>r.ops===null?'—':formatAvg(r.ops)},
  {key:'sb',label:'盗塁',value:r=>r.sb,show:r=>String(r.sb)},
  {key:'bb',label:'四球',value:r=>r.bb,show:r=>String(r.bb)},
  {key:'so',label:'三振',value:r=>r.so,show:r=>String(r.so),low:true},
  {key:'uzr',label:'UZR',value:r=>r.uzr,show:r=>formatUZR(r.uzr)},
 ];
 const pitCols:Col<Pit>[]=[
  {key:'era',label:'防御率',value:r=>r.era,show:r=>r.era===null?'—':r.era.toFixed(2),low:true},
  {key:'w',label:'勝',value:r=>r.w,show:r=>String(r.w)},
  {key:'l',label:'敗',value:r=>r.l,show:r=>String(r.l),low:true},
  {key:'sv',label:'S',value:r=>r.sv,show:r=>String(r.sv)},
  {key:'so',label:'奪三振',value:r=>r.so,show:r=>String(r.so)},
  {key:'ip',label:'投球回',value:r=>r.outs,show:r=>formatIP(r.outs)},
  {key:'g',label:'登板',value:r=>r.g,show:r=>String(r.g)},
  {key:'bb',label:'四球',value:r=>r.bb,show:r=>String(r.bb),low:true},
 ];
 const sorted=<T extends {id:string}>(list:T[],cols:Col<T>[],sort:{key:string;desc:boolean},order:string[])=>{
  if(sort.key==='order')return [...list].sort((a,b)=>{const x=order.indexOf(a.id),y=order.indexOf(b.id);return (x<0?99:x)-(y<0?99:y);});
  const col=cols.find(c=>c.key===sort.key)!;
  return [...list].sort((a,b)=>{const x=col.value(a),y=col.value(b);if(x===null)return y===null?0:1;if(y===null)return -1;return sort.desc?y-x:x-y;});
 };
 const head=<T,>(cols:Col<T>[],sort:{key:string;desc:boolean},set:(s:{key:string;desc:boolean})=>void)=><tr><th className="pw-st-name"><button onClick={()=>set({key:'order',desc:false})} aria-pressed={sort.key==='order'}>選手</button></th>{cols.map(c=><th key={c.key}><button aria-pressed={sort.key===c.key} onClick={()=>set(sort.key===c.key?{key:c.key,desc:!sort.desc}:{key:c.key,desc:!c.low})}>{c.label}{sort.key===c.key&&<i aria-hidden="true">{sort.desc?'▼':'▲'}</i>}</button></th>)}</tr>;
 const nameCell=(p:Player,sub:string)=><th className="pw-st-name"><button data-player-id={p.id} onClick={()=>onPlayer(p)}><b>{p.name}</b><small>{sub}</small></button></th>;
 const leader=(label:string,r:{p:Player}|undefined,shown:string,unit='')=><div className="pw-leader"><small>{label}</small>{r?<><b>{shown}<em>{unit}</em></b><button onClick={()=>onPlayer(r.p)}>{r.p.name}</button></>:<b>—</b>}</div>;
 const empty=view==='bat'?!bats.some(b=>b.pa):!pits.some(p=>p.outs);
 const ageOf=(p:Player)=>{const a=playerAge(p);return a===null?'':`${a}歳`;};
 const hrTop=top(bats,r=>r.hr),avgTop=top(qualifiedBat,r=>r.avg),rbiTop=top(bats,r=>r.rbi);
 const eraTop=top(qualifiedPit,r=>r.era,true),soTop=top(pits,r=>r.so),winTop=top(pits,r=>r.w);
 return <div className="pw-stats">
  <div className="pw-seg pw-stats-switch" role="tablist" aria-label="表示する個人成績"><button role="tab" aria-selected={view==='bat'} className={view==='bat'?'is-on':''} onClick={()=>setView('bat')}>打者</button><button role="tab" aria-selected={view==='pit'} className={view==='pit'?'is-on':''} onClick={()=>setView('pit')}>投手</button></div>
  {empty?<p className="pw-note">試合を進めると成績が表示されます。</p>:<>
   <div className="pw-leaders">{view==='bat'?<>{leader('打率 1位',avgTop,avgTop?.avg!=null?formatAvg(avgTop.avg):'—')}{leader('本塁打 1位',hrTop,String(hrTop?.hr??0),'本')}{leader('打点 1位',rbiTop,String(rbiTop?.rbi??0))}</>:<>{leader('防御率 1位',eraTop,eraTop?.era!=null?eraTop.era.toFixed(2):'—')}{leader('奪三振 1位',soTop,String(soTop?.so??0))}{leader('勝利 1位',winTop,String(winTop?.w??0),'勝')}</>}</div>
   <p className="pw-st-hint">見出しをタップすると並べ替え。選手名で詳細。</p>
   <div className="pw-st-scroll">
    {view==='bat'?<table className="pw-st-table"><thead>{head(batCols,batSort,setBatSort)}</thead><tbody>{sorted(bats,batCols,batSort,lineup).map(r=><tr key={r.id} className={lineup.includes(r.id)?'is-starter':''}>{nameCell(r.p,`${ageOf(r.p)}${lineup.includes(r.id)?` · ${lineup.indexOf(r.id)+1}番`:''} · ${r.games}試合`)}{batCols.map(c=><td key={c.key} className={c.key==='uzr'?(r.uzr!==null&&r.uzr>0?'is-plus':r.uzr!==null&&r.uzr<0?'is-minus':''):''}>{c.show(r)}</td>)}</tr>)}</tbody></table>
    :<table className="pw-st-table"><thead>{head(pitCols,pitSort,setPitSort)}</thead><tbody>{sorted(pits,pitCols,pitSort,pitchers).map(r=>{const i=pitchers.indexOf(r.id);return <tr key={r.id} className={i>=0?'is-starter':''}>{nameCell(r.p,`${ageOf(r.p)}${i<0?'':i<6?` · 先発${i+1}`:i===13?' · 抑え':' · 中継ぎ'}`)}{pitCols.map(c=><td key={c.key}>{c.show(r)}</td>)}</tr>;})}</tbody></table>}
   </div>
   {view==='bat'&&<p className="pw-note-left">UZRはリーグ平均を0とした守備の貢献。プラスほど失点を防いでいます。</p>}
  </>}
 </div>;
}
