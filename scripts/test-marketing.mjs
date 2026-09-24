import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {build} from 'esbuild';
await build({stdin:{contents:`export {adsEnabled,validPublisherId,loadAdSense} from './src/pro/adsense';export {SeasonAd} from './src/pro/SeasonAd';`,resolveDir:process.cwd(),loader:'ts'},outfile:'node_modules/.tmp/test-marketing.mjs',bundle:true,packages:'external',jsx:'automatic',platform:'node',format:'esm',logLevel:'silent'});
const {adsEnabled,validPublisherId,loadAdSense,SeasonAd}=await import('../node_modules/.tmp/test-marketing.mjs');
const {renderToStaticMarkup}=await import('react-dom/server'),{createElement}=await import('react');
const config=JSON.parse(await readFile('src/pro/adsense-config.json','utf8'));
assert.equal(config.enabled,false,'unapproved deployment must not serve ads');
assert.equal(renderToStaticMarkup(createElement(SeasonAd)),'','disabled ads create no slot, gap or script');
assert.equal(adsEnabled({enabled:true,publisherId:'',seasonResultSlotId:''}),false);
assert.equal(adsEnabled({enabled:true,publisherId:'ca-pub-1234567890123456',seasonResultSlotId:'1234567890'}),true);
assert.equal(validPublisherId('ca-pub-1234567890123456" onload="alert(1)'),false);
const scripts=[];globalThis.document={createElement:()=>({}),head:{appendChild:s=>scripts.push(s)}};
await assert.rejects(loadAdSense('invalid'));assert.equal(scripts.length,0);
const one=loadAdSense('ca-pub-1234567890123456'),two=loadAdSense('ca-pub-1234567890123456');
assert.equal(one,two);assert.equal(scripts.length,1);assert.equal(scripts[0].crossOrigin,'anonymous');assert.equal(scripts[0].async,true);
assert.equal(scripts[0].src,'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1234567890123456');
scripts[0].onload();await Promise.all([one,two]);delete globalThis.document;
for(const file of ['dist/index.html','dist/welcome.html','dist/privacy.html']){
 const html=await readFile(file,'utf8');
 assert.ok(!html.includes('google-adsense-account'),'no placeholder publisher IDs');
 assert.ok(!html.includes('pagead2.googlesyndication.com'),'no live ad script in unconfigured HTML');
 for(const match of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g))await access('dist'+(match[1]==='/'?'/index.html':match[1]));
 if(!file.includes('privacy')){assert.ok(html.includes('summary_large_image'));assert.ok(html.includes('share-cover-v1.png'));}
}
const intro=await readFile('dist/welcome.html','utf8');
assert.ok(intro.includes('無料でプレイする'));assert.ok(intro.includes('ゲームを開く'));assert.ok(!intro.includes('/assets/game.js'),'landing does not load the game database');
await assert.rejects(access('dist/ads.txt'),'no fabricated ads.txt');
console.log('PASS marketing: disabled ads, ID guards, single async load, local links, large social card, lightweight landing, no fabricated publisher');
