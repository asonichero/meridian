// Project Meridian — Reactor and propulsion (docs/ship.md: the stern, behind the shadow shield; the spine ends at its hatch; Sam's domain, the
// Engineer's station). The core fills the middle of the room, floor to ceiling, banded and glowing, coolant trunks running from its crown into
// the deckhead; a raised plinth round its foot, a guard rail round that, a gate in it aft; a grated walkway round the rail with room to the
// walls. The shadow shield forward, the hatch in it; the Engineer's console bank and harnessed seat against the aft bulkhead; a heavy parts
// crate against the hull by the fore corner, a tool chest, spares racked on the walls. Loud and hot, sharp shadows, orange light.
// No seat for aftercare: it's always taken elsewhere (the garden bench in hydroponics, or their own quarters).
//
//   const rx = Reactor.build(scene) → the same shape as Mess.build
//   spots.bench: across the knee on the parts crate, square to it (the near arm on its lid); spots.wall: standing at the guard rail, facing
//   the core, hands on the top rail; spots.after: none (afterElsewhere); watch: round the walkway; corner: facing the shadow shield.
// Its frame: x along the ship (fore −x), z across it.
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3;
const K = root.SuitBay.kit, rnd = K.rnd, speckle = K.speckle;
const X0 = -4.5, X1 = 4.5, Z0 = -4.5, Z1 = 4.5, HT = 3.2;
const CR = 1.5, PR = 1.85, RR = 2.5, RY = 1.05;      // the core's radius, its plinth's, the guard rail's ring, its top rail's height
// the parts crate against the hull by the fore corner (from KX0 to KX1, out to KZ), its lid
const KX0 = -3.65, KX1 = -2.35, KZ = Z1 - 0.72, KY = 0.48;

