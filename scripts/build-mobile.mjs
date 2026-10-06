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
