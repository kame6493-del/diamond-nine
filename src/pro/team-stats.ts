import type {Season} from './engine';
import {teamFieldingStats} from './fielding-stats';

// Sum the full season roster, including players who have since left the lineup.
// Rates use total opportunities rather than averaging individual player rates.
export function teamSeasonStats(season:Season,club:string){
 const batters=Object.values(season.batting).filter(b=>b.team===club);
 const pitchers=Object.values(season.pitching).filter(p=>p.team===club);
 const hits=batters.reduce((n,b)=>n+b.hits,0),ab=batters.reduce((n,b)=>n+b.ab,0);
 const hr=batters.reduce((n,b)=>n+b.hr,0),sb=batters.reduce((n,b)=>n+b.sb,0);
 const walks=batters.reduce((n,b)=>n+b.bb+b.hbp,0),sacrificeFlies=batters.reduce((n,b)=>n+b.sf,0);
 const onBaseOpportunities=ab+walks+sacrificeFlies;
 const rbi=batters.reduce((n,b)=>n+b.rbi,0),outs=pitchers.reduce((n,p)=>n+p.outs,0),earnedRuns=pitchers.reduce((n,p)=>n+p.er,0);
 const standing=season.standings.find(t=>t.team===club),games=standing?standing.w+standing.l+standing.d:0;
 const recorded=season.results.filter(g=>(g.home===club||g.away===club)&&g.errors!==undefined);
 const errors=recorded.reduce((n,g)=>n+g.errors![g.home===club?1:0],0);
 return {avg:ab?hits/ab:null,hr,rbi,sb,obp:onBaseOpportunities?(hits+walks)/onBaseOpportunities:null,era:outs?earnedRuns*27/outs:null,errors:games===0||recorded.length?errors:null,errorGames:recorded.length,games,...teamFieldingStats(season,club)};
}
