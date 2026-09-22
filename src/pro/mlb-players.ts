import snapshot from './mlb2026.json';
import {maskPlayerName,teamLocation} from './display-names';
import type {BattingRecord,PitchingRecord,Player,Ratings} from './data';

export const mlbInfo=snapshot;
export const mlbTeams=[
 {id:'mlb-119',color:'#005a9c'}, {id:'mlb-112',color:'#0e3386'},
 {id:'mlb-117',color:'#eb6e1f'}, {id:'mlb-108',color:'#ba0021'},
 {id:'mlb-135',color:'#765234'}, {id:'mlb-145',color:'#272c35'},
 {id:'mlb-141',color:'#134a8e'}, {id:'mlb-121',color:'#f47735'},
 {id:'mlb-115',color:'#694899'}, {id:'mlb-111',color:'#bd3039'},
].map(team=>({...team,league:'MLB',...teamLocation(team.id)}));
// Game estimates on the NPB Wiki scale, informed by the dated MLB snapshot.
// Preserve each player's weaknesses: league membership alone does not make an ace.
// Individual strengths remain distinct; batting and pitching feed the same engine.
const cards:Record<number,{skills:Partial<Ratings>;positions:string[];traits:string[];pitches?:{name:string;level:number}[]}>= {
 660271:{"skills":{"contact":80,"power":90,"speed":78,"arm":95,"field":55,"catching":55,"velocity":165,"control":78,"stamina":78,"breaking":86},"positions":["投","DH"],"traits":["二刀流","PH","奪三振","選球眼","積極走塁"],"pitches":[{"name":"スイーパー","level":6},{"name":"スプリット","level":6},{"name":"カーブ","level":3}]},
 673548:{"skills":{"contact":76,"power":79,"speed":66,"arm":78,"field":62,"catching":62},"positions":["外","DH"],"traits":["PH","選球眼"]},
 808959:{"skills":{"contact":57,"power":89,"speed":54,"arm":66,"field":47,"catching":45},"positions":["一","三","DH"],"traits":["PH","選球眼"]},
 672960:{"skills":{"contact":65,"power":83,"speed":43,"arm":65,"field":70,"catching":68},"positions":["三","一","外","DH"],"traits":["PH","チャンスB"]},
 807799:{"skills":{"contact":80,"power":66,"speed":45,"arm":49,"field":40,"catching":52},"positions":["外","DH"],"traits":["AH","選球眼"]},
 807747:{"skills":{"contact":56,"power":38,"speed":86,"arm":55,"field":62,"catching":58},"positions":["外","二","DH"],"traits":["積極走塁"]},
 808967:{"skills":{"velocity":160,"control":88,"stamina":86,"breaking":88},"positions":["投"],"traits":["奪三振","精密制球","エース"],"pitches":[{"name":"スプリット","level":6},{"name":"カーブ","level":6},{"name":"カットボール","level":4}]},
 808963:{"skills":{"velocity":165,"control":58,"stamina":68,"breaking":77},"positions":["投"],"traits":["奪三振"],"pitches":[{"name":"フォーク","level":6},{"name":"スライダー","level":3}]},
 684007:{"skills":{"velocity":154,"control":81,"stamina":78,"breaking":80},"positions":["投"],"traits":["精密制球"],"pitches":[{"name":"スプリット","level":5},{"name":"スライダー","level":3}]},
 579328:{"skills":{"velocity":160,"control":62,"stamina":75,"breaking":76},"positions":["投"],"traits":["奪三振"],"pitches":[{"name":"スライダー","level":4},{"name":"チェンジアップ","level":4},{"name":"カーブ","level":2}]},
 673513:{"skills":{"velocity":155,"control":56,"stamina":48,"breaking":84},"positions":["投"],"traits":["奪三振","鉄腕リリーフ"],"pitches":[{"name":"スプリット","level":6},{"name":"スライダー","level":3}]},
 673540:{"skills":{"velocity":159,"control":52,"stamina":66,"breaking":80},"positions":["投"],"traits":["奪三振"],"pitches":[{"name":"フォーク","level":6},{"name":"カットボール","level":3},{"name":"カーブ","level":2}]},
 608372:{"skills":{"velocity":153,"control":79,"stamina":73,"breaking":69},"positions":["投"],"traits":["精密制球"],"pitches":[{"name":"スライダー","level":4},{"name":"スプリット","level":3},{"name":"カットボール","level":3}]},
 837227:{"skills":{"velocity":159,"control":51,"stamina":75,"breaking":83},"positions":["投"],"traits":["奪三振"],"pitches":[{"name":"スライダー","level":5},{"name":"チェンジアップ","level":3}]},
 506433:{"skills":{"velocity":156,"control":74,"stamina":66,"breaking":83},"positions":["投"],"traits":["精密制球"],"pitches":[{"name":"スライダー","level":5},{"name":"カットボール","level":4},{"name":"スプリット","level":3},{"name":"カーブ","level":3}]},
};
type Stat=Record<string,unknown>;
const n=(s:Stat,k:string)=>Number(s[k])||0;
export function batting(s:Stat):BattingRecord {
 return {games:n(s,'gamesPlayed'),pa:n(s,'plateAppearances'),ab:n(s,'atBats'),runs:n(s,'runs'),hits:n(s,'hits'),doubles:n(s,'doubles'),triples:n(s,'triples'),hr:n(s,'homeRuns'),tb:n(s,'totalBases'),rbi:n(s,'rbi'),sb:n(s,'stolenBases'),cs:n(s,'caughtStealing'),sh:n(s,'sacBunts'),sf:n(s,'sacFlies'),bb:n(s,'baseOnBalls'),ibb:n(s,'intentionalWalks'),hbp:n(s,'hitByPitch'),so:n(s,'strikeOuts'),gidp:n(s,'groundIntoDoublePlay'),avg:n(s,'avg'),slg:n(s,'slg'),obp:n(s,'obp')};
}
export function pitching(s:Stat):PitchingRecord {
 return {games:n(s,'gamesPitched'),wins:n(s,'wins'),losses:n(s,'losses'),saves:n(s,'saves'),holds:n(s,'holds'),hp:n(s,'holds')+n(s,'wins'),cg:n(s,'completeGames'),sho:n(s,'shutouts'),noWalk:0,winPct:n(s,'winPercentage'),bf:n(s,'battersFaced'),outs:n(s,'outs'),hits:n(s,'hits'),hr:n(s,'homeRuns'),bb:n(s,'baseOnBalls'),ibb:n(s,'intentionalWalks'),hbp:n(s,'hitBatsmen'),so:n(s,'strikeOuts'),wp:n(s,'wildPitches'),balk:n(s,'balks'),runs:n(s,'runs'),er:n(s,'earnedRuns'),era:n(s,'era')};
}
export const mlbPlayers:Player[]=snapshot.entries.map(entry=>{
 const spec=cards[entry.mlbId];if(!spec)throw new Error(`Missing MLB game tuning: ${entry.name}`);
 const ratings:Ratings={contact:15,power:20,speed:45,arm:75,field:55,catching:55,velocity:145,control:60,stamina:60,breaking:65,...spec.skills};
 const role=spec.positions.includes('投')?'pitcher':'batter';
 const sourceBat=entry.hitting as Stat|null,sourcePit=entry.pitching as Stat|null;
 return {id:`mlb-${entry.mlbId}`,name:maskPlayerName(entry.name),team:`mlb-${entry.teamId}`,role,position:spec.positions[0],positions:spec.positions,bats:entry.bats==='L'?'左':entry.bats==='S'?'両':'右',throws:entry.throws==='L'?'左':'右',
  batting:sourceBat?batting(sourceBat):undefined,pitching:sourcePit?pitching(sourcePit):undefined,fielding:[],ratings,overall:90,rarity:'UR',traits:spec.traits,dataYear:2026,uzr:null,war:null,uzrRecord:null,roster:null,active:true,provisional:false,positionSource:'registration',velocityRecord:null,
  defenseEvidence:{chances:0,errors:0,games:0,fieldingPct:null,positionPct:null,handling:ratings.catching},
  // A small league translation only; recorded results already encode talent.
  simulationBaseline:{...ratings,contact:ratings.contact-2,power:ratings.power-3,control:ratings.control-2,breaking:ratings.breaking-3},
  mlb:{id:entry.mlbId,birthDate:entry.birthDate,number:entry.number,profileUrl:entry.profileUrl,asOf:snapshot.asOf,assignment:teamLocation(`mlb-${entry.teamId}`).name,twoWay:entry.mlbId===660271,statsYear:entry.statsYear,pitches:spec.pitches??[]},
 };
});
