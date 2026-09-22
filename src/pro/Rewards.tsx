import { useEffect,useRef,useState,type ReactNode } from 'react';
import { Diamond,Gift,Sparkles,Trophy,Zap } from 'lucide-react';
import { effectiveOverall,type GameState } from './engine';
import { playerMap } from './data';
import { Confetti } from './ScoutOpening';
import { currencyName,isCareer,seasonReward } from './progression';

type Reward={title:string;kicker:string;detail:string;items:{label:string;value:string}[]};
export function rewardBetween(before:GameState,after:GameState):Reward|null{
 const a=after.franchise,b=before.franchise;
 if(before.season.number===after.season.number&&after.season.day>before.season.day)return null;
 if(a.claimed.length>b.claimed.length&&a.claimed.filter(id=>!b.claimed.includes(id)).every(id=>id.startsWith('contract-')))return null;
 if(before.season.number===after.season.number&&before.season.postseason?.stage!=='complete'&&after.season.postseason?.stage==='complete'){const champion=after.season.postseason.champion===after.club;return {title:champion?'日本一、おめでとう。':'一年の物語、完結。',kicker:champion?'JAPAN CHAMPION':'YEAR COMPLETE',detail:champion?after.name+'が頂点に立ちました。':'獲得した報酬で、次のシーズンを強く。',items:[{label:currencyName(after),value:'+'+(after.gems-before.gems).toLocaleString()},{label:'UR確定チケット',value:'+'+(a.tickets-b.tickets)},{label:'育成ポイント',value:'+'+(a.points-b.points)}]};}
 if(before.season.number===after.season.number&&!before.season.completed&&after.season.completed){const t=after.season.standings.find(t=>t.team===after.club)!;return {title:'143試合、走破。',kicker:'SEASON COMPLETE',detail:`${after.name} · ${t.w}勝 ${t.l}敗 ${t.d}分`,items:[{label:isCareer(after)?'この進行で獲得したスカウトpt':'完走ジェム',value:'+'+(isCareer(after)?after.gems-before.gems:seasonReward(after)).toLocaleString()},{label:'UR確定チケット',value:'+1'},{label:'この進行で獲得した育成pt',value:`+${a.points-b.points}`} ]};}
 if(isCareer(after)&&before.season.number===after.season.number&&after.season.day>before.season.day){
  const games=after.season.results.slice(before.season.day),wins=games.filter(g=>g.home===after.club?g.homeRuns>g.awayRuns:g.awayRuns>g.homeRuns).length,draws=games.filter(g=>g.homeRuns===g.awayRuns).length;
  return {title:after.gems>=300?'次の一枚が、待っている。':'チームは、一歩前へ。',kicker:'PLAY REWARD',detail:games.length+'試合 · '+wins+'勝 '+(games.length-wins-draws)+'敗 '+draws+'分',items:[{label:'スカウトポイント',value:'+'+(after.gems-before.gems).toLocaleString()},{label:'育成ポイント',value:'+'+(a.points-b.points)},{label:'次の1枚まで',value:after.gems>=300?'スカウト可能':'あと'+(300-after.gems)+'pt'}]};
 }
 if(a.claimed.length>b.claimed.length)return {title:'達成報酬、獲得。',kicker:'MISSION CLEAR',detail:`${a.claimed.length-b.claimed.length}件のミッションを達成`,items:[{label:currencyName(after),value:`+${(after.gems-before.gems).toLocaleString()}`},{label:'育成ポイント',value:`+${a.points-b.points}`}]};
 const trained=Object.keys(after.training).find(id=>(after.training[id]??0)>(before.training[id]??0));
 if(trained){const p=playerMap[trained];return {title:after.training[trained]===5?'限界まで、強く。':'推しが、進化した。',kicker:after.training[trained]===5?'TRAINING MAX':'POWER UP',detail:`${p.name} · 育成 Lv.${after.training[trained]}`,items:[{label:'総合力 OVR',value:`${effectiveOverall(p,before.owned,before.training)} → ${effectiveOverall(p,after.owned,after.training)}`},{label:'能力補正（上限99）',value:'+1'}]};}
 if(a.stadium>b.stadium)return {title:'ホームが、進化。',kicker:'STADIUM UPGRADE',detail:`スタジアム Lv.${b.stadium} → Lv.${a.stadium}`,items:[{label:isCareer(after)?'毎試合の基本スカウトpt':'毎試合のジェム報酬',value:`${(isCareer(after)?60:75)+(b.stadium-1)*5} → ${(isCareer(after)?60:75)+(a.stadium-1)*5}`} ]};
 if(!isCareer(after)&&!b.established&&a.established)return {title:'新たな球団、誕生。',kicker:'YOUR DYNASTY BEGINS',detail:after.name,items:[{label:'初代URスター',value:a.captain?playerMap[a.captain].name:''},{label:'創設ジェム',value:'+2,700'}]};
 return null;
}

export function RewardWatcher({state,modal,onScout}:{state:GameState;onScout?:()=>void;modal:(children:ReactNode,onClose:()=>void)=>ReactNode}){
 const previous=useRef(state),[reward,setReward]=useState<Reward|null>(null);
 useEffect(()=>{const found=rewardBetween(previous.current,state);previous.current=state;if(found)setReward(found);},[state]);
 if(!reward)return null;
 const close=()=>setReward(null);
 return modal(<div className="reward-celebration"><Confetti/><div className="reward-medallion">{reward.kicker==='SEASON COMPLETE'?<Trophy size={45}/>:reward.kicker.includes('TRAINING')||reward.kicker==='POWER UP'?<Zap size={45}/>:<Gift size={45}/>}</div><div className="eyebrow">{reward.kicker}</div><h2>{reward.title}</h2><p>{reward.detail}</p><div className="reward-prizes">{reward.items.map(item=><div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}</div><div className="reward-career-actions">{isCareer(state)&&state.gems>=300&&onScout&&<button className="btn primary" onClick={()=>{close();onScout();}}><Sparkles size={18}/>1枚スカウトへ</button>}<button className="btn gold" onClick={close}><Sparkles size={18}/>受け取った！ 次へ</button></div><span className="reward-saved"><Diamond size={12}/>報酬は自動保存されています</span></div>,close);
}
