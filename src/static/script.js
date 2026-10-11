'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const archiveBase=new URL(document.baseURI);
$('base').href=archiveBase.href;
let currentNautPath=location.pathname,nautLoad=null;
let toastTimer;
function notify(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
let pageTransition=null,navigationRevision=0;
function openSection(animate=true){
 let name=(location.hash.slice(1)||'nauts').split('/')[0];
 if(!['nauts','maps','community','about','guide','glossary','goodies','guestbook','lost'].includes(name))name='lost';
 const revision=++navigationRevision;
 const update=()=>{
  if(revision!==navigationRevision)return;
  $$('.page').forEach(p=>{p.hidden=p.id!==name;p.classList.toggle('active',p.id===name)});
  $$('[data-section]').forEach(a=>{a.classList.toggle('selected',a.dataset.section===name);if(a.dataset.section===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  const page=document.getElementById(name);
  const heading=page.querySelector('h1');
  document.title=(name==='nauts' ? nautPage.name : heading ? heading.textContent.replace(/\s+/g,' ').trim() : 'Nauts Archive')+' — Awesomenauts';
  document.dispatchEvent(new Event('archive:sectionchange'));
  if(animate){
   const target=heading || page;
   target.setAttribute('tabindex','-1');
   target.focus({preventScroll:true});
   $('#main').scrollIntoView({behavior:'instant',block:'start'});
  }
 };
 if(pageTransition)pageTransition.skipTransition();
 if(animate && typeof document.startViewTransition==='function' && !matchMedia('(prefers-reduced-motion: reduce)').matches){
  try{
   const transition=document.startViewTransition(update);pageTransition=transition;
   transition.ready.catch(()=>{});
   transition.finished.catch(()=>{}).finally(()=>{if(pageTransition===transition)pageTransition=null});
  }catch{update();}
 }else update();
}
// The skip link moves focus without being treated as a page route.
$('.skip').addEventListener('click',event=>{
 event.preventDefault();$('#main').focus({preventScroll:true});
 $('#main').scrollIntoView({behavior:'instant',block:'start'});
});
window.addEventListener('hashchange',()=>openSection());openSection(false);
// Regular pointy-top honeycomb. Tilt only the shared wing containers.
const rosterNote=$('.roster-note');
let defaultRosterNote=nautPage.name.toUpperCase()+' SELECTED';
function setRosterNote(text){rosterNote.textContent=text;}
const rosterWings={};
for(const side of ['left','right']){const wing=document.createElement('div');wing.className='roster-wing '+side;rosterWings[side]=wing;$('#roster').append(wing);}
archiveData.roster.forEach((naut,index)=>{
 const b=document.createElement('button');
 b.dataset.nautSlug=naut.slug||'';
 b.className='naut-hex '+naut.wing+(naut.available?' available':'');
 b.style.left=((naut.x-39)/520*100)+'%';
 b.style.top=((naut.y-45)/245*100)+'%';
 b.title=naut.name+(naut.available?' — open dossier':' — dossier awaiting import');
 b.setAttribute('aria-label',b.title);
 if(naut.available)b.setAttribute('aria-pressed',String(naut.slug===nautPage.slug));
 const points='39,2.276080 76,23.638040 76,66.361960 39,87.723920 2,66.361960 2,23.638040';
 const inner='39,7.403 71.56,26.202 71.56,63.798 39,82.597 6.44,63.798 6.44,26.202';
 // Each 128x128 tile must be positioned in the *outer* SVG's coordinates.
 // Avoid nested SVG viewBoxes: their overflow/clip coordinates can cause
 // images to escape the hexagon or leave its interior blank in Chromium.
 const tileSize=128;
 const atlasSize=768;
 const portraitX=5,portraitY=7,portraitW=68,portraitH=73;
 const scale=Math.max(portraitW/tileSize,portraitH/tileSize); // xMidYMid slice
 // Both bottom atlas rows hold five Nauts followed by one black cell.
 // Source roster indices 29..33 belong to atlas slots 30..34, skipping 29.
 const atlasIndex=naut.spriteIndex>=29?naut.spriteIndex+1:naut.spriteIndex;
 const spriteX=(atlasIndex%6)*tileSize;
 const spriteY=Math.floor(atlasIndex/6)*tileSize;
 const imageX=portraitX-spriteX*scale-(tileSize*scale-portraitW)/2;
 const imageY=portraitY-spriteY*scale-(tileSize*scale-portraitH)/2;
 const imageSize=atlasSize*scale;
 b.innerHTML=`<svg viewBox="0 0 78 90" aria-hidden="true" focusable="false"><defs><clipPath id="portrait-clip-${index}" clipPathUnits="userSpaceOnUse"><polygon points="${inner}"/></clipPath><linearGradient id="frame-${index}" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#68fcff"/><stop offset=".45" stop-color="#08c5d1"/><stop offset="1" stop-color="#047185"/></linearGradient></defs><polygon class="hex-body" points="${points}"/><image class="roster-sprite" href="${naut.image}" x="${imageX}" y="${imageY}" width="${imageSize}" height="${imageSize}" preserveAspectRatio="none" clip-path="url(#portrait-clip-${index})"/><polygon class="hex-outer" points="${points}" stroke="url(#frame-${index})"/><polygon class="hex-inner" points="${inner}"/></svg>`;
 b.onmouseenter=()=>setRosterNote(naut.name.toUpperCase()+(naut.available?' / OPEN DOSSIER':' / DOSSIER AWAITING IMPORT'));
 b.onmouseleave=()=>setRosterNote(defaultRosterNote);
 b.onfocus=b.onmouseenter;b.onblur=b.onmouseleave;
 b.onclick=()=>{if(naut.available){if(naut.slug===nautPage.slug){selectTab('overview');}else{navigateNaut(new URL(naut.url,archiveBase));}}else notify(naut.name+' — this dossier has not been imported yet.');};
 rosterWings[naut.wing].append(b);
});
const randomButton=document.createElement('button');randomButton.className='random-hex';randomButton.title='Random available Naut';randomButton.setAttribute('aria-label','Select a random available Naut');
randomButton.innerHTML=`<svg viewBox="-2 -2 162.7502 89.4478" aria-hidden="true" focusable="false"><defs><linearGradient id="random-face" x1="0" y1="0" x2="0" y2="1"><stop class="random-face-top"/><stop class="random-face-mid" offset=".5"/><stop class="random-face-bottom" offset="1"/></linearGradient><radialGradient id="random-light"><stop class="random-glint" stop-opacity=".65"/><stop offset="1" stop-opacity="0"/></radialGradient></defs><polygon class="random-rim" points="34.2148,0.0000 124.5354,0.0000 158.7502,21.0301 154.2562,63.7874 114.4625,85.4478 44.2876,85.4478 4.4940,63.7874 0.0000,21.0301"/><polygon class="random-bevel" points="36.9244,2.5634 121.8257,2.5634 153.9877,22.3317 149.7633,62.5236 112.3573,82.8844 46.3929,82.8844 8.9868,62.5236 4.7625,22.3317"/><polygon class="random-face" fill="url(#random-face)" points="40.9888,6.4086 117.7613,6.4086 146.8439,24.2841 143.0240,60.6278 109.1994,79.0393 49.5507,79.0393 15.7261,60.6278 11.9063,24.2841"/><ellipse fill="url(#random-light)" cx="79.3751" cy="42.7239" rx="68.2626" ry="29.0523"/><polygon class="random-inset" points="42.7953,8.1175 115.9549,8.1175 143.6689,25.1519 140.0288,59.7853 107.7959,77.3303 50.9542,77.3303 18.7214,59.7853 15.0813,25.1519"/><text class="random-question" x="79.3751" y="66.7239" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="69" stroke-width="1.5" paint-order="stroke">?</text></svg>`;
randomButton.onclick=()=>{const available=archiveData.roster.filter(n=>n.available&&n.slug!==nautPage.slug);if(available.length)navigateNaut(new URL(available[Math.floor(Math.random()*available.length)].url,archiveBase));};
randomButton.onmouseenter=()=>setRosterNote('RANDOM / CHOOSE AN AVAILABLE NAUT');randomButton.onmouseleave=()=>setRosterNote(defaultRosterNote);randomButton.onfocus=randomButton.onmouseenter;randomButton.onblur=randomButton.onmouseleave;
$('#roster').append(randomButton);
function selectTab(name,focus=false){$$('[data-tab]').forEach(b=>{const active=b.dataset.tab===name;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus()});$$('.tab-panel').forEach(p=>p.hidden=p.id!==name);}
let skinAnimation=null;
function bindDossier(){
const abilities=nautPage.abilities;
abilities.forEach(a=>{const card=document.createElement('article');card.className='ability-card';card.id='ability-'+a.id;const head=document.createElement('header'),im=document.createElement('img'),h=document.createElement('h3');im.src=a.image;im.alt='';h.textContent=a.name;head.append(im,h);const p=document.createElement('p');p.textContent=a.text;const dl=document.createElement('dl');dl.className='ability-values';a.values.forEach(([k,v])=>{const wrap=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;wrap.append(dt,dd);dl.append(wrap)});const tip=document.createElement('p');tip.className='ability-tip';tip.textContent=a.tip;card.append(head,p,dl,tip);$('#ability-cards').append(card)});
$$('[data-tab]').forEach(b=>{b.onclick=()=>selectTab(b.dataset.tab);b.onkeydown=e=>{const tabs=$$('[data-tab]'),i=tabs.indexOf(b);let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;if(e.key==='ArrowLeft')n=(i-1+tabs.length)%tabs.length;if(e.key==='Home')n=0;if(e.key==='End')n=tabs.length-1;if(n!==undefined){e.preventDefault();selectTab(tabs[n].dataset.tab,true)}}});
$$('[data-open-ability]').forEach(b=>b.onclick=()=>{selectTab('abilities');$('#ability-'+b.dataset.openAbility).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'})});
nautPage.itemGroups.forEach((name,row)=>{const wrap=document.createElement('div');wrap.className='item-row';const heading=document.createElement('h3');heading.textContent=name;const grid=document.createElement('div');grid.className='items-grid';nautPage.items.filter(i=>i.row===row).forEach(item=>{const a=document.createElement('a');a.className='item-link';a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';a.title=item.name;a.setAttribute('aria-label',item.name+' — open Wiki entry in a new tab');const im=document.createElement('img');im.src=item.image;im.alt='';im.loading='lazy';const label=document.createElement('span');label.textContent=item.name;a.append(im,label);grid.append(a)});wrap.append(heading,grid);$('#item-rows').append(wrap)});
const skins=nautPage.skins;
const skinOrder=Object.keys(skins);let currentSkin=0;
function selectSkin(key,direction=1){
 const index=skinOrder.indexOf(key);if(index<0||index===currentSkin)return;
 currentSkin=index;const skin=skins[key],art=$('#character-art');
 art.hidden=!skin.image;if(skin.image)art.src=skin.image;art.alt=skin.name+' — '+nautPage.name;
 $('#skin-name').textContent=skin.name;$('#skin-description').textContent=skin.description;
 $('#skin-position').textContent=String(index+1).padStart(2,'0')+' / '+String(skinOrder.length).padStart(2,'0');
 $$('[data-skin]').forEach(button=>{const active=button.dataset.skin===key;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
 if(skinAnimation)skinAnimation.cancel();
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches && typeof art.animate==='function'){
  skinAnimation=art.animate([{opacity:0,transform:`translateX(${direction*18}px)`},{opacity:1,transform:'translateX(0)'}],{duration:240,easing:'ease-out'});
 }
}
$$('[data-skin]').forEach(button=>button.onclick=()=>selectSkin(button.dataset.skin,skinOrder.indexOf(button.dataset.skin)>=currentSkin?1:-1));
$('#skin-prev').onclick=()=>selectSkin(skinOrder[(currentSkin+skinOrder.length-1)%skinOrder.length],-1);
$('#skin-next').onclick=()=>selectSkin(skinOrder[(currentSkin+1)%skinOrder.length],1);

}
bindDossier();
async function navigateNaut(target,push=true){
 const url=new URL(target,archiveBase);
 const entry=archiveData.roster.find(n=>n.available&&new URL(n.url,archiveBase).pathname===url.pathname);
 const slug=entry?.slug||(url.pathname===archiveBase.pathname?'admiral-swiggins':null);
 if(url.origin!==archiveBase.origin||!slug)return;
 if(nautLoad)nautLoad.abort();const request=new AbortController();nautLoad=request;
 $('#main').setAttribute('aria-busy','true');
 try{
  const selected=entry||archiveData.roster.find(n=>n.available&&n.slug===slug);
 const dataUrl=selected?.dataUrl||'nauts/'+slug+'/page-data.json';
 const [pageResponse,dataResponse]=await Promise.all([
   fetch(url,{signal:request.signal,cache:'no-cache'}),fetch(new URL(dataUrl,archiveBase),{signal:request.signal,cache:'no-cache'})]);
  if(!pageResponse.ok||!dataResponse.ok)throw Error('Unavailable dossier');
  const [markup,data]=await Promise.all([pageResponse.text(),dataResponse.json()]);
  const page=new DOMParser().parseFromString(markup,'text/html'),dossier=page.querySelector('.dossier');
  if(request.signal.aborted)return;
  if(!dossier||data.slug!==slug||!Array.isArray(data.abilities)||!data.skins)throw Error('Invalid dossier');
  // Avoid mixing a new HTML structure with a cached/older JS+CSS release.
  // Each full navigation loads the matching support files, then in-page
  // navigation is permitted again within that exact release.
  const sharedResources=doc=>[
    ...[...doc.querySelectorAll('script[src]')].filter(node=>!node.getAttribute('src').includes('/page-data.')),
    ...doc.querySelectorAll('link[rel="stylesheet"][href]')
  ].map(node=>node.getAttribute(node.tagName==='SCRIPT'?'src':'href')).sort();
  if(JSON.stringify(sharedResources(document))!==JSON.stringify(sharedResources(page))){
    location.assign(url.href);return;
  }
  if(skinAnimation)skinAnimation.cancel();
  $('.dossier').replaceWith(document.importNode(dossier,true));nautPage=data;currentNautPath=url.pathname;
  defaultRosterNote=data.name.toUpperCase()+' SELECTED';setRosterNote(defaultRosterNote);
  $$('.naut-hex[aria-pressed]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.nautSlug===slug)));
  for(const link of $$('a[href]')){
   const destination=new URL(link.getAttribute('href'),archiveBase);
   if(destination.origin===archiveBase.origin&&destination.hash)link.setAttribute('href',url.pathname+destination.hash);
  }
  if(push)history.pushState(null,'',url.pathname+url.hash);
  $('meta[name="description"]').content=page.querySelector('meta[name="description"]').content;
  bindDossier();openSection(false);
  const heading=$('.page:not([hidden]) h1');heading.tabIndex=-1;heading.focus({preventScroll:true});$('#main').scrollIntoView({behavior:'instant',block:'start'});
 }catch(error){if(!request.signal.aborted)location.href=url.href;}
 finally{if(nautLoad===request){nautLoad=null;$('#main').removeAttribute('aria-busy');}}
}
window.addEventListener('popstate',()=>{if(location.pathname!==currentNautPath)navigateNaut(new URL(location.href),false);});
// Hidden Shoebox-inspired arcade. Frame-rate independent movement and bounded acceleration.
const dialog=$('#arcade'),canvas=$('#game'),ctx=canvas.getContext('2d');let best=0;try{best=Number(localStorage.getItem('nauts-archive-high-score'))||0}catch{}$('#high-score').textContent=best;
let mode='ready',ship=115,hazards=[],score=0,lives=3,elapsed=0,spawn=0,last=0,frame=0,invincible=0;const held=new Set();
function drawGame(){ctx.fillStyle='#0b2531';ctx.fillRect(0,0,720,230);ctx.strokeStyle='#17505c';ctx.lineWidth=.6;for(let y=0;y<260;y+=26){for(let x=(y/26)%2?0:22;x<750;x+=45){ctx.beginPath();for(let n=0;n<6;n++){const angle=Math.PI*n/3;const px=x+26*Math.cos(angle),py=y+26*Math.sin(angle);if(!n)ctx.moveTo(px,py);else ctx.lineTo(px,py)}ctx.closePath();ctx.stroke()}}
ctx.fillStyle=invincible>0&&Math.floor(invincible*10)%2?'#ffffff':'#18e4e7';ctx.beginPath();ctx.moveTo(58,ship-10);ctx.lineTo(72,ship-10);ctx.lineTo(72,ship-5);ctx.lineTo(92,ship);ctx.lineTo(72,ship+5);ctx.lineTo(72,ship+10);ctx.lineTo(58,ship+10);ctx.lineTo(58,ship+5);ctx.lineTo(51,ship+5);ctx.lineTo(51,ship-5);ctx.lineTo(58,ship-5);ctx.fill();ctx.fillStyle='#ffb835';ctx.fillRect(44,ship-3,8,6);
hazards.forEach(h=>{ctx.fillStyle='#ffd04c';ctx.fillRect(h.x-10,h.y-6,16,12);ctx.beginPath();ctx.moveTo(h.x-15,h.y);ctx.lineTo(h.x-8,h.y-5);ctx.lineTo(h.x-8,h.y+5);ctx.fill();ctx.fillStyle='#937334';ctx.fillRect(h.x+6,h.y-3,4,6)});
if(mode!=='running'){ctx.fillStyle='#03121bbd';ctx.fillRect(0,0,720,230);ctx.textAlign='center';ctx.fillStyle='#20e1e8';ctx.font='bold 28px monospace';ctx.fillText(mode==='over'?'SCORE: '+score:mode==='paused'?'TRANSMISSION PAUSED':'MARK I “SHOEBOX”',360,110);ctx.fillStyle='#a3c3cc';ctx.font='12px monospace';ctx.fillText(mode==='over'?'Ready for another flight?':'KEEP FLYING. DODGE THE HAZARDS.',360,137)}
}
function hud(){$('#score').textContent=score;$('#lives').textContent=lives;$('#high-score').textContent=best;}
function stopLoop(){cancelAnimationFrame(frame);frame=0;held.clear();}
function pauseGame(){if(mode!=='running')return;mode='paused';stopLoop();$('#start-game').textContent='RESUME';$('#game-status').textContent='Paused. Select Resume when you are ready.';drawGame();}
function finishGame(){mode='over';stopLoop();if(score>best){best=score;try{localStorage.setItem('nauts-archive-high-score',String(best))}catch{}}hud();$('#start-game').textContent='RESTART';$('#game-status').textContent='Flight complete. Each cleared hazard earned one point.';drawGame();}
function tick(time){if(mode!=='running')return;const dt=Math.min((time-last)/1000,.04);last=time;elapsed+=dt;invincible=Math.max(0,invincible-dt);const direction=(held.has('down')?1:0)-(held.has('up')?1:0);ship=Math.max(14,Math.min(216,ship+direction*235*dt));const speed=Math.min(365,135+elapsed*2.5);spawn-=dt;if(spawn<=0){hazards.push({x:746,y:16+Math.random()*198,passed:false});spawn=Math.max(.65,1.35-elapsed*.006)}for(const h of hazards){h.x-=speed*dt;if(!h.passed&&h.x<43){h.passed=true;score++;hud()}if(!h.passed&&invincible===0&&Math.abs(h.x-70)<26&&Math.abs(h.y-ship)<16){h.passed=true;lives--;invincible=1.1;hud();if(lives<=0){finishGame();return}}}hazards=hazards.filter(h=>h.x>-20);drawGame();frame=requestAnimationFrame(tick);}
$('#start-game').onclick=()=>{if(mode==='running'){pauseGame();return;}stopLoop();if(mode!=='paused'){ship=115;hazards=[];score=0;lives=3;elapsed=0;spawn=.4;invincible=0;hud()}mode='running';$('#start-game').textContent='PAUSE';$('#game-status').textContent='↑ ↓ / W S to fly · Esc to close';last=performance.now();frame=requestAnimationFrame(tick);};
$('#secret-cube').onclick=()=>{dialog.showModal();drawGame();$('#start-game').focus()};$('#arcade-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{pauseGame();held.clear();$('#secret-cube').focus()});document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame()});window.addEventListener('blur',()=>{held.clear();pauseGame()});
function keyDir(key){return ['ArrowUp','w','W'].includes(key)?'up':['ArrowDown','s','S'].includes(key)?'down':null;}
window.addEventListener('keydown',e=>{if(!dialog.open||mode!=='running')return;const k=keyDir(e.key);if(k){e.preventDefault();held.add(k)}});window.addEventListener('keyup',e=>{const k=keyDir(e.key);if(k)held.delete(k)});
[['#fly-up','up'],['#fly-down','down']].forEach(([selector,dir])=>{const b=$(selector);b.onpointerdown=e=>{if(mode==='running'){e.preventDefault();b.setPointerCapture(e.pointerId);held.add(dir)}};['pointerup','pointercancel','lostpointercapture'].forEach(event=>b.addEventListener(event,()=>held.delete(dir)))});drawGame();
