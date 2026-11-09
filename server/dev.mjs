import http from 'node:http';
import {createServer} from 'vite';
import {createAPI} from './api.mjs';
const vite=await createServer({server:{middlewareMode:true},appType:'spa'});
const api=createAPI();
const port=Number(process.env.PORT||5178);
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/api/')){
  try {const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096){res.writeHead(413);res.end();return;}chunks.push(chunk);}
   const host=req.headers.host;
   if(![`localhost:${port}`,`127.0.0.1:${port}`].includes(host)){res.writeHead(403);res.end();return;}
   const request=new Request(`http://${host}${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
   const result=await api(request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(await result.text());
  }catch{res.writeHead(500);res.end('Request could not be processed');}
 }else vite.middlewares(req,res);
});
server.listen(port,'127.0.0.1',()=>console.log(`SpectraGuard ready at http://localhost:${port}`));
