// Native start-up (2026-10-26). The system splash (navy + emblem) stays until this module
// tells Android that the web loading screen (#dn-launch, written into www/index.html by
// scripts/build-mobile.mjs, same navy) is on screen; the loading screen then fades into the
// game once React has drawn its first screen. Imported first by mobile/main.ts.
import {Capacitor,registerPlugin} from '@capacitor/core';
const LaunchScreen=registerPlugin<{ready():Promise<void>}>('LaunchScreen');
const started=performance.now();
const MIN_SHOW_MS=1100,MAX_SHOW_MS=6000;
const el=()=>document.getElementById('dn-launch');
function tellNative(){if(Capacitor.isNativePlatform())void LaunchScreen.ready().catch(()=>{});}
// Wait for the logo to decode (cap 800 ms) so the hand-over never shows a half-drawn screen.
const logo=el()?.querySelector('img.dn-launch-logo') as HTMLImageElement|null;
void Promise.race([logo?.decode?.().catch(()=>{})??Promise.resolve(),new Promise(r=>setTimeout(r,800))]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(tellNative)));
let hidden=false;
function hide(){
 const node=el();if(hidden||!node)return;hidden=true;
 node.classList.add('is-out');setTimeout(()=>node.remove(),450);
}
// The game has drawn when #root has content; keep the loading screen at least MIN_SHOW_MS.
function whenDrawn(){
 const root=document.getElementById('root');
 if(root&&root.childElementCount>0){setTimeout(()=>requestAnimationFrame(hide),Math.max(0,MIN_SHOW_MS-(performance.now()-started)));return;}
 requestAnimationFrame(whenDrawn);
}
requestAnimationFrame(whenDrawn);
setTimeout(hide,MAX_SHOW_MS);

// Status bar icons: light on the navy launch screen and the blue strip of the bright look,
// dark on the white strip of the classic look.
import {SystemBars,SystemBarsStyle} from '@capacitor/core';
if(Capacitor.isNativePlatform()){
 let last='';
 const sync=()=>{const look=document.documentElement.dataset.look??'';if(look===last)return;last=look;void SystemBars.setStyle({style:look==='classic'?SystemBarsStyle.Light:SystemBarsStyle.Dark}).catch(()=>{});};
 new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-look']});
 sync();
}
