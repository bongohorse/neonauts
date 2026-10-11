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
  await context.addInitScript(()=>{
    window.__arcadeProbe={contexts:0,paints:0,pending:[]};
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(...args){
      const ctx=getContext.apply(this,args);
      if(this.id==='game' && args[0]==='2d'){
        window.__arcadeProbe.contexts++;
        const fill=ctx.fillRect;
        ctx.fillRect=function(...values){window.__arcadeProbe.paints++;return fill.apply(this,values);};
      }
      return ctx;
    };
    const request=window.requestAnimationFrame,cancel=window.cancelAnimationFrame;
    window.requestAnimationFrame=callback=>{
      if(callback.name!=='tick')return request(callback);
      let id=request(time=>{window.__arcadeProbe.pending=window.__arcadeProbe.pending.filter(n=>n!==id);callback(time);});
      window.__arcadeProbe.pending.push(id);return id;
    };
    window.cancelAnimationFrame=id=>{window.__arcadeProbe.pending=window.__arcadeProbe.pending.filter(n=>n!==id);return cancel(id);};
  });
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(15000);
  const failures=[];
  const rosterAtlasRequests=[];
  const decorativeRequests=[];
  page.on('request',request=>{
    if(request.url().includes('/assets/goodies/') || request.url().includes('ribbit-iv-splash'))decorativeRequests.push(request.url());
    if(/nauts_profile_spritesheet(?:\.[a-f0-9]{24})?\.webp(?:\?|$)/.test(request.url()))
      rosterAtlasRequests.push(request.url());
    if(/\/IconCharacter[^/]*\.webp(?:\?|$)/.test(request.url()))
      failures.push('Unexpected individual roster icon request: '+request.url());
  });
  page.on('pageerror',error=>failures.push('Uncaught page error: '+error.message));
  page.on('console',message=>{if(message.type()==='error')failures.push('Console error: '+message.text());});
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
      // Atlas slots 29 and 35 are black; the 5 Nauts in the last
      // right-hand row must occupy physical slots 30..34.
      const atlasIndex=i>=29?i+1:i;
      assert.notEqual(atlasIndex,29,'must not render row-5 black spacer');
      assert.notEqual(atlasIndex,35,'must not render row-6 black spacer');
      const expectX=5-(atlasIndex%6)*tile*scale-(tile*scale-68)/2;
      const expectY=7-Math.floor(atlasIndex/6)*tile*scale-(tile*scale-73)/2;
      assert.ok(Math.abs(Number(item.x)-expectX)<.001,`incorrect sprite x: ${item.slug}`);
      assert.ok(Math.abs(Number(item.y)-expectY)<.001,`incorrect sprite y: ${item.slug}`);
      assert.ok(Math.abs(Number(item.width)-size)<.001);
      assert.ok(Math.abs(Number(item.height)-size)<.001);
    }
    assert.deepEqual(
      Array.from({length:10},(_,offset)=>{
        const i=24+offset;
        return i<34?(i>=29?i+1:i):null;
      }).filter(i=>i!==null),
      [24,25,26,27,28,30,31,32,33,34],
      'last two atlas rows must skip black slot 29 and leave slot 35 unused'
    );
    assert.equal(spriteTiles.length,34,'black atlas slots must not create extra buttons');
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
                    spriteIndex:archiveData.roster.find(n=>n.slug===button.dataset.nautSlug).spriteIndex,
                    x:box.x+box.width/2-roster.x,
                    y:box.y+box.height/2-roster.y,
                    width:box.width,height:box.height};
          });
        });
        await writeFile(resolve(artifacts,'roster-sprite-centers.json'),
                        JSON.stringify(centers));
      }
    }

    assert.equal(await page.locator('.map-card').count(),0,'hidden Maps must not construct cards at startup');
    assert.deepEqual(decorativeRequests,[],'hidden Goodies/map hero must not request at startup');
    // Secret Arcade must do zero Canvas work before first user intent.
    assert.deepEqual(await page.evaluate(()=>window.__arcadeProbe),{contexts:0,paints:0,pending:[]});
    await page.locator('#secret-cube').click();
    assert.equal(await page.locator('#arcade').evaluate(e=>e.open),true);
    assert.equal(await page.getByRole('dialog',{name:'SECRET ARCADE / MARK I “SHOEBOX”',exact:true}).count(),1);
    assert.equal(await page.evaluate(()=>window.__arcadeProbe.contexts),1);
    assert.ok(await page.evaluate(()=>window.__arcadeProbe.paints)>0,'first open paints ready scene');
    await page.locator('#start-game').click();
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(100);
    await page.keyboard.up('ArrowUp');
    assert.ok(await page.evaluate(()=>ship)<115,'keyboard moves ship');
    assert.ok(await page.evaluate(()=>window.__arcadeProbe.pending.length)<=1,'one game loop');
    await page.locator('#start-game').click();
    assert.equal(await page.locator('#start-game').textContent(),'RESUME');
    assert.equal(await page.evaluate(()=>window.__arcadeProbe.pending.length),0);
    await page.locator('#start-game').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#arcade').evaluate(e=>e.open),false);
    assert.equal(await page.locator('#secret-cube').evaluate(e=>e===document.activeElement),true);
    const closedPaints=await page.evaluate(()=>window.__arcadeProbe.paints);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>window.__arcadeProbe.paints),closedPaints,'no paints while closed');
    assert.equal(await page.evaluate(()=>window.__arcadeProbe.pending.length),0);
    await page.locator('#secret-cube').click();
    assert.equal(await page.locator('#start-game').textContent(),'RESUME');
    assert.equal(await page.evaluate(()=>window.__arcadeProbe.contexts),1,'reuse initialized context');
    await page.locator('#start-game').click();
    // Native mouse pointer exercises capture bookkeeping; physical touch is separate.
    await page.locator('#fly-down').hover();
    await page.mouse.down();
    assert.equal(await page.evaluate(()=>held.has('down')),true);
    await page.mouse.up();
    assert.equal(await page.evaluate(()=>held.has('down')),false);
    await page.evaluate(()=>{score=21;finishGame();});
    assert.equal(await page.locator('#high-score').textContent(),'21');
    assert.equal(await page.evaluate(()=>localStorage.getItem('nauts-archive-high-score')),'21');
    await page.locator('#start-game').click();
    assert.equal(await page.locator('#score').textContent(),'0','restart resets score');
    await page.locator('#arcade-close').click();
    await page.waitForFunction(()=>window.__arcadeProbe.pending.length===0);
    assert.equal(await page.evaluate(()=>window.__arcadeProbe.pending.length),0);

    // Same-document Naut navigation retains a standalone deep-link URL.
    await page.locator('.naut-hex[data-naut-slug="ayla"]').click();
    await page.waitForURL(url=>url.pathname.endsWith('/nauts/ayla/'));
    await page.waitForFunction(()=>document.querySelector('.dossier-heading h1')?.textContent?.includes('AYLA'));
    const skinBefore=await page.locator('#skin-name').textContent();
    await page.locator('#skin-next').click();
    assert.notEqual(await page.locator('#skin-name').textContent(),skinBefore,'skin next must update');

    await page.waitForFunction(()=>{const img=document.querySelector('#character-art');return img.complete && img.naturalWidth>0;});
    await page.goBack();
    await page.waitForFunction(()=>document.querySelector('.dossier-heading h1')?.textContent?.includes('ADMIRAL SWIGGINS'));
    await page.goForward();
    await page.waitForFunction(()=>document.querySelector('.dossier-heading h1')?.textContent?.includes('AYLA'));

    // Hold each response type independently: returning to the rendered
    // history entry, or selecting its roster tile, must cancel the old intent.
    for(const responseType of ['html','json']){
      await page.locator('.naut-hex[data-naut-slug="clunk"]').click();
      await page.waitForFunction(()=>nautPage.slug==='clunk');
      async function holdAyla(){
        await page.evaluate(type=>{
          const original=window.fetch;
          let release;const gate=new Promise(resolve=>release=resolve);
          window.__heldNaut={started:false,done:false,release,restore:()=>window.fetch=original};
          window.fetch=async(input,options)=>{
            const pathname=new URL(input,document.baseURI).pathname;
            const matches=pathname.includes('/nauts/ayla/') &&
              (type==='html'?pathname.endsWith('/'):pathname.endsWith('.json'));
            if(!matches)return original(input,options);
            window.__heldNaut.started=true;window.__heldNaut.signal=options.signal;
            try{await gate;return await original(input,options);}
            finally{window.__heldNaut.done=true;}
          };
        },responseType);
      }
      async function assertCancelled(){
        await page.waitForFunction(()=>document.querySelector('#main').getAttribute('aria-busy')!=='true');
        assert.equal(await page.evaluate(()=>window.__heldNaut.signal.aborted),true,
          responseType+' old intent must be aborted');
        await page.evaluate(()=>window.__heldNaut.release());
        await page.waitForFunction(()=>window.__heldNaut.done);
        await page.evaluate(()=>window.__heldNaut.restore());
        assert.equal(await page.evaluate(()=>nautPage.slug),'clunk');
        assert.ok(new URL(page.url()).pathname.endsWith('/nauts/clunk/'));
        assert.match(await page.locator('.dossier-heading h1').textContent(),/CLUNK/);
      }
      await holdAyla();
      await page.goBack();
      await page.waitForFunction(()=>window.__heldNaut.started);
      await page.goForward();
      await assertCancelled();
      await holdAyla();
      await page.locator('.naut-hex[data-naut-slug="ayla"]').click();
      await page.waitForFunction(()=>window.__heldNaut.started);
      await page.locator('.naut-hex[data-naut-slug="clunk"]').click();
      await assertCancelled();
      // Restore the Ayla -> Clunk history pair for the next response type.
      await page.locator('.naut-hex[data-naut-slug="ayla"]').click();
      await page.waitForFunction(()=>nautPage.slug==='ayla');
    }

    // Direct URLs must work without previous navigation state.
    await page.goto(origin+prefix+'nauts/clunk/',{waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('.dossier-heading h1')?.textContent?.includes('CLUNK'));

    await page.evaluate(()=>{location.hash='goodies';});
    await page.waitForFunction(()=>[...document.querySelectorAll('#goodies img')].every(img=>img.complete&&img.naturalWidth>0));
    assert.equal(decorativeRequests.filter(url=>url.includes('/assets/goodies/')).length,9,'all deferred previews load on activation');
    const downloads=await page.locator('.goodie-card').evaluateAll(cards=>cards.map(card=>({
      code:card.querySelector('textarea').value,
      filename:card.querySelector('a[download]').download,
      href:card.querySelector('a[download]').href
    })));
    for(const download of downloads){
      assert.ok(download.code.includes('https://YOUR-SITE.neocities.org/assets/goodies/'+download.filename));
      assert.equal((await context.request.get(download.href)).status(),200);
    }
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{
      configurable:true,value:{writeText:async text=>{window.__copiedBadge=text;}}
    }));
    await page.locator('[data-copy-badge="badge-code-0"]').click();
    assert.equal(await page.evaluate(()=>window.__copiedBadge),downloads[0].code);

    await page.locator('[data-section="maps"]').click();
    await page.waitForFunction(()=>{const img=document.querySelector('.map-hero img');return img?.complete&&img.naturalWidth>0;});
    assert.equal(await page.locator('.map-card').count(),6,'first open initializes all six maps exactly once');
    await page.locator('#map-search').fill('Sorona');
    assert.equal(await page.locator('.map-card:not([hidden])').count(),1,'map search should filter');
    await page.locator('.map-card:not([hidden])').first().click();
    await page.locator('[data-map-tab="layout"]').click();
    await page.locator('#open-map-layout').click();
    assert.equal(await page.locator('#map-viewer').evaluate(e=>e.open),true,'map viewer must open');
    const mapName=await page.locator('#map-viewer-title').textContent();
    assert.equal(await page.getByRole('dialog',{name:mapName,exact:true}).count(),1);
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
    if(label==='root-desktop'){
      const slugs=await page.evaluate(()=>archiveData.roster.map(n=>n.slug));
      for(const slug of slugs){
        await page.locator('[data-section="nauts"]').click();
        await page.locator('.naut-hex[data-naut-slug="'+slug+'"]').click();
        await page.waitForFunction(slug=>nautPage.slug===slug,slug);
      }
      await page.evaluate(()=>{
        navigateNaut(new URL(archiveData.roster.find(n=>n.slug==='ayla').url,archiveBase));
        navigateNaut(new URL(archiveData.roster.find(n=>n.slug==='clunk').url,archiveBase));
      });
      await page.waitForFunction(()=>nautPage.slug==='clunk' && document.querySelector('#main').getAttribute('aria-busy')!== 'true');
      assert.deepEqual(failures,[],'all 34 dossiers and aborted rapid navigation stay healthy');
    }
    await page.goto(origin+prefix+'#maps',{waitUntil:'load'});
    assert.equal(await page.locator('.map-card').count(),6,'direct Maps hash initializes synchronously');
    await page.locator('[data-section="community"]').click();
    await page.locator('[data-section="maps"]').click();
    assert.equal(await page.locator('.map-card').count(),6,'reopening never duplicates map cards');
    assert.deepEqual(failures,[],'direct Maps and repeated opening stay healthy');
    for(const section of ['guestbook','community','goodies']){
      await page.goto(origin+prefix+'?direct='+section+'#'+section,{waitUntil:'load'});
      assert.equal(await page.locator('#'+section).evaluate(e=>e.hidden),false,'direct section hash must be ready');
      if(section==='guestbook'){
        assert.ok(await page.locator('#favourite-naut option').count()>=35,'guestbook dependencies ready');
        assert.ok(await page.locator('#guestbook-submit').isEnabled(),'guestbook local draft control ready');
      }
      if(section==='goodies')await page.waitForFunction(()=>[...document.querySelectorAll('#goodies img')].every(img=>img.complete&&img.naturalWidth>0));
      assert.equal(await page.locator('.map-card').count(),0,'optional Maps remain uninitialized on other direct sections');
    }
    assert.deepEqual(failures,[],'direct optional sections work without an async loader');
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
