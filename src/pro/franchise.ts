import { autoLineup,autoPitchers,playerMap,players,rosterSlots } from './data';
import type { GameState } from './engine';
import { isCareer } from './progression';
import {gameRatings} from './matchup';
import {awakeningCosts,ownedRatings,ratingOverall} from './development';

export interface Franchise { tickets:number;established:boolean;city:string;mark:string;color:string;motto:string;xp:number;points:number;stadium:number;claimed:string[];captain:string|null }
export const freshFranchise=():Franchise=>({tickets:1,established:false,city:'東京',mark:'★',color:'#d7b65f',motto:'この街に、黄金時代を。',xp:0,points:0,stadium:1,claimed:[],captain:null});
export const clubLevel=(state:GameState)=>Math.min(99,1+Math.floor(state.franchise.xp/700));
export const captainPool=()=>players.filter(p=>p.rarity==='UR').sort((a,b)=>b.overall-a.overall);
export function establishClub(input:GameState,profile:Pick<Franchise,'city'|'mark'|'color'|'motto'>,name:string,captainId:string):GameState{
 if(!name.trim()||name.trim().length>20||!profile.city.trim()||profile.city.length>12||!['★','D','⚡','W','S','N'].includes(profile.mark)||!/^#[0-9a-fA-F]{6}$/.test(profile.color)||profile.motto.length>40)return input;
 if(!isCareer(input)&&!input.franchise.established&&!captainPool().some(p=>p.id===captainId))return input;
 const state=structuredClone(input),first=!state.franchise.established;
 state.name=name.trim();Object.assign(state.franchise,profile,{established:true});
 if(first&&!isCareer(input)){state.franchise.captain=captainId;state.owned[captainId]=(state.owned[captainId]??0)+1;state.franchise.xp+=200;state.gems+=2700;}
 return state;
}
export function trainPlayer(input:GameState,id:string):GameState{
 const level=input.training[id]??0,cost=awakeningCosts[level];
 if(!playerMap[id]||!input.owned[id]||!Number.isInteger(level)||level<0||cost===undefined||!Number.isFinite(input.gems)||input.gems<cost)return input;
 const state=structuredClone(input);state.training[id]=level+1;state.gems-=cost;state.franchise.xp+=50;return state;
}
export function upgradeStadium(input:GameState):GameState{
 const cost=input.franchise.stadium*700;
 if(input.franchise.stadium>=5||input.gems<cost)return input;
 const state=structuredClone(input);state.gems-=cost;state.franchise.stadium++;state.franchise.xp+=150;return state;
}
export const milestones=[
 {id:'club',title:'はじまりの球団',detail:'オリジナル球団を設立',goal:1,gems:100,points:0,value:(s:GameState)=>Number(s.franchise.established)},
 {id:'draw10',title:'新戦力、続々加入',detail:'スカウトを累計10回',goal:10,gems:150,points:0,value:(s:GameState)=>s.pulls},
 {id:'thirty',title:'30試合のドラマ',detail:'1シーズンで30試合を消化',goal:30,gems:150,points:0,value:(s:GameState)=>Math.max(s.season.day,...s.history.map(h=>h.day))},
 {id:'collect50',title:'選手層が厚すぎる',detail:'50種類の選手を獲得',goal:50,gems:300,points:0,value:(s:GameState)=>Object.keys(s.owned).length},
 {id:'training',title:'推しを、最強へ',detail:'1人のトレーニングをLv.5に',goal:5,gems:300,points:0,value:(s:GameState)=>Math.max(0,...Object.values(s.training))},
 {id:'finish',title:'143試合、走破',detail:'1シーズンを完走',goal:143,gems:300,points:0,value:(s:GameState)=>Math.max(s.season.day,...s.history.map(h=>h.day))},
 {id:'wins',title:'常勝軍団のはじまり',detail:'1シーズンで80勝',goal:80,gems:400,points:0,value:(s:GameState)=>Math.max(...[s.season,...s.history].map(h=>h.standings.find(t=>t.team===s.club)?.w??0))},
];
const careerMilestones=[
 {id:'career-five',title:'最初の5試合',detail:'1シーズンで5試合をプレイ',goal:5,gems:50,points:0,value:(s:GameState)=>Math.max(s.season.day,...s.history.map(h=>h.day))},
 {id:'career-win',title:'忘れられない初勝利',detail:'シーズンで1勝を挙げる',goal:1,gems:50,points:0,value:(s:GameState)=>Math.max(...[s.season,...s.history].map(h=>h.standings.find(t=>t.team===s.club)?.w??0))},
 {id:'career-draw',title:'新しい仲間たち',detail:'1枚スカウトを累計5回',goal:5,gems:100,points:0,value:(s:GameState)=>s.pulls},
 {id:'career-twenty',title:'チームになってきた',detail:'1シーズンで20試合をプレイ',goal:20,gems:100,points:0,value:(s:GameState)=>Math.max(s.season.day,...s.history.map(h=>h.day))},
 {id:'career-fifty',title:'積み重ねた50試合',detail:'1シーズンで50試合をプレイ',goal:50,gems:150,points:0,value:(s:GameState)=>Math.max(s.season.day,...s.history.map(h=>h.day))},
 {id:'career-finish',title:'一年目の足跡',detail:'初めて143試合を完走',goal:143,gems:300,points:0,value:(s:GameState)=>Math.max(s.season.day,...s.history.map(h=>h.day))},
];
export const milestonesFor=(s:GameState)=>isCareer(s)?careerMilestones:milestones;
export function claimMilestone(input:GameState,id:string):GameState{
 const m=milestonesFor(input).find(m=>m.id===id);
 if(!m||input.franchise.claimed.includes(id)||m.value(input)<m.goal)return input;
 const state=structuredClone(input);state.franchise.claimed.push(id);state.gems+=m.gems;state.franchise.xp+=100;return state;
}
export function buildByStrategy(input:GameState,strategy:'balanced'|'onbase'|'power'|'defense'):GameState{
 const pool=Object.keys(input.owned).map(id=>{const p=playerMap[id],ratings=ownedRatings(p,input.owned,input.training);return {...p,overall:ratingOverall(p,ratings),ratings};});
 const ranked=pool.map(p=>({...p,overall:p.role==='pitcher'?p.overall:strategy==='onbase'?(p.batting?.obp??.28)*150+p.ratings.contact*.35:strategy==='power'?p.ratings.power:strategy==='defense'?p.ratings.field*.8+p.ratings.catching*.2:p.overall}));
 const lineup=autoLineup(ranked);
 // Reserve the strongest power bat for cleanup. Speed leads off, contact bats second.
 const defense=Object.fromEntries(lineup.map((id,i)=>[id,rosterSlots[i]]));
 const rated=new Map(pool.map(p=>[p.id,p]));
 const remaining=new Set(lineup);
 const take=(score:(p:typeof pool[number])=>number)=>{const id=[...remaining].sort((a,b)=>score(rated.get(b)!)-score(rated.get(a)!)||a.localeCompare(b))[0];remaining.delete(id);return id;};
 const cleanup=take(p=>p.ratings.power*100+p.ratings.contact);
 const first=take(p=>p.ratings.speed*100+p.ratings.contact+(p.batting?.obp??.28)*20);
 const second=take(p=>p.ratings.contact*.75+p.ratings.speed*.25);
 const third=take(p=>p.ratings.contact*.5+p.ratings.power*.5);
 const fifth=take(p=>p.ratings.power*.7+p.ratings.contact*.3);
 const rest=[...remaining].sort((a,b)=>rated.get(b)!.overall-rated.get(a)!.overall);
 return {...input,lineup:[first,second,third,cleanup,fifth,...rest],defense,pitchers:autoPitchers(pool)};
}

export function claimAllMilestones(input:GameState):GameState { return milestonesFor(input).reduce((state,m)=>claimMilestone(state,m.id),input); }
