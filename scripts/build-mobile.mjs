import {build} from 'esbuild';
import {cp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const android=process.argv.includes('--android');
process.chdir(root);
// Start from empty dist/ and www/ so leftovers from older builds (an old Vite build put
// assets/production with its Codex prompt, docs and README there) never reach the app.
await rm('dist',{recursive:true,force:true});
execFileSync(process.execPath,['scripts/build-pro.mjs'],{stdio:'inherit'});
const out=resolve('mobile/www');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await cp('dist',out,{recursive:true});
await build({absWorkingDir:root,entryPoints:['mobile/main.ts'],outfile:resolve(out,'assets/game.js'),bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','__DIAMOND_ANDROID__':String(android),'__DIAMOND_APP__':'true'},external:['/assets/*','https://*'],legalComments:'eof',loader:{'.woff':'file','.woff2':'file'},assetNames:'fonts/[name]-[hash]',publicPath:'/assets/',plugins:[{name:'native-ad-config',setup(b){b.onLoad({filter:/adsense-config\.json$/},()=>({contents:JSON.stringify({enabled:false,publisherId:'',seasonResultSlotId:''}),loader:'json'}));}}]});
// Native builds use device fonts and never load browser advertising tags.
const css=resolve(out,'assets/game.css');
// The font URL itself contains ';' (wght@400;500;...), so stop at the closing quote,
// not the first ';'. Cutting early leaves an unterminated string that voids all CSS.
const fontImport=/@import\s*(?:url\()?(['"])https:\/\/fonts\.googleapis\.com[^'"]*\1\)?[^;]*;/g;
const styled=(await readFile(css,'utf8')).replace(fontImport,'');
if(styled.includes('fonts.googleapis.com'))throw new Error('Google Fonts import was not removed from game.css');
await writeFile(css,styled);
for(const page of ['index.html','welcome.html','guide.html']){
 const path=resolve(out,page);await writeFile(path,(await readFile(path,'utf8')).replace(/<meta name="google-adsense-account"[^>]*>\s*/g,''));
}
await rm(resolve(out,'ads.txt'),{force:true});
// Native loading screen (2026-10-26): same navy as the Android splash, art made with ChatGPT
// (mobile/launch/). mobile/launch.ts fades it out once the game has drawn.
await cp('mobile/launch',resolve(out,'assets/launch'),{recursive:true});
{
 const path=resolve(out,'index.html');
 const launch=`<style>html:not([data-look]){background:#0a2a66}#dn-launch{position:fixed;inset:0;z-index:2147483000;background:#0a2a66;overflow:hidden;transition:opacity .4s ease}#dn-launch.is-out{opacity:0;pointer-events:none}#dn-launch .dn-launch-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:dn-launch-in .6s ease-out .05s both}#dn-launch .dn-launch-logo{position:absolute;left:50%;top:40%;width:min(64vw,320px);height:auto;transform:translate(-50%,-50%);animation:dn-launch-logo .7s cubic-bezier(.2,.8,.2,1) both}@keyframes dn-launch-in{from{opacity:0}to{opacity:1}}@keyframes dn-launch-logo{from{top:50%;width:188px}to{top:40%;width:min(64vw,320px)}}#dn-launch .dn-launch-load{position:absolute;left:50%;bottom:calc(11% + var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)));transform:translateX(-50%);width:min(52vw,240px);text-align:center;color:#dbe7ff;font:700 13px/1.4 system-ui,sans-serif;letter-spacing:.12em;text-shadow:0 1px 4px rgba(0,0,0,.85)}#dn-launch .dn-launch-bar{height:4px;margin-top:10px;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden}#dn-launch .dn-launch-bar i{display:block;width:38%;height:100%;border-radius:4px;background:linear-gradient(90deg,#ffd76a,#ffb627);animation:dn-launch-run 1.1s ease-in-out infinite}@keyframes dn-launch-run{0%{transform:translateX(-100%)}100%{transform:translateX(270%)}}@media (prefers-reduced-motion:reduce){#dn-launch .dn-launch-bar i,#dn-launch .dn-launch-bg,#dn-launch .dn-launch-logo{animation:none;width:100%}#dn-launch .dn-launch-logo{width:min(64vw,320px)}}</style><div id="dn-launch" aria-hidden="true"><img class="dn-launch-bg" src="/assets/launch/launch-bg.webp" alt="" decoding="async"><img class="dn-launch-logo" src="/assets/launch/launch-logo.webp" alt="" decoding="async"><div class="dn-launch-load">読み込み中<div class="dn-launch-bar"><i></i></div></div></div>`;
 const html=await readFile(path,'utf8');
 if(!html.includes('<div id="root"></div>'))throw new Error('index.html has no #root for the loading screen');
 await writeFile(path,html.replace('<div id="root"></div>',launch+'<div id="root"></div>').replace(/<meta name="theme-color" content="[^"]*"/,'<meta name="theme-color" content="#0a2a66"'));
}
// Store support/privacy pages are hosted on the web; nothing in the app links to them.
for(const page of ['app-support.html','app-privacy.html'])await rm(resolve(out,page),{force:true});
await cp('mobile/privacy.html',resolve(out,'privacy.html'));
// Only runtime files may ship. Fail the build if developer material slips into www/.
const shipped=(await readdir(out,{recursive:true,withFileTypes:true})).filter(e=>e.isFile()).map(e=>relative(out,resolve(e.parentPath??e.path,e.name)).split(sep).join('/'));
const licenseText=p=>p==='THIRD_PARTY_ASSETS.txt'||/^audio\/[^/]+\/[^/]*(license|credits)[^/]*\.txt$/i.test(p);
const devOnly=shipped.filter(p=>/\.(md|map|ts|tsx|py|mjs|cmd|ps1|sh)$/i.test(p)||/(^|\/)(codex|docs|prompts?)\//i.test(p)||/(^|\/)readme/i.test(p)||/codex|prompt/i.test(p)||(p.endsWith('.txt')&&!licenseText(p)));
if(devOnly.length)throw new Error('Developer-only files in mobile/www: '+devOnly.join(', '));
// mobile/ads-config.json is the single source of AdMob IDs. Android reads it in
// app/build.gradle; keep the iOS Info.plist GADApplicationIdentifier in step here.
const adsConfig=JSON.parse(await readFile('mobile/ads-config.json','utf8'));
if(!/^ca-app-pub-\d{16}~\d{10}$/.test(adsConfig.ios.appId))throw new Error('ads-config.json ios.appId is not an AdMob app ID');
const plistPath=resolve('mobile/ios/App/App/Info.plist'),plist=await readFile(plistPath,'utf8');
const synced=plist.replace(/(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*(<\/string>)/,(_,a,b)=>a+adsConfig.ios.appId+b);
if(!synced.includes(adsConfig.ios.appId))throw new Error('Info.plist has no GADApplicationIdentifier entry');
if(synced!==plist)await writeFile(plistPath,synced);
if(adsConfig.useTestAds)console.warn('ads-config.json: useTestAds=true (Google test ad IDs). Replace before release.');
console.log('Mobile web assets prepared. Native signing and device testing are still required.');
