// The scripted correction (ported): it runs a tier's stages to the end, and the safe word stops it at once with the answering line.
const test = require('node:test'), assert = require('node:assert/strict');
const D = require('../js/discipline.js'), { createPain } = require('../js/pain.js');

// A stand-in session: each run lands its smacks at once.
function fake(opts = {}) {
  const pain = createPain(), st = { hits: 0, peak: 0, word: false, ended: false, amber: false };
  return { pain, st, busy: () => false, set() {}, end() { st.ended = true; },
    run(n) { for (let i = 0; i < n; i++) { if (opts.wordAt && st.hits === opts.wordAt) { st.word = true; return; } pain.hit({ implement: 'hand' }); st.hits++; st.peak = Math.max(st.peak, pain.distress()); } } };
}
const lines = { start: 'start', done: 'done', after: 'after', stop: 'stop {word}', during: ['d'] };
const sleep = () => Promise.resolve();

test('each tier lands its full count', async () => {
  for (const tier of D.TIERS) {
    const r = await D.run(fake(), tier, { lines, sleep });
    assert.ok(r.done || r.tooHarsh, tier);
    if (r.done) assert.equal(r.hits, D.total(tier));
  }
});

test('the safe word ends it and is answered', async () => {
  const said = [];
  const r = await D.run(fake({ wordAt: 3 }), 'firm', { lines, sleep, subject: { name: 'X', word: 'W' }, say: t => said.push(t) });
  assert.equal(r.stopped, true); assert.equal(r.hits, 3); assert.equal(said[said.length - 1], 'stop W');
});
