// Measures a brand-new player's first seasons the way the app plays them:
// starter pick, auto formation, "シーズン終了まで", rewards, every affordable scout,
// auto formation again. Reports wins, rank and points earned per season.
// Usage: APP=1 PREMIUM=1 npx tsx scripts/_first_seasons.ts [seeds] [seasons] [extraPointsPerSeason] [firstGift]
const g=globalThis as Record<string,unknown>;
g.__DIAMOND_APP__=process.env.APP==='1';g.__DIAMOND_ANDROID__=false;

const {initialState,simulateDays,nextSeason,rankings}=await import('../src/pro/engine');
const {leagueFor,seasonGames}=await import('../src/pro/leagues');
const {pickStarterCard,finishStarterScout}=await import('../src/pro/starter-scout');
const {buildByStrategy}=await import('../src/pro/franchise');
const {collectSimpleRewards,drawSimplePlayer,SIMPLE_SCOUT_COST}=await import('../src/pro/simple-game');
const {finishPostseason}=await import('../src/pro/postseason');
const {playerMap}=await import('../src/pro/data');
const {setPremiumMatchBonus,appEdition}=await import('../src/pro/platform-economy');
setPremiumMatchBonus(process.env.PREMIUM==='1');
type GameState=ReturnType<typeof initialState>;

const seeds=Number(process.argv[2]??10),seasons=Number(process.argv[3]??4),extra=Number(process.argv[4]??0),firstGift=Number(process.argv[5]??30000);
const record=(s:GameState)=>{
 const table=rankings(s.season,leagueFor(s.season,s.club));const i=table.findIndex(r=>r.team===s.club);
 return {w:table[i].w,l:table[i].l,rank:i+1};
};
const sums=Array.from({length:seasons},()=>({w:0,last:0,above:0,earned:0,draws:0,first:0,mlb:0,ovr:0}));
for(let seed=1;seed<=seeds;seed++){
 let s=initialState(seed);
 const best=s.starterScout!.choices.map((id,i)=>({i,o:playerMap[id].overall})).sort((a,b)=>b.o-a.o)[0].i;
 s=buildByStrategy(finishStarterScout(pickStarterCard(s,best)),'balanced');
 s={...s,gems:s.gems+firstGift};
 for(let y=0;y<seasons;y++){
  let draws=0;while(s.gems>=SIMPLE_SCOUT_COST){s=drawSimplePlayer(s);draws++;}
  s=buildByStrategy(s,'balanced');
  const before=s.gems;
  s=collectSimpleRewards(finishPostseason(simulateDays(s,seasonGames(s.season))));
  const r=record(s);
  const t=sums[y];t.w+=r.w;t.last+=+(r.rank===6);t.above+=+(r.w>r.l);t.first+=+(r.rank===1);t.mlb+=+((s.season.circuit??"NPB")!=="NPB");t.earned+=s.gems-before;t.ovr+=[...s.lineup,...s.pitchers].reduce((n,id)=>n+playerMap[id].overall,0)/(s.lineup.length+s.pitchers.length);t.draws+=draws;
  s=nextSeason(s);s={...s,gems:s.gems+extra};
 }
}
console.log(`app=${appEdition} premium=${process.env.PREMIUM==='1'} extra/season=${extra}`);
for(const [y,t] of sums.entries())console.log(`${y+1}年目: 平均${(t.w/seeds).toFixed(1)}勝 最下位${t.last}/${seeds} 勝ち越し${t.above}/${seeds} 1位${t.first}/${seeds} 海外${t.mlb}/${seeds} チーム平均${(t.ovr/seeds).toFixed(1)} 獲得pt平均${Math.round(t.earned/seeds)} その年のスカウト平均${(t.draws/seeds).toFixed(1)}回`);
