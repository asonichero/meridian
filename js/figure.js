// Project Meridian — the figures: real adult proportions (about 7.5 heads tall) on a full skeleton (pelvis, two spine joints, neck, head; clavicle,
// shoulder, elbow, wrist, fingers and thumb; hip, knee, ankle, toes), skinned so every joint bends as one continuous surface. Rendered in a stylised,
// painterly way: simplified chunky forms, soft shading with a painted grain, no outlines. Everything is built in code.
//
// Units are metres; a figure faces +z, up is +y, their left is +x. Every bone's rest frame is aligned with the world, and limbs run down their bone's -y,
// so: thighs and upper arms swing forward for a negative turn about x, elbows bend forward for a negative turn, knees back for a positive one.
//
//   const f = Figure.make({ sex: 'f', height: 1.70, mass: 0.4, fat: 0.4, skin, hair, hairStyle, eyes, beard, outfit: 'uniform', dept: '#d8a040' })
//   f.root · f.bone.hips … · f.setClothes({ top: 'down'|'up', bottoms: 'up'|'down', under: 'up'|'down' }) · f.setExpr('wince') · f.tick(dt)
//   f.spots: the seat's mark spots (L/R × upper, centre, sitspot, thighs) · f.mark(spot, amount) · f.surface(spot, out) → { p, n } in world space
(function (root) {
'use strict';
const THREE = root.THREE, V3 = THREE.Vector3;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
const srgb = h => new THREE.Color(h).convertSRGBToLinear();
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return '#' + ch.map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}

// ── Painted materials ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A soft grain of value noise in object space (so it rides with the figure), a gentle wrap to the light so shadows stay warm and soft rather than
// black, and optionally: skin regions hidden under clothes (so nothing pokes through), and the marks on the seat.
const NOISE = `
float fh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float fn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(fh(i), fh(i + vec3(1,0,0)), f.x), mix(fh(i + vec3(0,1,0)), fh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fh(i + vec3(0,0,1)), fh(i + vec3(1,0,1)), f.x), mix(fh(i + vec3(0,1,1)), fh(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
function paint(m, o) {
  o = o || {};
  const U = { uRim: { value: srgb(o.rim || '#2a3440').multiplyScalar(o.rimK == null ? 1 : o.rimK) }, uGrain: { value: o.grain == null ? 0.03 : o.grain }, uGrainScale: { value: o.scale || 60 }, uHide: { value: 0 },
    uMarks: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, -9, 0, 0)) }, uMarkCol: { value: srgb(o.markCol || '#b8323a') } };
  m.userData.u = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 bind; ${o.regions ? 'attribute float region;' : ''} varying vec3 vBind; varying float vHide; uniform float uHide;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vBind = ${o.bindAttr ? 'bind' : 'position'};
${o.regions ? 'vHide = mod(floor(uHide / exp2(region) + 0.001), 2.0);' : 'vHide = 0.0;'}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vBind; varying float vHide; uniform vec3 uRim; uniform float uGrain; uniform float uGrainScale; uniform vec4 uMarks[8]; uniform vec3 uMarkCol;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vHide > 0.5) discard;
float g = fn3(vBind * uGrainScale) * 0.6 + fn3(vBind * uGrainScale * 2.7) * 0.4;
diffuseColor.rgb *= 1.0 + uGrain * (g - 0.5) * 2.0;
${o.marks ? `float mk = 0.0;
for (int i = 0; i < 8; i++) { vec3 d = vBind - uMarks[i].xyz; d.z *= 0.6; mk += uMarks[i].w * exp(-dot(d, d) / 0.0026); }
float mott = fn3(vBind * 140.0);
mk = clamp(mk * (0.75 + 0.5 * mott), 0.0, 1.0);
diffuseColor.rgb = mix(diffuseColor.rgb, uMarkCol, mk * 0.78);` : ''}`)
      // (a soft rim of light round the silhouette, as stylised shading has)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float fr = 1.0 - abs(dot(normalize(vViewPosition), normal)); totalEmissiveRadiance += uRim * smoothstep(0.55, 0.9, fr) * 0.6; }`);
  };
  return m;
}
const MATS = new Map();
function mat(hex, o) {
  o = o || {};
  const key = JSON.stringify([hex, o]);
  if (!o.unique && MATS.has(key)) return MATS.get(key);
  const m = paint(new THREE.MeshStandardMaterial({ color: srgb(hex), roughness: o.rough == null ? 0.78 : o.rough, metalness: o.metal || 0,
    skinning: !!o.skin, vertexColors: !!o.vc, side: o.side || THREE.FrontSide, transparent: !!o.opacity, opacity: o.opacity || 1,
    emissive: o.emissive ? srgb(o.emissive) : new THREE.Color(0), emissiveIntensity: o.ei || 1 }), o);
  if (!o.unique) MATS.set(key, m);
  return m;
}

// ── Toon: redlessons' shading (a ramp of soft bands rather than smooth falloff) and ink outlines (an inverted hull, a little out along the normals). ──
let RAMP = null;
function ramp() {
  if (RAMP) return RAMP;
  const d = new Uint8Array([128, 128, 128, 255, 176, 176, 176, 255, 228, 228, 228, 255, 255, 255, 255, 255]);
  RAMP = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); RAMP.minFilter = RAMP.magFilter = THREE.LinearFilter; RAMP.generateMipmaps = false; RAMP.needsUpdate = true;
  return RAMP;
}
const TMATS = new Map();
function tmat(hex, o) {
  o = Object.assign({ grain: 0 }, o || {});
  const key = JSON.stringify([hex, o]);
  if (!o.unique && TMATS.has(key)) return TMATS.get(key);
  const m = paint(new THREE.MeshToonMaterial({ color: srgb(hex), gradientMap: ramp(), skinning: !!o.skin, vertexColors: !!o.vc, side: o.side || THREE.FrontSide }), o);
  if (!o.unique) TMATS.set(key, m);
  return m;
}
const INK = '#2a1a16';
const INKM = { plain: new THREE.MeshBasicMaterial({ color: srgb(INK), side: THREE.BackSide }), skinned: new THREE.MeshBasicMaterial({ color: srgb(INK), side: THREE.BackSide, skinning: true }) };
function hullGeo(geo, w) {
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * w, p.getY(i) + n.getY(i) * w, p.getZ(i) + n.getZ(i) * w);
  return g;
}
// An outline round a mesh: for a plain one, a child; for a skinned one, a second skinned mesh on the same skeleton (mat: its own, e.g. sharing hidden regions).
function ink(mesh, w, F, m) {
  if (mesh.isSkinnedMesh) { const h = new THREE.SkinnedMesh(hullGeo(mesh.geometry, w), m || INKM.skinned); F.root.add(h); h.bind(F.skeleton, F.bindM); h.frustumCulled = false; mesh.userData.hull = h; return h; }
  const h = new THREE.Mesh(hullGeo(mesh.geometry, w), INKM.plain); mesh.add(h); return h;
}
const INK_W = 0.0045;

// ── Bones ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Built for a figure 1.75 m tall; a figure of another height is scaled whole (f.root.scale). Women's shoulders narrower and hip joints a touch wider.
function skeletonSpec(sx) {
  const f = sx === 'f', shX = f ? 0.175 : 0.195, hipX = f ? 0.095 : 0.09;
  return [
    ['hips', null, 0, 0.95, 0],
    ['spine', 'hips', 0, 0.10, 0], ['chest', 'spine', 0, 0.17, 0], ['neck', 'chest', 0, 0.27, -0.012], ['head', 'neck', 0, 0.085, 0.012],
    ['clavL', 'chest', 0.03, 0.21, 0], ['upperArmL', 'clavL', shX - 0.03, 0, -0.01], ['foreArmL', 'upperArmL', 0.012, -0.29, 0], ['handL', 'foreArmL', 0.005, -0.255, 0.008],
    ['fingersL', 'handL', 0, -0.095, 0.004], ['thumbL', 'handL', -0.006, -0.028, 0.024],
    ['clavR', 'chest', -0.03, 0.21, 0], ['upperArmR', 'clavR', -(shX - 0.03), 0, -0.01], ['foreArmR', 'upperArmR', -0.012, -0.29, 0], ['handR', 'foreArmR', -0.005, -0.255, 0.008],
    ['fingersR', 'handR', 0, -0.095, 0.004], ['thumbR', 'handR', 0.006, -0.028, 0.024],
    ['thighL', 'hips', hipX, -0.05, 0], ['shinL', 'thighL', -0.005, -0.42, 0.006], ['footL', 'shinL', 0, -0.40, -0.012], ['toeL', 'footL', 0, -0.06, 0.13],
    ['thighR', 'hips', -hipX, -0.05, 0], ['shinR', 'thighR', 0.005, -0.42, 0.006], ['footR', 'shinR', 0, -0.40, -0.012], ['toeR', 'footR', 0, -0.06, 0.13],
  ];
}

