import {grade,teamById,type Player} from './data';
import {ownedRatings,ratingOverall} from './development';
import {DRAFT_EVENT,draftEventActive} from './draft-event';
import type {ScoutTier} from './scout-presentation';

// Hashtags on every post. Brand tags first so the game is findable; genre tags
// reach people who follow baseball and phone games. The draft tag is added only
// while the draft event runs.
export const SHARE_TAGS=['#DIAMONDNINE','#ダイヤモンドナイン','#野球ゲーム','#プロ野球','#スマホゲーム'] as const;
export const shareTags=(now:Date|null=new Date())=>[...SHARE_TAGS,...(draftEventActive(now)?[DRAFT_EVENT.tag]:[])].join(' ');

// X counts most CJK characters and emoji as 2 and every URL as 23. Posts must stay
// within 280 or the intent page refuses to post them.
export function xWeightedLength(text:string):number{
 let n=0;const urls=text.match(/https?:\/\/\S+/g)??[];let rest=text;
 for(const url of urls){rest=rest.replace(url,'');n+=23;}
 for(const ch of rest){const c=ch.codePointAt(0)!;n+=(c<=0x10ff||(c>=0x2000&&c<=0x200d)||(c>=0x2010&&c<=0x201f)||(c>=0x2032&&c<=0x2037))?1:2;}
 return n;
}

export interface ScoutShareData {name:string;team:string;teamColor:string;role:string;overall:number;tier:ScoutTier;isNew:boolean;overseas:boolean;rookie:boolean;abilities:[string,number|string][]}
export function scoutShareData(player:Player,owned:Record<string,number>,training:Record<string,number>,tier:ScoutTier,isNew:boolean,rookie=false):ScoutShareData{
 const r=ownedRatings(player,owned,training),team=teamById(player.team);
 const abilities:[string,number|string][]=player.role==='pitcher'?[['球速',`${r.velocity}km/h`],['制球',r.control],['スタミナ',r.stamina],['変化',r.breaking]]:[['ミート',r.contact],['パワー',r.power],['走力',r.speed],['肩',r.arm],['守備',r.field]];
 return {name:player.name,team:team?.short??'',teamColor:team?.color??'#7551c9',role:player.role==='pitcher'?'投手':player.positions.join('・')||'DH',overall:ratingOverall(player,r),tier,isNew,overseas:!!player.mlb,rookie,abilities};
}
export function scoutPostText(d:ScoutShareData,url='',now:Date|null=new Date()):string{
 const catchLine=d.tier==='rainbow'?'虹カードきた！！':d.tier==='gold'?(d.overseas?'海外選手きた！':'金カードきた！'):d.rookie?'ルーキー獲得！':'新戦力を獲得！';
 const head=`${catchLine}\nDIAMOND NINEのスカウトで「${d.name.replace(/\s+/g,' ')}」（${d.team}・総合${d.overall}）${d.isNew?'が加入':'を重ねて獲得'}⚾`;
 return `${head}\n${shareTags(now)}${url?'\n'+url:''}`;
}

