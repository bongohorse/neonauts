// Read-only native rendering evidence; run from repository root after building root output.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';
const out=resolve(process.argv[2]||'tests/artifacts/render-audit'),directory=resolve('dist-browser-root');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 let path;try{path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(path.endsWith('/'))path+='index.html';const target=resolve(directory,'.'+path);
 if(!target.startsWith(directory+sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'}).end(await readFile(target));}catch{res.writeHead(404).end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin='http://127.0.0.1:'+server.address().port;
const observations=[];let browser;
await mkdir(out,{recursive:true});
try{
 browser=await chromium.launch({headless:true});
 for(const [label,viewport] of [['desktop',{width:1365,height:768}],['mobile',{width:390,height:844}]]){
  for(const [slug,path,motion] of [['root','/','no-preference'],['clunk','/nauts/clunk/','no-preference'],['gnaw','/nauts/gnaw/','no-preference'],['root-reduced','/','reduce']]){
   const name=slug+'-'+label,context=await browser.newContext({viewport,deviceScaleFactor:1.25,reducedMotion:motion,serviceWorkers:'block'});
   const page=await context.newPage(),c=await context.newCDPSession(page),errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
   await c.send('Network.enable');await c.send('Network.setCacheDisabled',{cacheDisabled:true});
   await c.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
   await c.send('Emulation.setCPUThrottlingRate',{rate:4});
   await page.addInitScript(()=>{
    window.__render={lcp:null,cls:0};
    new PerformanceObserver(list=>{for(const e of list.getEntries())window.__render.lcp={time:e.startTime,url:e.url,element:e.element?.tagName.toLowerCase()+(e.element?.id?'#'+e.element.id:'')};}).observe({type:'largest-contentful-paint',buffered:true});
    new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__render.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
   });
   await page.goto(origin+path,{waitUntil:'load',timeout:90000});await page.waitForTimeout(2000);
   const data=await page.evaluate(()=>{
    const art=document.querySelector('#character-art'),stage=document.querySelector('.stage-art');
    const box=e=>{const b=e.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};};
    const resource=performance.getEntriesByType('resource').find(e=>e.name===art.src);
    const lcpResource=performance.getEntriesByType('resource').find(e=>e.name===window.__render.lcp.url);
    const timing=e=>e?{start:e.startTime,responseStart:e.responseStart,end:e.responseEnd,transfer:e.transferSize}:null;
    return {...window.__render,hero:{url:art.src,priority:art.fetchPriority,complete:art.complete,naturalWidth:art.naturalWidth,box:box(art),stage:box(stage),animation:getComputedStyle(art).animationName,timing:timing(resource)},
      lcpResource:timing(lcpResource),navigationResponseStart:performance.getEntriesByType('navigation')[0].responseStart,
      font:performance.getEntriesByType('resource').filter(e=>e.name.includes('.woff2')).map(timing),fontsStatus:document.fonts.status};
   });
   assert.ok(data.hero.complete&&data.hero.naturalWidth>0);assert.equal(requests.filter(u=>u===data.hero.url).length,1,'hero URL must not duplicate');
   assert.ok(data.hero.box.left>=data.hero.stage.left-2 && data.hero.box.right<=data.hero.stage.right+2,'hero stays in stage');
   if(motion==='reduce')assert.equal(data.hero.animation,'none');
   await page.screenshot({path:resolve(out,name+'.png')});
   // Interactive trace preserves the effects being assessed, rather than disabling them.
   if(slug==='root'){
    const events=[];c.on('Tracing.dataCollected',e=>events.push(...e.value));
    await c.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline',options:'record-as-much-as-possible'});
    await page.locator('.naut-hex.available').first().hover();await page.waitForTimeout(180);
    await page.locator('#skin-next').click();await page.waitForTimeout(350);
    await page.locator('[data-section="maps"]').click();await page.waitForTimeout(1500);
    const done=new Promise(ok=>c.once('Tracing.tracingComplete',ok));await c.send('Tracing.end');await done;
    await writeFile(resolve(out,name+'-interactive-trace.json'),JSON.stringify({traceEvents:events}));
    data.interactive=Object.fromEntries(['Paint','Layout','UpdateLayoutTree','CompositeLayers'].map(key=>{
      const matches=events.filter(e=>e.name===key&&e.ph==='X');return [key,{count:matches.length,totalMs:matches.reduce((s,e)=>s+(e.dur||0)/1000,0),maxMs:Math.max(0,...matches.map(e=>(e.dur||0)/1000))}];
    }));
   }
   assert.deepEqual(errors,[]);observations.push({name,path,motion,viewport,dpr:1.25,cpu:4,...data,errors});
   await context.close();console.log(name,data.lcp.element,data.lcp.time,'hero-end',data.hero.timing?.end);
   await writeFile(resolve(out,'audit.json'),JSON.stringify({chromium:browser.version(),network:{latencyMs:150,downloadBytesPerSecond:200000,uploadBytesPerSecond:93750},observations},null,2)+'\n');
  }
 }
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
