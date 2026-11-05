// 打球の後の細かいプレー(2026-11-05 vc43 のまま)。持ち主「併殺とかも起こったら良い感じでアニメーションにして」
// 「フォースアウトとかの細かいプレーも、ルール破綻せずに再現するようにして。ファインプレーとかなら『ファインプレー』とか出るように。守備能力とかで変わるように」。
//
// engine.ts の gameSteps が「アウトになる打球」「安打になる打球」を決めた後、ここで
//  - 打球の種類(ゴロ・外野フライ・内野フライ・ライナー)と、捕る野手
//  - 併殺(6-4-3 など)・野選(先の走者をフォースアウト)・タッチアウト・タッチアップ・飛び出しの併殺・三重殺
//  - 走者の進み方(押し出しの走者は進む、そうでない走者は打球と足で決める)
//  - 守備の高い野手のファインプレー(安打をアウトに)と、低い野手が届かない(アウトを安打に)
//  - 外野の肩で、進もうとした走者を刺す(強い肩のまれな好返球は「レーザービーム」)
// を決める。乱数は gameSteps と同じ列(rnd)を使うので、監督の試合と「1年進める」は同じ結果になる。
//
// 野球の規則で守ること:
//  - フォース(押し出し)は、一塁から後ろの塁が全部埋まっている走者だけ。フォースは塁を踏めばアウト、そうでない走者は触球(タッチ)が要る。
//  - 3つ目のアウトがフォースアウト(または打者走者が一塁に着く前のアウト)の時は、そのプレーの得点は入らない。
//    タッチアウト(時間差)なら、先に本塁を踏んだ走者の得点は入る。
//  - フライが捕られたら走者は帰塁が要る。飛び出した走者は戻れなければアウト(併殺)。タッチアップは捕った後に離塁。
//  - 併殺打には打点を付けない。野選・ゴロの間の得点には打点を付ける。犠飛は打数に入れない。
//  - 同じ塁に2人の走者は置かない。アウトは3つを超えない。
export type BB='gb'|'fb'|'pop'|'ld';
/** 守備位置の番号(記録の 1〜9)。 */
export const POS_NO:Record<string,number>={P:1,C:2,'1B':3,'2B':4,'3B':5,SS:6,LF:7,CF:8,RF:9};
export const NO_POS=['','P','C','1B','2B','3B','SS','LF','CF','RF'] as const;
export const NO_WORD=['','ピッチャー','キャッチャー','ファースト','セカンド','サード','ショート','レフト','センター','ライト'];
/** 走者・打者がこのプレーでどうなったか。from=-1 は打者。to: 0〜2=塁、3=本塁(得点)、-1=アウト。 */
export interface Fate {id:string;from:number;to:number;out?:'force'|'tag'|'fly'|'doubled';at?:number;by?:number[]}
export interface PlayDetail {
 bb:BB|'hit';fielder:number;word:string;
 /** 記録の書き方(6-4-3 など)。 */
 seq?:string;dp?:boolean;tp?:boolean;fc?:boolean;
 /** ファインプレー: dive=飛びつく、slide=滑り込んで、wall=壁際、jump=跳んで。 */
 fine?:'dive'|'slide'|'wall'|'jump';
 /** 届かずに安打(守備の低い野手)。 */
 miss?:boolean;
 /** 外野の強い肩の好返球(走者を刺した)。 */
 laser?:boolean;
 fates:Fate[];
}
export interface PlayCtx {
 rnd:()=>number;
 /** 打者と走者の走力(0〜120)。 */
 speed:(id:string)=>number;
 /** 打者のパワー・ミート。 */
 power:number;contact:number;
 /** 守備位置の番号 → その野手の守備(skill)・肩。 */
 skill:(no:number)=>number;arm:(no:number)=>number;
 /** チームの守備(defenseAdjustment)。 */
 teamField:number;
 /** 打撃の作戦(ゴロとフライの割合に少しだけ効く)。 */
 tactic:'power'|'contact'|'aggressive'|'patient'|null;
}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** 重みから1つ選ぶ(乱数1つ)。 */
function pick<K>(rnd:()=>number,w:[K,number][]):K{const t=w.reduce((n,x)=>n+x[1],0);let r=rnd()*t;for(const [k,v] of w){r-=v;if(r<0)return k;}return w[w.length-1][0];}

