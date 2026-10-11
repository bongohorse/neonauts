// Local measurement only by default. No production requests in CI.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {summarize,validateSample} from './performance-metrics.mjs';
const repository=resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=process.argv.slice(2);
function option(name,fallback){const index=args.indexOf(name);return index<0?fallback:args[index+1];}
for(let i=0;i<args.length;i+=2)assert.ok(['--runs','--out','--url'].includes(args[i]) && args[i+1],'unknown or incomplete argument');
const runs=Number(option('--runs',5));
assert.ok(Number.isInteger(runs) && runs>=5 && runs<=30,'use 5–30 independent samples');
const out=resolve(repository,option('--out','tests/artifacts/performance'));
const production=option('--url',null);
if(production){assert.ok(!process.env.CI,'production diagnostic forbidden in CI');assert.equal(new URL(production).protocol,'https:');}
const network={offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8,connectionType:'cellular4g'};
const scenarios=[{name:'root-desktop',path:'/',viewport:{width:1365,height:768},dpr:1.25},
  {name:'pages-mobile',path:'/neonauts/',viewport:{width:390,height:844},dpr:1.25}];
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json',
  '.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
let server,browser;
await mkdir(out,{recursive:true});
if(!production){
  const python=process.env.PYTHON || 'python';
  for(const [directory,prefix] of [['dist-browser-root','/'],['dist-browser-pages','/neonauts/']])
    execFileSync(python,['scripts/build.py','--out',directory,'--base-path',prefix],{cwd:repository,stdio:'inherit'});
  server=createServer(async(req,res)=>{
    let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
    const pages=pathname.startsWith('/neonauts/');
    const directory=resolve(repository,pages?'dist-browser-pages':'dist-browser-root');
    let relative=pathname.slice(pages?10:1);if(!relative || relative.endsWith('/'))relative+='index.html';
    const target=resolve(directory,relative);
    if(!target.startsWith(directory+sep)){res.writeHead(403).end();return;}
    try{const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)] || 'application/octet-stream'}).end(data);}
    catch{res.writeHead(404).end('Missing test asset');}
  });
  await new Promise((ok,fail)=>server.once('error',fail).listen(0,'127.0.0.1',ok));
}
const origin=production || 'http://127.0.0.1:'+server.address().port;
const sourceDiff=execFileSync('git',['diff','HEAD','--','src','data','scripts'],{cwd:repository,encoding:'utf8'});
const result={sourceDiffPresent:Boolean(sourceDiff),sourceDiffSha256:createHash('sha256').update(sourceDiff).digest('hex'),schemaVersion:1,date:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim(),
  mode:production?'manual-production-diagnostic':'local-static-lab',origin,
  environment:{node:process.version,platform:process.platform,playwright:JSON.parse(await readFile(new URL('../node_modules/playwright/package.json',import.meta.url),'utf8')).version,
    cpuSlowdown:4,network,cache:'fresh context + CDP bypass; service workers blocked',settleMs:2000},scenarios:[]};
