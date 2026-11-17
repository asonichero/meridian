// Project Meridian — the Captain's quarters (docs/ship.md: port, forward, beside the Ready Room, a connecting door between them so the
// Captain reaches the bridge in seconds without crossing the spine). 5.5 m along the ship by 6 m from the spine to the hull. Made, like the
// crew's cabins, for someone who'll live in it for decades (the ship's steel bones, warm surfaces, light kept to the ship's day), and for the
// one person aboard who is never off duty: a bridge repeater over the bed, a command terminal on a desk facing the room, a locked cabinet for
// what only the Captain can release, and a sitting area (a settee, a low table, an armless chair) for talking to someone in private.
//   Fore wall: the connecting door to the Ready Room, toward the spine; the desk free-standing in front of the wall, the Captain's chair
//   behind it, facing the room. Hull side: the bed, a double, its head on the fore wall, the repeater over it; aft of it, the head and shower
//   behind one door. Spine side: the door onto the spine, forward; built-in storage; the command locker in the aft corner. Aft: the sitting
//   area, under a view panel.
// Private, as the crew's cabins: nobody watches a correction here.
//
//   const cq = CaptainsQuarters.build(scene) → the same shape as Quarters.build
//   spots.bench: across the knee on the armless chair; spots.seats.bed: across the knee perched on the edge of the bed (the near arm up on the
//   mattress), its own aftercare there; spots.wall: standing, palms flat on the desk; spots.after: the settee.
// Its frame: x along the ship (fore −x), z across it (the spine −z, the hull +z).
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3;
const K = root.SuitBay.kit, Q = root.Quarters.kit, rnd = K.rnd, speckle = K.speckle;
const X0 = -2.75, X1 = 2.75, ZS = -3, ZH = 3, HT = 2.45;      // fore and aft walls, the spine side, the hull, height
// the bed (a double: from the fore wall to BX1, from BZ to the hull), its mattress's top; the desk (its front edge at DX1, from DZ0 to DZ1),
// its top; the wet room's partition (from WX0 aft, at WZ); the settee against the aft wall (from SZ0 to SZ1)
const BX1 = X0 + 2.1, BZ = ZH - 1.5, MT = 0.5, DX0 = X0 + 0.75, DX1 = X0 + 1.45, DZ0 = -0.85, DZ1 = 0.65, DY = 0.76, WX0 = -0.25, WZ = 1.35, SZ0 = -1.95, SZ1 = -0.35;