/** ゴロ・外野フライ・内野フライ・ライナーの割合(アウトになる打球の中で)。パワーが高いほどフライ、作戦でも少し動く。 */
export function groundShare(power:number,tactic:PlayCtx['tactic']){
 return clamp(.47-(power-55)*.003+(tactic==='contact'?.04:tactic==='power'?-.06:tactic==='aggressive'?.02:0),.30,.62);
}
/** 併殺の割合(0〜1アウト・一塁に走者・ゴロの時)。打者の足が速いほど、打球が弱いほど(ミート寄り)、守備が下手なほど下がる。 */
export function dpChance(c:{speed:number;power:number;fielderSkill:number;pivotSkill:number;teamField:number;fielder:number}){
 const base=c.fielder===3||c.fielder===1?.44:c.fielder===5?.53:.56;
 return clamp(base-(c.speed-55)*.006+(c.power-55)*.0015+(c.fielderSkill-60)*.0025+(c.pivotSkill-60)*.0025+c.teamField*.8,.12,.72);
}
/** ファインプレーの割合(安打になる打球を、その野手が捕る)。守備の段が高いほど多い。 */
export function fineChance(skill:number,kind:'in'|'of'|'wall'){
 const k=kind==='in'?.0017:kind==='of'?.0013:.0010;
 return clamp((skill-48)*k,0,kind==='wall'?.045:.075);
}
/** 守備の低い野手が届かない割合(アウトになる打球が安打になる)。 */
export function missChance(skill:number){return clamp((54-skill)*.0028,0,.07);}
/** 外野の送球で、進もうとした走者を刺す割合。肩が強いほど多い。 */
export function throwOutChance(arm:number,speed:number){return clamp(.012+(arm-60)*.0010-(speed-55)*.0004,.003,.045);}

const forcedAt=(bases:(string|null)[],b:number)=>{for(let i=0;i<b;i++)if(!bases[i])return false;return true;};

/** アウトになる打球(三振・失策でない)の結果。outs=打つ前のアウト。 */
export function resolveOut(bases:(string|null)[],outs:number,batter:string,c:PlayCtx):PlayDetail&{kind:'OUT'|'DP'|'FC'|'SF'|'TP'|'1B'}{
 const r=c.rnd;
 const gb=groundShare(c.power,c.tactic);
 const type=pick(r,[['gb',gb],['fb',(1-gb)*.58],['pop',(1-gb)*.20],['ld',(1-gb)*.22]]) as BB;
 const fielder=type==='gb'?pick(r,[[6,.29],[4,.25],[5,.20],[3,.12],[1,.14]]) as number:
  type==='fb'?pick(r,[[7,.32],[8,.38],[9,.30]]) as number:
  type==='pop'?pick(r,[[6,.24],[4,.22],[5,.20],[3,.18],[2,.10],[1,.06]]) as number:
  pick(r,[[6,.14],[4,.12],[5,.10],[3,.08],[1,.06],[7,.16],[8,.18],[9,.16]]) as number;
 const word=type==='gb'?NO_WORD[fielder]+'ゴロ':type==='ld'?NO_WORD[fielder]+'ライナー':NO_WORD[fielder]+'フライ';
 // 守備の低い野手は、捕れるはずの打球に届かず安打にする(ゴロとライナーだけ。乱数はいつも1つ使う)。
 const missRoll=r();
 if((type==='gb'&&fielder!==1&&fielder!==3||type==='ld')&&missRoll<missChance(c.skill(fielder))){
  // 単打と同じ: 押し出される走者は1つ、そうでない走者は二塁から本塁まで(足で)。
  const fates:Fate[]=[];const occ:(string|null)[]=[null,null,null];
  for(let b=2;b>=0;b--){const id=bases[b];if(!id)continue;const to=b===2?3:b===1?(r()<.55?3:2):1;
   if(to<3)occ[to]=id;fates.push({id,from:b,to});}
  occ[0]=batter;fates.push({id:batter,from:-1,to:0});
  return {kind:'1B',bb:type,fielder,word:type==='gb'?(fielder===6||fielder===5?'三遊間':'一二塁間'):NO_WORD[fielder]+'前',miss:true,fates};
 }
 if(type==='gb')return groundOut(bases,outs,batter,c,fielder,word);
 return airOut(bases,outs,batter,c,fielder,type,word);
}

