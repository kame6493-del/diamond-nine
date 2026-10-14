// 撮影用のセーブを作る(開発用。出荷しない)。Usage: npx tsx scripts/_demo-save.ts out.json [games]
const g=globalThis as Record<string,unknown>;g.__DIAMOND_APP__=false;g.__DIAMOND_ANDROID__=false;
const {initialState,simulateDays}=await import('../src/pro/engine');
const {pickStarterCard,finishStarterScout}=await import('../src/pro/starter-scout');
const {buildByStrategy}=await import('../src/pro/franchise');
const {collectSimpleRewards,drawSimplePlayer}=await import('../src/pro/simple-game');
const {players}=await import('../src/pro/data');
const {writeFileSync}=await import('node:fs');
let s=initialState(7);
s=buildByStrategy(finishStarterScout(pickStarterCard(s,0)),'balanced');
s={...s,gems:400000};
for(let i=0;i<40;i++)s=drawSimplePlayer(s);
// 特能の多い選手を3人入れる
const many=players.filter(p=>!p.opponentOnly&&p.role!=='pitcher').sort((a,b)=>b.traits.length-a.traits.length).slice(0,3);
const owned={...s.owned};for(const p of many)owned[p.id]=(owned[p.id]??0)+1;
s={...s,owned};
s=buildByStrategy(s,'balanced');
s=collectSimpleRewards(simulateDays(s,Number(process.argv[3]??60)));
s={...s,gems:400000};
writeFileSync(process.argv[2],JSON.stringify(s));
console.log('many traits:',many.map(p=>`${p.id} ${p.name} ${p.traits.length}`).join(' / '),'owned',Object.keys(s.owned).length);
