import {formatUZR} from './fielding-stats';
import './team-uzr.css';

export function TeamUZR({uzr,uzrGames,games,rank}:{uzr:number|null;uzrGames:number;games:number;rank:number|null}){
 const value=formatUZR(uzr),tone=value.startsWith('+')?'positive':value.startsWith('-')?'negative':'neutral';
 const note=uzr===null?'未記録':uzrGames>0&&uzrGames<games?`記録開始後の${uzrGames}試合分`:'ゲーム内推定';
 return <div className={`team-uzr-summary ${tone}`} role="group" aria-label="チームUZR">
  <div className="team-uzr-label"><span title="守備による失点抑止への貢献を表すゲーム内推定値。プラスが大きいほど良い成績です。">チームUZR</span><small>{note}</small></div>
  <div className="team-uzr-result"><strong>{value}</strong>{rank!==null&&<small className={'team-uzr-rank'+(rank===1?' is-first':'')}>{rank}位</small>}</div>
 </div>;
}