// ── Mesh builder: rings swept along the body in its rest pose, each vertex weighted to the bones near it. ────────────────────────────────────────
function Builder() {
  const B = { pos: [], nrm: [], uv: [], idx: [], si: [], sw: [], col: [], reg: [] };
  // ring: { c: [x, y, z], rx, zF, zB, p (superellipse exponent), lobes(θ) → extra radius }; rings run in order; seg around.
  B.sweep = (rings, seg, o) => {
    const base = B.pos.length / 3, n = seg + 1;
    rings.forEach((r, i) => {
      for (let j = 0; j <= seg; j++) {
        const th = (j / seg) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), p = r.p || 2;
        const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / p), ez = Math.sign(s) * Math.pow(Math.abs(s), 2 / p);
        let x = ex * r.rx, z = ez * (s > 0 ? r.zF : r.zB);
        const add = r.lobes ? r.lobes(th) : 0;
        if (add) { const L = Math.hypot(x, z) || 1; x += add * x / L; z += add * z / L; }
        const P = [r.c[0] + x * (o.mirror || 1), r.c[1], r.c[2] + z];
        B.vert(P, [0, 0, 0], [j / seg, i / (rings.length - 1)], o);
      }
    });
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = base + i * n + j, b = a + 1, c = a + n, d = c + 1;
      if (o.flip) B.idx.push(a, b, c, b, d, c); else B.idx.push(a, c, b, b, c, d);
    }
    if (o.capBottom) B.cap(base, seg, rings[0], !o.flip, o);
    if (o.capTop) B.cap(base + (rings.length - 1) * n, seg, rings[rings.length - 1], !!o.flip, o);
    return base;
  };
  B.cap = (start, seg, r, down, o) => {
    const ci = B.pos.length / 3; B.vert(r.c.slice(), [0, 0, 0], [0.5, 0.5], o);
    for (let j = 0; j < seg; j++) { if (down) B.idx.push(ci, start + j, start + j + 1); else B.idx.push(ci, start + j + 1, start + j); }
  };
  B.vert = (P, N, UV, o) => {
    B.pos.push(P[0], P[1], P[2]); B.nrm.push(N[0], N[1], N[2]); B.uv.push(UV[0], UV[1]);
    const w = (o.weights(P) || []).filter(e => e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4), tot = w.reduce((a, e) => a + e[1], 0) || 1;
    for (let k = 0; k < 4; k++) { B.si.push(w[k] ? w[k][0] : 0); B.sw.push(w[k] ? w[k][1] / tot : 0); }
    const col = o.color ? o.color(P) : [1, 1, 1]; B.col.push(col[0], col[1], col[2]);
    B.reg.push(o.region ? o.region(P) : 0);
  };
  B.geometry = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('bind', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
    g.setAttribute('region', new THREE.Float32BufferAttribute(B.reg, 1));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(B.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(B.sw, 4));
    g.setIndex(B.idx); g.computeVertexNormals(); weldSeams(g);
    return g;
  };
  return B;
}
// The swept rings repeat their first column at the end (for the texture's seam): give both the same normal so no seam shows.
function weldSeams(g) {
  const p = g.attributes.position, n = g.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 1e5) + ',' + Math.round(p.getY(i) * 1e5) + ',' + Math.round(p.getZ(i) * 1e5);
    const e = map.get(k); if (e) e.push(i); else map.set(k, [i]);
  }
  for (const list of map.values()) if (list.length > 1) {
    const s = new V3(); for (const i of list) s.add(new V3(n.getX(i), n.getY(i), n.getZ(i))); s.normalize();
    for (const i of list) n.setXYZ(i, s.x, s.y, s.z);
  }
}

// ── Regions of skin, so what's under clothes can be hidden ────────────────────────────────────────────────────────────────────────────────────
const R = { HEAD: 0, CHEST: 1, WAIST: 2, HIPS: 3, SEAT: 4, THIGH: 5, KNEE: 6, SHIN: 7, UPARM: 8, FOREARM: 9, HAND: 10 };

// ── The body's shape, from sex, mass (muscle and frame, 0–1) and fat (softness, 0–1). ──────────────────────────────────────────────────────────
function shapeOf(o) {
  const f = o.sex === 'f', m = o.mass == null ? 0.5 : o.mass, fat = o.fat == null ? 0.4 : o.fat;
  const W = 0.9 + 0.2 * m + 0.12 * fat;                 // overall girth
  return {
    f, m, fat, W,
    shoulder: (f ? 0.92 : 1.04) * (0.94 + 0.12 * m),
    chest: f ? 0.9 : 1.0, waist: (f ? 0.82 : 0.97) * (0.9 + 0.12 * m + 0.25 * fat), hip: (f ? 1.12 : 0.98) * (0.94 + 0.08 * m + 0.14 * fat),
    glute: (f ? 0.034 : 0.022) * (0.75 + 0.5 * fat + 0.3 * m), belly: 0.035 * fat * (f ? 0.8 : 1.1),
    bust: f ? (o.bust == null ? 0.035 : o.bust) * (0.8 + 0.5 * fat) : 0.006 * m,
    limb: (f ? 0.9 : 1.0) * (0.88 + 0.18 * m + 0.14 * fat), thigh: (f ? 1.05 : 1.0) * (0.9 + 0.12 * m + 0.2 * fat),
  };
}
// The torso, crotch to under the skull: [y, rx, zF, zB, glute, bust, belly, cleft]
function torsoRings(S, inflate, bridge) {
  const sh = S.shoulder, hp = S.hip, w = S.waist, ch = S.chest, t = inflate || 0;
  const rows = [
    [0.795, 0.09 * hp, 0.045, 0.06, 0.15, 0, 0],
    [0.83, 0.135 * hp, 0.07, 0.092, 0.85, 0, 0],
    [0.875, 0.158 * hp, 0.085, 0.11, 1, 0, 0],
    [0.925, 0.162 * hp, 0.092, 0.104, 0.75, 0, 0.2],
    [0.98, 0.152 * lerp(hp, w, 0.4), 0.094, 0.088, 0.2, 0, 0.6],
    [1.04, 0.142 * w, 0.094, 0.082, 0, 0, 1],
    [1.10, 0.146 * lerp(w, ch, 0.5), 0.098, 0.084, 0, 0, 0.7],
    [1.17, 0.152 * ch, 0.104, 0.09, 0, 0.3, 0.2],
    [1.24, 0.158 * ch, 0.11, 0.095, 0, 0.85, 0],
    [1.30, 0.162 * lerp(ch, sh, 0.4), 0.112, 0.098, 0, 1, 0],
    [1.36, 0.17 * sh, 0.104, 0.098, 0, 0.45, 0],
    [1.41, 0.17 * sh, 0.085, 0.092, 0, 0, 0],
    [1.438, 0.152 * sh, 0.072, 0.082, 0, 0, 0],
    [1.462, 0.112 * sh, 0.06, 0.068, 0, 0, 0],
    [1.482, 0.07, 0.054, 0.057, 0, 0, 0],
    [1.52, 0.056 * (S.f ? 1 : 1.12), 0.05 * (S.f ? 1 : 1.1), 0.054 * (S.f ? 1 : 1.1), 0, 0, 0],
    [1.585, 0.052 * (S.f ? 1 : 1.1), 0.048 * (S.f ? 1 : 1.1), 0.05 * (S.f ? 1 : 1.1), 0, 0, 0],
  ];
  return rows.map(([y, rx, zF, zB, gl, bu, be]) => {
    const R0 = { c: [0, y, 0.0], rx: rx * (y > 1.5 ? 1 : S.W) + t, zF: (zF + be * S.belly) * S.W + t, zB: zB * S.W + t, p: y > 1.44 ? 2 : 2.25 };
    if (gl || bu) R0.lobes = th => {
      let a = 0;
      if (gl) {
        const l = gauss(angDiff(th, -Math.PI / 2 + 0.62), 0.5), r = gauss(angDiff(th, -Math.PI / 2 - 0.62), 0.5);
        a += gl * S.glute * (bridge ? Math.max(l, r) * 1.05 + 0.25 * gauss(angDiff(th, -Math.PI / 2), 0.4) : l + r);
        if (!bridge) a -= gl * S.glute * 0.85 * gauss(angDiff(th, -Math.PI / 2), 0.1);
      }
      if (bu) {
        const l = gauss(angDiff(th, Math.PI / 2 - 0.62), 0.38), r = gauss(angDiff(th, Math.PI / 2 + 0.62), 0.38);
        a += bu * S.bust * (bridge ? Math.max(l, r) + 0.6 * gauss(angDiff(th, Math.PI / 2), 0.45) : l + r);
      }
      return a;
    };
    return R0;
  });
}
// A leg, from the hip joint (+0.06, buried) to the ankle: [dy, rx, zF, zB, centre x, centre z]
function legRings(S, side, inflate, from, to) {
  const t = inflate || 0, hx = (S.f ? 0.095 : 0.09) * side, L = S.limb, T = S.thigh;
  const rows = [
    [0.07, 0.096 * T, 0.09 * T, 0.1 * T, 0, 0], [0.0, 0.092 * T, 0.088 * T, 0.094 * T, 0, 0], [-0.08, 0.086 * T, 0.084 * T, 0.084 * T, -0.002, 0.004],
    [-0.18, 0.076 * T, 0.075 * T, 0.072 * T, -0.004, 0.006], [-0.29, 0.064 * lerp(T, L, 0.5), 0.062, 0.058, -0.005, 0.006],
    [-0.37, 0.053 * L, 0.054 * L, 0.05 * L, -0.005, 0.006], [-0.42, 0.048 * L, 0.051 * L, 0.046 * L, -0.005, 0.008],
    [-0.47, 0.047 * L, 0.048 * L, 0.05 * L, -0.005, 0.004], [-0.56, 0.05 * L, 0.043 * L, 0.06 * L, -0.005, 0], [-0.66, 0.043 * L, 0.036 * L, 0.046 * L, -0.005, 0],
    [-0.76, 0.033 * L, 0.03 * L, 0.033 * L, -0.005, -0.006], [-0.82, 0.03, 0.03, 0.03, -0.005, -0.008], [-0.86, 0.026, 0.028, 0.026, -0.005, -0.008],
  ];
  return rows.filter(r => r[0] <= (from == null ? 9 : from) + 1e-6 && r[0] >= (to == null ? -9 : to) - 1e-6)
    .map(([dy, rx, zF, zB, cx, cz]) => ({ c: [hx + cx * side, 0.90 + dy, cz], rx: rx + t, zF: zF + t, zB: zB + t, p: 2.1 }));
}
// An arm, hanging, from over the shoulder joint to the wrist: [y, rx (side), rz (front/back), centre x]
function armRings(S, side, inflate, to) {
  const t = inflate || 0, L = S.limb, sx = (S.f ? 0.175 : 0.195) * side;
  const rows = [[1.468, 0.03, 0.03, -0.022], [1.455, 0.05, 0.048, -0.008], [1.43, 0.062, 0.056, 0.002], [1.38, 0.058, 0.053, 0.008], [1.30, 0.05, 0.049, 0.01], [1.22, 0.047, 0.046, 0.012],
    [1.145, 0.039, 0.041, 0.014], [1.07, 0.044, 0.042, 0.016], [0.98, 0.037, 0.032, 0.018], [0.90, 0.029, 0.023, 0.02], [0.875, 0.027, 0.021, 0.02]];
  return rows.filter(r => r[0] >= (to == null ? 0 : to) - 1e-6).map(([y, rx, rz, cx]) => ({ c: [sx + cx * side, y, -0.01 + (y < 1.14 ? 0.008 : 0)], rx: rx * L + t, zF: rz * L + t, zB: rz * L + t, p: 2 }));
}

