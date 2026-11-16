// The figures: the skeleton has five-fingered hands and a bone for each cheek; every skinned point's weights sum to one; the seat's spots sit on
// the outer surface (not on a leg tube buried inside the buttock); every skinned material is dual-quaternion skinned; the clothes come and go.
// First the figures built in code (model: 'built'), then the same for the Blender-built ones (models/*.glb), and their build, layers and IK.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
// (a canvas that draws nothing: the face is painted on one)
const ctx = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
globalThis.THREE = require('../vendor/three.min.js');
require('../js/figure.js'); require('../js/crew.js');
const F = window.Figure, Crew = window.Crew;

const built = spec => Object.assign(spec, { model: 'built' });
const fig = Figure => Figure.make(built(Crew.figureSpec('pilot', 'f', 'uniform')));

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
    const f = F.make(built(Crew.figureSpec(id, sex, 'uniform'))), g = f.body.geometry, si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array, p = g.attributes.position;
    for (const k of ['cheekL', 'sitspotR', 'cheekR', 'sitspotL']) {
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

// ── The Blender-built figures ──
require('../vendor/GLTFLoader.js');
const fs = require('fs'), path = require('path'), MODELS = path.join(__dirname, '..', 'models');
const meta = JSON.parse(fs.readFileSync(path.join(MODELS, 'meridian_meta.json')));
const glb = sx => { const b = fs.readFileSync(path.join(MODELS, 'meridian_' + sx + '.glb')); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const loaded = Promise.all(['f', 'm'].map(sx => F.adopt(meta, sx, glb(sx))));
const gfig = (id, sex, outfit) => F.make(Crew.figureSpec(id || 'pilot', sex || 'f', outfit || 'uniform'));

test('the Blender-built figures: the same skeleton, built from the models, each layer weighted to one', async () => {
  await loaded;
  for (const sex of ['f', 'm']) {
    const f = gfig('pilot', sex);
    assert.ok(f.model, 'made from the model'); assert.equal(f.bones.length, sex === 'm' ? 44 : 43);      // (his: one more, for his lift)
    for (const s of ['L', 'R']) { for (const n of ['index', 'middle', 'ring', 'pinky', 'thumb']) assert.equal(f.bone[n + '2' + s].parent, f.bone[n + '1' + s]); assert.equal(f.bone['glute' + s].parent, f.bone.hips); }
    f.setClothes({ top: 'up', bottoms: 'down', under: 'down' }); f.setOutfit('offduty');
    for (const m of [f.body, ...Object.values(f.gm)]) {
      const w = m.geometry.attributes.skinWeight.array, j = m.geometry.attributes.skinIndex.array;
      for (let i = 0; i < w.length; i += 4) { const t = w[i] + w[i + 1] + w[i + 2] + w[i + 3]; assert.ok(Math.abs(t - 1) < 1e-4, `${m.geometry.name} weights ${t}`); }
      for (let i = 0; i < j.length; i++) assert.ok(j[i] < f.bones.length);
      assert.match(m.material.customProgramCacheKey(), /^dqs\|/);
    }
  }
});

test('each crew member’s build sets the body’s shape keys, and the clothes follow them', async () => {
  await loaded;
  const heavy = gfig('engineer', 'm'), slight = gfig('lifesupport', 'f');
  const inf = (f, m, k) => m.morphTargetInfluences[m.geometry.userData.keys[k]];
  assert.ok(inf(heavy, heavy.body, 'muscle') > 0.8 && inf(heavy, heavy.body, 'slight') === 0);
  assert.ok(inf(slight, slight.body, 'slight') > 0.2 && inf(slight, slight.body, 'muscle') === 0);
  for (const m of Object.values(heavy.gm)) assert.equal(inf(heavy, m, 'muscle'), inf(heavy, heavy.body, 'muscle'));
});

test('the body’s response: the sex fuller, his lifting on its own bone, a deeper tone there, and his pouch filling out', async () => {
  await loaded;
  for (const sex of ['f', 'm']) {
    const f = gfig('pilot', sex), inf = m => m.morphTargetInfluences[m.geometry.userData.keys.sexSwell];
    assert.ok('sexSwell' in f.body.geometry.userData.keys); assert.equal(inf(f.body), 0); assert.equal(f.skinMat.userData.u.uFlush.value.x, 0);
    f.setResponse(0.5); for (let i = 0; i < 120; i++) f.tick(0.05);
    assert.ok(inf(f.body) > 0.4, 'fuller'); assert.ok(f.skinMat.userData.u.uFlush.value.x > 0.8, 'flushed');
    if (sex === 'm') {
      assert.equal(f.bone.sex.parent, f.bone.hips);
      assert.ok(f.bone.sex.rotation.x < -0.6 && f.bone.sex.rotation.x > -1.0, `lifting partway: ${f.bone.sex.rotation.x}`);
      assert.ok(inf(f.gm.Briefs) > 0.5 && inf(f.gm.Trousers) > 0.5, 'the pouch follows');
    } else assert.equal(f.bone.sex, undefined);
    f.setResponse(0); for (let i = 0; i < 200; i++) f.tick(0.05);
    assert.equal(inf(f.body), 0); if (sex === 'm') assert.ok(f.bone.sex.rotation.x > -0.01, 'and back down');
  }
});

test('one of each layer is worn at a time, and the skin under it is hidden', async () => {
  await loaded;
  const f = gfig(), hide = () => f.skinMat.userData.u.uHide.value, bit = r => (hide() >> r) & 1;
  const shown = () => Object.entries(f.gm).filter(([, m]) => m.visible).map(([k]) => k).sort();
  assert.deepEqual(shown(), ['Boots', 'Briefs', 'Trousers', 'Tunic']); assert.equal(bit(F.R.SEAT), 1); assert.equal(bit(F.R.FOOT), 1);
  f.setClothes({ bottoms: 'down', under: 'down' }); assert.deepEqual(shown(), ['Boots', 'BriefsDown', 'TrousersDown', 'Tunic']); assert.equal(bit(F.R.SEAT), 0); assert.equal(bit(F.R.SHIN), 1);
  f.setClothes({ top: 'up' }); assert.equal(bit(F.R.WAIST), 0); assert.equal(bit(F.R.WAIST_HI), 1);
  assert.equal(f.clothes.top, f.gm.TunicUp); assert.equal(f.clothes.bottoms, f.gm.TrousersDown);
  f.setOutfit('offduty'); assert.ok(f.gm.ShirtUp.visible); assert.equal(bit(F.R.FOREARM), 0);
});

test('the Blender-built seat’s spots are on its outer surface, in order down it', async () => {
  await loaded;
  for (const sex of ['f', 'm']) {
    const f = gfig('pilot', sex), p = f.body.geometry.attributes.position;
    for (const k of F.SPOTS) {
      const sp = f.spot[k];
      for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i) - sp.bind.x, p.getY(i) - sp.bind.y) < 0.006) assert.ok(p.getZ(i) >= sp.bind.z - 0.006, `${sex} ${k}`);
    }
    for (const s of ['L', 'R']) { const y = a => f.spot[a + s].bind.y; assert.ok(y('cheek') > y('sitspot') && y('sitspot') > y('thighs'), sex + s); }
  }
});

