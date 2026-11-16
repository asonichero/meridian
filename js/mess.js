// Project Meridian — the Galley & Mess (GDD §4: "central social hub & communal meals; public in-situ resets by day, formal bench corrections by
// night"). Starboard amidships (docs/ship.md), from Sefa's cabin forward to Morgan's aft, open wide along its port side onto the spine corridor,
// the suit bay's and med bay's doors across it. An open galley along the outboard wall with an island in front of it, the long crew table with a
// bench each side down the middle, soft seating aft along the hull. The ship's bones (painted steel, a grating corridor, acoustic tiles) under the
// crew's warmth: synthetic-wood floor, table and dado, amber pendants, a sofa with a throw, the clocks for ship's time and Earth's. Painted in code.
//
//   const mess = Mess.build(scene) → the same shape as SuitBay.build: { group, spots, bounds, cams, sideOf, sidesAt, setLow, tick, name }
//   spots.bench: across the knee, the Captain at the fore end of the spine-side bench, facing the corridor (the bench running on to their left);
//   spots.wall: standing at the island, palms flat on its top; spots.table: over the fore end of the crew table; spots.after: the sofa;
//   watch: along the corridor; corner: facing the aft bulkhead.
// Its frame: x along the ship (fore −x), z across it (the outboard hull −z, the corridor +z).
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3;
const K = root.SuitBay.kit, rnd = K.rnd, speckle = K.speckle;
const X0 = -7, X1 = 7, ZO = -3, ZS = 3, ZC = 5, HT = 2.65;      // fore and aft bulkheads, the hull, the open side, the corridor's far wall, height

