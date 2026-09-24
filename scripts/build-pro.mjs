import { build } from 'esbuild';
import { cp,mkdir,readFile,writeFile,rm } from 'node:fs/promises';
import { resolve } from 'node:path';

await mkdir('dist/assets/pro',{recursive:true});
await build({
 absWorkingDir:process.cwd(),entryPoints:[resolve('src/main.tsx')],outfile:resolve('dist/assets/game.js'),
 bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',
 define:{'process.env.NODE_ENV':'"production"'},external:['/assets/*','https://*'],
 logLevel:'info',legalComments:'eof',
});
const ads=JSON.parse(await readFile('src/pro/adsense-config.json','utf8'));
const publisherReady=/^ca-pub-\d{16}$/.test(ads.publisherId);
if(ads.publisherId&&!publisherReady)throw new Error('Invalid AdSense publisher ID');
if(ads.enabled&&(!publisherReady||!/^\d{10}$/.test(ads.seasonResultSlotId)))throw new Error('AdSense requires a valid publisher and ad slot');
const verify=html=>publisherReady?html.replace('</head>',`<meta name="google-adsense-account" content="${ads.publisherId}" />\n</head>`):html;
const html=verify((await readFile('index.html','utf8'))
 .replace('</head>','    <link rel="stylesheet" href="/assets/game.css" />\n  </head>')
 .replace('src="/src/main.tsx"','src="/assets/game.js"'));
await writeFile('dist/index.html',html);
await writeFile('dist/welcome.html',verify(await readFile('public/welcome.html','utf8')));
await cp('public/share.html','dist/share.html');
let privacy=await readFile('public/privacy.html','utf8');
if(ads.enabled)privacy=privacy.replace(/<!--AD_STATUS-->[\s\S]*?<!--\/AD_STATUS--> 広告を有効にする際は、このページと必要な同意設定を更新します。/,'Google AdSenseの広告枠を設置しています。配信の有無は地域・同意状況・広告の在庫等によって異なります。');
await writeFile('dist/privacy.html',privacy);
if(publisherReady)await writeFile('dist/ads.txt',`google.com, ${ads.publisherId.slice(3)}, DIRECT, f08c47fec0942fa0\n`);
else await rm('dist/ads.txt',{force:true});
await cp('public/assets/pro','dist/assets/pro',{recursive:true});
await cp('public/audio','dist/audio',{recursive:true});
await cp('public/THIRD_PARTY_ASSETS.txt','dist/THIRD_PARTY_ASSETS.txt');
console.log('DIAMOND NINE production build ready in dist/.');