// ── Painted textures (the rest from the crew's cabins) ──
const carpetNavy = K.canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#3a4250'; c.fillRect(0, 0, w, h);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { const x0 = tx * 128, y0 = ty * 128, across = (tx + ty) % 2;
    for (let i = 0; i < 128; i += 3) { c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '220,230,255'},${0.03 + rnd() * 0.04})`; if (across) c.fillRect(x0, y0 + i, 128, 1.5); else c.fillRect(x0 + i, y0, 1.5, 128); } }
  speckle(c, w, h, 2400, '#1a1e28', 0.3, 1.4); speckle(c, w, h, 1400, '#8a92a8', 0.16, 1.4);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, w, 1.5); c.fillRect(0, 128, w, 1.5); c.fillRect(0, 0, 1.5, h); c.fillRect(128, 0, 1.5, h);
}, [5, 6]);
const leatherTex = K.canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#6e2e24'; c.fillRect(0, 0, w, h); speckle(c, w, h, 900, '#3a140e', 0.25, 2.2); speckle(c, w, h, 500, '#a85a44', 0.12, 2); }, [2, 2]);
const repeaterTex = K.canvasTex(256, 192, (c, w, h) => {
  c.fillStyle = '#081012'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a4a4c'; c.lineWidth = 3; c.strokeRect(3, 3, w - 6, h - 6);
  c.fillStyle = '#e8b04a'; c.font = '600 14px monospace'; c.fillText('BRIDGE · REPEATER', 14, 24);
  c.fillStyle = '#5ad8e0'; c.font = '13px monospace';
  for (const [i, s] of ['HEADING   0.4° OFF PLOT', 'BURN      COAST', 'REACTOR   NOMINAL', 'LIFE SUP  NOMINAL', 'STATIONS  STOOD DOWN'].entries()) c.fillText(s, 14, 52 + i * 20);
  c.strokeStyle = 'rgba(90,216,224,0.5)'; c.beginPath(); c.arc(w - 46, h - 46, 30, 0, 7); c.stroke(); c.beginPath(); c.moveTo(w - 46, h - 46); c.lineTo(w - 46 + 22, h - 46 - 20); c.stroke();
  c.fillStyle = 'rgba(90,216,224,0.07)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});
const commandTex = K.canvasTex(320, 200, (c, w, h) => {
  c.fillStyle = '#0a1214'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a3420'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = '#e8b04a'; c.font = '600 16px monospace'; c.fillText('COMMAND · CAPTAIN', 16, 30);
  c.fillStyle = 'rgba(90,216,224,0.75)'; c.font = '13px monospace';
  for (const [i, s] of ['SHIP\'S LOG          DAY 1,231', 'STANDING ORDERS      12', 'CREW                 6 ABOARD', '  ASHDOWN · VARGA · LINDQVIST', '  RUEL · HADDAD · OKAFOR', 'CORRECTIONS LOG      —'].entries()) c.fillText(s, 16, 58 + i * 21);
  c.fillStyle = 'rgba(90,216,224,0.07)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const detail = [];
  const std = (o) => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.2 }, o)), { grain: 0.05, scale: 8 });
  const box = (w, h, d, m, x, y, z, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; b.castShadow = !(o && o.noCast); b.receiveShadow = true; ((o && o.to) || G).add(b); if (o && o.detail) detail.push(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, rot, seg, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 16), m); c.position.set(x, y, z); if (rot) c.rotation.set(rot[0], rot[1], rot[2]); c.castShadow = true; c.receiveShadow = true; ((o && o.to) || G).add(c); if (o && o.detail) detail.push(c); return c; };
  const plane = (w, h, m, x, y, z, rx, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx || 0, ry || 0, 0); p.receiveShadow = true; G.add(p); return p; };

  const paintM = std({ map: Q.wallTex, roughness: 0.8, metalness: 0.05 });
  const dadoM = std({ color: srgb('#8a5e3e'), map: K.woodTex, roughness: 0.5, metalness: 0 });      // (a deeper wood than the crew's)
  const kickM = std({ map: K.panelTex('#2e2a28', [1, 1]), roughness: 0.6, metalness: 0.3 });
  const steelDark = std({ map: K.panelTex('#2a3034', [1, 1]), roughness: 0.6, metalness: 0.4 });
  const steel = std({ color: srgb('#9aa0a2'), roughness: 0.45, metalness: 0.6 });
  const brass = std({ color: srgb('#b08a3e'), roughness: 0.35, metalness: 0.75 });
  const veneer = std({ map: Q.oakTex, roughness: 0.5, metalness: 0 }), topM = std({ color: srgb('#f2e6d4'), map: Q.oakTex, roughness: 0.45, metalness: 0 });
  const deskWood = std({ color: srgb('#9a6a46'), map: K.woodTex, roughness: 0.4, metalness: 0 });      // (the Captain's desk: a dark, old-fashioned wood)
  const creamM = std({ color: srgb('#d2c6ac'), roughness: 0.6, metalness: 0.03 });
  const ceilM = std({ map: Q.ceilTex, roughness: 0.95, metalness: 0 });
  const mattressM = std({ map: Q.sheetTex, roughness: 0.95, metalness: 0 }), blanketM = std({ map: Q.weave('#2e3e58', 'rgba(255,255,255,0.05)'), roughness: 0.95, metalness: 0 });
  const padM = std({ map: Q.weave('#3e4a5e', 'rgba(255,255,255,0.05)'), roughness: 0.95, metalness: 0 });
  const leather = std({ map: leatherTex, roughness: 0.55, metalness: 0.05 });
  const glowW = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#fff1dc'), emissiveIntensity: 4 });
  const glowR = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ffc27a'), emissiveIntensity: 3 });
  const glowC = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ffe2b8'), emissiveIntensity: 3 });
  const glowD = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#5ad8e0'), emissiveIntensity: 2 });
  const glowG = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#e8b04a'), emissiveIntensity: 2.2 });      // (the Captain's own: gold)
  const viewDay = Q.viewTex(false), viewNight = Q.viewTex(true), viewM = new THREE.MeshBasicMaterial({ map: viewDay });

  // ── The shell, as the crew's cabins, but a navy carpet and a deeper wood dado ──
  const floor = plane(X1 - X0, ZH - ZS, std({ map: carpetNavy, roughness: 0.95, metalness: 0 }), 0, 0, 0, -Math.PI / 2);
  plane(X1 - X0, ZH - ZS, ceilM, 0, HT, 0, Math.PI / 2);
  const wallRun = (len, x, z, ry) => {
    const n = Math.max(1, Math.round(len / 0.9)), pw = len / n;
    for (let i = 0; i < n; i++) {
      const off = -len / 2 + pw * (i + 0.5), px = x + Math.cos(ry) * off, pz = z - Math.sin(ry) * off;
      plane(pw - 0.01, HT - 0.9, paintM, px, 0.9 + (HT - 0.9) / 2, pz, 0, ry); plane(pw, 0.78, dadoM, px, 0.12 + 0.39, pz, 0, ry); plane(pw, 0.12, kickM, px, 0.06, pz, 0, ry);
    }
  };
  wallRun(X1 - X0, 0, ZS, 0);                         // (the spine side, the door in it)
  wallRun(ZH - ZS, X0, 0, Math.PI / 2);               // (fore: the Ready Room beyond)
  wallRun(ZH - ZS, X1, 0, -Math.PI / 2);              // (aft)
  wallRun(X1 - X0, 0, ZH, Math.PI);                   // (the hull)
  for (const [len, x, z, ry] of [[X1 - X0, 0, ZS + 0.012, 0], [X1 - X0, 0, ZH - 0.012, 0], [ZH - ZS, X0 + 0.012, 0, Math.PI / 2], [ZH - ZS, X1 - 0.012, 0, Math.PI / 2]]) box(len, 0.03, 0.025, dadoM, x, 0.9, z, { ry, noCast: true });
  for (const [x, z] of [[X0, ZS], [X1, ZS], [X0, ZH], [X1, ZH]]) box(0.12, HT, 0.12, steelDark, x, HT / 2, z);
  for (const x of [-0.9, 0.9]) box(0.12, 0.1, ZH - ZS, steelDark, x, HT - 0.05, 0);

  // ── The doors: onto the spine, forward; into the Ready Room, in the fore wall toward the spine (a plate on it, its strip gold) ──
  const MX = X0 + 1.05;
  box(1.0, 2.2, 0.08, steelDark, MX, 1.1, ZS + 0.04); box(0.82, 2.02, 0.04, std({ map: K.panelTex('#6e7a78', [1, 1]), roughness: 0.55, metalness: 0.45 }), MX, 1.01, ZS + 0.09);
  box(0.4, 0.02, 0.02, glowD, MX, 2.12, ZS + 0.1, { noCast: true });
  box(0.1, 0.16, 0.03, steelDark, MX + 0.62, 1.2, ZS + 0.05, { detail: true }); box(0.06, 0.03, 0.01, glowD, MX + 0.62, 1.24, ZS + 0.07, { noCast: true, detail: true });
  const RZ = ZS + 1.43;
  box(0.08, 2.2, 0.95, steelDark, X0 + 0.04, 1.1, RZ); box(0.04, 2.02, 0.78, deskWood, X0 + 0.09, 1.01, RZ);
  box(0.02, 0.02, 0.36, glowG, X0 + 0.1, 2.12, RZ, { noCast: true });
  box(0.012, 0.07, 0.3, brass, X0 + 0.115, 1.6, RZ, { detail: true }); box(0.03, 0.14, 0.02, brass, X0 + 0.125, 1.02, RZ + 0.3, { detail: true });

  // ── The bed: a double, its head on the fore wall, along the hull; a padded headboard, a shelf over it with two reading lights; the bridge
  // repeater on the hull by its head. Its own group, so it never hides with the walls: they're perched on it. ──
  const bed = new THREE.Group(); G.add(bed);
  const bl = BX1 - X0, bw = ZH - BZ, bcx = (X0 + BX1) / 2, bcz = (BZ + ZH) / 2;
  box(bl, 0.3, bw, deskWood, bcx, 0.15, bcz, { to: bed });
  box(bl - 0.04, 0.06, bw - 0.04, kickM, bcx, 0.03, bcz, { to: bed, noCast: true });
  box(bl - 0.02, MT - 0.3, bw - 0.04, mattressM, bcx + 0.01, (0.3 + MT) / 2, bcz, { to: bed });
  box(0.9, 0.08, bw - 0.08, blanketM, BX1 - 0.48, MT + 0.04, bcz, { to: bed });
  for (const z of [bcz - 0.34, bcz + 0.34]) box(0.4, 0.1, 0.56, mattressM, X0 + 0.3, MT + 0.05, z, { to: bed });
  box(0.06, 0.75, bw - 0.1, padM, X0 + 0.03, MT + 0.42, bcz);
  box(0.24, 0.03, bw - 0.1, deskWood, X0 + 0.12, 1.36, bcz); box(0.02, 0.008, bw - 0.3, glowC, X0 + 0.2, 1.34, bcz, { noCast: true });
  for (const z of [BZ + 0.25, ZH - 0.25]) { box(0.1, 0.05, 0.12, brass, X0 + 0.18, 1.45, z, { detail: true }); box(0.06, 0.01, 0.08, glowR, X0 + 0.18, 1.42, z, { noCast: true }); }
  box(0.66, 0.46, 0.03, steelDark, X0 + 0.62, 1.22, ZH - 0.015);
  plane(0.6, 0.4, new THREE.MeshBasicMaterial({ map: repeaterTex }), X0 + 0.62, 1.22, ZH - 0.032, 0, Math.PI);

  // ── The head and shower aft of the bed, behind one door in their partition ──
  box(X1 - WX0, HT, 0.06, paintM, (WX0 + X1) / 2, HT / 2, WZ);
  box(0.06, HT, ZH - WZ, paintM, WX0, HT / 2, (WZ + ZH) / 2);
  const WD = WX0 + 1.1;
  box(0.74, 2.06, 0.02, steelDark, WD, 1.03, WZ - 0.033); box(0.66, 1.98, 0.03, veneer, WD, 1.0, WZ - 0.04);
  box(0.03, 0.12, 0.02, steel, WD + 0.25, 1.0, WZ - 0.065, { detail: true });

  // ── Along the spine: built-in storage aft of the door, then the command locker in the corner (steel, a keypad, its lamp gold) ──
  const S0 = MX + 0.65, S1 = X1 - 1.0, sl = S1 - S0, sx = (S0 + S1) / 2;
  box(sl, 0.1, 0.55, kickM, sx, 0.05, ZS + 0.275); box(sl, HT - 0.32, 0.6, creamM, sx, 0.1 + (HT - 0.32) / 2, ZS + 0.3);
  box(sl + 0.02, 0.04, 0.62, topM, sx, HT - 0.2, ZS + 0.31); box(sl - 0.1, 0.008, 0.02, glowC, sx, HT - 0.175, ZS + 0.08, { noCast: true });
  for (let i = 1; i < 4; i++) box(0.012, HT - 0.34, 0.01, steelDark, S0 + sl * i / 4, 0.1 + (HT - 0.32) / 2, ZS + 0.605, { noCast: true });
  for (let i = 0; i < 4; i++) box(0.02, 0.18, 0.03, steel, S0 + sl * (i + 0.5) / 4 + (i % 2 ? -1 : 1) * (sl / 8 - 0.06), 1.05, ZS + 0.615, { detail: true });
  const LX = X1 - 0.5;
  box(0.8, 1.9, 0.55, steelDark, LX, 0.95, ZS + 0.275);
  box(0.74, 1.8, 0.01, std({ map: K.panelTex('#3a4246', [1, 1]), roughness: 0.5, metalness: 0.6 }), LX, 0.97, ZS + 0.555, { noCast: true });
  box(0.12, 0.16, 0.02, std({ color: srgb('#1a1e20'), roughness: 0.4 }), LX + 0.2, 1.25, ZS + 0.57, { detail: true }); box(0.04, 0.012, 0.01, glowG, LX + 0.2, 1.31, ZS + 0.58, { noCast: true });
  box(0.03, 0.22, 0.03, brass, LX + 0.28, 1.0, ZS + 0.58, { detail: true });

  // ── The desk: free-standing in front of the fore wall, facing the room, its front edge where they stand; the Captain's chair behind it; the
  // command terminal on it, a brass lamp, the log ──
  const dz = (DZ0 + DZ1) / 2, dl = DZ1 - DZ0, dd = DX1 - DX0;
  box(dd, 0.05, dl, deskWood, (DX0 + DX1) / 2, DY - 0.025, dz);
  for (const z of [DZ0 + 0.05, DZ1 - 0.05]) box(dd - 0.06, DY - 0.05, 0.05, deskWood, (DX0 + DX1) / 2, (DY - 0.05) / 2, z);
  box(0.03, 0.42, dl - 0.1, deskWood, DX1 - 0.12, DY - 0.26, dz);      // (its modesty panel, set back from the front)
  box(0.02, 0.012, dl, brass, DX1 + 0.002, DY - 0.035, dz, { noCast: true, detail: true });
  box(0.04, 0.3, 0.04, steelDark, DX0 + 0.18, DY + 0.15, dz - 0.15); box(0.03, 0.3, 0.48, steelDark, DX0 + 0.2, DY + 0.38, dz - 0.15);
  plane(0.44, 0.27, new THREE.MeshBasicMaterial({ map: commandTex }), DX0 + 0.218, DY + 0.38, dz - 0.15, 0, Math.PI / 2);
  cyl(0.07, 0.08, 0.025, brass, DX0 + 0.2, DY + 0.012, DZ1 - 0.2, null, 16, { detail: true }); cyl(0.008, 0.008, 0.32, brass, DX0 + 0.2, DY + 0.17, DZ1 - 0.2, null, 8, { detail: true });
  const dShade = cyl(0.05, 0.1, 0.1, std({ color: srgb('#2e4a3e'), roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide }), DX0 + 0.26, DY + 0.33, DZ1 - 0.2, [0, 0, -0.5], 16, { detail: true }); dShade.castShadow = false;
  box(0.22, 0.03, 0.3, std({ color: srgb('#5a2a1e'), roughness: 0.7 }), DX0 + 0.42, DY + 0.015, dz + 0.25, { detail: true });      // (the log)
  // (the Captain's chair behind it)
  box(0.5, 0.08, 0.5, leather, X0 + 0.42, 0.48, dz); box(0.08, 0.55, 0.46, leather, X0 + 0.17, 0.8, dz);
  cyl(0.03, 0.03, 0.42, steel, X0 + 0.42, 0.22, dz, null, 10); cyl(0.24, 0.26, 0.02, steelDark, X0 + 0.42, 0.01, dz, null, 20);

  // ── The sitting area aft: a settee against the aft wall under the view panel, a low table, the armless chair facing it; a rug, a floor lamp,
  // a plant ──
  const sz = (SZ0 + SZ1) / 2, sw = SZ1 - SZ0, SX = X1 - 0.425;
  box(0.85, 0.28, sw, leather, SX, 0.14, sz); for (const z of [sz - sw / 4, sz + sw / 4]) box(0.6, 0.14, sw / 2 - 0.04, leather, SX - 0.1, 0.35, z);
  box(0.24, 0.55, sw, leather, X1 - 0.12, 0.56, sz); for (const z of [SZ0 + 0.1, SZ1 - 0.1]) box(0.85, 0.2, 0.2, leather, SX, 0.48, z);
  box(0.4, 0.04, 0.8, deskWood, X1 - 1.3, 0.4, sz); for (const [x, z] of [[X1 - 1.45, sz - 0.35], [X1 - 1.15, sz - 0.35], [X1 - 1.45, sz + 0.35], [X1 - 1.15, sz + 0.35]]) box(0.04, 0.38, 0.04, steelDark, x, 0.19, z);
  cyl(0.04, 0.035, 0.1, std({ color: srgb('#d8d0c0'), roughness: 0.4 }), X1 - 1.35, 0.47, sz - 0.2, null, 12, { detail: true });
  // (the armless chair: a sturdy one, straight-backed, leather seat)
  const CX = X1 - 2.4, CZ = sz;
  box(0.48, 0.06, 0.48, leather, CX, 0.45, CZ); box(0.48, 0.03, 0.48, deskWood, CX, 0.41, CZ);
  for (const [dx, dz_] of [[-0.21, -0.21], [-0.21, 0.21], [0.21, -0.21], [0.21, 0.21]]) box(0.04, 0.41, 0.04, deskWood, CX + dx, 0.205, CZ + dz_);
  box(0.04, 0.5, 0.44, deskWood, CX - 0.22, 0.72, CZ);
  { const r = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.012, 1.9), std({ map: Q.rugTex, roughness: 0.95, metalness: 0 })); r.position.set(X1 - 1.5, 0.006, sz); r.receiveShadow = true; G.add(r); }
  cyl(0.015, 0.015, 1.45, steelDark, X1 - 0.3, 0.73, SZ1 + 0.3, null, 8); cyl(0.12, 0.2, 0.22, std({ color: srgb('#d8b888'), roughness: 0.8, side: THREE.DoubleSide }), X1 - 0.3, 1.5, SZ1 + 0.3, null, 16); cyl(0.18, 0.2, 0.03, steelDark, X1 - 0.3, 0.015, SZ1 + 0.3, null, 16);
  cyl(0.11, 0.09, 0.2, std({ color: srgb('#a85a3a'), roughness: 0.85 }), X1 - 0.3, 0.1, SZ0 - 0.3, null, 16);
  for (let i = 0; i < 16; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), std({ color: srgb(i % 3 ? '#4a7a3a' : '#5e8e44'), roughness: 0.7 })); const a_ = i * 2.4; lf.scale.set(0.03, 0.22, 0.07); lf.position.set(X1 - 0.3 + Math.cos(a_) * 0.07, 0.36 + (i % 3) * 0.06, SZ0 - 0.3 + Math.sin(a_) * 0.07); lf.rotation.set(Math.sin(a_) * 0.6, a_, Math.cos(a_) * 0.6); lf.castShadow = true; G.add(lf); detail.push(lf); }
  // (the view panel over the settee, a cove over it)
  const VW = 1.5, VH = 0.78, VY = 1.5;
  box(0.04, VH + 0.1, VW + 0.1, steelDark, X1 - 0.02, VY, sz);
  plane(VW, VH, viewM, X1 - 0.042, VY, sz, 0, -Math.PI / 2);
  box(0.12, 0.04, VW + 0.3, deskWood, X1 - 0.06, VY + VH / 2 + 0.16, sz); box(0.02, 0.008, VW + 0.2, glowC, X1 - 0.03, VY + VH / 2 + 0.135, sz, { noCast: true });

  // ── The ceiling: the light panel over the middle, an air vent ──
  box(1.0, 0.03, 0.6, steelDark, 0, HT - 0.015, 0); box(0.9, 0.012, 0.5, glowW, 0, HT - 0.034, 0, { noCast: true });
  box(0.4, 0.02, 0.25, steelDark, 1.6, HT - 0.01, 1.2, { detail: true });

  // ── Light, kept to the ship's day (as the crew's cabins): the ceiling panel and a fill by day; at night the coves, the reading lights, the
  // desk lamp and the floor lamp, warm; the view panel's glow; the doors' strips ──
  const hemi = new THREE.HemisphereLight(srgb('#f2ead8'), srgb('#2a2a34'), 0.9); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#3a3430'), 0.5); G.add(amb);
  const key = new THREE.SpotLight(srgb('#fff2e0'), 7, 7, 1.1, 0.85, 2); key.position.set(0, HT - 0.06, 0); key.target.position.set(-0.4, 0, 0.1);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; key.shadow.camera.near = 0.2; key.shadow.camera.far = 6; G.add(key); G.add(key.target);
  const fill = new THREE.PointLight(srgb('#f6eee2'), 1.6, 7, 2); fill.position.set(1.4, HT - 0.3, -0.8); G.add(fill);
  const bedL = new THREE.PointLight(srgb('#ffbc78'), 1.2, 3, 2); bedL.position.set(X0 + 0.35, 1.3, bcz); G.add(bedL);
  const deskL = new THREE.PointLight(srgb('#ffc890'), 1.0, 2.5, 2); deskL.position.set(DX0 + 0.35, DY + 0.3, DZ1 - 0.25); G.add(deskL);
  const lampL = new THREE.PointLight(srgb('#ffb070'), 1.0, 3.5, 2); lampL.position.set(X1 - 0.3, 1.45, SZ1 + 0.3); G.add(lampL);
  const coveS = new THREE.PointLight(srgb('#ffd8a8'), 1.0, 3.5, 2); coveS.position.set(sx, HT - 0.12, ZS + 0.4); G.add(coveS);
  const viewL = new THREE.PointLight(srgb('#cfe0f0'), 0.8, 3, 2); viewL.position.set(X1 - 0.5, VY, sz); G.add(viewL);
  const doorL = new THREE.PointLight(srgb('#5ad8e0'), 0.4, 1.6, 2); doorL.position.set(MX, 2.0, ZS + 0.3); G.add(doorL);

  // ── Where things happen; their cameras where the room needs its own (the low table, the desk, its lamp and terminal in the way) ──
  const otkCams = face => [['Side', [0.05, 1.2, 2.4], [0.05, 0.76, 0.3]], ['Behind', [-1.4, 1.3, 0.67], [-0.05, 0.72, 0.3]], ['Seat', [-0.46, 1.5, 1.07], [-0.1, 0.82, 0.35]],
    ['Their face', ...face], ['Captain', [0.3, 0.92, 0.95], [0.0, 1.18, 0.1]], ['Room', [1.5, 1.9, 1.5], [0.0, 0.7, 0.25]]];
  const spots = {
    // (across the knee on the armless chair, facing the settee: they lie across the lap, the head toward the spine side, the legs toward the
    // hull, clear of the low table)
    // (their face from low at the Captain's left, beside the low table rather than under it)
    bench: { at: new V3(CX - 0.04, 0, CZ), yaw: Math.PI / 2, turn: 0, seatY: 0.48, cams: otkCams([[0.62, 0.36, 0.75], [0.3, 0.55, 0.36]]) },
    seats: {
      // (or perched on the edge of the bed, facing into the room: they lie along it in front, the head toward the pillows, the near arm up on
      // the mattress; and the aftercare stays on the bed, side by side on its edge)
      // (the desk stands in front of the bed: the side and room views come from across the room, aft, rather than from over it)
      bed: { at: new V3(-1.6, 0, BZ + 0.13), yaw: Math.PI, turn: 0, seatY: MT - 0.02, rest: { y: MT, edge: 0.11 },
        cams: otkCams([[0.42, 0.36, 1.05], [0.24, 0.55, 0.36]]).map(c => c[0] === 'Side' ? ['Side', [-1.8, 1.25, 1.7], [0.05, 0.76, 0.3]] : c[0] === 'Room' ? ['Room', [-1.6, 1.95, 1.9], [0.1, 0.7, 0.25]] : c),
        after: { at: new V3(-1.3, 0, BZ + 0.11), yaw: Math.PI, seatY: MT - 0.02, beside: new V3(-1.92, 0, BZ + 0.11),
          cams: [['Two-shot', [-1.3, 1.05, 1.6], [0.3, 0.85, 0.0]], ['Close', [-0.75, 1.05, 1.05], [0.3, 0.95, 0.0]]] } },
    },
    // (standing at the desk's front edge, palms flat on it, bent well forward; the Captain at their left)
    wall: { at: new V3(DX1 + 0.85, 0, dz), yaw: -Math.PI / 2, support: { kind: 'edge', y: DY + 0.01, d: 0.85, bend: 0.95, lines: 'desk' } },
    // (the aftercare, otherwise: the settee, side by side)
    after: { at: new V3(X1 - 0.52, 0, sz - 0.3), yaw: -Math.PI / 2, seatY: 0.44, beside: new V3(X1 - 0.52, 0, sz + 0.32) },
    watch: [],
    corner: { at: new V3(X1 - 0.4, 0, 0.6), yaw: -Math.PI / 2 },
  };

  // ── Day and night; low-CPU ──
  const meshes = []; G.traverse(o => { if (o.isMesh) meshes.push(o); });
  const cast0 = new Map(meshes.map(m => [m, m.castShadow]));
  let low = false, time = 'day';
  function apply() {
    const day = time === 'day';
    for (const m of meshes) m.castShadow = low ? false : cast0.get(m);
    for (const d of detail) d.visible = !low;
    doorL.visible = !low; viewL.visible = !low; deskL.visible = !low;
    key.intensity = day ? 7 : 0.5; glowW.emissiveIntensity = day ? 3.5 : 0.15; fill.intensity = day ? 1.6 : 0.2;
    bedL.intensity = day ? 0.3 : 1.3; glowR.emissiveIntensity = day ? 1.0 : 2.4; deskL.intensity = day ? 0.4 : 1.1; lampL.intensity = day ? 0.4 : 1.6;
    glowC.emissive.copy(srgb(day ? '#ffe6c4' : '#ffb466')); glowC.emissiveIntensity = day ? 2.5 : 3.5;
    coveS.color.copy(srgb(day ? '#ffe2bc' : '#ffb060')); coveS.intensity = (day ? 0.8 : 1.8) + (low ? 0.4 : 0);
    viewM.map = day ? viewDay : viewNight; viewM.needsUpdate = true; viewM.color.setScalar(day ? 1 : 0.85);
    viewL.color.copy(srgb(day ? '#d8e6f2' : '#4a5a8a')); viewL.intensity = day ? 0.9 : 0.35;
    hemi.color.copy(srgb(day ? '#f6efe2' : '#c8b49a')); hemi.intensity = (day ? 1.1 : 0.55) + (low ? 0.3 : 0);
    amb.intensity = day ? 0.6 : 0.35;
    const sz_ = low ? 1024 : 2048;
    if (key.shadow.mapSize.x !== sz_) { key.shadow.mapSize.set(sz_, sz_); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  }
  const setLow = on => { low = !!on; apply(); }, setTime = t => { time = t === 'night' ? 'night' : 'day'; apply(); };
  apply();
  const { sideOf, sidesAt } = K.roomSides(G, { minX: X0, maxX: X1, minZ: ZS, maxZ: ZH, ht: HT }, [floor, bed]);
  // (at the desk, their face from across it, the Captain's side of it, clear of the terminal and the lamp)
  const cams = { wall: [['Side', [-1.9, 1.4, -0.05], [0.1, 1.0, 0.1]], ['Behind', [-0.35, 1.2, -1.25], [0, 0.85, 0.15]], ['Seat', [-0.55, 1.25, -0.75], [0, 0.88, 0]],
    ['Their face', [0.5, 1.12, 2.0], [0.0, 1.0, 0.55]], ['Captain', [-0.4, 1.42, -0.25], [0.43, 1.5, -0.07]], ['Room', [1.05, 1.9, -2.95], [-0.15, 0.8, -0.15]]] };
  return { group: G, spots, key, cams, setLow, setTime, get time() { return time; }, sideOf, sidesAt, name: 'Captain’s quarters', private: true,
    bounds: { minX: X0 + 0.15, maxX: X1 - 0.15, minZ: ZS + 0.15, maxZ: ZH - 0.15 }, get low() { return low; }, tick() {} };
}

root.CaptainsQuarters = { build };
})(typeof window !== 'undefined' ? window : globalThis);