const TIER_STYLE:Record<ScoutTier,{bg:[string,string,string];label:string;ink:string}>={
 rainbow:{bg:['#ffd6f2','#d9f0ff','#fff3c4'],label:'RAINBOW',ink:'#6a2fa8'},
 gold:{bg:['#fff4c7','#ffe28a','#fff8e3'],label:'GOLD',ink:'#8a5a00'},
 standard:{bg:['#eef3ff','#f7f9ff','#e9f6ef'],label:'NEW PLAYER',ink:'#3f4f73'},
};
export const SCOUT_IMAGE_SIZE=1080;
export async function renderScoutImage(d:ScoutShareData,url=''):Promise<Blob>{
 if(typeof document!=='undefined'&&document.fonts)await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=SCOUT_IMAGE_SIZE;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
 const head='"Dela Gothic One","Noto Sans JP",sans-serif',font='"Noto Sans JP","Yu Gothic","Hiragino Kaku Gothic ProN",Meiryo,sans-serif',num='"Russo One","Noto Sans JP",sans-serif';
 const text=(v:string,x:number,y:number,size:number,color:string,weight=800,align:CanvasTextAlign='center',face=font,max?:number)=>{
  ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`${weight} ${size}px ${face}`;
  while(max&&ctx.measureText(v).width>max&&size>16){size--;ctx.font=`${weight} ${size}px ${face}`;}
  ctx.fillText(v,x,y);
 };
 const box=(x:number,y:number,w:number,h:number,fill:string|CanvasGradient,r=28)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
 const style=TIER_STYLE[d.tier],bg=ctx.createLinearGradient(0,0,1080,1080);
 bg.addColorStop(0,style.bg[0]);bg.addColorStop(.55,style.bg[1]);bg.addColorStop(1,style.bg[2]);ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1080);
 // light rays behind the card
 ctx.save();ctx.translate(540,520);ctx.globalAlpha=.18;
 for(let i=0;i<16;i++){ctx.rotate(Math.PI/8);ctx.fillStyle=i%2?'#ffffff':d.tier==='standard'?'#b9c6ea':style.ink;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-60,-760);ctx.lineTo(60,-760);ctx.closePath();ctx.fill();}
 ctx.restore();
 box(56,44,56,56,'#7551c9',18);text('9',84,86,36,'#fff',900);text('DIAMOND NINE',128,86,32,'#3b2f63',900,'left');
 text(d.tier==='standard'?'SCOUT RESULT':`${style.label} · SCOUT RESULT`,1024,84,26,style.ink,800,'right',num);
 // card
 const cardX=250,cardY=150,cardW=580,cardH=720;
 ctx.save();ctx.shadowColor='rgba(40,30,80,.35)';ctx.shadowBlur=40;ctx.shadowOffsetY=16;box(cardX,cardY,cardW,cardH,'#ffffff',36);ctx.restore();
 const band=ctx.createLinearGradient(cardX,cardY,cardX+cardW,cardY+260);band.addColorStop(0,d.teamColor);band.addColorStop(1,d.tier==='rainbow'?'#b36bff':d.tier==='gold'?'#e0a100':'#5b7bd5');
 box(cardX+18,cardY+18,cardW-36,300,band,26);
 text(d.team,cardX+46,cardY+72,34,'#ffffff',900,'left',font,300);
 text(d.role,cardX+cardW-46,cardY+72,28,'rgba(255,255,255,.92)',800,'right',font,220);
 text('総合',cardX+cardW/2,cardY+150,30,'rgba(255,255,255,.9)',800);
 text(String(d.overall),cardX+cardW/2,cardY+280,150,'#ffffff',900,'center',num);
 text(d.name,cardX+cardW/2,cardY+390,58,'#1f2b48',400,'center',head,cardW-60);
 const tags=[d.isNew?'NEW':'重複で能力UP',d.overseas?'海外':'',d.rookie?'ルーキー':''].filter(Boolean);
 let tx=cardX+cardW/2-(tags.length*150-20)/2;
 for(const t of tags){box(tx,cardY+418,130,44,d.tier==='rainbow'?'#efe2ff':'#fff1c9',22);text(t,tx+65,cardY+449,22,style.ink,900);tx+=150;}
 const rowY=cardY+500,cols=d.abilities.length,colW=(cardW-60)/cols;
 d.abilities.forEach(([label,value],i)=>{
  const x=cardX+30+colW*i+colW/2;
  text(label,x,rowY+30,24,'#67738a',700);
  const g=typeof value==='number'?grade(value):'';
  text(typeof value==='number'?`${g}`:String(value),x,rowY+100,typeof value==='number'?56:30,typeof value==='number'?(value>=90?'#c98a00':value>=80?'#e0245e':value>=70?'#f05a1a':'#3f5aa8'):'#237f9a',900,'center',num,colW-8);
  if(typeof value==='number')text(String(value),x,rowY+140,26,'#596886',700,'center',num);
 });
 text('選手を集めて、育てて、自分だけのチームを。',540,950,34,'#3b2f63',900);
 text(url?url.replace(/^https?:\/\//,''):SHARE_TAGS.slice(0,3).join('  '),540,1000,26,'#596886',700,'center','"Noto Sans JP",sans-serif',960);
 text('国内・海外の選手が登場する非公式シミュレーション',540,1044,20,'#8991a0',500,'center','"Noto Sans JP",sans-serif');
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG unavailable')),'image/png'));
}
