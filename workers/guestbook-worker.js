// Cloudflare Worker. Bind a KV namespace as GUESTBOOK and set SITE_ORIGIN
// to the exact public website origin (e.g. https://your-site.neocities.org).

// Cloudflare KV rate keys are eventually consistent, so their cooldown is
// advisory rather than a global anti-spam guarantee. Keep manual moderation.
const MAX_POST_BYTES=4096;

async function boundedBodyText(request, maxBytes=MAX_POST_BYTES) {
  // Do not use request.text(): it buffers the entire untrusted request first.
  const reader=request.body?.getReader();
  if(!reader)return '';
  const chunks=[];
  let size=0;
  try {
    for (;;) {
      const {value,done}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxBytes){
        reader.cancel().catch(()=>{});
        const error=new Error('Message too large');error.code='too_large';throw error;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export default {
  async fetch(request, env) {
    const origin=request.headers.get('Origin');
    const allowed=env.SITE_ORIGIN;
    const headers={'Content-Type':'application/json; charset=utf-8','Vary':'Origin','Cache-Control':'no-store'};
    if(origin===allowed) headers['Access-Control-Allow-Origin']=allowed;
    const json=(body,status=200)=>Response.json(body,{status,headers});
    if(!env.GUESTBOOK || !allowed) return json({error:'Guestbook not configured'},503);
    if(request.method==='OPTIONS') {
      if(origin!==allowed) return json({error:'Origin not allowed'},403);
      return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400'}});
    }
    try {
      if(request.method==='GET') {
        const keys=await env.GUESTBOOK.list({prefix:'published:',limit:50});
        const entries=(await Promise.all(keys.keys.map(key=>env.GUESTBOOK.get(key.name,'json')))).filter(Boolean);
        return json({entries});
      }
      if(request.method!=='POST') return json({error:'Method not allowed'},405);
      if(origin!==allowed) return json({error:'Origin not allowed'},403);
      if(!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'JSON required'},415);
      if(Number(request.headers.get('Content-Length'))>MAX_POST_BYTES) return json({error:'Message too large'},413);
      let raw;
      try {raw=await boundedBodyText(request);}
      catch(error){
        if(error.code==='too_large')return json({error:'Message too large'},413);
        if(error instanceof TypeError)return json({error:'Invalid UTF-8'},400);
        throw error;
      }
      let data;try{data=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
      if(!data || typeof data!=='object') return json({error:'Invalid message'},400);
      if(data.website) return json({error:'Invalid message'},400);
      const name=typeof data.callsign==='string'?data.callsign.trim():'';
      const message=typeof data.message==='string'?data.message.trim():'';
      const naut=typeof data.naut==='string'?data.naut.trim():'';
      if(!name || name.length>32 || !message || message.length>500 || naut.length>60) return json({error:'Invalid message length'},400);
      const ip=request.headers.get('CF-Connecting-IP');
      if(!ip) return json({error:'Unable to accept message'},503);
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
      const rateKey='rate:'+Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
      if(await env.GUESTBOOK.get(rateKey)) return json({error:'Please wait before posting'},429);
      await env.GUESTBOOK.put(rateKey,'1',{expirationTtl:60});
      const key='pending:'+String(9999999999999-Date.now()).padStart(13,'0')+':'+crypto.randomUUID();
      await env.GUESTBOOK.put(key,JSON.stringify({name,naut,message,createdAt:new Date().toISOString()}),{expirationTtl:60*60*24*30});
      return json({status:'pending'},202);
    } catch {return json({error:'Guestbook unavailable'},503);}
  }
};
