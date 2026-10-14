// 効果音: 効果音ラボ(https://soundeffect-lab.info/、商用可・クレジット任意・素材の再配布は不可)。
// BGM: 魔王魂(https://maou.audio/、商用可・「音楽：魔王魂」の表記が必要)。
// 出典と元のファイル名は THIRD_PARTY_ASSETS.txt と /audio/selab/LICENSE.txt。音量だけ揃えて(loudnorm)使っている。
// カードを引く音の流れ: deal(カードを場に置く) → roll(金・虹だけドラムロール) → flip(めくる) → reveal/gold/rainbow(+cymbal)。
const files={
 deal:'selab/deal.mp3',flip:'selab/flip.mp3',roll:'selab/roll.mp3',cymbal:'selab/cymbal.mp3',
 reveal:'selab/reveal.mp3',gold:'selab/gold.mp3',rainbow:'selab/rainbow.mp3',
 join:'selab/join.mp3',win:'selab/win.mp3',awaken:'selab/awaken.mp3',
 // 以前の見た目・お祝い演出が使う名前。新しい音へ置き換えた。
 draw:'selab/deal.mp3',impact:'selab/cymbal.mp3',voice:'selab/cymbal.mp3',
} as const;
export type Sound=keyof typeof files;
// 音量のつり合い(BGM は 0.16 前後。効果音はそれより前に出るが、耳に刺さらない程度)。
const volumes:Partial<Record<Sound,number>>={deal:.55,flip:.6,roll:.32,cymbal:.32,reveal:.5,gold:.5,rainbow:.45,join:.4,win:.38,awaken:.5,draw:.55,impact:.3,voice:.25};
const BGM_FILE='maou/maoudamashii-bgm-acoustic34-loop.mp3',BGM_VOLUME=.16,BGM_DUCKED=.05;
const buffers=new Map<string,AudioBuffer>(),loading=new Map<string,Promise<void>>();
const active=new Set<{source:AudioBufferSourceNode;gain:GainNode;kind:Sound}>();
let context:AudioContext|null=null,epoch=0;
let bgm:{source:AudioBufferSourceNode;gain:GainNode}|null=null,bgmWanted=false,bgmDucked=false;
async function load(file:string){
 if(buffers.has(file))return;
 if(!loading.has(file))loading.set(file,(async()=>{
  try{const response=await fetch(`/audio/${file}`);if(response.ok)buffers.set(file,await context!.decodeAudioData(await response.arrayBuffer()));}
  catch{/* Optional audio. */}finally{loading.delete(file);}
 })());
 await loading.get(file);
}
export async function prepareGameAudio(){
 try{context??=new AudioContext();void context.resume().catch(()=>{});await Promise.all(Object.values(files).map(load));}catch{/* Unsupported audio is silent. */}
}
// Cancel active sounds and pending/scheduled cues when muting or skipping. BGM is separate (stopBgm).
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
// ---- BGM (loops quietly; ducked while a card is being drawn) ----
export function startBgm(){
 bgmWanted=true;
 void (async()=>{try{
  context??=new AudioContext();void context.resume().catch(()=>{});
  if(bgm)return;await load(BGM_FILE);
  const buffer=buffers.get(BGM_FILE);if(!context||!buffer||!bgmWanted||bgm)return;
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.loop=true;
  gain.gain.value=0;gain.gain.setTargetAtTime(bgmDucked?BGM_DUCKED:BGM_VOLUME,context.currentTime,.6);
  source.connect(gain);gain.connect(context.destination);source.start();bgm={source,gain};
 }catch{/* Silent without audio. */}})();
}
export function stopBgm(){
 bgmWanted=false;if(!bgm||!context)return;
 const {source,gain}=bgm;bgm=null;
 try{gain.gain.setTargetAtTime(0,context.currentTime,.15);source.stop(context.currentTime+.6);}catch{}
}
export function duckBgm(on:boolean){
 bgmDucked=on;if(!bgm||!context)return;
 try{bgm.gain.gain.setTargetAtTime(on?BGM_DUCKED:BGM_VOLUME,context.currentTime,on?.08:.5);}catch{}
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
