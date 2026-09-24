import type {VictoryShareData} from './victory-share';
import {grade} from './data';

export const VICTORY_IMAGE_WIDTH=1080;
export const VICTORY_IMAGE_HEIGHT=2460;

// Render game data locally: no screen-capture permission, external image host,
// fonts or cross-origin assets are needed to create the shareable PNG.
export async function renderVictoryImage(data:VictoryShareData,url=''):Promise<Blob>{
 if(document.fonts)await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=VICTORY_IMAGE_WIDTH;canvas.height=VICTORY_IMAGE_HEIGHT;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
 const font='"Noto Sans JP", "Yu Gothic", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';
 const text=(value:string,x:number,y:number,size=26,color='#253552',weight=600,align:CanvasTextAlign='left',maxWidth?:number)=>{
  ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`${weight} ${size}px ${font}`;
  while(maxWidth&&ctx.measureText(value).width>maxWidth&&size>14){size--;ctx.font=`${weight} ${size}px ${font}`;}
  ctx.fillText(value,x,y,maxWidth);
 };
 const box=(x:number,y:number,w:number,h:number,color:string,r=22)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
 const wash=ctx.createLinearGradient(0,0,1080,320);wash.addColorStop(0,'#fff1b9');wash.addColorStop(.5,'#fff8e3');wash.addColorStop(1,'#eee5ff');ctx.fillStyle=wash;ctx.fillRect(0,0,1080,340);
 box(52,44,54,54,'#7551c9',18);text('9',79,83,36,'#fff',900,'center');text('DIAMOND NINE',122,82,30,'#453966',900);text(`${data.league} · SEASON ${String(data.year).padStart(2,'0')}`,1028,80,24,'#776087',700,'right');
 text(data.title,540,176,data.title.length>9?52:66,'#715015',900,'center',950);
 text(data.name,540,236,36,'#263552',800,'center',950);
 text(`${data.year}年目に達成  /  ${data.record}`,540,286,27,'#756442',600,'center');
 box(52,363,976,216,'#f5f1ff');text(data.abilityLabel,80,407,23,'#77618c');text('総合',860,408,22,'#77618c');text(String(data.overall),998,420,50,'#7651c4',900,'right');
 for(const [i,[label,value]] of data.metrics.entries()){
  const x=80+i*157;box(x,444,139,105,'#fff',14);text(label,x+69.5,476,22,'#67738a',600,'center');text(String(value),x+69.5,523,38,i===5?'#288fa9':'#7354be',900,'center');
 }
 text(data.battingLabel,60,637,28,'#354562',800);text('レギュラーシーズン',1020,636,20,'#7d8595',500,'right');
 box(52,659,976,50,'#eeeaf7',12);
 const xs=[90,490,626,754,885,995];const headings=['選手','打率','本塁打','打点','OPS','盗塁'];
 headings.forEach((h,i)=>text(h,xs[i],692,22,'#715c8c',700,i?'right':'left'));
 data.batters.forEach((p,i)=>{
  const y=710+i*50;if(i%2===0)box(52,y,976,50,'#f8f9fc',0);
  text(p.name,90,y+34,26,'#253552',700,'left',298);
  [p.avg,p.hr,p.rbi,p.ops,p.sb].forEach((value,j)=>text(String(value),xs[j+1],y+34,26,j===3?'#7050bb':'#334765',j===3?800:600,'right'));
 });
 if(!data.batters.length)text('打撃成績の記録がありません',540,785,25,'#7c8798',500,'center');
 // The batting report above includes the season's top PA totals. Abilities
 // below use the saved end-of-season order, which may contain different players.
 const ability=(value:number,x:number,y:number)=>{
  const colors=value>=90?['#f0e3ff','#743b9c']:value>=80?['#fff0c9','#80551b']:value>=70?['#fde5ec','#a7385c']:value>=60?['#e4f1ff','#25679e']:value>=50?['#e3f5eb','#277149']:['#edf0f5','#5c6a7d'];
  box(x-43,y+5,86,32,colors[0],8);text(`${grade(value)} ${value}`,x,y+29,23,colors[1],800,'center');
 };
 text('野手の能力 · 打順順',60,1208,28,'#354562',800);
 text(data.playerAbilityLabel,1020,1207,20,'#7d8595',500,'right');
 box(52,1230,976,44,'#eeeaf7',12);
 const batColumns=[79,118,374,464,568,671,774,877,980];
 ['順','選手','位置','総合','ミート','パワー','走力','肩','守備'].forEach((h,i)=>text(h,batColumns[i],1260,21,'#715c8c',700,i===1?'left':'center'));
 data.lineupAbilities.forEach((p,i)=>{
  const y=1274+i*42;if(i%2===0)box(52,y,976,42,'#f8f9fc',0);
  text(String(p.order),79,y+29,23,'#8b799d',700,'center');text(p.name,118,y+29,25,'#253552',700,'left',220);
  text(p.position,374,y+29,23,'#596886',600,'center');text(String(p.overall),464,y+29,26,'#7050bb',900,'center');
  [p.ratings.contact,p.ratings.power,p.ratings.speed,p.ratings.arm,p.ratings.field].forEach((value,j)=>ability(value,batColumns[j+4],y));
 });
 text('投手の能力',60,1705,28,'#354562',800);
 text(data.playerAbilityLabel,1020,1704,20,'#7d8595',500,'right');
 box(52,1730,976,44,'#e6f2f6',12);
 const pitColumns=[79,118,374,481,613,744,867,980];
 ['順','選手','起用','総合','球速 km/h','制球','スタミナ','変化'].forEach((h,i)=>text(h,pitColumns[i],1760,i===4?20:21,'#487586',700,i===1?'left':'center'));
 data.pitcherAbilities.forEach((p,i)=>{
  const y=1774+i*42;if(i%2===0)box(52,y,976,42,'#f8f9fc',0);
  text(String(p.order),79,y+29,23,'#8b799d',700,'center');text(p.name,118,y+29,25,'#253552',700,'left',220);
  text(p.position,374,y+29,23,'#596886',600,'center');text(String(p.overall),481,y+29,26,'#7050bb',900,'center');text(String(p.ratings.velocity),613,y+29,27,'#237f9a',800,'center');
  [p.ratings.control,p.ratings.stamina,p.ratings.breaking].forEach((value,j)=>ability(value,pitColumns[j+5],y));
 });
 ctx.fillStyle='#e7e1f0';ctx.fillRect(52,2310,976,2);
 text('選手を集めて、育てて、自分だけのチームを。',540,2354,27,'#7050bb',800,'center');
 if(url)text(url.replace(/^https?:\/\//,''),540,2393,23,'#596886',600,'center',955);
 else text('#DIAMONDNINE  #野球ゲーム',540,2393,24,'#596886',600,'center');
 text('国内・海外の選手が登場する非公式シミュレーション',540,2432,19,'#8991a0',500,'center');
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG unavailable')),'image/png'));
}
