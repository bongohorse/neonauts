import assert from 'node:assert/strict';
import {test} from 'node:test';
import {summarize,validateSample} from './performance-metrics.mjs';
test('median preserves raw order, outliers and even sample sets',()=>{
  assert.deepEqual(summarize([100,1,3,2,4]),{median:3,min:1,max:100,samples:[100,1,3,2,4]});
  assert.equal(summarize([1,4,2,3]).median,2.5);
  assert.throws(()=>summarize([NaN]));
});
test('missing observations and failures cannot silently produce a passing baseline',()=>{
  const s={fcp:1,lcp:{time:2,element:'img#character-art'},navigation:{domContentLoaded:3,load:4},cls:0,requests:1,transferBytes:500,errors:[]};
  validateSample(s);
  for(const patch of [{fcp:null},{lcp:null},{errors:['HTTP 404']},{transferBytes:0}])
    assert.throws(()=>validateSample({...s,...patch}));
});