// ── Painted textures ──
const plankTex = K.canvasTex(512, 512, (c, w, h) => {
  c.fillStyle = '#6a4630'; c.fillRect(0, 0, w, h);
  for (let r = 0; r < 8; r++) { const y = r * 64, off = (r % 2) * 180;
    for (let x = -off; x < w; x += 360) { c.fillStyle = `hsl(${22 + rnd() * 8}, ${32 + rnd() * 10}%, ${26 + rnd() * 8}%)`; c.fillRect(x + 2, y + 2, 356, 60);
      for (let i = 0; i < 6; i++) { c.strokeStyle = 'rgba(30,15,8,0.25)'; c.lineWidth = 1 + rnd(); c.beginPath(); const yy = y + 6 + rnd() * 52; c.moveTo(x, yy); for (let xx = 0; xx <= 356; xx += 30) c.lineTo(x + xx, yy + Math.sin(xx * 0.04 + i) * 2); c.stroke(); } } }
  c.fillStyle = 'rgba(20,10,5,0.6)'; for (let r = 0; r <= 8; r++) c.fillRect(0, r * 64 - 1, w, 3);
  speckle(c, w, h, 400, '#000', 0.06, 2);
}, [5, 3]);
const tileTex = K.canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#3c4044'; c.fillRect(0, 0, w, h); c.fillStyle = '#4a4f54';
  for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { c.fillRect(x + 2, y + 2, 60, 60); c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 25; i++) { c.beginPath(); c.arc(x + 8 + (i % 5) * 12, y + 8 + Math.floor(i / 5) * 12, 1.6, 0, 7); c.fill(); } c.fillStyle = '#4a4f54'; }
}, [7, 3]);
const backsplashTex = K.canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = '#b8b09a'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 * 16; x < w; x += 32) { c.fillStyle = `hsl(${40 + rnd() * 20}, ${18 + rnd() * 10}%, ${62 + rnd() * 10}%)`; c.fillRect(x + 1, y + 1, 30, 30); }
  speckle(c, w, h, 200, '#000', 0.06, 2);
}, [12, 1]);
const cabTex = (base) => K.canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h); speckle(c, w, h, 300, '#000', 0.05, 3);
  c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 4; c.strokeRect(6, 6, w / 2 - 10, h - 12); c.strokeRect(w / 2 + 4, 6, w / 2 - 10, h - 12);
  c.fillStyle = 'rgba(40,30,20,0.8)'; c.fillRect(w / 2 - 22, h * 0.3, 8, 40); c.fillRect(w / 2 + 14, h * 0.3, 8, 40);
}, [1, 1]);
const fabricTex = (a, b) => K.canvasTex(128, 128, (c, w, h) => { c.fillStyle = a; c.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 4) { c.fillStyle = i % 8 ? 'rgba(0,0,0,0.05)' : b; c.fillRect(i, 0, 2, h); c.fillRect(0, i, w, 1); } speckle(c, w, h, 200, '#000', 0.05, 2); }, [2, 2]);
const clockTex = K.canvasTex(512, 256, (c, w, h) => {
  c.fillStyle = '#0b1214'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a4a4c'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
  c.fillStyle = '#5ad8e0'; c.font = '600 30px monospace'; c.fillText('SHIP', 32, 70); c.font = '600 54px monospace'; c.fillText('DAY 1,231', 32, 128);
  c.fillStyle = '#ffb05a'; c.font = '600 30px monospace'; c.fillText('EARTH', 32, 186); c.font = '600 40px monospace'; c.fillText('+31 YR 4 MO', 150, 188);
  c.fillStyle = 'rgba(90,216,224,0.08)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});
const boardTex = K.canvasTex(256, 192, (c, w, h) => {
  c.fillStyle = '#7a5a3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#b89a6a'; c.fillRect(10, 10, w - 20, h - 20);
  const cols = ['#e8e0b0', '#d89a7a', '#a8c8b0', '#f0f0e8', '#c8b8e0'];
  for (let i = 0; i < 9; i++) { c.save(); c.translate(30 + (i % 4) * 56 + rnd() * 10, 30 + Math.floor(i / 4) * 52 + rnd() * 8); c.rotate((rnd() - 0.5) * 0.3); c.fillStyle = cols[i % cols.length]; c.fillRect(0, 0, 40, 34); c.fillStyle = 'rgba(0,0,0,0.35)'; for (let l = 0; l < 3; l++) c.fillRect(5, 8 + l * 8, 24 + rnd() * 6, 2); c.fillStyle = '#b8323a'; c.beginPath(); c.arc(20, 3, 3, 0, 7); c.fill(); c.restore(); }
});

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const detail = [];      // (what the low-CPU mode leaves out)
  const std = (o) => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.2 }, o)), { grain: 0.05, scale: 8 });
  const box = (w, h, d, m, x, y, z, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; b.castShadow = !(o && o.noCast); b.receiveShadow = true; G.add(b); if (o && o.detail) detail.push(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, rot, seg, det) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 16), m); c.position.set(x, y, z); if (rot) c.rotation.set(rot[0], rot[1], rot[2]); c.castShadow = true; c.receiveShadow = true; G.add(c); if (det) detail.push(c); return c; };
  const plane = (w, h, m, x, y, z, rx, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx || 0, ry || 0, 0); p.receiveShadow = true; G.add(p); return p; };

  const steel = std({ map: K.panelTex('#565a58', [1, 1]), roughness: 0.62, metalness: 0.3 });
  const steelDark = std({ map: K.panelTex('#2a3034', [1, 1]), roughness: 0.6, metalness: 0.4 });
  const corridorWall = std({ map: K.panelTex('#3a454e', [1, 1]), roughness: 0.62, metalness: 0.35 });
  const wood = std({ map: K.woodTex, roughness: 0.55, metalness: 0 }), woodLight = std({ color: srgb('#a07a54'), map: K.woodTex, roughness: 0.55, metalness: 0 });
  const cream = std({ map: cabTex('#c9bfa6'), roughness: 0.6, metalness: 0.05 }), teal = std({ map: cabTex('#3e5a58'), roughness: 0.6, metalness: 0.05 });
  const counterTop = std({ color: srgb('#2c3034'), roughness: 0.35, metalness: 0.5 });
  const pipeM = std({ color: srgb('#5a5e5c'), roughness: 0.45, metalness: 0.7 }), brass = std({ color: srgb('#a8761e'), roughness: 0.4, metalness: 0.7 });
  const sofaM = std({ map: fabricTex('#8a4a2e', 'rgba(255,220,180,0.06)'), roughness: 0.95, metalness: 0 });
  const chairM = std({ map: fabricTex('#4a6a5a', 'rgba(255,255,255,0.05)'), roughness: 0.95, metalness: 0 });
  const glowA = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ffb05a'), emissiveIntensity: 5 });
  const glowC = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#7ab8d8'), emissiveIntensity: 3 });
  const glowF = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ffc880'), emissiveIntensity: 3.5 });

  // ── The shell: floors (wood in the mess, grating in the corridor), ceilings, the bulkheads; the open side's pillars and header ──
  const floor = plane(X1 - X0, ZS - ZO, std({ map: plankTex, roughness: 0.6, metalness: 0 }), 0, 0, (ZO + ZS) / 2, -Math.PI / 2);
  const corridorFloor = plane(X1 - X0 + 3, ZC - ZS, std({ map: K.gratingTex, roughness: 0.55, metalness: 0.6 }), 0, 0.002, (ZS + ZC) / 2, -Math.PI / 2);
  plane(X1 - X0, ZS - ZO, std({ map: tileTex, roughness: 0.9, metalness: 0 }), 0, HT, (ZO + ZS) / 2, Math.PI / 2);
  plane(X1 - X0 + 3, ZC - ZS, steelDark, 0, HT - 0.15, (ZS + ZC) / 2, Math.PI / 2);
  // (each wall a run of panels over a synthetic-wood dado; in the corridor, plain steel)
  const wallRun = (len, x, z, ry, mUp, mLo) => {
    const n = Math.max(1, Math.round(len / 0.9)), pw = len / n;
    for (let i = 0; i < n; i++) {
      const off = -len / 2 + pw * (i + 0.5), px = x + Math.cos(ry) * off, pz = z - Math.sin(ry) * off;
      const up = plane(pw - 0.01, HT - 0.9, mUp, px, 0.9 + (HT - 0.9) / 2, pz, 0, ry);
      const lo = plane(pw - 0.01, 0.88, mLo, px, 0.44, pz, 0, ry);
    }
  };
  wallRun(X1 - X0, 0, ZO, 0, steel, woodLight);                      // (the hull, behind the galley and the sofa)
  wallRun(ZS - ZO, X0, (ZO + ZS) / 2, Math.PI / 2, steel, woodLight);      // (fore: Sefa's cabin beyond)
  wallRun(ZS - ZO, X1, (ZO + ZS) / 2, -Math.PI / 2, steel, woodLight);     // (aft: Morgan's beyond)
  wallRun(X1 - X0 + 3, 0, ZC, Math.PI, corridorWall, steelDark);            // (the corridor's far side: the suit bay and the med bay)
  for (const x of [X0 - 1.5, X1 + 1.5]) plane(ZC - ZS, HT, steelDark, x, HT / 2, (ZS + ZC) / 2, 0, x < 0 ? Math.PI / 2 : -Math.PI / 2);      // (the corridor running on, closed off)
  for (const x of [X0 - 0.75, X1 + 0.75]) plane(1.5, HT, corridorWall, x, HT / 2, ZS, 0, 0);      // (the cabins' side of the corridor, either end)
  for (const x of [X0, X1]) { box(0.14, HT, 0.14, steelDark, x, HT / 2, ZS); box(0.12, 0.12, ZC - ZS, steelDark, x, HT - 0.06, (ZS + ZC) / 2); }
  for (const x of [-2.3, 2.3]) box(0.18, HT, 0.18, steelDark, x, HT / 2, ZS);
  box(X1 - X0, 0.3, 0.2, steelDark, 0, HT - 0.15, ZS);
  for (let x = X0 + 1.75; x < X1; x += 1.75) box(0.12, 0.12, ZS - ZO, steelDark, x, HT - 0.06, (ZO + ZS) / 2, { detail: false });
  // (the string of little warm lights the crew hung along the open side)
  for (let x = X0 + 0.3; x < X1; x += 0.35) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), glowF); b.position.set(x, HT - 0.32 - 0.05 * Math.abs(Math.sin(x * 2.2)), ZS - 0.12); G.add(b); detail.push(b); }

  // ── The galley along the hull: the fridge, the counters with cupboards under and over, a cooktop, a sink, the backsplash; the island ──
  box(0.8, 2.0, 0.7, std({ color: srgb('#c8c4b8'), roughness: 0.4, metalness: 0.4 }), -6.45, 1.0, ZO + 0.35);
  box(0.03, 0.5, 0.03, pipeM, -6.08, 1.25, ZO + 0.71, { detail: true });
  box(5.15, 0.88, 0.62, cream, -3.475, 0.44, ZO + 0.31);
  box(5.2, 0.04, 0.7, counterTop, -3.475, 0.9, ZO + 0.35);
  box(5.15, 0.6, 0.34, cream, -3.475, 1.82, ZO + 0.17);
  plane(5.15, 0.56, std({ map: backsplashTex, roughness: 0.4, metalness: 0.05 }), -3.475, 1.2, ZO + 0.01);
  const strip = box(5.0, 0.02, 0.03, glowA, -3.475, 1.515, ZO + 0.3, { noCast: true });
  box(0.7, 0.012, 0.5, std({ color: srgb('#111315'), roughness: 0.3, metalness: 0.6 }), -3.95, 0.926, ZO + 0.33);
  for (const [dx, dz] of [[-0.17, -0.12], [0.17, -0.12], [-0.17, 0.12], [0.17, 0.12]]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 6, 20), std({ color: srgb('#3a3c3e'), metalness: 0.7 })); r.rotation.x = Math.PI / 2; r.position.set(-3.95 + dx, 0.934, ZO + 0.33 + dz); G.add(r); detail.push(r); }
  box(0.62, 0.02, 0.44, std({ color: srgb('#8a9094'), roughness: 0.25, metalness: 0.8 }), -2.35, 0.915, ZO + 0.33);
  cyl(0.012, 0.012, 0.3, pipeM, -2.35, 1.07, ZO + 0.1, null, 10, true);
  cyl(0.06, 0.07, 0.2, std({ color: srgb('#c8c0b0'), metalness: 0.5, roughness: 0.4 }), -5.3, 1.02, ZO + 0.3, null, 16, true);      // (the kettle)
  // the island: painted base, a thick wood top
  box(3.0, 0.9, 0.62, teal, -3.5, 0.45, -1.275);
  box(3.1, 0.06, 0.72, wood, -3.5, 0.92, -1.275);
  // (a bowl of fruit from hydroponics, mugs: kept clear of where hands go on it)
  { const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std({ color: srgb('#8a5a3a'), roughness: 0.6, side: THREE.DoubleSide })); bowl.position.set(-4.6, 1.08, -1.3); G.add(bowl); detail.push(bowl);
    for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), std({ color: srgb(['#d8a02a', '#c8402a', '#8ab040'][i % 3]), roughness: 0.5 })); f.position.set(-4.6 + Math.cos(i * 1.3) * 0.06, 1.0 + (i > 2 ? 0.04 : 0), -1.3 + Math.sin(i * 1.3) * 0.06); G.add(f); detail.push(f); } }
  for (const [x, z] of [[-2.25, -1.15], [-2.4, -1.4]]) cyl(0.04, 0.035, 0.1, std({ color: srgb('#d8d0c0'), roughness: 0.4 }), x, 1.0, z, null, 12, true);

  // ── The crew table, a bench down each side (its fore end where they're taken over it; the spine-side bench's fore end where the Captain sits) ──
  const TX0 = 0, TX1 = 3.6, TZ = 0.4;
  box(TX1 - TX0, 0.04, 1.0, wood, (TX0 + TX1) / 2, 0.73, TZ);
  for (const x of [0.35, 3.25]) { box(0.06, 0.7, 0.7, steelDark, x, 0.36, TZ); box(0.06, 0.05, 0.9, steelDark, x, 0.03, TZ); }
  box(2.9, 0.05, 0.06, steelDark, 1.8, 0.2, TZ);
  for (const z of [-0.445, 1.245]) { box(TX1 - TX0, 0.04, 0.35, wood, (TX0 + TX1) / 2, 0.43, z); for (const x of [0.25, 3.35]) box(0.05, 0.41, 0.28, steelDark, x, 0.205, z); }
  // (the far end laid: plates, mugs, a jar of dried flowers)
  for (const [x, z] of [[3.1, 0.1], [3.1, 0.7], [2.5, 0.1]]) { const pl = cyl(0.11, 0.1, 0.015, std({ color: srgb('#e0dace'), roughness: 0.4 }), x, 0.758, z, null, 20, true); }
  cyl(0.045, 0.04, 0.11, std({ color: srgb('#b8c8c0'), roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.7 }), 2.2, 0.805, 0.45, null, 12, true);
  for (let i = 0; i < 5; i++) { const st = cyl(0.004, 0.004, 0.22, std({ color: srgb('#7a6a3a') }), 2.2 + Math.cos(i) * 0.02, 0.9, 0.45 + Math.sin(i) * 0.02, [Math.cos(i * 2) * 0.25, 0, Math.sin(i * 2) * 0.25], 6, true); }

  // ── The soft corner aft along the hull: a sofa with cushions and a throw, a low table, an armchair, a floor lamp ──
  box(3.2, 0.3, 0.85, sofaM, 2.8, 0.15, ZO + 0.425);
  for (const x of [1.95, 3.0, 4.05]) box(1.0, 0.14, 0.62, sofaM, x, 0.37, ZO + 0.54);
  box(3.2, 0.55, 0.26, sofaM, 2.8, 0.575, ZO + 0.13);
  for (const x of [1.3, 4.3]) box(0.2, 0.32, 0.85, sofaM, x, 0.46, ZO + 0.425);
  for (const [x, c] of [[1.62, '#3e6a6a'], [4.0, '#c8902a']]) { const p = box(0.36, 0.3, 0.12, std({ map: fabricTex(c, 'rgba(255,255,255,0.08)'), roughness: 0.95 }), x, 0.6, ZO + 0.33, { ry: x < 2 ? 0.3 : -0.3 }); detail.push(p); }
  box(0.9, 0.03, 0.75, std({ map: fabricTex('#b8a888', 'rgba(120,80,40,0.2)'), roughness: 0.95 }), 4.2, 0.64, ZO + 0.38, { detail: true });
  box(1.2, 0.04, 0.4, wood, 2.6, 0.4, -1.65); for (const [x, z] of [[2.05, -1.5], [3.15, -1.5], [2.05, -1.8], [3.15, -1.8]]) box(0.04, 0.38, 0.04, steelDark, x, 0.19, z);
  cyl(0.04, 0.035, 0.1, std({ color: srgb('#c87a5a'), roughness: 0.4 }), 2.4, 0.47, -1.6, null, 12, true);
  // the armchair, aft, turned to the room
  box(0.8, 0.42, 0.8, chairM, 5.9, 0.21, -1.9); box(0.2, 0.55, 0.8, chairM, 6.25, 0.6, -1.9); for (const z of [-2.25, -1.55]) box(0.8, 0.22, 0.12, chairM, 5.9, 0.53, z);
  cyl(0.015, 0.015, 1.45, steelDark, 4.75, 0.73, ZO + 0.3, null, 8); cyl(0.12, 0.2, 0.22, std({ color: srgb('#d8b888'), roughness: 0.8, side: THREE.DoubleSide }), 4.75, 1.5, ZO + 0.3, null, 16);
  cyl(0.18, 0.2, 0.03, steelDark, 4.75, 0.015, ZO + 0.3, null, 16);

  // ── The bulkheads' own: aft, shelves of the crew's things and the clocks (ship's time, and how far Earth has run on); fore, a pinboard; a plant ──
  plane(1.0, 0.5, new THREE.MeshBasicMaterial({ map: clockTex }), X1 - 0.02, 1.7, -0.1, 0, -Math.PI / 2);
  box(0.05, 0.56, 1.06, steelDark, X1 - 0.04, 1.7, -0.1);
  for (const y of [1.15, 1.55]) { box(0.28, 0.03, 1.6, wood, X1 - 0.15, y, 1.7);
    for (let i = 0; i < 9; i++) { const bk = box(0.2, 0.18 + rnd() * 0.08, 0.04 + rnd() * 0.03, std({ color: srgb(['#7a3a2a', '#2a4a5a', '#b88a3a', '#4a6a3a', '#5a3a5a'][i % 5]), roughness: 0.8 }), X1 - 0.16, y + 0.11, 1.05 + i * 0.12 + rnd() * 0.02); detail.push(bk); } }
  box(0.04, 0.8, 1.1, std({ map: boardTex, roughness: 0.85 }), X0 + 0.03, 1.55, 1.2);
  cyl(0.18, 0.14, 0.34, std({ color: srgb('#8a4a2e'), roughness: 0.85 }), X1 - 0.4, 0.17, ZO + 0.4, null, 16);
  for (let i = 0; i < 12; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), std({ color: srgb('#4a7a3a'), roughness: 0.7 })); const a = i * 2.4; lf.scale.set(0.03, 0.22, 0.08); lf.position.set(X1 - 0.4 + Math.cos(a) * 0.08, 0.5 + (i % 3) * 0.06, ZO + 0.4 + Math.sin(a) * 0.08); lf.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6); lf.castShadow = true; G.add(lf); detail.push(lf); }

  // ── The corridor's far side: the suit bay's door forward, the med bay's aft; conduit overhead, the corridor's cool strip lights ──
  for (const [x, label] of [[-3, 'suit'], [4.5, 'med']]) {
    box(1.1, 2.15, 0.08, steelDark, x, 1.075, ZC - 0.04);
    box(0.9, 1.95, 0.04, std({ map: K.panelTex(label === 'med' ? '#c8ccc8' : '#5a5246', [1, 1]), roughness: 0.6, metalness: 0.4 }), x, 1.0, ZC - 0.09);
    box(0.5, 0.025, 0.02, glowC, x, 2.08, ZC - 0.1, { noCast: true });
    if (label === 'med') { box(0.16, 0.05, 0.02, std({ color: srgb('#3a9a9e'), emissive: srgb('#3a9a9e'), emissiveIntensity: 0.6 }), x + 0.62, 1.55, ZC - 0.1, { detail: true }); box(0.05, 0.16, 0.02, std({ color: srgb('#3a9a9e'), emissive: srgb('#3a9a9e'), emissiveIntensity: 0.6 }), x + 0.62, 1.55, ZC - 0.1, { detail: true }); }
  }
  const run = (m, r, a, b) => { const v = new V3().subVectors(b, a), c = cyl(r, r, v.length(), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, null, 10); c.quaternion.setFromUnitVectors(new V3(0, 1, 0), v.normalize()); return c; };
  run(pipeM, 0.05, new V3(X0 - 1.5, HT - 0.32, ZC - 0.2), new V3(X1 + 1.5, HT - 0.32, ZC - 0.2));
  run(brass, 0.03, new V3(X0 - 1.5, HT - 0.42, ZC - 0.16), new V3(X1 + 1.5, HT - 0.42, ZC - 0.16));
  for (const x of [-5, 0, 5]) box(1.2, 0.03, 0.08, glowC, x, HT - 0.17, (ZS + ZC) / 2, { noCast: true });

  // ── Pendants over the table, a lamp over the island ──
  const pendant = (x, z, drop) => {
    cyl(0.006, 0.006, drop, pipeM, x, HT - drop / 2, z, null, 6);
    const sh = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.16, 20, 1, true), std({ color: srgb('#a8762e'), roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide })); sh.position.set(x, HT - drop - 0.06, z); sh.castShadow = true; G.add(sh);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), glowA); b.position.set(x, HT - drop - 0.11, z); G.add(b);
  };
  for (const x of [0.6, 1.8, 3.0]) pendant(x, TZ, 0.72);
  for (const x of [-4.4, -2.6]) pendant(x, -1.275, 0.62);

  // ── Light: a warm, low fill; the table's key (the main shadows), a second over the island; the galley's strip, the floor lamp, the corridor ──
  const hemi = new THREE.HemisphereLight(srgb('#c8b8a0'), srgb('#2a2018'), 0.75); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#3a3430'), 0.5); G.add(amb);
  const key = new THREE.SpotLight(srgb('#ffc890'), 7.5, 8, 0.95, 0.75, 2); key.position.set(1.4, 2.45, 0.6); key.target.position.set(0.9, 0, 0.6);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; key.shadow.camera.near = 0.3; key.shadow.camera.far = 6; G.add(key); G.add(key.target);
  const islandKey = new THREE.SpotLight(srgb('#ffbc80'), 4.5, 5, 0.8, 0.7, 2); islandKey.position.set(-3.3, 2.4, -0.4); islandKey.target.position.set(-3.5, 0.6, -0.9);
  islandKey.castShadow = true; islandKey.shadow.mapSize.set(1024, 1024); islandKey.shadow.bias = -0.0005; islandKey.shadow.normalBias = 0.02; G.add(islandKey); G.add(islandKey.target);
  const galleyL = new THREE.PointLight(srgb('#ffb070'), 1.4, 3.5, 2); galleyL.position.set(-3.5, 1.4, ZO + 0.5); G.add(galleyL);
  const lampL = new THREE.PointLight(srgb('#ffb070'), 1.8, 4, 2); lampL.position.set(4.75, 1.45, ZO + 0.4); G.add(lampL);
  const corrL = new THREE.PointLight(srgb('#8ab0d8'), 2.2, 7, 2); corrL.position.set(0, 2.2, (ZS + ZC) / 2); G.add(corrL);
  const sofaL = new THREE.PointLight(srgb('#ffc890'), 1.0, 4, 2); sofaL.position.set(2.6, 2.2, -1.6); G.add(sofaL);

  // ── Where things happen ──
  const spots = {
    bench: { at: new V3(0.45, 0, 1.23), yaw: 0, seatY: 0.45 },
    wall: { at: new V3(-3.5, 0, -0.1), yaw: Math.PI, support: { kind: 'edge', y: 0.95, d: 0.85, bend: 0.95 } },
    table: { at: new V3(-0.55, 0, TZ), yaw: Math.PI / 2, top: 0.75, d: 0.55, w: 1.0, len: TX1 - TX0, grip: 'sides' },
    after: { at: new V3(2.3, 0, -2.48), yaw: 0, seatY: 0.44, beside: new V3(2.92, 0, -2.48) },
    watch: [{ at: new V3(-5.2, 0, 3.9), yaw: 0 }, { at: new V3(-1.0, 0, 3.7), yaw: 0 }, { at: new V3(2.6, 0, 3.8), yaw: 0 }, { at: new V3(5.6, 0, 3.5), yaw: 0 }],
    corner: { at: new V3(6.55, 0, 2.6), yaw: Math.PI / 2, next: { base: new V3(0, 0, 0), step: new V3(0, 0, -0.75), yaw: Math.PI / 2 } },
  };
  // (the island's own camera on their face: across it, from the galley side)
  const cams = { wall: [['Side', [-1.9, 1.4, -0.05], [0.1, 1.0, 0.1]], ['Behind', [-0.35, 1.2, -1.25], [0, 0.85, 0.15]], ['Seat', [-0.55, 1.25, -0.75], [0, 0.88, 0]],
    ['Their face', [-0.5, 1.15, 1.9], [0, 1.05, 0.6]], ['Captain', [-0.4, 1.42, -0.25], [0.43, 1.5, -0.07]], ['Room', [1.05, 1.9, -2.95], [-0.15, 0.8, -0.15]]] };

  // ── Low-CPU mode: the room's own shadows go (only the figures cast them, from the table's key, on a smaller map), the small lamps go (the
  // fill up a little to make up), the small things aren't drawn. ──
  const meshes = []; G.traverse(o => { if (o.isMesh) meshes.push(o); });
  const cast0 = new Map(meshes.map(m => [m, m.castShadow]));
  let low = false;
  function setLow(on) {
    low = !!on;
    for (const m of meshes) m.castShadow = low ? false : cast0.get(m);
    for (const d of detail) d.visible = !low;
    for (const l of [galleyL, lampL, sofaL]) l.visible = !low;
    hemi.intensity = low ? 1.0 : 0.75; corrL.intensity = low ? 2.8 : 2.2;
    islandKey.castShadow = !low;
    const sz = low ? 1024 : 2048;
    if (key.shadow.mapSize.x !== sz) { key.shadow.mapSize.set(sz, sz); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  }
  const { sideOf, sidesAt } = K.roomSides(G, { minX: X0, maxX: X1, minZ: ZO, maxZ: ZC, ht: HT }, [floor, corridorFloor]);
  let t = 0;
  return { group: G, spots, key, cams, setLow, sideOf, sidesAt, name: 'Galley & mess', bounds: { minX: X0 + 0.2, maxX: X1 - 0.2, minZ: ZO + 0.2, maxZ: ZC - 0.2 }, get low() { return low; },
    tick(dt) { t += dt; glowF.emissiveIntensity = 3.2 + 0.4 * Math.sin(t * 1.3); } };
}

root.Mess = { build };
})(typeof window !== 'undefined' ? window : globalThis);
