// Native Chromium smoke test; run against two independently generated builds.
// Install: npm install --no-save --no-package-lock playwright@1.56.0
//          npx playwright install chromium
// Build:   python scripts/build.py --out dist-browser-root
//          python scripts/build.py --out dist-browser-pages --base-path /neonauts/
// Run:     node tests/browser-smoke.mjs
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const repository=resolve(fileURLToPath(new URL('..',import.meta.url)));
const rootBuild=resolve(repository,'dist-browser-root');
const pagesBuild=resolve(repository,'dist-browser-pages');
const immutableBuild=resolve(repository,'dist-browser-immutable');
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
  const isImmutable=pathname==='/immutable'||pathname.startsWith('/immutable/');
  if(pathname==='/immutable'){response.writeHead(308,{Location:'/immutable/'});response.end();return;}
  const site=isPages?pagesBuild:isImmutable?immutableBuild:rootBuild;
  let relative=isPages?pathname.slice('/neonauts/'.length):
               isImmutable?pathname.slice('/immutable/'.length):pathname.slice(1);
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
  const rosterAtlasRequests=[];
  page.on('request',request=>{
    if(/nauts_profile_spritesheet(?:\.[a-f0-9]{24})?\.webp(?:\?|$)/.test(request.url()))
      rosterAtlasRequests.push(request.url());
    if(/\/IconCharacter[^/]*\.webp(?:\?|$)/.test(request.url()))
      failures.push('Unexpected individual roster icon request: '+request.url());
  });
  page.on('pageerror',error=>failures.push('Uncaught page error: '+error.message));
  page.on('response',response=>{
    if(response.url().startsWith(origin+'/')&&response.status()>=400)
      failures.push('Broken local request: '+response.status()+' '+response.url());
  });
  try {
    await page.goto(origin+prefix,{waitUntil:'load'});
    await page.locator('.naut-hex.available').first().waitFor();
    assert.equal(await page.locator('.naut-hex.available').count(),34);
    const spriteTiles=await page.locator('.naut-hex').evaluateAll(nodes=>
      nodes.map(button=>{
        const outer=button.querySelector(':scope > svg');
        const image=outer?.querySelector(':scope > image.roster-sprite');
        return {
          slug:button.dataset.nautSlug,
          innerSvgCount:outer?.querySelectorAll('svg').length,
          x:image?.getAttribute('x'),y:image?.getAttribute('y'),
          width:image?.getAttribute('width'),height:image?.getAttribute('height'),
          image:image?.getAttribute('href'),
          clip:image?.getAttribute('clip-path'),
          clipUnits:outer?.querySelector('clipPath')?.getAttribute('clipPathUnits'),
        };
      }));
    // HTML DOM order groups the two roster wings, whereas sprite indices
    // correspond to source data's row-major character order.
    const spriteIndexBySlug=await page.evaluate(()=>
      Object.fromEntries(archiveData.roster.map(n=>[n.slug,n.spriteIndex])));
    assert.equal(spriteTiles.length,34,'every hex needs a positioned sprite image');
    const spriteImage=spriteTiles[0].image;
    assert.ok(/nauts_profile_spritesheet(?:\.[a-f0-9]{24})?\.webp$/.test(spriteImage),
      'the actual roster sheet must be referenced');
    const tile=128,scale=Math.max(68/tile,73/tile),size=768*scale;
    for(const item of spriteTiles){
      const i=spriteIndexBySlug[item.slug];
      assert.ok(Number.isInteger(i)&&i>=0&&i<34,`unknown Naut: ${item.slug}`);
      assert.equal(item.innerSvgCount,0,'nested SVG would break sprite clipping');
      assert.equal(item.clipUnits,'userSpaceOnUse');
      assert.ok(/^url\(#portrait-clip-\d+\)$/.test(item.clip),'missing hex clip');
      assert.equal(item.image,spriteImage,'every portrait uses one shared atlas');
      const expectX=5-(i%6)*tile*scale-(tile*scale-68)/2;
      const expectY=7-Math.floor(i/6)*tile*scale-(tile*scale-73)/2;
      assert.ok(Math.abs(Number(item.x)-expectX)<.001,`incorrect sprite x: ${item.slug}`);
      assert.ok(Math.abs(Number(item.y)-expectY)<.001,`incorrect sprite y: ${item.slug}`);
      assert.ok(Math.abs(Number(item.width)-size)<.001);
      assert.ok(Math.abs(Number(item.height)-size)<.001);
    }
    assert.equal(rosterAtlasRequests.length,1,'one atlas URL should cause one network request');
    // Preserve a native rendering sample for visual approval in the PR.
    if(label==='root-desktop'||label==='pages-mobile'){
      await mkdir(artifacts,{recursive:true});
      await page.locator('#roster').screenshot({
        path:resolve(artifacts,'roster-sprite-'+label+'.png')
      });
      if(label==='root-desktop'){
        const centers=await page.evaluate(()=>{
          const roster=document.querySelector('#roster').getBoundingClientRect();
          return [...document.querySelectorAll('.naut-hex')].map(button=>{
            const box=button.getBoundingClientRect();
            return {slug:button.dataset.nautSlug,
                    x:box.x+box.width/2-roster.x,
                    y:box.y+box.height/2-roster.y,
                    width:box.width,height:box.height};
          });
        });
        await writeFile(resolve(artifacts,'roster-sprite-centers.json'),
                        JSON.stringify(centers));
      }
    }

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
    if(label==='neocities-immutable'){
      // Simulate an interrupted multi-HTML release: the in-page fetch sees
      // newer shared assets than the page's currently loaded JS/CSS.
      // It must perform a full navigation instead of mixing generations.
      await page.goto(origin+prefix,{waitUntil:'load'});
      await page.evaluate(()=>{window.__oldNautDocument=true;});
      let suppliedNewerHtml=false;
      await page.route('**/immutable/nauts/ayla/',async route=>{
        if(route.request().resourceType()!=='fetch'){
          await route.continue();return;
        }
        const response=await route.fetch();
        const oldMarkup=await response.text();
        const newerMarkup=oldMarkup.replace(/roster-data\.[0-9a-f]{24}\.js/g,
                                           'roster-data.000000000000000000000000.js');
        assert.notEqual(newerMarkup,oldMarkup,'expected a shared JS version in fetched dossier');
        suppliedNewerHtml=true;
        await route.fulfill({response,body:newerMarkup});
      });
      await page.locator('.naut-hex[data-naut-slug="ayla"]').click();
      await page.waitForURL(url=>url.pathname.endsWith('/nauts/ayla/'));
      await page.waitForFunction(()=>document.querySelector('.dossier-heading h1')?.textContent?.includes('AYLA'));
      assert.equal(suppliedNewerHtml,true,'mixed-version response must be exercised');
      assert.equal(await page.evaluate(()=>window.__oldNautDocument===undefined),true,
                   'mixed releases must force a full document load');
      await page.unroute('**/immutable/nauts/ayla/');
      assert.deepEqual(failures,[],'mixed release navigation must keep local requests healthy');
    }
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
  await smoke('/immutable/',{width:390,height:844},'neocities-immutable');
  console.log('PASS: native Chromium root, GitHub Pages and Neocities immutable Naut routes, skins, history, maps, responsive and reduced-motion checks.');
} finally {
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
