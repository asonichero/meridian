// The pain model (ported from Little Red’s Lessons): smacks build distress, it fades with time, clothing blunts only the sting, and too much stops the scene.
// (Meridian has only the hand until its implements and garments are decided, so the heavier-implement and garment cases use strength and a raw cushion.)
const test = require('node:test'), assert = require('node:assert/strict');
const { PAIN, createPain, perceive, rawAt } = require('../js/pain.js');

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
  const p = createPain(); p.ache = rawAt(PAIN.TOO_HARSH * 1.01) * p.capacity(); p.update(0.01);
  assert.equal(p.tooHarsh, false); assert.equal(p.band(), 'too harsh');
  for (let i = 0; i < 20; i++) p.update(0.1);
  assert.equal(p.tooHarsh, true);
});

test('past the edge, distress follows the pain’s logarithm: too harsh takes over three times the edge’s pain', () => {
  assert.equal(perceive(0.5), 0.5); assert.equal(perceive(PAIN.EDGE), PAIN.EDGE);
  assert.ok(Math.abs(perceive(PAIN.HARSH_RAW) - PAIN.TOO_HARSH) < 1e-9 && PAIN.HARSH_RAW >= 3);
  for (const d of [0.3, 1, 1.2, 1.5, 1.8, 2.0]) assert.ok(Math.abs(perceive(rawAt(d)) - d) < 1e-9);
  // (the stretch past the edge takes far more pain than the way to it, and distress keeps rising with it)
  assert.ok(rawAt(PAIN.TOO_HARSH) - rawAt(PAIN.EDGE) > 2 * PAIN.EDGE); assert.ok(perceive(1.5) < perceive(2) && perceive(2) < perceive(3));
  const p = createPain(); p.ache = 2 * p.capacity(); assert.ok(p.distress() > 1.3 && p.distress() < 1.45, 'twice the edge’s pain: well past it, far short of crying steadily');
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

test('the stretch past the edge: steady crying at 1.7, still at 1.8, too harsh at 2, the safe word by 2.05', () => {
  assert.ok(PAIN.EDGE < PAIN.CRYING && PAIN.CRYING < PAIN.STILL && PAIN.STILL < PAIN.TOO_HARSH);
  assert.equal(PAIN.CRYING, 1.7); assert.equal(PAIN.STILL, 1.8); assert.equal(PAIN.TOO_HARSH, 2.0);
  assert.ok(Math.abs(PAIN.TOO_HARSH * PAIN.HARSH_SPIKE - 2.05) < 1e-9);
  const p = createPain(); p.ache = rawAt(2.06) * p.capacity(); p.update(0.01); assert.equal(p.tooHarsh, true);
});