function groundOut(bases:(string|null)[],outs:number,batter:string,c:PlayCtx,fielder:number,word:string):PlayDetail&{kind:'OUT'|'DP'|'FC'|'TP'}{
 const r=c.rnd,fates:Fate[]=[],bs=c.speed(batter);
 const runners=[0,1,2].filter(b=>bases[b]).map(b=>({id:bases[b]!,from:b}));
 const pivot=fielder===4?6:4;// 二塁に入る人(二塁ゴロは遊撃手、ほかは二塁手)
 const roll=r(),roll2=r();
 const runnerStay=(skip:Set<number>)=>{for(const x of runners)if(!skip.has(x.from))fates.push({id:x.id,from:x.from,to:x.from});};
 if(outs===2){
  // 2アウト: 一塁に走者がいれば二塁でフォース(遊撃・二塁・三塁のゴロの半分)、ほかは一塁で打者アウト。どちらも3つ目のフォースなので得点なし。
  if(bases[0]&&(fielder===6||fielder===4||fielder===5)&&roll<.5){
   fates.push({id:bases[0]!,from:0,to:-1,out:'force',at:1,by:[fielder,pivot]});
   fates.push({id:batter,from:-1,to:0});
   for(const x of runners)if(x.from>0)fates.push({id:x.id,from:x.from,to:x.from});// 3つ目のアウトで終わり(得点なし)
   return {kind:'FC',bb:'gb',fielder,word,seq:`${fielder}-${pivot}`,fc:true,fates};
  }
  fates.push({id:batter,from:-1,to:-1,out:'force',at:0,by:fielder===3?[3]:[fielder,3]});runnerStay(new Set());
  return {kind:'OUT',bb:'gb',fielder,word,seq:fielder===3?'3':`${fielder}-3`,fates};
 }
 const sp1=bases[0]?c.speed(bases[0]):55;
 if(bases[0]){
  // 三重殺(無死一二塁か満塁、三塁ゴロ): とてもまれ。
  if(outs===0&&bases[1]&&fielder===5&&roll<.012){
   fates.push({id:bases[1]!,from:1,to:-1,out:'force',at:2,by:[5]},{id:bases[0]!,from:0,to:-1,out:'force',at:1,by:[5,4]},{id:batter,from:-1,to:-1,out:'force',at:0,by:[4,3]});
   if(bases[2])fates.push({id:bases[2],from:2,to:2});
   return {kind:'TP',bb:'gb',fielder,word,seq:'5-4-3',dp:true,tp:true,fates};
  }
  const pDp=dpChance({speed:bs,power:c.power,fielderSkill:c.skill(fielder),pivotSkill:c.skill(pivot),teamField:c.teamField,fielder});
  if(roll<pDp){
   // 併殺: 満塁で投手・一塁・三塁のゴロは本塁→一塁(1-2-3 など)のことがある。ほかは二塁→一塁。
   const homeFirst=bases[1]&&bases[2]&&(fielder===1||fielder===3||fielder===5)&&roll2<.35;
   if(homeFirst){
    fates.push({id:bases[2]!,from:2,to:-1,out:'force',at:3,by:[fielder,2]},{id:batter,from:-1,to:-1,out:'force',at:0,by:[2,3]});
    fates.push({id:bases[1]!,from:1,to:2},{id:bases[0]!,from:0,to:1});
    return {kind:'DP',bb:'gb',fielder,word,seq:`${fielder}-2-3`,dp:true,fates};
   }
   fates.push({id:bases[0]!,from:0,to:-1,out:'force',at:1,by:fielder===4?[4,6]:fielder===6?[6,4]:[fielder,pivot]});
   fates.push({id:batter,from:-1,to:-1,out:'force',at:0,by:[pivot,3]});
   // ほかの走者: 押し出し(二塁は一塁が埋まっているので押される)は進む。三塁の走者は無死なら還る(打点なし)。
   // 3アウトになる時(1アウトからの併殺)は、ほかの走者はそのまま(得点も入らない)。
   for(const x of runners){if(x.from===0)continue;
    if(outs>=1)fates.push({id:x.id,from:x.from,to:x.from});
    else if(x.from===1)fates.push({id:x.id,from:1,to:2});
    else fates.push({id:x.id,from:2,to:(forcedAt(bases,2)||roll2<.75)?3:2});}
   return {kind:'DP',bb:'gb',fielder,word,seq:fielder===3?'3-6-3':`${fielder}-${pivot}-3`,dp:true,fates};
  }
  if(roll<pDp+.24){
   // 野選(先の走者をフォースアウト、打者は一塁へ)。一二塁の三塁ゴロは三塁を踏む。満塁で前に出た内野は本塁で。
   let at=1;
   if(bases[1]&&fielder===5&&roll2<.6)at=2;
   if(bases[1]&&bases[2]&&(fielder===1||fielder===3||fielder===5)&&roll2<.4)at=3;
   const outFrom=at-1;
   fates.push({id:bases[outFrom]!,from:outFrom,to:-1,out:'force',at,by:at===3?[fielder,2]:at===2?[5]:[fielder,pivot]});
   fates.push({id:batter,from:-1,to:0});
   const occ=new Set<number>([0]);
   for(const x of [...runners].reverse()){if(x.from===outFrom)continue;
    const forced=forcedAt(bases,x.from);let to=forced?x.from+1:x.from;
    if(!forced&&x.from===2&&outs+1<3&&r()<clamp(.45+(c.speed(x.id)-55)*.004,.25,.7))to=3;
    if(to<3&&occ.has(to))to=x.from;// 空いていなければ戻る
    fates.push({id:x.id,from:x.from,to});if(to<3)occ.add(to);}
   return {kind:'FC',bb:'gb',fielder,word,seq:at===2?'5':`${fielder}-${at===3?2:pivot}`,fc:true,fates};
  }
 }else{
  // 一塁が空いている: 二塁・三塁の走者はフォースでない(タッチが要る)。三遊間方向へのゴロで三塁へ走ると刺されることがある。
  const r3=bases[2],r2=bases[1];
  if(r3&&roll<.07+(c.arm(fielder)-60)*.002){
   // 三塁走者が本塁を狙ってタッチアウト(野選)。打者は一塁へ。二塁走者は三塁へ。
   fates.push({id:r3,from:2,to:-1,out:'tag',at:3,by:[fielder,2]},{id:batter,from:-1,to:0});
   if(r2)fates.push({id:r2,from:1,to:2});
   return {kind:'FC',bb:'gb',fielder,word,seq:`${fielder}-2`,fc:true,fates};
  }
  if(r2&&!r3&&(fielder===5||fielder===6)&&roll<.10){
   fates.push({id:r2,from:1,to:-1,out:'tag',at:2,by:[fielder,5]},{id:batter,from:-1,to:0});
   return {kind:'FC',bb:'gb',fielder,word,seq:`${fielder}-5`,fc:true,fates};
  }
 }
 // 打者が一塁でアウト。押し出しの走者は1つ進む。そうでない走者は打球の向きと足で。
 fates.push({id:batter,from:-1,to:-1,out:'force',at:0,by:fielder===3?[3]:[fielder,3]});
 const occ=new Set<number>();
 for(const x of [...runners].reverse()){
  const forced=forcedAt(bases,x.from);let to=forced?x.from+1:x.from;
  if(!forced&&x.from===2&&r()<clamp(.63+(c.speed(x.id)-55)*.004,.4,.82))to=3;
  else if(!forced&&x.from===1&&!occ.has(2)&&!bases[2]&&r()<(fielder===3||fielder===4?.78:fielder===1?.45:.30))to=2;
  if(to<3&&occ.has(to))to=x.from;
  fates.push({id:x.id,from:x.from,to});if(to<3)occ.add(to);
 }
 return {kind:'OUT',bb:'gb',fielder,word,seq:fielder===3?'3':`${fielder}-3`,fates};
}

