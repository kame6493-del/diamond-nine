import {build} from 'esbuild';
await build({entryPoints:['scripts/audit-fun.ts'],outfile:'node_modules/.tmp/audit-fun.mjs',bundle:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'});
await import('../node_modules/.tmp/audit-fun.mjs');