try{
  browser=await chromium.launch({headless:true});result.environment.chromium=browser.version();
  for(const scenario of production?[{...scenarios[0],name:'manual-production',path:''}]:scenarios){
    const entry={...scenario,samples:[]};result.scenarios.push(entry);
    for(let run=1;run<=runs;run++){
      const context=await browser.newContext({viewport:scenario.viewport,deviceScaleFactor:scenario.dpr,serviceWorkers:'block'});
      const page=await context.newPage(),client=await context.newCDPSession(page);
      const errors=[],blockedExternal=[],responses=new Map(),finished=[];
      let taskDuration=0;
      page.on('pageerror',e=>errors.push('pageerror: '+e.message));
      // External services are explicit exclusions, never silent pass/fail dependencies.
      await context.route('**/*',route=>{
        if(new URL(route.request().url()).origin===new URL(origin).origin)return route.continue();
        blockedExternal.push(route.request().url());return route.abort('blockedbyclient');
      });
      await client.send('Network.enable');
      client.on('Network.responseReceived',e=>{
        responses.set(e.requestId,{url:e.response.url,type:e.type,status:e.response.status});
        if(e.response.status>=400)errors.push('HTTP '+e.response.status+' '+e.response.url);
      });
      client.on('Network.loadingFinished',e=>finished.push({id:e.requestId,bytes:e.encodedDataLength}));
      client.on('Network.loadingFailed',e=>{if(!e.blockedReason && !e.errorText.includes('BLOCKED'))errors.push('network: '+e.errorText);});
      await client.send('Network.setCacheDisabled',{cacheDisabled:true});
      await client.send('Emulation.setCPUThrottlingRate',{rate:4});
      await client.send('Network.emulateNetworkConditions',network);
      await client.send('Performance.enable');
      await page.addInitScript(()=>{
        window.__perf={cls:0,lcp:null,longTasks:[],supported:PerformanceObserver.supportedEntryTypes};
        const observe=(type,callback)=>{if(PerformanceObserver.supportedEntryTypes.includes(type))new PerformanceObserver(list=>callback(list.getEntries())).observe({type,buffered:true});};
        observe('largest-contentful-paint',entries=>{for(const e of entries)window.__perf.lcp={time:e.startTime,size:e.size,url:e.url,element:e.element?.tagName.toLowerCase()+(e.element?.id?'#'+e.element.id:'')};});
        observe('layout-shift',entries=>{for(const e of entries)if(!e.hadRecentInput)window.__perf.cls+=e.value;});
        observe('longtask',entries=>window.__perf.longTasks.push(...entries.map(e=>({start:e.startTime,duration:e.duration}))));
      });
      try{
        await page.goto(origin+scenario.path,{waitUntil:'load',timeout:90000});
        await page.waitForTimeout(2000);
        // No clicks/scroll before snapshot: they terminate/change LCP and lazy loading.
        const sample=await page.evaluate(()=>{
          const n=performance.getEntriesByType('navigation')[0];
          return {...window.__perf,fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
            navigation:{domContentLoaded:n.domContentLoadedEventEnd,load:n.loadEventEnd,responseStart:n.responseStart},
            resources:performance.getEntriesByType('resource').map(e=>({name:e.name,initiatorType:e.initiatorType,transferSize:e.transferSize,startTime:e.startTime,responseStart:e.responseStart,responseEnd:e.responseEnd,duration:e.duration}))};
        });
        const metrics=Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(e=>[e.name,e.value]));
        taskDuration=metrics.TaskDuration;
        const byType={};for(const f of finished){const response=responses.get(f.id);if(!response)continue;const bucket=byType[response.type]??={requests:0,transferBytes:0};bucket.requests++;bucket.transferBytes+=f.bytes;}
        Object.assign(sample,{run,errors,blockedExternal,requests:finished.filter(f=>responses.has(f.id)).length,
          transferBytes:Object.values(byType).reduce((sum,b)=>sum+b.transferBytes,0),byType,
          cpuMs:{layout:metrics.LayoutDuration*1000,recalcStyle:metrics.RecalcStyleDuration*1000,script:metrics.ScriptDuration*1000,task:taskDuration*1000},layoutCount:metrics.LayoutCount});
        entry.samples.push(sample);
        validateSample(sample);
        if(run===1)await page.screenshot({path:resolve(out,scenario.name+'.png')});
        console.log(scenario.name,run,'FCP',sample.fcp.toFixed(1),'LCP',sample.lcp.time.toFixed(1),'layout',sample.cpuMs.layout.toFixed(1));
      }catch(error){await page.screenshot({path:resolve(out,scenario.name+'-failure-'+run+'.png')}).catch(()=>{});throw error;}
      finally{await context.close();await writeFile(resolve(out,'raw.json'),JSON.stringify(result,null,2)+'\n');}
    }
    entry.summary=Object.fromEntries(['fcp','lcp','cls','transferBytes','requests','layout','script','longTasks'].map(key=>[key,summarize(entry.samples.map(s=>key==='lcp'?s.lcp.time:key==='layout'||key==='script'?s.cpuMs[key]:key==='longTasks'?s.longTasks.length:s[key]))]));
  }
  const rows=['scenario,metric,median,min,max,raw_samples'];
  const markdown=['# Cold-load lab measurements','',`Revision: ${result.revision}; Chromium ${result.environment.chromium}; Playwright ${result.environment.playwright}.`,
    '',`Mode: ${result.mode}; CPU ×4; 150 ms latency; 1.6 Mbit/s download; 750 kbit/s upload; cache bypass; DPR 1.25.`,
    '', '| Scenario | Metric | Median | Min | Max | Raw samples |','|---|---|---:|---:|---:|---|'];
  for(const s of result.scenarios)for(const [key,v]of Object.entries(s.summary)){
    rows.push(`${s.name},${key},${v.median},${v.min},${v.max},"${v.samples.join(';')}"`);
    markdown.push(`| ${s.name} | ${key} | ${v.median.toFixed(3)} | ${v.min.toFixed(3)} | ${v.max.toFixed(3)} | ${v.samples.map(n=>n.toFixed(3)).join(', ')} |`);
  }
  markdown.push('','Times are milliseconds; CLS unitless; bytes include encoded response/header bytes reported by CDP. Long-task counts cover the observation window. CPU durations are cumulative CDP counters, not a breakdown of individual peaks. See docs/performance.md for limits.');
  await writeFile(resolve(out,'raw.json'),JSON.stringify(result,null,2)+'\n');
  await writeFile(resolve(out,'summary.csv'),rows.join('\n')+'\n');
  await writeFile(resolve(out,'summary.md'),markdown.join('\n')+'\n');
}finally{if(browser)await browser.close();if(server)await new Promise(ok=>server.close(ok));}
