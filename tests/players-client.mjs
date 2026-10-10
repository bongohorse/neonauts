import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/static/players.js',import.meta.url),'utf8');
async function render(data,ok=true){
 const count={textContent:''},status={textContent:''};
 const context={siteConfig:{playerCountUrl:''},URL,Date,Number,AbortSignal,
  document:{hidden:false,baseURI:'https://example.test/neonauts/',querySelector:s=>s==='#player-count'?count:status,addEventListener(){}},
  setInterval(){},fetch:async(url,options)=>{assert.equal(String(url),'https://example.test/neonauts/players.json');assert.equal(options.cache,'no-store');return {ok,json:async()=>data};}};
 vm.runInNewContext(source,context);
 // Flush the fetch/json promises without sleeping or making a real request.
 await new Promise(resolve=>setImmediate(resolve));
 return {count:count.textContent,status:status.textContent};
}
const now=new Date().toISOString();
assert.equal((await render({players:0,checkedAt:now})).count,'0');
assert.equal((await render({players:42,checkedAt:now})).count,'42');
for(const data of [
 {players:null,checkedAt:null},{players:-1,checkedAt:now},
 {players:42,checkedAt:new Date(Date.now()-61*60*1000).toISOString()},
 {players:42,checkedAt:new Date(Date.now()+2*60*1000).toISOString()},
 {players:'42',checkedAt:now},{players:1.5,checkedAt:now},
])assert.equal((await render(data)).count,'—');
assert.equal((await render({players:42,checkedAt:now},false)).count,'—');
console.log('Passed: static prefix, zero counts, invalid/stale/future snapshots and outage display.');
