import { clamp,contextFor,playerMap,type Player,type Ratings } from './data';
import { wikiMatchEffects,wikiRunningEffects,type MatchSituation } from './wiki-traits';
import {developedRatings} from './development';
import type {Circuit} from './leagues';
import {pitchingRatingsForRole,type PitcherRole} from './pitcher-aptitude';

// MLB uses its own run environment instead of NPB's lower HR/K baselines.
// Each MLB identity contributes once even if roster snapshots contain repeats.
const majorEvidence=[...new Map(Object.values(playerMap).filter(p=>p.opponentOnly).map(p=>[p.mlb!.id,p])).values()];
const majorTotals=majorEvidence.reduce((a,p)=>{const b=p.batting,q=p.pitching;a.bf+=q?.bf??0;a.k+=q?.so??0;a.bb+=q?.bb??0;a.hr+=q?.hr??0;a.hits+=(b?.hits??0)-(b?.hr??0);a.bip+=(b?.ab??0)-(b?.so??0)-(b?.hr??0)+(b?.sf??0);return a;},{bf:0,k:0,bb:0,hr:0,hits:0,bip:0});
const majorEnvironment={k:majorTotals.k/Math.max(1,majorTotals.bf),bb:majorTotals.bb/Math.max(1,majorTotals.bf),hr:majorTotals.hr/Math.max(1,majorTotals.bf),babip:majorTotals.hits/Math.max(1,majorTotals.bip)};

// Anchor every player's displayed base abilities to their recorded performance.
// Changes to an ability act on its corresponding event, without counting the
// source performance twice. Keep a copy so ability edits cannot move the anchor.
const referenceRatings = new Map(Object.values(playerMap).map(p => [p.id, { ...(p.simulationBaseline??p.ratings) }]));
export function gameRatings(player: Player, bonus = 0, stage = 0): Ratings {
  return developedRatings(player,stage,bonus);
}
export function matchupProbabilities(batter: Player, pitcher: Player, batBonus = 0, pitchBonus = 0, defense = 0, situation:MatchSituation = {}, batStage=0, pitchStage=0,circuit:Circuit='NPB',pitcherRole?:PitcherRole) {
  const b = batter.batting, q = pitcher.pitching, lg = contextFor(pitcher);
  const batting = gameRatings(batter, batBonus,batStage), pitching = pitchingRatingsForRole(pitcher,gameRatings(pitcher, pitchBonus,pitchStage),pitcherRole);
  const batBase = referenceRatings.get(batter.id) ?? batter.ratings, pitBase = referenceRatings.get(pitcher.id) ?? pitcher.ratings;
  const traits=wikiMatchEffects(batter,pitcher,situation);
  const contact = clamp(batting.contact+traits.contact,0,99) - batBase.contact, power = clamp(batting.power+traits.power,0,99) - batBase.power, speed = batting.speed - batBase.speed;
  const control = clamp(pitching.control+traits.control,0,99) - pitBase.control, stuff = .65 * (clamp(pitching.breaking+traits.stuff,0,99) - pitBase.breaking) + .35 * (pitching.velocity - pitBase.velocity);
  const pa = b?.pa ?? 0, ab = b?.ab ?? 0, bf = q?.bf ?? 0;
  const major=circuit!=='NPB',lgK=major?majorEnvironment.k:lg.pitching.kPct??.20,lgBB=major?majorEnvironment.bb:lg.pitching.bbPct??.08,lgHR=major?majorEnvironment.hr:lg.p.hr/Math.max(1,lg.p.bf),lgBabip=major?majorEnvironment.babip:lg.batting.babip??.29;
  // MLB opponents and their league environment already add a substantial gap.
  // Use a half-strength additional translation so promoted NPB regulars can
  // compete; developed abilities still reduce it, and MLB cards are exempt.
  const batTransition=major&&!batter.mlb ? .5*clamp(1-(batting.contact*.65+batting.power*.35-55)/100,.55,1.15) : 0;
  const pitTransition=major&&!pitcher.mlb ? .5*clamp(1-(pitching.control*.5+pitching.breaking*.5-55)/100,.55,1.15) : 0;
  // NPB rates translate modestly; developed strengths soften the adjustment.
  // MLB cards already use MLB results, so do not apply a second transition.
  const walk = clamp(((b?.bb ?? 0) + lgBB * 120) / (pa + 120) * ((q?.bb ?? 0) + lgBB * 180) / (bf + 180) / Math.max(.01, lgBB) * Math.exp(-control * .018)*traits.walk*(1-.05*batTransition)*(1+.08*pitTransition), .015, .24);
  const hbp = clamp((((b?.hbp ?? 0) + 1.2) / (pa + 120) * .5 + ((q?.hbp ?? 0) + 1.8) / (bf + 180) * .5) * Math.exp(-control * .008), .002, .04);
  const nonFree = 1 - walk - hbp;
  const trajectoryFactor=batter.wikiAssessment?.ratings.trajectory===undefined?1:1+(batter.wikiAssessment.ratings.trajectory-2)*.06;
  const strikeout = clamp(((b?.so ?? 0) + lgK * 120) / (pa + 120) * ((q?.so ?? 0) + lgK * 180) / (bf + 180) / Math.max(.01, lgK) * Math.exp(stuff * .016 - contact * .014)*(1+.14*batTransition)*(1-.08*pitTransition) / nonFree, .05, .45);
  // A player with few plate appearances should not inherit league-average power.
  // Apply ability changes to observed HRs, and use absolute power for the prior.
  const powerPrior=.0003+Math.pow(clamp(batting.power+traits.power,0,99)/100,4)*.10;
  const homeRun = clamp(((b?.hr ?? 0)*Math.exp(power*.022)+powerPrior*150)/(pa+150) * ((q?.hr ?? 0) + lgHR * 240) / (bf + 240) / Math.max(.005, lgHR) * Math.exp(-stuff * .012)*traits.homeRun*trajectoryFactor*(1-.15*batTransition)*(1+.16*pitTransition) / nonFree, .0002, .12);
  const babip = clamp(((b?.hits ?? 0) - (b?.hr ?? 0) + lgBabip * 180) / (Math.max(0, ab - (b?.so ?? 0) - (b?.hr ?? 0) + (b?.sf ?? 0)) + 180) + contact * .0012 - stuff * .0004 - defense-.010*batTransition+.006*pitTransition, .18, .41);
  const hit = homeRun + (1 - strikeout - homeRun) * babip;
  const triple = Math.min((hit - homeRun) * .2, ((b?.triples ?? 0) + 1) / (ab + 150) * Math.exp(speed * .035));
  const double = Math.min(hit - homeRun - triple, ((b?.doubles ?? 0) + 7) / (ab + 150) * Math.exp(power * .018)*(1-.05*batTransition));
  return { walk, hbp, strikeout, homeRun, babip, hit, triple, double };
}

