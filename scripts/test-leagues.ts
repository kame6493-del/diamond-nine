import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {players,playerMap} from '../src/pro/data';
import {initialState,initialSandboxState,emptySeason,simulateDays,validState,migrateState,nextSeason,type GameState,type Season} from '../src/pro/engine';
import {buildByStrategy} from '../src/pro/franchise';
import {finishPostseason,simulatePostseason,newPostseason,type Postseason} from '../src/pro/postseason';
import {leagueProgress,settleLeagueProgress,seasonGames,mlbSchedule,leagueTeams,playoffSeeds,wonNpbLeague} from '../src/pro/leagues';
import {mlbOpponentPlayers,mlbLeagueTeams} from '../src/pro/mlb-opponents';
import {SimpleSeason,SimpleStats,SimpleScout} from '../src/pro/SimpleApp';
import {PlayerDetails} from '../src/pro/PlayerDetails';
import {drawSimplePlayer} from '../src/pro/simple-game';

const leagueFinish=(number:number,winner='t'):Season=>{const season=emptySeason(number);return {...season,day:143,completed:true,standings:season.standings.map(t=>({...t,w:t.team===winner?95:65,l:t.team===winner?48:78}))};};
const loadedSquad=()=>{const base=initialState();return buildByStrategy({...base,owned:Object.fromEntries(players.map(p=>[p.id,1])),training:Object.fromEntries(players.map(p=>[p.id,5]))},'balanced');};
export function registerLeagueTests(test:(name:string,run:()=>void)=>void){
 test('three regular-season league titles unlock MLB before the playoffs, while losses and gaps break the streak',()=>{
  const base=initialState(),state={...base,season:leagueFinish(3),history:[2,1].map(n=>leagueFinish(n))};
  const snapshot=JSON.stringify(state);assert.deepEqual(leagueProgress(state),{basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:3});assert.equal(JSON.stringify(state),snapshot);
  const settled=settleLeagueProgress(state);assert.equal(settleLeagueProgress(settled),settled);
  const loss=leagueProgress({...state,season:leagueFinish(3,'g')});assert.equal(loss.npbStreak,0);assert.equal(loss.mlbUnlocked,false);
  const missing=leagueProgress({...state,history:[leagueFinish(1)]});assert.equal(missing.npbStreak,1);assert.equal(missing.mlbUnlocked,false);
  const partial=leagueProgress({...state,season:{...leagueFinish(3),day:142,completed:false}});assert.equal(partial.npbStreak,2);assert.equal(partial.mlbUnlocked,false);
  assert.equal(leagueProgress({...state,season:{...emptySeason(3),day:143,completed:true}}).mlbUnlocked,false);
  const later={...settled,season:leagueFinish(4,'g')};assert.equal(leagueProgress(later).npbStreak,0);assert.equal(leagueProgress(later).mlbUnlocked,true);
 });
 test('legacy Japan-Series streaks are rebuilt from regular-season standings and previously unlocked MLB access is kept',()=>{
  const base=initialState();
  for(const streak of [2,3,4,5]){
   const old={...base,season:emptySeason(9),leagueProgress:{npbStreak:streak,mlbUnlocked:streak===5,lastSettledSeason:8}};
   const next=migrateState(old)!;assert.ok(next);assert.equal(next.leagueProgress!.npbStreak,0);assert.equal(next.leagueProgress!.mlbUnlocked,streak===5);assert.equal(next.leagueProgress!.basis,'league');assert.deepEqual(migrateState(next),next);
   assert.deepEqual(next.owned,old.owned);assert.equal(next.gems,old.gems);assert.deepEqual(next.training,old.training);assert.deepEqual(next.season,old.season);
  }
  const archived={...base,season:emptySeason(9),history:[leagueFinish(8,'g'),leagueFinish(7),leagueFinish(6),leagueFinish(5)],leagueProgress:{npbStreak:0,mlbUnlocked:false,lastSettledSeason:8}};
  const restored=migrateState(archived)!;assert.equal(restored.leagueProgress!.mlbUnlocked,true);assert.equal(restored.leagueProgress!.npbStreak,0);assert.deepEqual(restored.history,archived.history);assert.deepEqual(migrateState(restored),restored);
  assert.equal(leagueProgress({...archived,history:[leagueFinish(8,'g'),leagueFinish(7),leagueFinish(5)]}).mlbUnlocked,false);
 });
 test('playoff elimination does not cancel league titles, and a Japan-Series title from second place does not count',()=>{
  const base=initialState(),history=[leagueFinish(2),leagueFinish(1)],third=leagueFinish(3);
  const regular={...base,season:third,history};
  const afterLoss={...regular,season:{...third,postseason:{stage:'complete',champion:'g'} as Postseason}};
  assert.deepEqual(leagueProgress(afterLoss),leagueProgress(regular));assert.equal(leagueProgress(afterLoss).mlbUnlocked,true);
  const japanWinner={...regular,season:{...leagueFinish(3,'g'),postseason:{stage:'complete',champion:'t'} as Postseason}};
  assert.equal(leagueProgress(japanWinner).mlbUnlocked,false);assert.equal(leagueProgress(japanWinner).npbStreak,0);
  const pacific=leagueFinish(3,'f');pacific.standings.find(t=>t.team==='t')!.w=110;pacific.standings.find(t=>t.team==='t')!.l=33;
  assert.equal(wonNpbLeague(pacific,'f'),true);assert.equal(wonNpbLeague(pacific,'h'),false);
  const partial={...third,day:142};assert.equal(wonNpbLeague(partial,'t'),false);
  assert.equal(wonNpbLeague({...third,standings:third.standings.map(t=>({...t,w:0,l:0,d:0}))},'t'),false);
 });
 test('MLB schedule contains 30 clubs, 162 games each, 81 home dates and every opponent',()=>{
  const schedule=mlbSchedule('t'),counts=new Map<string,{home:number;away:number;opponents:Set<string>}>();assert.equal(schedule.length,162);
  for(const day of schedule){assert.equal(day.length,15);assert.equal(new Set(day.flat()).size,30);for(const [home,away] of day){for(const [id,rival,side] of [[home,away,'home'],[away,home,'away']] as const){const row=counts.get(id)??{home:0,away:0,opponents:new Set<string>()};row[side]++;row.opponents.add(rival);counts.set(id,row);}}}
  assert.equal(counts.size,30);assert.ok(counts.has('t'));assert.ok(!counts.has('mlb-133'));for(const row of counts.values()){assert.equal(row.home,81);assert.equal(row.away,81);assert.equal(row.opponents.size,29);}
  assert.equal(mlbLeagueTeams.length,30);assert.ok(mlbOpponentPlayers.length>900);assert.ok(mlbOpponentPlayers.every(p=>!players.some(c=>c.id===p.id)));
  for(const team of mlbLeagueTeams){const pool=mlbOpponentPlayers.filter(p=>p.team===team.id);assert.ok(pool.filter(p=>p.role==='pitcher').length>=12);assert.ok(pool.filter(p=>p.role==='batter').length>=9);}
 });
 test('promotion happens only at the next season, keeps the squad and points, and survives save reload',()=>{
  const base=loadedSquad();base.seed=19017;
  const regular=simulateDays({...base,season:emptySeason(5),leagueProgress:{basis:'league',npbStreak:2,mlbUnlocked:false,lastSettledSeason:4}},143);
  assert.equal(wonNpbLeague(regular.season,base.club),true);assert.equal(regular.leagueProgress!.mlbUnlocked,true);assert.equal(regular.leagueProgress!.npbStreak,3);assert.equal(nextSeason(regular),regular);
  const done=simulatePostseason(regular,60);
  assert.deepEqual(done.leagueProgress,regular.leagueProgress);assert.ok(validState(done));assert.equal(done.season.circuit,undefined);
  const promoted=nextSeason(done);assert.equal(promoted.season.circuit,'MLB');assert.equal(promoted.season.day,0);assert.equal(promoted.season.number,6);assert.equal(seasonGames(promoted.season),162);
  assert.deepEqual(promoted.owned,done.owned);assert.deepEqual(promoted.training,done.training);assert.ok(promoted.gems>=done.gems);assert.deepEqual(promoted.history[0],done.season);assert.ok(validState(promoted));assert.deepEqual(migrateState(promoted),promoted);
  const archived=structuredClone(done);delete archived.leagueProgress;archived.history=[4,3,2,1].map(number=>({...structuredClone(done.season),number}));assert.equal(nextSeason(archived).season.circuit,'MLB');
 });
 test('MLB plays 162 games with conserved batting/pitching totals, actual steals and one-time rewards',()=>{
  // Use a fixed roster containing base stealers; a random weak starter roster
  // can legitimately finish with zero steals and cannot test their accounting.
  const base=initialSandboxState(),start={...base,seed:778811,season:emptySeason(6,'MLB',base.club),leagueProgress:{basis:'league' as const,npbStreak:3,mlbUnlocked:true,lastSettledSeason:5}};
  const daily=simulateDays(simulateDays(start,1),1),batch=simulateDays(start,2);assert.deepEqual(daily,batch);
  const end=simulateDays(start,162);assert.ok(validState(end));assert.equal(end.season.results.length,162);assert.equal(end.season.day,162);assert.ok(end.season.completed);assert.deepEqual(simulateDays(end,162),end);
  for(const t of end.season.standings){assert.equal(t.w+t.l+t.d,162);assert.equal(t.d,0);}
  const bats=Object.values(end.season.batting),pits=Object.values(end.season.pitching);
  for(const key of ['hits','hr','so'] as const)assert.equal(bats.reduce((n,b)=>n+b[key],0),pits.reduce((n,p)=>n+p[key],0));
  assert.equal(bats.reduce((n,b)=>n+b.pa,0),pits.reduce((n,p)=>n+p.bf,0));
  const mySteals=bats.filter(b=>b.team===base.club).reduce((n,b)=>n+b.sb,0);assert.ok(mySteals>0);assert.equal(mySteals,end.season.results.flatMap(g=>g.box!.batting).filter(b=>b.team===base.club).reduce((n,b)=>n+b.sb,0));
  assert.deepEqual(migrateState(end),end);
 });
 test('MLB playoffs use division winners and wild cards, then a valid 11-series bracket through the World Series',()=>{
  const base=initialState(),start={...base,seed:98763,season:emptySeason(6,'MLB',base.club),leagueProgress:{basis:'league' as const,npbStreak:3,mlbUnlocked:true,lastSettledSeason:5}};
  const regular=simulateDays(start,162),frozen=JSON.stringify(regular.season),seeds=playoffSeeds(regular.season,'AMERICAN');assert.equal(seeds.length,6);assert.equal(new Set(seeds.slice(0,3).map(s=>leagueTeams(regular.season).find(t=>t.id===s.team)!.division)).size,3);
  const bracket=newPostseason(regular.season);assert.equal(bracket.series.length,4);assert.equal(bracket.series[0].higher,seeds[2].team);assert.equal(bracket.series[0].lower,seeds[5].team);
  let oneDay=simulatePostseason(regular,1);assert.ok(validState(oneDay));assert.deepEqual(migrateState(oneDay),oneDay);
  const end=finishPostseason(oneDay),post=end.season.postseason!;assert.equal(post.stage,'complete');assert.equal(post.series.length,11);assert.ok(validState(end));assert.equal(post.series.find(s=>s.stage==='world')!.target,4);
  assert.deepEqual(finishPostseason(regular),end);assert.equal(finishPostseason(end),end);assert.equal(end.season.number,6);assert.equal(end.season.day,162);
  assert.deepEqual(end.season.pitching,regular.season.pitching);
  assert.equal(regular.franchise.tickets,start.franchise.tickets);assert.equal(end.franchise.tickets,start.franchise.tickets);
  assert.equal(JSON.stringify(regular.season),frozen);assert.deepEqual(end.season.batting,regular.season.batting);assert.deepEqual(simulatePostseason(end,60),end);
  const next=nextSeason(end);assert.equal(next.season.circuit,'MLB');assert.equal(next.season.number,7);assert.deepEqual(next.history[0],end.season);
  const corrupt=structuredClone(end);corrupt.season.postseason!.series[0].higher=corrupt.season.postseason!.series[0].lower;assert.equal(migrateState(corrupt),null);
  const early=structuredClone(oneDay);early.season.postseason!.rewardClaimed=true;assert.equal(migrateState(early),null);
  const locked={...start,leagueProgress:{...start.leagueProgress,mlbUnlocked:false}};assert.equal(validState(locked),false);
 });
 test('MLB is tougher than NPB and a deep awakened roster improves both wins and championship contention',()=>{
  const base=initialState(),full=loadedSquad();let weakNpb=0,weakMlb=0,strongMlb=0,qualified=0;
  const seeds=Array.from({length:6},(_,i)=>19017+i*98881);
  for(const seed of seeds){
   const npb=simulateDays({...base,seed},143);weakNpb+=npb.season.standings.find(t=>t.team===base.club)!.w/143;
   for(const [squad,strong] of [[base,false],[full,true]] as const){const end=simulatePostseason(simulateDays({...squad,seed,season:emptySeason(6,'MLB',base.club),leagueProgress:{basis:'league' as const,npbStreak:3,mlbUnlocked:true,lastSettledSeason:5}},162),60),wins=end.season.standings.find(t=>t.team===base.club)!.w/162;if(strong){strongMlb+=wins;qualified+=Number(end.season.postseason!.series.some(s=>s.higher===base.club||s.lower===base.club));}else weakMlb+=wins;}
  }
  // Realistic growth no longer turns every young card into an all-90s player.
  // A developed roster must improve wins and contend, not qualify in every seed.
  assert.ok(weakMlb<weakNpb);assert.ok((strongMlb-weakMlb)/seeds.length>.4);assert.ok(strongMlb/seeds.length>.52);assert.ok(qualified>=seeds.length/2);
 });
 test('season and player details show stolen bases, league promotion and World Series copy without new menus',()=>{
  const base=initialState(),state=simulateDays({...base,seed:91002},30),id=state.lineup[0];state.season.batting[state.club+'|'+id].sb=37;
  const html=renderToStaticMarkup(createElement(SimpleStats,{season:state.season,club:state.club,onPlayer:()=>{},lineup:state.lineup,pitchers:state.pitchers}));assert.ok(html.includes('<th>盗塁</th>'));assert.ok(html.includes('<td>37</td>'));
  const details=renderToStaticMarkup(createElement(PlayerDetails,{player:playerMap[id],state,onChange:()=>{},onAwaken:()=>{}}));assert.ok(details.includes('盗塁'));assert.ok(details.includes('<b>37</b>'));
  const render=(state:GameState)=>renderToStaticMarkup(createElement(SimpleSeason,{state,busy:false,progress:0,onPlay:()=>{},onPost:()=>{},onNext:()=>{},onPlayer:()=>{},message:''}));
  for(const text of ['aria-label="リーグ挑戦"','LEAGUE 01','国内リーグ · リーグ優勝3連覇への道','リーグ優勝の連覇','リーグ1位を3年連続'])assert.ok(!render(base).includes(text));
  const firstTitle={...base,season:leagueFinish(1)};
  assert.ok(!render({...firstTitle,season:{...firstTitle.season,day:142,completed:false}}).includes('リーグ優勝3連覇への道'));
  assert.ok(render(firstTitle).includes('国内リーグ · リーグ優勝3連覇への道'));assert.ok(render(firstTitle).includes('aria-valuenow="1"'));
  const retained={...base,season:emptySeason(12),achievements:{npbLeague:1},leagueProgress:{basis:'league' as const,npbStreak:0,mlbUnlocked:false,lastSettledSeason:11}};
  assert.ok(render(retained).includes('リーグ優勝3連覇への道'));assert.ok(render(migrateState(retained)!).includes('リーグ優勝3連覇への道'));
  const legacy={...base,season:emptySeason(3),history:[leagueFinish(2,'g'),leagueFinish(1)]};assert.ok(render(legacy).includes('リーグ優勝3連覇への道'));
  assert.ok(render({...base,season:emptySeason(6,'MLB',base.club)}).includes('世界王座決定戦'));assert.ok(render({...base,season:emptySeason(6,'MLB',base.club)}).includes('162'));
  const result=drawSimplePlayer({...base,gems:3000}),opening=renderToStaticMarkup(createElement(SimpleScout,{state:result,drawing:true,hasDrawn:true,onDraw:()=>{},onEquip:()=>{},onSeason:()=>{}}));assert.ok(opening.includes('neon-pack'));assert.ok(opening.includes('スカウト演出中'));for(const text of ['次の主役','新たな物語','次の仲間を、一人ずつ'])assert.ok(!opening.includes(text));
 });
}
