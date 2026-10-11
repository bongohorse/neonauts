import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const root=resolve('dist-browser-root'),immutable=resolve('dist-browser-immutable');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{let path=new URL(req.url,'http://localhost').pathname;const site=path.startsWith('/immutable/')?immutable:root;path=path.replace(/^\/immutable\//,'/');if(path.endsWith('/'))path+='index.html';const file=resolve(site,'.'+path);if(!file.startsWith(site+sep)){res.writeHead(403).end();return;}try{const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(body);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
const page=await browser.newPage({reducedMotion:'reduce'}),results={chromium:browser.version()};
try{
await page.goto(origin+'/');
for(const slug of ['ayla','clunk']){await page.locator(`[data-naut-slug="${slug}"]`).click();await page.waitForFunction(s=>nautPage.slug===s,slug);}
let release,received;const gate=new Promise(r=>release=r),seen=new Promise(r=>received=r);
await page.route('**/nauts/ayla/',async route=>{if(route.request().resourceType()!=='fetch')return route.continue();const response=await route.fetch();received();await gate;await route.fulfill({response});});
await page.evaluate(()=>history.back());await seen;
await page.evaluate(()=>history.forward());await page.waitForURL('**/nauts/clunk/');release();
await page.waitForFunction(()=>document.querySelector('#main').getAttribute('aria-busy')!=='true');
results.historyRace=await page.evaluate(()=>({path:location.pathname,slug:nautPage.slug,title:document.title,heading:document.querySelector('.dossier-heading h1').textContent}));
await page.unroute('**/nauts/ayla/');await page.goto(origin+'/');
let release2,received2;const gate2=new Promise(r=>release2=r),seen2=new Promise(r=>received2=r);
await page.route('**/nauts/ayla/',async route=>{const response=await route.fetch();received2();await gate2;await route.fulfill({response});});
await page.locator('[data-naut-slug="ayla"]').click();await seen2;
await page.locator('[data-naut-slug="admiral-swiggins"]').click();release2();await page.waitForFunction(()=>nautPage.slug==='ayla');
results.sameNautRace=await page.evaluate(()=>({path:location.pathname,slug:nautPage.slug}));
await page.unroute('**/nauts/ayla/');await page.goto(origin+'/immutable/#goodies');
const codes=await page.locator('.embed-code').evaluateAll(nodes=>nodes.map(n=>n.value));
results.embedCodes=[];for(const code of codes){const src=code.match(/src="([^"]+)"/)[1];const url=src.replace('https://awesomenauts.neocities.org',origin+'/immutable');results.embedCodes.push({src,status:(await page.request.get(url)).status()});}
await page.goto(origin+'/');await page.locator('#secret-cube').click();
const cdp=await page.context().newCDPSession(page);
const dialogs=async()=> (await cdp.send('Accessibility.getFullAXTree')).nodes.filter(n=>n.role?.value==='dialog').map(n=>({role:n.role.value,name:n.name?.value}));
results.arcadeAX=await dialogs();await page.locator('#arcade-close').click();
await page.locator('[data-section="maps"]').click();await page.locator('[data-map-tab="layout"]').click();await page.locator('#open-map-layout').click();results.mapViewerAX=await dialogs();
results.layout=[];
const slugs=await page.evaluate(()=>archiveData.roster.map(n=>n.slug));
for(const width of [320,390,768,1365]){
 await page.setViewportSize({width,height:844});
 for(const slug of slugs){
  await page.goto(origin+'/nauts/'+slug+'/');await page.evaluate(()=>document.fonts.ready);
  const observation=await page.evaluate(()=>({pageOverflow:document.documentElement.scrollWidth>innerWidth+2,skinLabelOverflow:[...document.querySelectorAll('.skin-buttons span')].filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.textContent)}));
  if(observation.pageOverflow||observation.skinLabelOverflow.length)results.layout.push({width,slug,...observation});
 }
}
results.layoutCases=slugs.length*4;
await writeFile('tests/artifacts/review-probes.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
