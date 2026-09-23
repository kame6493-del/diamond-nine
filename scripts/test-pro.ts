import {registerLeagueTests} from './test-leagues';
import {registerJourneyTests} from './test-journey';
import {registerTitleCelebrationTests} from './test-title-celebration';
import {registerCatalogTests} from './test-catalog';
import {registerGrowthTests} from './test-growth';
import {registerVictoryShareTests} from './test-victory-share';
import {registerTeamStatsTests} from './test-team-stats';
import {registerFieldingStatsTests} from './test-fielding-stats';
import {registerLeagueStatsTests} from './test-league-stats';
import {registerNpbDifficultyTests} from './test-npb-difficulty';
import {registerMlbDifficultyTests} from './test-mlb-difficulty';
import {registerDisplayNameTests} from './test-display-names';
import {registerStarterScoutTests} from './test-starter-scout';
import {registerPositionDefenseTests} from './test-position-defense';
import {gameReward,seasonReward,postseasonReward} from '../src/pro/progression';
import {awakeningCosts} from '../src/pro/development';
import {registerBalanceTests} from './test-balance';
import {registerMLBTests} from './test-mlb';
import {registerDevelopmentTests} from './test-development';
import { simulatePostseason,finalFormat,newPostseason,seriesWinner } from '../src/pro/postseason';
import { registerCareerTests } from './test-career';
import { registerMatchupTests } from './test-matchup';
import { registerWikiTests } from './test-wiki';
import { registerManagerTests } from './test-manager';
import { registerSimpleTests } from './test-simple';
import { registerArcadeTests } from './test-arcade';
import { seasonConditions } from '../src/pro/conditions';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { CardAbilities } from '../src/pro/CardAbilities';
import { assessHandling,assessUZR,formatFieldInnings } from '../src/pro/defense';
import assert from 'node:assert/strict';
import { players,npbPlayers,teams,playerMap,findPlayer,contexts,sourceInfo,deltaInfo,uzrInfo,uzrCoverage,rosterInfo,rosterCoverage,canBat,autoLineup,autoPitchers,activeUzrCount } from '../src/pro/data';
import { redeemURTicket,drawPlayers,initialSandboxState as initialState,nextSeason,simulateDays,schedule,validState,migrateState,rankings,rng,scoutWeight,effectiveOverall,defenseAdjustment } from '../src/pro/engine';
import { battingMetrics,fip,leagueContext } from '../src/pro/sabermetrics';
import { establishClub,trainPlayer,claimAllMilestones,claimMilestone,upgradeStadium,buildByStrategy,captainPool } from '../src/pro/franchise';

