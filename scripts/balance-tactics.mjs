import { build } from 'esbuild';
await build({entryPoints:['scripts/balance-tactics.ts'],outfile:'node_modules/.tmp/balance-tactics.mjs',bundle:true,packages:'external',jsx:'automatic',platform:'node',format:'esm',logLevel:'silent'});
await import('../node_modules/.tmp/balance-tactics.mjs');
