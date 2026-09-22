import { build } from 'esbuild';
import { cp,mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

await mkdir('dist/assets/pro',{recursive:true});
await build({
 absWorkingDir:process.cwd(),entryPoints:[resolve('src/main.tsx')],outfile:resolve('dist/assets/game.js'),
 bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',
 define:{'process.env.NODE_ENV':'"production"'},external:['/assets/*','https://*'],
 logLevel:'info',legalComments:'eof',
});
const html=(await readFile('index.html','utf8'))
 .replace('</head>','    <link rel="stylesheet" href="/assets/game.css" />\n  </head>')
 .replace('src="/src/main.tsx"','src="/assets/game.js"');
await writeFile('dist/index.html',html);
await cp('public/assets/pro','dist/assets/pro',{recursive:true});
await cp('public/audio','dist/audio',{recursive:true});
await cp('public/THIRD_PARTY_ASSETS.txt','dist/THIRD_PARTY_ASSETS.txt');
console.log('DIAMOND NINE production build ready in dist/.');
