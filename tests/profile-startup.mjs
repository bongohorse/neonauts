import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
const out=process.argv[2] || 'tests/artifacts/startup-profile';
const {createServer}=await import('node:http');const {readFile}=await import('node:fs/promises');
const server=createServer(async(req,res)=>{try{let path=new URL(req.url,'http://localhost').pathname;if(path.endsWith('/'))path+='index.html';const body=await readFile('./dist-browser-root'+path);const type=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.html')?'text/html':'application/octet-stream';res.writeHead(200,{'Content-Type':type}).end(body);}catch{res.writeHead(404).end();}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port+'/';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
for(const [label,viewport] of [['desktop',{width:1365,height:768}],['mobile',{width:390,height:844}]]){
const context=await browser.newContext({viewport,deviceScaleFactor:1.25});const page=await context.newPage();const c=await context.newCDPSession(page);
await c.send('Network.enable');await c.send('Network.setCacheDisabled',{cacheDisabled:true});await c.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});await c.send('Emulation.setCPUThrottlingRate',{rate:4});
const events=[];c.on('Tracing.dataCollected',e=>events.push(...e.value));
await c.send('Profiler.enable');await c.send('Profiler.start');
await c.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.stack,blink.user_timing,v8.execute',options:'record-as-much-as-possible'});
await page.goto(url);await page.waitForTimeout(2000);
const cpu=(await c.send('Profiler.stop')).profile;await writeFile(out+'/'+label+'-cpu.json',JSON.stringify(cpu));
const done=new Promise(ok=>c.once('Tracing.tracingComplete',ok));await c.send('Tracing.end');await done;
const nav=events.find(e=>e.name==='navigationStart'&&e.args?.data?.documentLoaderURL===url);
const layouts=events.filter(e=>e.name==='Layout'&&e.ph==='X').sort((a,b)=>b.dur-a.dur);
const evaluated=events.filter(e=>e.name==='EvaluateScript'&&e.ph==='X');
const roots=[];
for(const e of layouts.slice(0,4)){
const root=e.args?.endData?.layoutRoots?.[0]?.nodeId??e.args?.endData?.rootNode;
let node=null;if(root){try{node=(await c.send('DOM.describeNode',{backendNodeId:root})).node}catch{}}
roots.push({durationMs:e.dur/1000,startMs:nav?(e.ts-nav.ts)/1000:null,args:e.args,node});
}
const data={url,label,layouts:roots,evaluated:evaluated.map(e=>({durationMs:e.dur/1000,args:e.args})),layoutTotal:layouts.reduce((s,e)=>s+e.dur/1000,0),layoutCount:layouts.length};
await writeFile(out+'/'+label+'-diagnosis.json',JSON.stringify(data,null,2));await writeFile(out+'/'+label+'-trace.json',JSON.stringify({traceEvents:events}));
console.log(label, 'layout total ms',data.layoutTotal,'events',data.layoutCount);await context.close();
}
await browser.close();await new Promise(ok=>server.close(ok));