const tests:{name:string;run:()=>void}[]=[];
const test=(name:string,run:()=>void)=>tests.push({name,run});
test('all 1067 affiliated players have bounded ratings and official roles',()=>{
 assert.equal(npbPlayers.length,1067);assert.equal(players.length,1082);assert.equal(teams.length,12);assert.equal(new Set(players.map(p=>p.id)).size,1082);assert.equal(sourceInfo.asOf,'2026-09-20');
 assert.ok(npbPlayers.every(p=>(p.role==='pitcher')===(p.roster?.registeredPosition==='投手')));
 assert.ok(findPlayer('伊藤大海'));assert.ok(findPlayer('佐藤輝明'));
 for(const p of players)for(const [key,value] of Object.entries(p.ratings))assert.ok(Number.isFinite(value)&&value>=0&&value<=(key==='velocity'?165:99),`${p.name} ${key}`);
});
test('143 dates, all teams once per date, 25 domestic and 3 interleague meetings',()=>{
 assert.equal(schedule.length,143);const meetings=new Map<string,number>();
 for(const day of schedule){assert.equal(day.length,6);assert.equal(new Set(day.flat()).size,12);for(const pair of day){const key=[...pair].sort().join(':');meetings.set(key,(meetings.get(key)??0)+1);}}
 for(let a=0;a<12;a++)for(let b=a+1;b<12;b++){const key=[teams[a].id,teams[b].id].sort().join(':');assert.equal(meetings.get(key),teams[a].league===teams[b].league?25:3,key);}
});
const initial=initialState();initial.seed=12345;
test('valid starter roster and saved-state guards',()=>{
 assert.equal(Object.keys(initial.owned).length,24);assert.equal(initial.lineup.length,9);assert.equal(initial.pitchers.length,12);assert.ok(validState(initial));
 assert.equal(validState({...initial,gems:NaN}),false);assert.equal(validState({...initial,lineup:[]}),false);assert.equal(validState({...initial,pity:50}),false);assert.equal(validState({...initial,owned:{bad:2}}),false);
});
let season=simulateDays(initial,143);
test('full season accounting: wins, runs, hits, earned runs and plate appearances',()=>{
 assert.equal(season.season.day,143);assert.ok(season.season.completed);assert.equal(season.season.results.length,143);assert.ok(validState(season));
 for(const row of season.season.standings){
  assert.equal(row.w+row.l+row.d,143,row.team);
  const bat=Object.values(season.season.batting).filter(s=>s.team===row.team);const pit=Object.values(season.season.pitching).filter(s=>s.team===row.team);
  assert.equal(bat.reduce((a,b)=>a+b.runs,0),row.rf,`${row.team} scored runs`);
  assert.ok(bat.reduce((a,b)=>a+b.rbi,0)<=row.rf,`${row.team} error runs must not create RBI`);
  assert.ok(pit.reduce((a,b)=>a+b.er,0)<=row.ra,`${row.team} earned runs cannot exceed runs allowed`);
  assert.equal(pit.reduce((a,b)=>a+b.wins,0),row.w,`${row.team} pitcher wins`);
  assert.equal(pit.reduce((a,b)=>a+b.losses,0),row.l,`${row.team} pitcher losses`);
  assert.equal(bat.reduce((a,b)=>a+b.games,0),143*9,`${row.team} batter games`);
 }
 const bat=Object.values(season.season.batting),pit=Object.values(season.season.pitching);
 assert.equal(bat.reduce((a,b)=>a+b.hits,0),pit.reduce((a,b)=>a+b.hits,0));
 assert.equal(bat.reduce((a,b)=>a+b.bb,0),pit.reduce((a,b)=>a+b.bb,0));
 assert.equal(bat.reduce((a,b)=>a+b.so,0),pit.reduce((a,b)=>a+b.so,0));
 assert.equal(bat.reduce((n,b)=>n+b.pa,0),pit.reduce((n,p)=>n+p.bf,0));
 assert.equal(bat.reduce((n,b)=>n+b.hr,0),pit.reduce((n,p)=>n+p.hr,0));
 assert.equal(bat.reduce((n,b)=>n+b.hbp,0),pit.reduce((n,p)=>n+p.hbp,0));
 for(const b of bat){assert.equal(b.pa,b.ab+b.bb+b.hbp+b.sf);assert.ok(b.hits<=b.ab);assert.ok(b.hr+b.doubles+b.triples<=b.hits);}
 const total=season.season.standings;assert.equal(total.reduce((s,t)=>s+t.w,0),total.reduce((s,t)=>s+t.l,0));
 for(const result of season.season.results){assert.equal(result.line[0].reduce((a,b)=>a+Math.max(0,b),0),result.awayRuns);assert.equal(result.line[1].reduce((a,b)=>a+Math.max(0,b),0),result.homeRuns);assert.ok(result.innings>=9&&result.innings<=12);}
});
test('single-day and batch simulations give identical results, no repeated finish reward',()=>{
 let daily=initial;for(let i=0;i<143;i++)daily=simulateDays(daily,1);assert.deepEqual(daily,season);
 assert.equal(season.gems,initial.gems+season.season.results.reduce((sum,g)=>sum+gameReward(initial,g),0)+seasonReward(initial));assert.deepEqual(simulateDays(season,143),season);
 assert.equal(initial.season.day,0);assert.equal(initial.gems,15600);
});
test('next season preserves collection and keeps exact historical record',()=>{
 assert.equal(nextSeason(season),season);const finished=simulatePostseason(season,60);const next=nextSeason(finished);assert.equal(next.season.number,2);assert.equal(next.season.day,0);assert.deepEqual(next.history[0],finished.season);assert.deepEqual(next.owned,season.owned);assert.equal(next.gems,finished.gems);assert.ok(validState(next));assert.deepEqual(nextSeason(initial),initial);
});
test('batting-order moves preserve defensive assignments and relief usage is distributed',()=>{
 const reordered={...initial,lineup:[...initial.lineup]};[reordered.lineup[0],reordered.lineup[1]]=[reordered.lineup[1],reordered.lineup[0]];
 assert.equal(reordered.defense[findPlayer('近本光司').id],'外');assert.equal(reordered.defense[findPlayer('中野拓夢').id],'二');assert.ok(validState(reordered));
 const relief=initial.pitchers.slice(6).map(id=>season.season.pitching[`${initial.club}|${id}`]);assert.ok(relief.every(p=>p.games>20&&p.games<110));
 const fast=season.season.batting[`${initial.club}|${findPlayer('近本光司').id}`];assert.ok(fast.sb>=10&&fast.sb<=65,`Fast runner stolen bases: ${fast.sb}`);
});
test('scout costs, fixed ten-pull floor, UR pity and repeated-player ownership',()=>{
 let s={...initial,gems:1_000_000};let ur=0;let prevCopies=Object.values(s.owned).reduce((a,b)=>a+b,0);
 for(let i=0;i<100;i++){const before=s;s=drawPlayers(s,10);assert.equal(s.gems,before.gems-2700+s.lastPulls.reduce((sum,p)=>sum+(p.trainingReward??0),0));assert.equal(s.lastPulls.length,10);assert.ok(s.lastPulls.some(p=>playerMap[p.playerId].rarity!=='R'));assert.ok(s.pity<50);ur+=s.lastPulls.filter(p=>playerMap[p.playerId].rarity==='UR').length;}
 assert.equal(Object.values(s.owned).reduce((a,b)=>a+b,0),prevCopies+1000);assert.ok(ur>=20);assert.ok(validState(s));
 const pity=drawPlayers({...initial,pity:49},1);assert.equal(playerMap[pity.lastPulls[0].playerId].rarity,'UR');assert.equal(pity.pity,0);assert.equal(pity.lastPulls[0].guaranteed,true);
 const poor={...initial,gems:1};assert.deepEqual(drawPlayers(poor,10),poor);
 const random=rng(8);assert.notEqual(random.next(),random.next());
});
test('sabermetric denominators, missing samples, and league FIP calibration',()=>{
 const b=battingMetrics({ab:100,pa:117,hits:30,doubles:6,triples:1,hr:4,bb:10,hbp:2,sf:5,so:20});
 assert.equal(b.obp,42/117);assert.equal(b.iso,.2);assert.equal(b.babip,26/81);assert.equal(b.bbPct,10/117);
 assert.equal(fip({outs:0,hr:0,bb:0,hbp:0,so:0},3),null);
 assert.equal(fip({outs:270,hr:10,bb:20,hbp:2,so:100},3),3-4/90);
 for(const league of Object.values(contexts))assert.ok(Math.abs(league.pitching.fip!-league.pitching.era!)<1e-10);
 const context=leagueContext(Object.values(season.season.pitching).map(p=>({pitching:p})));
 assert.ok(Math.abs(context.pitching.fip!-context.pitching.era!)<1e-10);
 assert.equal(Object.values(playerMap).filter(p=>p.uzr!==null).length,314);assert.equal(deltaInfo.asOf,null);
 assert.equal(findPlayer('小川龍成').uzr,17.8);assert.equal(findPlayer('大山悠輔').uzr,-7.1);assert.equal(findPlayer('大山悠輔').ratings.field,50);
 assert.equal(findPlayer('佐藤輝明').batting?.hr,35);assert.equal(findPlayer('佐藤輝明').batting?.pa,559);
});
test('club founding, training, stadium, strategy and rewards are persistent and bounded',()=>{
 const captain=captainPool()[0],count=initial.owned[captain.id]??0;
 const s=establishClub(initial,{city:'横浜',mark:'⚡',color:'#ae86ff',motto:'ここから頂点へ。'},'横浜サンダーズ',captain.id);
 assert.ok(validState(s));assert.equal(s.name,'横浜サンダーズ');assert.equal(s.owned[captain.id],count+1);assert.equal(s.gems,initial.gems+2700);
 const edit=establishClub(s,{city:'東京',mark:'D',color:'#73b5ff',motto:'黄金時代へ。'},'ダイヤモンズ',captain.id);assert.equal(edit.gems,s.gems);assert.deepEqual(edit.owned,s.owned);
 let trained={...s,gems:awakeningCosts.reduce((total,cost)=>total+cost,0)+8000};const id=s.lineup[0],before=structuredClone(playerMap[id]);
 for(let i=0;i<8;i++)trained=trainPlayer(trained,id);
 assert.equal(trained.training[id],5);assert.equal(trained.gems,8000);assert.deepEqual(playerMap[id],before);assert.ok(effectiveOverall(playerMap[id],trained.owned,trained.training)>effectiveOverall(playerMap[id],trained.owned));
 const claimed=claimMilestone(s,'club');assert.equal(claimed.gems,s.gems+100);assert.deepEqual(claimMilestone(claimed,'club'),claimed);assert.deepEqual(claimMilestone(s,'finish'),s);
 const upgraded=upgradeStadium(trained);assert.equal(upgraded.franchise.stadium,2);assert.equal(upgraded.gems,7300);
 const game=simulateDays(upgraded,1);assert.equal(game.gems,upgraded.gems+gameReward(upgraded,game.season.results[0]));
 for(const strategy of ['balanced','onbase','power','defense'] as const)assert.ok(validState(buildByStrategy(trained,strategy)));
 assert.equal(initial.franchise.established,false);
});
test('old saved games migrate without losing collection, currency or seasons',()=>{
 const old=structuredClone(season) as unknown as Record<string,any>;delete old.franchise;delete old.training;delete old.season.model;
 for(const p of Object.values(old.season.pitching) as any[]){delete p.hr;delete p.hbp;delete p.bf;}
 for(const p of Object.values(old.season.batting) as any[]){delete p.hbp;delete p.sf;}
 const legacy=Object.values(playerMap).find(p=>p.dataYear===2025)!;old.owned[legacy.id]=3;
 const migrated=migrateState(old);assert.ok(migrated);assert.equal(migrated.season.day,143);assert.equal(migrated.gems,season.gems);assert.equal(migrated.owned[legacy.id],3);assert.equal(migrated.season.model,'2025-basic');assert.equal(nextSeason(simulatePostseason(migrated,60)).season.model,'2026-dips');
 assert.equal(migrateState({...initial,training:{[initial.lineup[0]]:-1}}),null);
});
test('UZR defense excludes DH, penalizes unfamiliar positions and uses training',()=>{
 const glove=findPlayer('源田壮亮'),neutral=findPlayer('大山悠輔');
 assert.ok(defenseAdjustment([glove.id],{[glove.id]:'遊'})>0);
 assert.ok(defenseAdjustment([glove.id],{[glove.id]:'捕'})<defenseAdjustment([glove.id],{[glove.id]:'遊'}));
 assert.equal(defenseAdjustment([neutral.id],{[neutral.id]:'一'}),defenseAdjustment([neutral.id,glove.id],{[neutral.id]:'一',[glove.id]:'DH'}));
 assert.ok(defenseAdjustment([neutral.id],{[neutral.id]:'一'},{},{[neutral.id]:5})>defenseAdjustment([neutral.id],{[neutral.id]:'一'}));
});
test('theme scouts preserve rarity floors, pity and exactly published weights',()=>{
 assert.equal(scoutWeight(findPlayer('佐藤輝明'),'power'),3);assert.equal(scoutWeight(findPlayer('小川龍成'),'defense'),3);assert.equal(scoutWeight(findPlayer('大山悠輔'),'defense'),1);
 for(const focus of ['all','power','pitching','defense'] as const){const s=drawPlayers({...initial,pity:49},10,focus);assert.equal(s.lastPulls.length,10);assert.equal(playerMap[s.lastPulls[0].playerId].rarity,'UR');assert.ok(s.lastPulls.every(p=>playerMap[p.playerId].dataYear===2026));assert.ok(validState(s));}
});
test('defense handling uses positional priors without inventing range',()=>{
 const row=(errors:number,chances:number)=>({position:'遊',games:60,putouts:chances-errors,assists:0,errors,pct:1-errors/chances});
 const peers=[row(20,1000)];
 assert.equal(assessHandling(undefined,peers).handling,60);
 assert.equal(assessHandling(undefined,peers).fieldingPct,null);
 assert.ok(assessHandling(row(0,500),peers).handling>assessHandling(row(0,1),peers).handling);
 assert.ok(assessHandling(row(20,100),peers).handling<60);
 assert.equal(assessHandling(row(0,0),[]).handling,60);
 for(const p of players.filter(p=>!p.wikiAssessment&&!p.mlb)){assert.ok(p.ratings.catching>=40&&p.ratings.catching<=85);if(p.uzr===null)assert.equal(p.ratings.field,60);}
});
test('UR tickets are guaranteed, preserve pity and currency, and migrate once',()=>{
 assert.equal(initial.franchise.tickets,1);
 const spent=redeemURTicket(initial);
 assert.equal(spent.franchise.tickets,0);assert.equal(playerMap[spent.lastPulls[0].playerId].rarity,'UR');
 assert.equal(spent.gems,initial.gems);assert.equal(spent.pity,initial.pity);assert.equal(spent.pulls,initial.pulls);
 assert.equal(Object.values(spent.owned).reduce((a,b)=>a+b,0),Object.values(initial.owned).reduce((a,b)=>a+b,0)+1);
 assert.deepEqual(redeemURTicket(spent),spent);assert.ok(validState(spent));
 assert.equal(migrateState(spent)?.franchise.tickets,0);
 const old=structuredClone(initial) as any;delete old.franchise.tickets;
 const migrated=migrateState(old)!;assert.equal(migrated.franchise.tickets,1);assert.equal(migrateState(migrated)?.franchise.tickets,1);
 assert.equal(migrateState({...initial,franchise:{...initial.franchise,tickets:-1}}),null);
 assert.equal(migrateState({...initial,franchise:{...initial.franchise,tickets:1.5}}),null);
 assert.equal(season.franchise.tickets,initial.franchise.tickets);
 assert.equal(simulateDays(season,143).franchise.tickets,season.franchise.tickets);
});
test('bulk mission rewards match individual claims and cannot repeat',()=>{
 const all=claimAllMilestones(season);
 const individual=claimMilestone(claimMilestone(claimMilestone(season,'thirty'),'finish'),'wins');
 assert.deepEqual(all,individual);assert.deepEqual(claimAllMilestones(all),all);assert.ok(validState(all));
});
test('screenshot UZR keeps provenance, negative values, missing rows and team identity',()=>{
 assert.equal(uzrInfo.asOf,'2026-09-21');assert.equal(uzrInfo.entries.length,319);
 assert.deepEqual(uzrCoverage,{numeric:314,explicitMissing:5,unmatched:0});
 assert.equal(new Set(uzrInfo.entries.map(r=>r.rank)).size,319);
 assert.equal(new Set(uzrInfo.entries.filter(r=>r.playerId).map(r=>r.playerId)).size,319);
 for(const r of uzrInfo.entries){assert.ok(Number.isInteger(r.outs)&&r.outs>=0);assert.ok(uzrInfo.sources.some(s=>s.file===r.sourceFile));if(r.playerId){assert.ok(playerMap[r.playerId]);assert.equal(playerMap[r.playerId].team,r.team);assert.equal(playerMap[r.playerId].uzr,r.uzr);}}
 for(const [name,uzr,outs] of [['小川龍成',17.8,3142],['近本光司',2.3,2110],['佐藤輝明',-2,3513],['森下翔太',-2.5,3429],['大山悠輔',-7.1,3426],['中野拓夢',-7.5,3141],['牧秀悟',-4.5,2521]] as const){const p=findPlayer(name);assert.equal(p.uzr,uzr);assert.equal(p.uzrRecord?.outs,outs);}
 assert.equal(findPlayer('平内龍太').uzr,null);assert.ok(findPlayer('平内龍太').uzrRecord);
 assert.equal(findPlayer('山本大斗').uzr,-2.7);assert.equal(uzrInfo.entries.find(r=>r.rank===609)?.playerId,'m-山本大斗');assert.equal(findPlayer('山本大斗').uzrRecord?.outs,867);
 assert.equal(findPlayer('佐々木泰').uzr,null); // Not in the images; do not mix the older public leaderboard.
 assert.equal(findPlayer('田中幹也').uzr,5.9);assert.equal(findPlayer('岩田幸宏').uzr,4.9);
 assert.equal(findPlayer('持丸泰輝').uzrRecord?.outs,2060);assert.equal(findPlayer('小川泰弘').uzrRecord?.outs,123);assert.equal(findPlayer('宮本丈').uzrRecord?.outs,254);assert.equal(findPlayer('堀田賢慎').uzr,.6);assert.equal(findPlayer('増田陸').uzr,.4);
 assert.equal(findPlayer('下村海翔').uzr,.3);assert.equal(findPlayer('村上頌樹').uzr,null);
 assert.equal(formatFieldInnings(3142),'1047 1/3');assert.equal(formatFieldInnings(2249),'749 2/3');
 assert.equal(findPlayer('佐藤輝明').rarity,'UR');assert.equal(findPlayer('森下翔太').rarity,'UR');assert.equal(findPlayer('大山悠輔').rarity,'SSR');
});
test('UZR rating is exposure-adjusted, finite and keeps source figures untouched',()=>{
 assert.equal(assessUZR(null).rating,60);assert.equal(assessUZR({uzr:null,outs:30}).rating,60);
 assert.equal(assessUZR({uzr:0,outs:3000}).rating,60);
 const short=assessUZR({uzr:.4,outs:15}),long=assessUZR({uzr:80,outs:3000});
 assert.ok(short.per1200!>90);assert.ok(short.rating<70);assert.ok(long.rating>short.rating);
 assert.ok(assessUZR({uzr:-.4,outs:15}).rating>50);
 assert.equal(assessUZR({uzr:999,outs:3}).rating,99);assert.equal(assessUZR({uzr:-999,outs:3}).rating,15);
 const before=structuredClone(uzrInfo);const p=findPlayer('近本光司');
 const trained=trainPlayer(initial,p.id);simulateDays(trained,1);assert.equal(p.uzr,2.3);assert.deepEqual(uzrInfo,before);
 assert.ok(findPlayer('源田壮亮').ratings.field>findPlayer('大山悠輔').ratings.field);
});

