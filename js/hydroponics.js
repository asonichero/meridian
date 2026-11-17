// Project Meridian — Hydroponics and life support (docs/ship.md: port, aft, 8 m along the ship by 6 m, its door onto the spine forward; Noor's
// domain, Life Support's station when the Proctor calls stations). A long, humid room: rows of grow racks under violet grow-light, the
// reclamation tanks and their piping down the hull wall, the life-support console and its harnessed seat at the fore end; mist low in the
// aisles, a constant hum. Through the racks at the aft end, a nook the crew built themselves: a slatted wooden deck, a potting bench along the
// spine side, a low garden bench against the aft wall among big planters, warm amber light strung overhead. The ship's warm sanctuary: where
// the Captain can bring anyone for aftercare.
//
//   const hy = Hydroponics.build(scene) → the same shape as Mess.build
//   spots.bench: across the knee on the garden bench, square to it (the near arm on its seat); spots.wall: standing, palms flat on the edge of
//   the potting bench; spots.after: the garden bench; watch: in the aisles at the racks' ends; corner: by the door, facing the spine wall.
// Its frame: x along the ship (fore −x), z across it (the spine −z, the hull +z).
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3;
const K = root.SuitBay.kit, Q = root.Quarters.kit, rnd = K.rnd, speckle = K.speckle;
const X0 = -4, X1 = 4, ZS = -3, ZH = 3, HT = 2.6;      // fore and aft walls, the spine side, the hull, height
const NX = 2.0;      // (where the nook begins, aft of the racks)
// the garden bench against the aft wall (from GZ0 to GZ1), its seat; the potting bench along the spine side of the nook (from PX0 to PX1), its top
const GZ0 = -0.4, GZ1 = 1.2, GY = 0.45, GD = 0.5, PX0 = 2.2, PX1 = 3.85, PD = 0.62, PY = 0.9;