function airOut(bases:(string|null)[],outs:number,batter:string,c:PlayCtx,fielder:number,type:BB,word:string):PlayDetail&{kind:'OUT'|'DP'|'SF'}{
 const r=c.rnd,fates:Fate[]=[{id:batter,from:-1,to:-1,out:'fly',by:[fielder]}];
 const runners=[0,1,2].filter(b=>bases[b]).map(b=>({id:bases[b]!,from:b}));
 const roll=r(),roll2=r();
 if(outs+1>=3){for(const x of runners)fates.push({id:x.id,from:x.from,to:x.from});return {kind:'OUT',bb:type,fielder,word,seq:String(fielder),fates};}
 // ライナー: 飛び出した走者を戻れずにアウト(内野へのライナーで、捕った野手の近くの塁の走者)。
 if(type==='ld'&&fielder<=6&&runners.length&&roll<.16){
  const near=fielder===3?0:fielder===5?(bases[2]?2:bases[1]?1:-1):fielder===4||fielder===6||fielder===1?(bases[1]?1:bases[0]?0:-1):-1;
  if(near>=0&&bases[near]){
   const cover=near===0?3:near===1?(fielder===6?6:4):5;
   fates.push({id:bases[near]!,from:near,to:-1,out:'doubled',at:near,by:fielder===cover?[fielder]:[fielder,cover]});
   for(const x of runners)if(x.from!==near)fates.push({id:x.id,from:x.from,to:x.from});
   return {kind:'DP',bb:type,fielder,word,seq:fielder===cover?`${fielder}u`:`${fielder}-${cover}`,dp:true,fates};
  }
 }
 if(type!=='fb'){for(const x of runners)fates.push({id:x.id,from:x.from,to:x.from});return {kind:'OUT',bb:type,fielder,word,seq:String(fielder),fates};}
 // 外野フライ: 捕った後にタッチアップ。三塁走者は本塁へ(肩で刺されることがある)、二塁走者は三塁へ。
 let kind:'OUT'|'DP'|'SF'='OUT',laser=false;const occ=new Set<number>();
 const r3=bases[2];let outsNow=outs+1;
 if(r3){
  const sp=c.speed(r3),arm=c.arm(fielder);
  const go=roll<clamp(.68+(sp-55)*.004-(arm-60)*.004+(fielder===8?.06:0),.4,.9);
  if(go){
   const thrown=roll2<clamp(.07+(arm-60)*.004-(sp-55)*.003,.02,.20);
   if(thrown){fates.push({id:r3,from:2,to:-1,out:'tag',at:3,by:[fielder,2]});kind='DP';outsNow++;laser=arm>=75;}
   else{fates.push({id:r3,from:2,to:3});kind='SF';}
  }else{fates.push({id:r3,from:2,to:2});occ.add(2);}
 }
 for(const x of [...runners].reverse()){if(x.from===2)continue;
  let to=x.from;
  if(outsNow<3){
   if(x.from===1&&!occ.has(2)&&r()<(fielder===9?.45:fielder===8?.35:.15))to=2;
   else if(x.from===0&&!bases[1]&&r()<.04)to=1;
  }else r();
  if(occ.has(to))to=x.from;occ.add(to);fates.push({id:x.id,from:x.from,to});
 }
 return {kind,bb:type,fielder,word,seq:kind==='DP'?`${fielder}-2`:String(fielder),dp:kind==='DP',laser,fates};
}