export const extraBaseChance = (runner: Player, runnerBonus: number, outfieldArm: number,stage=0) =>
  clamp(.42 + (gameRatings(runner, runnerBonus,stage).speed - 55) * .004 - (outfieldArm - 61) * .003 + wikiRunningEffects(runner).advance, .12, .75);

export function stealProbabilities(runner: Player, bonus: number, catcherArm: number, catcherField: number,stage=0) {
  const successful = runner.batting?.sb ?? 0, caught = runner.batting?.cs ?? 0;
  const base = referenceRatings.get(runner.id) ?? runner.ratings, speed = gameRatings(runner, bonus,stage).speed - base.speed;
  const effects=wikiRunningEffects(runner);
  // One decision per eligible trip to first base. Small-sample runners regress
  // toward a modest speed-based tendency; growth cannot multiply attempts endlessly.
  const prior=clamp((base.speed-35)*.0015,.005,.08);
  const opportunities=Math.max(60,(runner.batting?.hits??0)+(runner.batting?.bb??0)+(runner.batting?.hbp??0));
  const attempt = clamp((successful+caught+prior*40)/(opportunities+40)*1.7*clamp(Math.exp(speed*.015),.65,1.7)*effects.attempt,0,.45);
  const success = clamp((successful + 7.5) / (successful + caught + 10) + speed * .002 - (catcherArm - 66) * .003 - (catcherField - 60) * .001 + effects.success, .30, .92);
  return { attempt, success };
}
