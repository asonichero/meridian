// Project Meridian — the Med Bay (docs/ship.md: port, amidships, aft of the suit bay with a door into it, its own door onto the spine; Morgan's
// domain, the Medic's station). A compact clinic, clean and cool: a padded exam table in the middle that raises and lowers itself (set, when
// someone's taken over it, to their hips), a scanner arch parked at its foot; a counter with a sink and wall cabinets along the spine side,
// a supply cabinet by the door; Morgan's desk against the fore wall with the terminal for the crew's psych baselines; the recovery cot
// along the hull, a privacy curtain on a ceiling track round it; the oxygen and suction panel, the monitor and an IV stand aft. 5 m along the
// ship by 6 m.
//
//   const mb = MedBay.build(scene) → the same shape as Mess.build
//   spots.bench: across the knee on the edge of the recovery cot (the near arm on the mattress); spots.wall: standing, palms flat on the exam
//   table's long side; spots.table: over the exam table's end, hands holding its sides, the table set to their hips (`adjust`, `setTop`);
//   spots.after: the cot; watch: round the walls; corner: facing the hull, aft of the cot.
// Its frame: x along the ship (fore −x), z across it (the spine −z, the hull +z).
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3;
const K = root.SuitBay.kit, Q = root.Quarters.kit, rnd = K.rnd, speckle = K.speckle;
const X0 = -2.5, X1 = 2.5, ZS = -3, ZH = 3, HT = 2.5;
// the exam table (from TX0 to TX1 along the ship, its middle at TZ, TW wide; its top at TY unless set), the cot along the hull (from CX0 to
// CX1, out to CZ; its mattress's top)
const TX0 = -0.6, TX1 = 1.3, TZ = -0.2, TW = 0.66, TY = 0.85, CX0 = -1.7, CX1 = 0.4, CZ = ZH - 0.8, CT = 0.58;

