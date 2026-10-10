import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/static/players.js',import.meta.url),'utf8');
const statsSource=readFileSync(new URL('../src/static/steam-stats.js',import.meta.url),'utf8');
async function render(data,ok=true){
 const count={textContent:''},mini={textContent:''},status={textContent:''};
 const context={siteConfig:{playerCountUrl:''},URL,Date,Number,AbortSignal,
  document:{hidden:false,baseURI:'https://example.test/neonauts/',querySelector:()=>null,querySelectorAll:s=>s==='[data-player-count]'?[count,mini]:s==='[data-player-status]'?[status]:[],addEventListener(){}},
  setInterval(){},fetch:async(url,options)=>{assert.equal(String(url),'https://example.test/neonauts/players.json');assert.equal(options.cache,'no-store');return {ok,json:async()=>data};}};
 vm.createContext(context);vm.runInContext(statsSource,context);vm.runInContext(source,context);
 // Flush the fetch/json promises without sleeping or making a real request.
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(count.textContent,mini.textContent);
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
const context=vm.createContext({Date,Map,Number,Math});vm.runInContext(statsSource,context);
const stats=vm.runInContext('steamStats',context);
const points=stats.history({history:[{players:0,checkedAt:now},{players:10,checkedAt:new Date(Date.now()-900000).toISOString()},{players:90,checkedAt:new Date(Date.now()-90000000).toISOString()}]});
assert.equal(points.length,2);
assert.deepEqual(JSON.parse(JSON.stringify(stats.summary(points))),{peak:10,min:0,average:5,change:-10});
assert.equal(stats.summary([]).peak,null);
assert.ok(!/NaN|Infinity/.test(stats.plot([{time:Date.now(),players:0}]).path));
assert.equal((stats.plot([{time:Date.now()-3600000,players:5},{time:Date.now(),players:6}]).path.match(/M/g)||[]).length,2);
console.log('Passed: 24h history, observed summary, zero-value plotting and graph gaps.');
