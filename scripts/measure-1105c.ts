// 11/5 併殺・細かいプレーを入れた前と後で、600試合ずつの数字を比べる(得点・打率・防御率・エラー・併殺打・ファインプレー)。
// 使い方: node scripts/measure-1105c.mjs [試合数=600] [シード=7]
import {initialState,playGame,rng,gameSteps,type GameState} from '../src/pro/engine';
import {teams} from '../src/pro/data';
const N=Number(process.argv[2]??600),seed=Number(process.argv[3]??7);
const state:GameState=initialState(seed);state.season.day=0;
const random=rng(seed*7919+1);
const ids=teams.map(t=>t.id).filter(id=>id!==state.club);
let runs=0,games=0,errors=0,innings=0;
const kinds:Record<string,number>={};const fine:Record<string,number>={};
for(let g=0;g<N;g++){
 const home=ids[g%ids.length],away=ids[(g*5+3)%ids.length]===home?ids[(g+1)%ids.length]:ids[(g*5+3)%ids.length];
 state.season.day=g%120;
 // 1年進めると同じ計算(gameSteps を指示なし)。出来事の種類も数えるため interactive で回す(指示は出さない)。
 const steps=gameSteps(state,home,away,random,{interactive:true,control:-1});let s=steps.next();
 while(!s.done){if(s.value.type==='event'){const e=s.value.e as any;kinds[e.kind]=(kinds[e.kind]??0)+1;if(e.play?.fine)fine[e.play.fine]=(fine[e.play.fine]??0)+1;if(e.play?.laser)kinds.laser=(kinds.laser??0)+1;}s=steps.next(null);}
 const r=s.value;runs+=r.homeRuns+r.awayRuns;games++;errors+=(r.errors?.[0]??0)+(r.errors?.[1]??0);innings+=r.innings;
}
const B=Object.values(state.season.batting),P=Object.values(state.season.pitching);
const sum=(a:any[],k:string)=>a.reduce((n,x)=>n+(x[k]??0),0);
const ab=sum(B,'ab'),h=sum(B,'hits'),pa=sum(B,'pa'),bb=sum(B,'bb'),hbp=sum(B,'hbp'),sf=sum(B,'sf'),hr=sum(B,'hr'),so=sum(B,'so'),gdp=sum(B,'gdp'),sb=sum(B,'sb');
const outs=sum(P,'outs'),er=sum(P,'er');
const out={games,runsPerTeamGame:+(runs/games/2).toFixed(3),avg:+(h/ab).toFixed(3),obp:+((h+bb+hbp)/(ab+bb+hbp+sf)).toFixed(3),era:+(er*27/outs).toFixed(2),errorsPerTeamGame:+(errors/games/2).toFixed(3),hrPerTeamGame:+(hr/games/2).toFixed(3),kPct:+(so/pa).toFixed(3),gdpPerTeamGame:+(gdp/games/2).toFixed(3),sbPerTeamGame:+(sb/games/2).toFixed(3),pa,kinds,fine};
console.log(JSON.stringify(out));
