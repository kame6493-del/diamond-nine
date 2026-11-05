import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('node_modules/.tmp',{recursive:true});
const out='node_modules/.tmp/measure-1105c-'+process.pid+'.mjs';
await build({entryPoints:['scripts/measure-1105c.ts'],outfile:out,bundle:true,packages:'external',jsx:'automatic',platform:'node',format:'esm',logLevel:'silent',external:['/assets/*']});
await import('../'+out);
