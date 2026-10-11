(() => {
 let initialized=false;
 function initializeMaps(){
  if(initialized)return;
  initialized=true;

 const list=document.querySelector('#map-picker'),detail=document.querySelector('#map-detail');
 const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 let selectedMap=null,activeTab='overview',zoom=1,returnFocus=null;
 const viewer=document.querySelector('#map-viewer'),viewerImage=document.querySelector('#map-viewer-image');
 mapArchive.maps.forEach(map=>{
  const button=document.createElement('button');button.className='map-card';button.dataset.map=map.id;button.type='button';
  button.setAttribute('aria-pressed','false');
  button.innerHTML=`<img src="${esc(map.thumbnail)}" alt="" width="300" height="169" loading="lazy"><span class="map-card-name">${esc(map.name)}</span><span class="map-card-feature">${esc(map.tags[0])}</span>${map.legacy?'<span class="legacy-label">CUSTOM / PRACTICE</span>':''}`;
  button.addEventListener('click',()=>{
   const hash='#maps/'+map.id;
   if(location.hash===hash)render(map.id);else location.hash=hash;
  });list.append(button);
 });
 function filterMaps(){
  const query=document.querySelector('#map-search').value.trim().toLowerCase();
  const type=document.querySelector('#map-filter').value;
  let count=0;
  mapArchive.maps.forEach(map=>{
   const matches=(!query||[map.name,map.summary,...map.tags,...map.features.map(f=>f.name)].join(' ').toLowerCase().includes(query))&&
    (type==='all'||(type==='legacy')===map.legacy);
   list.querySelector(`[data-map="${map.id}"]`).hidden=!matches;
   if(matches)count++;
  });
  document.querySelector('#map-results').textContent=count?`${count} / ${mapArchive.maps.length} battlefields · select a card below`:'No battlefields found. Try another name or feature.';
 }
 document.querySelector('#map-search').addEventListener('input',filterMaps);
 document.querySelector('#map-filter').addEventListener('change',filterMaps);
 filterMaps();
 list.addEventListener('keydown',event=>{
  const buttons=[...list.querySelectorAll('[data-map]')].filter(b=>!b.hidden);
  const index=buttons.indexOf(event.target);if(index<0)return;
  let next=null;
  if(event.key==='ArrowRight')next=(index+1)%buttons.length;
  if(event.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;
  if(event.key==='Home')next=0;if(event.key==='End')next=buttons.length-1;
  if(next!==null){event.preventDefault();buttons[next].focus();}
 });
 function selectTab(name,focus=false){
  activeTab=name;
  detail.querySelectorAll('[data-map-tab]').forEach(button=>{
   const current=button.dataset.mapTab===name;button.setAttribute('aria-selected',String(current));button.tabIndex=current?0:-1;
   if(current&&focus)button.focus();
  });
  detail.querySelectorAll('.map-tab-panel').forEach(panel=>panel.hidden=panel.dataset.mapPanel!==name);
 }
 function openViewer(image,title,trigger){
  returnFocus=trigger;zoom=1;viewerImage.src=image;viewerImage.alt=title;viewerImage.style.width='100%';
  document.querySelector('#map-viewer-title').textContent=title;
  updateZoom();viewer.showModal();document.querySelector('#map-viewer-close').focus();
 }
 function render(id){
  const map=mapArchive.maps.find(item=>item.id===id)||mapArchive.maps[0];selectedMap=map;
  list.querySelectorAll('[data-map]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.map===map.id)));
  detail.innerHTML=`<div class="map-dossier-heading"><div><span class="eyebrow">BATTLEFIELD DOSSIER ${String(mapArchive.maps.indexOf(map)+1).padStart(2,'0')} / 06</span><h2 id="map-name">${esc(map.name)}</h2></div>${map.legacy?'<span class="map-status legacy">CUSTOM / PRACTICE</span>':'<span class="map-status">STANDARD MAP</span>'}</div>
  <div class="map-hero"><img src="${esc(map.thumbnail)}" alt="${esc(map.name)} splash artwork" width="300" height="169" loading="lazy"><div><p>${esc(map.summary)}</p><div class="map-tags">${map.tags.map(tag=>`<span>${esc(tag)}</span>`).join('')}</div></div></div>
  <div class="map-tabs" role="tablist" aria-label="Map dossier"><button id="map-tab-overview" type="button" role="tab" data-map-tab="overview" aria-controls="map-panel-overview">OVERVIEW</button><button id="map-tab-layout" type="button" role="tab" data-map-tab="layout" aria-controls="map-panel-layout">LAYOUT</button><button id="map-tab-tips" type="button" role="tab" data-map-tab="tips" aria-controls="map-panel-tips">TIPS</button></div>
  <div id="map-panel-overview" class="map-tab-panel" data-map-panel="overview" role="tabpanel" aria-labelledby="map-tab-overview"><div class="map-feature-grid">${map.features.map(feature=>`<article><h3>${esc(feature.name)}</h3><p>${esc(feature.text)}</p></article>`).join('')}</div><details class="map-background"><summary>PLANET &amp; BACKGROUND</summary><p>${esc(map.background)}</p></details></div>
  <div id="map-panel-layout" class="map-tab-panel" data-map-panel="layout" role="tabpanel" aria-labelledby="map-tab-layout" hidden><div class="map-layout-toolbar"><h3>FULL BATTLEFIELD</h3><button class="mini-action" type="button" id="open-map-layout">ENLARGE ↗</button></div><button class="map-layout-image" type="button" aria-label="Enlarge ${esc(map.name)} layout"><img src="${esc(map.layout)}" alt="Complete battlefield layout of ${esc(map.name)}" loading="lazy"></button><div class="map-minimap"><div><h3>DROP POD PATH &amp; MINIMAP</h3><p>The source graphic shows the map overview and drop-pod route.</p></div><button type="button" aria-label="Enlarge ${esc(map.name)} minimap"><img src="${esc(map.minimap)}" alt="${esc(map.name)} minimap and drop-pod path" loading="lazy"></button></div><p class="source-note">Original embedded image from the supplied Wiki snapshot. Enlarging helps inspect it but does not add detail beyond the saved resolution.</p></div>
  <div id="map-panel-tips" class="map-tab-panel" data-map-panel="tips" role="tabpanel" aria-labelledby="map-tab-tips" hidden><ol class="map-tips">${map.tips.map(tip=>`<li>${esc(tip)}</li>`).join('')}</ol><a class="text-link" href="${location.pathname}#guide">Need the basics? Open the rookie briefing →</a></div>
  <p class="source-note">Source: <a href="${esc(map.source)}" target="_blank" rel="noopener noreferrer">${esc(map.name)} Wiki</a> · supplied snapshot, 10 October 2026. Descriptions and tips adapted under CC BY-SA 3.0. Map availability and mechanics reflect that snapshot; exact game-version values are not independently verified.</p>`;
  selectTab(activeTab);
  const navigation=document.createElement('nav');navigation.className='map-dossier-nav';navigation.setAttribute('aria-label','Adjacent battlefields');
  const position=mapArchive.maps.indexOf(map);
  for(const [label,delta] of [['← PREVIOUS',-1],['NEXT →',1]]){
   const adjacent=mapArchive.maps[(position+delta+mapArchive.maps.length)%mapArchive.maps.length];
   const link=document.createElement('a');link.className='mini-action';link.href=location.pathname+'#maps/'+adjacent.id;link.textContent=label;
   link.setAttribute('aria-label',label+' battlefield: '+adjacent.name);navigation.append(link);
  }
  detail.append(navigation);
  const tabs=[...detail.querySelectorAll('[data-map-tab]')];
  tabs.forEach((button,index)=>{
   button.addEventListener('click',()=>selectTab(button.dataset.mapTab));
   button.addEventListener('keydown',event=>{
    let next=null;if(event.key==='ArrowRight')next=(index+1)%3;if(event.key==='ArrowLeft')next=(index+2)%3;if(event.key==='Home')next=0;if(event.key==='End')next=2;
    if(next!==null){event.preventDefault();selectTab(tabs[next].dataset.mapTab,true);}
   });
  });
  for(const button of detail.querySelectorAll('#open-map-layout,.map-layout-image'))button.onclick=()=>openViewer(map.layout,map.name+' — full battlefield',button);
  const mini=detail.querySelector('.map-minimap button');mini.onclick=()=>openViewer(map.minimap,map.name+' — minimap',mini);
  if(location.hash.startsWith('#maps'))document.title=map.name+' — Awesomenauts Maps';
 }
 function route(){
  if(location.hash.startsWith('#maps'))render(location.hash.split('/')[1]||mapArchive.maps[0].id);
 }
 document.querySelector('#map-viewer-close').onclick=()=>viewer.close();
 viewer.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
 function updateZoom(){
  viewerImage.style.width=(zoom*100)+'%';document.querySelector('#map-zoom-level').textContent=(zoom*100)+'%';
  document.querySelector('#map-zoom-out').disabled=zoom===1;
  document.querySelector('#map-zoom-in').disabled=zoom===3;
 }
 for(const [id,delta] of [['map-zoom-in',.5],['map-zoom-out',-.5]])document.getElementById(id).onclick=()=>{
  zoom=Math.max(1,Math.min(3,zoom+delta));updateZoom();
 };
 document.querySelector('#map-zoom-reset').onclick=()=>{zoom=1;updateZoom();document.querySelector('.map-viewer-scroll').scrollTo(0,0);};
 const holidays=document.querySelector('#holiday-themes');
 mapArchive.themes.forEach(theme=>{
  const card=document.createElement('article');card.className='holiday-card';
  const title=document.createElement('h3');title.textContent=theme.name;
  const text=document.createElement('p');text.textContent=theme.description;
  const images=document.createElement('div');images.className='holiday-images';
  theme.images.forEach((src,index)=>{
   const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Enlarge ${theme.name} screenshot ${index+1}`);
   const image=document.createElement('img');image.src=src;image.alt=theme.name+' decorations, archived screenshot '+(index+1);image.loading='lazy';button.append(image);
   button.onclick=()=>openViewer(src,theme.name+' — archived decorations',button);images.append(button);
  });card.append(title,text,images);holidays.append(card);
 });
 render(mapArchive.maps[0].id);document.addEventListener('archive:sectionchange',route);route();
 }
 function bootstrap(){
  if(!document.querySelector('#maps').hidden)initializeMaps();
 }
 document.addEventListener('archive:sectionchange',bootstrap);
 bootstrap();
})();
