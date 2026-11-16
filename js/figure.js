// Project Meridian — the figures: real adult proportions (about 7.5 heads tall) on a full skeleton (pelvis, two spine joints, neck, head; clavicle,
// shoulder, elbow, wrist, fingers and thumb; hip, knee, ankle, toes), skinned so every joint bends as one continuous surface. Rendered in a stylised,
// painterly way: simplified chunky forms, soft shading with a painted grain, no outlines. Everything is built in code.
//
// Units are metres; a figure faces +z, up is +y, their left is +x. Every bone's rest frame is aligned with the world, and limbs run down their bone's -y,
// so: thighs and upper arms swing forward for a negative turn about x, elbows bend forward for a negative turn, knees back for a positive one.
//
//   const f = Figure.make({ sex: 'f', height: 1.70, mass: 0.4, fat: 0.4, skin, hair, hairStyle, eyes, beard, outfit: 'uniform', dept: '#d8a040' })
//   f.root · f.bone.hips … · f.setClothes({ top: 'down'|'up', bottoms: 'up'|'down', under: 'up'|'down' }) · f.setExpr('wince') · f.tick(dt)
//   f.spots: the seat's mark spots (L/R × cheek, sitspot, thighs) · f.mark(spot, amount) · f.surface(spot, out) → { p, n } in world space
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
// Garment details drawn per pixel from each point's rest-pose position (vBind), so seams, edges, bands and buttons stay crisp at any size.
// uPat0..2: their colours; uParam: per garment (tunic: hem, raised, shoulder x, uniform?; trousers: –, lowered, leg centre x, uniform?).
// vPart: which piece a point is on (the tunic's body 0, its sleeves 1).
const PATTERNS = {
  tunic: `{
  vec3 b = vBind; float ax = abs(b.x), hem = uParam.x, up = uParam.y, shX = uParam.z;
  if (uParam.w > 0.5) {
    if (vPart < 0.5) {
      float lx = mix(-0.07, 0.13, clamp((1.47 - b.y) / 0.57, 0.0, 1.0)), d = b.x - lx;
      float front = smoothstep(0.005, 0.03, b.z), inY = step(hem + 0.008, b.y) * (1.0 - smoothstep(1.478, 1.482, b.y));
      diffuseColor.rgb *= 1.0 - 0.2 * front * inY * smoothstep(-0.032, -0.004, d) * (1.0 - smoothstep(-0.0035, -0.0015, d));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat1, front * inY * (1.0 - smoothstep(0.0012, 0.0028, abs(d + 0.0005))));
      float belt = smoothstep(0.994, 0.997, b.y) * (1.0 - smoothstep(1.031, 1.034, b.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat2, belt);
      float bk = belt * front * (1.0 - smoothstep(0.016, 0.019, abs(b.x - 0.02)));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.28, 0.24), bk * 0.9);
      diffuseColor.rgb *= 1.0 - 0.28 * smoothstep(1.511, 1.515, b.y);
      diffuseColor.rgb *= 1.0 - 0.25 * (1.0 - up) * (1.0 - smoothstep(hem + 0.009, hem + 0.012, b.y));
    } else {
      float flash = step(0.0, b.x) * smoothstep(1.278, 1.281, b.y) * (1.0 - smoothstep(1.366, 1.369, b.y)) * smoothstep(shX + 0.008, shX + 0.014, b.x);
      float cuff = smoothstep(0.894, 0.897, b.y) * (1.0 - smoothstep(0.912, 0.915, b.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat0, max(flash, cuff));
    }
  } else if (vPart < 0.5) {
    float fr = smoothstep(0.03, 0.05, b.z);
    diffuseColor.rgb *= 1.0 - 0.3 * fr * (1.0 - smoothstep(0.009, 0.011, ax)) * smoothstep(1.31, 1.313, b.y);
    for (int i = 0; i < 3; i++) { float bd = length(vec2(b.x, b.y - (1.36 + 0.035 * float(i)))); diffuseColor.rgb = mix(diffuseColor.rgb, uPat1, fr * (1.0 - smoothstep(0.0035, 0.0048, bd))); }
    diffuseColor.rgb *= 1.0 - 0.22 * (1.0 - up) * (1.0 - smoothstep(hem + 0.009, hem + 0.012, b.y));
  }
}`,
  trousers: `{
  vec3 b = vBind; float ax = abs(b.x);
  if (uParam.w > 0.5 && uParam.y < 0.5) {
    float front = smoothstep(0.01, 0.03, b.z), kn = front * smoothstep(0.398, 0.402, b.y) * (1.0 - smoothstep(0.598, 0.602, b.y));
    diffuseColor.rgb *= 1.0 - 0.16 * kn;
    float seam = front * (1.0 - smoothstep(0.0008, 0.0022, min(abs(b.y - 0.4), abs(b.y - 0.6))));
    diffuseColor.rgb *= 1.0 + 0.4 * seam;
  }
  if (uParam.w < 0.5 && b.y < 0.9) diffuseColor.rgb = mix(diffuseColor.rgb, uPat0, (1.0 - smoothstep(0.0025, 0.0045, abs(b.z))) * step(uParam.z + 0.03, ax));
  diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(1.004, 1.007, b.y) * (1.0 - uParam.y);
}`,
};
// The same details on the Blender-built clothes, placed by the body's landmarks (uL0, uL1) rather than fixed heights.
// tunicG: uParam (hem, raised, shoulder x, uniform?), uL0 (–, –, collar, waist), uL1 (shoulder y, armpit y, cuff y, neckline). vPart: sleeve 1.
// trousersG: uParam (–, lowered, leg centre x, uniform?), uL0 (knee, waist top).
PATTERNS.tunicG = `{
  vec3 b = vBind; float ax = abs(b.x), hem = uParam.x, up = uParam.y, shX = uParam.z, collar = uL0.z, waist = uL0.w, shY = uL1.x, pit = uL1.y, cuffY = uL1.z, nl = uL1.w;
  if (uParam.w > 0.5) {
    if (vPart < 0.5) {
      float yTop = collar - 0.04, lx = mix(-0.065, 0.115, clamp((yTop - b.y) / (yTop - hem), 0.0, 1.0)), d = b.x - lx;
      float front = smoothstep(0.005, 0.03, b.z), inY = step(hem + 0.006, b.y) * (1.0 - smoothstep(yTop - 0.002, yTop + 0.002, b.y));
      diffuseColor.rgb *= 1.0 - 0.2 * front * inY * smoothstep(-0.032, -0.004, d) * (1.0 - smoothstep(-0.0035, -0.0015, d));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat1, front * inY * (1.0 - smoothstep(0.0012, 0.0028, abs(d + 0.0005))));
      float belt = smoothstep(waist - 0.034, waist - 0.031, b.y) * (1.0 - smoothstep(waist + 0.003, waist + 0.006, b.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat2, belt);
      float bk = belt * front * (1.0 - smoothstep(0.016, 0.019, abs(b.x - 0.02)));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.28, 0.24), bk * 0.9);
      diffuseColor.rgb *= 1.0 - 0.28 * smoothstep(collar - 0.018, collar - 0.014, b.y);
      diffuseColor.rgb *= 1.0 - 0.25 * (1.0 - up) * (1.0 - smoothstep(hem + 0.009, hem + 0.012, b.y));
    } else {
      float flash = step(0.0, b.x) * smoothstep(pit + 0.03, pit + 0.033, b.y) * (1.0 - smoothstep(shY + 0.012, shY + 0.015, b.y)) * smoothstep(shX + 0.022, shX + 0.03, b.x);
      float cuff = smoothstep(cuffY + 0.004, cuffY + 0.007, b.y) * (1.0 - smoothstep(cuffY + 0.022, cuffY + 0.025, b.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat0, max(flash, cuff));
    }
  } else if (vPart < 0.5) {
    float fr = smoothstep(0.03, 0.05, b.z), pTop = nl - 0.03;
    diffuseColor.rgb *= 1.0 - 0.3 * fr * (1.0 - smoothstep(0.009, 0.011, ax)) * smoothstep(pTop - 0.13, pTop - 0.127, b.y);
    for (int i = 0; i < 3; i++) { float bd = length(vec2(b.x, b.y - (pTop - 0.025 - 0.035 * float(i)))); diffuseColor.rgb = mix(diffuseColor.rgb, uPat1, fr * (1.0 - smoothstep(0.0035, 0.0048, bd))); }
    diffuseColor.rgb *= 1.0 - 0.22 * (1.0 - up) * (1.0 - smoothstep(hem + 0.009, hem + 0.012, b.y));
  }
}`;
PATTERNS.trousersG = `{
  vec3 b = vBind; float ax = abs(b.x), knee = uL0.x, top = uL0.y;
  if (uParam.w > 0.5 && uParam.y < 0.5) {
    float front = smoothstep(0.01, 0.03, b.z), kn = front * smoothstep(knee - 0.072, knee - 0.068, b.y) * (1.0 - smoothstep(knee + 0.128, knee + 0.132, b.y));
    diffuseColor.rgb *= 1.0 - 0.16 * kn;
    float seam = front * (1.0 - smoothstep(0.0008, 0.0022, min(abs(b.y - knee + 0.07), abs(b.y - knee - 0.13))));
    diffuseColor.rgb *= 1.0 + 0.4 * seam;
  }
  if (uParam.w < 0.5 && b.y < top - 0.06) diffuseColor.rgb = mix(diffuseColor.rgb, uPat0, (1.0 - smoothstep(0.0025, 0.0045, abs(b.z))) * step(uParam.z + 0.03, ax));
  diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(top - 0.032, top - 0.029, b.y) * (1.0 - uParam.y);
}`;
const NOISE = `
float fh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float fn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(fh(i), fh(i + vec3(1,0,0)), f.x), mix(fh(i + vec3(0,1,0)), fh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fh(i + vec3(0,0,1)), fh(i + vec3(1,0,1)), f.x), mix(fh(i + vec3(0,1,1)), fh(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
function paint(m, o) {
  o = o || {};
  const U = { uRim: { value: srgb(o.rim || '#2a3440').multiplyScalar(o.rimK == null ? 1 : o.rimK) }, uGrain: { value: o.grain == null ? 0.03 : o.grain }, uGrainScale: { value: o.scale || 60 }, uHide: { value: 0 },
    uMarks: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, -9, 0, 0)) }, uMarkCol: { value: srgb(o.markCol || '#b8323a') },
    uPat0: { value: new THREE.Color(1, 1, 1) }, uPat1: { value: new THREE.Color(1, 1, 1) }, uPat2: { value: new THREE.Color(1, 1, 1) }, uParam: { value: new THREE.Vector4() }, uL0: { value: new THREE.Vector4() }, uL1: { value: new THREE.Vector4() }, uNape: { value: new THREE.Vector4() }, uFlush: { value: new THREE.Vector4() }, uFlushC: { value: new THREE.Vector4() } };
  m.userData.u = U;
  const key = 'paint|' + [o.regions, o.marks, o.bindAttr, o.tone].map(x => (x ? 1 : 0)).join('') + (o.pattern || '');
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 bind; ${o.regions || o.pattern ? 'attribute float region;' : ''} ${o.tone ? 'attribute float tone;' : ''} varying vec3 vBind; varying float vHide; varying float vPart; varying float vTone; uniform float uHide;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vBind = ${o.bindAttr ? 'bind' : 'position'};
${o.regions ? 'vHide = mod(floor(uHide / exp2(region) + 0.001), 2.0);' : 'vHide = 0.0;'} ${o.pattern ? 'vPart = region;' : 'vPart = 0.0;'} ${o.tone ? 'vTone = tone;' : 'vTone = 0.0;'}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vBind; varying float vHide; varying float vPart; varying float vTone; uniform vec3 uPat0; uniform vec3 uPat1; uniform vec3 uPat2; uniform vec4 uParam; uniform vec4 uL0; uniform vec4 uL1; uniform vec4 uNape; uniform vec4 uFlush; uniform vec4 uFlushC; uniform vec3 uRim; uniform float uGrain; uniform float uGrainScale; uniform vec4 uMarks[8]; uniform vec3 uMarkCol;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vHide > 0.5) discard;
if (uNape.z > 0.5 && vBind.y > uNape.x + max(0.0, vBind.z - uNape.y) * uNape.w) discard;      // (the nape, under the skull: see makeGLB)
// (the body's response (F.setResponse): blood to the sex, a deeper, rosier tone there; his, the whole length as it hangs at rest, and the
// scrotum; hers, the outer forms and the bottom of the mons)
if (uFlush.x > 0.001) {
  float lo = uFlush.y - (uFlush.w > 0.5 ? 0.125 : 0.042), hi = uFlush.y + (uFlush.w > 0.5 ? 0.06 : 0.04), wx = uFlush.w > 0.5 ? 0.042 : 0.026;
  float fw = (1.0 - smoothstep(wx - 0.022, wx, abs(vBind.x))) * smoothstep(lo, lo + 0.015, vBind.y) * (1.0 - smoothstep(hi - 0.02, hi, vBind.y)) * smoothstep(uFlush.z - 0.03, uFlush.z, vBind.z);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.86, 0.54, 0.58), fw * uFlush.x);
}
// (her inner form, in the crease between the folds: a deeper rose always, deeper again with the response)
if (vTone > 0.01) diffuseColor.rgb *= mix(vec3(1.0), vec3(0.78, 0.47, 0.5), clamp(vTone, 0.0, 1.0) * (0.7 + 0.3 * uFlush.x));
// (and with desire, the flush spreads up the chest to the throat: a blotchy warmth across the front)
if (uFlushC.x > 0.001) {
  float cw = smoothstep(uFlushC.y, uFlushC.y + 0.05, vBind.y) * (1.0 - smoothstep(uFlushC.z - 0.03, uFlushC.z, vBind.y)) * (1.0 - smoothstep(0.08, 0.14, abs(vBind.x))) * smoothstep(-0.01, 0.03, vBind.z);
  cw *= 0.75 + 0.25 * fn3(vBind * 28.0);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.93, 0.74, 0.74), cw * uFlushC.x);
}
float g = fn3(vBind * uGrainScale) * 0.6 + fn3(vBind * uGrainScale * 2.7) * 0.4;
diffuseColor.rgb *= 1.0 + uGrain * (g - 0.5) * 2.0;
${o.pattern ? PATTERNS[o.pattern] : ''}
${o.marks ? `float mk = 0.0;
for (int i = 0; i < 8; i++) { vec3 d = vBind - uMarks[i].xyz; d.z *= 0.6; mk += uMarks[i].w * exp(-dot(d, d) / 0.0026); }
float mott = fn3(vBind * 140.0);
mk = 1.0 - exp(-2.2 * mk * (0.75 + 0.5 * mott));
diffuseColor.rgb = mix(diffuseColor.rgb, uMarkCol, mk * 0.78);` : ''}`)
      // (a soft rim of light round the silhouette, as stylised shading has)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float fr = 1.0 - abs(dot(normalize(vViewPosition), normal)); totalEmissiveRadiance += uRim * smoothstep(0.55, 0.9, fr) * 0.6; }`);
  };
  return m;
}
// ── Dual-quaternion skinning ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Each bone's matrix turned into a rotation and a translation (a dual quaternion), blended, and applied: unlike blending matrices, a joint keeps
// its volume as it bends (no collapsing elbow or knee, no pinched shoulder, no twisting wrist). Patched into a material's own skinning chunks, so
// it works for any material (the toon shading, the outlines, the shadows' depth).
const DQS_PARS = `
vec4 dqQuat(mat4 m) {
  mat3 r = mat3(normalize(m[0].xyz), normalize(m[1].xyz), normalize(m[2].xyz));
  float tr = r[0][0] + r[1][1] + r[2][2]; vec4 q;
  if (tr > 0.0) { float s = sqrt(tr + 1.0) * 2.0; q = vec4((r[1][2] - r[2][1]) / s, (r[2][0] - r[0][2]) / s, (r[0][1] - r[1][0]) / s, 0.25 * s); }
  else if (r[0][0] > r[1][1] && r[0][0] > r[2][2]) { float s = sqrt(1.0 + r[0][0] - r[1][1] - r[2][2]) * 2.0; q = vec4(0.25 * s, (r[1][0] + r[0][1]) / s, (r[2][0] + r[0][2]) / s, (r[1][2] - r[2][1]) / s); }
  else if (r[1][1] > r[2][2]) { float s = sqrt(1.0 + r[1][1] - r[0][0] - r[2][2]) * 2.0; q = vec4((r[1][0] + r[0][1]) / s, 0.25 * s, (r[2][1] + r[1][2]) / s, (r[2][0] - r[0][2]) / s); }
  else { float s = sqrt(1.0 + r[2][2] - r[0][0] - r[1][1]) * 2.0; q = vec4((r[2][0] + r[0][2]) / s, (r[2][1] + r[1][2]) / s, 0.25 * s, (r[0][1] - r[1][0]) / s); }
  return normalize(q);
}
vec4 dqDual(vec4 q, vec3 t) { return 0.5 * vec4(q.w * t + cross(t, q.xyz), -dot(t, q.xyz)); }
vec3 dqRot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
`;
const DQS_BASE = `#ifdef USE_SKINNING
  mat4 boneMatX = getBoneMatrix( skinIndex.x ); mat4 boneMatY = getBoneMatrix( skinIndex.y ); mat4 boneMatZ = getBoneMatrix( skinIndex.z ); mat4 boneMatW = getBoneMatrix( skinIndex.w );
  vec4 dqA = dqQuat(boneMatX), dqB = dqQuat(boneMatY), dqC = dqQuat(boneMatZ), dqD = dqQuat(boneMatW);
  float wB = dot(dqA, dqB) < 0.0 ? -skinWeight.y : skinWeight.y, wC = dot(dqA, dqC) < 0.0 ? -skinWeight.z : skinWeight.z, wD = dot(dqA, dqD) < 0.0 ? -skinWeight.w : skinWeight.w;
  vec4 dqR = skinWeight.x * dqA + wB * dqB + wC * dqC + wD * dqD;
  vec4 dqT = skinWeight.x * dqDual(dqA, boneMatX[3].xyz) + wB * dqDual(dqB, boneMatY[3].xyz) + wC * dqDual(dqC, boneMatZ[3].xyz) + wD * dqDual(dqD, boneMatW[3].xyz);
  float dqL = length(dqR); dqR /= dqL; dqT /= dqL;
#endif`;
const DQS_NORMAL = `#ifdef USE_SKINNING
  objectNormal = dqRot(dqR, objectNormal);
#endif`;
const DQS_SKIN = `#ifdef USE_SKINNING
  vec3 skP = (bindMatrix * vec4(transformed, 1.0)).xyz;
  skP = dqRot(dqR, skP) + 2.0 * (dqR.w * dqT.xyz - dqT.w * dqR.xyz + cross(dqR.xyz, dqT.xyz));
  transformed = (bindMatrixInverse * vec4(skP, 1.0)).xyz;
#endif`;
function dqs(m) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <skinning_pars_vertex>', '#include <skinning_pars_vertex>\n' + DQS_PARS)
      .replace('#include <skinbase_vertex>', DQS_BASE).replace('#include <skinnormal_vertex>', DQS_NORMAL).replace('#include <skinning_vertex>', DQS_SKIN);
  };
  m.customProgramCacheKey = () => 'dqs|' + prevKey();
  return m;
}
const DEPTHM = dqs(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, skinning: true })), DEPTHM_M = dqs(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, skinning: true, morphTargets: true }));
const morphed = g => !!(g.morphAttributes && g.morphAttributes.position && g.morphAttributes.position.length);
// A skinned part of a figure: bound with the rest pose's matrix, dual-quaternion skinned, casting its shadow with the same skinning.
function skinned(F, geo, m) {
  const sm = new THREE.SkinnedMesh(geo, m); F.root.add(sm); sm.bind(F.skeleton, F.bindM); sm.frustumCulled = false; sm.customDepthMaterial = morphed(geo) ? DEPTHM_M : DEPTHM;
  if (F.keys && morphed(geo)) setKeys(sm, F.keys);
  return sm;
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
  let m = paint(new THREE.MeshToonMaterial({ color: srgb(hex), gradientMap: ramp(), skinning: !!o.skin, morphTargets: !!o.morph, vertexColors: !!o.vc, side: o.side || THREE.FrontSide }), o);
  if (o.skin) m = dqs(m);
  if (!o.unique) TMATS.set(key, m);
  return m;
}
const INK = '#2a1a16';
const HULL_OFS = { polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 6 };
const INKM = { plain: new THREE.MeshBasicMaterial({ color: srgb(INK), side: THREE.BackSide }), skinned: dqs(new THREE.MeshBasicMaterial(Object.assign({ color: srgb(INK), side: THREE.BackSide, skinning: true }, HULL_OFS))),
  morph: dqs(new THREE.MeshBasicMaterial(Object.assign({ color: srgb(INK), side: THREE.BackSide, skinning: true, morphTargets: true }, HULL_OFS))) };
