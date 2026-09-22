import {ageBands,cardTeams,type CardFilters as Filters} from './player-browser';

export function CardFilterControls({prefix,value,onChange,circuit}:{prefix:string;value:Filters;onChange:(value:Filters)=>void;circuit?:'NPB'|'MLB'}){
 return <div className="card-filter-controls">
  <select aria-label={`${prefix}の並べ替え`} value={value.sort} onChange={e=>onChange({...value,sort:e.target.value as Filters['sort']})}>
   <option value="overall-desc">総合値が高い順</option><option value="overall-asc">総合値が低い順</option><option value="age-asc">年齢が若い順</option><option value="age-desc">年齢が高い順</option><option value="team">球団順</option><option value="name">名前順</option>
  </select>
  <select aria-label={`${prefix}の種類`} value={value.role} onChange={e=>onChange({...value,role:e.target.value})}><option value="all">野手・投手すべて</option><option value="batter">野手</option><option value="pitcher">投手</option></select>
  <select aria-label={`${prefix}の年齢帯`} value={value.age} onChange={e=>onChange({...value,age:e.target.value})}>{ageBands.map(b=><option key={b.value} value={b.value}>{b.label}</option>)}</select>
  <select aria-label={`${prefix}の球団`} value={value.team} onChange={e=>onChange({...value,team:e.target.value})}>
   <option value="all">全球団</option>{!circuit&&<option value="mlb">MLB選手すべて</option>}
   {circuit!=='MLB'&&<optgroup label="NPB">{cardTeams.npb.map(t=><option key={t.id} value={t.id}>{t.short}</option>)}</optgroup>}
   {circuit!=='NPB'&&<optgroup label="MLB">{cardTeams.mlb.map(t=><option key={t.id} value={t.id}>{t.short}</option>)}</optgroup>}
  </select>
 </div>;
}
