// Native Chromium smoke test; run against two independently generated builds.
// Install: npm install --no-save --no-package-lock playwright@1.56.0
//          npx playwright install chromium
// Build:   python scripts/build.py --out dist-browser-root
//          python scripts/build.py --out dist-browser-pages --base-path /neonauts/
// Run:     node tests/browser-smoke.mjs
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const repository=resolve(fileURLToPath(new URL('..',import.meta.url)));
const rootBuild=resolve(repository,'dist-browser-root');
const pagesBuild=resolve(repository,'dist-browser-pages');
const artifacts=resolve(repository,'tests','artifacts');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8','.json':'application/json',
  '.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml',
  '.woff2':'font/woff2','.ico':'image/x-icon'};

const server=createServer(async(request,response)=>{
  let pathname;
  try { pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname); }
  catch {response.writeHead(400);response.end();return;}
  const isPages=pathname==='/neonauts'||pathname.startsWith('/neonauts/');
  if(pathname==='/neonauts'){response.writeHead(308,{Location:'/neonauts/'});response.end();return;}
  const site=isPages?pagesBuild:rootBuild;
  let relative=isPages?pathname.slice('/neonauts/'.length):pathname.slice(1);
  if(!relative||relative.endsWith('/'))relative+='index.html';
  const target=resolve(site,relative);
  if(!target.startsWith(site+sep)){response.writeHead(403);response.end();return;}
  try {
    const body=await readFile(target);
    response.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'});
    response.end(body);
  } catch(error) {
    response.writeHead(error.code==='ENOENT'?404:500);
    response.end('Test asset unavailable');
  }
});

await new Promise((ok,fail)=>server.once('error',fail).listen(0,'127.0.0.1',ok));
const origin='http://127.0.0.1:'+server.address().port;
let browser;

async function smoke(prefix,viewport,label){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  const failures=[];
  page.on('pageerror',error=>failures.push('Uncaught page error: '+error.message));
  page.on('response',response=>{
    if(response.url().startsWith(origin+'/')&&response.status()>=400)
      failures.push('Broken local request: '+response.status()+' '+response.url());
  });
  try {
    await page.goto(origin+prefix,{waitUntil:'load'});
    await page.locator('.naut-hex.available').first().waitFor();
    assert.equal(await page.locator('.naut-hex.available').count(),34);

    // Same-document Naut navigation retains a standalone deep-link URL.
    await page.locator('.naut-hex[data-naut-slug="ayla"]').click();
    await page.waitForURL(url=>url.pathname.endsWith('/nauts/ayla/'));
    await page.waitForFunction(()=>document.querySelector('.dossier-heading h1')?.textContent?.includes('AYLA'));
    const skinBefore=await page.locator('#skin-name').textContent();
    await page.locator('#skin-next').click();
    assert.notEqual(await page.locator('#skin-name').textContent(),skinBefore,'skin next must update');

    await page.goBack();
    await page.waitForFunction(()=>document.querySelector('.dossier-heading h1')?.textContent?.includes('ADMIRAL SWIGGINS'));
    await page.goForward();
    await page.waitForFunction(()=>document.querySelector('.dossier-heading h1')?.textContent?.includes('AYLA'));

    // Direct URLs must work without previous navigation state.
    await page.goto(origin+prefix+'nauts/clunk/',{waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('.dossier-heading h1')?.textContent?.includes('CLUNK'));

    await page.locator('[data-section="maps"]').click();
    await page.locator('#map-search').fill('Sorona');
    assert.equal(await page.locator('.map-card:not([hidden])').count(),1,'map search should filter');
    await page.locator('.map-card:not([hidden])').first().click();
    await page.locator('[data-map-tab="layout"]').click();
    await page.locator('#open-map-layout').click();
    assert.equal(await page.locator('#map-viewer').evaluate(e=>e.open),true,'map viewer must open');
    await page.locator('#map-viewer-close').click();

    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{
      window.__transitionsAttempted=0;
      document.startViewTransition=()=>{
        window.__transitionsAttempted++;
        throw Error('view transition requested despite reduced motion');
      };
    });
    await page.locator('[data-section="community"]').click();
    await page.waitForFunction(()=>!document.querySelector('#community').hidden);
    assert.equal(await page.evaluate(()=>window.__transitionsAttempted),0,
      'reduced-motion preference must bypass View Transitions');

    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),
      true,'page should not overflow horizontal mobile viewport');
    assert.deepEqual(failures,[],'no uncaught errors or failed same-origin files');
    console.log('PASS browser smoke:',label,origin+prefix);
  } catch(error) {
    await mkdir(artifacts,{recursive:true});
    try {await page.screenshot({path:resolve(artifacts,label+'.png'),fullPage:true});}catch{}
    throw new Error(label+': '+error.message+'; local failures: '+failures.join(' | '),{cause:error});
  } finally {
    await context.close();
  }
}

try {
  browser=await chromium.launch({headless:true});
  await smoke('/',{width:1365,height:768},'root-desktop');
  await smoke('/neonauts/',{width:390,height:844},'pages-mobile');
  console.log('PASS: native Chromium Naut routes, skins, history, maps, responsive and reduced-motion checks.');
} finally {
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
