// 2026-11-01 バランスの測り直し(持ち主「大盤振る舞い過ぎて速攻でクリアできてしまう」)。
// 無課金・無課金+動画・パス・中課金・重課金で、年ごとのチーム総合・勝ち・順位・優勝の割合を出す。
// 使い方: node scripts/sim-balance.mjs [ソースのルート=.] [シード数=8] [年数=12]
// 環境変数 YEARS_PER_DAY(1日に進める年、既定 3)。
// 遊び方の bot: 1日の最初にログイン・今日の目標を全部・(動画あり)動画スカウトを上限まで。
// 1年進めるごとに、引けるだけ引いて、残りの pt で起用中の選手を安い順に覚醒、おまかせ編成(balanced)。
// スタートスカウトは一番強いカード。公開記念ボーナス・期間限定のイベントは入れない。
import {initialState,simulateDays,nextSeason,rankings} from '@d9/engine';
import {leagueFor,seasonGames,circuitOf} from '@d9/leagues';
import {pickStarterCard,finishStarterScout} from '@d9/starter-scout';
import {buildByStrategy,trainPlayer} from '@d9/franchise';
import {collectSimpleRewards,drawSimplePlayer,SIMPLE_SCOUT_COST} from '@d9/simple-game';
import {finishPostseason} from '@d9/postseason';
import {playerMap} from '@d9/data';
import {awakeningCosts,effectiveOverallFor,yearEnd} from '@d9/sim-shim';
import {REWARD_AD_DAILY_LIMIT,PREMIUM_DAILY_POINTS,setPremiumMatchBonus} from '@d9/sim-shim';
import {DAILY_LOGIN_POINTS,DAILY_MISSIONS,DAILY_ALL_BONUS} from '@d9/daily';

