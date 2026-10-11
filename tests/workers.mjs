import assert from 'node:assert/strict';
import worker from '../workers/guestbook-worker.js';
const rows=new Map();
const kv={get:async(key,type)=>{const v=rows.get(key);return type==='json'&&v?JSON.parse(v):v||null},put:async(key,value)=>rows.set(key,value),list:async({prefix,limit})=>({keys:[...rows.keys()].filter(k=>k.startsWith(prefix)).sort().slice(0,limit).map(name=>({name}))})};
const env={GUESTBOOK:kv,SITE_ORIGIN:'https://example.neocities.org'};
const post=(data,origin=env.SITE_ORIGIN)=>new Request('https://guestbook.example/',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(data)});
const valid={callsign:'Space visitor',naut:'Admiral Swiggins',message:'<script>alert(1)</script> Hello!',website:''};
assert.equal((await worker.fetch(post(valid,'https://wrong.example'),env)).status,403);
assert.equal((await worker.fetch(post({...valid,message:'x'.repeat(501)}),env)).status,400);
assert.equal((await worker.fetch(post({...valid,website:'spam'}),env)).status,400);
const accepted=await worker.fetch(post(valid),env);assert.equal(accepted.status,202);assert.equal(accepted.headers.get('Access-Control-Allow-Origin'),env.SITE_ORIGIN);
assert.equal((await worker.fetch(post(valid),env)).status,429);
let feed=await worker.fetch(new Request('https://guestbook.example/'),env);assert.deepEqual((await feed.json()).entries,[]);
const pending=[...rows.keys()].find(k=>k.startsWith('pending:'));assert.ok(pending);
rows.set(pending.replace('pending:','published:'),rows.get(pending));rows.delete(pending);
feed=await worker.fetch(new Request('https://guestbook.example/'),env);assert.equal((await feed.json()).entries[0].message,valid.message);
assert.equal((await worker.fetch(new Request('https://guestbook.example/'),{})).status,503);
// Reject unbounded or malformed streaming bodies without using request.text().
function streamedRequest(chunks,ip,contentLength) {
  const body=new ReadableStream({start(controller){
    for(const chunk of chunks)controller.enqueue(chunk);
    controller.close();
  }});
  const headers={Origin:env.SITE_ORIGIN,'Content-Type':'application/json','CF-Connecting-IP':ip};
  if(contentLength!==undefined)headers['Content-Length']=String(contentLength);
  return new Request('https://guestbook.example/',{method:'POST',headers,body,duplex:'half'});
}
const encoder=new TextEncoder();
const huge=encoder.encode(JSON.stringify({...valid,message:'Z'.repeat(5000)}));
const chunked=[huge.subarray(0,2010),huge.subarray(2010)];
assert.equal((await worker.fetch(streamedRequest(chunked,'192.0.2.2'),env)).status,413,
  'request must stop at a byte cap even without Content-Length');
assert.equal((await worker.fetch(streamedRequest(chunked,'192.0.2.2',3),env)).status,413,
  'a forged Content-Length must not bypass the byte cap');
assert.equal((await worker.fetch(streamedRequest([encoder.encode('{}')],'192.0.2.3',5000),env)).status,413);
assert.equal((await worker.fetch(streamedRequest([Uint8Array.from([0xc3,0x28])],'192.0.2.4'),env)).status,400,
  'invalid UTF-8 must not reach the pending queue');
assert.equal((await worker.fetch(streamedRequest([encoder.encode('{bad json}')],'192.0.2.4'),env)).status,400);
assert.equal((await worker.fetch(streamedRequest([encoder.encode(JSON.stringify(valid))],'192.0.2.5'),env)).status,202,
  'normal small UTF-8 JSON still submits for moderation');
const failingKv={...kv,get:async()=>{throw new Error('KV outage');}};
assert.equal((await worker.fetch(streamedRequest([encoder.encode(JSON.stringify(valid))],'192.0.2.6'),
  {...env,GUESTBOOK:failingKv})).status,503);

console.log('Passed: bounded streaming (real byte cap), UTF-8/JSON validation, origin checks, moderation and KV outage handling.');