// (each point pushed out by its own share of w where the model gives one, `_ink`: less across a crease, so the two sides' outlines never reach
// through each other; and for a garment, a slim round edge of ink along each open hem: its waist, its legs, cuffs and collar)
function hullGeo(geo, w, hem) {
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal, k = g.attributes._ink;
  for (let i = 0; i < p.count; i++) { const wi = w * (k ? k.getX(i) : 1); p.setXYZ(i, p.getX(i) + n.getX(i) * wi, p.getY(i) + n.getY(i) * wi, p.getZ(i) + n.getZ(i) * wi); }
  return hem ? withHems(g, geo, hem) : g;
}
// A garment's open edges (welded by position, so a split vertex isn't taken for one), each with its direction round the surface: [a, b] pairs
// of the first vertex at each place.
function openEdges(geo) {
  const p = geo.attributes.position, n = p.count, id = new Int32Array(n), at = new Map();
  for (let i = 0; i < n; i++) { const key = p.getX(i) + ',' + p.getY(i) + ',' + p.getZ(i); if (!at.has(key)) at.set(key, i); id[i] = at.get(key); }     // (exactly: the cut leaves points very close)
  const ix = geo.index ? geo.index.array : null, nt = (ix ? ix.length : n) / 3, E = new Map();
  for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) {
    const a = id[ix ? ix[t * 3 + e] : t * 3 + e], b = id[ix ? ix[t * 3 + (e + 1) % 3] : t * 3 + (e + 1) % 3], key = a < b ? a + '_' + b : b + '_' + a, o = E.get(key);
    if (o) o[2]++; else E.set(key, [a, b, 1]);
  }
  return [...E.values()].filter(e => e[2] === 1).map(e => [e[0], e[1]]);
}
const HEM_K = 6;
function withHems(g, src, r) {
  const E = openEdges(src); if (!E.length) return g;
  const P = src.attributes.position, N = src.attributes.normal, nx = new Map(), pv = new Map();
  for (const [a, b] of E) { if (!nx.has(a)) nx.set(a, b); if (!pv.has(b)) pv.set(b, a); }
  const vs = [...new Set(E.flat())], ring = new Map(), pos = [], from = [];
  const v3 = i => new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)), t = new THREE.Vector3(), b = new THREE.Vector3(), nn = new THREE.Vector3(), q = new THREE.Vector3();
  for (const v of vs) {
    const o = v3(v), a = pv.has(v) ? v3(pv.get(v)) : o, c = nx.has(v) ? v3(nx.get(v)) : o;
    t.subVectors(c, a).normalize(); nn.set(N.getX(v), N.getY(v), N.getZ(v));
    b.crossVectors(t, nn).normalize(); nn.crossVectors(b, t).normalize();
    ring.set(v, pos.length);
    for (let j = 0; j < HEM_K; j++) {
      const th = j / HEM_K * Math.PI * 2;
      q.copy(o).addScaledVector(nn, r * (0.3 + Math.cos(th))).addScaledVector(b, r * Math.sin(th)); pos.push(q.clone()); from.push(v);
    }
  }
  const n0 = g.attributes.position.count, m = pos.length;
  const grow = (A, set) => {
    const s = A.itemSize, get = [A.getX, A.getY, A.getZ, A.getW].slice(0, s), out = new A.array.constructor((n0 + m) * s);
    for (let i = 0; i < n0; i++) for (let c = 0; c < s; c++) out[i * s + c] = get[c].call(A, i);
    for (let j = 0; j < m; j++) for (let c = 0; c < s; c++) out[(n0 + j) * s + c] = set ? set(j, c) : get[c].call(A, from[j]);
    return new THREE.BufferAttribute(out, s, A.normalized);
  };
  for (const name in g.attributes) g.setAttribute(name, grow(g.attributes[name], name === 'position' ? (j, c) => pos[j].getComponent(c) : null));
  for (const name in g.morphAttributes) g.morphAttributes[name] = g.morphAttributes[name].map(A => grow(A));
  const old = g.index ? Array.from(g.index.array) : Array.from({ length: n0 }, (_, i) => i), tri = [];
  for (const [a, c] of E) {
    const ra = n0 + ring.get(a), rc = n0 + ring.get(c);
    for (let j = 0; j < HEM_K; j++) {
      const j1 = (j + 1) % HEM_K;
      tri.push(ra + j, ra + j1, rc + j1, ra + j, rc + j1, rc + j, ra + j, rc + j1, ra + j1, ra + j, rc + j, rc + j1);     // (both ways round)
    }
  }
  g.setIndex(old.concat(tri));
  return g;
}
// An outline round a mesh: for a plain one, a child; for a skinned one, a second skinned mesh on the same skeleton (mat: its own, e.g. sharing hidden regions).
// (an outline's hull is kept with the geometry it's made from, so figures sharing a body share its hull too)
function ink(mesh, w, F, m, hem) {
  if (mesh.isSkinnedMesh) {
    const g = mesh.geometry, hg = g.userData.shared ? (g.userData.hull = g.userData.hull || hullGeo(g, w, hem)) : hullGeo(g, w, hem);
    const h = skinned(F, hg, m || (morphed(g) ? INKM.morph : INKM.skinned)); h.castShadow = false; mesh.userData.hull = h; return h;
  }
  const h = new THREE.Mesh(hullGeo(mesh.geometry, w), INKM.plain); mesh.add(h); return h;
}
const INK_W = 0.0045, HEM_R = 0.0019;