// ── Making a figure ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const SPOTS = ['upperL', 'upperR', 'centreL', 'centreR', 'sitspotL', 'sitspotR', 'thighsL', 'thighsR'];
const SPOT_AT = { upper: 0.93, centre: 0.875, sitspot: 0.825, thighs: 0.76 };

function make(spec) {
  spec = Object.assign({ sex: 'm', height: 1.75, mass: 0.5, fat: 0.4, skin: '#c8987a', hair: '#3a2a20', hairStyle: 'crop', eyes: '#4a5a4a', lips: null,
    outfit: 'uniform', dept: '#c89a3a', beard: false }, spec || {});
  const S = shapeOf(spec), F = { spec, S, root: new THREE.Group(), bone: {}, bones: [] };
  F.root.scale.setScalar(spec.height / 1.75);

  // Skeleton
  const BI = {};
  for (const [name, parent, x, y, z] of skeletonSpec(spec.sex)) {
    const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z);
    (parent ? F.bone[parent] : F.root).add(b); F.bone[name] = b; BI[name] = F.bones.length; F.bones.push(b);
  }
  F.root.updateMatrixWorld(true);
  F.skeleton = new THREE.Skeleton(F.bones);
  F.bindM = F.root.matrixWorld.clone();      // (every skinned part binds with the rest pose's matrix, whenever it's made: clothes are remade mid-scene)
  const rest = {}; for (const b of F.bones) rest[b.name] = b.getWorldPosition(new V3());
  F.rest = rest;
  const w = (name, v) => [BI[name], v];
  const side = x => (x >= 0 ? 'L' : 'R');

  // Weights: smooth blends across each joint.
  function torsoW(P) {
    const [x, y] = P, ax = Math.abs(x), s = side(x), out = [];
    const toThigh = ss(0.96, 0.80, y) * ss(0.01, 0.08, ax) * 0.8;
    const sp = ss(0.98, 1.13, y), chs = ss(1.15, 1.30, y), nk = ss(1.47, 1.535, y), hd = ss(1.55, 1.6, y);
    const cl = ss(0.09, 0.15, ax) * ss(1.34, 1.43, y) * (1 - nk);
    let hips = (1 - sp) * (1 - toThigh), spine = sp * (1 - chs), chest = chs * (1 - nk) * (1 - cl);
    out.push(w('hips', hips), w('thigh' + s, toThigh * (1 - sp)), w('spine', spine), w('chest', chest), w('clav' + s, cl * 0.6), w('upperArm' + s, cl * 0.4), w('neck', nk * (1 - hd)), w('head', hd));
    return out;
  }
  function legW(P) {
    const y = P[1], s = side(P[0]);
    const th = ss(0.99, 0.86, y), sh = ss(0.54, 0.43, y), ft = ss(0.13, 0.065, y);
    return [w('hips', 1 - th), w('thigh' + s, th * (1 - sh)), w('shin' + s, sh * (1 - ft)), w('foot' + s, ft)];
  }
  function armW(P) {
    const y = P[1], s = side(P[0]);
    const ua = ss(1.47, 1.39, y), fa = ss(1.18, 1.10, y), hd = ss(0.915, 0.865, y);
    return [w('chest', (1 - ua) * 0.35), w('clav' + s, (1 - ua) * 0.65), w('upperArm' + s, ua * (1 - fa)), w('foreArm' + s, fa * (1 - hd)), w('hand' + s, hd)];
  }
  const torsoRegion = P => P[1] >= 1.47 ? R.HEAD : P[1] >= 1.15 ? R.CHEST : P[1] >= 1.03 ? R.WAIST : P[1] >= 0.935 ? R.HIPS : R.SEAT;
  const legRegion = P => P[1] >= 0.93 ? R.HIPS : P[1] >= 0.61 ? R.THIGH : P[1] >= 0.38 ? R.KNEE : R.SHIN;
  const armRegion = P => P[1] >= 1.14 ? R.UPARM : P[1] >= 0.88 ? R.FOREARM : R.HAND;

  // ── The body ──
  const BB = Builder(), skinC = () => [1, 1, 1];
  BB.sweep(torsoRings(S), 36, { weights: torsoW, region: torsoRegion, capBottom: true, color: skinC });
  for (const sd of [1, -1]) {
    BB.sweep(legRings(S, sd), 22, { weights: legW, region: legRegion, color: skinC, flip: true });
    BB.sweep(armRings(S, sd), 18, { weights: armW, region: armRegion, color: skinC, capBottom: true, flip: true });
    handGeo(BB, S, sd, BI, w);
  }
  const bodyGeo = BB.geometry();
  const skinM = tmat(spec.skin, { skin: true, regions: true, marks: true, bindAttr: true, unique: true, rim: '#6a5048', rimK: 0.5 });
  F.body = new THREE.SkinnedMesh(bodyGeo, skinM);
  F.root.add(F.body); F.body.bind(F.skeleton, F.bindM); F.body.castShadow = true; F.body.receiveShadow = false; F.body.frustumCulled = false;
  F.skinMat = skinM;
  { const hm = paint(new THREE.MeshBasicMaterial({ color: srgb(INK), side: THREE.BackSide, skinning: true }), { regions: true, grain: 0 }); hm.userData.u.uHide = skinM.userData.u.uHide; ink(F.body, INK_W, F, hm); }

  // The seat's spots: the vertex on the back of the seat nearest each, for aiming at and marking.
  F.spot = {};
  {
    const p = bodyGeo.attributes.position, n = bodyGeo.attributes.normal, reg = bodyGeo.attributes.region;
    for (const k of SPOTS) {
      const area = k.slice(0, -1), sd = k.slice(-1) === 'L' ? 1 : -1, tx = (area === 'thighs' ? 0.088 : 0.078) * sd, ty = SPOT_AT[area];
      let best = -1, bd = 1e9;
      for (let i = 0; i < p.count; i++) {
        if (n.getZ(i) > -0.55) continue; const r = reg.getX(i); if (r !== R.SEAT && r !== R.HIPS && r !== R.THIGH) continue;
        const d = (p.getX(i) - tx) ** 2 + (p.getY(i) - ty) ** 2; if (d < bd) { bd = d; best = i; }
      }
      F.spot[k] = { i: best, bind: new V3(p.getX(best), p.getY(best), p.getZ(best)), mark: 0 };
    }
  }
  const _a = new V3(), _b = new V3();
  // A spot's place and outward normal in the world, as the body is posed now (and lifted off the skin by `lift`, for cloth over it).
  F.surface = (k, out, lift) => {
    const sp = F.spot[k], g = F.body.geometry, i = sp.i;
    F.body.boneTransform(i, _a); _a.applyMatrix4(F.body.matrixWorld);
    // (the normal: from where a point a little way out along the rest normal goes)
    const nx = g.attributes.normal.getX(i), ny = g.attributes.normal.getY(i), nz = g.attributes.normal.getZ(i);
    const pos = g.attributes.position, sx = pos.getX(i), sy = pos.getY(i), sz = pos.getZ(i);
    pos.setXYZ(i, sx + nx * 0.05, sy + ny * 0.05, sz + nz * 0.05);
    F.body.boneTransform(i, _b); _b.applyMatrix4(F.body.matrixWorld); pos.setXYZ(i, sx, sy, sz);
    out = out || { p: new V3(), n: new V3() };
    out.n.copy(_b).sub(_a).normalize(); out.p.copy(_a).addScaledVector(out.n, (lift || 0) * F.root.scale.x);
    return out;
  };
  F.mark = (k, amt) => { const sp = F.spot[k]; sp.mark = clamp(sp.mark + amt, 0, 1); syncMarks(); };
  F.clearMarks = () => { for (const k of SPOTS) F.spot[k].mark = 0; syncMarks(); };
  function syncMarks() {
    SPOTS.forEach((k, i) => { const sp = F.spot[k]; F.skinMat.userData.u.uMarks.value[i].set(sp.bind.x, sp.bind.y, sp.bind.z, sp.mark); });
    if (F.underMat) SPOTS.forEach((k, i) => { const sp = F.spot[k]; F.underMat.userData.u.uMarks.value[i].set(sp.bind.x, sp.bind.y, sp.bind.z, sp.mark * 0.25); });
  }
  syncMarks();

  // ── Head, face and hair ──
  buildHead(F, spec, S);
  // ── Boots ──
  for (const sd of [1, -1]) buildBoot(F, spec, sd, BI, w);

  // ── Clothes ──
  F.clothes = {};
  F.state = { top: 'down', bottoms: 'up', under: 'up' };
  F.setClothes = st => { Object.assign(F.state, st || {}); dress(F, spec, S, BI, w, torsoW, legW, armW); };
  F.setClothes();
  F.setOutfit = (outfit, dept) => { spec.outfit = outfit; if (dept) spec.dept = dept; F.setClothes(); };

  // ── Expression and life ──
  F.expr = flatExpr('calm'); F.exprTo = flatExpr('calm'); F.exprName = 'calm'; F.drawn = {};
  F.setExpr = name => { if (EXPRS[name]) { F.exprTo = flatExpr(name); F.exprName = name; } };
  F.t = Math.random() * 10; F.blink = 2 + Math.random() * 3; F.breath = 0.3; F.gaze = new V3(0, 0, 1);
  F.tick = dt => tickFace(F, dt);
  F.rest0 = {}; for (const b of F.bones) F.rest0[b.name] = b.position.clone();
  F.resetPose = () => { for (const b of F.bones) { b.rotation.set(0, 0, 0); b.position.copy(F.rest0[b.name]); } };
  return F;
}

