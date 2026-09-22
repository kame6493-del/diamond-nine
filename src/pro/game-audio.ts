// Original recordings from Kenney's CC0 packs, bundled for offline playback.
const files={draw:'pack-open',join:'card-place',win:'confirm',awaken:'awaken',reveal:'confirm'} as const;
const buffers=new Map<string,AudioBuffer>();
let context:AudioContext|null=null;
export async function prepareGameAudio(){
 try{
  context??=new AudioContext();await context.resume();
  await Promise.all(Object.values(files).map(async file=>{
   if(buffers.has(file))return;
   const response=await fetch(`/audio/kenney/${file}.wav`);if(!response.ok)return;
   buffers.set(file,await context!.decodeAudioData(await response.arrayBuffer()));
  }));
 }catch{/* Audio failure never blocks play or saves. */}
}
export function gameSound(kind:keyof typeof files){
 void (async()=>{try{
  await prepareGameAudio();const buffer=buffers.get(files[kind]);if(!context||!buffer)return;
  const source=context.createBufferSource(),volume=context.createGain();source.buffer=buffer;volume.gain.value=.48;
  source.connect(volume);volume.connect(context.destination);source.start();source.onended=()=>{source.disconnect();volume.disconnect();};
 }catch{/* Optional sound. */}})();
}