// ── Bones ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Built for a figure 1.75 m tall; a figure of another height is scaled whole (f.root.scale). Women's shoulders narrower and hip joints a touch wider.
// Each hand has four fingers of two joints and a thumb of two; each buttock a bone of its own (for the flesh's give when it's struck).
const HAND_K = 1.06;      // (hands a touch large, as the toon lean wants)
function fingerSpec(f, s, sx) {
  const k = (f ? 0.92 : 1) * HAND_K, h = 'hand' + s;
  return [
    ['index1' + s, h, 0, -0.093 * k, 0.026 * k], ['index2' + s, 'index1' + s, 0, -0.042 * k, 0],
    ['middle1' + s, h, 0, -0.095 * k, 0.009 * k], ['middle2' + s, 'middle1' + s, 0, -0.046 * k, 0],
    ['ring1' + s, h, 0, -0.092 * k, -0.008 * k], ['ring2' + s, 'ring1' + s, 0, -0.043 * k, 0],
    ['pinky1' + s, h, 0, -0.086 * k, -0.024 * k], ['pinky2' + s, 'pinky1' + s, 0, -0.033 * k, 0],
    ['thumb1' + s, h, -0.009 * k * sx, -0.026 * k, 0.026 * k], ['thumb2' + s, 'thumb1' + s, -0.004 * k * sx, -0.03 * k, 0.014 * k],
  ];
}
function skeletonSpec(sx) {
  const f = sx === 'f', shX = f ? 0.175 : 0.195, hipX = f ? 0.095 : 0.09;
  return [
    ['hips', null, 0, 0.95, 0],
    ['spine', 'hips', 0, 0.10, 0], ['chest', 'spine', 0, 0.17, 0], ['neck', 'chest', 0, 0.27, -0.012], ['head', 'neck', 0, 0.085, 0.012],
    ['clavL', 'chest', 0.03, 0.21, 0], ['upperArmL', 'clavL', shX - 0.03, 0, -0.01], ['foreArmL', 'upperArmL', 0.012, -0.29, 0], ['handL', 'foreArmL', 0.005, -0.255, 0.008],
    ...fingerSpec(f, 'L', 1),
    ['clavR', 'chest', -0.03, 0.21, 0], ['upperArmR', 'clavR', -(shX - 0.03), 0, -0.01], ['foreArmR', 'upperArmR', -0.012, -0.29, 0], ['handR', 'foreArmR', -0.005, -0.255, 0.008],
    ...fingerSpec(f, 'R', -1),
    ['thighL', 'hips', hipX, -0.05, 0], ['shinL', 'thighL', -0.005, -0.42, 0.006], ['footL', 'shinL', 0, -0.40, -0.012], ['toeL', 'footL', 0, -0.06, 0.13],
    ['thighR', 'hips', -hipX, -0.05, 0], ['shinR', 'thighR', 0.005, -0.42, 0.006], ['footR', 'shinR', 0, -0.40, -0.012], ['toeR', 'footR', 0, -0.06, 0.13],
    ['gluteL', 'hips', 0.078, -0.078, -0.1], ['gluteR', 'hips', -0.078, -0.078, -0.1],
  ];
}
const FINGERS = ['index', 'middle', 'ring', 'pinky'];

