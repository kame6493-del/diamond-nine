import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('node_modules/.tmp',{recursive:true});
await build({entryPoints:['scripts/test-pro.ts'],outfile:'node_modules/.tmp/test-pro.mjs',bundle:true,packages:'external',jsx:'automatic',platform:'node',format:'esm',logLevel:'silent'});
await import('../node_modules/.tmp/test-pro.mjs');