// A hand: the palm, the four fingers together as one shaped block (they curl as one), and the thumb.
function handGeo(BB, S, sd, BI, w) {
  const s = sd > 0 ? 'L' : 'R', L = S.limb * (S.f ? 0.94 : 1), sx = ((S.f ? 0.175 : 0.195) + 0.02) * sd, z0 = -0.002;
  const hw = P => { const y = P[1]; const fg = ss(0.80, 0.78, y); return [w('hand' + s, 1 - fg), w('fingers' + s, fg)]; };
  const palm = [[0.885, 0.02, 0.028], [0.86, 0.023, 0.04], [0.83, 0.022, 0.046], [0.80, 0.02, 0.046], [0.78, 0.017, 0.044], [0.74, 0.015, 0.04], [0.71, 0.012, 0.033], [0.695, 0.008, 0.02]];
  BB.sweep(palm.map(([y, rx, rz]) => ({ c: [sx, 0.88 - (0.88 - y) * L, z0], rx: rx * L, zF: rz * L, zB: rz * L, p: 3 })), 14, { weights: hw, region: () => R.HAND, capTop: true, capBottom: false, flip: true });
  // thumb: from the heel of the palm, forward and down
  const tw = P => [w('thumb' + s, ss(0.86, 0.83, P[1])), w('hand' + s, 1 - ss(0.86, 0.83, P[1]))];
  const th = [[0.87, 0.012, 0.01], [0.845, 0.011, 0.034], [0.815, 0.009, 0.05], [0.795, 0.006, 0.056]];
  BB.sweep(th.map(([y, r, zz]) => ({ c: [sx - 0.008 * sd, y, z0 + zz * L], rx: r * L, zF: r * L, zB: r * L })), 10, { weights: tw, region: () => R.HAND, capTop: true, capBottom: true, flip: true });
}

function buildBoot(F, spec, sd, BI, w) {
  const s = sd > 0 ? 'L' : 'R', BB = Builder(), x = (spec.sex === 'f' ? 0.095 : 0.09) * sd - 0.005 * sd, k = spec.sex === 'f' ? 0.93 : 1;
  const bw = P => { const t = ss(0.095, 0.13, P[2] / k); return [w('foot' + s, 1 - t), w('toe' + s, t)]; };
  // the shaft, round the ankle
  BB.sweep([[0.0, 0.04], [0.06, 0.042], [0.12, 0.04], [0.19, 0.041]].map(([y, r]) => ({ c: [x, y, -0.01], rx: r, zF: r * 1.05, zB: r * 1.05 })), 18,
    { weights: () => [w('foot' + s, 1)], capBottom: false, capTop: false });
  // the foot: rings from heel to toe, flat underneath
  const rows = [[-0.07, 0.02, 0.03], [-0.05, 0.036, 0.05], [0.0, 0.042, 0.06], [0.05, 0.045, 0.052], [0.10, 0.048, 0.042], [0.14, 0.046, 0.034], [0.18, 0.04, 0.026], [0.205, 0.028, 0.018], [0.215, 0.012, 0.01]];
  const pos = [], idx = [], seg = 16;
  const base = BB.pos.length / 3;
  rows.forEach(([z, hwid, hh], i) => {
    for (let j = 0; j <= seg; j++) {
      const th = (j / seg) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), up = sn > 0;
      const P = [x + c * hwid * k, Math.max(0, 0.005 + (up ? sn * hh * 1.0 : sn * 0.01)) + (up ? 0.012 : 0), z * k + 0.01];
      P[1] = Math.max(P[1], 0.0);
      BB.vert(P, [0, 0, 0], [j / seg, i / rows.length], { weights: bw });
    }
  });
  const n = seg + 1;
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = base + i * n + j, b = a + 1, c = a + n, d = c + 1; BB.idx.push(a, b, c, b, d, c);
  }
  const g = BB.geometry(), col = spec.outfit === 'offduty' ? '#4a3424' : '#1e2024';
  const m = new THREE.SkinnedMesh(g, tmat(col, { skin: true, rim: '#3a4048', rimK: 0.4 }));
  F.root.add(m); m.bind(F.skeleton, F.bindM); m.castShadow = true; m.frustumCulled = false; F['boot' + s] = m; ink(m, INK_W, F);
}