// ── Mesh builder: rings swept along the body in its rest pose, each vertex weighted to the bones near it. ────────────────────────────────────────
function Builder() {
  const B = { pos: [], nrm: [], uv: [], idx: [], si: [], sw: [], col: [], reg: [] };
  // ring: { c: [x, y, z], rx, zF, zB, p (superellipse exponent), lobes(θ) → extra radius, ax/az: its side and front axes (default x and z) };
  // rings run in order; seg around. o.smooth: rings added between each pair, on a smooth (Catmull-Rom) curve through every value, so the
  // profile flows between the rows rather than turning at each.
  B.sweep = (rings0, seg, o) => {
    const rings = smoothRings(rings0, o.smooth == null ? 2 : o.smooth);
    const base = B.pos.length / 3, n = seg + 1;
    rings.forEach((r, i) => {
      const ax = r.ax || X_, az = r.az || Z_;
      for (let j = 0; j <= seg; j++) {
        const th = (j / seg) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), p = r.p || 2;
        const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / p), ez = Math.sign(s) * Math.pow(Math.abs(s), 2 / p);
        let x = ex * r.rx, z = ez * (s > 0 ? r.zF : r.zB);
        const add = r.lobes ? r.lobes(th) : 0;
        if (add) { const L = Math.hypot(x, z) || 1; x += add * x / L; z += add * z / L; }
        const P = [r.c[0] + x * ax[0] + z * az[0], r.c[1] + x * ax[1] + z * az[1], r.c[2] + x * ax[2] + z * az[2]];
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
const X_ = [1, 0, 0], Z_ = [0, 0, 1];
// Rings added between each pair of rows: every number (centre, radii, exponent, axes) and the lobes on a Catmull-Rom curve through the rows.
function smoothRings(rows, sub) {
  if (!sub || rows.length < 2) return rows;
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const out = [], n = rows.length, at = i => rows[clamp(i, 0, n - 1)];
  const num = (r, k, i) => (k === 'c' || k === 'ax' || k === 'az' ? (r[k] || (k === 'ax' ? X_ : k === 'az' ? Z_ : [0, 0, 0]))[i] : r[k] == null ? (k === 'p' ? 2 : 0) : r[k]);
  for (let i = 0; i < n - 1; i++) {
    const A = at(i - 1), Bq = at(i), C = at(i + 1), D = at(i + 2);
    for (let k = 0; k <= sub; k++) {
      if (k === 0) { out.push(Bq); continue; }
      const t = k / (sub + 1), r = {};
      for (const key of ['c', 'ax', 'az']) r[key] = [0, 1, 2].map(j => cr(num(A, key, j), num(Bq, key, j), num(C, key, j), num(D, key, j), t));
      for (const key of ['rx', 'zF', 'zB', 'p']) r[key] = Math.max(key === 'p' ? 1.5 : 0.0005, cr(num(A, key), num(Bq, key), num(C, key), num(D, key), t));
      if (A.lobes || Bq.lobes || C.lobes || D.lobes) { const L = q => (q.lobes ? q.lobes : () => 0); r.lobes = th => cr(L(A)(th), L(Bq)(th), L(C)(th), L(D)(th), t); }
      if (Bq.ax || C.ax) { const v = new V3(...r.ax).normalize(); r.ax = [v.x, v.y, v.z]; const u = new V3(...r.az).normalize(); r.az = [u.x, u.y, u.z]; }
      out.push(r);
    }
  }
  out.push(rows[n - 1]);
  return out;
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
const R = { HEAD: 0, CHEST: 1, WAIST: 2, HIPS: 3, SEAT: 4, THIGH: 5, KNEE: 6, SHIN: 7, UPARM: 8, FOREARM: 9, HAND: 10, WAIST_HI: 11, HIPS_LO: 12, FOOT: 13 };

// ── The body's shape, from sex, mass (muscle and frame, 0–1) and fat (softness, 0–1). ──────────────────────────────────────────────────────────
function shapeOf(o) {
  const f = o.sex === 'f', m = o.mass == null ? 0.5 : o.mass, fat = o.fat == null ? 0.4 : o.fat;
  const W = 0.9 + 0.2 * m + 0.12 * fat;                 // overall girth
  return {
    f, m, fat, W,
    shoulder: (f ? 0.92 : 1.04) * (0.94 + 0.12 * m),
    chest: f ? 0.9 : 1.0, waist: (f ? 0.82 : 0.97) * (0.9 + 0.12 * m + 0.25 * fat), hip: (f ? 1.12 : 0.98) * (0.94 + 0.08 * m + 0.14 * fat),
    glute: (f ? 0.034 : 0.022) * (0.75 + 0.5 * fat + 0.3 * m), belly: 0.035 * fat * (f ? 0.8 : 1.1),
    bust: f ? lerp(0.016, 0.07, o.bust == null ? 0.4 : o.bust) * (0.8 + 0.5 * fat) : 0.006 * m,
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
    [1.41, 0.162 * sh, 0.085, 0.092, 0, 0, 0],
    [1.438, 0.14 * sh, 0.072, 0.08, 0, 0, 0],
    [1.462, 0.104 * sh, 0.06, 0.066, 0, 0, 0],
    [1.482, 0.07, 0.054, 0.057, 0, 0, 0],
    [1.52, 0.056 * (S.f ? 1 : 1.12), 0.05 * (S.f ? 1 : 1.1), 0.054 * (S.f ? 1 : 1.1), 0, 0, 0],
    [1.585, 0.052 * (S.f ? 1 : 1.1), 0.048 * (S.f ? 1 : 1.1), 0.05 * (S.f ? 1 : 1.1), 0, 0, 0],
  ];
  const mus = 0.6 + 0.8 * S.m, soft = bridge ? 0.5 : 1;
  const pec = S.f ? 0 : 0.011 * mus;
  return rows.map(([y, rx, zF, zB, gl, bu, be]) => {
    const R0 = { c: [0, y, 0.0], rx: rx * (y > 1.5 ? 1 : S.W) + t, zF: (zF + be * S.belly) * S.W + t, zB: zB * S.W + t, p: y > 1.44 ? 2 : 2.25 };
    const pc = pec * gauss(y - 1.31, 0.045), sca = 0.006 * mus * gauss(y - 1.35, 0.05) * soft, grv = y > 0.99 && y < 1.43 ? 0.0045 * ss(0.99, 1.06, y) * ss(1.43, 1.36, y) * (bridge ? 0 : 1) : 0;
    const obl = 0.004 * mus * gauss(y - 1.0, 0.04) * soft;      // (the obliques, over the hips)
    R0.lobes = th => {
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
      if (pc) a += pc * (gauss(angDiff(th, Math.PI / 2 - 0.55), 0.42) + gauss(angDiff(th, Math.PI / 2 + 0.55), 0.42)) * (bridge ? 0.6 : 1);
      if (sca) a += sca * (gauss(angDiff(th, -Math.PI / 2 + 0.75), 0.35) + gauss(angDiff(th, -Math.PI / 2 - 0.75), 0.35));
      if (grv) a -= grv * gauss(angDiff(th, -Math.PI / 2), 0.09);
      if (obl) a += obl * (gauss(angDiff(th, 0.25), 0.4) + gauss(angDiff(th, Math.PI - 0.25), 0.4));
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
    .map(([dy, rx, zF, zB, cx, cz]) => {
      const y = 0.90 + dy, R0 = { c: [hx + cx * side, y, cz], rx: rx + t, zF: zF + t, zB: zB + t, p: 2.1 };
      // the muscles: quads down the front, the inner one bulging above the knee, the kneecap, the calf (the inner head higher and fuller)
      const mus = (0.6 + 0.8 * S.m) * (t > 0.003 ? 0.45 : 1), IN = side > 0 ? Math.PI : 0, OUT = side > 0 ? 0 : Math.PI, toward = (a, b, k) => a + angDiff(b, a) * k;
      const F_ = Math.PI / 2, B_ = -Math.PI / 2;
      const quad = 0.006 * mus * gauss(y - 0.68, 0.08), vmo = 0.007 * mus * gauss(y - 0.55, 0.035), vl = 0.004 * mus * gauss(y - 0.7, 0.08), pat = 0.006 * gauss(y - 0.475, 0.022) * (t > 0.003 ? 0.3 : 1);
      const ham = 0.003 * mus * gauss(y - 0.66, 0.08), gm = 0.012 * mus * gauss(y - 0.37, 0.05), gl = 0.008 * mus * gauss(y - 0.39, 0.04), mal = 0.004 * gauss(y - 0.1, 0.016);
      R0.lobes = th => quad * gauss(angDiff(th, F_), 0.7) + vmo * gauss(angDiff(th, toward(F_, IN, 0.5)), 0.45) + vl * gauss(angDiff(th, OUT), 0.6) + pat * gauss(angDiff(th, F_), 0.35)
        + ham * gauss(angDiff(th, B_), 0.7) + gm * gauss(angDiff(th, toward(B_, IN, 0.45)), 0.5) + gl * gauss(angDiff(th, toward(B_, OUT, 0.45)), 0.45) + mal * (gauss(angDiff(th, IN), 0.35) + gauss(angDiff(th, OUT), 0.35));
      return R0;
    });
}
// An arm, hanging, from over the shoulder joint to the wrist: [y, rx (side), rz (front/back), centre x]
function armRings(S, side, inflate, to) {
  const t = inflate || 0, L = S.limb, sx = (S.f ? 0.175 : 0.195) * side;
  const rows = [[1.466, 0.026, 0.026, -0.03], [1.452, 0.042, 0.042, -0.016], [1.43, 0.051, 0.05, -0.008], [1.38, 0.052, 0.05, 0.0], [1.30, 0.048, 0.048, 0.006], [1.22, 0.046, 0.045, 0.01],
    [1.145, 0.039, 0.041, 0.014], [1.07, 0.044, 0.042, 0.016], [0.98, 0.037, 0.032, 0.018], [0.90, 0.029, 0.023, 0.02], [0.875, 0.027, 0.021, 0.02]];
  const mus = (0.6 + 0.8 * S.m) * (t > 0.003 ? 0.4 : 1), OUT = side > 0 ? 0 : Math.PI, IN = side > 0 ? Math.PI : 0, F_ = Math.PI / 2, B_ = -Math.PI / 2, toward = (a, b, k) => a + angDiff(b, a) * k;
  return rows.filter(r => r[0] >= (to == null ? 0 : to) - 1e-6).map(([y, rx, rz, cx]) => {
    const R0 = { c: [sx + cx * side, y, -0.01 + (y < 1.14 ? 0.008 : 0)], rx: rx * L + t, zF: rz * L + t, zB: rz * L + t, p: 2 };
    // the deltoid capping the shoulder, the biceps and triceps, the point of the elbow, the forearm's swell below it
    const del = 0.009 * mus * gauss(y - 1.4, 0.04), bic = 0.008 * mus * gauss(y - 1.25, 0.045), tri = 0.007 * mus * gauss(y - 1.32, 0.05);
    const elb = 0.004 * gauss(y - 1.145, 0.016) * (t > 0.003 ? 0.3 : 1), brr = 0.006 * mus * gauss(y - 1.06, 0.04), flx = 0.004 * mus * gauss(y - 1.04, 0.05);
    R0.lobes = th => del * (gauss(angDiff(th, OUT), 0.9) + 0.5 * gauss(angDiff(th, F_), 0.5)) + bic * gauss(angDiff(th, F_), 0.55) + tri * gauss(angDiff(th, B_), 0.6)
      + elb * gauss(angDiff(th, B_), 0.4) + brr * gauss(angDiff(th, toward(F_, OUT, 0.5)), 0.5) + flx * gauss(angDiff(th, toward(F_, IN, 0.5)), 0.5);
    return R0;
  });
}

// ── Making a figure ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const SPOTS = ['cheekL', 'cheekR', 'sitspotL', 'sitspotR', 'thighsL', 'thighsR'];
const SPOT_AT = { cheek: 0.875, sitspot: 0.825, thighs: 0.76 };

function make(spec) {
  spec = Object.assign({ sex: 'm', height: 1.75, mass: 0.5, fat: 0.4, skin: '#c8987a', hair: '#3a2a20', hairStyle: 'crop', eyes: '#4a5a4a', lips: null,
    outfit: 'uniform', dept: '#c89a3a', beard: false }, spec || {});
  if (GLB.sex[spec.sex] && spec.model !== 'built') return makeGLB(spec, GLB.sex[spec.sex]);
  const S = shapeOf(spec), F = { spec, S, root: new THREE.Group(), bone: {}, bones: [] };
  // (the heights posing works from, in the figure's own units: the pelvis, the ankle, the pelvis over what it sits on; the arms' rest angle out)
  F.H = { hips: 0.95, ankle: 0.08, sit: 0.13, abd: 0, waist: 1.0, blades: 1.3, shoulder: [S.f ? 0.15 : 0.165, 1.41] };
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
    const toThigh = ss(0.93, 0.79, y) * ss(0.01, 0.08, ax) * 0.55;      // (the cheek's lower part rides partly with its thigh: enough to round as the leg moves, not so much that it turns with it)
    const sp = ss(0.98, 1.13, y), chs = ss(1.15, 1.30, y), nk = ss(1.47, 1.535, y), hd = ss(1.55, 1.6, y);
    const cl = ss(0.09, 0.15, ax) * ss(1.34, 1.43, y) * (1 - nk);
    let hips = (1 - sp) * (1 - toThigh), spine = sp * (1 - chs), chest = chs * (1 - nk) * (1 - cl);
    out.push(w('hips', hips), w('thigh' + s, toThigh * (1 - sp)), w('spine', spine), w('chest', chest), w('clav' + s, cl * 0.6), w('upperArm' + s, cl * 0.4), w('neck', nk * (1 - hd)), w('head', hd));
    // the cheek's flesh rides a little on its own bone, for its give when it's struck
    const gC = rest['glute' + s], gd = (x - gC.x) ** 2 + (y - gC.y) ** 2 * 0.8, gw = 0.7 * Math.exp(-gd / (2 * 0.05 * 0.05)) * ss(-0.02, -0.07, P[2]);
    if (gw > 0.01) { for (const e of out) e[1] *= 1 - gw; out.push(w('glute' + s, gw)); }
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
  const torsoRegion = P => P[1] >= 1.47 ? R.HEAD : P[1] >= 1.15 ? R.CHEST : P[1] >= 1.085 ? R.WAIST_HI : P[1] >= 1.03 ? R.WAIST : P[1] >= 0.958 ? R.HIPS : P[1] >= 0.935 ? R.HIPS_LO : R.SEAT;
  const legRegion = P => P[1] >= 0.958 ? R.HIPS : P[1] >= 0.93 ? R.HIPS_LO : P[1] >= 0.61 ? R.THIGH : P[1] >= 0.38 ? R.KNEE : R.SHIN;
  const armRegion = P => P[1] >= 1.14 ? R.UPARM : P[1] >= 0.88 ? R.FOREARM : R.HAND;

  // ── The body ──
  const BB = Builder(), skinC = () => [1, 1, 1];
  BB.sweep(torsoRings(S), 48, { weights: torsoW, region: torsoRegion, capBottom: true, color: skinC });
  for (const sd of [1, -1]) {
    BB.sweep(legRings(S, sd), 22, { weights: legW, region: legRegion, color: skinC, flip: true });
    BB.sweep(armRings(S, sd), 18, { weights: armW, region: armRegion, color: skinC, capBottom: true, flip: true });
    handGeo(BB, S, sd, BI, w, rest);
  }
  const bodyGeo = BB.geometry();
  const skinM = tmat(spec.skin, { skin: true, regions: true, marks: true, bindAttr: true, unique: true, rim: '#6a5048', rimK: 0.5 });
  F.body = skinned(F, bodyGeo, skinM); F.body.castShadow = true; F.body.receiveShadow = false;
  F.skinMat = skinM;
  { const hm = dqs(paint(new THREE.MeshBasicMaterial({ color: srgb(INK), side: THREE.BackSide, skinning: true }), { regions: true, grain: 0 })); hm.userData.u.uHide = skinM.userData.u.uHide; ink(F.body, INK_W, F, hm); }

  spotsOn(F, bodyGeo, area => [area === 'thighs' ? 0.088 : 0.078, SPOT_AT[area]]);

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

  finish(F, spec);
  return F;
}

// The seat's spots: the point on the back of the seat nearest each place (at(area) → [x from the middle, y]), for aiming at and marking; and the
// marks themselves.
function spotsOn(F, bodyGeo, at, reach) {
  reach = reach || 0.03;
  F.spot = {};
  {
    const p = bodyGeo.attributes.position, n = bodyGeo.attributes.normal, reg = bodyGeo.attributes.region;
    for (const k of SPOTS) {
      const area = k.slice(0, -1), sd = k.slice(-1) === 'L' ? 1 : -1, [ax, ty] = at(area), tx = ax * sd;
      // (the outermost point there: the cheek's own surface, not the top of a leg tube buried inside it: of the points within 3 cm, the one
      // furthest back)
      let best = -1, bd = 1e9, bz = 1e9;
      const ok = i => n.getZ(i) <= -0.55 && [R.SEAT, R.HIPS, R.HIPS_LO, R.THIGH].includes(reg.getX(i));
      for (let i = 0; i < p.count; i++) { if (!ok(i)) continue; const d = Math.hypot(p.getX(i) - tx, p.getY(i) - ty); if (d < reach && p.getZ(i) < bz) { bz = p.getZ(i); best = i; } }
      if (best < 0) for (let i = 0; i < p.count; i++) { if (!ok(i)) continue; const d = Math.hypot(p.getX(i) - tx, p.getY(i) - ty); if (d < bd) { bd = d; best = i; } }
      F.spot[k] = { i: best, bind: new V3(p.getX(best), p.getY(best), p.getZ(best)), mark: 0 };
    }
  }
  const _a = new V3(), _b = new V3();
  // A spot's place and outward normal in the world, as the body is posed now (and lifted off the skin by `lift`, for cloth over it).
  F.surface = (k, out, lift) => {
    const sp = F.spot[k] || F.anchor[k], g = F.body.geometry, i = sp.i;
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
  anchorsOn(F, bodyGeo);
  F.mark = (k, amt) => { const sp = F.spot[k]; sp.mark = clamp(sp.mark + amt, 0, 1); syncMarks(); };
  F.clearMarks = () => { for (const k of SPOTS) F.spot[k].mark = 0; syncMarks(); };
  function syncMarks() {
    SPOTS.forEach((k, i) => { const sp = F.spot[k]; F.skinMat.userData.u.uMarks.value[i].set(sp.bind.x, sp.bind.y, sp.bind.z, sp.mark); });
    if (F.underMat) SPOTS.forEach((k, i) => { const sp = F.spot[k]; F.underMat.userData.u.uMarks.value[i].set(sp.bind.x, sp.bind.y, sp.bind.z, sp.mark * 0.25); });
  }
  syncMarks();
}
// Places on the body for a hand to rest (F.surface takes them as it does the spots): the outer side of the waist, just over the hip, on each side
// (sideL, sideR), the small of the back (back), between the shoulder blades (blades), and the back of the top of each shoulder (shoulderL, shoulderR).
function anchorsOn(F, geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, reg = geo.attributes.region, yW = F.H.waist;
  const torso = [R.CHEST, R.WAIST, R.WAIST_HI, R.HIPS, R.HIPS_LO, R.SEAT];
  const pick = (score, y) => { y = y == null ? yW : y; let best = -1, bs = -1e9; for (let i = 0; i < p.count; i++) { if (!torso.includes(reg.getX(i)) || Math.abs(p.getY(i) - y) > 0.012) continue; const v = score(i); if (v > bs) { bs = v; best = i; } } return best; };
  F.anchor = {};
  for (const [k, sx] of [['sideL', 1], ['sideR', -1]]) { const i = pick(j => (sx * n.getX(j) > 0.75 ? sx * p.getX(j) : -1e9)); F.anchor[k] = { i, bind: new V3(p.getX(i), p.getY(i), p.getZ(i)) }; }
  { const [sx0, sy0] = F.H.shoulder, sh = [...torso, R.UPARM];
    for (const [k, sx] of [['shoulderL', 1], ['shoulderR', -1]]) {
      let best = -1, bs = -1e9;
      for (let i = 0; i < p.count; i++) { if (!sh.includes(reg.getX(i)) || Math.abs(p.getX(i) - sx * sx0) > 0.02 || Math.abs(p.getY(i) - sy0) > 0.03 || n.getZ(i) > -0.3) continue; const v = -p.getZ(i) + 0.5 * p.getY(i); if (v > bs) { bs = v; best = i; } }
      F.anchor[k] = { i: best, bind: new V3(p.getX(best), p.getY(best), p.getZ(best)) };
    } }
  for (const [k, y] of [['back', yW], ['blades', F.H.blades]]) { const i = pick(j => (Math.abs(p.getX(j)) < 0.015 && n.getZ(j) < -0.7 ? -p.getZ(j) : -1e9), y); F.anchor[k] = { i, bind: new V3(p.getX(i), p.getY(i), p.getZ(i)) }; }
}
// Expression and life: the face easing between expressions, blinking, breathing, the hands' grip, the rest pose, the flesh's give.
function finish(F, spec) {
  F.expr = flatExpr('calm'); F.exprTo = flatExpr('calm'); F.exprName = 'calm'; F.drawn = {};
  F.setExpr = (name, o) => { if (EXPRS[name]) { F.exprTo = flatExpr(name); F.exprName = name; if (o) Object.assign(F.exprTo, o); } };      // (o: any of it overridden, e.g. where the eyes look)
  F.t = Math.random() * 10; F.blink = 2 + Math.random() * 3; F.breath = 0.3; F.gaze = new V3(0, 0, 1);
  F.resp = { r: 0, lift: 0, ang: 0 }; F.blushAdd = 0; if (!F.setResponse) F.setResponse = (r, o) => { F.resp.r = clamp(r || 0, 0, 1); F.blushAdd = (o && o.blush) || 0; };
  F.tick = dt => tickFace(F, dt);
  F.rest0 = {}; for (const b of F.bones) F.rest0[b.name] = b.position.clone();
  F.grip = (s, curl, spread, thumb) => grip(F, s, curl, spread, thumb);
  F.resetPose = () => { for (const b of F.bones) { b.rotation.set(0, 0, 0); b.position.copy(F.rest0[b.name]); } F.grip('L'); F.grip('R'); };
  // The flesh's give: a struck cheek pushed in and springing back, and the other answering a little (a damped spring each).
  F.jig = { L: { x: 0, v: 0 }, R: { x: 0, v: 0 } };
  F.impact = (s, power) => { F.jig[s].v += 0.32 * power; F.jig[s === 'L' ? 'R' : 'L'].v += 0.08 * power; };
  F.resetPose();
}

// A hand: the palm (the thumb's pad bulging on its inner side), four fingers of two joints each with rounded tips, and the thumb. Every part
// built along its own bone's line in the rest pose (the hand hanging, palm in, thumb forward), weighted down its length so each joint bends.
function handGeo(BB, S, sd, BI, w, rest) {
  const s = sd > 0 ? 'L' : 'R', k = (S.f ? 0.92 : 1) * HAND_K, H = rest['hand' + s], PALM = sd > 0 ? Math.PI : 0, OUTS = sd > 0 ? 0 : Math.PI;
  const v = a => new V3(a[0], a[1], a[2]);
  // the palm: from inside the wrist to the knuckles; thick at the heel, wide across the knuckles
  const yk = rest['middle1' + s].y, zc = H.z + 0.001 * k;
  const prow = [[H.y + 0.012, 0.016, 0.024], [H.y - 0.006, 0.017, 0.031], [H.y - 0.03, 0.0175, 0.039], [H.y - 0.06, 0.016, 0.043], [yk + 0.01, 0.0135, 0.044], [yk - 0.004, 0.011, 0.04]];
  const hw = P => { const kn = ss(yk + 0.006, yk - 0.008, P[1]); const near = f => Math.exp(-((P[2] - rest[f + '1' + s].z) ** 2) / 0.00012); let tot = 0; const out = [];
    for (const f of FINGERS) { const ww = kn * near(f); tot += ww; out.push(w(f + '1' + s, ww)); } out.push(w('hand' + s, Math.max(0.001, 1 - tot))); return out; };
  BB.sweep(prow.map(([y, rx, rz]) => ({ c: [H.x + 0.002 * sd, y, zc], rx: rx * k, zF: rz * k, zB: rz * k, p: 2.6,
    lobes: th => 0.007 * k * gauss(angDiff(th, PALM + (sd > 0 ? -0.6 : 0.6)), 0.5) * gauss(y - (H.y - 0.035), 0.022) + 0.003 * k * gauss(angDiff(th, OUTS), 0.8) * gauss(y - (H.y - 0.05), 0.03) })),
    16, { weights: hw, region: () => R.HAND, capTop: true, capBottom: false, flip: true, smooth: 1 });
  // a finger (or the thumb): rings round its line from base through its joint to the tip, weighted hand → first joint → second
  const digit = (b1, b2, len2, r0, r1, base) => {
    const A = v([rest[b1].x, rest[b1].y, rest[b1].z]), J = v([rest[b2].x, rest[b2].y, rest[b2].z]), d1 = J.clone().sub(A).normalize();
    const T = J.clone().addScaledVector(d1, len2), Bp = A.clone().addScaledVector(d1, -base), len = T.distanceTo(Bp), dir = T.clone().sub(Bp).normalize();
    // its cross-section's axes: across the back of the hand (x) and across the finger (z), perpendicular to its line
    const ax = new V3(1, 0, 0).addScaledVector(dir, -dir.x).normalize(), az = new V3().crossVectors(ax, dir).negate().normalize();
    const st = [0, 0.18, 0.4, 0.55, 0.72, 0.88, 0.96, 1], rr = [1.05, 1.0, 0.96, 0.9, 0.86, 0.8, 0.62, 0.25];
    const rings = st.map((u, i) => { const P = Bp.clone().addScaledVector(dir, u * len), r = lerp(r0, r1, u) * rr[i] / lerp(1, 0.85, u);
      return { c: [P.x, P.y, P.z], rx: r * 0.86, zF: r, zB: r, p: 2.2, ax: [ax.x, ax.y, ax.z], az: [az.x, az.y, az.z] }; });
    const jt = A.distanceTo(J), wf = P => { const u = new V3(P[0], P[1], P[2]).sub(A).dot(d1); const a1 = ss(base * 0.3, base + 0.004, u + base), a2 = ss(jt - 0.006, jt + 0.006, u);
      return [w('hand' + s, 1 - a1), w(b1, a1 * (1 - a2)), w(b2, a1 * a2)]; };
    BB.sweep(rings, 12, { weights: wf, region: () => R.HAND, capTop: true, flip: true, smooth: 1 });
  };
  const fr = { index: [0.0098, 0.0082, 0.036], middle: [0.0102, 0.0085, 0.04], ring: [0.0096, 0.008, 0.037], pinky: [0.0084, 0.007, 0.03] };
  for (const f of FINGERS) digit(f + '1' + s, f + '2' + s, fr[f][2] * k, fr[f][0] * k, fr[f][1] * k, 0.016 * k);
  digit('thumb1' + s, 'thumb2' + s, 0.03 * k, 0.012 * k, 0.0095 * k, 0.012 * k);
}
// How a hand is held: curl (0 flat … 1 a fist), spread (fingers fanned), thumb (in across the palm).
function grip(F, s, curl, spread, thumb) {
  const sg = s === 'L' ? -1 : 1, c = curl == null ? 0.25 : curl, sp = spread || 0, th = thumb == null ? 0.25 : thumb;
  FINGERS.forEach((f, i) => {
    const b1 = F.bone[f + '1' + s], b2 = F.bone[f + '2' + s];
    b1.rotation.set((i - 1.4) * -0.1 * sp, 0, sg * c * (1.25 + 0.08 * i)); b2.rotation.set(0, 0, sg * c * 1.45);
  });
  F.bone['thumb1' + s].rotation.set(-0.35 * th, sg * 0.25 * th, sg * 0.55 * th); F.bone['thumb2' + s].rotation.set(0, 0, sg * 0.6 * th);
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
  const m = skinned(F, g, tmat(col, { skin: true, rim: '#3a4048', rimK: 0.4 })); m.castShadow = true; F['boot' + s] = m; ink(m, INK_W, F);
}

// ── Clothes, from the same rings, out a little from the skin ─────────────────────────────────────────────────────────────────────────────────
const OUTFITS = {
  // Uniform: Meridian's own duty jacket: slate blue, hip length, closing on a diagonal from the right collarbone to the left hip (a light seam
  // along the edge), a low stand collar in the same cloth, a webbing belt; the department's colour only as a flash on the left shoulder and a
  // band at each cuff. Charcoal trousers with stitched knee panels, black boots.
  uniform: { tunic: '#3e5262', trousers: '#2a2e34', pipe: null, under: '#4a4e56', sleeves: 'long', hem: 0.86, collar: true, edge: '#c8c0ae', belt: '#1e2226' },
  // Off duty: a worn henley with the sleeves pushed up (bone buttons down its placket), canvas trousers with a contrast outer seam, brown boots (frontier-practical).
  offduty: { tunic: '#8a5a3c', trousers: '#5a4a38', pipe: '#3a2a1e', under: '#cfc6b4', sleeves: 'rolled', hem: 0.86, collar: false, edge: '#d8ccb0' },
};
function dress(F, spec, S, BI, w, torsoW, legW, armW) {
  for (const k in F.clothes) { const m = F.clothes[k]; for (const x of [m, m.userData.hull]) if (x) { x.parent.remove(x); x.geometry.dispose(); } }
  F.clothes = {};
  const O = OUTFITS[spec.outfit] || OUTFITS.uniform, st = F.state;
  const add = (key, BB, m) => { const sm = skinned(F, BB.geometry(), m); sm.castShadow = true; sm.receiveShadow = false; F.clothes[key] = sm; ink(sm, INK_W, F); return sm; };
  let hide = 0; const H = r => { hide |= 1 << r; };

  // The top: the tunic (or shirt), hem down over the hips, or raised and rolled above the waist.
  {
    const BB = Builder(), dept = srgb(spec.dept), main = srgb(O.tunic), dark = srgb(shade(O.tunic, -0.25));
    const hem = st.top === 'up' ? 1.075 : O.hem, inf = 0.012;
    const rings = torsoRings(S, inf, true).filter(r => r.c[1] >= hem - 0.03);
    rings[0].c[1] = hem;
    // the hem hangs from the widest of the hips: never narrower than the cloth just above it, and flaring a little
    if (st.top !== 'up') { const r1 = rings.find(r => r.c[1] > hem + 0.005) || rings[1]; rings[0].rx = Math.max(rings[0].rx, r1.rx) + 0.006; rings[0].zB = Math.max(rings[0].zB, r1.zB) + 0.01; rings[0].zF = Math.max(rings[0].zF, r1.zF) + 0.005; rings[0].lobes = r1.lobes; }
    // a rolled band where it's raised
    if (st.top === 'up') { const r0 = rings[0]; rings.unshift({ c: [0, hem - 0.012, r0.c[2]], rx: r0.rx + 0.012, zF: r0.zF + 0.012, zB: r0.zB + 0.012, p: 2.2 }); }
    const top = rings[rings.length - 1]; top.c[1] = O.collar ? 1.545 : 1.50; top.rx = O.collar ? 0.062 : 0.075; top.zF = O.collar ? 0.058 : 0.07; top.zB = O.collar ? 0.062 : 0.068;
    BB.sweep(rings, 36, { weights: torsoW, bindAttr: true, region: () => 0 });
    const sleeveTo = O.sleeves === 'long' ? 0.885 : 1.03;
    for (const sd of [1, -1]) {
      const ar = armRings(S, sd, 0.01, sleeveTo); ar[ar.length - 1].c[1] = sleeveTo;
      if (O.sleeves === 'rolled') { const r = ar[ar.length - 1]; ar.push({ c: [r.c[0], sleeveTo - 0.02, r.c[2]], rx: r.rx + 0.008, zF: r.zF + 0.008, zB: r.zB + 0.008 }); ar[ar.length - 2].rx += 0.01; ar[ar.length - 2].zF += 0.01; ar[ar.length - 2].zB += 0.01; }
      BB.sweep(ar, 18, { weights: armW, capBottom: true, flip: true, region: () => 1 });
    }
    const tm = tmat(O.tunic, { skin: true, side: THREE.DoubleSide, rim: '#2a3440', rimK: 0.6, pattern: 'tunic', bindAttr: true, unique: true }), U = tm.userData.u;
    U.uPat0.value.copy(srgb(spec.dept)); U.uPat1.value.copy(srgb(O.edge || shade(O.tunic, -0.4))); U.uPat2.value.copy(srgb(O.belt || '#222'));
    U.uParam.value.set(hem, st.top === 'up' ? 1 : 0, S.f ? 0.175 : 0.195, spec.outfit === 'uniform' ? 1 : 0);
    add('top', BB, tm);
    H(R.CHEST); H(R.UPARM); H(R.WAIST_HI); if (O.sleeves === 'long') H(R.FOREARM); if (st.top !== 'up') { H(R.WAIST); }
  }
  // The trousers: up to the waist, or lowered and bunched at the knees.
  {
    const BB = Builder(), main = srgb(O.trousers), inf = 0.009, tc = () => null;
    const trm = () => { const m = tmat(O.trousers, { skin: true, side: THREE.DoubleSide, rim: '#2a3440', rimK: 0.6, pattern: 'trousers', bindAttr: true, unique: true }), U = m.userData.u;
      U.uPat0.value.copy(srgb(O.pipe || spec.dept)); U.uParam.value.set(0, st.bottoms === 'down' ? 1 : 0, S.f ? 0.095 : 0.09, spec.outfit === 'uniform' ? 1 : 0); return m; };
    if (st.bottoms !== 'down') {
      const waist = 1.035, rings = torsoRings(S, inf, true).filter(r => r.c[1] <= waist + 0.06 && r.c[1] >= 0.79);
      rings[rings.length - 1].c[1] = waist;
      BB.sweep(rings, 36, { weights: torsoW, capBottom: true });
      for (const sd of [1, -1]) {
        const lr = legRings(S, sd, inf + 0.004, 0.0, -0.82).map(r => (r.c[1] < 0.2 ? Object.assign(r, { rx: r.rx + 0.012, zF: r.zF + 0.014, zB: r.zB + 0.012 }) : r));
        lr[lr.length - 1].c[1] = 0.12;
        BB.sweep(lr, 22, { weights: legW, flip: true });
      }
      // the waistband (and the braces, off duty)
      add('bottoms', BB, trm());
      H(R.HIPS); H(R.HIPS_LO); H(R.SEAT); H(R.THIGH); H(R.KNEE); H(R.SHIN);
    } else {
      // lowered: the waistband round the knees, the cloth gathered in rolls above the boots, a sag of cloth between the legs
      for (const sd of [1, -1]) {
        const lr = legRings(S, sd, inf, -0.38, -0.82).map(r => {
          const y = r.c[1], bunch = ss(0.58, 0.46, y) * ss(0.30, 0.42, y), wob = Math.sin(y * 160) * 0.006 * bunch;
          return Object.assign(r, { rx: r.rx + 0.03 * bunch + wob + (y < 0.2 ? 0.012 : 0.006), zF: r.zF + 0.026 * bunch + wob + 0.006, zB: r.zB + 0.03 * bunch + wob + 0.008 });
        });
        lr[0].c[1] = 0.555; lr[lr.length - 1].c[1] = 0.12;
        lr.unshift({ c: [lr[0].c[0], 0.565, lr[0].c[2]], rx: lr[0].rx - 0.006, zF: lr[0].zF - 0.006, zB: lr[0].zB - 0.006 });
        BB.sweep(lr, 22, { weights: legW, flip: true });
      }
      sag(BB, S, 0.545, 0.47, 0.06, legW, null, inf + 0.03);
      add('bottoms', BB, trm());
      H(R.SHIN);
    }
  }
  // Underwear: briefs (fuller-cut trunks for the men), up, or lowered round the thighs.
  {
    const BB = Builder(), inf = 0.006, col = O.under;
    if (st.under !== 'down') {
      const top = S.f ? 0.965 : 0.985, rings = torsoRings(S, inf, true).filter(r => r.c[1] <= top + 0.06 && r.c[1] >= 0.79);
      rings[rings.length - 1].c[1] = top;
      BB.sweep(rings, 36, { weights: torsoW, capBottom: true });
      const legTo = S.f ? -0.05 : -0.11;
      for (const sd of [1, -1]) { const lr = legRings(S, sd, inf + 0.002, 0.0, legTo - 0.01); lr[lr.length - 1].c[1] = 0.9 + legTo; BB.sweep(lr, 22, { weights: legW, flip: true }); }
      H(R.SEAT); H(R.HIPS_LO);
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
const MOUTHS = { warm: { mw: 0.46, mc: 0.22, mo: 0, mt: 0 }, flat: { mw: 0.42, mc: 0.05, mo: 0, mt: 0 }, smile: { mw: 0.6, mc: 0.6, mo: 0.06, mt: 0.6 }, frown: { mw: 0.48, mc: -0.5, mo: 0, mt: 0 },
  open: { mw: 0.48, mc: -0.15, mo: 0.8, mt: 0.15 }, gritted: { mw: 0.68, mc: -0.8, mo: 0.3, mt: 1 }, pout: { mw: 0.26, mc: -0.2, mo: 0.1, mt: 0 },
  wail: { mw: 0.6, mc: -0.95, mo: 0.42, mt: 0.25 }, sad: { mw: 0.34, mc: -0.7, mo: 0.06, mt: 0 }, concern: { mw: 0.36, mc: -0.28, mo: 0, mt: 0 }, soft: { mw: 0.44, mc: 0.36, mo: 0, mt: 0 } };
const EXPRS = {
  // (the Captain in aftercare: care, warmth and authority in balance; the eyes steady, the brow a touch level and low, the mouth kind)
  caring: { brow: -0.1, browY: -0.03, open: 0.86, mouth: 'warm', blush: 0, ms: 0.95 },
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
const SEX_REST = 0.46, _sq = new THREE.Quaternion(), _sv = new V3();      // (his, at rest, hangs this far forward of straight down)
function tickFace(F, dt) {
  F.t += dt;
  const kk = 1 - Math.exp(-dt * 8), x = F.expr, to = F.exprTo;
  for (const key in to) if (typeof to[key] === 'number') x[key] = lerp(x[key] == null ? to[key] : x[key], to[key], kk);
  if (F.blushAdd) x.blush = Math.max(x.blush, F.blushAdd);
  F.blink -= dt; let bl = 0; if (F.blink < 0) { bl = clamp(1 - Math.abs(F.blink + 0.07) / 0.07, 0, 1); if (F.blink < -0.14) F.blink = 2 + Math.random() * 4; }
  const open = clamp(x.open * (1 - bl), 0, 1.15), d = F.drawn;
  let moved = Math.abs((d.open == null ? -9 : d.open) - open) > 0.004;
  for (const key in x) if (!moved && Math.abs((d[key] == null ? -9 : d[key]) - x[key]) > 0.003) moved = true;
  if (moved) { F.paintFace(x, open); Object.assign(d, x); d.open = open; }
  // breathing: the chest rising and the shoulders with it, faster and deeper when worked up (turns only: the skinning keeps volume)
  F.breathT = (F.breathT || 0) + dt * (1.6 + 2.4 * F.breath);
  const b = Math.sin(F.breathT) * (0.012 + 0.022 * F.breath);
  F.bone.chest.rotation.x -= b * 0.6; F.bone.clavL.rotation.z += b * 0.5; F.bone.clavR.rotation.z -= b * 0.5;
  // the flesh's spring: in along the cheek, a little up
  for (const sd of ['L', 'R']) {
    const J = F.jig[sd], wv = 26, z = 0.22;
    J.v += (-wv * wv * J.x - 2 * z * wv * J.v) * dt; J.x += J.v * dt; J.x = clamp(J.x, -0.02, 0.02);
    const g = F.bone['glute' + sd]; g.position.set(F.rest0['glute' + sd].x, F.rest0['glute' + sd].y + 0.35 * J.x, F.rest0['glute' + sd].z + J.x);
  }
  // his: with no response it hangs with gravity, whichever way the body lies (turned from its rest toward the ground, never back through the
  // thighs); as the response rises it lifts away from that toward where the response puts it, straight. Eased: it swings and settles, it
  // never snaps. (About the bone's own x: from down toward forward.)
  if (F.bone.sex) {
    const R = F.resp, b = F.bone.sex; b.parent.getWorldQuaternion(_sq); _sv.set(0, -1, 0).applyQuaternion(_sq.invert());
    const grav = clamp(Math.atan2(_sv.z, -_sv.y) - (F.L && F.L.sexRest != null ? F.L.sexRest : SEX_REST), 0, 2.0), u = clamp((R.r - 0.1) / 0.35, 0, 1), want = grav + (R.lift - grav) * u * u * (3 - 2 * u);
    R.ang += (want - R.ang) * (1 - Math.exp(-dt * 2.5)); b.rotation.x = -R.ang;
  }
  if (F.tail) {
    const pv = F.tail.piv, q = new THREE.Quaternion(); pv.parent.getWorldQuaternion(q);
    const down = new V3(0, -1, 0).applyQuaternion(q.invert());
    const kx = 1 - Math.exp(-dt * 5); pv.rotation.x = lerp(pv.rotation.x, Math.atan2(-down.z, -down.y) * 0.85, kx); pv.rotation.z = lerp(pv.rotation.z, Math.atan2(down.x, -down.y) * 0.85, kx);
  }
}


// ── The Blender-built figures (models/meridian_f.glb, meridian_m.glb: tools/blender/build_figures.py) ─────────────────────────────────────────────
// Each holds the body (with shape keys toward each extreme of build: muscle, slight, soft, firm, and the bust for her) and the clothing layers over
// it (the uniform's jacket and the off-duty shirt, each down or raised; trousers, up or lowered; briefs, up or lowered; boots), skinned to a
// skeleton named as the one above, in the same units and axes. models/meridian_meta.json gives each joint's place and the body's landmarks (where
// the hems, cuffs, waist and the rest fall). A figure made from them is posed exactly as a built one, and keeps the toon head, face and hair.
// Figure.preload() loads them (make() builds figures in code until it has); Figure.adopt(meta, sex, arrayBuffer) takes one already in hand.
const GLB = { meta: null, sex: {}, ready: null };
function preload(base) {
  if (GLB.ready) return GLB.ready;
  base = base == null ? 'models/' : base;
  if (!THREE.GLTFLoader || typeof fetch === 'undefined') return (GLB.ready = Promise.resolve(false));
  GLB.ready = fetch(base + 'meridian_meta.json').then(r => r.json())
    .then(meta => Promise.all(['f', 'm'].map(sx => fetch(base + 'meridian_' + sx + '.glb').then(r => r.arrayBuffer()).then(buf => adopt(meta, sx, buf)))))
    .then(() => true).catch(e => { console.warn('Figure: the Blender-built models did not load; building the figures in code.', e); GLB.sex = {}; return false; });
  return GLB.ready;
}
function adopt(meta, sx, buf) {
  GLB.meta = meta;
  return new Promise((res, rej) => new THREE.GLTFLoader().parse(buf, '', g => { GLB.sex[sx] = prepare(sx, g, meta[sx]); res(GLB.sex[sx]); }, rej));
}
const ARM_BONES = /^(upperArm|foreArm|hand|index|middle|ring|pinky|thumb)/;
// A GLB's meshes made ready to share between figures: joint indices renumbered to the skeleton's order, weights normalised, the rest pose kept
// (`bind`, for the details drawn on the clothes and the marks), each point of the body given its region (for hiding what's under clothes) and each
// point of a top its part (the body 0, a sleeve 1).
function prepare(sx, gltf, M) {
  const order = Object.keys(M.joints), BIx = {}, L = M.landmarks, mesh = {};
  order.forEach((n, i) => (BIx[n] = i));
  gltf.scene.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry.clone(), map = o.skeleton.bones.map(b => BIx[b.name]), si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count;
    const idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4), dom = new Array(n), wmax = sw.normalized ? (sw.array instanceof Uint8Array ? 255 : 65535) : 1;
    for (let i = 0; i < n; i++) {
      const j = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)], w = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)].map(v => v / wmax), t = w[0] + w[1] + w[2] + w[3] || 1;
      let best = 0;
      for (let k = 0; k < 4; k++) { idx[i * 4 + k] = w[k] > 0 ? map[j[k]] : 0; wt[i * 4 + k] = w[k] / t; if (w[k] > w[best]) best = k; }
      dom[i] = order[map[j[best]]];
    }
    const name = o.name.replace(/_\d+$/, ''), p = g.attributes.position, reg = new Float32Array(n);
    // (the neck's upper part goes with the head, more of it the higher it is: as the head tips back, the nape stays under the skull rather
    // than standing out behind it)
    if (name === 'Body') {
      const y0 = M.joints.neck[1] + 0.004, y1 = M.joints.head[1] + 0.006, hb = BIx.head;
      for (let i = 0; i < n; i++) {
        if (dom[i] !== 'neck' && dom[i] !== 'head') continue;
        const u = clamp((p.getY(i) - y0) / (y1 - y0), 0, 1), t = u * u * (3 - 2 * u); if (t <= 0) continue;
        let k0 = -1;
        for (let k = 0; k < 4; k++) { wt[i * 4 + k] *= 1 - t; if (idx[i * 4 + k] === hb) k0 = k; }
        if (k0 < 0) { k0 = 0; for (let k = 1; k < 4; k++) if (wt[i * 4 + k] < wt[i * 4 + k0]) k0 = k; wt[i * 4 + k0] = 0; idx[i * 4 + k0] = hb; }
        wt[i * 4 + k0] += t; const sum = wt[i * 4] + wt[i * 4 + 1] + wt[i * 4 + 2] + wt[i * 4 + 3]; for (let k = 0; k < 4; k++) wt[i * 4 + k] /= sum;
      }
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
    g.setAttribute('bind', g.attributes.position.clone());
    const part = g.attributes._part;      // (the sex, all of it, is under the briefs, however far it hangs)
    if (name === 'Body') for (let i = 0; i < n; i++) reg[i] = part && part.getX(i) > 0.5 ? R.SEAT : bodyRegion([p.getX(i), p.getY(i), p.getZ(i)], dom[i], L, sx);
    // (her inner form: its own tone, _PART 2)
    if (name === 'Body') { const tn = new Float32Array(n); if (part) for (let i = 0; i < n; i++) tn[i] = part.getX(i) > 1.5 ? 1 : 0; g.setAttribute('tone', new THREE.Float32BufferAttribute(tn, 1)); }
    else if (/^(Tunic|Shirt)/.test(name)) for (let i = 0; i < n; i++) reg[i] = ARM_BONES.test(dom[i]) ? 1 : 0;
    g.setAttribute('region', new THREE.Float32BufferAttribute(reg, 1));
    g.userData.shared = true;
    mesh[name] = { geo: g, keys: Object.assign({}, o.morphTargetDictionary || {}) };
  });
  return { sex: sx, order, joints: M.joints, parents: M.parents, L, mesh };
}
// Where a point of the body is, for hiding what's under each garment: the garments' own edges (from the landmarks) decide it, each region's
// edge a little inside the garment that hides it (so no gap opens at a hem or cuff).
function bodyRegion(P, dom, L, sex) {
  const [x, y, z] = P, sx = x >= 0 ? 1 : -1;
  if (ARM_BONES.test(dom)) {
    const a = (x - sx * L.shX) * sx * Math.sin(L.abd) - (y - L.shoulder) * Math.cos(L.abd);       // (along the arm from the shoulder)
    return a > L.cuffA - 0.015 ? R.HAND : a > L.rollA - 0.015 ? R.FOREARM : R.UPARM;
  }
  if (/^(foot|toe)/.test(dom) || y < L.bootTop - 0.012) return R.FOOT;
  // (the neck above the open shirt's neckline, lower in front, shows with any top; behind, well down inside the collar, which the neck rises
  // out of as the head goes forward)
  if (Math.cos(0.42) * (y - L.neckline) + Math.sin(0.42) * z > -0.006 - 0.032 * clamp(-z / 0.04, 0, 1)) return R.HEAD;
  if (y >= L.hemUp + 0.06) return R.CHEST;
  if (y >= L.hemUp + 0.04) return R.WAIST_HI;      // (well up under the raised hem, which rides up as they bend)
  if (y >= L.trouserTop - 0.01) return R.WAIST;
  if (y >= L.briefTop - 0.008) return R.HIPS;
  // under the briefs (to their leg openings: cut high at the sides for her) is the seat; below, the thighs, the knee (just above where lowered
  // trousers bunch) and the shins
  const bc = L.briefCut || [0.012, L.briefLeg - 0.006, 0.4375];
  const inBriefs = sex === 'f' ? ((x * sx - bc[0]) * bc[2] - (y - bc[1])) / Math.hypot(1, bc[2]) < -0.009 : y >= L.briefLeg + 0.009;
  if (y >= L.briefTop - 0.022 && inBriefs) return R.HIPS_LO;      // (only within the leg openings: hers rise nearly to the waistband at the hip)
  if (inBriefs) return R.SEAT;
  if (y >= L.downTop + 0.02) return R.THIGH;
  if (y >= L.downTop - 0.04) return R.KNEE;
  return R.SHIN;
}
// The body's build, as the shape keys' amounts: mass (muscle and frame) toward muscle or slight, fat toward soft or firm; her bust's size (0 small
// – 1 large; the model as built is about 0.4) toward the smaller or the larger; his sex likewise, by the same number (spec.size if given, else
// the bust's, held a little short of the largest: the Captain's is given as 1).
function bodyKeys(spec) {
  const m = spec.mass == null ? 0.5 : spec.mass, fat = spec.fat == null ? 0.4 : spec.fat, b = spec.bust == null ? 0.4 : spec.bust, her = spec.sex === 'f';
  const z = spec.size != null ? spec.size : 0.25 + 0.6 * b;
  return { muscle: clamp((m - 0.5) / 0.4, 0, 1), slight: clamp((0.5 - m) / 0.25, 0, 1) * 0.8, soft: clamp((fat - 0.4) / 0.35, 0, 1), firm: clamp((0.4 - fat) / 0.3, 0, 1) * 0.8,
    bust: her ? clamp((b - 0.4) / 0.6, 0, 1) : 0, bustSmall: her ? clamp((0.4 - b) / 0.4, 0, 1) : 0,
    sexLarge: her ? 0 : clamp((z - 0.4) / 0.6, 0, 1), sexSmall: her ? 0 : clamp((0.4 - z) / 0.4, 0, 1), sexSwell: 0 };
}
function setKeys(mesh, keys) {
  const dict = mesh.geometry.userData.keys || {}, inf = mesh.morphTargetInfluences;
  if (inf) for (const k in dict) inf[dict[k]] = keys[k] || 0;
}
function makeGLB(spec, T) {
  const S = shapeOf(spec), F = { spec, S, root: new THREE.Group(), bone: {}, bones: [], model: T, L: T.L };
  F.root.scale.setScalar(spec.height / T.L.height);
  for (const name of T.order) {
    const par = T.parents[name], p = T.joints[name], q = par ? T.joints[par] : [0, 0, 0];
    const b = new THREE.Bone(); b.name = name; b.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    (par ? F.bone[par] : F.root).add(b); F.bone[name] = b; F.bones.push(b);
  }
  F.root.updateMatrixWorld(true);
  F.skeleton = new THREE.Skeleton(F.bones); F.bindM = F.root.matrixWorld.clone();
  F.rest = {}; for (const b of F.bones) F.rest[b.name] = b.getWorldPosition(new V3());
  F.H = { hips: T.joints.hips[1], ankle: T.joints.footL[1], sit: T.joints.hips[1] - T.L.crotch + 0.008, abd: T.L.abd, waist: T.L.waist - 0.03, blades: T.L.armpit + 0.03, shoulder: [T.L.shX * 0.95, T.L.shoulder + 0.02] };
  F.keys = bodyKeys(spec);
  for (const k in T.mesh) T.mesh[k].geo.userData.keys = T.mesh[k].keys;
  // the body
  const skinM = tmat(spec.skin, { skin: true, morph: true, regions: true, marks: true, bindAttr: true, tone: true, unique: true, rim: '#6a5048', rimK: 0.5 });
  F.body = skinned(F, T.mesh.Body.geo, skinM); F.body.castShadow = true; F.body.receiveShadow = false; F.skinMat = skinM;
  // (the nape, from just above the collar up under the skull, isn't drawn: the head's own skin is there, and the neck's would show through the
  // back of the head as it tips back; cut level behind, rising round the sides toward the jaw)
  skinM.userData.u.uNape.value.set(T.L.collar + 0.002, -0.025, 1, 3);
  // The body's response, 0–1 (the session decides how much, and how far it may go): the sex fuller (the shape key), his lifting on its bone
  // (eased toward, in tick), a deeper tone there; and, given, a blush on the face besides whatever the expression has.
  F.setResponse = (r, o) => {
    r = clamp(r || 0, 0, 1); o = o || {};
    const swell = clamp(r * (spec.sex === 'f' ? 0.9 : 1.2), 0, 1), u = clamp((r - 0.12) / 0.88, 0, 1);
    F.resp.r = r; F.resp.lift = 2.0 * u * u * (3 - 2 * u);
    if (Math.abs((F.keys.sexSwell || 0) - swell) > 0.004) { F.keys.sexSwell = swell; F.root.traverse(m => { if (m.isSkinnedMesh && m.morphTargetInfluences) setKeys(m, F.keys); }); }
    skinM.userData.u.uFlush.value.set(clamp(r * 1.7, 0, 1), T.L.crotch, 0.0, spec.sex === 'm' ? 1 : 0);
    skinM.userData.u.uFlushC.value.set(clamp((o.chest || 0) * 1.8, 0, 1), T.L.armpit - 0.07, T.L.neck + 0.015, 1);
    F.blushAdd = o.blush || 0;
  };
  { const hm = dqs(paint(new THREE.MeshBasicMaterial(Object.assign({ color: srgb(INK), side: THREE.BackSide, skinning: true, morphTargets: true }, HULL_OFS)), { regions: true, grain: 0 })); hm.userData.u.uHide = skinM.userData.u.uHide; hm.userData.u.uNape = skinM.userData.u.uNape; ink(F.body, INK_W, F, hm); }
  const L = T.L;
  // the seat's spots from its own shape (measured in Blender): the cheek where it's fullest, the sit spot just above the fold beneath it, the
  // thighs below the fold (for a flatter seat, within sensible bounds of the fullest point)
  const pk = clamp(L.seatPeak, L.crotch + 0.02, L.crotch + 0.045), sit = Math.min(clamp(L.seatFold, pk - 0.07, pk - 0.03) + 0.012, pk - 0.05);
  const SEAT = { cheek: [L.hipX * 0.84, pk], sitspot: [L.hipX * 0.86, sit], thighs: [L.hipX * 0.95, sit - 0.06] };
  spotsOn(F, T.mesh.Body.geo, area => SEAT[area], 0.006);
  buildHead(F, spec, S);
  // the clothes: each garment made when it's first worn, then shown or hidden
  F.gm = {}; F.clothes = {};
  F.state = { top: 'down', bottoms: 'up', under: 'up' };
  F.setClothes = st => { Object.assign(F.state, st || {}); dressGLB(F); };
  F.setOutfit = (outfit, dept) => { spec.outfit = outfit; if (dept) spec.dept = dept; for (const k in F.gm) { const m = F.gm[k]; for (const x of [m, m.userData.hull]) if (x) x.parent.remove(x); } F.gm = {}; F.setClothes(); };
  F.setClothes();
  finish(F, spec);
  return F;
}
function garmentGLB(F, name) {
  if (F.gm[name]) return F.gm[name];
  const spec = F.spec, O = OUTFITS[spec.outfit] || OUTFITS.uniform, L = F.L, uni = spec.outfit === 'uniform' ? 1 : 0, geo = F.model.mesh[name].geo;
  let m;
  if (/^(Tunic|Shirt)/.test(name)) {
    m = tmat(O.tunic, { skin: true, morph: true, side: THREE.DoubleSide, rim: '#2a3440', rimK: 0.6, pattern: 'tunicG', bindAttr: true, unique: true });
    const U = m.userData.u; U.uPat0.value.copy(srgb(spec.dept)); U.uPat1.value.copy(srgb(O.edge || shade(O.tunic, -0.4))); U.uPat2.value.copy(srgb(O.belt || '#222'));
    const up = /Up$/.test(name);
    U.uParam.value.set(up ? L.hemUp : L.hem, up ? 1 : 0, L.shX, uni);
    U.uL0.value.set(0, 0, L.collar, L.waist); U.uL1.value.set(L.shoulder, L.armpit, L.shoulder - L.cuffA * Math.cos(L.abd), L.neckline);
  } else if (/^Trousers/.test(name)) {
    m = tmat(O.trousers, { skin: true, morph: true, side: THREE.DoubleSide, rim: '#2a3440', rimK: 0.6, pattern: 'trousersG', bindAttr: true, unique: true });
    const U = m.userData.u; U.uPat0.value.copy(srgb(O.pipe || spec.dept)); U.uParam.value.set(0, /Down$/.test(name) ? 1 : 0, L.hipX, uni); U.uL0.value.set(L.knee, L.trouserTop, 0, 0);
  } else if (/^Briefs/.test(name)) {
    F.underMat = F.underMat || tmat(O.under, { skin: true, morph: true, side: THREE.DoubleSide, marks: true, bindAttr: true, unique: true, markCol: shade(O.under, -0.2), rim: '#2a3440', rimK: 0.5 });
    m = F.underMat;
  } else m = tmat(spec.outfit === 'offduty' ? '#4a3424' : '#1e2024', { skin: true, morph: true, rim: '#3a4048', rimK: 0.4 });
  const depth = /^Briefs/.test(name) ? 2 : /^Trousers/.test(name) ? 1 : 0;
  if (depth) { m.polygonOffset = true; m.polygonOffsetFactor = depth; m.polygonOffsetUnits = 2 * depth; }
  const sm = skinned(F, geo, m); sm.castShadow = true; sm.receiveShadow = false; ink(sm, INK_W, F, null, HEM_R);
  F.gm[name] = sm; return sm;
}
function dressGLB(F) {
  const st = F.state, tops = F.spec.outfit === 'offduty' ? ['Shirt', 'ShirtUp'] : ['Tunic', 'TunicUp'];
  const want = { top: tops[st.top === 'up' ? 1 : 0], bottoms: st.bottoms === 'down' ? 'TrousersDown' : 'Trousers', under: st.under === 'down' ? 'BriefsDown' : 'Briefs', boots: 'Boots' };
  const on = new Set(Object.values(want));
  for (const k of Object.values(want)) garmentGLB(F, k);
  for (const k in F.gm) { const m = F.gm[k], v = on.has(k); m.visible = v; if (m.userData.hull) m.userData.hull.visible = v; }
  F.clothes = { top: F.gm[want.top], bottoms: F.gm[want.bottoms], under: F.gm[want.under] }; F.bootL = F.bootR = F.gm.Boots;
  // the skin under each garment hidden (so nothing pokes through as they move)
  let hide = 1 << R.FOOT; const H = r => { hide |= 1 << r; };
  H(R.CHEST); H(R.UPARM); H(R.WAIST_HI); if (F.spec.outfit !== 'offduty') H(R.FOREARM); if (st.top !== 'up') H(R.WAIST);
  if (st.bottoms !== 'down') { H(R.HIPS); H(R.HIPS_LO); H(R.SEAT); H(R.THIGH); H(R.KNEE); H(R.SHIN); } else H(R.SHIN);
  if (st.under !== 'down') { H(R.SEAT); H(R.HIPS_LO); }
  F.skinMat.userData.u.uHide.value = hide;
  if (F.spot) for (const k of SPOTS) F.mark(k, 0);      // (the briefs' copy of the marks)
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
  // (the upper bone's rest direction to its joint need not be straight down its -y: turned so that direction lies along u1; then the lower bone
  // turned the least that takes its own rest direction onto f)
  const q0 = new THREE.Quaternion().setFromUnitVectors(new V3(0, -1, 0), b.position.clone().normalize());
  setWorldQuat(a, new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(X, Y, Z)).multiply(q0.invert()));
  a.updateMatrixWorld(true);
  const fl = f.clone().applyQuaternion(a.getWorldQuaternion(new THREE.Quaternion()).invert());
  b.quaternion.setFromUnitVectors(c.position.clone().normalize(), fl.normalize());
  F.root.updateMatrixWorld(true);
}
// Turn a bone so its local axes point the given world ways: X and Y (Y made perpendicular to X).
function aim(obj, X, Y) {
  const x = X.clone().normalize(), z = new V3().crossVectors(x, Y).normalize(), y = new V3().crossVectors(z, x);
  setWorldQuat(obj, new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z)));
}

const api = { tmat, ink, dqs, grip, FINGERS, make, preload, adopt, models: () => Object.keys(GLB.sex), EXPRS, MOUTHS, HEAD_SCALE, OUTFITS, SPOTS, ik2, aim, setWorldQuat, mat, paint, srgb, shade, R };
root.Figure = api;
})(typeof window !== 'undefined' ? window : globalThis);
