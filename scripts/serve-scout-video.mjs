import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('marketing/scout-video');
await mkdir(resolve(root,'build'),{recursive:true});
await build({entryPoints:[resolve(root,'main.tsx')],outfile:resolve(root,'build/video.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},external:['https://*','/assets/*'],logLevel:'warning'});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wav':'audio/wav','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 try{const path=new URL(req.url,'http://localhost').pathname;const base=path==='/video.js'||path==='/video.css'?resolve(root,'build'):path.startsWith('/audio/')||path.startsWith('/assets/')?resolve('public'):root;
 const file=resolve(base,path==='/'?'index.html':'.'+path);if(file!==base&&!file.startsWith(base+sep)){res.writeHead(403);res.end();return;}
 const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});server.listen(4187,'127.0.0.1',()=>console.log('Video preview http://127.0.0.1:4187/'));