// ── Clothes, from the same rings, out a little from the skin ─────────────────────────────────────────────────────────────────────────────────
const OUTFITS = {
  // Uniform: Meridian's own duty jacket: slate blue, hip length, closing on a diagonal from the right collarbone to the left hip (a light seam
  // along the edge), a low stand collar in the same cloth, a webbing belt; the department's colour only as a flash on the left shoulder and a
  // band at each cuff. Charcoal trousers with stitched knee panels, black boots.
  uniform: { tunic: '#3e5262', trousers: '#2a2e34', pipe: null, under: '#4a4e56', sleeves: 'long', hem: 0.86, collar: true, edge: '#c8c0ae', belt: '#1e2226' },
  // Off duty: a worn henley with the sleeves pushed up, canvas trousers with braces, brown boots (frontier-practical).
  offduty: { tunic: '#8a5a3c', trousers: '#5a4a38', pipe: '#3a2a1e', under: '#cfc6b4', sleeves: 'rolled', hem: 0.86, collar: false },
};
function dress(F, spec, S, BI, w, torsoW, legW, armW) {
  for (const k in F.clothes) { const m = F.clothes[k]; for (const x of [m, m.userData.hull]) if (x) { x.parent.remove(x); x.geometry.dispose(); } }
  F.clothes = {};
  const O = OUTFITS[spec.outfit] || OUTFITS.uniform, st = F.state;
  const add = (key, BB, m) => { const sm = new THREE.SkinnedMesh(BB.geometry(), m); F.root.add(sm); sm.bind(F.skeleton, F.bindM); sm.castShadow = true; sm.receiveShadow = false; sm.frustumCulled = false; F.clothes[key] = sm; ink(sm, INK_W, F); return sm; };
  let hide = 0; const H = r => { hide |= 1 << r; };

  // The top: the tunic (or shirt), hem down over the hips, or raised and rolled above the waist.
  {
    const BB = Builder(), dept = srgb(spec.dept), main = srgb(O.tunic), dark = srgb(shade(O.tunic, -0.25));
    const hem = st.top === 'up' ? 1.05 : O.hem, inf = 0.012;
    const rings = torsoRings(S, inf, true).filter(r => r.c[1] >= hem - 0.03);
    rings[0].c[1] = hem; if (st.top !== 'up') { rings[0].rx += 0.008; rings[0].zB += 0.012; rings[0].zF += 0.006; }
    // a rolled band where it's raised
    if (st.top === 'up') { const r0 = rings[0]; rings.unshift({ c: [0, hem - 0.012, r0.c[2]], rx: r0.rx + 0.012, zF: r0.zF + 0.012, zB: r0.zB + 0.012, p: 2.2 }); }
    const top = rings[rings.length - 1]; top.c[1] = O.collar ? 1.545 : 1.50; top.rx = O.collar ? 0.062 : 0.075; top.zF = O.collar ? 0.058 : 0.07; top.zB = O.collar ? 0.062 : 0.068;
    const tcol = P => {
      const [x, y, z] = P;
      if (spec.outfit === 'uniform') {
        const edge = srgb(O.edge), belt = srgb(O.belt);
        // the closure: a line from the right collarbone (−x, high) down to the left hip (+x, low), on the front
        const lx = lerp(-0.07, 0.13, clamp((1.47 - y) / (1.47 - 0.9), 0, 1));
        if (z > 0.02 && y < 1.48 && y > hem + 0.01 && Math.abs(x - lx) < 0.006) return [edge.r, edge.g, edge.b];
        if (z > 0.02 && y < 1.48 && x < lx && x > lx - 0.03) return [dark.r, dark.g, dark.b];            // the overlap's shadow
        if (y > 0.995 && y < 1.035) return [belt.r, belt.g, belt.b];                                     // the belt
        if (O.collar && y > 1.515) return [dark.r, dark.g, dark.b];                                        // the collar's edge
        if (st.top !== 'up' && y < hem + 0.012) return [dark.r, dark.g, dark.b];
      } else {
        if (z > 0.05 && Math.abs(x) < 0.012 && y > 1.32) return [dark.r, dark.g, dark.b];                  // the henley placket
      }
      return [main.r, main.g, main.b];
    };
    BB.sweep(rings, 36, { weights: torsoW, color: tcol });
    const sleeveTo = O.sleeves === 'long' ? 0.885 : 1.03;
    for (const sd of [1, -1]) {
      const ar = armRings(S, sd, 0.01, sleeveTo); ar[ar.length - 1].c[1] = sleeveTo;
      if (O.sleeves === 'rolled') { const r = ar[ar.length - 1]; ar.push({ c: [r.c[0], sleeveTo - 0.02, r.c[2]], rx: r.rx + 0.008, zF: r.zF + 0.008, zB: r.zB + 0.008 }); ar[ar.length - 2].rx += 0.01; ar[ar.length - 2].zF += 0.01; ar[ar.length - 2].zB += 0.01; }
      const flash = P => sd > 0 && P[1] > 1.28 && P[1] < 1.37 && P[0] * sd > (S.f ? 0.175 : 0.195) + 0.02;
      BB.sweep(ar, 18, { weights: armW, capBottom: true, flip: true, color: P => spec.outfit === 'uniform' && (flash(P) || (P[1] < 0.915 && P[1] > 0.895)) ? [dept.r, dept.g, dept.b] : spec.outfit === 'uniform' ? [main.r, main.g, main.b] : tcol([P[0] * 0.5, P[1], P[2]]) });
    }
    add('top', BB, tmat('#ffffff', { skin: true, vc: true, side: THREE.DoubleSide, rim: '#2a3440', rimK: 0.6 }));
    H(R.CHEST); H(R.UPARM); if (O.sleeves === 'long') H(R.FOREARM); if (st.top !== 'up') { H(R.WAIST); }
  }
  // The trousers: up to the waist, or lowered and bunched at the knees.
  {
    const BB = Builder(), main = srgb(O.trousers), pipe = srgb(O.pipe || spec.dept), inf = 0.009;
    const pipeOn = (P, sd) => { const lx = (S.f ? 0.095 : 0.09) * sd; const a = Math.atan2(P[2], P[0] - lx); return Math.abs(angDiff(a, sd > 0 ? 0 : Math.PI)) < 0.09; };
    const knee = srgb(shade(O.trousers, -0.18)), seam = srgb(shade(O.trousers, 0.25));
    const tc = sd => P => {
      if (O.pipe && P[1] < 0.9 && pipeOn(P, sd)) return [pipe.r, pipe.g, pipe.b];
      if (spec.outfit === 'uniform' && P[2] > 0.02 && P[1] > 0.4 && P[1] < 0.6) return (Math.abs(P[1] - 0.4) < 0.006 || Math.abs(P[1] - 0.6) < 0.006) ? [seam.r, seam.g, seam.b] : [knee.r, knee.g, knee.b];
      return [main.r, main.g, main.b];
    };
    if (st.bottoms !== 'down') {
      const waist = 1.035, rings = torsoRings(S, inf, true).filter(r => r.c[1] <= waist + 0.06 && r.c[1] >= 0.79);
      rings[rings.length - 1].c[1] = waist;
      BB.sweep(rings, 36, { weights: torsoW, color: tc(1), capBottom: true });
      for (const sd of [1, -1]) {
        const lr = legRings(S, sd, inf + 0.004, 0.0, -0.82).map(r => (r.c[1] < 0.2 ? Object.assign(r, { rx: r.rx + 0.012, zF: r.zF + 0.014, zB: r.zB + 0.012 }) : r));
        lr[lr.length - 1].c[1] = 0.12;
        BB.sweep(lr, 22, { weights: legW, color: tc(sd), flip: true });
      }
      // the waistband (and the braces, off duty)
      add('bottoms', BB, tmat('#ffffff', { skin: true, vc: true, side: THREE.DoubleSide, rim: '#2a3440', rimK: 0.6 }));
      H(R.HIPS); H(R.SEAT); H(R.THIGH); H(R.KNEE); H(R.SHIN);
    } else {
      // lowered: the waistband round the knees, the cloth gathered in rolls above the boots, a sag of cloth between the legs
      for (const sd of [1, -1]) {
        const lr = legRings(S, sd, inf, -0.38, -0.82).map(r => {
          const y = r.c[1], bunch = ss(0.58, 0.46, y) * ss(0.30, 0.42, y), wob = Math.sin(y * 160) * 0.006 * bunch;
          return Object.assign(r, { rx: r.rx + 0.03 * bunch + wob + (y < 0.2 ? 0.012 : 0.006), zF: r.zF + 0.026 * bunch + wob + 0.006, zB: r.zB + 0.03 * bunch + wob + 0.008 });
        });
        lr[0].c[1] = 0.555; lr[lr.length - 1].c[1] = 0.12;
        lr.unshift({ c: [lr[0].c[0], 0.565, lr[0].c[2]], rx: lr[0].rx - 0.006, zF: lr[0].zF - 0.006, zB: lr[0].zB - 0.006 });
        BB.sweep(lr, 22, { weights: legW, color: tc(sd), flip: true });
      }
      sag(BB, S, 0.545, 0.47, 0.06, legW, main, inf + 0.03);
      add('bottoms', BB, tmat('#ffffff', { skin: true, vc: true, side: THREE.DoubleSide, rim: '#2a3440', rimK: 0.6 }));
      H(R.SHIN);
    }
  }
  // Underwear: briefs (fuller-cut trunks for the men), up, or lowered round the thighs.
  {
    const BB = Builder(), inf = 0.004, col = O.under;
    if (st.under !== 'down') {
      const top = S.f ? 0.965 : 0.985, rings = torsoRings(S, inf, true).filter(r => r.c[1] <= top + 0.06 && r.c[1] >= 0.79);
      rings[rings.length - 1].c[1] = top;
      BB.sweep(rings, 36, { weights: torsoW, capBottom: true });
      const legTo = S.f ? -0.05 : -0.11;
      for (const sd of [1, -1]) { const lr = legRings(S, sd, inf + 0.002, 0.0, legTo - 0.01); lr[lr.length - 1].c[1] = 0.9 + legTo; BB.sweep(lr, 22, { weights: legW, flip: true }); }
      H(R.SEAT);
    } else {
      for (const sd of [1, -1]) {
        const lr = legRings(S, sd, inf + 0.004, -0.18, -0.30);
        lr.forEach(r => { r.rx += 0.004; r.zF += 0.004; r.zB += 0.004; });
        lr[0].c[1] = 0.70; lr[lr.length - 1].c[1] = 0.655;
        BB.sweep(lr, 22, { weights: legW, flip: true });
      }
      sag(BB, S, 0.70, 0.665, 0.03, legW, null, inf + 0.01);
    }
    F.underMat = tmat(col, { skin: true, side: THREE.DoubleSide, marks: true, bindAttr: true, unique: true, markCol: shade(col, -0.2), rim: '#2a3440', rimK: 0.5 });
    add('under', BB, F.underMat);
  }
  F.skinMat.userData.u.uHide.value = hide;
}
// A band of cloth hanging between the two legs (lowered trousers or briefs), from y0 down to y1, sagging by `drop`.
function sag(BB, S, y0, y1, drop, legW, col, inf) {
  const hx = S.f ? 0.095 : 0.09, nx = 10, ny = 4, base = BB.pos.length / 3;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny, x = lerp(hx - 0.04, -(hx - 0.04), u), mid = Math.sin(u * Math.PI);
    const y = lerp(y0, y1, v) - drop * mid * (0.5 + 0.5 * v), z = -0.02 - inf - 0.02 * mid;
    const P = [x, y, z];
    BB.vert(P, [0, 0, 0], [u, v], { weights: Q => { const a = legW([hx, Q[1]]), b = legW([-hx, Q[1]]); return a.map(e => [e[0], e[1] * (1 - u)]).concat(b.map(e => [e[0], e[1] * u])); },
      color: col ? () => [col.r, col.g, col.b] : null });
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = base + j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; BB.idx.push(a, b, c, b, d, c); }
}

