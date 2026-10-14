// 効果音ラボ(https://soundeffect-lab.info/)の効果音。ゲーム内での利用は商用・クレジット不要で可、素材の再配布は不可。
// 出典と元のファイル名は THIRD_PARTY_ASSETS.txt と /audio/selab/LICENSE.txt。音量だけ揃えて(loudnorm)使っている。
const files={draw:'selab/draw.mp3',join:'selab/join.mp3',win:'selab/win.mp3',awaken:'selab/awaken.mp3',reveal:'selab/reveal.mp3',impact:'selab/impact.mp3',gold:'selab/gold.mp3',rainbow:'selab/rainbow.mp3',voice:'selab/voice.mp3'} as const;
type Sound=keyof typeof files;
const buffers=new Map<string,AudioBuffer>(),loading=new Map<string,Promise<void>>();
const active=new Set<AudioBufferSourceNode>();
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
 try{context??=new AudioContext();void context.resume().catch(()=>{});await Promise.all(Object.values(files).map(load));}catch{/* Unsupported audio is silent. */}
}
// Cancel active sounds and pending/scheduled cues when muting or skipping.
export function stopGameAudio(){
 epoch++;
 for(const source of active){try{source.stop();}catch{}source.disconnect();}
 active.clear();
}
export function gameSound(kind:Sound,delay=0){
 const requested=epoch;
 void (async()=>{try{
  context??=new AudioContext();void context.resume().catch(()=>{});await load(files[kind]);
  const buffer=buffers.get(files[kind]);if(!context||!buffer||requested!==epoch)return;
  const source=context.createBufferSource(),volume=context.createGain();source.buffer=buffer;
  volume.gain.value=kind==='voice'?.48:kind==='impact'?.22:kind==='gold'?.4:kind==='rainbow'?.32:.48;
  source.connect(volume);volume.connect(context.destination);active.add(source);
  source.onended=()=>{active.delete(source);source.disconnect();volume.disconnect();};source.start(context.currentTime+delay);
 }catch{/* Audio failure never changes cards, points or saves. */}})();
}