// ── Painted textures ──
const floorTex = K.canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#c4ccc8'; c.fillRect(0, 0, w, h); speckle(c, w, h, 900, '#8a9490', 0.2, 1.4); speckle(c, w, h, 600, '#ffffff', 0.25, 1.4);
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, 0, w, 1.5); c.fillRect(0, 0, 1.5, h);
}, [4, 5]);
const wallTex = K.canvasTex(512, 512, (c, w, h) => {
  c.fillStyle = '#dde2de'; c.fillRect(0, 0, w, h); speckle(c, w, h, 500, '#000', 0.03, 5);
  c.strokeStyle = 'rgba(40,60,60,0.25)'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4);
  c.fillStyle = 'rgba(40,60,60,0.3)'; for (const [x, y] of [[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18]]) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
}, [1, 1]);
const vinylTex = K.canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#3e6a6a'; c.fillRect(0, 0, w, h); speckle(c, w, h, 400, '#1a3030', 0.2, 2); speckle(c, w, h, 200, '#8ab0b0', 0.12, 2); }, [2, 2]);
const baselineTex = K.canvasTex(320, 200, (c, w, h) => {
  c.fillStyle = '#0a1414'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a5a5a'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = '#5ad8e0'; c.font = '600 15px monospace'; c.fillText('CREW · PSYCH BASELINES', 14, 28);
  const names = ['ASHDOWN', 'VARGA', 'LINDQVIST', 'RUEL', 'HADDAD', 'OKAFOR'];
  c.font = '12px monospace'; names.forEach((n, i) => { const y = 54 + i * 23; c.fillStyle = 'rgba(90,216,224,0.75)'; c.fillText(n, 14, y);
    c.strokeStyle = 'rgba(90,216,224,0.7)'; c.lineWidth = 1.5; c.beginPath(); for (let x = 0; x < 160; x += 4) c.lineTo(130 + x, y - 4 - 6 * Math.sin(x * 0.08 + i) * (0.5 + rnd() * 0.5)); c.stroke(); });
  c.fillStyle = 'rgba(90,216,224,0.07)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});
const monitorTex = K.canvasTex(256, 160, (c, w, h) => {
  c.fillStyle = '#060c0c'; c.fillRect(0, 0, w, h);
  for (const [i, col] of [[0, '#6ae0a0'], [1, '#5ad8e0'], [2, '#e8c050']]) {
    const y0 = 34 + i * 46; c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
    for (let x = 0; x < 180; x += 3) { const p = (x % 60) / 60, v = i === 0 ? (p > 0.45 && p < 0.5 ? -18 : p > 0.5 && p < 0.55 ? 10 : 0) : -8 * Math.sin(x * (0.06 + i * 0.03)); c.lineTo(10 + x, y0 + v); } c.stroke();
    c.fillStyle = col; c.font = '600 18px monospace'; c.fillText(['72', '98', '16'][i], 200, y0 + 6);
  }
});
const curtainTex = K.canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#9ac8c4'; c.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 6) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(i, 0, 2, h); } c.fillStyle = 'rgba(255,255,255,0.5)'; for (let y = 10; y < h; y += 30) for (let x = 6 + (y / 30 % 2) * 12; x < w; x += 24) { c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); } });

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const detail = [];
  const std = (o) => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6, metalness: 0.15 }, o)), { grain: 0.04, scale: 8 });
  const box = (w, h, d, m, x, y, z, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; b.castShadow = !(o && o.noCast); b.receiveShadow = true; ((o && o.to) || G).add(b); if (o && o.detail) detail.push(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, rot, seg, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 16), m); c.position.set(x, y, z); if (rot) c.rotation.set(rot[0], rot[1], rot[2]); c.castShadow = !(o && o.noCast); c.receiveShadow = true; ((o && o.to) || G).add(c); if (o && o.detail) detail.push(c); return c; };
  const plane = (w, h, m, x, y, z, rx, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx || 0, ry || 0, 0); p.receiveShadow = true; G.add(p); return p; };

  const wallM = std({ map: wallTex, roughness: 0.55, metalness: 0.05 }), tealM = std({ color: srgb('#3a9a9e'), roughness: 0.5, metalness: 0.1 });
  const white = std({ color: srgb('#e8ece8'), roughness: 0.4, metalness: 0.1 }), steel = std({ color: srgb('#b8c0c2'), roughness: 0.3, metalness: 0.7 });
  const steelDark = std({ map: K.panelTex('#2a3034', [1, 1]), roughness: 0.6, metalness: 0.4 }), counterM = std({ color: srgb('#c8d0cc'), roughness: 0.25, metalness: 0.3 });
  const vinyl = std({ map: vinylTex, roughness: 0.45, metalness: 0.05 }), sheetM = std({ map: Q.sheetTex, roughness: 0.95, metalness: 0 });
  const glass = new THREE.MeshStandardMaterial({ color: srgb('#c8e0e0'), roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35 });
  const glowW = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#f0f8ff'), emissiveIntensity: 4 });
  const glowT = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#5ad8e0'), emissiveIntensity: 2.5 });

  // ── The shell: pale vinyl underfoot, white panels with a teal band, the ribs and the ceiling's beam ──
  const floor = plane(X1 - X0, ZH - ZS, std({ map: floorTex, roughness: 0.35, metalness: 0.05 }), 0, 0, 0, -Math.PI / 2);
  plane(X1 - X0, ZH - ZS, std({ map: Q.ceilTex, color: srgb('#e8ecee'), roughness: 0.95, metalness: 0 }), 0, HT, 0, Math.PI / 2);
  const wallRun = (len, x, z, ry) => { const n = Math.max(1, Math.round(len / 0.9)), pw = len / n;
    for (let i = 0; i < n; i++) { const off = -len / 2 + pw * (i + 0.5), px = x + Math.cos(ry) * off, pz = z - Math.sin(ry) * off; plane(pw - 0.01, HT, wallM, px, HT / 2, pz, 0, ry); } };
  wallRun(X1 - X0, 0, ZS, 0); wallRun(X1 - X0, 0, ZH, Math.PI); wallRun(ZH - ZS, X0, 0, Math.PI / 2); wallRun(ZH - ZS, X1, 0, -Math.PI / 2);
  for (const [len, x, z, ry] of [[X1 - X0, 0, ZS + 0.01, 0], [X1 - X0, 0, ZH - 0.01, 0], [ZH - ZS, X0 + 0.01, 0, Math.PI / 2], [ZH - ZS, X1 - 0.01, 0, Math.PI / 2]]) {
    box(len, 0.08, 0.012, tealM, x, 1.02, z, { ry, noCast: true }); box(len, 0.1, 0.02, std({ color: srgb('#9aa4a4'), roughness: 0.5 }), x, 0.05, z, { ry, noCast: true }); }
  for (const [x, z] of [[X0, ZS], [X1, ZS], [X0, ZH], [X1, ZH]]) box(0.12, HT, 0.12, steelDark, x, HT / 2, z);
  box(0.12, 0.1, ZH - ZS, steelDark, 0, HT - 0.05, 0);

  // ── The doors: onto the spine (the cross over it), and into the suit bay, forward ──
  const SDX = -0.5;
  box(1.1, 2.2, 0.08, steelDark, SDX, 1.1, ZS + 0.04); box(0.9, 2.02, 0.04, std({ map: K.panelTex('#c8ccc8', [1, 1]), roughness: 0.5, metalness: 0.4 }), SDX, 1.01, ZS + 0.09);
  box(0.4, 0.02, 0.02, glowT, SDX, 2.12, ZS + 0.1, { noCast: true });
  const BDZ = 1.43;
  box(0.08, 2.2, 1.1, steelDark, X0 + 0.04, 1.1, BDZ); box(0.04, 2.02, 0.9, std({ map: K.panelTex('#5a5246', [1, 1]), roughness: 0.55, metalness: 0.45 }), X0 + 0.09, 1.01, BDZ);
  box(0.02, 0.02, 0.4, glowT, X0 + 0.1, 2.12, BDZ, { noCast: true });

  // ── The exam table: a padded top on a column that raises and lowers it, a paper roll at its head; the scanner arch parked at its foot ──
  const tTop = new THREE.Group(); tTop.userData.keep = true; G.add(tTop);      // (kept: they lie on it)
  const tl = TX1 - TX0, tx = (TX0 + TX1) / 2;
  box(0.7, 0.05, 0.55, steelDark, tx, 0.025, TZ);
  const column = cyl(0.08, 0.08, 1, steel, tx, 0.5, TZ, null, 16);
  box(tl - 0.1, 0.05, TW - 0.06, steel, tx, -0.08, TZ, { to: tTop });
  box(tl, 0.08, TW, vinyl, tx, -0.04, TZ, { to: tTop });
  box(0.5, 0.012, TW - 0.08, sheetM, TX1 - 0.3, 0.006, TZ, { to: tTop, noCast: true });      // (the paper at its head)
  cyl(0.05, 0.05, TW - 0.06, white, TX1 + 0.04, -0.05, TZ, [Math.PI / 2, 0, 0], 12, { to: tTop, detail: true });
  let topNow = null;
  const setTop = y => { if (topNow !== null && Math.abs(y - topNow) < 1e-4) return; topNow = y; tTop.position.y = y; column.scale.y = y - 0.1; column.position.y = (y - 0.1) / 2; };
  setTop(TY);
  // (the arch: on short rails at the table's foot, its ring well over the top, a glow round its inside)
  const AX = TX1 - 0.15;
  for (const dz of [-(TW / 2 + 0.12), TW / 2 + 0.12]) { box(0.6, 0.03, 0.08, steel, AX, 0.015, TZ + dz); box(0.08, 1.05, 0.1, white, AX, 0.525, TZ + dz); }
  { const ring = new THREE.Mesh(new THREE.TorusGeometry(TW / 2 + 0.12, 0.06, 10, 28, Math.PI), white); ring.rotation.y = Math.PI / 2; ring.position.set(AX, 1.05, TZ); ring.castShadow = true; G.add(ring);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(TW / 2 + 0.07, 0.012, 6, 28, Math.PI), glowT); glow.rotation.y = Math.PI / 2; glow.position.set(AX, 1.05, TZ); G.add(glow); detail.push(glow); }

  // ── The recovery cot along the hull: a steel frame on castors, a mattress, a wedge pillow at its head; the curtain on its ceiling track
  // round the open side, drawn back to the head. Its own group, kept: they're sat on it. ──
  const cot = new THREE.Group(); cot.userData.keep = true; G.add(cot);
  const cl = CX1 - CX0, ccx = (CX0 + CX1) / 2, cd = ZH - CZ, ccz = (CZ + ZH) / 2;
  box(cl, 0.06, cd, steel, ccx, CT - 0.17, ccz, { to: cot });
  for (const x of [CX0 + 0.08, CX1 - 0.08]) for (const z of [CZ + 0.08, ZH - 0.08]) { box(0.04, CT - 0.2, 0.04, steel, x, (CT - 0.2) / 2 + 0.05, z, { to: cot }); cyl(0.04, 0.04, 0.03, steelDark, x, 0.04, z, [Math.PI / 2, 0, 0], 10, { to: cot, detail: true }); }
  box(cl - 0.02, 0.14, cd - 0.04, sheetM, ccx, CT - 0.07, ccz, { to: cot });
  box(0.42, 0.1, cd - 0.14, sheetM, CX0 + 0.25, CT + 0.05, ccz, { to: cot });
  box(cl - 0.3, 0.03, 0.03, steel, ccx, CT + 0.08, ZH - 0.05, { to: cot, detail: true });      // (its rail, hull side, up)
  box(0.03, 0.03, cl + 0.3, steel, ccx, HT - 0.04, CZ - 0.12, { ry: Math.PI / 2, noCast: true }); box(0.03, 0.03, cd + 0.12, steel, CX1 + 0.15, HT - 0.04, (CZ - 0.12 + ZH) / 2, { noCast: true });
  { const g = new THREE.PlaneGeometry(0.34, HT - 0.1 - (CT + 0.12), 24, 1), q = g.attributes.position;
    for (let i = 0; i < q.count; i++) q.setZ(i, Math.sin(q.getX(i) * 55) * 0.025); g.computeVertexNormals();
    const cu = new THREE.Mesh(g, std({ map: curtainTex, roughness: 0.9, metalness: 0, side: THREE.DoubleSide })); cu.position.set(CX0 - 0.02, (HT - 0.1 + CT + 0.12) / 2, CZ - 0.12); cu.castShadow = true; G.add(cu); }

  // ── Along the spine: the supply cabinet forward of the door, glass-fronted; aft of it the counter, the sink, the wall cabinets over ──
  box(1.15, 2.0, 0.45, white, X0 + 0.7, 1.0, ZS + 0.225); box(1.05, 1.0, 0.01, glass, X0 + 0.7, 1.45, ZS + 0.455, { noCast: true });
  for (const y of [1.1, 1.45, 1.8]) { box(1.05, 0.015, 0.38, white, X0 + 0.7, y, ZS + 0.23); for (let i = 0; i < 5; i++) box(0.12, 0.14, 0.12, std({ color: srgb(['#e8e4d8', '#6a9ad8', '#e8b04a', '#d8d8d8'][i % 4]), roughness: 0.6 }), X0 + 0.3 + i * 0.2, y + 0.08, ZS + 0.25, { detail: true }); }
  const KX0 = 0.25, KX1 = X1 - 0.1, kx = (KX0 + KX1) / 2, kl = KX1 - KX0;
  box(kl, 0.88, 0.58, white, kx, 0.44, ZS + 0.29); box(kl + 0.02, 0.04, 0.62, counterM, kx, 0.9, ZS + 0.31);
  for (let i = 1; i < 4; i++) box(0.01, 0.8, 0.01, std({ color: srgb('#9aa4a4') }), KX0 + kl * i / 4, 0.46, ZS + 0.585, { noCast: true });
  box(0.5, 0.02, 0.36, steel, KX0 + 0.5, 0.915, ZS + 0.3); cyl(0.015, 0.015, 0.3, steel, KX0 + 0.5, 1.07, ZS + 0.1, null, 8, { detail: true });
  box(kl, 0.6, 0.35, white, kx, 1.75, ZS + 0.175); for (let i = 1; i < 4; i++) box(0.01, 0.56, 0.01, std({ color: srgb('#9aa4a4') }), KX0 + kl * i / 4, 1.75, ZS + 0.355, { noCast: true });
  box(0.18, 0.24, 0.12, std({ color: srgb('#e8b04a'), roughness: 0.5 }), KX1 - 0.3, 1.04, ZS + 0.1, { detail: true });      // (sharps)

  // ── Morgan's desk against the fore wall, the baselines terminal on it, a chair; the anatomy display over it ──
  const DZ0 = ZS + 0.55, DZ1 = DZ0 + 1.2, dz = (DZ0 + DZ1) / 2;
  box(0.6, 0.04, 1.2, counterM, X0 + 0.3, 0.74, dz); for (const z of [DZ0 + 0.04, DZ1 - 0.04]) box(0.56, 0.72, 0.04, white, X0 + 0.3, 0.36, z);
  box(0.03, 0.34, 0.54, steelDark, X0 + 0.12, 1.0, dz); plane(0.5, 0.31, new THREE.MeshBasicMaterial({ map: baselineTex }), X0 + 0.137, 1.0, dz, 0, Math.PI / 2);
  box(0.44, 0.06, 0.44, std({ color: srgb('#3a4a52'), roughness: 0.7 }), X0 + 0.85, 0.46, dz + 0.1); box(0.06, 0.42, 0.4, std({ color: srgb('#3a4a52'), roughness: 0.7 }), X0 + 1.06, 0.72, dz + 0.1);
  cyl(0.03, 0.03, 0.42, steel, X0 + 0.85, 0.22, dz + 0.1, null, 10); cyl(0.2, 0.22, 0.02, steelDark, X0 + 0.85, 0.01, dz + 0.1, null, 16);
  box(0.03, 0.7, 0.9, steelDark, X0 + 0.015, 1.75, dz); box(0.01, 0.62, 0.82, std({ color: srgb('#0a1414'), emissive: srgb('#1a4a4a'), emissiveIntensity: 0.6 }), X0 + 0.032, 1.75, dz, { noCast: true });

  // ── Aft: the oxygen and suction panel, a monitor on its arm, the defibrillator; an IV stand by the cot's foot ──
  box(0.02, 0.5, 1.0, white, X1 - 0.01, 1.4, 0.9); for (let i = 0; i < 4; i++) cyl(0.03, 0.03, 0.04, i % 2 ? std({ color: srgb('#e8e8e8') }) : std({ color: srgb('#3a7a3a') }), X1 - 0.04, 1.4, 0.55 + i * 0.22, [0, 0, Math.PI / 2], 12, { detail: true });
  box(0.3, 0.05, 0.05, steel, X1 - 0.17, 1.85, 1.9); box(0.04, 0.28, 0.42, steelDark, X1 - 0.33, 1.85, 1.9); plane(0.38, 0.24, new THREE.MeshBasicMaterial({ map: monitorTex }), X1 - 0.352, 1.85, 1.9, 0, -Math.PI / 2);
  box(0.1, 0.3, 0.26, std({ color: srgb('#c83a2a'), roughness: 0.5 }), X1 - 0.06, 1.3, -0.4, { detail: true });
  cyl(0.012, 0.012, 1.8, steel, CX1 + 0.35, 0.9, ZH - 0.35, null, 8); cyl(0.2, 0.22, 0.03, steelDark, CX1 + 0.35, 0.03, ZH - 0.35, null, 5);
  box(0.12, 0.2, 0.05, glass, CX1 + 0.35, 1.65, ZH - 0.3, { detail: true });

  // ── The ceiling: two light panels, an exam light on its arm, parked high to the side ──
  for (const z of [-1.4, 1.2]) { box(1.3, 0.03, 0.6, steelDark, 0, HT - 0.015, z); box(1.2, 0.012, 0.5, glowW, 0, HT - 0.034, z, { noCast: true }); }
  cyl(0.02, 0.02, 0.4, steel, 0.4, HT - 0.2, -1.0, null, 8); box(0.6, 0.04, 0.04, steel, 0.65, HT - 0.4, -1.0);
  { const head = cyl(0.18, 0.22, 0.08, white, 0.95, HT - 0.45, -1.0, null, 20); const g = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), glowW); g.rotation.x = Math.PI / 2; g.position.set(0.95, HT - 0.495, -1.0); G.add(g); }

  // ── Light: clinical, cool and even; at night it goes down to a dim blue-white, the monitor and the arch glowing ──
  const hemi = new THREE.HemisphereLight(srgb('#f0f6f8'), srgb('#4a5050'), 1.3); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#3a4044'), 0.7); G.add(amb);
  const key = new THREE.SpotLight(srgb('#f4f8ff'), 9, 7, 1.15, 0.8, 2); key.position.set(0, HT - 0.06, 0.4); key.target.position.set(0, 0, 0.3);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; key.shadow.camera.near = 0.2; key.shadow.camera.far = 6; G.add(key); G.add(key.target);
  const fill = new THREE.PointLight(srgb('#eef4ff'), 2.6, 7, 2); fill.position.set(0, HT - 0.3, -1.4); G.add(fill);
  const fill2 = new THREE.PointLight(srgb('#eef4ff'), 2.0, 6, 2); fill2.position.set(-0.6, HT - 0.3, 2.0); G.add(fill2);

  // ── Where things happen ──
  const spots = {
    // (across the knee perched on the edge of the cot, facing into the room: they lie along it in front, the head toward its head, the near
    // arm on the mattress)
    bench: { at: new V3(ccx - 0.05, 0, CZ + 0.13), yaw: Math.PI, turn: 0, seatY: CT - 0.02, rest: { y: CT, edge: 0.11 } },
    // (standing at the exam table's long side, from the hull side, palms flat on its edge; the table at its usual height)
    wall: { at: new V3(tx - 0.05, 0, TZ + TW / 2 + 0.85), yaw: Math.PI, support: { kind: 'edge', y: TY + 0.01, d: 0.85, bend: 0.95, lines: 'exam' } },
    // (over the exam table's foot end, hands holding its sides: the table set to their hips, whatever their height)
    table: { at: new V3(TX0 - 0.55, 0, TZ), yaw: Math.PI / 2, top: TY, d: 0.55, w: TW, len: tl, grip: 'sides', adjust: [0.62, 1.02], setTop },
    after: { at: new V3(ccx + 0.2, 0, CZ + 0.11), yaw: Math.PI, seatY: CT - 0.02, beside: new V3(ccx - 0.42, 0, CZ + 0.11) },
    watch: [{ at: new V3(1.9, 0, -1.4), yaw: 0 }, { at: new V3(2.05, 0, -0.2), yaw: 0 }, { at: new V3(1.95, 0, 1.15), yaw: 0 }, { at: new V3(-1.9, 0, 0.3), yaw: 0 },
      { at: new V3(0.9, 0, -1.8), yaw: 0 }, { at: new V3(-1.55, 0, -0.75), yaw: 0 }],
    corner: { at: new V3(X1 - 0.4, 0, ZH - 0.45), yaw: 0, next: { base: new V3(0, 0, 0), step: new V3(-0.75, 0, 0), yaw: 0 } },
  };

  const meshes = []; G.traverse(o => { if (o.isMesh) meshes.push(o); });
  const cast0 = new Map(meshes.map(m => [m, m.castShadow]));
  let low = false, time = 'day';
  function apply() {
    const day = time === 'day';
    for (const m of meshes) m.castShadow = low ? false : cast0.get(m);
    for (const d of detail) d.visible = !low;
    fill2.visible = !low;
    key.intensity = day ? 9 : 3.5; glowW.emissiveIntensity = day ? 4 : 1.2; fill.intensity = day ? 2.6 : 0.8; fill2.intensity = day ? 2.0 : 0.6;
    hemi.color.copy(srgb(day ? '#f0f6f8' : '#b8c8e0')); hemi.intensity = (day ? 1.3 : 0.6) + (low ? 0.4 : 0); amb.intensity = day ? 0.7 : 0.45;
    const sz = low ? 1024 : 2048;
    if (key.shadow.mapSize.x !== sz) { key.shadow.mapSize.set(sz, sz); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  }
  const setLow = on => { low = !!on; apply(); }, setTime = t => { time = t === 'night' ? 'night' : 'day'; apply(); };
  apply();
  const { sideOf, sidesAt } = K.roomSides(G, { minX: X0, maxX: X1, minZ: ZS, maxZ: ZH, ht: HT }, [floor, cot]);
  // (standing at the exam table's side, their face from across it, low over its top)
  const cams = { wall: [['Side', [-1.9, 1.4, -0.05], [0.1, 1.0, 0.1]], ['Behind', [-0.35, 1.2, -1.25], [0, 0.85, 0.15]], ['Seat', [-0.55, 1.25, -0.75], [0, 0.88, 0]],
    ['Their face', [-0.3, 0.97, 2.1], [0.0, 1.05, 0.55]], ['Captain', [-0.4, 1.42, -0.25], [0.43, 1.5, -0.07]], ['Room', [1.05, 1.9, -2.95], [-0.15, 0.8, -0.15]]] };
  return { group: G, spots, key, cams, setLow, setTime, get time() { return time; }, sideOf, sidesAt, name: 'Med bay',
    bounds: { minX: X0 + 0.2, maxX: X1 - 0.2, minZ: ZS + 0.2, maxZ: ZH - 0.2 }, get low() { return low; }, tick() {} };
}

root.MedBay = { build };
})(typeof window !== 'undefined' ? window : globalThis);
