// 2026-11-03 宇宙リーグの初優勝までの年数(vc41 の宇宙人の相手の作り直しの前後を比べる)。
// 使い方: D9_ENTRY=scripts/sim-space.ts node scripts/sim-balance.mjs [ソースのルート=.] [シード数=20] [年数=40]
// bot は sim-balance.ts の V39 と同じ(1日3年・ログイン・今日の目標・動画スカウト・引けるだけ引く・安い順に覚醒・balanced)。
// 国内 → 海外(3連覇で自動) → 世界王座を取ったら次の年から宇宙リーグへ。宇宙で初めて宇宙王座決定戦を勝った年(シーズン番号)を出す。
// 宇宙リーグでのこちらのチーム打率・1試合の得点・三振の割合(三振/打席)も、宇宙の全シーズンの合計で出す。
import {initialState,simulateDays,nextSeason,switchLeague} from '@d9/engine';
import {seasonGames,circuitOf,spaceUnlocked} from '@d9/leagues';
import {pickStarterCard,finishStarterScout} from '@d9/starter-scout';
import {buildByStrategy,trainPlayer} from '@d9/franchise';
import {collectSimpleRewards,drawSimplePlayer,SIMPLE_SCOUT_COST} from '@d9/simple-game';
import {finishPostseason} from '@d9/postseason';
import {playerMap} from '@d9/data';
import {awakeningCosts,yearEnd} from '@d9/sim-shim';
import {REWARD_AD_DAILY_LIMIT,PREMIUM_DAILY_POINTS,setPremiumMatchBonus} from '@d9/sim-shim';
import {DAILY_LOGIN_POINTS,DAILY_MISSIONS,DAILY_ALL_BONUS} from '@d9/daily';
import * as PP from '@d9/point-products';

type GameState=ReturnType<typeof initialState>;
const seeds=Number(process.argv[2]??20),years=Number(process.argv[3]??40),perDay=Number(process.env.YEARS_PER_DAY??3);
const dailyPoints=DAILY_LOGIN_POINTS+DAILY_MISSIONS.reduce((n,m)=>n+m.points,0)+DAILY_ALL_BONUS;
const packPt=(id:string)=>(PP.allPointPacks as readonly {id:string;points:number}[]).find(p=>p.id===id)?.points??0;
const plans=[
 {name:'無課金',pass:false,buy:(_:number)=>0},
 {name:'パスだけ(¥480)',pass:true,buy:(_:number)=>0},
 {name:'1万円(¥10,000 を1年目)',pass:false,buy:(y:number)=>y===1?packPt('pt_pack_300000'):0},
];
const only=process.env.PLANS?.split(',').map(Number);
const med=(xs:number[])=>{const v=[...xs].sort((a,b)=>a-b);return v[Math.floor(v.length/2)];};
const yr=(n:number)=>n>=99?`${years}年で届かず`:`${n}年目`;
console.log(`シード${seeds}・${years}年・1日${perDay}年 / 宇宙リーグの初優勝(宇宙王座決定戦)`);
for(const plan of plans.filter((_,i)=>!only||only.includes(i))){
 setPremiumMatchBonus(plan.pass);
 const firstSpace:number[]=[],enterSpace:number[]=[],spaceYears:number[]=[];
 const tot={ab:0,hits:0,pa:0,so:0,hr:0,rf:0,ra:0,games:0,w:0,l:0};
 for(let seed=1;seed<=seeds;seed++){
  let s:GameState=initialState(seed*7919);
  const best=s.starterScout!.choices.map((id:string,i:number)=>({i,o:playerMap[id].overall})).sort((a:{o:number},b:{o:number})=>b.o-a.o)[0].i;
  s=buildByStrategy(finishStarterScout(pickStarterCard(s,best)),'balanced');
  let fs=0,es=0,dayLeft=0;
  const spend=()=>{
   while(s.gems>=SIMPLE_SCOUT_COST){s=drawSimplePlayer(s);}
   for(;;){
    const regulars=[...s.lineup,...s.pitchers].map(id=>({id,lv:s.training[id]??0})).filter(x=>x.lv<5).sort((a,b)=>awakeningCosts[a.lv]-awakeningCosts[b.lv]);
    const next=regulars.find(x=>awakeningCosts[x.lv]<=s.gems);if(!next)break;
    s=trainPlayer(s,next.id);
   }
   s=buildByStrategy(s,'balanced');
  };
  for(let y=1;y<=years&&!fs;y++){
   if(dayLeft<=0){dayLeft=perDay;const add=dailyPoints+(plan.pass?PREMIUM_DAILY_POINTS:0)+REWARD_AD_DAILY_LIMIT*SIMPLE_SCOUT_COST;s={...s,gems:s.gems+add};}
   dayLeft--;
   const bought=plan.buy(y);if(bought)s={...s,gems:s.gems+bought};
   if(circuitOf(s.season)!=='SPACE'&&spaceUnlocked(s)){s=switchLeague(s,'SPACE');}
   spend();
   s=collectSimpleRewards(finishPostseason(simulateDays(s,seasonGames(s.season))));
   if(circuitOf(s.season)==='SPACE'){
    if(!es)es=s.season.number;
    for(const b of Object.values(s.season.batting))if(b.team===s.club){tot.ab+=b.ab;tot.hits+=b.hits;tot.pa+=b.pa;tot.so+=b.so;tot.hr+=b.hr;}
    const row=s.season.standings.find(r=>r.team===s.club)!;tot.rf+=row.rf;tot.ra+=row.ra;tot.games+=row.w+row.l+row.d;tot.w+=row.w;tot.l+=row.l;
    if(s.season.postseason?.champion===s.club)fs=s.season.number;
   }
   if(!fs)s=yearEnd(nextSeason(s));
  }
  firstSpace.push(fs||99);enterSpace.push(es||99);spaceYears.push(fs&&es?fs-es+1:99);
 }
 console.log(`\n## ${plan.name}`);
 console.log(`宇宙リーグの初優勝 中央値 ${yr(med(firstSpace))}(${firstSpace.map(x=>x>=99?'-':x).join(',')})`);
 console.log(`宇宙リーグに入った年 中央値 ${yr(med(enterSpace))} / 入ってから優勝まで 中央値 ${med(spaceYears)>=99?'-':med(spaceYears)+'年'}`);
 console.log(`宇宙リーグでのこちら(全シーズン合計 ${tot.games}試合): 打率 ${(tot.hits/Math.max(1,tot.ab)).toFixed(3)} / 1試合の得点 ${(tot.rf/Math.max(1,tot.games)).toFixed(2)} / 1試合の失点 ${(tot.ra/Math.max(1,tot.games)).toFixed(2)} / 三振の割合 ${(tot.so/Math.max(1,tot.pa)*100).toFixed(1)}% / 本塁打 ${(tot.hr/Math.max(1,tot.games)).toFixed(2)}/試合 / 勝率 ${(tot.w/Math.max(1,tot.w+tot.l)).toFixed(3)}`);
}
