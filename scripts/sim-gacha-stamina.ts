// 無課金の人が数日遊んだ時に、スカウトを無料で何回引けるか・行動力が何回切れるかを測る bot。
// 使い方: node scripts/sim-gacha-stamina.mjs [ソースのルート=.] [シード数=4] [日数=3]
// 前後の比べは、前の版の作業コピー(git worktree)をルートに渡す。
// 遊び方: 1日3回開く(7:00〜8:00・12:00〜12:30・19:00〜22:00)。1年進める1回に2分かかるとする(環境変数 SEASON_MIN で変える)。
// 最初に開いた時にログイン・今日の目標(全部)・ドリンク2本・動画のスカウトを1日の回数ぶん。
// 行動力が足りない時は ドリンク → 広告 → 待つ の順。pt での回復は使わない(pt はスカウトに回す)。
// 引けるだけ引いて、残りの pt で起用中の選手の覚醒を安い順に。そのあと おまかせ編成(balanced)。
// 公開記念ボーナス・秋のイベントは入れない。
import {initialState,simulateDays,nextSeason,rankings} from '@d9/engine';
import {leagueFor,seasonGames,circuitOf} from '@d9/leagues';
import {pickStarterCard,finishStarterScout} from '@d9/starter-scout';
import {buildByStrategy,trainPlayer} from '@d9/franchise';
import {collectSimpleRewards,drawSimplePlayer,SIMPLE_SCOUT_COST} from '@d9/simple-game';
import {finishPostseason} from '@d9/postseason';
import {playerMap} from '@d9/data';
import {awakeningCosts,effectiveOverallFor} from '@d9/sim-shim';
import {staminaRules,settle,spendStamina,addStamina,seasonCost,DRINK_RESTORE,STAMINA_AD_POINTS,STAMINA_AD_DAILY_LIMIT,STAMINA_MAX,STAMINA_REGEN_MS,FREE_SEASONS} from '@d9/stamina';
import {REWARD_AD_DAILY_LIMIT} from '@d9/monetization';
import {DAILY_LOGIN_POINTS,DAILY_MISSIONS,DAILY_ALL_BONUS} from '@d9/daily';

type GameState=ReturnType<typeof initialState>;
const seeds=Number(process.argv[2]??4),days=Number(process.argv[3]??3);
const MIN=60_000,SEASON_MIN=Number(process.env.SEASON_MIN??2);
const sessions=[[7*60,8*60],[12*60,12*60+30],[19*60,22*60]];
const rules=staminaRules(false);
const dailyPoints=DAILY_LOGIN_POINTS+DAILY_MISSIONS.reduce((n,m)=>n+m.points,0)+DAILY_ALL_BONUS;

interface DayRow {seasons:number;freePoints:number;adPulls:number;pulls:number;awaken:number;short:number;stuck:number;waitMin:number;stopped:number;ovr:number;wins:number;lastSeason:number;circuit:string}
const rows:DayRow[][]=Array.from({length:days},()=>[]);
const phase={early:{seasons:0,free:0},mid:{seasons:0,free:0}};

