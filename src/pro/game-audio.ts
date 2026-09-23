// CC0 recordings by Kenney and Leszek Szary; credits in THIRD_PARTY_ASSETS.txt.
const files={draw:'kenney/pack-open',join:'kenney/card-place',win:'kenney/confirm',awaken:'kenney/awaken',reveal:'kenney/confirm',impact:'kenney/scout-impact',gold:'freesound/scout-gold-success-171671',rainbow:'kenney/scout-rainbow',voice:'kenney/scout-congratulations'} as const;
type Sound=keyof typeof files;
const buffers=new Map<string,AudioBuffer>(),loading=new Map<string,Promise<void>>();
const active=new Set<AudioBufferSourceNode>();
let context:AudioContext|null=null,epoch=0;
async function load(file:string){
 if(buffers.has(file))return;
 if(!loading.has(file))loading.set(file,(async()=>{
  try{const response=await fetch(`/audio/${file}.wav`);if(response.ok)buffers.set(file,await context!.decodeAudioData(await response.arrayBuffer()));}
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
