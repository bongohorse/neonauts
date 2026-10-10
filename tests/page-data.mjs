import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';

const root=resolve(import.meta.dirname,'../dist');
const sources=resolve(import.meta.dirname,'../data/nauts');
const slugs=readdirSync(sources).filter(p=>p.endsWith('.json')).map(p=>p.slice(0,-5));
for(const slug of slugs) {
  const context=vm.createContext({});
  vm.runInContext(readFileSync(resolve(root,'roster-data.js'),'utf8'),context);
  vm.runInContext(readFileSync(resolve(root,'nauts',slug,'page-data.js'),'utf8'),context);
  const data=vm.runInContext('nautPage',context);
  const roster=vm.runInContext('archiveData.roster',context);
  assert.equal(data.slug,slug);
  assert.deepEqual(JSON.parse(JSON.stringify(data)),JSON.parse(readFileSync(resolve(root,'nauts',slug,'page-data.json'),'utf8')));
  assert.equal(typeof data.theme.id,'number');
  assert.ok(data.theme.url.startsWith('https://sonicpicnic.bandcamp.com/'));
  assert.equal(data.abilities.length,4);
  assert.equal(data.items.length,24);
  assert.equal(roster.filter(n=>n.available).length,slugs.length);
  assert.ok(roster.some(n=>n.slug===slug&&n.available));
  for(const naut of roster)assert.ok(existsSync(resolve(root,naut.image)),`Missing roster icon: ${naut.name}`);
  for(const naut of roster.filter(n=>n.available))assert.ok(existsSync(resolve(root,naut.url,'index.html')));
  for(const item of [...data.abilities,...data.items,...Object.values(data.skins)]) {
    if(!item.image){
      const source=JSON.parse(readFileSync(resolve(sources,slug+'.json'),'utf8'));
      assert.ok(source.diagnostics.warnings.some(w=>w.code.startsWith('missing_')),`${slug}: undocumented missing image`);
      continue;
    }
    assert.ok(existsSync(resolve(root,item.image)),`${slug}: invalid asset ${item.image}`);
  }
  if(slug==='ayla')assert.equal(Object.keys(data.skins).length,4);
  if(slug==='chucho-krokk')assert.ok(data.items.some(i=>i.name==='Krokk License To Kill'));
}
console.log('Passed: per-Naut runtime data, available roster URLs and ability/item/skin images.');