// ── The head ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Redlessons' toon head (js/toon.js), built in its own units (about 0.056 m each, times the head scale): the cranium a ball sitting back a little,
// the face hung in front of it, its planes turning at the cheekbones, a jaw that angles down and forward and tapers to a squared chin. Each slice is
// a rounded box (a superellipse). The face's features are painted onto a thin layer over its surface, and redrawn as the expression changes, so
// everything morphs smoothly. HEAD_K: metres per head unit at head scale 1. HEAD_SCALE: the toon lean (1 = real proportions; redlessons used 1.34).
const HEAD_K = 0.056, HEAD_SCALE = 1.12;
const FACE = { eyeX: 0.66, eyeY: 0, eyeW: 0.95, eyeH: 1, iris: 1, jaw: 0.88, browY: 0.4, noseY: -0.4, noseSize: 1, mouthY: 0.1, mouthSize: 1.15, blushSize: 1, earSize: 1.1 };
const HEADK = [
  [2.12, 0.05, 0.1, 0.1, 2, 2], [1.95, 0.95, 0.9, 1.04, 2, 2], [1.55, 1.36, 1.38, 1.5, 2.05, 2], [0.95, 1.55, 1.64, 1.72, 2.3, 2.05],
  [0.25, 1.57, 1.74, 1.72, 2.8, 2.15], [-0.35, 1.53, 1.73, 1.55, 3.0, 2.4], [-0.95, 1.42, 1.66, 0.95, 3.1, 2.6], [-1.45, 1.18, 1.56, 0.35, 3.0, 2.6],
  [-1.85, 0.84, 1.44, -0.25, 2.9, 2.6], [-2.08, 0.5, 1.33, -0.72, 2.7, 2.5], [-2.2, 0.28, 1.2, -0.9, 2.5, 2.4], [-2.24, 0.03, 1.04, -0.88, 2.2, 2.2],
];
function headShape(jaw) {
  const R = HEADK.map(([y, w, f, b, nf, nb]) => [y < 0 ? y * 0.88 : y, w * (y < 0 ? lerp(1, jaw, ss(-0.1, -1.4, y)) : 1), f, b, nf, nb]);
  const at = y => {
    const n = R.length; y = clamp(y, R[n - 1][0], R[0][0]); let i = 0; while (i < n - 2 && y < R[i + 1][0]) i++;
    const a = R[i], b = R[i + 1], t = (y - a[0]) / (b[0] - a[0]), h = b[0] - a[0], out = [];
    for (let k = 1; k < 6; k++) {
      const sl = j => { const p = R[Math.max(0, j - 1)], q = R[Math.min(n - 1, j + 1)]; return (q[k] - p[k]) / (q[0] - p[0]); };
      const t2 = t * t, t3 = t2 * t; out.push((2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * h * sl(i) + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * h * sl(i + 1));
    }
    return { w: Math.max(0.01, out[0]), f: out[1], b: out[2], nf: out[3], nb: out[4] };
  };
  const pw = (c, n) => Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
  // u round from the back through the front (seam down the back), v crown to chin
  const point = (u, v, out) => { const y = lerp(R[0][0], R[R.length - 1][0], (1 - Math.cos(Math.PI * v)) / 2), H = at(y), a = (u - 0.5) * 2 * Math.PI, c = Math.cos(a), sn = Math.sin(a), n = c > 0 ? H.nf : H.nb;
    const zc = (H.f - H.b) / 2, dz = (H.f + H.b) / 2; return (out || new V3()).set(H.w * pw(sn, n), y, zc + dz * pw(c, n)); };
  const faceZ = (x, y) => { const H = at(y), zc = (H.f - H.b) / 2, dz = (H.f + H.b) / 2, q = Math.abs(x) / H.w; return q >= 1 ? zc : zc + dz * Math.pow(1 - Math.pow(q, H.nf), 1 / H.nf); };
  return { R, at, point, faceZ, top: R[0][0], chin: R[R.length - 1][0] };
}
function surfaceGeo(fn, NU, NV) {
  const pos = [], uv = [], idx = [], p = new V3();
  for (let v = 0; v <= NV; v++) for (let u = 0; u <= NU; u++) { fn(u / NU, v / NV, p); pos.push(p.x, p.y, p.z); uv.push(u / NU, 1 - v / NV); }
  for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) { const a = v * (NU + 1) + u, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); weldSeams(g); return g;
}
function buildHead(F, spec, S) {
  const K = FACE, HS = HEAD_SCALE, k = HEAD_K * (spec.headScale || HS), Hs = headShape(K.jaw * (S.f ? 1 : 1.06));
  const H = new THREE.Group(); H.scale.setScalar(k); H.position.set(0, -0.012 - Hs.chin * k * 0.92, 0.012); F.bone.head.add(H); F.head = H;
  const P = { skin: spec.skin, lips: spec.lips || shade(spec.skin, S.f ? -0.22 : -0.12), eyes: spec.eyes, hair: spec.hair, hairDk: shade(spec.hair, -0.35), beard: shade(spec.hair, -0.2) };
  const MAN = !S.f, OLD = (spec.age || 0) >= 45;
  const skinM = tmat(spec.skin, { rim: '#6a5048', rimK: 0.5 });
  const head = new THREE.Mesh(surfaceGeo(Hs.point, 40, 40), skinM); head.castShadow = true; H.add(head); ink(head, 0.06);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skinM); e.scale.set(0.24 * K.earSize, 0.44 * K.earSize, 0.34 * K.earSize); e.position.set(sx * (Hs.at(0).w - 0.04), 0, -0.1); H.add(e); ink(e, 0.05); }
  { const N = K.noseSize, g = new THREE.SphereGeometry(1, 16, 12); g.scale(0.15 * N, 0.36 * N, 0.17 * N); const n = new THREE.Mesh(g, skinM); n.position.set(0, K.noseY + 0.08 * N, Hs.faceZ(0, K.noseY) - 0.07); n.rotation.x = -0.42; H.add(n); }
  // The face layer and its canvas
  const FX0 = -1.62, FX1 = 1.62, FY0 = -2.05, FY1 = 1.45, FW = 512, FH = Math.round(FW * (FY1 - FY0) / (FX1 - FX0));
  const fcan = document.createElement('canvas'); fcan.width = FW; fcan.height = FH; const fx = fcan.getContext('2d');
  const ftex = new THREE.CanvasTexture(fcan); ftex.encoding = THREE.sRGBEncoding; ftex.anisotropy = 4;
  { const NX = 40, NY = 44, pos = [], uv = [], idx = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const x = lerp(FX0, FX1, i / NX), y = lerp(FY0, FY1, j / NY); pos.push(x, y, Hs.faceZ(x, y) + 0.012); uv.push(i / NX, j / NY); }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 2, d = a + NX + 1; idx.push(a, b, c, a, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: ftex, transparent: true, alphaTest: 0.02, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false }));
    m.renderOrder = 2; H.add(m); F.faceLayer = m; }
  const px = x => (x - FX0) / (FX1 - FX0) * FW, py = y => (FY1 - y) / (FY1 - FY0) * FH, U = FW / (FX1 - FX0);
  const INKC = '#2a1612', lipsDk = shade(P.lips, -0.4);
  function drawEye(sx, E, open) {
    const cx = sx * K.eyeX, cy = K.eyeY, rx = 0.43 * K.eyeW, ry = 0.3 * K.eyeH, shut = clamp(1 - open, 0, 1), drop = 2 * ry * shut, pt = (x, y) => [px(cx + x), py(cy + y)];
    const ell_ = (x, y, a, b) => { fx.beginPath(); fx.ellipse(px(cx + x), py(cy + y), a * U, b * U, 0, 0, 7); };
    if (shut < 0.85 && !((E.sq || 0) > 0.5 && shut > 0.6)) {
      fx.save(); ell_(0, 0, rx, ry); fx.clip();
      fx.beginPath(); fx.ellipse(px(cx), py(cy - drop), rx * U, ry * U, 0, Math.PI, 2 * Math.PI); fx.lineTo(...pt(rx, -ry - 2)); fx.lineTo(...pt(-rx, -ry - 2)); fx.closePath(); fx.clip();
      ell_(0, 0, rx, ry); fx.fillStyle = '#fffaf2'; fx.fill();
      const ix = (E.look || 0) * 0.06 * sx * sx, ki = K.iris;
      fx.fillStyle = P.eyes; ell_(ix, 0, 0.22 * ki, 0.27 * ki); fx.fill();
      fx.fillStyle = shade(P.eyes, -0.4); ell_(ix, 0.11 * ki, 0.19 * ki, 0.11 * ki); fx.fill();
      fx.fillStyle = '#1c1210'; ell_(ix, 0, 0.09 * ki, 0.11 * ki); fx.fill();
      fx.fillStyle = '#ffffff'; ell_(ix + 0.07 * ki, 0.09 * ki, 0.06 * ki, 0.06 * ki); fx.fill();
      fx.restore();
    }
    const ly = -0.5 * shut * K.eyeH, ar = 0.4 * K.eyeW, br = 0.4 * 0.72 * K.eyeH;
    fx.strokeStyle = INKC; fx.lineCap = 'round'; fx.lineWidth = (MAN ? 0.065 : 0.1) * U;
    const sq = (E.sq || 0) > 0.5 && shut > 0.6;
    fx.beginPath(); if (sq) fx.ellipse(px(cx), py(cy + ly + 0.62 * br), ar * U, br * 0.7 * U, 0, 0.2, Math.PI - 0.2); else fx.ellipse(px(cx), py(cy + ly), ar * U, br * U, 0, Math.PI + 0.15, 2 * Math.PI - 0.15); fx.stroke();
    if (MAN) return;
    const wx = sx * 0.42 * K.eyeW, wy = (sq ? 0.05 - 0.5 * shut : 0.13 - 0.55 * shut) * K.eyeH, wl = 0.11 * K.eyeW, wa = sx * (sq ? -0.5 : 0.45);
    fx.lineWidth = 0.07 * U; fx.beginPath(); fx.moveTo(...pt(wx - Math.cos(wa) * wl, wy - Math.sin(wa) * wl)); fx.lineTo(...pt(wx + Math.cos(wa) * wl, wy + Math.sin(wa) * wl)); fx.stroke();
  }
  function drawBrow(sx, E) {
    const by = K.browY + E.browY, inX = sx * (K.eyeX - 0.3 * K.eyeW), outX = sx * (K.eyeX + 0.42 * K.eyeW), inY = by + E.brow * 0.3, outY = by - 0.06 - E.brow * 0.08;
    fx.strokeStyle = P.hairDk; fx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6, at = t => [lerp(inX, outX, t), lerp(inY, outY, t) + 0.09 * Math.sin(Math.PI * t)];
      const [x0, y0] = at(t0), [x1, y1] = at(t1); fx.lineWidth = lerp(0.105, 0.045, t1) * U * (MAN ? 1.55 : 1); fx.beginPath(); fx.moveTo(px(x0), py(y0)); fx.lineTo(px(x1), py(y1)); fx.stroke(); }
  }
  function drawMouth(E) {
    const s_ = E.ms * K.mouthSize, w = E.mw * s_, cy = -1.2 + K.mouthY, c = E.mc, o = E.mo * s_, l = -w / 2, r = w / 2, cornerY = cy + c * 0.12;
    const upMid = cy + 0.02 - c * 0.04, loMid = cy - o * 0.32 - c * 0.04 - 0.01;
    if (o > 0.03) {
      fx.beginPath(); fx.moveTo(px(l), py(cornerY)); fx.quadraticCurveTo(px(0), py(upMid + (upMid - cornerY)), px(r), py(cornerY)); fx.quadraticCurveTo(px(0), py(loMid + (loMid - cornerY)), px(l), py(cornerY));
      fx.fillStyle = '#6a2026'; fx.fill();
      if (E.mt > 0.02) { fx.save(); fx.clip(); fx.fillStyle = '#fbf6ee'; const th = lerp(0.07, 0.5, E.mt) * Math.max(0.05, o * 0.32 + 0.02); fx.fillRect(px(l), py(upMid + 0.05), w * U, (th + 0.05) * U); if (E.mt > 0.7) fx.fillRect(px(l), py(loMid + 0.02 + th * 0.4), w * U, th * 0.5 * U); fx.restore(); }
      fx.strokeStyle = lipsDk; fx.lineWidth = 0.035 * U; fx.stroke();
      fx.fillStyle = P.lips; fx.globalAlpha = 0.85; fx.beginPath(); fx.ellipse(px(0), py(loMid - 0.035), w * 0.28 * U, 0.04 * U, 0, 0, 7); fx.fill(); fx.globalAlpha = 1;
    } else {
      fx.strokeStyle = lipsDk; fx.lineCap = 'round'; fx.lineWidth = 0.045 * U;
      fx.beginPath(); fx.moveTo(px(l), py(cornerY)); fx.quadraticCurveTo(px(0), py(upMid + (upMid - cornerY)), px(r), py(cornerY)); fx.stroke();
      fx.fillStyle = P.lips; fx.globalAlpha = MAN ? 0.3 : 0.75; fx.beginPath(); fx.ellipse(px(0), py(cy - 0.08 - c * 0.03), w * 0.22 * U, 0.045 * U, 0, 0, 7); fx.fill(); fx.globalAlpha = 1;
    }
  }
  function paintFace(E, open) {
    fx.clearRect(0, 0, FW, FH);
    if (E.blush > 0.02) for (const sx of [-1, 1]) {
      const bx = px(sx * 0.98), byp = py(-0.42), r = 0.42 * K.blushSize * U, g = fx.createRadialGradient(bx, byp, 0, bx, byp, r);
      g.addColorStop(0, `rgba(240,120,120,${0.55 * E.blush})`); g.addColorStop(1, 'rgba(240,120,120,0)');
      fx.save(); fx.translate(bx, byp); fx.scale(1, 0.55); fx.translate(-bx, -byp); fx.fillStyle = g; fx.fillRect(bx - r, byp - r, 2 * r, 2 * r); fx.restore();
    }
    if (spec.beard) { fx.save(); fx.globalAlpha = 0.24; fx.fillStyle = P.beard; fx.beginPath(); fx.ellipse(px(0), py(-1.55), 1.35 * U, 0.75 * U, 0, 0, 7); fx.fill(); fx.beginPath(); fx.ellipse(px(0), py(K.noseY - 0.42), 0.55 * U, 0.16 * U, 0, 0, 7); fx.fill(); fx.restore(); }
    fx.strokeStyle = shade(P.skin, -0.3); fx.lineWidth = 0.035 * U; fx.lineCap = 'round'; fx.beginPath(); fx.arc(px(0.02), py(K.noseY - 0.12 * K.noseSize), 0.1 * K.noseSize * U, Math.PI * 0.15, Math.PI * 0.75); fx.stroke();
    if (E.tears > 0.05) for (const sx of [-1, 1]) {
      const x = sx * (K.eyeX - 0.05), y0 = K.eyeY - lerp(0.2, 0.4, clamp(1 - open, 0, 1)) * K.eyeH, len = 0.75 * E.tears;
      fx.strokeStyle = 'rgba(150,205,240,0.9)'; fx.lineWidth = 0.08 * U; fx.lineCap = 'round'; fx.beginPath(); fx.moveTo(px(x), py(y0)); fx.quadraticCurveTo(px(x + sx * 0.06), py(y0 - len * 0.5), px(x + sx * 0.02), py(y0 - len)); fx.stroke();
      fx.fillStyle = 'rgba(150,205,240,0.95)'; fx.beginPath(); fx.arc(px(x + sx * 0.02), py(y0 - len), 0.06 * U, 0, 7); fx.fill();
    }
    for (const sx of [-1, 1]) { drawEye(sx, E, open); drawBrow(sx, E); }
    if (OLD) {
      fx.strokeStyle = shade(P.skin, -0.15); fx.lineCap = 'round'; const sm = clamp(E.mc || 0, 0, 1);
      for (const sx of [-1, 1]) {
        fx.lineWidth = 0.04 * U; fx.beginPath(); fx.moveTo(px(sx * 0.42), py(K.noseY - 0.05)); fx.quadraticCurveTo(px(sx * (0.72 + 0.06 * sm)), py(-1.0 + K.mouthY), px(sx * (0.5 + 0.08 * sm)), py(-1.38 + K.mouthY)); fx.stroke();
        fx.lineWidth = 0.03 * U; const ex = sx * (K.eyeX + 0.5 * K.eyeW), ey = K.eyeY;
        for (const [dy, len] of [[0.1, 0.22], [-0.06, 0.26], [-0.22, 0.2]]) { fx.beginPath(); fx.moveTo(px(ex), py(ey + dy * 0.6)); fx.lineTo(px(ex + sx * len * (0.7 + 0.5 * sm)), py(ey + dy)); fx.stroke(); }
      }
    }
    drawMouth(E);
    ftex.needsUpdate = true;
  }
  F.paintFace = paintFace;
  buildHair(F, spec, S, H, Hs, k);
}
// Hair: a cap over the crown, its front edge drawn back to a hairline by tucking the points in front of it inside the head; then the style's shapes.
function buildHair(F, spec, S, H, Hs, k) {
  const style = spec.hairStyle; if (style === 'none') return;
  const hm = tmat(spec.hair, { rim: '#3a3a4a', rimK: 0.6 }), put = (geo, x, y, z, rot, sc) => { const m = new THREE.Mesh(geo, hm); m.position.set(x, y, z); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); if (sc) m.scale.set(sc[0], sc[1], sc[2]); m.castShadow = true; H.add(m); ink(m, 0.05); return m; };
  const bob = style === 'bob', vol = style === 'shaved' ? 0.97 : style === 'crop' ? 1.0 : 1.04;
  const cap = new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * (bob ? 0.8 : 0.64)); cap.scale(1.8 * vol, 2.2 * vol, 2.02 * vol);
  { const p = cap.attributes.position, q = new V3();
    for (let i = 0; i < p.count; i++) { q.fromBufferAttribute(p, i); const front = q.z / 2.02, line = lerp(0.15, 1.05, ss(0.25, 0.85, front)); if (front > 0.2 && q.y + 0.1 < line) { q.multiplyScalar(0.8); p.setXYZ(i, q.x, q.y, q.z); }
      if (bob && q.y < -0.2) { const fl = ss(-0.2, -1.6, q.y); q.x *= 1 + 0.12 * fl; q.z *= 1 + 0.08 * fl; p.setXYZ(i, q.x, q.y, q.z); } }
    cap.computeVertexNormals(); }
  const capM = put(cap, 0, 0.32, -0.16);
  if (style === 'shaved') { capM.material = tmat(shade(spec.hair, -0.1), { rim: '#3a3a4a', rimK: 0.4 }); }
  const sph = (r) => new THREE.SphereGeometry(r, 16, 12);
  if (style === 'bun') put(sph(0.62), 0, 1.75, -1.5, null, [1, 0.9, 0.85]);
  if (style === 'short' || style === 'crop') {      // chunky locks at the front and crown
    const n = style === 'short' ? 7 : 4, r = style === 'short' ? 0.42 : 0.3;
    for (let i = 0; i < n; i++) { const a = (i / (n - 1) - 0.5) * 2.0; put(sph(r), Math.sin(a) * 1.25, 1.62 - 0.12 * Math.abs(a), Math.cos(a) * 1.25 - 0.25, [0.3, a, 0], [1, 0.55, 1.3]); }
  }
  if (style === 'curls') for (let i = 0; i < 46; i++) {
    const th = i * 2.399, ph = Math.acos(1 - (i + 0.5) / 46 * 1.3); const d = new V3(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th));
    if (d.z > 0.45 && d.y < 0.55) continue; put(sph(0.36 + 0.08 * Math.sin(i)), d.x * 1.9, 0.32 + d.y * 2.25, -0.16 + d.z * 2.05);
  }
  if (style === 'ponytail') {
    const piv = new THREE.Group(); piv.position.set(0, 1.1, -1.95); H.add(piv);
    const pts = [new V3(0, 0, 0), new V3(0, -0.6, -0.5), new V3(0, -1.9, -0.45), new V3(0, -3.1, -0.15)];
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.42, 12, false), p = tube.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = -p.getY(i), s2 = lerp(1, 0.3, clamp(y / 3.1, 0, 1)) * (1 + 0.25 * Math.sin(clamp(y / 3.1, 0, 1) * Math.PI)); p.setX(i, p.getX(i) * s2); p.setZ(i, (p.getZ(i) + 0.35) * s2 - 0.35); }
    tube.computeVertexNormals();
    const tail = new THREE.Mesh(tube, hm); tail.castShadow = true; piv.add(tail); ink(tail, 0.05); F.tail = { piv };
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 16), tmat('#2a2a2a')); tie.rotation.x = 1.2; piv.add(tie);
  }
}