/** 安打になる打球を、守備の高い野手がファインプレーで捕るか(捕れば打者アウト。走者は塁へ戻る・押されて進む)。
 *  hit=1〜3(本塁打は対象外)。乱数はいつも2つ使う。 */
export function hitPlay(amount:1|2|3,bases:(string|null)[],outs:number,batter:string,c:PlayCtx):{word:string;fielder:number;fine:PlayDetail|null}{
 const r=c.rnd,wr=r(),fr=r();
 let word:string,fielder:number,zone:'in'|'of'|'wall';
 if(amount===1){
  const w=pick(()=>wr,[['三遊間',.20],['一二塁間',.18],['レフト前',.21],['センター前',.22],['ライト前',.19]]) as string;
  word=w;fielder=w==='三遊間'?6:w==='一二塁間'?4:w==='レフト前'?7:w==='センター前'?8:9;zone=fielder<=6?'in':'of';
 }else{
  const w=pick(()=>wr,[['左中間',.3],['右中間',.3],['レフト線',.2],['ライト線',.2]]) as string;
  word=w;fielder=w==='左中間'?8:w==='右中間'?8:w==='レフト線'?7:9;zone='wall';
  if(w==='左中間'&&c.skill(7)>c.skill(8))fielder=7;if(w==='右中間'&&c.skill(9)>c.skill(8))fielder=9;
 }
 if(fr>=fineChance(c.skill(fielder),zone))return {word,fielder,fine:null};
 // ファインプレー: 打者アウト。内野は飛びついて一塁へ、外野は飛び込む・壁際で捕る(走者は戻る)。
 const fates:Fate[]=[];const runners=[0,1,2].filter(b=>bases[b]).map(b=>({id:bases[b]!,from:b}));
 if(zone==='in'){
  fates.push({id:batter,from:-1,to:-1,out:'force',at:0,by:[fielder,3]});
  for(const x of [...runners].reverse()){const forced=forcedAt(bases,x.from);fates.push({id:x.id,from:x.from,to:outs+1<3&&forced?Math.min(3,x.from+1):x.from});}
  // 2アウトでなく、満塁の押し出しで本塁に入った走者は、打者が一塁でアウトになる前に… 3つ目でなければ得点(ゴロの間)。
  return {word,fielder,fine:{bb:'gb',fielder,word:NO_WORD[fielder]+'ゴロ',seq:`${fielder}-3`,fine:fielder===6||fielder===4?'dive':'slide',fates}};
 }
 fates.push({id:batter,from:-1,to:-1,out:'fly',by:[fielder]});
 for(const x of runners)fates.push({id:x.id,from:x.from,to:x.from});
 return {word,fielder,fine:{bb:'fb',fielder,word:NO_WORD[fielder]+'フライ',seq:String(fielder),fine:zone==='wall'?'wall':'dive',fates}};
}