test('the arms, hanging a little out at rest, still reach where they’re sent', async () => {
  await loaded;
  const f = gfig(), V = THREE.Vector3;
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const W = new V(sx * 0.12, 1.25, 0.35);
    F.ik2(f, f.bone['upperArm' + s], f.bone['foreArm' + s], f.bone['hand' + s], W, new V(sx, -0.3, -0.5).normalize(), -1);
    assert.ok(f.bone['hand' + s].getWorldPosition(new V()).distanceTo(W) < 0.002, s);
  }
});

test('her forms: folds with the pelvis (only their lower outer edges sharing with the thighs), and the inner form between them with its own tone', async () => {
  await loaded;
  const f = gfig('pilot', 'f'), g = f.body.geometry, part = g.attributes._part, tone = g.attributes.tone, p = g.attributes.position;
  const w = g.attributes.skinWeight.array, j = g.attributes.skinIndex.array, hips = f.bones.indexOf(f.bone.hips);
  let sex = 0, inner = 0, offMid = 0, onHips = 0;
  for (let i = 0; i < part.count; i++) {
    if (part.getX(i) < 0.5) continue; sex++;
    let wh = 0; for (let k = 0; k < 4; k++) if (j[i * 4 + k] === hips) wh += w[i * 4 + k];
    if (wh > 0.65) onHips++;
    if (part.getX(i) > 1.5) { inner++; assert.equal(tone.getX(i), 1); if (Math.abs(p.getX(i)) > 0.006) offMid++; } else assert.equal(tone.getX(i), 0);
  }
  assert.ok(sex > 150 && inner > 5 && inner < sex / 3, `${sex} on the sex, ${inner} on the inner form`); assert.equal(offMid, 0, 'the inner form at the midline');
  assert.ok(onHips / sex > 0.85, `mostly with the pelvis: ${onHips}/${sex}`);
  const m = gfig('pilot', 'm'); for (let i = 0; i < m.body.geometry.attributes.tone.count; i++) assert.equal(m.body.geometry.attributes.tone.getX(i), 0);
});

test('off duty, each in their own: the top’s sleeves, the patterns, and soft shoes (the Captain’s boots as they were)', async () => {
  await loaded;
  const top = f => Object.keys(f.gm).find(k => /^(Tunic|Shirt)/.test(k) && f.gm[k].visible);
  const kit = gfig('pilot', 'f'); kit.setOutfit('offduty'); assert.equal(top(kit), 'Shirt');      // (sleeves pushed up)
  assert.equal(kit.gm.Shirt.material.userData.u.uL0.value.x, 6); assert.equal(kit.gm.Trousers.material.userData.u.uL0.value.z, 4); assert.equal(kit.gm.Boots.material.userData.u.uParam.value.x, 4);
  const sefa = gfig('comms', 'f'); sefa.setOutfit('offduty'); assert.equal(top(sefa), 'Tunic');      // (long sleeves)
  assert.equal(sefa.gm.Tunic.material.userData.u.uL0.value.x, 2); assert.ok(sefa.skinMat.userData.u.uHide.value & (1 << F.R.FOREARM));
  const cap = F.make(Crew.captainSpec({ outfit: 'offduty' })); assert.equal(top(cap), 'Shirt');
  assert.equal(cap.gm.Shirt.material.userData.u.uL0.value.x, 0); assert.equal(cap.gm.Boots.material.userData.u.uParam.value.x, 0);
});
