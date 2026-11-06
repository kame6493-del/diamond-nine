// 効果音: 効果音ラボ(https://soundeffect-lab.info/、商用可・クレジット任意・素材の再配布は不可)。
// 出典と元のファイル名は THIRD_PARTY_ASSETS.txt と /audio/selab/LICENSE.txt。音量だけ揃えて(loudnorm)使っている。
// カードを引く音の流れ: deal(カードを場に置く) → roll(金・虹だけドラムロール) → flip(めくる) → reveal/gold/rainbow(+cymbal)。
const files={
 deal:'selab/deal.mp3',flip:'selab/flip.mp3',roll:'selab/roll.mp3',cymbal:'selab/cymbal.mp3',
 reveal:'selab/reveal.mp3',gold:'selab/gold.mp3',rainbow:'selab/rainbow.mp3',
 join:'selab/join.mp3',awaken:'selab/awaken.mp3',
 // 以前の見た目・お祝い演出が使う名前。新しい音へ置き換えた。
 draw:'selab/deal.mp3',impact:'selab/cymbal.mp3',voice:'selab/cymbal.mp3',
 // 観戦モード(2026-11-04)。同じ効果音ラボ。出典は /audio/selab/LICENSE.txt。観戦の画面を開いた時だけ読む(prepareWatchAudio)。
 // 10回まとめて引く(2026-11-04)の虹カード: いつもの虹の音に、観戦モードと同じ「スタジアムの歓声2」を重ねる(新しい素材は足していない)。
 rainbowCheer:'selab/watch/cheer.mp3',
 // 11/4 夜(持ち主「バットに当たった音が金属音なので、これ違う音に変えて。評判の良いフリー音声で。前提はプロ野球なので」): 打球音を
 // 効果音ラボの金属バット(カキーン)から、Freesound の CC0 の木製バットの録音(martinimeniscus「Bat Hit」、Florentine Films SFX)に替えた。
 // 芯で捉えた強い当たり(安打・長打・本塁打)/詰まった当たり(凡打・バント)/ファウル の3つ。本塁打は強い当たり+歓声(cheer)。出典は /audio/freesound/bat-LICENSE.txt。
 hitStrong:'freesound/bat/hit-strong.mp3',hitJammed:'freesound/bat/hit-jammed.mp3',foul:'freesound/bat/foul.mp3',
 catch:'selab/watch/catch.mp3',strikeout:'selab/watch/strikeout.mp3',cheer:'selab/watch/cheer.mp3',gameset:'selab/watch/gameset.mp3',
 // 11/5 持ち主「ボールを捕った音とか、良い感じに入れるようにして。ちょっと不自然なところあるから、見直して」: 捕る・投げる・走る・滑る・弾む・観客の音。
 // 捕手のミット(パシッ)は効果音ラボ「ボールをミットでキャッチ1」(catch と同じ)。ほかは Freesound の CC0 の録音。出典は /audio/freesound/field-LICENSE.txt。
 // 鳴らす時刻は動き(field-sim.ts)の、球が手に届いた瞬間・投げた瞬間・塁に着いた瞬間に合わせる(play-sounds.ts)。
 mitt:'selab/watch/catch.mp3',glove:'freesound/field/glove.mp3',infield:'freesound/field/infield.mp3',throw:'freesound/field/throw.mp3',
 step:'freesound/field/step.mp3',slide:'freesound/field/slide.mp3',bounce:'freesound/field/bounce.mp3',
 // 11/6 持ち主「うーんみたいな変な声」: 人の声のため息(sigh)・「おお」(ooh)は外した。人の声は球場の歓声・拍手(cheer・gameset)だけ。
} as const;
const watchSounds=['hitStrong','hitJammed','foul','catch','strikeout','cheer','gameset','mitt','glove','infield','throw','step','slide','bounce'] as const;
/** 鳴らす音の名前とファイル(試験で、打球音が新しい木製バットの録音を指しているかを確かめる)。 */
export const soundFiles:Readonly<Record<string,string>>=files;
export type Sound=keyof typeof files;
// 音量のつり合い(耳に刺さらない程度にそろえる)。
const volumes:Partial<Record<Sound,number>>={deal:.55,flip:.6,roll:.32,cymbal:.32,reveal:.5,gold:.5,rainbow:.45,join:.4,awaken:.5,draw:.55,impact:.3,voice:.25,rainbowCheer:.34,hitStrong:.55,hitJammed:.5,foul:.35,catch:.4,strikeout:.4,cheer:.3,gameset:.35,mitt:.42,glove:.4,infield:.36,throw:.16,step:.2,slide:.3,bounce:.26};
const buffers=new Map<string,AudioBuffer>(),loading=new Map<string,Promise<void>>();
const active=new Set<{source:AudioBufferSourceNode;gain:GainNode;kind:Sound;at:number}>();
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
/** まだ鳴っていない予約の音だけ止める(試合の「次の打席へ」などで動きを飛ばした時。鳴っている歓声などは残す)。 */
export function stopScheduledSounds(){
 if(!context)return;const now=context.currentTime;
 for(const a of [...active])if(a.at>now+.01){try{a.source.stop();}catch{}a.source.disconnect();active.delete(a);}
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
  const at=context.currentTime+delay;source.connect(gain);gain.connect(context.destination);const entry={source,gain,kind,at};active.add(entry);
  source.onended=()=>{active.delete(entry);source.disconnect();gain.disconnect();};source.start(at);
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

// ---- 10回まとめて引く(2026-11-04 vc43)。音は上と同じ効果音ラボの物だけ。 ----
/** 10枚を場に並べる: カードを置く音を少しずつずらして5回。 */
export function multiDealSounds(){for(let i=0;i<5;i++)gameSound('deal',i*.14);}
/** 金・虹のカードがめくる前に光る間: ドラムロール(虹はキラッも先に)。 */
export function multiChargeSounds(tier:'standard'|'gold'|'rainbow'){
 if(tier==='standard')return;
 gameSound('roll');if(tier==='rainbow')gameSound('reveal',.05);
}
/** 1枚めくる: ふつうはめくる音だけ(10回続くので軽く)。金はシンバル+シャキーン、虹はさらに歓声を重ねる。 */
export function multiFlipSounds(tier:'standard'|'gold'|'rainbow'){
 fadeSound('roll');gameSound('flip');
 if(tier==='standard')return;
 gameSound('cymbal',.05);gameSound(tier==='rainbow'?'rainbow':'gold',.1);
 if(tier==='rainbow')gameSound('rainbowCheer',.18);
}