// ── Expressions (redlessons'): the mouth's shapes and each expression's brows, lids, gaze, mouth, blush and tears ──
const MOUTHS = { flat: { mw: 0.42, mc: 0.05, mo: 0, mt: 0 }, smile: { mw: 0.6, mc: 0.6, mo: 0.06, mt: 0.6 }, frown: { mw: 0.48, mc: -0.5, mo: 0, mt: 0 },
  open: { mw: 0.48, mc: -0.15, mo: 0.8, mt: 0.15 }, gritted: { mw: 0.68, mc: -0.8, mo: 0.3, mt: 1 }, pout: { mw: 0.26, mc: -0.2, mo: 0.1, mt: 0 },
  wail: { mw: 0.6, mc: -0.95, mo: 0.42, mt: 0.25 }, sad: { mw: 0.34, mc: -0.7, mo: 0.06, mt: 0 }, concern: { mw: 0.36, mc: -0.28, mo: 0, mt: 0 }, soft: { mw: 0.44, mc: 0.36, mo: 0, mt: 0 } };
const EXPRS = {
  calm: { brow: 0, browY: 0, open: 0.95, mouth: 'flat', blush: 0, ms: 1 }, smile: { brow: 0.1, browY: 0.08, open: 0.72, mouth: 'smile', blush: 0.35, ms: 1.3 },
  shy: { brow: 0.28, browY: 0.04, open: 0.55, look: -1, mouth: 'concern', blush: 1, ms: 0.8 }, cheeky: { brow: -0.22, browY: 0.12, open: 0.62, look: 1, mouth: 'smile', blush: 0.1, ms: 1.2 },
  defiant: { brow: -0.3, browY: 0.04, open: 0.7, look: 0.5, mouth: 'flat', blush: 0.1, ms: 0.95 },
  pout: { brow: 0.2, browY: -0.04, open: 0.8, look: -0.6, mouth: 'pout', blush: 0.5, ms: 1.35 }, stern: { brow: -0.42, browY: -0.1, open: 0.75, mouth: 'flat', blush: 0, ms: 0.9 },
  surprised: { brow: 0.3, browY: 0.2, open: 1.1, mouth: 'open', blush: 0.3, ms: 0.75 }, wince: { brow: 0.42, browY: 0.08, open: 0.4, mouth: 'frown', blush: 0.65, ms: 1.25 },
  gritted: { brow: 0.6, browY: 0.02, open: 0.1, mouth: 'gritted', blush: 0.9, ms: 1.2, sq: 1 }, crying: { brow: 0.9, browY: 0.02, open: 0.12, mouth: 'wail', blush: 1, tears: 1, ms: 1.45, sq: 1 },
  concerned: { brow: 0.38, browY: 0.06, open: 0.92, mouth: 'concern', blush: 0, ms: 0.95 }, sad: { brow: 0.75, browY: 0.0, open: 0.55, look: -0.4, mouth: 'sad', blush: 0.35, tears: 0.25, ms: 1.0 },
  wistful: { brow: 0.3, browY: 0.05, open: 0.58, mouth: 'soft', blush: 0.25, ms: 1.0 }, tender: { brow: 0.14, browY: 0.02, open: 0, mouth: 'soft', blush: 0.25, ms: 0.95 },
  teary: { brow: 0.38, browY: 0.04, open: 0.7, mouth: 'soft', blush: 0.6, tears: 0.6, ms: 1.0 }, soft: { brow: 0.12, browY: 0.03, open: 0.8, mouth: 'soft', blush: 0.1, ms: 1.0 },
};
const flatExpr = name => { const e = EXPRS[name] || EXPRS.calm, m = MOUTHS[e.mouth] || MOUTHS.flat; return Object.assign({ brow: 0, browY: 0, open: 0.95, look: 0, blush: 0, tears: 0, ms: 1, sq: 0 }, e, m); };
function tickFace(F, dt) {
  F.t += dt;
  const kk = 1 - Math.exp(-dt * 8), x = F.expr, to = F.exprTo;
  for (const key in to) if (typeof to[key] === 'number') x[key] = lerp(x[key] == null ? to[key] : x[key], to[key], kk);
  F.blink -= dt; let bl = 0; if (F.blink < 0) { bl = clamp(1 - Math.abs(F.blink + 0.07) / 0.07, 0, 1); if (F.blink < -0.14) F.blink = 2 + Math.random() * 4; }
  const open = clamp(x.open * (1 - bl), 0, 1.15), d = F.drawn;
  let moved = Math.abs((d.open == null ? -9 : d.open) - open) > 0.004;
  for (const key in x) if (!moved && Math.abs((d[key] == null ? -9 : d[key]) - x[key]) > 0.003) moved = true;
  if (moved) { F.paintFace(x, open); Object.assign(d, x); d.open = open; }
  F.breathT = (F.breathT || 0) + dt * (1.6 + 2.4 * F.breath);
  const b = Math.sin(F.breathT) * (0.012 + 0.02 * F.breath);
  F.bone.chest.scale.set(1 + b * 0.4, 1, 1 + b);
  if (F.tail) {
    const pv = F.tail.piv, q = new THREE.Quaternion(); pv.parent.getWorldQuaternion(q);
    const down = new V3(0, -1, 0).applyQuaternion(q.invert());
    const kx = 1 - Math.exp(-dt * 5); pv.rotation.x = lerp(pv.rotation.x, Math.atan2(-down.z, -down.y) * 0.85, kx); pv.rotation.z = lerp(pv.rotation.z, Math.atan2(down.x, -down.y) * 0.85, kx);
  }
}


