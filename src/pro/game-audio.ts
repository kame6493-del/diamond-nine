// 効果音: 効果音ラボ(https://soundeffect-lab.info/、商用可・クレジット任意・素材の再配布は不可)。
// 出典と元のファイル名は THIRD_PARTY_ASSETS.txt と /audio/selab/LICENSE.txt。音量だけ揃えて(loudnorm)使っている。
// カードを引く音の流れ: deal(カードを場に置く) → roll(金・虹だけドラムロール) → flip(めくる) → reveal/gold/rainbow(+cymbal)。
const files={
 deal:'selab/deal.mp3',flip:'selab/flip.mp3',roll:'selab/roll.mp3',cymbal:'selab/cymbal.mp3',
 reveal:'selab/reveal.mp3',gold:'selab/gold.mp3',rainbow:'selab/rainbow.mp3',
 join:'selab/join.mp3',win:'selab/win.mp3',awaken:'selab/awaken.mp3',
 // 以前の見た目・お祝い演出が使う名前。新しい音へ置き換えた。
 draw:'selab/deal.mp3',impact:'selab/cymbal.mp3',voice:'selab/cymbal.mp3',
 // 観戦モード(2026-11-04)。同じ効果音ラボ。出典は /audio/selab/LICENSE.txt。観戦の画面を開いた時だけ読む(prepareWatchAudio)。
 hit:'selab/watch/hit.mp3',catch:'selab/watch/catch.mp3',strikeout:'selab/watch/strikeout.mp3',cheer:'selab/watch/cheer.mp3',homerun:'selab/watch/homerun.mp3',gameset:'selab/watch/gameset.mp3',
} as const;
const watchSounds=['hit','catch','strikeout','cheer','homerun','gameset'] as const;
export type Sound=keyof typeof files;
// 音量のつり合い(耳に刺さらない程度にそろえる)。
const volumes:Partial<Record<Sound,number>>={deal:.55,flip:.6,roll:.32,cymbal:.32,reveal:.5,gold:.5,rainbow:.45,join:.4,win:.38,awaken:.5,draw:.55,impact:.3,voice:.25,hit:.45,catch:.4,strikeout:.4,cheer:.3,homerun:.4,gameset:.35};
const buffers=new Map<string,AudioBuffer>(),loading=new Map<string,Promise<void>>();
const active=new Set<{source:AudioBufferSourceNode;gain:GainNode;kind:Sound}>();
let context:AudioContext|null=null,epoch=0;
async function load(file:string){
 if(buffers.has(file))return;
 if(!loading.has(file))loading.set(file,(async()=>{
  try{const response=await fetch(`/audio/${file}`);if(response.ok)buffers.set(file,await context!.decodeAudioData(await response.arrayBuffer()));}
  catch{/* Optional audio. */}finally{loading.delete(file);}
 })());
 await loading.get(file);
}
export async function prepareGameAudio(){
 try{context??=new AudioContext();void context.resume().catch(()=>{});await Promise.all(Object.entries(files).filter(([k])=>!(watchSounds as readonly string[]).includes(k)).map(([,f])=>load(f)));}catch{/* Unsupported audio is silent. */}
}
/** 観戦モードの音を先に読む(音を ON にしている時だけ呼ぶ)。 */
export async function prepareWatchAudio(){
 try{context??=new AudioContext();void context.resume().catch(()=>{});await Promise.all(watchSounds.map(k=>load(files[k])));}catch{/* Unsupported audio is silent. */}
}
// Cancel active sounds and pending/scheduled cues when muting or skipping.
export function stopGameAudio(){
 epoch++;
 for(const a of active){try{a.source.stop();}catch{}a.source.disconnect();}
 active.clear();
}
/** Fade one kind of sound out (the drum roll stops the moment the card turns). */
export function fadeSound(kind:Sound,seconds=.12){
 if(!context)return;
 for(const a of [...active])if(a.kind===kind){try{a.gain.gain.setTargetAtTime(0,context.currentTime,seconds/3);a.source.stop(context.currentTime+seconds);}catch{}}
}
export function gameSound(kind:Sound,delay=0){
 const requested=epoch;
 void (async()=>{try{
  context??=new AudioContext();void context.resume().catch(()=>{});await load(files[kind]);
  const buffer=buffers.get(files[kind]);if(!context||!buffer||requested!==epoch)return;
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;
  gain.gain.value=volumes[kind]??.45;
  source.connect(gain);gain.connect(context.destination);const entry={source,gain,kind};active.add(entry);
  source.onended=()=>{active.delete(entry);source.disconnect();gain.disconnect();};source.start(context.currentTime+delay);
 }catch{/* Audio failure never changes cards, points or saves. */}})();
}
/** Plays the card-draw sounds for one reveal; returns the time (ms) the card turns over. */
export function drawSounds(tier:'standard'|'gold'|'rainbow',flipAt:number){
 gameSound('deal');
 if(tier!=='standard')gameSound('roll',.25);
 return flipAt;
}
export function revealSounds(tier:'standard'|'gold'|'rainbow'){
 fadeSound('roll');gameSound('flip');
 if(tier==='standard')gameSound('reveal',.08);
 else{gameSound('cymbal',.05);gameSound(tier==='rainbow'?'rainbow':'gold',.1);}
}
