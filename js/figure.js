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
{ float fr = 1.0 - abs(dot(normalize(vViewPosition), normal)); totalEmissiveRadiance += uRim * pow(fr, 2.5); }`);
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
    [1.44, 0.158 * sh, 0.07, 0.08, 0, 0, 0],
    [1.462, 0.12 * sh, 0.06, 0.068, 0, 0, 0],
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
  const skinM = mat(spec.skin, { skin: true, regions: true, marks: true, bindAttr: true, rough: 0.55, grain: 0, unique: true, rim: '#6a5048', rimK: 0.8 });
  F.body = new THREE.SkinnedMesh(bodyGeo, skinM);
  F.root.add(F.body); F.body.bind(F.skeleton); F.body.castShadow = true; F.body.receiveShadow = true; F.body.frustumCulled = false;
  F.skinMat = skinM;

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
  F.expr = Object.assign({}, EXPRS.calm); F.exprTo = EXPRS.calm; F.exprName = 'calm';
  F.setExpr = name => { if (EXPRS[name]) { F.exprTo = EXPRS[name]; F.exprName = name; } };
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
  const palm = [[0.885, 0.017, 0.026], [0.86, 0.019, 0.036], [0.83, 0.018, 0.042], [0.80, 0.016, 0.042], [0.78, 0.013, 0.04], [0.74, 0.011, 0.036], [0.71, 0.009, 0.03], [0.695, 0.006, 0.018]];
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
  const m = new THREE.SkinnedMesh(g, mat(col, { skin: true, rough: 0.55, grain: 0.06, side: THREE.DoubleSide }));
  F.root.add(m); m.bind(F.skeleton); m.castShadow = true; m.frustumCulled = false; F['boot' + s] = m;
}

// ── Clothes, from the same rings, out a little from the skin ─────────────────────────────────────────────────────────────────────────────────
const OUTFITS = {
  // Uniform: a fitted duty tunic in charcoal with the department's colour across the shoulders and a band at the collar, dark trousers with a piped
  // seam, black boots. (After the utopian-military uniforms of starship fiction; not any one of them.)
  uniform: { tunic: '#2a2f36', trousers: '#23272d', pipe: null, under: '#3a3e44', sleeves: 'long', hem: 0.855, collar: true },
  // Off duty: a worn henley with the sleeves pushed up, canvas trousers with braces, brown boots (frontier-practical).
  offduty: { tunic: '#8a5a3c', trousers: '#5a4a38', pipe: '#3a2a1e', under: '#cfc6b4', sleeves: 'rolled', hem: 0.86, collar: false },
};
function dress(F, spec, S, BI, w, torsoW, legW, armW) {
  for (const k in F.clothes) { const m = F.clothes[k]; m.parent.remove(m); m.geometry.dispose(); }
  F.clothes = {};
  const O = OUTFITS[spec.outfit] || OUTFITS.uniform, st = F.state;
  const add = (key, BB, m) => { const sm = new THREE.SkinnedMesh(BB.geometry(), m); F.root.add(sm); sm.bind(F.skeleton); sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false; F.clothes[key] = sm; return sm; };
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
        if (O.collar && y > 1.50) return [dept.r, dept.g, dept.b];                                         // the collar band
        if (y > 1.33 - 0.06 * Math.abs(x) * 3 && y > 1.27) return [dept.r, dept.g, dept.b];                // the shoulder yoke
        if (Math.abs(y - (1.33 - 0.06 * Math.abs(x) * 3)) < 0.008) return [dark.r, dark.g, dark.b];
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
      BB.sweep(ar, 18, { weights: armW, capBottom: true, flip: true, color: P => O.sleeves === 'long' && P[1] < 0.91 ? [dept.r, dept.g, dept.b] : tcol([P[0] * 0.5, P[1], P[2]]) });
    }
    add('top', BB, mat('#ffffff', { skin: true, vc: true, side: THREE.DoubleSide, rough: 0.82, grain: 0.09, scale: 90 }));
    H(R.CHEST); H(R.UPARM); if (O.sleeves === 'long') H(R.FOREARM); if (st.top !== 'up') { H(R.WAIST); }
  }
  // The trousers: up to the waist, or lowered and bunched at the knees.
  {
    const BB = Builder(), main = srgb(O.trousers), pipe = srgb(O.pipe || spec.dept), inf = 0.009;
    const pipeOn = (P, sd) => { const lx = (S.f ? 0.095 : 0.09) * sd; const a = Math.atan2(P[2], P[0] - lx); return Math.abs(angDiff(a, sd > 0 ? 0 : Math.PI)) < 0.09; };
    const tc = sd => P => (spec.outfit === 'uniform' && P[1] < 0.9 && pipeOn(P, sd)) ? [pipe.r, pipe.g, pipe.b] : [main.r, main.g, main.b];
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
      add('bottoms', BB, mat('#ffffff', { skin: true, vc: true, side: THREE.DoubleSide, rough: 0.85, grain: 0.1, scale: 80 }));
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
      add('bottoms', BB, mat('#ffffff', { skin: true, vc: true, side: THREE.DoubleSide, rough: 0.85, grain: 0.1, scale: 80 }));
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
    F.underMat = mat(col, { skin: true, side: THREE.DoubleSide, rough: 0.8, grain: 0.05, marks: true, bindAttr: true, unique: true, markCol: shade(col, -0.2) });
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
// A sculpted ellipsoid (skull, jaw, cheekbones, brow, nose, sockets), real eyes under moving lids, brows, and a mouth rebuilt as it changes.
function headPoint(d, S) {
  const f = S.f;
  let x = d.x * 0.077, y = d.y * (d.y < 0 ? 0.097 : 0.108), z = d.z * 0.096;
  const down = ss(-0.15, -0.95, d.y);
  x *= 1 - (f ? 0.36 : 0.28) * down;                                  // the jaw narrows to the chin
  if (d.y < -0.35 && Math.abs(d.x) > 0.4 && d.z > -0.2) x *= 1 + (f ? 0.02 : 0.06) * ss(-0.35, -0.6, d.y);   // the angle of the jaw
  if (d.y > -0.3 && d.y < 0.25 && d.z > 0.3) x *= 0.96;               // the temples in a little
  if (d.z > 0) z *= 1 - 0.1 * ss(0.5, 1, d.z);                         // the face flatter than the skull
  if (d.z < 0 && d.y > -0.3) z *= 1.06;                                // the back of the skull
  if (d.y < -0.55 && d.z > 0.2) z += 0.012 * ss(-0.55, -0.95, d.y) * d.z;   // the chin
  const bump = (cx, cy, cz, s, a) => a * Math.exp(-((d.x - cx) ** 2 + (d.y - cy) ** 2 + (d.z - cz) ** 2) / (2 * s * s));
  let r = 0;
  r += bump(0, -0.02, 1, 0.08, f ? 0.004 : 0.006) + bump(0, -0.16, 0.99, 0.085, f ? 0.009 : 0.012);   // the nose: a soft, simple shape
  r += bump(0, 0.1, 0.99, 0.08, 0.003);
  for (const sx of [-1, 1]) {
    r += bump(0.38 * sx, 0.1, 0.92, 0.13, -0.006);                   // the eye sockets
    r += bump(0.36 * sx, 0.27, 0.9, 0.14, f ? 0.002 : 0.0045);       // the brow
    r += bump(0.62 * sx, -0.08, 0.75, 0.16, 0.005);                   // the cheekbones
  }
  r += bump(0, -0.42, 0.92, 0.18, 0.004);                             // the mouth's fullness
  const p = new V3(x, y, z), L = p.length() || 1;
  return p.multiplyScalar((L + r) / L).add(new V3(0, 0.072, 0.008));
}
function buildHead(F, spec, S) {
  const H = new THREE.Group(); F.bone.head.add(H); F.head = H;
  const segU = 64, segV = 48, pos = [], col = [], idx = [], dirs = [];
  const skin = new THREE.Color(srgb(spec.skin)), beard = new THREE.Color(srgb(shade(spec.hair, -0.1)));
  for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) {
    const th = (i / segU) * Math.PI * 2, ph = (j / segV) * Math.PI;
    const d = new V3(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th));
    const P = headPoint(d, S); pos.push(P.x, P.y, P.z); dirs.push(d);
    col.push(skin.r, skin.g, skin.b);
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) { const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); weldSeams(g);
  const hm = mat('#ffffff', { vc: true, rough: 0.55, grain: 0, unique: true, rim: '#6a5048', rimK: 0.8 });
  const head = new THREE.Mesh(g, hm); head.castShadow = true; H.add(head); F.headMesh = head;
  // (what the face's colour is, per point, so a flush or a shadow of beard can be painted over it)
  F.faceTint = (flush) => {
    const c = g.attributes.color;
    for (let k = 0; k < dirs.length; k++) {
      const d = dirs[k]; let r = skin.r, gg = skin.g, b = skin.b;
      if (spec.beard) { const bd = ss(-0.05, -0.35, d.y) * ss(-0.1, 0.25, d.z) * (1 - 0.8 * Math.exp(-((d.x) ** 2 + (d.y + 0.45) ** 2) / 0.012)); r = lerp(r, beard.r, 0.55 * bd); gg = lerp(gg, beard.g, 0.55 * bd); b = lerp(b, beard.b, 0.55 * bd); }
      const ch = flush * (Math.exp(-((Math.abs(d.x) - 0.55) ** 2 + (d.y + 0.15) ** 2) / 0.05) * ss(0.2, 0.6, d.z) + 0.35 * Math.exp(-((d.x) ** 2 + (d.y + 0.1) ** 2) / 0.02) * ss(0.6, 1, d.z));
      r = lerp(r, r * 1.25 + 0.04, ch); gg = lerp(gg, gg * 0.72, ch); b = lerp(b, b * 0.72, ch);
      c.setXYZ(k, r, gg, b);
    }
    c.needsUpdate = true;
  };
  F.faceTint(0);
  // the surface's z in front, at (x, y)
  const frontZ = (x, y) => { let best = 0, bd = 1e9; for (let k = 0; k < pos.length; k += 3) { if (pos[k + 2] < 0.03) continue; const dd = (pos[k] - x) ** 2 + (pos[k + 1] - y) ** 2; if (dd < bd) { bd = dd; best = pos[k + 2]; } } return best; };
  // Ears
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mat(spec.skin, { rough: 0.6 })); e.scale.set(0.011, 0.028, 0.019); e.position.set(0.074 * sx, 0.07, -0.006); e.rotation.y = 0.3 * sx; H.add(e); }
  // Eyes
  const eyeR = 0.0142, eyeY = 0.092, eyeX = 0.0335;
  const irisTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
    c.fillStyle = '#ece6dc'; c.fillRect(0, 0, 128, 128);
    const gr = c.createRadialGradient(64, 60, 6, 64, 64, 38); gr.addColorStop(0, shade(spec.eyes, -0.3)); gr.addColorStop(0.55, spec.eyes); gr.addColorStop(1, shade(spec.eyes, -0.45));
    c.fillStyle = gr; c.beginPath(); c.arc(64, 64, 38, 0, 7); c.fill(); c.strokeStyle = shade(spec.eyes, -0.6); c.lineWidth = 3; c.stroke();
    c.fillStyle = '#0c0a0a'; c.beginPath(); c.arc(64, 64, 15, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(52, 52, 7, 0, 7); c.fill(); c.beginPath(); c.arc(76, 74, 3, 0, 7); c.fill();
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  })();
  F.eyes = []; F.lids = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.SphereGeometry(eyeR, 24, 18), uv = eg.attributes.uv, p = eg.attributes.position;
    for (let k = 0; k < p.count; k++) uv.setXY(k, 0.5 + p.getX(k) / (2 * eyeR) * 0.95, 0.5 + p.getY(k) / (2 * eyeR) * 0.95);
    const z0 = frontZ(eyeX * sx, eyeY) - eyeR * 0.55;
    const pivot = new THREE.Group(); pivot.position.set(eyeX * sx, eyeY, z0); H.add(pivot);
    const eye = new THREE.Mesh(eg, new THREE.MeshStandardMaterial({ map: irisTex, roughness: 0.15 })); pivot.add(eye); F.eyes.push(eye);
    // lids: an upper and a lower shell, turned to cover the eye
    const lm = mat(spec.skin, { rough: 0.6, side: THREE.DoubleSide });
    const up = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), lm);
    const lo = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 1.08, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lm);
    pivot.add(up); pivot.add(lo); F.lids.push({ up, lo, sx });
    // the lash line: a dark rim at the upper lid's edge
    const lash = new THREE.Mesh(new THREE.TorusGeometry(eyeR * 1.1, 0.0016, 5, 28, Math.PI), mat('#141010', { rough: 0.9 })); lash.rotation.x = Math.PI / 2; lash.scale.z = 0.6; up.add(lash);
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.0016, 0.006, 5), mat('#141010', { rough: 0.9 })); wing.position.set(eyeR * 1.1 * sx, 0, 0.001); wing.rotation.z = -sx * 1.2; up.add(wing);
  }
  // Brows
  F.brows = [];
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0026, 0.0036, 0.03, 8), mat(shade(spec.hair, -0.15), { rough: 0.9 }));
    b.rotation.z = Math.PI / 2; b.scale.z = 0.6; const g2 = new THREE.Group(); g2.add(b); H.add(g2); F.brows.push({ g: g2, sx, z: frontZ(0.034 * sx, 0.117) + 0.0015 });
  }
  // Mouth: lips, the dark of the mouth and the teeth, rebuilt when it changes
  const mouthY = 0.034, mz = frontZ(0, mouthY) - 0.002, mk = (frontZ(0.025, mouthY) - mz) / (0.025 * 0.025);
  F.mouth = { g: new THREE.Group(), y: mouthY, z: mz, k: mk, key: '' };
  H.add(F.mouth.g);
  F.mouth.lipMat = mat(spec.lips || shade(spec.skin, -0.12), { rough: 0.45, grain: 0 });
  F.mouth.inMat = mat('#2a1012', { rough: 0.9 }); F.mouth.teethMat = mat('#e8e2d6', { rough: 0.4 });
  // Tears
  F.tears = [];
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.004, 0.03), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0, roughness: 0.05, metalness: 0.2 }));
    t.position.set(0.036 * sx, 0.068, frontZ(0.036 * sx, 0.068) + 0.0015); t.rotation.x = -0.35; H.add(t); F.tears.push(t);
  }
  // Hair
  buildHair(F, spec, S, H);
}
function buildHair(F, spec, S, H) {
  const style = spec.hairStyle, hm = mat(spec.hair, { rough: 0.6, grain: 0.06, scale: 40, side: THREE.DoubleSide, rim: '#3a3a4a' });
  if (style === 'none') return;
  const thick = { shaved: 0.0025, crop: 0.008, short: 0.014, bun: 0.01, ponytail: 0.01, bob: 0.014, curls: 0.016 }[style] || 0.01;
  // The cap: the skull pushed out by the hair's thickness, kept above the hairline.
  const segU = 64, segV = 40, pos = [], idx = [], keep = [];
  const lowBack = { bob: -0.2, short: 0.02, crop: 0.05, shaved: 0.05, bun: 0.0, ponytail: 0.0, curls: 0.02 }[style];
  const hairline = d => {
    const front = ss(0.3, 0.9, d.z), side = 1 - front;
    let y = front * 0.5 + side * 0.22;
    if (d.z < -0.2) y = lerp(y, lowBack, ss(-0.2, -0.7, d.z));
    if (style === 'bob') y = Math.min(y, d.z > 0.55 ? 0.42 : lerp(0.3, -0.25, ss(0.55, -0.1, d.z)));
    if (Math.abs(d.x) > 0.6 && d.z > -0.3 && d.z < 0.35 && style !== 'bob') y = Math.max(y, 0.2);   // round the ears
    return y;
  };
  for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) {
    const th = (i / segU) * Math.PI * 2, ph = (j / segV) * Math.PI;
    const d = new V3(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th));
    const P = headPoint(d, S), c = new V3(0, 0.072, 0.008), out = P.clone().sub(c).normalize();
    const n = style === 'curls' ? 0.01 * Math.abs(Math.sin(th * 9) * Math.sin(ph * 8)) : style === 'short' ? 0.007 * Math.abs(Math.sin(th * 6 + ph * 4)) : style === 'bob' ? 0.004 * Math.abs(Math.sin(th * 14)) : 0.003 * Math.abs(Math.sin(th * 10 + ph * 3));
    let tk = thick + n; if (style === 'bob') tk += 0.01 * ss(0.2, -0.2, d.y);
    if (style === 'short' && d.z > 0.5 && d.y > 0.4) tk += 0.012 * ss(0.4, 0.8, d.y);    // a fringe that lifts at the front
    const hl = hairline(d), edge = ss(hl - 0.07, hl + 0.02, d.y);
    P.addScaledVector(out, tk * edge - 0.004 * (1 - edge) + 0.0006); pos.push(P.x, P.y, P.z); keep.push(d.y > hl - 0.07);
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
    if (keep[a] || keep[b] || keep[c] || keep[d]) idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const cap = new THREE.Mesh(g, style === 'shaved' ? mat(spec.hair, { rough: 0.95, grain: 0.35, scale: 400, opacity: 0.75 }) : hm); cap.castShadow = true; H.add(cap);
  if (style === 'bun') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 16), hm); b.scale.set(1, 0.9, 0.85); b.position.set(0, 0.155, -0.075); b.castShadow = true; H.add(b); }
  if (style === 'ponytail') {
    // swings from a pivot at the tie, hanging with gravity (see tickFace)
    const piv = new THREE.Group(); piv.position.set(0, 0.12, -0.098); H.add(piv);
    const pts = [new V3(0, 0, 0), new V3(0, -0.04, -0.03), new V3(0, -0.11, -0.03), new V3(0, -0.18, -0.01)];
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.022, 10, false), p = tube.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = -p.getY(k); const s = lerp(1, 0.35, clamp(y / 0.18, 0, 1)); p.setX(k, p.getX(k) * s); p.setZ(k, (p.getZ(k) + 0.02) * s - 0.02); }
    tube.computeVertexNormals();
    const tail = new THREE.Mesh(tube, hm); tail.castShadow = true; piv.add(tail); F.tail = { piv, ang: new V3() };
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 14), mat('#222222')); tie.rotation.x = 1.2; piv.add(tie);
  }
}

// ── Expressions ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// browIn / browOut: inner and outer ends up (+) or down (−); lid: upper lids closing (0 open … 1 shut); squint: lower lids up; w: the mouth's width;
// smile: the corners up (+) or down (−); open: the jaw; teeth: bared; press: lips pressed; tears; flush.
const E = o => Object.assign({ browIn: 0, browOut: 0, lid: 0.1, squint: 0, w: 1, smile: 0, open: 0, teeth: 0, press: 0, tears: 0, flush: 0 }, o);
const EXPRS = {
  calm: E({}), smile: E({ smile: 0.7, squint: 0.25, w: 1.08 }), soft: E({ smile: 0.35, browIn: 0.25, lid: 0.18 }),
  stern: E({ browIn: -0.7, browOut: 0.1, lid: 0.22, smile: -0.25, press: 0.6 }), concerned: E({ browIn: 0.65, browOut: -0.2, smile: -0.2, lid: 0.12 }),
  defiant: E({ browIn: -0.45, browOut: 0.2, lid: 0.25, smile: -0.1, w: 0.95, press: 0.4 }), pout: E({ browIn: 0.4, smile: -0.55, w: 0.86, press: 0.5, lid: 0.2 }),
  sheepish: E({ browIn: 0.55, smile: 0.2, w: 0.95, lid: 0.35 }),
  wince: E({ browIn: 0.5, browOut: -0.3, lid: 0.55, squint: 0.6, smile: -0.4, open: 0.18, w: 1.05, flush: 0.35 }),
  gritted: E({ browIn: 0.35, browOut: -0.45, lid: 0.68, squint: 0.85, smile: -0.5, open: 0.12, teeth: 1, w: 1.18, flush: 0.6 }),
  crying: E({ browIn: 1, browOut: -0.35, lid: 0.6, squint: 0.7, smile: -0.8, open: 0.45, w: 1.1, tears: 1, flush: 0.85 }),
  relief: E({ browIn: 0.6, smile: 0.2, lid: 0.35, tears: 0.5, flush: 0.4 }),
  surprised: E({ browIn: 0.8, browOut: 0.8, lid: 0, open: 0.35, w: 0.9 }),
};
function rebuildMouth(F) {
  const x = F.expr, M = F.mouth, key = [x.w, x.smile, x.open, x.teeth, x.press].map(v => v.toFixed(3)).join();
  if (key === M.key) return; M.key = key;
  while (M.g.children.length) { const c = M.g.children.pop(); c.geometry.dispose(); }
  const hw = 0.021 * x.w, up = x.smile * 0.0055, op = x.open * 0.02 + x.teeth * 0.004, y0 = M.y;
  const zf = xx => M.z + M.k * xx * xx;
  const curve = (mid, corner, n) => { const pts = []; for (let i = 0; i <= n; i++) { const t = i / n * 2 - 1, xx = t * hw; pts.push(new V3(xx, y0 + lerp(mid, corner, t * t), zf(xx) + 0.001)); } return pts; };
  const thick = 0.0028 * (1 - 0.45 * x.press);
  const upper = curve(0.0012 + op * 0.25, up, 12), lower = curve(-0.0012 - op, up, 12);
  for (const [pts, r] of [[upper, thick * 0.9], [lower, thick * 1.15]]) {
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, r, 6, false), p = tube.attributes.position;
    for (let k = 0; k < p.count; k++) { const xx = p.getX(k), f = 1 - Math.pow(Math.abs(xx) / hw, 4) * 0.7; p.setY(k, lerp(y0 + up, p.getY(k), f)); }
    M.g.add(new THREE.Mesh(tube, M.lipMat));
  }
  if (op > 0.002) {
    const sh = new THREE.Shape(); upper.forEach((p, i) => (i ? sh.lineTo(p.x, p.y) : sh.moveTo(p.x, p.y))); for (let i = lower.length - 1; i >= 0; i--) sh.lineTo(lower[i].x, lower[i].y);
    const sg = new THREE.ShapeGeometry(sh), sp = sg.attributes.position; for (let k = 0; k < sp.count; k++) sp.setZ(k, zf(sp.getX(k)) - 0.0005);
    M.g.add(new THREE.Mesh(sg, M.inMat));
    if (x.teeth > 0.05 || x.open > 0.15) {
      const th = Math.min(op * 0.8, 0.007) * (0.5 + 0.5 * x.teeth), tg = new THREE.PlaneGeometry(hw * 1.5, th, 12, 1), tp = tg.attributes.position;
      for (let k = 0; k < tp.count; k++) { tp.setY(k, tp.getY(k) + y0 + up * 0.4 + 0.0005 - (x.teeth > 0.5 ? op * 0.35 : 0)); tp.setZ(k, zf(tp.getX(k)) - 0.0003); }
      M.g.add(new THREE.Mesh(tg, M.teethMat));
    }
  }
}
function tickFace(F, dt) {
  F.t += dt;
  const k = 1 - Math.exp(-dt * 9), x = F.expr, to = F.exprTo;
  let changed = false;
  for (const key in to) { const v = lerp(x[key], to[key], k); if (Math.abs(v - x[key]) > 1e-4) changed = true; x[key] = v; }
  // blinking
  F.blink -= dt; let bl = 0; if (F.blink < 0) { bl = clamp(1 - Math.abs(F.blink + 0.07) / 0.07, 0, 1); if (F.blink < -0.14) F.blink = 2 + Math.random() * 4; }
  const lid = clamp(Math.max(x.lid, bl), 0, 1);
  for (const L of F.lids) {
    L.up.rotation.x = lerp(-0.55, Math.PI / 2 + 0.05, lid);
    L.lo.rotation.x = lerp(0.45, -0.25, x.squint) - 0.3 * bl;
  }
  for (const e of F.eyes) e.rotation.set(-0.06 + 0.05 * Math.sin(F.t * 0.37), 0.08 * Math.sin(F.t * 0.23), 0);
  for (const b of F.brows) {
    const yi = 0.1175 + x.browIn * 0.007, yo = 0.1165 + x.browOut * 0.006;
    b.g.position.set(0.034 * b.sx - (x.browIn < 0 ? -x.browIn * 0.003 * b.sx : 0), (yi + yo) / 2, b.z);
    b.g.rotation.set(0, 0.25 * b.sx, Math.atan2(yo - yi, 0.026) * b.sx);
  }
  for (const t of F.tears) { t.material.opacity = 0.75 * x.tears; t.scale.y = 0.6 + 0.4 * x.tears + 0.15 * Math.sin(F.t * 1.3); }
  if (changed) { rebuildMouth(F); if (Math.abs((F._flush || 0) - x.flush) > 0.02) { F._flush = x.flush; F.faceTint(x.flush); } }
  else if (!F.mouth.g.children.length) rebuildMouth(F);
  // breathing: the chest rises a little, faster when worked up
  F.breathT = (F.breathT || 0) + dt * (1.6 + 2.4 * F.breath);
  const b = Math.sin(F.breathT) * (0.012 + 0.02 * F.breath);
  F.bone.chest.scale.set(1 + b * 0.4, 1, 1 + b);
  // a ponytail hangs: its pivot turned so it points down in the world
  if (F.tail) {
    const pv = F.tail.piv, q = new THREE.Quaternion(); pv.parent.getWorldQuaternion(q);
    const down = new V3(0, -1, 0).applyQuaternion(q.invert());
    const want = new THREE.Euler(Math.atan2(down.z, -down.y) * 0.8, 0, -Math.atan2(down.x, -down.y) * 0.8);
    const kk = 1 - Math.exp(-dt * 5); pv.rotation.x = lerp(pv.rotation.x, want.x, kk); pv.rotation.z = lerp(pv.rotation.z, want.z, kk);
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

const api = { make, EXPRS, OUTFITS, SPOTS, ik2, aim, setWorldQuat, mat, paint, srgb, shade, R };
root.Figure = api;
})(typeof window !== 'undefined' ? window : globalThis);