// ── Painted textures ──
const leafTex = K.canvasTex(256, 128, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { const x = rnd() * w, y = h - rnd() * h * 0.9, s = 6 + rnd() * 14; c.fillStyle = `hsl(${95 + rnd() * 40}, ${40 + rnd() * 25}%, ${24 + rnd() * 20}%)`;
    c.beginPath(); c.ellipse(x, y, s * 0.45, s, (rnd() - 0.5) * 1.4, 0, 7); c.fill(); }
  for (let i = 0; i < 10; i++) { c.fillStyle = rnd() < 0.5 ? '#c8402a' : '#e8c03a'; c.beginPath(); c.arc(rnd() * w, h * 0.3 + rnd() * h * 0.6, 3 + rnd() * 3, 0, 7); c.fill(); }      // (tomatoes, peppers)
});
const soilTex = K.canvasTex(128, 64, (c, w, h) => { c.fillStyle = '#3a2a1e'; c.fillRect(0, 0, w, h); speckle(c, w, h, 600, '#1a120c', 0.4, 1.5); speckle(c, w, h, 300, '#6a4a32', 0.3, 1.2); }, [4, 1]);
const tankTex = K.canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#7a8a86'; c.fillRect(0, 0, w, h); speckle(c, w, h, 800, '#000', 0.06, 4);
  for (let i = 0; i < 18; i++) { c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(rnd() * w, 0, 1 + rnd() * 2, h); }      // (condensation runs)
  c.fillStyle = '#c8a83a'; c.fillRect(0, h * 0.42, w, 10); c.fillStyle = '#1a1e20'; for (let x = 0; x < w; x += 20) c.fillRect(x, h * 0.42, 10, 10);
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.font = '600 18px monospace'; c.fillText('H2O · RECLAIM', 30, h * 0.36);
}, [2, 1]);
const consoleTex = K.canvasTex(320, 200, (c, w, h) => {
  c.fillStyle = '#081210'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a4a3a'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = '#6ae0a0'; c.font = '600 16px monospace'; c.fillText('LIFE SUPPORT', 16, 30);
  c.font = '13px monospace'; for (const [i, [k, v, f]] of [['O2', '20.9 %', 0.7], ['CO2', '0.04 %', 0.2], ['H2O RECLAIM', '98.2 %', 0.95], ['HUMIDITY', '71 %', 0.71], ['BIOMASS', 'NOMINAL', 0.8]].entries()) {
    c.fillStyle = 'rgba(106,224,160,0.8)'; c.fillText(k, 16, 62 + i * 26); c.fillText(v, 200, 62 + i * 26);
    c.fillStyle = 'rgba(106,224,160,0.25)'; c.fillRect(16, 67 + i * 26, 260, 4); c.fillStyle = 'rgba(106,224,160,0.8)'; c.fillRect(16, 67 + i * 26, 260 * f, 4); }
  c.fillStyle = 'rgba(106,224,160,0.06)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});
const mistTex = K.canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(230,236,255,0.9)'); g.addColorStop(1, 'rgba(230,236,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const detail = [];
  const std = (o) => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.2 }, o)), { grain: 0.05, scale: 8 });
  const box = (w, h, d, m, x, y, z, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; b.castShadow = !(o && o.noCast); b.receiveShadow = true; ((o && o.to) || G).add(b); if (o && o.detail) detail.push(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, rot, seg, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 16), m); c.position.set(x, y, z); if (rot) c.rotation.set(rot[0], rot[1], rot[2]); c.castShadow = !(o && o.noCast); c.receiveShadow = true; ((o && o.to) || G).add(c); if (o && o.detail) detail.push(c); return c; };
  const plane = (w, h, m, x, y, z, rx, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx || 0, ry || 0, 0); p.receiveShadow = true; G.add(p); return p; };

  const wallM = std({ map: K.panelTex('#6e7c74', [1, 1]), roughness: 0.6, metalness: 0.3 });      // (a damp green-grey steel)
  const steelDark = std({ map: K.panelTex('#2a3034', [1, 1]), roughness: 0.6, metalness: 0.4 });
  const steel = std({ color: srgb('#9aa0a2'), roughness: 0.4, metalness: 0.65 });
  const pipeM = std({ color: srgb('#6a7470'), roughness: 0.35, metalness: 0.7 }), pipeG = std({ color: srgb('#4a8a5a'), roughness: 0.4, metalness: 0.5 }), pipeB = std({ color: srgb('#3a6a8a'), roughness: 0.4, metalness: 0.5 });
  const wood = std({ color: srgb('#a07a54'), map: K.woodTex, roughness: 0.6, metalness: 0 }), oak = std({ map: Q.oakTex, roughness: 0.6, metalness: 0 });
  const soilM = std({ map: soilTex, roughness: 1, metalness: 0 }), leafM = new THREE.MeshStandardMaterial({ map: leafTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.8 });
  const potM = std({ color: srgb('#a85a3a'), roughness: 0.85, metalness: 0 }), potD = std({ color: srgb('#4a4e52'), roughness: 0.6, metalness: 0.3 });
  const glowV = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#c060ff'), emissiveIntensity: 4 });      // (the grow-strips: violet)
  const glowA = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ffb060'), emissiveIntensity: 4 });      // (the nook's string lights)
  const glowG = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#6ae0a0'), emissiveIntensity: 2 });
  const glowD = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#5ad8e0'), emissiveIntensity: 2 });

  // ── The shell: grating over the drains among the racks, a slatted wooden deck in the nook; the walls, the ceiling, the ribs ──
  const floor = plane(NX - X0, ZH - ZS, std({ map: K.gratingTex, roughness: 0.5, metalness: 0.6 }), (X0 + NX) / 2, 0, 0, -Math.PI / 2);
  const deck = plane(X1 - NX, ZH - ZS, std({ map: K.woodTex, color: srgb('#b08860'), roughness: 0.7, metalness: 0 }), (NX + X1) / 2, 0.004, 0, -Math.PI / 2);
  for (let z = ZS + 0.15; z < ZH; z += 0.3) box(X1 - NX, 0.004, 0.012, std({ color: srgb('#3a2a1a'), roughness: 0.9 }), (NX + X1) / 2, 0.008, z, { noCast: true, detail: true });
  plane(X1 - X0, ZH - ZS, std({ map: K.panelTex('#4a544e', [4, 3]), roughness: 0.7, metalness: 0.3 }), 0, HT, 0, Math.PI / 2);
  const wallRun = (len, x, z, ry, m) => { const n = Math.max(1, Math.round(len / 1.0)), pw = len / n;
    for (let i = 0; i < n; i++) { const off = -len / 2 + pw * (i + 0.5); plane(pw - 0.01, HT, m || wallM, x + Math.cos(ry) * off, HT / 2, z - Math.sin(ry) * off, 0, ry); } };
  wallRun(X1 - X0, 0, ZS, 0); wallRun(X1 - X0, 0, ZH, Math.PI); wallRun(ZH - ZS, X0, 0, Math.PI / 2);
  wallRun(ZH - ZS, X1, 0, -Math.PI / 2, std({ map: K.woodTex, color: srgb('#c8a078'), roughness: 0.7, metalness: 0 }));      // (the nook's back wall: boarded over in wood by the crew)
  for (const [x, z] of [[X0, ZS], [X1, ZS], [X0, ZH], [X1, ZH]]) box(0.12, HT, 0.12, steelDark, x, HT / 2, z);
  for (const x of [-2.4, -0.4, 1.6]) box(0.12, 0.12, ZH - ZS, steelDark, x, HT - 0.06, 0);

  // ── The door onto the spine, forward ──
  const DX = X0 + 2.57;
  box(1.1, 2.2, 0.08, steelDark, DX, 1.1, ZS + 0.04); box(0.9, 2.02, 0.04, std({ map: K.panelTex('#4a5a52', [1, 1]), roughness: 0.55, metalness: 0.45 }), DX, 1.01, ZS + 0.09);
  box(0.4, 0.02, 0.02, glowD, DX, 2.12, ZS + 0.1, { noCast: true });

  // ── The grow racks: a run along the spine wall aft of the door, and two free-standing rows down the middle, each three shelves of trays,
  // plants in them, a violet strip under each shelf ──
  const rack = (x0, x1, z, depth, sides) => {
    const len = x1 - x0, xc = (x0 + x1) / 2;
    for (const x of [x0 + 0.03, x1 - 0.03, ...(len > 2 ? [xc] : [])]) for (const dz of [-depth / 2 + 0.03, depth / 2 - 0.03]) box(0.04, 2.1, 0.04, steel, x, 1.05, z + dz);
    for (const y of [0.35, 0.95, 1.55]) {
      box(len, 0.03, depth, steel, xc, y, z, { noCast: true });
      box(len - 0.04, 0.1, depth - 0.06, soilM, xc, y + 0.065, z);
      for (const s of sides) { const lf = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.06, 0.32), leafM); lf.position.set(xc, y + 0.26, z + s * (depth / 2 - 0.12)); lf.rotation.y = s < 0 ? Math.PI : 0; G.add(lf); }
      const lf2 = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.06, 0.3), leafM); lf2.position.set(xc, y + 0.25, z); G.add(lf2); detail.push(lf2);
      box(len - 0.08, 0.012, 0.04, glowV, xc, y + 0.58, z, { noCast: true });
    }
    box(len, 0.03, depth, steel, xc, 2.1, z);
  };
  rack(-0.5, NX - 0.3, ZS + 0.3, 0.55, [1]);
  rack(-2.7, NX - 0.6, -0.6, 0.6, [-1, 1]);
  rack(-2.7, NX - 0.6, 1.0, 0.6, [-1, 1]);

  // ── The reclamation tanks down the hull wall, the piping over and between them; the life-support console and its harnessed seat at the fore
  // end ──
  for (const x of [-2.9, -1.9, -0.9, 0.1]) {
    cyl(0.34, 0.34, 1.9, std({ map: tankTex, roughness: 0.45, metalness: 0.55 }), x, 1.05, ZH - 0.42, null, 24);
    cyl(0.36, 0.36, 0.1, steelDark, x, 0.05, ZH - 0.42, null, 24); cyl(0.3, 0.34, 0.12, steel, x, 2.06, ZH - 0.42, null, 24);
    cyl(0.04, 0.04, 0.5, pipeM, x, 2.37, ZH - 0.42, null, 10);
    box(0.08, 0.14, 0.04, steelDark, x, 1.3, ZH - 0.78, { detail: true }); cyl(0.04, 0.04, 0.02, std({ color: srgb('#e8e4d8'), roughness: 0.3 }), x, 1.3, ZH - 0.8, [Math.PI / 2, 0, 0], 16, { detail: true });      // (a gauge each)
  }
  const run = (m, r, a, b) => { const v = new V3().subVectors(b, a), c = cyl(r, r, v.length(), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, null, 10); c.quaternion.setFromUnitVectors(new V3(0, 1, 0), v.normalize()); return c; };
  run(pipeM, 0.06, new V3(X0, 2.4, ZH - 0.42), new V3(1.2, 2.4, ZH - 0.42));
  run(pipeG, 0.04, new V3(X0, 2.25, ZH - 0.12), new V3(NX, 2.25, ZH - 0.12)); run(pipeB, 0.04, new V3(X0, 2.12, ZH - 0.12), new V3(NX, 2.12, ZH - 0.12));
  run(pipeG, 0.03, new V3(X0, 0.25, ZH - 0.1), new V3(1.2, 0.25, ZH - 0.1));
  for (const x of [-2.4, -1.4, -0.4]) { run(pipeB, 0.025, new V3(x, 2.12, ZH - 0.12), new V3(x, 0.6, ZH - 0.12)); cyl(0.05, 0.05, 0.04, std({ color: srgb('#a83a2a'), roughness: 0.5 }), x, 1.2, ZH - 0.18, [Math.PI / 2, 0, 0], 12, { detail: true }); }
  // (the console against the fore wall, toward the hull; the seat in front of it, harness straps over its back)
  const CZ = 1.75;
  box(0.5, 0.85, 1.2, steelDark, X0 + 0.25, 0.425, CZ); box(0.55, 0.04, 1.24, std({ color: srgb('#2a3034'), roughness: 0.4, metalness: 0.4 }), X0 + 0.28, 0.87, CZ);
  box(0.05, 0.5, 1.0, steelDark, X0 + 0.04, 1.4, CZ); plane(0.92, 0.46, new THREE.MeshBasicMaterial({ map: consoleTex }), X0 + 0.068, 1.4, CZ, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) box(0.02, 0.02, 0.04, i % 2 ? glowG : glowD, X0 + 0.45, 0.9, CZ - 0.45 + i * 0.18, { noCast: true, detail: true });
  { const sx = X0 + 1.0; box(0.5, 0.1, 0.5, std({ color: srgb('#3a4248'), roughness: 0.7 }), sx, 0.5, CZ); box(0.1, 0.75, 0.48, std({ color: srgb('#3a4248'), roughness: 0.7 }), sx + 0.24, 0.92, CZ);
    cyl(0.04, 0.04, 0.45, steel, sx, 0.23, CZ, null, 10); cyl(0.22, 0.24, 0.03, steelDark, sx, 0.015, CZ, null, 16);
    for (const dz of [-0.12, 0.12]) box(0.02, 0.62, 0.05, std({ color: srgb('#c8902a'), roughness: 0.8 }), sx + 0.18, 0.95, CZ + dz, { detail: true });      // (the harness's straps)
    box(0.03, 0.06, 0.08, steel, sx + 0.17, 0.66, CZ, { detail: true }); }

  // ── The nook: the potting bench along the spine side (soil bin, pots, trays, a trowel; the pegboard over it; clear where hands go), the
  // garden bench against the aft wall (slatted, a back), big planters, a little tree; amber lights strung overhead ──
  const pz = ZS + PD / 2;
  box(PX1 - PX0, 0.05, PD, oak, (PX0 + PX1) / 2, PY - 0.025, pz);
  for (const x of [PX0 + 0.05, PX1 - 0.05]) for (const z of [ZS + 0.05, ZS + PD - 0.05]) box(0.05, PY - 0.05, 0.05, wood, x, (PY - 0.05) / 2, z);
  box(PX1 - PX0 - 0.1, 0.03, PD - 0.1, wood, (PX0 + PX1) / 2, 0.25, pz);
  box(0.5, 0.25, 0.4, potD, PX0 + 0.35, PY + 0.125, pz - 0.05);      // (the soil bin)
  for (const [x, s] of [[PX1 - 0.25, 0.09], [PX1 - 0.42, 0.07], [PX0 + 0.75, 0.06]]) cyl(s, s * 0.75, s * 1.5, potM, x, PY + s * 0.75, pz - 0.12, null, 12, { detail: true });
  for (const x of [PX0 + 0.2, PX0 + 0.5]) box(0.24, 0.05, 0.3, std({ color: srgb('#2a2a2a'), roughness: 0.8 }), x, 0.3, pz, { detail: true });
  box(0.04, 0.02, 0.18, steel, PX1 - 0.6, PY + 0.01, pz + 0.12, { detail: true });
  box(1.4, 0.8, 0.02, std({ color: srgb('#c8b08a'), roughness: 0.9 }), (PX0 + PX1) / 2, 1.7, ZS + 0.012);
  for (let i = 0; i < 7; i++) box(0.03, 0.18 + rnd() * 0.12, 0.03, steel, PX0 + 0.3 + i * 0.18, 1.7, ZS + 0.04, { detail: true });
  // (the garden bench: its own group, kept: they're sat on it)
  const gb = new THREE.Group(); gb.userData.keep = true; G.add(gb);
  const gz = (GZ0 + GZ1) / 2, gl = GZ1 - GZ0;
  for (let i = 0; i < 4; i++) box(GD / 4 - 0.02, 0.035, gl, wood, X1 - GD + GD / 8 + i * GD / 4, GY - 0.018, gz, { to: gb });
  for (const z of [GZ0 + 0.06, GZ1 - 0.06]) { box(GD - 0.04, GY - 0.035, 0.05, wood, X1 - GD / 2, (GY - 0.035) / 2, z, { to: gb }); box(0.05, 0.42, 0.05, wood, X1 - 0.06, GY + 0.21, z, { to: gb }); }
  for (let i = 0; i < 3; i++) box(0.03, 0.08, gl, wood, X1 - 0.07, GY + 0.12 + i * 0.12, gz, { to: gb });
  // (planters: big ones at the bench's ends and in the hull corner, a little tree in that one)
  const planter = (x, z, r, h, tree) => {
    cyl(r, r * 0.85, h, potD, x, h / 2, z, null, 18); cyl(r - 0.02, r - 0.02, 0.02, soilM, x, h - 0.01, z, null, 18, { noCast: true });
    const n = tree ? 22 : 14;
    if (tree) cyl(0.04, 0.05, 1.0, std({ color: srgb('#5a3a22'), roughness: 0.9 }), x, h + 0.5, z, null, 8);
    for (let i = 0; i < n; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), std({ color: srgb(i % 3 ? '#4a7a3a' : '#5e8e44'), roughness: 0.7 })); const a_ = i * 2.4;
      if (tree) { lf.scale.set(0.12, 0.08, 0.12); lf.position.set(x + Math.cos(a_) * 0.28 * rnd(), h + 1.0 + rnd() * 0.45, z + Math.sin(a_) * 0.28 * rnd()); }
      else { lf.scale.set(0.04, 0.32, 0.1); lf.position.set(x + Math.cos(a_) * r * 0.5, h + 0.2 + (i % 3) * 0.08, z + Math.sin(a_) * r * 0.5); lf.rotation.set(Math.sin(a_) * 0.6, a_, Math.cos(a_) * 0.6); }
      lf.castShadow = true; G.add(lf); detail.push(lf); }
  };
  planter(X1 - 0.35, GZ0 - 0.55, 0.3, 0.6, false); planter(X1 - 0.35, GZ1 + 0.55, 0.3, 0.6, false); planter(X1 - 0.45, ZH - 0.45, 0.38, 0.55, true);
  planter(NX + 0.4, ZH - 0.4, 0.28, 0.5, false);
  // (the string of amber lights across the nook, and a lamp over the bench)
  for (let i = 0; i <= 18; i++) { const t = i / 18, b = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), glowA); b.position.set(NX + 0.2 + (X1 - NX - 0.4) * Math.abs(Math.sin(t * Math.PI * 2)), HT - 0.25 - 0.12 * Math.sin(t * Math.PI * 6) ** 2, ZS + 0.4 + t * (ZH - ZS - 0.8)); G.add(b); detail.push(b); }
  cyl(0.006, 0.006, 0.7, steel, X1 - 0.6, HT - 0.35, gz, null, 6); { const sh = cyl(0.12, 0.2, 0.18, std({ color: srgb('#c88a3a'), roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }), X1 - 0.6, HT - 0.78, gz, null, 18); sh.castShadow = false; }
  { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), glowA); b.position.set(X1 - 0.6, HT - 0.84, gz); G.add(b); }

  // ── Mist, low in the aisles, drifting ──
  const mist = [];
  for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, opacity: 0.07, depthWrite: false }));
    s.position.set(X0 + 0.8 + rnd() * (NX - X0 - 1), 0.15 + rnd() * 0.35, [-1.8, 0.2, 1.8][i % 3] + (rnd() - 0.5) * 0.4); s.scale.set(1.4, 0.6, 1); s.userData.v = 0.05 + rnd() * 0.08; G.add(s); mist.push(s); detail.push(s); }

  // ── Light: violet from the racks (and their cool white work light by day), amber and warm in the nook, the console's green ──
  const hemi = new THREE.HemisphereLight(srgb('#e0d8f0'), srgb('#2a2428'), 0.9); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#3a3040'), 0.5); G.add(amb);
  const violet = [-2.0, -0.2, 1.4].map(x => { const l = new THREE.PointLight(srgb('#b060ff'), 2.4, 4.5, 2); l.position.set(x, 1.6, 0.2); G.add(l); return l; });
  const work = new THREE.PointLight(srgb('#e8eef8'), 2.0, 9, 2); work.position.set(-1, HT - 0.3, 0); G.add(work);
  const key = new THREE.SpotLight(srgb('#ffc890'), 6, 6, 1.0, 0.8, 2); key.position.set(X1 - 1.0, HT - 0.1, -0.4); key.target.position.set(X1 - 0.9, 0, -0.6);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; key.shadow.camera.near = 0.2; key.shadow.camera.far = 6; G.add(key); G.add(key.target);
  const nookL = new THREE.PointLight(srgb('#ffb060'), 2.0, 4, 2); nookL.position.set(X1 - 0.6, HT - 0.9, gz); G.add(nookL);
  const consoleL = new THREE.PointLight(srgb('#6ae0a0'), 0.6, 2, 2); consoleL.position.set(X0 + 0.6, 1.3, CZ); G.add(consoleL);

  // ── Where things happen ──
  const spots = {
    // (across the knee on the garden bench, square to it, facing up the room: they lie along it in front, the head toward the hull, the near
    // arm on its slats)
    bench: { at: new V3(X1 - GD + 0.13, 0, gz - 0.25), yaw: -Math.PI / 2, turn: 0, seatY: GY, rest: { y: GY, edge: 0.13 } },
    // (standing at the potting bench, palms flat on its edge, bent forward; the Captain at their left, aft)
    wall: { at: new V3((PX0 + PX1) / 2 + 0.15, 0, ZS + PD + 0.85), yaw: Math.PI, support: { kind: 'edge', y: PY + 0.01, d: 0.85, bend: 0.95, lines: 'potting' } },
    after: { at: new V3(X1 - GD + 0.2, 0, gz - 0.35), yaw: -Math.PI / 2, seatY: GY, beside: new V3(X1 - GD + 0.2, 0, gz + 0.27) },
    // (watching from the aisles at the racks' ends, and by the tanks)
    watch: [{ at: new V3(NX - 0.15, 0, -1.75), yaw: 0 }, { at: new V3(NX - 0.25, 0, 0.2), yaw: 0 }, { at: new V3(NX - 0.15, 0, 1.95), yaw: 0 }, { at: new V3(1.0, 0, -1.6), yaw: 0 },
      { at: new V3(0.9, 0, 0.25), yaw: 0 }, { at: new V3(1.15, 0, 2.0), yaw: 0 }],
    corner: { at: new V3(X0 + 0.45, 0, ZS + 0.4), yaw: Math.PI, next: { base: new V3(0, 0, 0), step: new V3(0.75, 0, 0), yaw: Math.PI } },
  };

  const meshes = []; G.traverse(o => { if (o.isMesh) meshes.push(o); });
  const cast0 = new Map(meshes.map(m => [m, m.castShadow]));
  let low = false, time = 'day';
  function apply() {
    const day = time === 'day';
    for (const m of meshes) m.castShadow = low ? false : cast0.get(m);
    for (const d of detail) d.visible = !low;
    consoleL.visible = !low; violet[0].visible = violet[2].visible = !low;
    // (the plants' day and night: the grow-strips full by day, down to a glow at night; the nook warm either way, warmer at night)
    glowV.emissiveIntensity = day ? 4.5 : 0.6; for (const l of violet) l.intensity = (day ? 2.4 : 0.35) * (low && l === violet[1] ? 2 : 1);
    work.intensity = day ? 2.0 : 0.3; key.intensity = day ? 5 : 6; nookL.intensity = day ? 1.4 : 2.2; glowA.emissiveIntensity = day ? 3 : 4.5;
    hemi.intensity = (day ? 0.9 : 0.45) + (low ? 0.3 : 0); amb.intensity = day ? 0.5 : 0.35;
    const sz = low ? 1024 : 2048;
    if (key.shadow.mapSize.x !== sz) { key.shadow.mapSize.set(sz, sz); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  }
  const setLow = on => { low = !!on; apply(); }, setTime = t => { time = t === 'night' ? 'night' : 'day'; apply(); };
  apply();
  const { sideOf, sidesAt } = K.roomSides(G, { minX: X0, maxX: X1, minZ: ZS, maxZ: ZH, ht: HT }, [floor, deck, gb]);
  let t = 0;
  // (at the potting bench the aft wall is close on their right: the side view from behind and to the right, high; their face from low at
  // the bench's aft end)
  const cams = { wall: [['Side', [-0.675, 1.45, -0.53], [0.05, 0.95, 0.35]], ['Behind', [-0.35, 1.2, -1.25], [0, 0.85, 0.15]], ['Seat', [-0.55, 1.25, -0.75], [0, 0.88, 0]],
    ['Their face', [-0.68, 0.95, 0.72], [0.05, 1.05, 0.5]], ['Captain', [-0.4, 1.42, -0.25], [0.43, 1.5, -0.07]], ['Room', [1.05, 1.9, -2.95], [-0.15, 0.8, -0.15]]] };
  return { group: G, spots, key, cams, setLow, setTime, get time() { return time; }, sideOf, sidesAt, name: 'Hydroponics',
    bounds: { minX: X0 + 0.2, maxX: X1 - 0.2, minZ: ZS + 0.2, maxZ: ZH - 0.2 }, get low() { return low; },
    tick(dt) { t += dt; for (const m of mist) { m.position.x += m.userData.v * dt; if (m.position.x > NX - 0.3) m.position.x = X0 + 0.6; m.material.opacity = 0.05 + 0.03 * Math.sin(t * 0.4 + m.position.z); } } };
}

root.Hydroponics = { build };
})(typeof window !== 'undefined' ? window : globalThis);
