import assert from 'node:assert/strict';
export function summarize(values) {
  assert.ok(values.length && values.every(Number.isFinite), 'finite samples required');
  const sorted=[...values].sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);
  return {median:sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2,
    min:sorted[0],max:sorted.at(-1),samples:values};
}
export function validateSample(sample) {
  assert.ok(sample.fcp>0,'FCP must be collected');
  assert.ok(sample.lcp?.time>0 && sample.lcp.element,'LCP and element attribution required');
  assert.ok(sample.navigation.domContentLoaded>0 && sample.navigation.load>0,'navigation timings required');
  assert.ok(Number.isFinite(sample.cls) && sample.cls>=0,'valid CLS required');
  assert.ok(sample.requests>0 && sample.transferBytes>0,'network evidence required');
  assert.deepEqual(sample.errors,[],'page/network failures must be resolved');
}
