import {findPlayer,players} from '../src/pro/data';
import {initialState,initialSandboxState,type GameState} from '../src/pro/engine';
import {buildByStrategy} from '../src/pro/franchise';

export function npbDifficultySquads():[string,GameState][]{
 const base=initialState(428374);
 const recruits=['森下翔太','牧秀悟','近本光司','才木浩人','東克樹'].map(name=>findPlayer(name).id);
 const reinforced=buildByStrategy({...base,owned:{...base.owned,...Object.fromEntries(recruits.map(id=>[id,1]))}},'balanced');
 const developed=buildByStrategy({...reinforced,training:Object.fromEntries(Object.keys(reinforced.owned).map(id=>[id,2]))},'balanced');
 const stars=buildByStrategy({...base,owned:Object.fromEntries(players.filter(p=>!p.mlb).map(p=>[p.id,1]))},'balanced');
 return [['初期',base],['主力5人を補強',reinforced],['主力5人を補強・覚醒2',developed],['バランスのよい主力編成',initialSandboxState()],['NPB選抜・未覚醒',stars]];
}
