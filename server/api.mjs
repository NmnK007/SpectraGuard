export function createAPI({now=()=>Date.now(),ttl=90000}={}) {
 const challenges=new Map(); const rates=new Map();
 const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...headers}});
 const txValid=x=>x&&Number.isFinite(x.amount)&&x.amount>0&&x.amount<=10000000&&typeof x.payee==='string'&&x.payee.length>0&&x.payee.length<=80;
 const fingerprint=x=>JSON.stringify([x.amount,x.payee]);
 return async function api(req) {
   const url=new URL(req.url);
   if(url.pathname==='/api/health')return json({status:'ready',models:'not-installed',captureAttestation:false});
   if(req.method!=='POST')return json({error:'Method not allowed'},405);
   if(req.headers.get('origin')!==url.origin)return json({error:'Origin mismatch'},403);
   if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
   const t=now();for(const [key,value] of challenges)if(value.expires<t)challenges.delete(key);
   for(const [key,value] of rates)if(value.until<t)rates.delete(key);
   const ip=req.headers.get('cf-connecting-ip')||'local';
   const rate=rates.get(ip)||{count:0,until:t+60000};rate.count++;rates.set(ip,rate);
   if(rate.count>60||challenges.size>1000)return json({error:'Too many attempts. Please wait a minute.'},429);
   let input;try{const raw=await req.text();if(raw.length>4096)return json({error:'Request too large'},413);input=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
   const cookie=req.headers.get('cookie')?.match(/(?:^|;\s*)sg_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
   if(url.pathname==='/api/challenge'){
     if(!txValid(input.transaction))return json({error:'Invalid mock transaction'},400);
     const sid=cookie||crypto.randomUUID(); const nonce=crypto.randomUUID();
     for(const [key,value] of challenges)if(value.sid===sid)challenges.delete(key);
     const words=['silver','river','maple','orbit','garden','amber','cloud','violet'];
     const random=crypto.getRandomValues(new Uint32Array(3));
     const phrase=Array.from(random,x=>words[x%words.length]).join(' ');
     challenges.set(nonce,{sid,tx:fingerprint(input.transaction),expires:t+ttl,used:false});
     return json({nonce,phrase,expiresAt:t+ttl,physicalMicrophone:'unverified',phraseVerification:'not-implemented'},200,{'set-cookie':`sg_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600${url.protocol==='https:'?'; Secure':''}`});
   }
   if(url.pathname==='/api/verify'){
     const c=challenges.get(input.nonce);
     if(!c||c.expires<=t)return json({error:'Challenge expired or unavailable',code:'EXPIRED'},409);
     if(!cookie||c.sid!==cookie)return json({error:'Session mismatch',code:'SESSION_MISMATCH'},403);
     if(c.used)return json({error:'Challenge already used',code:'REUSED'},409);
     if(!txValid(input.transaction)||c.tx!==fingerprint(input.transaction))return json({error:'Transaction mismatch',code:'TRANSACTION_MISMATCH'},409);
     if(!/^[a-f0-9]{64}$/.test(input.digest||''))return json({error:'Audio digest required'},400);
     c.used=true;
     return json({freshness:'fresh',captureOrigin:'unknown',phraseMatch:'not-checked',scope:'Submission envelope only; client audio digest is not capture attestation.'});
   }
   return json({error:'Not found'},404);
 };
}
