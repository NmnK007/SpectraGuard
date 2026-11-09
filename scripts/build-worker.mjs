import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
const assets={};
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${e.name}`;if(e.isDirectory())await walk(p);else{const key=p.replace('dist','');const binary=/\.(woff2?|png|ico)$/.test(p);assets[key]={body:await readFile(p,binary?'base64':'utf8'),binary,type:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.woff2')?'font/woff2':p.endsWith('.woff')?'font/woff':'text/html'};}}}
await walk('dist');
await mkdir('.local',{recursive:true});await mkdir('dist/server',{recursive:true});
const source=`import {createAPI} from '../server/api.mjs';const api=createAPI();const assets=${JSON.stringify(assets)};export default {async fetch(request){const path=new URL(request.url).pathname;if(path.startsWith('/api/'))return api(request);const a=assets[path]||assets['/index.html'];return new Response(a.binary?Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)):a.body,{headers:{'Content-Type':a.type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), geolocation=(), microphone=(self)','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com"}})}};`;
await writeFile('.local/worker-entry.mjs',source);await build({entryPoints:['.local/worker-entry.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',minify:true});
console.log('Worker built with embedded frontend and ephemeral challenge service.');
