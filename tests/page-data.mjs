import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';

const root=resolve(import.meta.dirname,'../dist');
for(const slug of ['admiral-swiggins','ayla','chucho-krokk']) {
  const context=vm.createContext({});
  vm.runInContext(readFileSync(resolve(root,'roster-data.js'),'utf8'),context);
  if(slug==='admiral-swiggins')vm.runInContext(readFileSync(resolve(root,'swiggins-editorial.js'),'utf8'),context);
  vm.runInContext(readFileSync(resolve(root,'nauts',slug,'page-data.js'),'utf8'),context);
  const data=vm.runInContext('nautPage',context);
  const roster=vm.runInContext('archiveData.roster',context);
  assert.equal(data.slug,slug);
  assert.equal(data.abilities.length,4);
  assert.equal(data.items.length,24);
  assert.equal(roster.filter(n=>n.available).length,3);
  for(const naut of roster)assert.ok(existsSync(resolve(root,naut.image)),`Missing roster icon: ${naut.name}`);
  for(const naut of roster.filter(n=>n.available))assert.ok(existsSync(resolve(root,naut.url,'index.html')));
  for(const item of [...data.abilities,...data.items,...Object.values(data.skins)]) {
    assert.ok(item.image,`${slug}: missing image`);
    assert.ok(existsSync(resolve(root,item.image)),`${slug}: invalid asset ${item.image}`);
  }
  if(slug==='ayla')assert.equal(Object.keys(data.skins).length,4);
  if(slug==='chucho-krokk')assert.ok(data.items.some(i=>i.name==='Krokk License To Kill'));
}
console.log('Passed: per-Naut runtime data, available roster URLs and ability/item/skin images.');
