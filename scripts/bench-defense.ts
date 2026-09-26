import assert from 'node:assert/strict';
import {playerMap,type Player} from '../src/pro/data';
import {initialSandboxState,simulateDays,emptySeason,defenseAdjustment} from '../src/pro/engine';

// Isolate fielding from contact, power, throwing, pitchers and the opposition.
// Temporary test identities prevent changes to a card from affecting rivals
// who happen to field the same real player. Nothing touches browser saves.
export function checkDefenseImpact(){
 const source=initialSandboxState(),state=structuredClone(source);
 const clones=source.lineup.map((id,i):Player=>({...structuredClone(playerMap[id]),id:`defense-check-${i}`}));
 state.lineup=clones.map(p=>p.id);state.defense=Object.fromEntries(clones.map((p,i)=>[p.id,source.defense[source.lineup[i]]]));
 state.owned=Object.fromEntries([...state.lineup,...state.pitchers].map(id=>[id,1]));state.training={};
 const seeds=[70123,180019,452831,811753],rows=[];
 try{
  for(const field of [35,85]){
   for(const p of clones)playerMap[p.id]={...p,ratings:{...p.ratings,...(state.defense[p.id]!=='DH'?{field}: {})}};
   const adjustment=defenseAdjustment(state.lineup,state.defense,state.owned,state.training);
   let runs=0,hits=0,er=0,outs=0,wins=0;
   for(const seed of seeds){
    const end=simulateDays({...state,seed,season:emptySeason()},143),mine=end.season.standings.find(t=>t.team===state.club)!;
    runs+=mine.ra;wins+=mine.w;
    for(const p of Object.values(end.season.pitching).filter(p=>p.team===state.club)){hits+=p.hits;er+=p.er;outs+=p.outs;}
   }
   rows.push({field,adjustment,seasons:seeds.length,runsAllowed:runs/seeds.length,hitsAllowed:hits/seeds.length,era:Math.round(er*27/outs*100)/100,wins:wins/seeds.length});
  }
  assert.ok(rows[1].adjustment>rows[0].adjustment);
  assert.ok(rows[1].runsAllowed<rows[0].runsAllowed*.9,'Stronger fielding should reduce season runs allowed');
  assert.ok(rows[1].hitsAllowed<rows[0].hitsAllowed,'Stronger fielding should prevent hits');
  assert.ok(rows[1].era<rows[0].era,'Fielding should affect the resulting pitcher ERA');
  assert.ok(rows[1].wins>rows[0].wins,'Defensive run prevention should improve team results');
  return rows;
 }finally{for(const p of clones)delete playerMap[p.id];}
}

console.log(JSON.stringify(checkDefenseImpact(),null,2));