type GameState=ReturnType<typeof initialState>;
const seeds=Number(process.argv[2]??8),years=Number(process.argv[3]??12),perDay=Number(process.env.YEARS_PER_DAY??3);
const dailyPoints=DAILY_LOGIN_POINTS+DAILY_MISSIONS.reduce((n,m)=>n+m.points,0)+DAILY_ALL_BONUS;
interface Plan {name:string;ads:boolean;pass:boolean;buy:(year:number)=>number}
// 課金: パス ¥480(買い切り)。中課金 = パス+毎年 ¥980(21,000pt)。重課金 = パス+1年目と4年目に ¥10,000(300,000pt)。
// SKILLED=1: 上手な遊び方(2026-11-02 持ち主「入ってくるポイントが多すぎて速攻で強くなる」)。動画のスカウトを毎日上限まで・
// ログインと今日の目標を全部・公開記念ボーナス(15,000pt、11/30 まで)も受け取る・いつも一番強い選手で組む(balanced)。
// 購入 = パス+はじめてのパック(¥480/30,000pt、1年目)+毎年 ¥980(21,000pt)。大きく買う = パス+1年目と4年目に ¥10,000(300,000pt)。
const skilled=process.env.SKILLED==='1',GIFT=skilled?15000:0;
const plans:Plan[]=skilled?[
 {name:'上手・無課金',ads:true,pass:false,buy:()=>0},
 {name:'上手・パス',ads:true,pass:true,buy:()=>0},
 {name:'上手・購入(パス+はじめて+毎年¥980)',ads:true,pass:true,buy:y=>21000+(y===1?30000:0)},
 {name:'上手・毎年¥980だけ',ads:true,pass:false,buy:()=>21000},
 {name:'上手・大きく買う',ads:true,pass:true,buy:y=>y===1||y===4?300000:0},
]:[
 {name:'無課金',ads:false,pass:false,buy:()=>0},
 {name:'無課金+動画',ads:true,pass:false,buy:()=>0},
 {name:'パス',ads:true,pass:true,buy:()=>0},
 {name:'中課金',ads:true,pass:true,buy:()=>21000},
 {name:'重課金',ads:true,pass:true,buy:y=>y===1||y===4?300000:0},
];
interface Row {ovr:number;wins:number;rank:number;league:boolean;japan:boolean;pulls:number;pt:number;yearPt:number;yearPulls:number}
const ovrOf=(s:GameState)=>{const ids=[...s.lineup,...s.pitchers.slice(0,9)];return ids.reduce((n,id)=>n+effectiveOverallFor(playerMap[id],s.owned,s.training,s),0)/ids.length;};
const out:Record<string,{rows:Row[][];firstLeague:number[];firstJapan:number[];start:number[]}>={};
const only=process.env.PLANS?.split(",").map(Number);
for(const plan of plans.filter((_,i)=>!only||only.includes(i))){
 setPremiumMatchBonus(plan.pass);
 const rows:Row[][]=Array.from({length:years},()=>[]),firstLeague:number[]=[],firstJapan:number[]=[],start:number[]=[];
 for(let seed=1;seed<=seeds;seed++){
  let s:GameState=initialState(seed*7919);
  const best=s.starterScout!.choices.map((id:string,i:number)=>({i,o:playerMap[id].overall})).sort((a:{o:number},b:{o:number})=>b.o-a.o)[0].i;
  s=buildByStrategy(finishStarterScout(pickStarterCard(s,best)),'balanced');
  start.push(ovrOf(s));
  let fl=0,fj=0,earned=GIFT;s={...s,gems:s.gems+GIFT};
  const spend=()=>{
   while(s.gems>=SIMPLE_SCOUT_COST){s=drawSimplePlayer(s);}
   for(;;){
    const regulars=[...s.lineup,...s.pitchers].map(id=>({id,lv:s.training[id]??0})).filter(x=>x.lv<5).sort((a,b)=>awakeningCosts[a.lv]-awakeningCosts[b.lv]);
    const next=regulars.find(x=>awakeningCosts[x.lv]<=s.gems);if(!next)break;
    s=trainPlayer(s,next.id);
   }
   s=buildByStrategy(s,'balanced');
  };
  for(let y=1;y<=years;y++){
   const earnedStart=earned,pullsStart=s.pulls;
   if((y-1)%perDay===0){// 新しい日
    let add=dailyPoints+(plan.pass?PREMIUM_DAILY_POINTS:0)+(plan.ads?REWARD_AD_DAILY_LIMIT*SIMPLE_SCOUT_COST:0);
    s={...s,gems:s.gems+add};earned+=add;
   }
   const bought=plan.buy(y);if(bought)s={...s,gems:s.gems+bought};
   spend();
   const before=s.gems;
   s=collectSimpleRewards(finishPostseason(simulateDays(s,seasonGames(s.season))));
   earned+=s.gems-before;
   const table=rankings(s.season,leagueFor(s.season,s.club)),rank=table.findIndex((r:{team:string})=>r.team===s.club)+1;
   const league=rank===1&&circuitOf(s.season)==='NPB',japan=s.season.postseason?.champion===s.club&&circuitOf(s.season)==='NPB';
   if(league&&!fl)fl=y;if(japan&&!fj)fj=y;
   rows[y-1].push({ovr:ovrOf(s),wins:table[rank-1].w,rank,league,japan,pulls:s.pulls,pt:earned,yearPt:earned-earnedStart+(y===1?GIFT:0),yearPulls:s.pulls-pullsStart});
   s=yearEnd(nextSeason(s));
  }
  firstLeague.push(fl||99);firstJapan.push(fj||99);
 }
 out[plan.name]={rows,firstLeague,firstJapan,start};
}
const avg=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
const med=(xs:number[])=>{const v=[...xs].sort((a,b)=>a-b);return v[Math.floor(v.length/2)];};
const yr=(n:number)=>n>=99?`${years}年で届かず`:`${n}年目`;
console.log(`シード${seeds}・${years}年・1日${perDay}年 / 1日の配布 ${dailyPoints}pt / スカウト ${SIMPLE_SCOUT_COST}pt`);
for(const [name,o] of Object.entries(out)){
 console.log(`\n## ${name}  開始時の総合 ${avg(o.start).toFixed(1)} / 初のリーグ優勝 中央値 ${yr(med(o.firstLeague))}(${o.firstLeague.map(x=>x>=99?'-':x).join(',')}) / 初の日本一 中央値 ${yr(med(o.firstJapan))}`);
 console.log('年	累計スカウト	その年のスカウト	総合	勝ち	順位	リーグ優勝	日本一	その年の無料pt	累計の無料pt');
 o.rows.forEach((r,i)=>console.log([i+1,avg(r.map(x=>x.pulls)).toFixed(0),avg(r.map(x=>x.yearPulls)).toFixed(1),avg(r.map(x=>x.ovr)).toFixed(1),avg(r.map(x=>x.wins)).toFixed(0),avg(r.map(x=>x.rank)).toFixed(1),`${r.filter(x=>x.league).length}/${r.length}`,`${r.filter(x=>x.japan).length}/${r.length}`,Math.round(avg(r.map(x=>x.yearPt))),Math.round(avg(r.map(x=>x.pt)))].join('\t')));
}