for(let seed=1;seed<=seeds;seed++){
 let s:GameState=initialState(seed*7919);
 const best=s.starterScout!.choices.map((id:string,i:number)=>({i,o:playerMap[id].overall})).sort((a:{o:number},b:{o:number})=>b.o-a.o)[0].i;
 s=buildByStrategy(finishStarterScout(pickStarterCard(s,best)),'balanced');
 let st={v:1 as const,points:rules.max,at:0,seen:0,drinks:0,gift:{day:'',login:false,all:false}};
 for(let d=0;d<days;d++){
  const row:DayRow={seasons:0,freePoints:0,adPulls:0,pulls:0,awaken:0,short:0,stuck:0,waitMin:0,stopped:0,ovr:0,wins:0,lastSeason:0,circuit:''};
  let staminaAds=0,first=true;
  const spend=()=>{// 引けるだけ引いて、残りで覚醒
   while(s.gems>=SIMPLE_SCOUT_COST){s=drawSimplePlayer(s);row.pulls++;}
   for(;;){
    const regulars=[...s.lineup,...s.pitchers].map(id=>({id,lv:s.training[id]??0})).filter(x=>x.lv<5).sort((a,b)=>awakeningCosts[a.lv]-awakeningCosts[b.lv]);
    const next=regulars.find(x=>awakeningCosts[x.lv]<=s.gems);if(!next)break;
    s=trainPlayer(s,next.id);row.awaken++;
   }
   s=buildByStrategy(s,'balanced');
  };
  for(const [from,to] of sessions){
   let t=(d*24*60+from)*MIN;const end=(d*24*60+to)*MIN;
   if(first){
    first=false;s={...s,gems:s.gems+dailyPoints};row.freePoints+=dailyPoints;st={...st,drinks:st.drinks+2};
    for(let i=0;i<REWARD_AD_DAILY_LIMIT;i++){s={...s,gems:s.gems+SIMPLE_SCOUT_COST};row.adPulls++;}
    spend();
   }
   while(t+SEASON_MIN*MIN<=end){
    const cost=seasonCost(s);
    let cur=settle(st,t,rules);
    if(cur.points<cost){
     row.short++;
     while(cur.points<cost&&cur.drinks>0){cur=addStamina({...cur,drinks:cur.drinks-1},DRINK_RESTORE,t,rules);}
     while(cur.points<cost&&staminaAds<STAMINA_AD_DAILY_LIMIT){cur=addStamina(cur,STAMINA_AD_POINTS,t,rules);staminaAds++;}
     if(cur.points<cost){
      row.stuck++;
      const wait=(cost-cur.points)*rules.regenMs-Math.max(0,t-cur.at)%rules.regenMs;
      if(t+wait+SEASON_MIN*MIN>end){row.stopped++;row.waitMin+=(end-t)/MIN;st=cur;break;}
      row.waitMin+=wait/MIN;t+=wait;cur=settle(cur,t,rules);
     }
    }
    st=spendStamina(cur,cost,t,rules)!;
    const before=s.gems,number=s.season.number;
    s=collectSimpleRewards(finishPostseason(simulateDays(s,seasonGames(s.season))));
    const earned=s.gems-before;row.freePoints+=earned;
    const p=number<=5?phase.early:number<=20?phase.mid:null;if(p){p.seasons++;p.free+=earned;}
    row.seasons++;
    const table=rankings(s.season,leagueFor(s.season,s.club));row.wins+=table.find((r:{team:string})=>r.team===s.club)!.w;
    s=nextSeason(s);spend();
    t+=SEASON_MIN*MIN;
   }
  }
  const ids=[...s.lineup,...s.pitchers];
  row.ovr=ids.reduce((n,id)=>n+effectiveOverallFor(playerMap[id],s.owned,s.training),0)/ids.length;
  row.lastSeason=s.season.number-1;row.circuit=circuitOf(s.season);
  rows[d].push(row);
 }
}
const avg=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length);
console.log(`1年に${SEASON_MIN}分 / 行動力 上限${STAMINA_MAX}・${STAMINA_REGEN_MS/1000}秒で1・無料${FREE_SEASONS}シーズン / 1日の配布 ${dailyPoints}pt・動画スカウト${REWARD_AD_DAILY_LIMIT}回 / シード${seeds}`);
console.log('日\t進めた年\t無料pt\t動画で引く\t無料で引ける回数\t1年あたり\t実際に引いた\t覚醒した段階\t行動力が足りない\t待つしかない\t待った分\t打ち切り\t起用の総合\t1年の勝ち\t到達');
for(const [d,r] of rows.entries()){
 const seasons=avg(r.map(x=>x.seasons)),free=avg(r.map(x=>x.freePoints/SIMPLE_SCOUT_COST+x.adPulls));
 console.log([d+1,seasons.toFixed(1),Math.round(avg(r.map(x=>x.freePoints))),avg(r.map(x=>x.adPulls)).toFixed(0),free.toFixed(1),(free/Math.max(1,seasons)).toFixed(2),avg(r.map(x=>x.pulls)).toFixed(1),avg(r.map(x=>x.awaken)).toFixed(1),avg(r.map(x=>x.short)).toFixed(1),avg(r.map(x=>x.stuck)).toFixed(1),avg(r.map(x=>x.waitMin)).toFixed(0)+'分',avg(r.map(x=>x.stopped)).toFixed(1),avg(r.map(x=>x.ovr)).toFixed(1),(avg(r.map(x=>x.wins))/Math.max(1,seasons)).toFixed(1),`${avg(r.map(x=>x.lastSeason)).toFixed(0)}年目・${r.map(x=>x.circuit).join('/')}`].join('\t'));
}
console.log(`1〜5年目: 1年に自動で入るpt ${Math.round(phase.early.free/Math.max(1,phase.early.seasons))}(=${(phase.early.free/Math.max(1,phase.early.seasons)/SIMPLE_SCOUT_COST).toFixed(2)}回) / 6〜20年目: ${Math.round(phase.mid.free/Math.max(1,phase.mid.seasons))}(=${(phase.mid.free/Math.max(1,phase.mid.seasons)/SIMPLE_SCOUT_COST).toFixed(2)}回)`);
