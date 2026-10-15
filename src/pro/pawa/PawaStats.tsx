import {useMemo,useState} from 'react';
import {formatAvg,formatIP,playerMap,type Player} from '../data';
import {battingAverage,era,ops,type Season} from '../engine';
import {formatUZR,playerSeasonUZR} from '../fielding-stats';

type Col<T>={key:string;label:string;value:(r:T)=>number|null;show:(r:T)=>string;low?:boolean};
type Bat={id:string;p:Player;pa:number;ab:number;h:number;d2:number;d3:number;hr:number;rbi:number;sb:number;bb:number;so:number;avg:number|null;ops:number|null;uzr:number|null;games:number};
type Pit={id:string;p:Player;g:number;gs:number;w:number;l:number;sv:number;outs:number;so:number;bb:number;ha:number;hra:number;era:number|null;whip:number|null};

/** 個人成績(打者か投手の片方)。1画面に収まるよう行を詰め、上に1位の数字、表は見出しで並べ替え(左右だけ動く)。
 *  今のシーズンはスタメン9人/投手14人だけを出し、それ以外の選手は「ほかの選手も」で足す。 */
export function PawaStats({season,club,onPlayer,lineup=[],pitchers=[],view}:{season:Season;club:string;onPlayer:(p:Player)=>void;lineup?:string[];pitchers?:string[];view:'bat'|'pit'}){
 const [sort,setSort]=useState<{key:string;desc:boolean}>({key:'order',desc:false}),[all,setAll]=useState(false);
 const bats=useMemo(()=>{
  const lines=new Map(Object.values(season.batting).filter(b=>b.team===club).map(b=>[b.playerId,b]));
  const ids=[...new Set([...lineup,...lines.keys()])].filter(id=>playerMap[id]);
  return ids.map((id):Bat=>{const b=lines.get(id);return {id,p:playerMap[id],pa:b?.pa??0,ab:b?.ab??0,h:b?.hits??0,d2:b?.doubles??0,d3:b?.triples??0,hr:b?.hr??0,rbi:b?.rbi??0,sb:b?.sb??0,bb:b?.bb??0,so:b?.so??0,games:b?.games??0,avg:b?.ab?battingAverage(b):null,ops:b?.pa?ops(b):null,uzr:playerSeasonUZR(season,club,id)};});
 },[season,club,lineup.join()]);
 const pits=useMemo(()=>{
  const lines=new Map(Object.values(season.pitching).filter(p=>p.team===club).map(p=>[p.playerId,p]));
  const ids=[...new Set([...pitchers,...lines.keys()])].filter(id=>playerMap[id]);
  return ids.map((id):Pit=>{const p=lines.get(id);return {id,p:playerMap[id],g:p?.games??0,gs:p?.starts??0,w:p?.wins??0,l:p?.losses??0,sv:p?.saves??0,outs:p?.outs??0,so:p?.so??0,bb:p?.bb??0,ha:p?.hits??0,hra:p?.hr??0,era:p?.outs?era(p):null,whip:p?.outs?((p.hits+p.bb)*3/p.outs):null};});
 },[season,club,pitchers.join()]);
 const games=Math.max(1,season.day);
 const top=<T,>(list:T[],value:(r:T)=>number|null,low=false)=>list.filter(r=>value(r)!==null).sort((a,b)=>(low?1:-1)*((value(a) as number)-(value(b) as number)))[0];
 const batCols:Col<Bat>[]=[
  {key:'avg',label:'打率',value:r=>r.avg,show:r=>r.avg===null?'—':formatAvg(r.avg)},
  {key:'hr',label:'本塁打',value:r=>r.hr,show:r=>String(r.hr)},
  {key:'rbi',label:'打点',value:r=>r.rbi,show:r=>String(r.rbi)},
  {key:'ops',label:'OPS',value:r=>r.ops,show:r=>r.ops===null?'—':formatAvg(r.ops)},
  {key:'h',label:'安打',value:r=>r.h,show:r=>String(r.h)},
  {key:'d2',label:'二塁打',value:r=>r.d2,show:r=>String(r.d2)},
  {key:'d3',label:'三塁打',value:r=>r.d3,show:r=>String(r.d3)},
  {key:'sb',label:'盗塁',value:r=>r.sb,show:r=>String(r.sb)},
  {key:'bb',label:'四球',value:r=>r.bb,show:r=>String(r.bb)},
  {key:'so',label:'三振',value:r=>r.so,show:r=>String(r.so),low:true},
  {key:'games',label:'試合',value:r=>r.games,show:r=>String(r.games)},
  {key:'pa',label:'打席',value:r=>r.pa,show:r=>String(r.pa)},
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
  {key:'gs',label:'先発',value:r=>r.gs,show:r=>String(r.gs)},
  {key:'whip',label:'WHIP',value:r=>r.whip,show:r=>r.whip===null?'—':r.whip.toFixed(2),low:true},
  {key:'ha',label:'被安打',value:r=>r.ha,show:r=>String(r.ha),low:true},
  {key:'hra',label:'被本塁打',value:r=>r.hra,show:r=>String(r.hra),low:true},
  {key:'bb',label:'四球',value:r=>r.bb,show:r=>String(r.bb),low:true},
 ];
 const ordered=<T extends {id:string},>(list:T[],cols:Col<T>[],order:string[],used:(r:T)=>number)=>{
  let rows=list;
  if(!all)rows=order.length?list.filter(r=>order.includes(r.id)):[...list].sort((a,b)=>used(b)-used(a)).slice(0,view==='bat'?9:14);
  if(sort.key==='order')return [...rows].sort((a,b)=>{const x=order.indexOf(a.id),y=order.indexOf(b.id);return (x<0?99:x)-(y<0?99:y)||used(b)-used(a);});
  const col=cols.find(c=>c.key===sort.key)!;
  return [...rows].sort((a,b)=>{const x=col.value(a),y=col.value(b);if(x===null)return y===null?0:1;if(y===null)return -1;return sort.desc?y-x:x-y;});
 };
 const head=<T,>(cols:Col<T>[])=><tr><th className="pw-st-name"><button onClick={()=>setSort({key:'order',desc:false})} aria-pressed={sort.key==='order'}>{view==='bat'?'打順':'役割'}</button></th>{cols.map(c=><th key={c.key}><button aria-pressed={sort.key===c.key} onClick={()=>setSort(sort.key===c.key?{key:c.key,desc:!sort.desc}:{key:c.key,desc:!c.low})}>{c.label}{sort.key===c.key&&<i aria-hidden="true">{sort.desc?'▼':'▲'}</i>}</button></th>)}</tr>;
 const nameCell=(p:Player,tag:string)=><th className="pw-st-name"><button data-player-id={p.id} onClick={()=>onPlayer(p)}><i>{tag}</i><b>{p.name}</b></button></th>;
 const leader=(label:string,r:{p:Player}|undefined,shown:string)=><div className="pw-leader"><small>{label}</small><b>{r?shown:'—'}</b>{r&&<button onClick={()=>onPlayer(r.p)}>{r.p.name}</button>}</div>;
 const extra=view==='bat'?bats.length-(lineup.length||9):pits.length-(pitchers.length||14);
 if(view==='bat'){
  const q=bats.filter(b=>b.pa>=Math.max(1,Math.floor(games*3.1*.5)));
  const hrTop=top(bats,r=>r.hr),avgTop=top(q,r=>r.avg),rbiTop=top(bats,r=>r.rbi),opsTop=top(q,r=>r.ops);
  if(!bats.some(b=>b.pa))return <p className="pw-note">試合を進めると成績が表示されます。</p>;
  return <div className="pw-stats">
   <div className="pw-leaders">{leader('打率',avgTop,avgTop?.avg!=null?formatAvg(avgTop.avg):'—')}{leader('本塁打',hrTop,String(hrTop?.hr??0))}{leader('打点',rbiTop,String(rbiTop?.rbi??0))}{leader('OPS',opsTop,opsTop?.ops!=null?formatAvg(opsTop.ops):'—')}</div>
   <div className="pw-st-scroll"><table className="pw-st-table"><thead>{head(batCols)}</thead><tbody>{ordered(bats,batCols,lineup,r=>r.pa).map(r=>{const i=lineup.indexOf(r.id);return <tr key={r.id} className={i>=0?'is-starter':''}>{nameCell(r.p,i>=0?String(i+1):'控')}{batCols.map(c=><td key={c.key} className={c.key==='uzr'?(r.uzr!==null&&r.uzr>0?'is-plus':r.uzr!==null&&r.uzr<0?'is-minus':''):''}>{c.show(r)}</td>)}</tr>;})}</tbody></table></div>
   {extra>0&&<button className="pw-btn pw-white pw-mini pw-st-more" onClick={()=>setAll(v=>!v)}>{all?'スタメンだけにする':`ほかの選手も表示(${extra}人)`}</button>}
  </div>;
 }
 const q=pits.filter(p=>p.outs>=Math.max(3,Math.floor(games*.5*3)));
 const eraTop=top(q,r=>r.era,true),soTop=top(pits,r=>r.so),winTop=top(pits,r=>r.w),svTop=top(pits,r=>r.sv);
 if(!pits.some(p=>p.outs))return <p className="pw-note">試合を進めると成績が表示されます。</p>;
 const roleTag=(id:string)=>{const i=pitchers.indexOf(id);return i<0?'控':i<6?`先${i+1}`:i===13?'抑':'中';};
 return <div className="pw-stats">
  <div className="pw-leaders">{leader('防御率',eraTop,eraTop?.era!=null?eraTop.era.toFixed(2):'—')}{leader('勝利',winTop,String(winTop?.w??0))}{leader('奪三振',soTop,String(soTop?.so??0))}{leader('セーブ',svTop,String(svTop?.sv??0))}</div>
  <div className="pw-st-scroll"><table className="pw-st-table"><thead>{head(pitCols)}</thead><tbody>{ordered(pits,pitCols,pitchers,r=>r.outs).map(r=><tr key={r.id} className={pitchers.indexOf(r.id)>=0&&pitchers.indexOf(r.id)<6?'is-starter':''}>{nameCell(r.p,roleTag(r.id))}{pitCols.map(c=><td key={c.key}>{c.show(r)}</td>)}</tr>)}</tbody></table></div>
  {extra>0&&<button className="pw-btn pw-white pw-mini pw-st-more" onClick={()=>setAll(v=>!v)}>{all?'投手陣だけにする':`ほかの投手も表示(${extra}人)`}</button>}
 </div>;
}
