import type { Player } from './data';
export interface MatchSituation { scoringPosition?:boolean }
const steps:Record<string,number>={A:2,B:1,F:-1,G:-2};
const step=(traits:Set<string>,prefix:string)=>Object.entries(steps).reduce((n,[letter,v])=>n+(traits.has(prefix+letter)?v:0),0);
export const traitDescriptions:Record<string,string>={
 AH:'ミート＋6',PH:'パワー＋6',広角打法:'パワー＋3',プルヒッター:'パワー＋3',流し打ち:'ミート＋2',三振:'ミート−4',
 選球眼:'四球の確率×1.15',積極打法:'四球の確率×0.92',慎重打法:'四球の確率×1.08',
 奪三振:'投球の変化・球威補正＋4', 'キレ○':'投球の変化・球威補正＋3',四球:'制球−5',乱調:'制球−3',荒れ球:'制球−4・変化/球威＋2',
 一発:'被本塁打の確率×1.12',逃げ球:'被本塁打の確率×0.90',積極盗塁:'盗塁企図×1.20',慎重盗塁:'盗塁企図×0.80',積極走塁:'追加進塁の確率＋3ポイント',
 二刀流:'同じカードを投手とDHに同時起用',精密制球:'制球＋4',
};
for(const [letter,v] of Object.entries(steps)){
 const signed=(n:number)=>n>0?'＋'+n:'−'+Math.abs(n);
 traitDescriptions['チャンス'+letter]=`得点圏でミート${signed(v*4)}・パワー${signed(v*2)}`;
 traitDescriptions['対左投手'+letter]=`左投手にミート${signed(v*4)}・パワー${signed(v*2)}`;
 traitDescriptions['対左打者'+letter]=`左打者に制球${signed(v*3)}・変化/球威${signed(v*3)}`;
 traitDescriptions['対ピンチ'+letter]=`得点圏で制球${signed(v*3)}・変化/球威${signed(v*3)}`;
 traitDescriptions['ノビ'+letter]=`投球の変化・球威補正${signed(v*3)}`;
 traitDescriptions['走塁'+letter]=`追加進塁の確率${signed(v*3)}ポイント`;
 traitDescriptions['盗塁'+letter]=`盗塁成功の確率${signed(v*2.5)}ポイント`;
}
const traits=(p:Player)=>new Set(p.wikiAssessment?.traits??(p.mlb?p.traits:[]));
export function wikiMatchEffects(batter:Player,pitcher:Player,situation:MatchSituation={}){
 const b=traits(batter),p=traits(pitcher),chance=situation.scoringPosition?step(b,'チャンス'):0,left=pitcher.throws==='左'?step(b,'対左投手'):0;
 const pinch=situation.scoringPosition?step(p,'対ピンチ'):0,leftBat=batter.bats==='左'||(batter.bats==='両'&&pitcher.throws!=='左')?step(p,'対左打者'):0;
 return {contact:(b.has('AH')?6:0)+(b.has('流し打ち')?2:0)-(b.has('三振')?4:0)+(chance+left)*4,
 power:(b.has('PH')?6:0)+(b.has('広角打法')||b.has('プルヒッター')?3:0)+(chance+left)*2,
 control:(pinch+leftBat)*3+(p.has('精密制球')?4:0)-(p.has('四球')?5:0)-(p.has('乱調')?3:0)-(p.has('荒れ球')?4:0),
 stuff:(pinch+leftBat+step(p,'ノビ'))*3+(p.has('キレ○')?3:0)+(p.has('奪三振')?4:0)+(p.has('荒れ球')?2:0),
 walk:(b.has('選球眼')?1.15:1)*(b.has('積極打法')?.92:1)*(b.has('慎重打法')?1.08:1),
 homeRun:(p.has('一発')?1.12:1)*(p.has('逃げ球')?.9:1)};
}
export function wikiRunningEffects(runner:Player){const t=traits(runner);return {advance:step(t,'走塁')*.03+(t.has('積極走塁')?.03:0),attempt:(t.has('積極盗塁')?1.2:1)*(t.has('慎重盗塁')?.8:1),success:step(t,'盗塁')*.025};}
