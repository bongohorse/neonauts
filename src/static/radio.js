// Bandcamp controls stay native; no unsupported iframe commands or stream URLs.
const audio=$('#audio');audio.volume=.4;let tracks=[],trackIndex=0;
const radio=$('#radio-panel'),bandcamp=$('#bandcamp-player');
let radioMode='closed',radioSource=bandcamp.dataset.src,themeIndex=-1;
function updateMini(){
 const local=$('#local-radio').open;
 radio.classList.toggle('local-source',local);
 $('#radio-mini-play').hidden=!local;$('#radio-mini-play').disabled=!tracks.length;
 for(const [id,label] of [['prev','Previous'],['next','Next']]){
  const button=$('#radio-mini-'+id);button.disabled=local&&!tracks.length;
  button.setAttribute('aria-label',label+(local?' local track':' Naut theme'));button.title=button.getAttribute('aria-label');
 }
 const play=$('#radio-mini-play');play.textContent=audio.paused?'▶':'Ⅱ';
 play.setAttribute('aria-label',audio.paused?'Play local music':'Pause local music');play.title=play.getAttribute('aria-label');
}
function setRadio(open){
 if(open){
  if(radio.open&&radioMode==='full')return;
  if(radio.open)radio.close();radioMode='full';radio.classList.remove('minimized');$('#radio-mini').hidden=true;
  if(!bandcamp.hasAttribute('src')&&!$('#local-radio').open)bandcamp.src=radioSource;
  radio.showModal();$('#radio-toggle').setAttribute('aria-expanded','true');$('#radio-close').focus();
 }else{radioMode='closed';stopRadio();if(radio.open)radio.close();}
}
function stopRadio(){audio.pause();bandcamp.removeAttribute('src');radio.classList.remove('minimized');$('#radio-mini').hidden=true;$('#radio-toggle').setAttribute('aria-expanded','false');$('#radio-toggle').focus();}
function minimizeRadio(){
 radioMode='minimized';radio.close();radio.classList.add('minimized');$('#radio-mini').hidden=false;
 // A nonmodal dialog keeps the same visible iframe and releases the page.
 radio.show();updateMini();$('#radio-toggle').setAttribute('aria-expanded','false');$('#radio-restore').focus();
}
function selectTheme(theme,open=true){
 themeIndex=radioThemes.findIndex(t=>t.id===theme.id);
 radioSource=`https://bandcamp.com/EmbeddedPlayer/track=${theme.id}/size=large/bgcol=071c28/linkcol=18d8df/tracklist=false/artwork=small/transparent=true/`;
 bandcamp.classList.add('single-theme');bandcamp.title=`${theme.title} — Bandcamp music player`;
 $('#radio-bandcamp-link').href=theme.url;$('#radio-bandcamp-link').textContent='Open Naut theme on Bandcamp ↗';
 $('#radio-now-playing').textContent=theme.title;$('#radio-mini-title').textContent=theme.title;
 $('#local-radio').open=false;audio.pause();bandcamp.src=radioSource;updateMini();if(open)setRadio(true);
}
function stepRadio(direction){
 if($('#local-radio').open){loadTrack(trackIndex+direction,!audio.paused);return;}
 const index=themeIndex<0?(direction>0?0:radioThemes.length-1):(themeIndex+direction+radioThemes.length)%radioThemes.length;
 selectTheme(radioThemes[index],false);
}
$('#radio-toggle').onclick=()=>setRadio(radioMode!=='full');
$('#radio-close').onclick=()=>setRadio(false);$('#radio-minimize').onclick=minimizeRadio;
$('#radio-album').onclick=()=>{themeIndex=-1;radioSource=bandcamp.dataset.src;bandcamp.classList.remove('single-theme');bandcamp.title='Awesomenauts Ultimate Edition — Bandcamp music player';$('#radio-bandcamp-link').href='https://sonicpicnic.bandcamp.com/album/awesomenauts-ultimate-edition';$('#radio-bandcamp-link').textContent='Open soundtrack on Bandcamp ↗';$('#radio-now-playing').textContent='ULTIMATE EDITION';$('#radio-mini-title').textContent='AWESOMENAUTS / ULTIMATE EDITION';$('#local-radio').open=false;audio.pause();bandcamp.src=radioSource;updateMini();};
$('#radio-restore').onclick=()=>setRadio(true);$('#radio-stop').onclick=()=>setRadio(false);
$('#radio-mini-prev').onclick=()=>stepRadio(-1);$('#radio-mini-next').onclick=()=>stepRadio(1);
$('#radio-mini-play').onclick=()=>$('#play-track').click();
radio.addEventListener('cancel',()=>{radioMode='closed';stopRadio();});
// close events also arrive after switching modal/nonmodal; ignore those.
radio.addEventListener('close',()=>{if(!radio.open&&radioMode==='closed')stopRadio();});
$('#local-radio').addEventListener('toggle',()=>{
 if($('#local-radio').open){bandcamp.removeAttribute('src');$('#radio-mini-title').textContent=tracks[trackIndex]?.name||'LOCAL AUDIO';}
 else{audio.pause();$('#radio-mini-title').textContent=$('#radio-now-playing').textContent;if(radioMode!=='closed'&&bandcamp.getAttribute('src')!==radioSource)bandcamp.src=radioSource;}
 updateMini();
});
document.addEventListener('click',event=>{if(event.target.closest('[data-naut-theme]')&&nautPage.theme)selectTheme(nautPage.theme);});
function loadTrack(i,play=false){if(!tracks.length)return;trackIndex=(i+tracks.length)%tracks.length;audio.src=tracks[trackIndex].url;$('#track-title').textContent=tracks[trackIndex].name;$('#radio-mini-title').textContent=tracks[trackIndex].name;$('#playlist').value=String(trackIndex);$('#radio-status').textContent='Local audio · stays on this device.';$('#play-track').textContent='▶';$('#play-track').setAttribute('aria-label','Play music');updateMini();if(play)audio.play().catch(()=>notify('Playback could not start. Try another audio file.'));}
$('#audio-files').onchange=e=>{audio.pause();audio.removeAttribute('src');audio.load();tracks.forEach(t=>URL.revokeObjectURL(t.url));tracks=[...e.target.files].map(f=>({name:f.name.replace(/\.[^.]+$/,''),url:URL.createObjectURL(f)}));$('#playlist').replaceChildren();tracks.forEach((t,i)=>{const op=document.createElement('option');op.value=i;op.textContent=t.name;$('#playlist').append(op)});$('#playlist').hidden=!tracks.length;$$('.radio-controls button').forEach(b=>b.disabled=!tracks.length);if(tracks.length)loadTrack(0);updateMini();};
$('#play-track').onclick=()=>{if(audio.paused)audio.play().catch(()=>notify('Audio could not be played.'));else audio.pause()};$('#prev-track').onclick=()=>loadTrack(trackIndex-1,!audio.paused);$('#next-track').onclick=()=>loadTrack(trackIndex+1,!audio.paused);$('#repeat-track').onclick=()=>{audio.loop=!audio.loop;$('#repeat-track').setAttribute('aria-pressed',String(audio.loop))};$('#playlist').onchange=e=>loadTrack(Number(e.target.value),!audio.paused);$('#volume').oninput=e=>audio.volume=Number(e.target.value);audio.onplay=()=>{$('#play-track').textContent='Ⅱ';$('#play-track').setAttribute('aria-label','Pause music');updateMini()};audio.onpause=()=>{$('#play-track').textContent='▶';$('#play-track').setAttribute('aria-label','Play music');updateMini()};audio.onended=()=>loadTrack(trackIndex+1,true);audio.onerror=()=>{if(tracks.length){$('#radio-status').textContent='Audio unavailable or format unsupported. Try another file.';notify('This audio file could not be played.')}};

updateMini();