/** プレーの言葉(実況の一文の中身)。 */
export function playCall(d:PlayDetail,name:string,fielderName:string|null):string{
 const who=fielderName?`${NO_WORD[d.fielder]}${fielderName}`:NO_WORD[d.fielder];
 if(d.tp)return `${d.word}、${d.seq} のトリプルプレー!`;
 if(d.fine==='dive')return `${who}、ダイビングキャッチ! ファインプレー!`;
 if(d.fine==='slide')return `${who}、滑り込んで好捕! ファインプレー!`;
 if(d.fine==='wall')return `${who}、フェンス際で好捕! ファインプレー!`;
 if(d.laser)return `${name}、${d.word}…${NO_WORD[d.fielder]}からレーザービーム! 本塁タッチアウト!`;
 if(d.dp&&d.bb==='gb')return `${d.word}、${d.seq} のダブルプレー!`;
 if(d.dp)return `${d.word}! 飛び出した走者も戻れずダブルプレー!`;
 const forced=d.fates.find(f=>f.from>=0&&f.out==='force'),tagged=d.fates.find(f=>f.from>=0&&f.out==='tag');
 if(d.fc&&forced)return `${d.word}、${['','二塁','三塁','本塁'][forced.at!]}でフォースアウト。打者は一塁へ。`;
 if(d.fc&&tagged)return `${d.word}、${['','二塁','三塁','本塁'][tagged.at!]}でタッチアウト。打者は一塁へ。`;
 return '';
}
