import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const nodes=new Map(),pending=[];
function node(id){if(nodes.has(id))return nodes.get(id);const attrs={},classes=new Set(),events={};const n={textContent:'',open:false,hidden:false,paused:true,dataset:{src:'https://bandcamp.com/EmbeddedPlayer/album=3940808224/'},events,
 classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)},
 setAttribute:(k,v)=>attrs[k]=v,getAttribute:k=>attrs[k]??null,hasAttribute:k=>k in attrs,removeAttribute:k=>delete attrs[k],addEventListener:(k,f)=>events[k]=f,
 focus(){},close(){n.open=false;pending.push(()=>events.close?.())},show(){n.open=true},showModal(){n.open=true},click(){n.onclick?.()},
 pause(){n.paused=true;n.onpause?.()},play(){n.paused=false;n.onplay?.();return Promise.resolve()}};
 Object.defineProperty(n,'src',{get:()=>attrs.src,set:v=>attrs.src=v});nodes.set(id,n);return n;}
const ost=JSON.parse(readFileSync(new URL('../data/ost.json',import.meta.url))).tracks;
const themes=Object.values(ost),context=vm.createContext({$:node,$$:()=>[],radioThemes:themes,nautPage:{theme:themes[0]},notify(){},document:{addEventListener(){}}});
vm.runInContext(readFileSync(new URL('../src/static/radio.js',import.meta.url),'utf8'),context);
const run=s=>vm.runInContext(s,context),flush=()=>{while(pending.length)pending.shift()()};
run('selectTheme(radioThemes[0])');const source=node('#bandcamp-player').src;
node('#radio-minimize').click();flush();assert.equal(node('#radio-panel').open,true);assert.equal(node('#bandcamp-player').src,source);assert.equal(node('#radio-mini').hidden,false);
node('#radio-restore').click();flush();assert.equal(node('#bandcamp-player').src,source);assert.equal(node('#radio-mini').hidden,true);
node('#radio-minimize').click();flush();node('#radio-mini-next').click();assert.ok(node('#bandcamp-player').src.includes('track='+themes[1].id));assert.equal(node('#radio-mini-title').textContent,themes[1].title);assert.equal(node('#radio-mini').hidden,false);
node('#radio-mini-prev').click();assert.equal(node('#bandcamp-player').src,source);
node('#radio-mini-prev').click();assert.ok(node('#bandcamp-player').src.includes('track='+themes.at(-1).id));
node('#radio-stop').click();flush();assert.equal(node('#bandcamp-player').getAttribute('src'),null);assert.equal(node('#radio-panel').open,false);
node('#local-radio').open=true;run("tracks=[{name:'First',url:'blob:first'},{name:'Second',url:'blob:second'}];loadTrack(0);setRadio(true);minimizeRadio()");flush();assert.equal(node('#radio-mini-play').hidden,false);
node('#radio-mini-play').click();assert.equal(node('#audio').paused,false);assert.equal(node('#radio-mini-play').getAttribute('aria-label'),'Pause local music');
node('#radio-mini-next').click();assert.equal(node('#audio').src,'blob:second');assert.equal(node('#radio-mini-title').textContent,'Second');assert.equal(node('#audio').paused,false);
node('#radio-mini-play').click();assert.equal(node('#audio').paused,true);node('#radio-mini-prev').click();assert.equal(node('#audio').src,'blob:first');assert.equal(node('#audio').paused,true);
node('#radio-restore').click();flush();assert.equal(node('#audio').src,'blob:first');node('#radio-panel').events.cancel();node('#radio-panel').close();flush();assert.equal(node('#audio').paused,true);assert.equal(node('#radio-mini').hidden,true);
console.log('Passed: radio preserves iframe on minimize/restore, theme stepping/wrap, Stop/Escape and local mini controls.');
