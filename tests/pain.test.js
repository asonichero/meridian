// The pain model (ported from Little Red’s Lessons): smacks build distress, it fades with time, clothing blunts only the sting, and too much stops the scene.
// (Meridian has only the hand until its implements and garments are decided, so the heavier-implement and garment cases use strength and a raw cushion.)
const test = require('node:test'), assert = require('node:assert/strict');
const { PAIN, createPain } = require('../js/pain.js');

test('a smack adds distress, and a harder one adds more', () => {
  const a = createPain(), b = createPain();
  a.hit({ implement: 'hand', strength: 0.5 }); b.hit({ implement: 'hand', strength: 1 });
  assert.ok(a.distress() > 0 && b.distress() > a.distress());
});

test('distress fades with time unless it is held', () => {
  const p = createPain(); for (let i = 0; i < 10; i++) p.hit({ implement: 'hand' });
  const d0 = p.distress(); p.update(30); assert.ok(p.distress() < d0);
});

test('a cushion cuts the sting but not the ache', () => {
  const bare = createPain(), clad = createPain();
  const h0 = bare.hit({ implement: 'hand' }), h1 = clad.hit({ implement: 'hand', cushion: 0.4 });
  assert.ok(h1.pain < h0.pain); assert.equal(clad.ache, bare.ache); assert.ok(clad.sting < bare.sting);
});

test('the bands rise with distress and too much, held, sets tooHarsh', () => {
  const p = createPain(); assert.equal(p.band(), 'composed');
  let guard = 0; while (!p.tooHarsh && guard++ < 2000) { p.hit({ implement: 'hand', strength: 1.4 }); p.update(0.15); }
  assert.ok(p.tooHarsh); assert.ok(p.distress() >= PAIN.TOO_HARSH); assert.equal(p.receptivity(), 0);
});

test('the bar is high: crossing it for a moment is not enough', () => {
  const p = createPain(); p.ache = PAIN.TOO_HARSH * 1.05 * p.capacity(); p.update(0.01);
  assert.equal(p.tooHarsh, false); assert.equal(p.band(), 'too harsh');
  for (let i = 0; i < 20; i++) p.update(0.1);
  assert.equal(p.tooHarsh, true);
});

test('soothing takes the sting down faster than waiting', () => {
  const a = createPain(), b = createPain(); for (const p of [a, b]) for (let i = 0; i < 8; i++) p.hit({ implement: 'hand' });
  for (let i = 0; i < 20; i++) { a.update(0.05); b.update(0.05); b.soothe(0.05); }
  assert.ok(b.sting < a.sting);
});

test('reset clears everything', () => {
  const p = createPain(); p.hit({ implement: 'hand' }); p.reset();
  assert.equal(p.distress(), 0); assert.equal(p.hits, 0); assert.equal(p.tooHarsh, false);
});
