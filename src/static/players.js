(() => {
 const url=siteConfig.playerCountUrl||new URL('players.json',document.baseURI).href;
 const counts=[...document.querySelectorAll('[data-player-count]')];
 const statuses=[...document.querySelectorAll('[data-player-status]')];
 let busy=false,lastSuccess=0,lastData=null;
 const format=n=>n===null?'—':n.toLocaleString('en');
 const time=t=>new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
 function drawHistory(data){
  const points=steamStats.history(data),stats=steamStats.summary(points);
  for(const key of ['peak','min','average','change']){
   for(const node of document.querySelectorAll(`[data-steam-${key}]`))node.textContent=key==='change'&&stats[key]>0?'+'+format(stats[key]):format(stats[key]);
  }
  const chart=document.querySelector('#steam-chart');if(!chart)return;
  const note=document.querySelector('#steam-history-note');
  note.textContent=points.length?`${points.length} recorded samples · ${time(points[0].time)}–${time(points.at(-1).time)} · statistics cover available samples in the last 24h`:'No recorded history yet. Samples collect with each update.';
  chart.replaceChildren();const geometry=steamStats.plot(points);
  function svg(tag,attrs,text){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;chart.append(node);return node;}
  svg('title',{},'Steam players — recorded counts over the last 24 hours');
  for(const ratio of [0,.5,1]){const y=154-ratio*130;svg('line',{x1:48,x2:580,y1:y,y2:y,class:'chart-grid'});svg('text',{x:40,y:y+4,'text-anchor':'end',class:'chart-label'},Math.round(geometry.max*ratio));}
  svg('text',{x:48,y:178,class:'chart-label'},time(Date.now()-86400000));
  svg('text',{x:580,y:178,'text-anchor':'end',class:'chart-label'},time(Date.now()));
  if(points.length){
   svg('path',{d:geometry.path,class:'chart-line'});
   const p=points.at(-1);svg('circle',{cx:geometry.x(p.time),cy:geometry.y(p.players),r:4,class:'chart-dot'});
  }else svg('text',{x:314,y:92,'text-anchor':'middle',class:'chart-label'},'Collecting history…');
  const body=document.querySelector('#steam-samples');body.replaceChildren();
  for(const p of [...points].reverse()){
   const row=document.createElement('tr');for(const value of [new Date(p.time).toLocaleString(),format(p.players)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);
  }
 }
 async function update(){
  if(busy||document.hidden||!counts.length)return;busy=true;
  try{
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Unavailable');
   const data=await response.json();lastData=data;drawHistory(data);
   const checkedAt=Date.parse(data.checkedAt);
   if(!Number.isSafeInteger(data.players)||data.players<0||!Number.isFinite(checkedAt)||Date.now()-checkedAt>3600000||checkedAt>Date.now()+60000)throw Error('Invalid snapshot');
   counts.forEach(node=>node.textContent=format(data.players));
   statuses.forEach(node=>node.textContent='Checked '+time(checkedAt)+' · Steam'+(siteConfig.playerCountUrl?'':' · updates about every 15 min'));
   lastSuccess=Date.now();
  }catch{
   counts.forEach(node=>node.textContent='—');statuses.forEach(node=>node.textContent='Player count unavailable');
   if(lastData)drawHistory(lastData);
  }finally{busy=false;}
 }
 update();setInterval(update,300000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastSuccess>=300000)update();});
})();
