import {canBat,matchesPlayerName,players,teams,type Player} from './data';
import {mlbTeams} from './mlb-players';
import {playerAge} from './development';
import {effectiveOverall,type GameState} from './engine';

export const ageBands=[
 {value:'all',label:'全年齢',min:0,max:Infinity},
 {value:'under18',label:'17歳以下',min:0,max:17},
 {value:'18-24',label:'18〜24歳',min:18,max:24},
 {value:'25-29',label:'25〜29歳',min:25,max:29},
 {value:'30-34',label:'30〜34歳',min:30,max:34},
 {value:'35plus',label:'35歳以上',min:35,max:Infinity},
] as const;
export const cardTeams={npb:teams,mlb:mlbTeams.filter(t=>players.some(p=>p.mlb&&p.team===t.id))};
export type CardSort='overall-desc'|'overall-asc'|'age-asc'|'age-desc'|'team'|'name';
export interface CardFilters {search:string;team:string;age:string;role:string;sort:CardSort}
export const defaultCardFilters:CardFilters={search:'',team:'all',age:'all',role:'all',sort:'overall-desc'};
export type CollectionFilter='all'|'owned'|'missing';
export function collectionProgress(pool:readonly Player[],owned:Record<string,number>){
 const total=pool.length,collected=pool.filter(p=>(owned[p.id]??0)>0).length;
 return {total,collected,complete:total>0&&collected===total};
}
export function browseCatalogCards(pool:readonly Player[],owned:Record<string,number>,options:CardFilters,collection:CollectionFilter='all'){
 const cards=pool.filter(p=>collection==='all'||(collection==='owned')===((owned[p.id]??0)>0));
 // Catalog sorting must not reveal the owner's awakening or duplicate bonuses.
 return browseCards(cards,{owned:{},training:{}},options);
}
const teamOrder=new Map([...cardTeams.npb,...cardTeams.mlb].map((t,i)=>[t.id,i]));

export function browseCards(pool:readonly Player[],state:Pick<GameState,'owned'|'training'>,options:CardFilters):Player[]{
 const band=ageBands.find(b=>b.value===options.age)??ageBands[0];
 const rows=pool.filter(p=>!p.opponentOnly&&matchesPlayerName(p,options.search)
  &&(options.team==='all'||(options.team==='mlb'?!!p.mlb:p.team===options.team))
  &&(options.role==='all'||(options.role==='batter'?canBat(p):p.role==='pitcher')))
  .map(p=>({p,age:playerAge(p),overall:effectiveOverall(p,state.owned,state.training)}))
  .filter(r=>band.value==='all'||r.age!==null&&r.age>=band.min&&r.age<=band.max);
 rows.sort((a,b)=>{
  let difference=0;
  if(options.sort.startsWith('age-'))difference=a.age===null?b.age===null?0:1:b.age===null?-1:(options.sort==='age-asc'?1:-1)*(a.age-b.age);
  else if(options.sort==='team')difference=(teamOrder.get(a.p.team)??999)-(teamOrder.get(b.p.team)??999);
  else if(options.sort==='name')difference=a.p.name.localeCompare(b.p.name,'ja');
  else difference=(options.sort==='overall-asc'?1:-1)*(a.overall-b.overall);
  return difference||b.overall-a.overall||a.p.name.localeCompare(b.p.name,'ja')||a.p.id.localeCompare(b.p.id);
 });
 return rows.map(r=>r.p);
}
