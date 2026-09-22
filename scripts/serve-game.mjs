import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { extname,resolve,sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.DIAMOND_NINE_PORT)||4173;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.wav':'audio/wav','.ogg':'audio/ogg'};
const server=createServer(async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
 try{
  const pathname=decodeURIComponent(new URL(req.url??'/',`http://127.0.0.1:${port}`).pathname);
  const target=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(!target.startsWith(resolve(root)+sep)){res.writeHead(403).end('Forbidden');return;}
  if(!(await stat(target)).isFile()){res.writeHead(404).end('Not found');return;}
  const data=await readFile(target);
  res.writeHead(200,{'Content-Type':mime[extname(target)]??'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Length':data.length});
  res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('ページが見つかりません。先に npm run build を実行してください。');}
});
server.on('error',error=>{if(error.code==='EADDRINUSE'){console.log(`DIAMOND NINE is already running on port ${port}.`);process.exit(0);}else{console.error(error.message);process.exit(1);}});
server.listen(port,'127.0.0.1',()=>console.log(`DIAMOND NINE: http://127.0.0.1:${port}/`));