test('official roster covers every team including developmental players, excluding departures',()=>{
 assert.deepEqual(rosterCoverage,{total:1067,registered:836,developmental:231,added:343});
 assert.equal(rosterInfo.asOf,'2026-09-20');assert.equal(rosterInfo.sources.length,12);
 for(const source of rosterInfo.sources){
  const team=teams.find(t=>source.url.endsWith('rst_'+t.id+'.html'))!;
  const pool=players.filter(p=>p.team===team.id);
  assert.equal(pool.length,source.count,team.name);
  assert.equal(pool.filter(p=>p.roster?.registration==='registered').length,source.registered);
  assert.equal(pool.filter(p=>p.roster?.registration==='developmental').length,source.developmental);
  assert.equal(source.farmAsOf,'2026-09-20');
 }
 assert.equal(findPlayer('小川一平').roster?.number,'122');
 assert.equal(findPlayer('西純矢').role,'batter');assert.ok(findPlayer('西純矢').positions.includes('外'));
 assert.equal(findPlayer('岩貞祐太').role,'pitcher');assert.equal(findPlayer('石川雅規').role,'pitcher');
 assert.equal(findPlayer('戸井零士').positionSource,'wiki');assert.ok(findPlayer('戸井零士').roster!.farmPositions.length>0);
 assert.ok(canBat(findPlayer('矢澤宏太')));assert.ok(!canBat(findPlayer('才木浩人')));
 for(const retired of rosterInfo.unmatchedStats){assert.ok(playerMap[retired.id]);assert.ok(!players.some(p=>p.id===retired.id));}
 assert.equal(players.filter(p=>p.roster?.name.replace(/\s/g,'')==='若林楽人').length,1);
 assert.equal(findPlayer('若林楽人').team,'l');
 assert.ok(activeUzrCount<314);assert.ok(players.filter(p=>p.uzr===null).length>700);
});
test('new players keep missing actual stats and safely play a complete season',()=>{
 const added=players.filter(p=>p.roster&&!p.roster.statsId);
 assert.equal(added.length,343);
 for(const p of added){assert.equal(p.batting,undefined);assert.equal(p.pitching,undefined);assert.equal(p.uzr,null);assert.equal(p.rarity,'R');assert.ok(p.provisional);}
 const lineup=autoLineup(added),pitchers=autoPitchers(added);
 const s=structuredClone(initial);s.lineup=lineup;s.pitchers=pitchers;
 s.defense=Object.fromEntries(lineup.map((id,i)=>[id,['捕','一','二','三','遊','外','外','外','DH'][i]]));
 for(const id of [...lineup,...pitchers])s.owned[id]=1;
 assert.ok(validState(s));const completed=simulateDays(s,143);assert.ok(validState(completed));
 assert.equal(completed.season.day,143);
 for(const id of lineup)assert.ok(completed.season.batting[s.club+'|'+id].pa>0);
 for(const id of pitchers)assert.ok(completed.season.pitching[s.club+'|'+id].bf>0);
 const scout=drawPlayers({...initial,gems:1e8,seed:293874},10);assert.ok(validState(scout));
 let drawn={...initial,gems:1e8,seed:2983};const newcomers=new Set<string>();
 for(let i=0;i<100;i++){drawn=drawPlayers(drawn,10);for(const pull of drawn.lastPulls){const p=playerMap[pull.playerId];assert.ok(p.active);if(!p.roster?.statsId)newcomers.add(p.id);}}
 assert.ok(newcomers.size>100);
});
test('old collections and orders survive roster and role corrections without resets',()=>{
 const s=structuredClone(initial),oldId='g-若林楽人';s.owned[oldId]=4;s.training[oldId]=3;
 const corrected=findPlayer('岩貞祐太').id;s.owned[corrected]=2;
 const displaced=s.lineup[0],position=s.defense[displaced];s.lineup[0]=corrected;delete s.defense[displaced];s.defense[corrected]=position;
 const oldPitcher=playerMap['g-横川凱'];assert.ok(oldPitcher);assert.equal(oldPitcher.dataYear,2025);
 s.owned[oldPitcher.id]=2;s.pitchers[0]=oldPitcher.id;
 const loaded=migrateState(s);assert.ok(loaded);assert.deepEqual(loaded,s);
 assert.ok(validState(simulateDays(loaded,1)));
});

