// The figures: the skeleton has five-fingered hands and a bone for each cheek; every skinned point's weights sum to one; the seat's spots sit on
// the outer surface (not on a leg tube buried inside the buttock); every skinned material is dual-quaternion skinned; the clothes come and go.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
// (a canvas that draws nothing: the face is painted on one)
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.THREE = require('../vendor/three.min.js');
require('../js/figure.js'); require('../js/crew.js');
const F = window.Figure, Crew = window.Crew;

const fig = Figure => Figure.make(Crew.figureSpec('pilot', 'f', 'uniform'));

test('hands have four two-jointed fingers and a thumb; each cheek has a bone', () => {
  const f = fig(F);
  for (const s of ['L', 'R']) {
    for (const n of ['index', 'middle', 'ring', 'pinky']) { assert.ok(f.bone[n + '1' + s] && f.bone[n + '2' + s], n + s); assert.equal(f.bone[n + '2' + s].parent, f.bone[n + '1' + s]); }
    assert.ok(f.bone['thumb1' + s] && f.bone['thumb2' + s]); assert.equal(f.bone['glute' + s].parent, f.bone.hips);
  }
});

test('every skinned point’s weights sum to one', () => {
  const f = fig(F);
  for (const m of [f.body, f.clothes.top, f.clothes.bottoms, f.clothes.under, f.bootL]) {
    const w = m.geometry.attributes.skinWeight.array;
    for (let i = 0; i < w.length; i += 4) { const t = w[i] + w[i + 1] + w[i + 2] + w[i + 3]; assert.ok(Math.abs(t - 1) < 1e-4, `weights ${t} at ${i / 4}`); }
  }
});

test('the seat’s spots are on the outer surface, weighted to the pelvis and the cheek', () => {
  for (const sex of ['m', 'f']) for (const id of Crew.IDS) {
    const f = F.make(Crew.figureSpec(id, sex, 'uniform')), g = f.body.geometry, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array, p = g.attributes.position;
    for (const k of ['upperL', 'centreL', 'sitspotR', 'centreR']) {
      const sp = f.spot[k];
      // nothing of the body lies further back near it
      for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i) - sp.bind.x, p.getY(i) - sp.bind.y) < 0.006) assert.ok(p.getZ(i) >= sp.bind.z - 0.006, `${id}/${sex} ${k}`);
      let leg = 0; for (let j = 0; j < 4; j++) if (/^thigh/.test(f.bones[si[sp.i * 4 + j]].name)) leg += sw[sp.i * 4 + j];
      assert.ok(leg < 0.5, `${id}/${sex} ${k} rides the thigh (${leg})`);
    }
  }
});

test('skinned materials use dual-quaternion skinning (shadows too)', () => {
  const f = fig(F);
  for (const m of [f.body, f.clothes.top, f.bootL]) {
    assert.match(m.material.customProgramCacheKey(), /^dqs\|/); assert.ok(m.customDepthMaterial);
    const sh = { vertexShader: '#include <skinning_pars_vertex>\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n#include <skinning_vertex>', fragmentShader: '', uniforms: {} };
    m.material.onBeforeCompile(sh); assert.match(sh.vertexShader, /dqQuat/); assert.doesNotMatch(sh.vertexShader, /#include <skinning_vertex>/);
  }
});

test('lowering and raising the clothes remakes them, and hides the skin under each', () => {
  const f = fig(F), hide = () => f.skinMat.userData.u.uHide.value, bit = r => (hide() >> r) & 1;
  assert.equal(bit(F.R.SEAT), 1);
  f.setClothes({ bottoms: 'down', under: 'down' }); assert.equal(bit(F.R.SEAT), 0); assert.equal(bit(F.R.SHIN), 1);
  f.setClothes({ top: 'up' }); assert.equal(bit(F.R.WAIST), 0); assert.equal(bit(F.R.WAIST_HI), 1);
});

test('a grip curls every finger the same way on each hand, mirrored', () => {
  const f = fig(F); f.grip('L', 1, 0, 1); f.grip('R', 1, 0, 1);
  for (const n of ['index', 'middle', 'ring', 'pinky']) { assert.ok(f.bone[n + '1L'].rotation.z < 0); assert.ok(f.bone[n + '1R'].rotation.z > 0); }
});
