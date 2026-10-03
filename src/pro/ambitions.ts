import { players,playerMap,type Rarity } from './data';
import type { GameState } from './engine';
import { isCareer } from './progression';
import { leagueFor,standingOrder } from './leagues';

export function seasonGoals(state:GameState){
 const s=state.season,mine=s.standings.find(t=>t.team===state.club)!;
 const hr=Object.values(s.batting).filter(b=>b.team===state.club).reduce((n,b)=>n+b.hr,0);
 // Rank goals count only once the regular season is over, so a hot start cannot claim them.
 const league=leagueFor(s,state.club),table=s.standings.filter(t=>leagueFor(s,t.team)===league).sort(standingOrder);
 const rank=table.findIndex(t=>t.team===state.club)+1,done=s.completed?1:0,teams=table.length;
 return [
  {key:'first-homer',title:'最初の一発',detail:'チームで本塁打を1本',value:hr,goal:1,reward:50,training:0},
  {key:'five-wins',title:'勝てるチームへ',detail:'シーズン5勝',value:mine.w,goal:5,reward:75,training:0},
  {key:'thirty-games',title:'開幕の30試合',detail:'30試合をプレイ',value:s.day,goal:30,reward:100,training:0},
  {key:'twenty-homers',title:'打線に火がついた',detail:'チームで20本塁打',value:hr,goal:20,reward:100,training:0},
  {key:'sixty-games',title:'折り返しへの助走',detail:'60試合をプレイ',value:s.day,goal:60,reward:150,training:0},
  {key:'fifty-wins',title:'50の歓喜',detail:'シーズン50勝',value:mine.w,goal:50,reward:150,training:0},
  {key:'sixty-wins',title:'60勝の壁',detail:'シーズン60勝',value:mine.w,goal:60,reward:300,training:0},
  {key:'out-of-last',title:'最下位脱出',detail:'シーズンを5位以上で終える',value:done&&rank<teams?1:0,goal:1,reward:500,training:0},
  {key:'winning-record',title:'勝ち越し',detail:'シーズンを勝ち越して終える',value:done&&mine.w>mine.l?1:0,goal:1,reward:800,training:0},
  {key:'a-class',title:'Aクラス入り',detail:'シーズンを3位以上で終える',value:done&&rank<=3?1:0,goal:1,reward:1000,training:0},
 ].map(g=>({...g,id:`season-${s.number}-${g.key}`,claimed:state.franchise.claimed.includes(`season-${s.number}-${g.key}`)}));
}
export function claimSeasonGoals(input:GameState):GameState {
 if(!isCareer(input))return input;
 const ready=seasonGoals(input).filter(g=>!g.claimed&&g.value>=g.goal);if(!ready.length)return input;
 const s=structuredClone(input);for(const g of ready){s.franchise.claimed.push(g.id);s.gems+=g.reward;s.franchise.xp+=50;}return s;
}
export function nextContract(state:GameState){
 if(!isCareer(state))return null;
 const earned=Math.floor(state.pulls/10);
 for(let i=1;i<=earned;i++)if(!state.franchise.claimed.includes(`contract-${i}`))return {id:`contract-${i}`,number:i,rarity:(i%2?'SR':'SSR') as Rarity};
 return null;
}
export function contractPool(state:GameState){const c=nextContract(state);return c?players.filter(p=>p.rarity===c.rarity):[];}
export function signContract(input:GameState,id:string):GameState {
 const contract=nextContract(input);if(!contract||!contractPool(input).some(p=>p.id===id))return input;
 const s=structuredClone(input),copies=(s.owned[id]??0)+1,trainingReward=copies>6?80:0;
 s.owned[id]=copies;s.franchise.claimed.push(contract.id);s.gems+=trainingReward;
 s.lastPulls=[{playerId:id,copies,isNew:copies===1,guaranteed:true,contract:true,trainingReward}];return s;
}
export function seasonBatting(state:GameState){
 const bat=Object.values(state.season.batting).filter(b=>b.team===state.club);
 const total=bat.reduce((a,b)=>({ab:a.ab+b.ab,hits:a.hits+b.hits,bb:a.bb+b.bb,hbp:a.hbp+b.hbp,sf:a.sf+b.sf,hr:a.hr+b.hr,rbi:a.rbi+b.rbi,tb:a.tb+b.hits+b.doubles+2*b.triples+3*b.hr}),{ab:0,hits:0,bb:0,hbp:0,sf:0,hr:0,rbi:0,tb:0});
 const pa=total.ab+total.bb+total.hbp+total.sf;
 return {...total,avg:total.ab?total.hits/total.ab:0,ops:(pa?(total.hits+total.bb+total.hbp)/pa:0)+(total.ab?total.tb/total.ab:0)};
}
export function bestGameBatter(state:GameState){return Object.values(state.season.batting).filter(b=>b.team===state.club&&playerMap[b.playerId]).sort((a,b)=>(b.hits+2*b.hr+b.rbi)-(a.hits+2*a.hr+a.rbi))[0];}