test('complete postseason preserves all 143-game records and rewards once',()=>{
 const before=JSON.stringify(season),regular=structuredClone(season.season),done=simulatePostseason(season,60),post=done.season.postseason!;
 assert.equal(post.stage,'complete');assert.ok(post.champion);assert.equal(post.series.length,5);assert.ok(validState(done));
 const {postseason:_,...rest}=done.season;assert.deepEqual(rest,regular);assert.equal(JSON.stringify(season),before);
 assert.deepEqual(simulatePostseason(done,60),done);assert.equal(simulatePostseason(initial),initial);assert.equal(done.season.day,143);
 const games=post.series.flatMap(s=>s.results);
 for(const row of post.standings){const own=games.filter(g=>g.home===row.team||g.away===row.team);assert.equal(row.w+row.l+row.d,own.length);assert.equal(row.rf,Object.values(post.batting).filter(b=>b.team===row.team).reduce((n,b)=>n+b.runs,0));assert.equal(row.ra,own.reduce((n,g)=>n+(g.home===row.team?g.awayRuns:g.homeRuns),0));assert.ok(Object.values(post.pitching).filter(p=>p.team===row.team).reduce((n,p)=>n+p.er,0)<=row.ra);}
 const dailyStart=simulatePostseason(season,1);assert.ok(validState(dailyStart));assert.ok(migrateState(JSON.parse(JSON.stringify(dailyStart))));let daily=dailyStart;while(daily.season.postseason!.stage!=='complete')daily=simulatePostseason(daily,1);assert.deepEqual(daily,done);
 const champion=post.champion===done.club,finalist=post.series.some(s=>s.stage==='japan'&&[s.higher,s.lower].includes(done.club));assert.equal(done.gems-season.gems,postseasonReward(done,champion,finalist));assert.equal(done.franchise.tickets,season.franchise.tickets);
});
test('2026 CS advantage and tied-series advancement follow the published rules',()=>{
 const standing=(w:number,l:number)=>({team:'t',w,l,d:143-w-l,rf:0,ra:0,form:[]});
 assert.deepEqual(finalFormat(standing(80,60),standing(76,64)),{advantage:1,target:4,maxGames:6});
 assert.deepEqual(finalFormat(standing(90,50),standing(80,60)),{advantage:2,target:5,maxGames:7});
 assert.equal(finalFormat(standing(73,67),standing(69,71)).advantage,2);
 const first=newPostseason(season.season).series[0];const dummy=season.season.results[0];
 assert.equal(seriesWinner({...first,wins:[1,0],results:[dummy,dummy]}),first.higher);
 assert.equal(seriesWinner({...first,wins:[1,1],results:[dummy,dummy,dummy]}),first.higher);
 assert.equal(seriesWinner({...first,wins:[0,2],results:[dummy,dummy]}),first.lower);
});
test('postseason saves reject corrupted stage, scores, stats and repeated rewards',()=>{
 const valid=simulatePostseason(season,60);assert.ok(validState(valid));
 for(const mutate of [(s:typeof valid)=>s.season.postseason!.stage='bad' as never,(s:typeof valid)=>s.season.postseason!.series[0].wins[0]=NaN,(s:typeof valid)=>s.season.postseason!.series[0].results[0].homeRuns=-1,(s:typeof valid)=>s.season.postseason!.rewardClaimed=false,(s:typeof valid)=>Object.values(s.season.postseason!.batting)[0].pa=NaN]){const s=structuredClone(valid);mutate(s);assert.equal(migrateState(s),null);}
 assert.deepEqual(migrateState(season),season);
});
test('player form changes by period and year without mutating real abilities',()=>{
 const base=JSON.stringify(players.map(p=>p.ratings));assert.deepEqual(seasonConditions(initial),seasonConditions({...initial,gems:0,pulls:55}));assert.notDeepEqual(seasonConditions(initial,0),seasonConditions(initial,14));assert.notDeepEqual(seasonConditions(initial,0),seasonConditions({...initial,season:{...initial.season,number:2}},0));assert.deepEqual(seasonConditions(initial).map(c=>c.boost),[5,3,-3]);assert.equal(JSON.stringify(players.map(p=>p.ratings)),base);
});
test('cards always render five numeric batting abilities or measured pitching speed',()=>{
 const batter=findPlayer('佐藤輝明'),pitcher=findPlayer('才木浩人'),markup=renderToStaticMarkup(createElement(CardAbilities,{player:batter,bonus:3}));
 for(const label of ['ミート','パワー','走力','肩','守備'])assert.ok(markup.includes(label));assert.equal((markup.match(/aria-label=/g)??[]).length,5);assert.ok(markup.includes(String(batter.ratings.field+3)));assert.ok(!markup.includes('UZR'));
 const pitchMarkup=renderToStaticMarkup(createElement(CardAbilities,{player:pitcher,bonus:8}));assert.ok(pitchMarkup.includes('158'));assert.ok(pitchMarkup.includes('球速'));assert.ok(!pitchMarkup.includes('166'));
 const measured=players.filter(p=>p.velocityRecord);assert.ok(measured.length>=320);assert.ok(measured.every(p=>p.ratings.velocity===(p.wikiAssessment?.ratings.velocity??p.velocityRecord!.maximum)&&p.velocityRecord!.url.startsWith('https://npbdata.jp/players/')));assert.equal(findPlayer('村上頌樹').ratings.velocity,150);assert.equal(findPlayer('田中将大').ratings.velocity,149);
 const missing=players.find(p=>p.role==='pitcher'&&!p.velocityRecord&&!p.wikiAssessment)!;assert.ok(renderToStaticMarkup(createElement(CardAbilities,{player:missing})).includes('球速'));
});


registerCareerTests(test);
registerMatchupTests(test);
registerWikiTests(test);
registerManagerTests(test);
registerSimpleTests(test);
registerArcadeTests(test);
registerDevelopmentTests(test);
registerMLBTests(test);
registerBalanceTests(test);
registerLeagueTests(test);
registerJourneyTests(test);
registerTitleCelebrationTests(test);
registerCatalogTests(test);
registerGrowthTests(test);
registerVictoryShareTests(test);
registerTeamStatsTests(test);
registerFieldingStatsTests(test);
registerLeagueStatsTests(test);
registerNpbDifficultyTests(test);
registerMlbDifficultyTests(test);
registerDisplayNameTests(test);
registerStarterScoutTests(test);
registerPositionDefenseTests(test);
let failures=0;
for(const t of tests){try{t.run();console.log(`PASS ${t.name}`);}catch(error){failures++;console.error(`FAIL ${t.name}`,error);}}
console.log(`${tests.length-failures}/${tests.length} checks passed; NPB 858 / MLB 2430 league games per complete season.`);
if(failures)process.exit(1);

