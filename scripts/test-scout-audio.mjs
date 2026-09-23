import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['src/pro/game-audio.ts'],outfile:'node_modules/.tmp/scout-audio-test.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const requests=[],sources=[];
globalThis.fetch=url=>new Promise(resolve=>requests.push({url,resolve}));
globalThis.AudioContext=class {
 currentTime=0;
 resume(){return Promise.resolve();}
 decodeAudioData(){return Promise.resolve({});}
 createGain(){return {gain:{value:0},connect(){},disconnect(){}};}
 createBufferSource(){const source={started:0,stopped:0,connect(){},disconnect(){},start(){this.started++;},stop(){this.stopped++;this.onended?.();}};sources.push(source);return source;}
};
const {gameSound,stopGameAudio}=await import('../node_modules/.tmp/scout-audio-test.mjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const resolve=request=>request.resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
gameSound('gold');assert.equal(requests.length,1);
assert.equal(requests[0].url,'/audio/freesound/scout-gold-success-171671.wav','gold uses the replacement recording at a new cache-safe URL');
stopGameAudio();resolve(requests[0]);await tick();
assert.equal(sources.length,0,'muting during a download cancels late playback');
gameSound('gold');await tick();assert.equal(sources[0].started,1);assert.equal(requests.length,1,'decoded audio is cached');
stopGameAudio();assert.equal(sources[0].stopped,1,'mute stops a playing clip');
gameSound('voice',.5);gameSound('voice',.5);assert.equal(requests.length,2,'concurrent loading is shared');
assert.equal(requests[1].url,'/audio/kenney/scout-congratulations.wav');
stopGameAudio();resolve(requests[1]);await tick();assert.equal(sources.length,1,'skipping cancels every pending cue');
gameSound('impact',.65);requests[2].resolve({ok:false});await tick();assert.equal(sources.length,1,'missing audio does not fail or play');
gameSound('rainbow',.5);assert.equal(requests[3].url,'/audio/kenney/scout-rainbow.wav');resolve(requests[3]);await tick();stopGameAudio();assert.equal(sources[1].stopped,1,'mute stops a scheduled cue');
console.log('PASS scout audio: cache, concurrent fetch, mute during download, active/scheduled stop, missing-file fallback');
