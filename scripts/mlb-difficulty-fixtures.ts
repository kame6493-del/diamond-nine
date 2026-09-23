import {players} from '../src/pro/data';
import {initialState,emptySeason,simulateDays,ops,era,type GameState} from '../src/pro/engine';
import {buildByStrategy} from '../src/pro/franchise';
import {finishPostseason} from '../src/pro/postseason';
import {npbDifficultySquads} from './npb-difficulty-fixtures';
import {recordAchievements} from '../src/pro/achievements';

export function mlbDifficultySquads():[string,GameState][]{
 const domestic=npbDifficultySquads(),base=initialState();
 const mixed=(stage:number)=>buildByStrategy({...base,owned:Object.fromEntries(players.map(p=>[p.id,1])),training:Object.fromEntries(players.map(p=>[p.id,stage]))},'balanced');
 return [['初期チーム＋主力5人と覚醒2',domestic[2][1]],['バランスのよいNPB主力',domestic[3][1]],['NPB選抜・未覚醒',domestic[4][1]],['混成選抜・覚醒3',mixed(3)],['混成選抜・覚醒5',mixed(5)]];
}
export const mlbDifficultyStart=(squad:GameState,index:number):GameState=>recordAchievements({...squad,seed:39017+index*98881,season:emptySeason(6,'MLB',squad.club),leagueProgress:{basis:'league',npbStreak:3,mlbUnlocked:true,lastSettledSeason:5}});
export function runMlbDifficultySeason(squad:GameState,index:number){
 const start=mlbDifficultyStart(squad,index);
 const end=finishPostseason(simulateDays(start,162)),s=end.season,row=s.standings.find(t=>t.team===squad.club)!;
 const bats=Object.values(s.batting).filter(b=>b.team===squad.club),pits=Object.values(s.pitching).filter(p=>p.team===squad.club);
 const b={...bats[0]},p={...pits[0]};
 for(const key of ['ab','hits','doubles','triples','hr','bb','hbp','sf','pa'] as const)b[key]=bats.reduce((n,x)=>n+x[key],0);
 p.outs=pits.reduce((n,x)=>n+x.outs,0);p.er=pits.reduce((n,x)=>n+x.er,0);
 const post=s.postseason!;
 return {end,metrics:{wins:row.w,playoffs:Number(post.series.some(r=>r.higher===squad.club||r.lower===squad.club)),finals:Number(post.series.some(r=>r.stage==='world'&&(r.higher===squad.club||r.lower===squad.club))),champion:Number(post.champion===squad.club),avg:b.hits/b.ab,hr:b.hr,ops:ops(b),era:era(p),rf:row.rf,ra:row.ra}};
}
