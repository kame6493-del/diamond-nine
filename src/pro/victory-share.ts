import {formatAvg,playerMap,type Ratings} from './data';
import {battingAverage,ops,type GameState,type Season} from './engine';
import {circuitLabel,circuitOf,seasonGames,titleFor,wonNpbLeague} from './leagues';
import {captureSeasonTeam,type SeasonTeamSnapshot} from './season-team';

export function victoryTitle(season:Season,club:string):string|null{
 if(!season.completed||season.day!==seasonGames(season))return null;
 if(season.postseason?.stage==='complete'&&season.postseason.champion===club)return titleFor(season);
 if(wonNpbLeague(season,club))return 'リーグ優勝';
 if(circuitOf(season)==='MLB'&&season.postseason?.series.some(s=>s.stage==='championship'&&s.winner===club))return '海外リーグ優勝';
 return null;
}
const mean=(values:number[])=>Math.round(values.reduce((a,b)=>a+b,0)/Math.max(1,values.length));
export function shareTeamAbilities(team:SeasonTeamSnapshot){
 const fielders=team.batters.filter(p=>p.position!=='DH'),unique=[...new Map([...team.batters,...team.pitchers].map(p=>[p.id,p])).values()];
 const average=(key:keyof Ratings,field=false)=>mean((field?fielders:team.batters).map(p=>p.ratings[key]));
 return {overall:mean(unique.map(p=>p.overall)),metrics:[['ミート',average('contact')],['パワー',average('power')],['走力',average('speed')],['肩',average('arm',true)],['守備',average('field',true)],['投手総合',mean(team.pitchers.map(p=>p.overall))]] as [string,number][]};
}
export function victoryShareData(state:GameState,season:Season){
 const title=victoryTitle(season,state.club);if(!title)return null;
 const team=season.shareTeam??(season===state.season?captureSeasonTeam(state):null);
 if(!team)return null; // Old archives have no record of that year's abilities.
 const standing=season.standings.find(s=>s.team===state.club)!;
 const rows=Object.values(season.batting).filter(b=>b.team===state.club&&b.pa>0).sort((a,b)=>b.pa-a.pa||a.playerId.localeCompare(b.playerId));
 return {title,year:season.number,league:circuitLabel(circuitOf(season)),name:team.name,record:`${standing.w}勝 ${standing.l}敗 ${standing.d}分`,...shareTeamAbilities(team),
  abilityLabel:season.shareTeam?'シーズン終了時のチーム能力':'現在のチーム能力',
  playerAbilityLabel:season.shareTeam?'シーズン終了時の選手能力':'現在の選手能力',
  lineupAbilities:team.batters.map((p,i)=>({id:p.id,name:playerMap[p.id].name,order:i+1,position:p.position,overall:p.overall,ratings:{...p.ratings}})),
  pitcherAbilities:team.pitchers.map((p,i)=>({id:p.id,name:playerMap[p.id].name,order:i+1,position:i<6?'先発':i===11?'抑え':'救援',overall:p.overall,ratings:{...p.ratings}})),
  batters:rows.slice(0,9).map(b=>({name:playerMap[b.playerId].name,avg:b.ab?formatAvg(battingAverage(b)):'—',hr:b.hr,rbi:b.rbi,ops:formatAvg(ops(b)),sb:b.sb})),
  battingLabel:rows.length>9?'打撃成績 · 打席数上位9人':'打撃成績 · 打席数順'};
}
export type VictoryShareData=NonNullable<ReturnType<typeof victoryShareData>>;
// Do not put local-only addresses or saved query/hash data into a public post.
export function publicGameUrl(href:string):string{
 try{
  const url=new URL(href),host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(['https:','http:'].includes(url.protocol)&&['diamond-nine-baseball.mannchikann.chatgpt.site','diamond-nine-baseball.com'].includes(host))return 'https://diamond-nine-baseball.com/';
  if(!['https:','http:'].includes(url.protocol)||!host.includes('.')||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.test')||host.endsWith('.internal')||host.includes(':'))return '';
  if(/^\d+\.\d+\.\d+\.\d+$/.test(host)){
   const [a,b]=host.split('.').map(Number);
   if(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127)return '';
  }
  url.username='';url.password='';url.search='';url.hash='';return url.href;
 }catch{return '';}
}
export function victoryPostText(data:VictoryShareData,url=''){
 return `DIAMOND NINEで${data.year}年目に${data.title}！\n「${data.name.replace(/\s+/g,' ')}」 ${data.record}／チーム総合${data.overall}\n選手を集めて育てる野球シミュレーション⚾\n#DIAMONDNINE #野球ゲーム${url?'\n'+url:''}`;
}
export const xPostIntent=(text:string)=>'https://twitter.com/intent/tweet?'+new URLSearchParams({text}).toString();
export function canShareVictory(navigator:Pick<Navigator,'share'|'canShare'>,file:File,secure:boolean):boolean{
 try{return secure&&typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]});}catch{return false;}
}