// ── Posing helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
function setWorldQuat(obj, qw) { obj.parent.getWorldQuaternion(_q).invert(); obj.quaternion.copy(_q.multiply(qw)); }
// Two-bone IK: rotate `a` (the upper bone) and bend `b` (the middle joint) so that `c` (the end bone's origin) reaches W, the joint bending toward `pole`.
// bendSign: −1 for an elbow (forearm forward on a negative turn), +1 for a knee.
function ik2(F, a, b, c, W, pole, bendSign) {
  F.root.updateMatrixWorld(true);
  const sc = F.root.getWorldScale(new V3()).x, L1 = b.position.length() * sc, L2 = c.position.length() * sc;
  const A = a.getWorldPosition(new V3()), v = W.clone().sub(A), d = clamp(v.length(), Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.002), u = v.normalize();
  const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  let pp = pole.clone().addScaledVector(u, -pole.dot(u)); if (pp.lengthSq() < 1e-8) pp = new V3(0, 0, 1).addScaledVector(u, -u.z); pp.normalize();
  const J = A.clone().addScaledVector(u, L1 * cosA).addScaledVector(pp, L1 * sinA), E2 = A.clone().addScaledVector(u, d);
  const u1 = J.clone().sub(A).normalize(), f = E2.clone().sub(J).normalize();
  // the upper bone: its -y along u1; its +z toward the bend for an elbow (−1), away for a knee (+1)
  let Z = f.clone().addScaledVector(u1, -f.dot(u1)); if (Z.lengthSq() < 1e-8) Z = pp.clone(); Z.normalize(); if (bendSign > 0) Z.negate();
  const Y = u1.clone().negate(), X = new V3().crossVectors(Y, Z);
  setWorldQuat(a, new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(X, Y, Z)));
  b.rotation.set(bendSign * Math.acos(clamp(u1.dot(f), -1, 1)), 0, 0);
  F.root.updateMatrixWorld(true);
}
// Turn a bone so its local axes point the given world ways: X and Y (Y made perpendicular to X).
function aim(obj, X, Y) {
  const x = X.clone().normalize(), z = new V3().crossVectors(x, Y).normalize(), y = new V3().crossVectors(z, x);
  setWorldQuat(obj, new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z)));
}

const api = { tmat, ink, make, EXPRS, MOUTHS, HEAD_SCALE, OUTFITS, SPOTS, ik2, aim, setWorldQuat, mat, paint, srgb, shade, R };
root.Figure = api;
})(typeof window !== 'undefined' ? window : globalThis);