// ── Painted textures ──
const coreTex = K.canvasTex(512, 512, (c, w, h) => {
  c.fillStyle = '#3a3a3c'; c.fillRect(0, 0, w, h); speckle(c, w, h, 1600, '#000', 0.12, 4); speckle(c, w, h, 600, '#8a6a4a', 0.08, 4);
  for (let x = 0; x < w; x += 64) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(x, 0, 4, h); c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x + 4, 0, 2, h); }
  for (let y = 0; y < h; y += 128) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, y, w, 6); for (let x = 16; x < w; x += 32) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.beginPath(); c.arc(x, y + 14, 4, 0, 7); c.fill(); } }
  const g = c.createLinearGradient(0, h * 0.55, 0, h); g.addColorStop(0, 'rgba(160,80,30,0)'); g.addColorStop(1, 'rgba(160,80,30,0.25)'); c.fillStyle = g; c.fillRect(0, 0, w, h);      // (heat-stained low down)
}, [3, 1]);
const hazardTex = K.canvasTex(256, 32, (c, w, h) => { c.fillStyle = '#d8a82a'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; for (let x = -32; x < w; x += 32) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 16, 0); c.lineTo(x + 32, 0); c.lineTo(x + 16, h); c.fill(); } }, [8, 1]);
const crateTex = K.canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = '#4a5a3a'; c.fillRect(0, 0, w, h); speckle(c, w, h, 900, '#000', 0.12, 3); speckle(c, w, h, 300, '#c8c0a0', 0.08, 3);
  c.strokeStyle = '#2a3020'; c.lineWidth = 6; c.strokeRect(4, 4, w - 8, h - 8); c.beginPath(); c.moveTo(4, 4); c.lineTo(w - 4, h - 4); c.stroke();
  c.fillStyle = 'rgba(220,210,180,0.75)'; c.font = '600 18px monospace'; c.fillText('SPARES · DRIVE', 20, h - 24); c.font = '12px monospace'; c.fillText('PN 7741-B  HEAVY', 20, h - 8);
});
const panelTex = K.canvasTex(320, 200, (c, w, h) => {
  c.fillStyle = '#0c0a08'; c.fillRect(0, 0, w, h); c.strokeStyle = '#4a3a20'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = '#ff9a3a'; c.font = '600 16px monospace'; c.fillText('REACTOR · DRIVE', 16, 30);
  c.font = '13px monospace'; for (const [i, [k, v, f]] of [['CORE TEMP', '1,142 K', 0.72], ['FLUX', '98.6 %', 0.98], ['COOLANT', 'NOMINAL', 0.8], ['THRUST', 'COAST', 0.05], ['SHIELD', 'NOMINAL', 0.9]].entries()) {
    c.fillStyle = 'rgba(255,154,58,0.85)'; c.fillText(k, 16, 62 + i * 26); c.fillText(v, 200, 62 + i * 26); c.fillStyle = 'rgba(255,154,58,0.25)'; c.fillRect(16, 67 + i * 26, 270, 4); c.fillStyle = 'rgba(255,154,58,0.85)'; c.fillRect(16, 67 + i * 26, 270 * f, 4); }
  c.fillStyle = 'rgba(255,154,58,0.06)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});
const trefoilTex = K.canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#e8c02a'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(64, 64, 9, 0, 7); c.fill();
  for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; c.beginPath(); c.moveTo(64, 64); c.arc(64, 64, 50, a - 0.52, a + 0.52); c.closePath(); c.fill(); }
  c.fillStyle = '#e8c02a'; c.beginPath(); c.arc(64, 64, 15, 0, 7); c.fill(); c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(64, 64, 9, 0, 7); c.fill();
});

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const detail = [];
  const std = (o) => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0.4 }, o)), { grain: 0.05, scale: 8 });
  const box = (w, h, d, m, x, y, z, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; b.castShadow = !(o && o.noCast); b.receiveShadow = true; ((o && o.to) || G).add(b); if (o && o.detail) detail.push(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, rot, seg, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 16, 1, !!(o && o.open)), m); c.position.set(x, y, z); if (rot) c.rotation.set(rot[0], rot[1], rot[2]); c.castShadow = !(o && o.noCast); c.receiveShadow = true; ((o && o.to) || G).add(c); if (o && o.detail) detail.push(c); return c; };
  const plane = (w, h, m, x, y, z, rx, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx || 0, ry || 0, 0); p.receiveShadow = true; G.add(p); return p; };

  const wallM = std({ map: K.panelTex('#5a5652', [1, 1]), roughness: 0.55, metalness: 0.45 }), shieldM = std({ map: K.panelTex('#3a3634', [1, 1]), roughness: 0.5, metalness: 0.55 });
  const steelDark = std({ map: K.panelTex('#2a2c2e', [1, 1]), roughness: 0.55, metalness: 0.5 }), steel = std({ color: srgb('#9a9a98'), roughness: 0.35, metalness: 0.75 });
  const yellow = std({ color: srgb('#d8a82a'), roughness: 0.5, metalness: 0.3 }), hazard = std({ map: hazardTex, roughness: 0.6, metalness: 0.2 });
  const pipeM = std({ color: srgb('#6a6058'), roughness: 0.35, metalness: 0.8 }), pipeR = std({ color: srgb('#8a3a2a'), roughness: 0.45, metalness: 0.6 }), pipeB = std({ color: srgb('#3a5a7a'), roughness: 0.45, metalness: 0.6 });
  const glowO = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ff7a2a'), emissiveIntensity: 5 });      // (the core's bands)
  const glowR = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ff3a2a'), emissiveIntensity: 3 });
  const glowW = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#e8eef8'), emissiveIntensity: 3 });

  // ── The shell: a grated deck, steel walls (the shadow shield forward, darker, heavier), a deckhead of beams ──
  const floor = plane(X1 - X0, Z1 - Z0, std({ map: K.gratingTex, roughness: 0.45, metalness: 0.7 }), 0, 0, 0, -Math.PI / 2);
  plane(X1 - X0, Z1 - Z0, std({ map: K.panelTex('#3a3836', [4, 4]), roughness: 0.6, metalness: 0.4 }), 0, HT, 0, Math.PI / 2);
  const wallRun = (len, x, z, ry, m) => { const n = Math.max(1, Math.round(len / 1.0)), pw = len / n;
    for (let i = 0; i < n; i++) { const off = -len / 2 + pw * (i + 0.5); plane(pw - 0.01, HT, m, x + Math.cos(ry) * off, HT / 2, z - Math.sin(ry) * off, 0, ry); } };
  wallRun(X1 - X0, 0, Z0, 0, wallM); wallRun(X1 - X0, 0, Z1, Math.PI, wallM); wallRun(Z1 - Z0, X1, 0, -Math.PI / 2, wallM); wallRun(Z1 - Z0, X0, 0, Math.PI / 2, shieldM);
  for (const z of [Z0 + 0.05, Z1 - 0.05]) box(X1 - X0, 0.12, 0.02, hazard, 0, 0.06, z, { noCast: true });
  for (const [x, z] of [[X0, Z0], [X1, Z0], [X0, Z1], [X1, Z1]]) box(0.16, HT, 0.16, steelDark, x, HT / 2, z);
  for (const x of [-3, -1.5, 1.5, 3]) box(0.14, 0.18, Z1 - Z0, steelDark, x, HT - 0.09, 0);
  // (the shield's ribs and the trefoil; the hatch in it, from the spine)
  for (const z of [-3.2, -1.2, 1.2, 3.2]) box(0.12, HT, 0.16, steelDark, X0 + 0.06, HT / 2, z);
  box(1.3, 2.3, 0.14, steelDark, X0 + 0.07, 1.15, 0, { ry: Math.PI / 2 }); box(0.06, 2.1, 1.1, std({ map: K.panelTex('#5a5046', [1, 1]), roughness: 0.5, metalness: 0.55 }), X0 + 0.12, 1.07, 0);
  box(0.02, 0.03, 0.5, glowR, X0 + 0.16, 2.2, 0, { noCast: true });
  plane(0.42, 0.42, std({ map: trefoilTex, roughness: 0.6, metalness: 0.1 }), X0 + 0.02, 1.7, -1.9, 0, Math.PI / 2); plane(0.42, 0.42, std({ map: trefoilTex, roughness: 0.6, metalness: 0.1 }), X0 + 0.02, 1.7, 1.9, 0, Math.PI / 2);

  // ── The core: floor to ceiling, banded, slotted, its glow showing at the bands; coolant trunks from its crown; the plinth, hazard-striped ──
  const coreM = std({ map: coreTex, roughness: 0.4, metalness: 0.75 });
  cyl(CR, CR, HT - 0.3, coreM, 0, 0.15 + (HT - 0.3) / 2, 0, null, 40);
  for (const y of [0.7, 1.35, 2.0, 2.6]) { cyl(CR + 0.06, CR + 0.06, 0.12, steelDark, 0, y, 0, null, 40); cyl(CR + 0.065, CR + 0.065, 0.03, glowO, 0, y, 0, null, 40, { noCast: true, open: true }); }
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.02), glowO); s.position.set(Math.cos(a) * (CR + 0.005), 1.02, Math.sin(a) * (CR + 0.005)); s.rotation.y = -a + Math.PI / 2; G.add(s); }
  cyl(PR, PR + 0.05, 0.15, steelDark, 0, 0.075, 0, null, 40); cyl(PR + 0.051, PR + 0.051, 0.1, hazard, 0, 0.08, 0, null, 48, { noCast: true, open: true });
  cyl(CR * 0.9, CR + 0.1, 0.3, steelDark, 0, HT - 0.15, 0, null, 40);
  const run = (m, r, a, b) => { const v = new V3().subVectors(b, a), c = cyl(r, r, v.length(), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, null, 14); c.quaternion.setFromUnitVectors(new V3(0, 1, 0), v.normalize()); return c; };
  for (const [a, m] of [[Math.PI * 0.25, pipeR], [Math.PI * 0.75, pipeB], [Math.PI * 1.25, pipeR], [Math.PI * 1.75, pipeB]]) {
    const p0 = new V3(Math.cos(a) * 1.1, HT - 0.2, Math.sin(a) * 1.1), p1 = new V3(Math.cos(a) * 3.6, HT - 0.35, Math.sin(a) * 3.6);
    run(m, 0.14, p0, p1); run(m, 0.14, p1, new V3(p1.x, HT, p1.z)); cyl(0.19, 0.19, 0.08, steelDark, p1.x * 0.7, (p0.y + p1.y) / 2, p1.z * 0.7, null, 14, { detail: true });
  }

  // ── The guard rail round the plinth: posts, a top rail and a mid rail, a gate aft ──
  const GAP = 0.32;
  for (const [y, r] of [[RY, 0.025], [0.55, 0.02]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(RR, r, 8, 96, Math.PI * 2 - GAP), yellow); t.rotation.x = Math.PI / 2; t.rotation.z = GAP / 2; t.position.y = y; t.castShadow = true; G.add(t); }
  for (let i = 0; i < 24; i++) { const a = GAP / 2 + i * (Math.PI * 2 - GAP) / 23; cyl(0.025, 0.025, RY, yellow, Math.cos(a) * RR, RY / 2, -Math.sin(a) * RR, null, 8); }

  // ── The Engineer's console bank against the aft bulkhead, the harnessed seat in front of it ──
  box(0.6, 0.95, 3.0, steelDark, X1 - 0.3, 0.475, 0); box(0.66, 0.04, 3.04, std({ color: srgb('#2a2826'), roughness: 0.4, metalness: 0.5 }), X1 - 0.33, 0.97, 0);
  box(0.06, 0.6, 2.8, steelDark, X1 - 0.05, 1.5, 0);
  for (const [z, tex] of [[-0.9, panelTex], [0.9, panelTex]]) plane(1.1, 0.5, new THREE.MeshBasicMaterial({ map: tex }), X1 - 0.085, 1.5, z, 0, -Math.PI / 2);
  for (let i = 0; i < 14; i++) box(0.02, 0.02, 0.05, [glowO, glowR, glowW][i % 3], X1 - 0.62, 0.99, -1.3 + i * 0.2, { noCast: true, detail: true });
  { const sx = X1 - 1.1; box(0.52, 0.1, 0.52, std({ color: srgb('#4a3a2a'), roughness: 0.7, metalness: 0.1 }), sx, 0.52, 0); box(0.1, 0.8, 0.5, std({ color: srgb('#4a3a2a'), roughness: 0.7, metalness: 0.1 }), sx - 0.25, 0.95, 0);
    cyl(0.04, 0.04, 0.47, steel, sx, 0.235, 0, null, 10); cyl(0.24, 0.26, 0.03, steelDark, sx, 0.015, 0, null, 16);
    for (const dz of [-0.13, 0.13]) box(0.02, 0.66, 0.05, std({ color: srgb('#c8902a'), roughness: 0.8 }), sx - 0.19, 0.98, dz, { detail: true }); box(0.03, 0.06, 0.08, steel, sx - 0.18, 0.68, 0, { detail: true }); }

  // ── The parts crate against the hull by the fore corner (kept: they're over it); a tool chest beside it; spares racked on the hull wall ──
  const crate = new THREE.Group(); crate.userData.keep = true; G.add(crate);
  const kl = KX1 - KX0, kx = (KX0 + KX1) / 2, kd = 0.64, kz = KZ + kd / 2;
  box(kl, KY - 0.04, kd, std({ map: crateTex, roughness: 0.75, metalness: 0.15 }), kx, (KY - 0.04) / 2, kz, { to: crate });
  box(kl + 0.02, 0.04, kd + 0.02, std({ color: srgb('#3a4a2e'), roughness: 0.7, metalness: 0.2 }), kx, KY - 0.02, kz, { to: crate });
  for (const x of [KX0 + 0.12, KX1 - 0.12]) box(0.05, KY + 0.005, kd + 0.03, steel, x, KY / 2, kz, { to: crate });
  box(0.7, 0.85, 0.5, std({ color: srgb('#a83a2a'), roughness: 0.4, metalness: 0.5 }), KX1 + 0.65, 0.425, Z1 - 0.3);
  for (let i = 1; i < 5; i++) box(0.66, 0.01, 0.01, steelDark, KX1 + 0.65, 0.85 * i / 5, Z1 - 0.55, { noCast: true, detail: true });
  for (const y of [1.3, 1.9]) { box(2.6, 0.04, 0.4, steel, 1.6, y, Z1 - 0.2); for (let i = 0; i < 8; i++) box(0.2, 0.18 + rnd() * 0.2, 0.25, std({ color: srgb(['#6a6a68', '#4a5a3a', '#8a7a5a'][i % 3]), roughness: 0.6, metalness: 0.4 }), 0.5 + i * 0.32, y + 0.12, Z1 - 0.2, { detail: true }); }
  box(0.12, 0.45, 0.12, std({ color: srgb('#c82a2a'), roughness: 0.4, metalness: 0.4 }), X1 - 0.25, 0.4, Z0 + 0.25, { detail: true });      // (an extinguisher)
  // (the work lights in their cages, and the warning lamps by the hatch)
  for (const [x, z] of [[-3.0, -3.0], [3.0, -3.0], [-3.0, 3.0], [3.0, 3.0]]) { box(0.5, 0.06, 0.2, steelDark, x, HT - 0.22, z); box(0.44, 0.02, 0.14, glowW, x, HT - 0.26, z, { noCast: true }); }
  for (const z of [-0.85, 0.85]) cyl(0.06, 0.06, 0.1, glowR, X0 + 0.12, 2.35, z, [0, 0, Math.PI / 2], 12, { noCast: true });

  // ── Light: the core's orange, hot and close; cool work lights from the corners; a key over the crate and the rail, its shadows sharp ──
  const hemi = new THREE.HemisphereLight(srgb('#ffc8a0'), srgb('#2a1a14'), 0.6); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#3a2a24'), 0.5); G.add(amb);
  const coreL = [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2 + Math.PI / 4, l = new THREE.PointLight(srgb('#ff7a30'), 3.0, 6, 2); l.position.set(Math.cos(a) * 2.0, 1.5, Math.sin(a) * 2.0); G.add(l); return l; });
  const work = [[-3.0, -3.0], [3.0, 3.0]].map(([x, z]) => { const l = new THREE.PointLight(srgb('#e8eef8'), 1.4, 6, 2); l.position.set(x, HT - 0.4, z); G.add(l); return l; });
  const key = new THREE.SpotLight(srgb('#ffd8b0'), 7, 8, 0.9, 0.35, 2); key.position.set(-1.6, HT - 0.1, 0.4); key.target.position.set(-2.2, 0, 2.2);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 2; key.shadow.camera.near = 0.3; key.shadow.camera.far = 7; G.add(key); G.add(key.target);
  const key2 = new THREE.SpotLight(srgb('#ffc890'), 6, 7, 0.8, 0.35, 2); key2.position.set(0.6, HT - 0.1, -2.6); key2.target.position.set(0, 0, -3.3); G.add(key2); G.add(key2.target);

  // ── Where things happen ──
  const spots = {
    // (across the knee on the parts crate, square to it, facing the core: they lie along it in front, the head toward the shield, the near arm on
    // its lid)
    bench: { at: new V3(kx + 0.05, 0, KZ + 0.13), yaw: Math.PI, turn: 0, seatY: KY, rest: { y: KY, edge: 0.13 } },
    // (standing at the guard rail on the spine-side walkway, facing the core, hands on the top rail, bent to it)
    wall: { at: new V3(0, 0, -(RR + 0.83)), yaw: 0, support: { kind: 'rail', y: RY, d: 0.83, bend: 0.72, r: 0.025 } },
    after: null,
    watch: [{ at: new V3(-2.2, 0, -3.7), yaw: 0 }, { at: new V3(2.3, 0, -3.5), yaw: 0 }, { at: new V3(3.4, 0, -1.9), yaw: 0 }, { at: new V3(3.2, 0, 2.3), yaw: 0 },
      { at: new V3(0.4, 0, 3.6), yaw: 0 }, { at: new V3(-3.6, 0, -1.6), yaw: 0 }],
    corner: { at: new V3(X0 + 0.45, 0, -3.4), yaw: -Math.PI / 2, next: { base: new V3(0, 0, 0), step: new V3(0, 0, 0.75), yaw: -Math.PI / 2 } },
  };

  const meshes = []; G.traverse(o => { if (o.isMesh) meshes.push(o); });
  const cast0 = new Map(meshes.map(m => [m, m.castShadow]));
  let low = false, time = 'day';
  function apply() {
    const day = time === 'day';
    for (const m of meshes) m.castShadow = low ? false : cast0.get(m);
    for (const d of detail) d.visible = !low;
    coreL[1].visible = coreL[3].visible = !low; key2.visible = !low;
    for (const l of work) l.intensity = day ? 1.4 : 0.5;
    hemi.intensity = (day ? 0.6 : 0.45) + (low ? 0.3 : 0); amb.intensity = day ? 0.5 : 0.4;
    for (const l of coreL) l.intensity = low ? 4.5 : 3.0;
    const sz = low ? 1024 : 2048;
    if (key.shadow.mapSize.x !== sz) { key.shadow.mapSize.set(sz, sz); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  }
  const setLow = on => { low = !!on; apply(); }, setTime = t => { time = t === 'night' ? 'night' : 'day'; apply(); };
  apply();
  const { sideOf, sidesAt } = K.roomSides(G, { minX: X0, maxX: X1, minZ: Z0, maxZ: Z1, ht: HT }, [floor, crate]);
  let t = 0;
  // (at the guard rail: their face from just inside the rail, low, looking back up at them; the room from high in the corner behind them)
  const cams = { wall: [['Side', [-1.9, 1.4, -0.05], [0.1, 1.0, 0.1]], ['Behind', [-0.35, 1.2, -1.25], [0, 0.85, 0.15]], ['Seat', [-0.55, 1.25, -0.75], [0, 0.88, 0]],
    ['Their face', [0.3, 0.92, 1.15], [0.0, 1.05, 0.55]], ['Captain', [-0.4, 1.42, -0.25], [0.43, 1.5, -0.07]], ['Room', [2.6, 2.6, -0.9], [0.0, 0.9, 0.1]]] };
  return { group: G, spots, key, cams, setLow, setTime, get time() { return time; }, sideOf, sidesAt, name: 'Reactor',
    bounds: { minX: X0 + 0.2, maxX: X1 - 0.2, minZ: Z0 + 0.2, maxZ: Z1 - 0.2 }, get low() { return low; },
    // (the core's glow breathes, slow, and flickers a little)
    tick(dt) { t += dt; const p = 0.85 + 0.15 * Math.sin(t * 0.9) + 0.04 * Math.sin(t * 7.3); glowO.emissiveIntensity = 5 * p; for (const l of coreL) l.intensity = (low ? 4.5 : 3.0) * p; } };
}

root.Reactor = { build };
})(typeof window !== 'undefined' ? window : globalThis);
