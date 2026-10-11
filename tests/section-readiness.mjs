// Compare the guarded build and an explicitly labeled local loading prototype.
// Run at repository root after building dist-browser-root. Does not hit production.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';
import {summarize} from './performance-metrics.mjs';
const out=resolve(process.argv[2] || 'tests/artifacts/section-readiness');
const directory=resolve('dist-browser-root');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(pathname.endsWith('/'))pathname+='index.html';const path=resolve(directory,'.'+pathname);
 if(!path.startsWith(directory+sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'}).end(await readFile(path));}catch{res.writeHead(404).end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
let browser;const results=[];
try{
 browser=await chromium.launch({headless:true});
 for(let run=1;run<=5;run++){
  const context=await browser.newContext({viewport:{width:1365,height:768},deviceScaleFactor:1.25,serviceWorkers:'block'});
  const page=await context.newPage(),c=await context.newCDPSession(page),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  await c.send('Network.enable');await c.send('Network.setCacheDisabled',{cacheDisabled:true});
  await c.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
  await c.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto(origin,{waitUntil:'load'});await page.waitForTimeout(2000);
  const sample=await page.evaluate(async()=>{
   const begin=performance.now();location.hash='maps';
   while(document.querySelectorAll('.map-card').length!==6){if(performance.now()-begin>10000)throw Error('Maps not ready');await new Promise(ok=>setTimeout(ok,10));}
   const controlsMs=performance.now()-begin;
   // Native lazy loading can start after the section transition; a replaced
   // image may reject decode before the current visible node has loaded.
   while(true){
    const image=document.querySelector('.map-hero img');
    if(image?.complete && image.naturalWidth>0){await image.decode();break;}
    if(performance.now()-begin>15000)throw Error('Maps art not decoded');
    await new Promise(ok=>setTimeout(ok,10));
   }
   return {controlsMs,artworkMs:performance.now()-begin};
  });
  assert.deepEqual(errors,[]);results.push({run,...sample});await context.close();
 }
 await mkdir(out,{recursive:true});await writeFile(resolve(out,'readiness.json'),JSON.stringify({chromium:browser.version(),viewport:{width:1365,height:768},dpr:1.25,cpu:4,latencyMs:150,downloadBytesPerSecond:200000,uploadBytesPerSecond:93750,samples:results,
  summary:{controlsMs:summarize(results.map(s=>s.controlsMs)),artworkMs:summarize(results.map(s=>s.artworkMs))}},null,2)+'\n');
 console.log(JSON.stringify(results));
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
