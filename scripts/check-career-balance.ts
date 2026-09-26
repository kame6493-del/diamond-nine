import { players,rosterSlots,fitsPosition,playerMap } from '../src/pro/data';
import { initialState,simulateDays } from '../src/pro/engine';
for(const slot of [...new Set(rosterSlots)]) console.log(slot,players.filter(p=>p.role==='batter'&&p.rarity==='R'&&!p.provisional&&fitsPosition(p,slot)).sort((a,b)=>a.overall-b.overall).slice(0,3).map(p=>[p.name,p.overall]));
for(const rarity of ['R','SR','SSR','UR']){const values=players.filter(p=>p.role==='batter'&&p.rarity===rarity).map(p=>p.overall).sort((a,b)=>a-b);console.log(rarity,'bat OVR min/median/max',values[0],values[Math.floor(values.length/2)],values.at(-1));}
const s=initialState();console.log('starters',s.lineup.map(id=>[playerMap[id].name,playerMap[id].overall]));
for(const seed of [99,2345,9876]){const season=simulateDays({...s,seed},143);console.log('initial 143 games',seed,season.season.standings.find(row=>row.team===s.club));}
