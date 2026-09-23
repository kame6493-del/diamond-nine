// Original Kenney CC0 recordings. No synthesized music or imitation voices.
const files={draw:'pack-open',join:'card-place',win:'confirm',awaken:'awaken',reveal:'confirm',impact:'scout-impact',gold:'scout-gold',rainbow:'scout-rainbow',voice:'scout-congratulations'} as const;
type Sound=keyof typeof files;
const buffers=new Map<string,AudioBuffer>(),loading=new Map<string,Promise<void>>();
const active=new Set<AudioBufferSourceNode>();
let context:AudioContext|null=null,epoch=0;
async function load(file:string){
 if(buffers.has(file))return;
 if(!loading.has(file))loading.set(file,(async()=>{
  try{const response=await fetch(`/audio/kenney/${file}.wav`);if(response.ok)buffers.set(file,await context!.decodeAudioData(await response.arrayBuffer()));}
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
  volume.gain.value=kind==='voice'?.48:kind==='impact'?.22:kind==='gold'||kind==='rainbow'?.32:.48;
  source.connect(volume);volume.connect(context.destination);active.add(source);
  source.onended=()=>{active.delete(source);source.disconnect();volume.disconnect();};source.start(context.currentTime+delay);
 }catch{/* Audio failure never changes cards, points or saves. */}})();
}
