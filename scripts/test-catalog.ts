import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {players,playerMap,teams,type Player} from '../src/pro/data';
import {initialState,effectiveOverall} from '../src/pro/engine';
import {playerAge,ratingOverall} from '../src/pro/development';
import {browseCards,browseCatalogCards,collectionProgress,defaultCardFilters,cardTeams} from '../src/pro/player-browser';
import {PlayerCatalog,CATALOG_PAGE_SIZE} from '../src/pro/PlayerCatalog';
import {DeckTeam} from '../src/pro/CardDeck';
import {PlayerDetails} from '../src/pro/PlayerDetails';

export function registerCatalogTests(test:(name:string,run:()=>void)=>void){
 test('catalog covers every collectible exactly once, separates Japanese MLB cards, and supports every club',()=>{
  const state=initialState(),all=browseCards(players,state,defaultCardFilters);assert.equal(all.length,1082);assert.equal(new Set(all.map(p=>p.id)).size,1082);assert.ok(all.some(p=>!state.owned[p.id]));assert.ok(!all.some(p=>p.opponentOnly));
  const major=browseCards(players,state,{...defaultCardFilters,team:'mlb'});assert.equal(major.length,15);assert.ok(major.every(p=>p.mlb));
  let domestic=0;for(const team of teams){const found=browseCards(players,state,{...defaultCardFilters,team:team.id});assert.ok(found.length>0);assert.ok(found.every(p=>p.team===team.id&&!p.mlb));domestic+=found.length;}assert.equal(domestic,1067);
  assert.equal(cardTeams.mlb.reduce((n,t)=>n+browseCards(players,state,{...defaultCardFilters,team:t.id}).length,0),15);
  const paged=[];for(let i=0;i<all.length;i+=CATALOG_PAGE_SIZE)paged.push(...all.slice(i,i+CATALOG_PAGE_SIZE));assert.deepEqual(paged.map(p=>p.id),all.map(p=>p.id));
 });
 test('age-band boundaries include ages 18 and 24, exclude adjacent ages, and leave unknown ages last in both directions',()=>{
  const base=players.find(p=>p.roster)!;
  const dated=(id:string,birthDate:string):Player=>({...base,id,mlb:undefined,roster:{...base.roster!,birthDate}});
  const pool=[dated('age17','2008-09-21'),dated('age18','2008-09-20'),dated('age24','2001-09-21'),dated('age25','2001-09-20'),{...base,id:'unknown-age',mlb:undefined,roster:null}];
  const state=initialState(),young=browseCards(pool,state,{...defaultCardFilters,age:'18-24',sort:'age-asc'});assert.deepEqual(young.map(p=>p.id),['age18','age24']);
  assert.equal(browseCards(pool,state,{...defaultCardFilters,sort:'age-asc'}).at(-1)!.id,'unknown-age');assert.equal(browseCards(pool,state,{...defaultCardFilters,sort:'age-desc'}).at(-1)!.id,'unknown-age');
 });
 test('bench filters combine age, team, role and normalized player names without changing the save or roster',()=>{
  const state=initialState(),frozen=JSON.stringify(state),team=teams.find(t=>players.some(p=>p.team===t.id&&p.role==='batter'&&(playerAge(p)??0)>=18&&(playerAge(p)??99)<=24))!;
  const young=browseCards(players,state,{...defaultCardFilters,team:team.id,age:'18-24',role:'batter',sort:'age-asc'});assert.ok(young.length);assert.ok(young.every(p=>p.team===team.id&&playerAge(p)!>=18&&playerAge(p)!<=24));assert.ok(young.every((p,i)=>!i||playerAge(p)!>=playerAge(young[i-1])!));
  const named=young[0],found=browseCards(players,state,{...defaultCardFilters,team:team.id,age:'18-24',role:'batter',search:named.name.replaceAll(' ','').replaceAll('　','')});assert.ok(found.some(p=>p.id===named.id));
  assert.equal(browseCards(players,state,{...defaultCardFilters,search:'存在しないテスト選手xyz'}).length,0);assert.equal(JSON.stringify(state),frozen);
  const ohtani=players.find(p=>p.mlb?.twoWay)!;for(const role of ['batter','pitcher'])assert.ok(browseCards(players,state,{...defaultCardFilters,role,team:'mlb'}).some(p=>p.id===ohtani.id));
 });
 test('overall and club sorting stay deterministic and use the developed values shown on cards',()=>{
  const state=initialState();state.training[state.lineup[0]]=5;state.owned[state.lineup[0]]=6;
  const sorted=browseCards(players,state,defaultCardFilters);for(let i=1;i<sorted.length;i++)assert.ok(effectiveOverall(sorted[i-1],state.owned,state.training)>=effectiveOverall(sorted[i],state.owned,state.training));
  const grouped=browseCards(players,state,{...defaultCardFilters,sort:'team'}),ranks=new Map([...cardTeams.npb,...cardTeams.mlb].map((t,i)=>[t.id,i]));assert.ok(grouped.every((p,i)=>!i||ranks.get(p.team)!>=ranks.get(grouped[i-1].team)!));
  assert.deepEqual(browseCards([...players].reverse(),state,defaultCardFilters).map(p=>p.id),sorted.map(p=>p.id));
 });
 test('catalog renders a bounded card page with league, club and age filters; unowned cards expose details without acquisition actions',()=>{
  const state=initialState(),html=renderToStaticMarkup(createElement(PlayerCatalog,{state,onBack:()=>{},onPlayer:()=>{}}));
  assert.equal((html.match(/class="catalog-card"/g)??[]).length,CATALOG_PAGE_SIZE);for(const label of ['カードカタログ','日本人MLB選手','カタログの球団','18〜24歳','年齢が若い順','カタログの次のページ','未入手','カード収集率','data-collected="false"'])assert.ok(html.includes(label));assert.ok(!html.includes('レア度'));
  const unowned=players.find(p=>!state.owned[p.id])!,detail=renderToStaticMarkup(createElement(PlayerDetails,{player:unowned,state,onChange:()=>{},onAwaken:()=>{},catalog:true}));assert.ok(detail.includes(unowned.name));assert.ok(detail.includes('特殊能力'));assert.ok(detail.includes('catalog-detail-unowned'));assert.ok(!detail.includes('awaken-button'));assert.ok(!detail.includes('hand-equip'));
  const deck=renderToStaticMarkup(createElement(DeckTeam,{state,onChange:()=>{},onPlayer:()=>{},onImpact:()=>{},onCatalog:()=>{}}));for(const label of ['カードカタログ','控えの年齢帯','控えの球団','球団順','年齢が高い順','3人を表示'])assert.ok(deck.includes(label));assert.equal(playerMap[unowned.id].id,unowned.id);
 });
 test('catalog cards, ability sorting and details never reveal awakening or duplicate bonuses, including two-way players',()=>{
  const initial=initialState(),base={...initial,owned:Object.fromEntries(players.map(p=>[p.id,1])),training:{}};
  const trained={...base,owned:Object.fromEntries(players.map(p=>[p.id,6])),training:Object.fromEntries(players.map(p=>[p.id,5]))},frozen=JSON.stringify(trained);
  const render=(state:typeof base)=>renderToStaticMarkup(createElement(PlayerCatalog,{state,onBack:()=>{},onPlayer:()=>{}}));
  assert.equal(render(trained),render(base));assert.ok(render(trained).includes('コンプリート！'));assert.ok(!render(trained).includes('覚醒'));
  const ordered=browseCatalogCards(players,trained.owned,defaultCardFilters);
  assert.ok(ordered.every((p,i)=>!i||ratingOverall(ordered[i-1])>=ratingOverall(p)));
  for(const player of [players.find(p=>p.role==='batter')!,players.find(p=>p.role==='pitcher')!,players.find(p=>p.mlb?.twoWay)!]){
   const details=(state:typeof base,catalog=true)=>renderToStaticMarkup(createElement(PlayerDetails,{player,state,onChange:()=>{},onAwaken:()=>{},catalog}));
   assert.equal(details(trained),details(base));assert.ok(details(trained).includes(`>${ratingOverall(player)}</b>`));
   for(const secret of ['覚醒','STAGE AWAKENING','今シーズンの成績','two-way-offer','growth-overall'])assert.ok(!details(trained).includes(secret),secret);
   assert.ok(details(trained,false).includes('完全覚醒'));assert.ok(details(trained,false).includes(`>${effectiveOverall(player,trained.owned,trained.training)}</b>`));
  }
  assert.equal(JSON.stringify(trained),frozen);
 });
 test('collection progress counts distinct acquisitions, partitions filters and reflects complete resets',()=>{
  const state=initialState(),owned={...state.owned,[players.find(p=>p.mlb)!.id]:6,unknown:99},progress=collectionProgress(players,owned);
  assert.equal(progress.collected,Object.keys(state.owned).length+1);assert.equal(progress.total,1082);assert.equal(progress.complete,false);
  const acquired=browseCatalogCards(players,owned,defaultCardFilters,'owned'),missing=browseCatalogCards(players,owned,defaultCardFilters,'missing');
  assert.equal(acquired.length,progress.collected);assert.equal(acquired.length+missing.length,1082);assert.ok(acquired.every(p=>owned[p.id]>0));assert.ok(missing.every(p=>!owned[p.id]));
  const all=Object.fromEntries(players.map(p=>[p.id,1]));assert.equal(collectionProgress(players,all).complete,true);assert.equal(browseCatalogCards(players,all,defaultCardFilters,'missing').length,0);
  assert.equal(collectionProgress(players,{}).collected,0);assert.equal(collectionProgress(players,state.owned).collected,Object.keys(state.owned).length);
 });
}
