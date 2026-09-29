import http from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGzip} from 'node:zlib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'dist');
const port=Number(process.argv[2]||4174);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.hdr':'application/octet-stream','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);res.end();return;}
  const file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('找不到檔案');return;}
  const ext=extname(file);const zipped=/\b(gzip)\b/.test(req.headers['accept-encoding']||'')&&['.html','.js','.css','.json','.md','.txt'].includes(ext);
  res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':ext==='.html'?'no-cache':pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'public, max-age=3600','X-Content-Type-Options':'nosniff',...(zipped?{'Content-Encoding':'gzip','Vary':'Accept-Encoding'}:{'Content-Length':statSync(file).size})});
  if(req.method==='HEAD'){res.end();return;}
  const stream=createReadStream(file);stream.on('error',()=>res.destroy());if(zipped)stream.pipe(createGzip()).pipe(res);else stream.pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`FAB-1 Web tour: http://127.0.0.1:${port}`));
