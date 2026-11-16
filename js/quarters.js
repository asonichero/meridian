// Project Meridian — a crew cabin, as issued (docs/ship.md: six of them, three forward and three aft along the starboard side, each the same
// before its crew member makes it their own). Long and narrow, 3 m along the ship by 6 m from the hull to the spine. Down the fore wall, from
// the hull: a night table in the corner, the bunk (its head at the night table, drawers under it, a shelf over it), a tall locker, and the head
// in its own cubicle by the way in, its door opening aft onto the entrance; along the hull, from the night table, a work surface at desk height
// (to sit or stand at; no terminal); on the aft wall, the fold-down desk with the cabin's terminal and a stool. Standard-issue paint, a
// speckled vinyl deck, one light in the ceiling.
// Private: nobody watches a correction here (spots.watch is empty, and `private` tells the session to leave everyone else outside).
//
//   const cabin = Quarters.build(scene) → the same shape as SuitBay.build: { group, spots, bounds, cams, sideOf, sidesAt, setLow, setTime('day' | 'night'), tick, name, private }
//   spots.bench: across the knee, the Captain perched on the edge of the bunk, facing into the cabin (the bunk's head to their left);
//   spots.wall: standing, palms flat on the fore wall; spots.after: side by side on the edge of the bunk.
// Its frame: x along the ship (fore −x), z across it (the hull −z, the spine +z).
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3;
const K = root.SuitBay.kit, rnd = K.rnd, speckle = K.speckle;
const X0 = -1.5, X1 = 1.5, ZO = -3, ZC = 3, HT = 2.45;      // fore and aft walls, the hull, the spine side, height
// the bunk down the fore wall (out to BX, its head at BZ0 by the night table, its foot at BZ1), its mattress's top; the night table's depth
// and the work surface's along the hull; the locker; the head's cubicle in the fore corner by the door (out to HX, from HZ to the spine)
const BX = X0 + 0.86, BZ0 = ZO + 0.48, BZ1 = BZ0 + 2.1, MT = 0.48, NW = 0.5, WD = 0.5, WY = 0.78, LZ0 = 1.24, LZ1 = 1.82, HX = -0.4, HZ = 1.86;

// ── Painted textures ──
const vinylTex = K.canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#5a6066'; c.fillRect(0, 0, w, h);
  speckle(c, w, h, 1400, '#c8ccd0', 0.18, 1.6); speckle(c, w, h, 900, '#1a1e22', 0.22, 1.6);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h);      // (the sheets' seams)
}, [3, 6]);
const blanketTex = K.canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#4a5866'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < w; i += 4) { c.fillStyle = i % 8 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'; c.fillRect(i, 0, 2, h); c.fillRect(0, i, w, 1); }
  c.fillStyle = 'rgba(200,170,90,0.6)'; c.fillRect(0, 14, w, 3); c.fillRect(0, 22, w, 1);      // (the issue stripe near the hem)
  speckle(c, w, h, 200, '#000', 0.05, 2);
}, [2, 2]);
const sheetTex = K.canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#d8d6ce'; c.fillRect(0, 0, w, h); speckle(c, w, h, 120, '#000', 0.04, 2); }, [2, 2]);
const screenTex = K.canvasTex(256, 160, (c, w, h) => {
  c.fillStyle = '#0a1214'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a4a4c'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = '#5ad8e0'; c.font = '600 18px monospace'; c.fillText('MERIDIAN  ·  CABIN', 18, 34);
  c.fillStyle = 'rgba(90,216,224,0.55)'; c.font = '14px monospace'; for (const [i, s] of ['SHIP DAY 1,231', 'WATCH  —', 'MESSAGES  0', 'CABIN TEMP 20.5 C'].entries()) c.fillText(s, 18, 66 + i * 22);
  c.fillStyle = 'rgba(90,216,224,0.07)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const detail = [];      // (what the low-CPU mode leaves out)
  const std = (o) => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.2 }, o)), { grain: 0.05, scale: 8 });
  const box = (w, h, d, m, x, y, z, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; b.castShadow = !(o && o.noCast); b.receiveShadow = true; ((o && o.to) || G).add(b); if (o && o.detail) detail.push(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, rot, seg, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 16), m); c.position.set(x, y, z); if (rot) c.rotation.set(rot[0], rot[1], rot[2]); c.castShadow = true; c.receiveShadow = true; ((o && o.to) || G).add(c); if (o && o.detail) detail.push(c); return c; };
  const plane = (w, h, m, x, y, z, rx, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx || 0, ry || 0, 0); p.receiveShadow = true; G.add(p); return p; };

  const paintM = std({ map: K.panelTex('#8e958c', [1, 1]), roughness: 0.72, metalness: 0.12 });      // (standard issue: a pale grey-green over the steel)
  const kickM = std({ map: K.panelTex('#3a4246', [1, 1]), roughness: 0.6, metalness: 0.35 });
  const steelDark = std({ map: K.panelTex('#2a3034', [1, 1]), roughness: 0.6, metalness: 0.4 });
  const steel = std({ color: srgb('#9aa0a2'), roughness: 0.45, metalness: 0.6 });
  const locker = std({ map: K.panelTex('#6e7a78', [1, 1]), roughness: 0.55, metalness: 0.45 });
  const ceilM = std({ color: srgb('#b8bab4'), roughness: 0.85, metalness: 0.05 });
  const mattressM = std({ map: sheetTex, roughness: 0.95, metalness: 0 }), blanketM = std({ map: blanketTex, roughness: 0.95, metalness: 0 });
  const deskM = std({ color: srgb('#c4bca8'), roughness: 0.5, metalness: 0.05 });
  const glowW = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#fff1dc'), emissiveIntensity: 4 });      // (the ceiling panel)
  const glowR = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ffc27a'), emissiveIntensity: 3 });      // (the reading light)
  const glowD = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#5ad8e0'), emissiveIntensity: 2 });      // (the door's status strip)

  // ── The shell: the deck, the ceiling, the four walls (painted over a dark kick strip) ──
  const floor = plane(X1 - X0, ZC - ZO, std({ map: vinylTex, roughness: 0.55, metalness: 0.05 }), 0, 0, 0, -Math.PI / 2);
  plane(X1 - X0, ZC - ZO, ceilM, 0, HT, 0, Math.PI / 2);
  const wallRun = (len, x, z, ry) => {
    const n = Math.max(1, Math.round(len / 0.9)), pw = len / n;
    for (let i = 0; i < n; i++) {
      const off = -len / 2 + pw * (i + 0.5), px = x + Math.cos(ry) * off, pz = z - Math.sin(ry) * off;
      plane(pw - 0.01, HT - 0.12, paintM, px, 0.12 + (HT - 0.12) / 2, pz, 0, ry); plane(pw - 0.01, 0.12, kickM, px, 0.06, pz, 0, ry);
    }
  };
  wallRun(X1 - X0, 0, ZO, 0);                         // (the hull, behind the bunk)
  wallRun(ZC - ZO, X0, 0, Math.PI / 2);               // (fore: the next cabin beyond)
  wallRun(ZC - ZO, X1, 0, -Math.PI / 2);              // (aft)
  wallRun(X1 - X0, 0, ZC, Math.PI);                   // (the spine side, the door in it)
  // (the ribs at the corners and the beam across the ceiling's middle)
  for (const [x, z] of [[X0, ZO], [X1, ZO], [X0, ZC], [X1, ZC]]) box(0.12, HT, 0.12, steelDark, x, HT / 2, z);
  box(X1 - X0, 0.1, 0.12, steelDark, 0, HT - 0.05, 0.4);

  // ── The bunk down the fore wall: a steel frame, two drawers under it facing into the cabin, the mattress, the pillow at its head by the
  // night table, a blanket folded square at its foot; a shelf over it on the wall. Its own group, so it never hides with the fore wall when the
  // camera comes close: it's what they sit on. ──
  const bunk = new THREE.Group(); G.add(bunk);
  const bw = BX - X0, bl = BZ1 - BZ0, bc = (BZ0 + BZ1) / 2, bx = (X0 + BX) / 2;
  box(bw, 0.3, bl, steelDark, bx, 0.15, bc, { to: bunk });
  for (const z of [bc - bl / 4, bc + bl / 4]) { box(0.02, 0.2, bl / 2 - 0.06, locker, BX + 0.01, 0.15, z, { to: bunk }); box(0.03, 0.025, 0.22, steel, BX + 0.035, 0.2, z, { to: bunk, detail: true }); }
  box(bw - 0.04, MT - 0.3, bl, mattressM, bx, (0.3 + MT) / 2, bc, { to: bunk });
  box(bw - 0.1, 0.07, 0.6, blanketM, bx, MT + 0.035, BZ1 - 0.36, { to: bunk });      // (folded at the foot, square)
  box(0.5, 0.08, 0.4, mattressM, bx - 0.02, MT + 0.04, BZ0 + 0.26, { to: bunk });     // (the pillow)
  box(0.24, 0.03, bl - 0.3, locker, X0 + 0.12, 1.36, bc);                               // (the shelf, bare for now)
  box(0.02, 0.03, bl - 0.3, locker, X0 + 0.235, 1.39, bc, { detail: true });
  box(0.05, 0.3, 0.4, std({ color: srgb('#c8c4b8'), roughness: 0.9 }), X0 + 0.15, 1.53, bc + 0.5, { detail: true });      // (a folded towel on the shelf, issue)

  // ── The night table in the corner at the bunk's head: a drawer, a lamp on it ──
  const NT = 0.55;
  box(NW, NT, BZ0 - ZO - 0.02, locker, X0 + NW / 2, NT / 2, (ZO + BZ0) / 2 - 0.01);
  box(NW - 0.06, 0.16, 0.02, steelDark, X0 + NW / 2, NT - 0.12, BZ0 - 0.02, { noCast: true }); box(0.14, 0.02, 0.03, steel, X0 + NW / 2, NT - 0.12, BZ0 - 0.005, { detail: true });
  cyl(0.06, 0.07, 0.03, steelDark, X0 + 0.22, NT + 0.015, ZO + 0.2, null, 16); cyl(0.008, 0.008, 0.22, steel, X0 + 0.22, NT + 0.14, ZO + 0.2, null, 8);
  const shade = cyl(0.07, 0.1, 0.12, std({ color: srgb('#d8c8a8'), roughness: 0.85, side: THREE.DoubleSide }), X0 + 0.22, NT + 0.27, ZO + 0.2, null, 16); shade.castShadow = false;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), glowR); bulb.position.set(X0 + 0.22, NT + 0.24, ZO + 0.2); G.add(bulb);

  // ── The work surface along the hull, from the night table to the aft wall: a long top at desk height on brackets and a back rail, clear under
  // it (to sit at on the stool, or stand at) ──
  const W0 = X0 + NW + 0.02, wl = X1 - W0;
  box(wl, 0.04, WD, deskM, (W0 + X1) / 2, WY, ZO + WD / 2);
  box(wl, 0.08, 0.03, steelDark, (W0 + X1) / 2, WY - 0.06, ZO + 0.015);
  for (const x of [W0 + 0.12, (W0 + X1) / 2, X1 - 0.12]) box(0.025, 0.22, WD - 0.08, steel, x, WY - 0.13, ZO + (WD - 0.08) / 2);

  // ── The locker on the fore wall between the bunk's foot and the head, floor to head height: two doors, vents, a handle ──
  const LD = 0.58, LZ = (LZ0 + LZ1) / 2, LW = LZ1 - LZ0;
  box(LD, 2.0, LW, locker, X0 + LD / 2, 1.0, LZ);
  box(0.01, 1.9, 0.012, steelDark, X0 + LD + 0.005, 1.0, LZ, { noCast: true });
  for (let i = 0; i < 5; i++) box(0.01, 0.012, LW - 0.14, steelDark, X0 + LD + 0.005, 1.75 + i * 0.035, LZ, { noCast: true, detail: true });
  box(0.03, 0.16, 0.02, steel, X0 + LD + 0.015, 1.1, LZ - 0.04, { detail: true });

  // ── The fold-down desk on the aft wall: its top on two brackets, a stool tucked under, the cabin's terminal over it ──
  const DZ = -0.15;
  box(0.46, 0.035, 1.0, deskM, X1 - 0.23, 0.74, DZ);
  for (const z of [DZ - 0.42, DZ + 0.42]) box(0.36, 0.2, 0.025, steel, X1 - 0.2, 0.63, z);
  cyl(0.17, 0.17, 0.05, std({ color: srgb('#3a4a52'), roughness: 0.8 }), X1 - 0.5, 0.46, DZ + 0.05, null, 20);
  cyl(0.025, 0.025, 0.44, steel, X1 - 0.5, 0.22, DZ + 0.05, null, 10); cyl(0.18, 0.2, 0.02, steelDark, X1 - 0.5, 0.01, DZ + 0.05, null, 20);
  box(0.03, 0.42, 0.62, steelDark, X1 - 0.02, 1.25, DZ);
  plane(0.58, 0.36, new THREE.MeshBasicMaterial({ map: screenTex }), X1 - 0.04, 1.25, DZ, 0, -Math.PI / 2);

  // ── The head, in its cubicle in the fore corner by the way in: two partitions to the ceiling, its door in the aft one, opening onto the
  // entrance, shut ──
  const hz = (HZ + ZC) / 2;
  box(0.06, HT, ZC - HZ, paintM, HX, HT / 2, hz);
  box(HX - X0, HT, 0.06, paintM, (X0 + HX) / 2, HT / 2, HZ);
  box(0.03, 1.98, 0.66, locker, HX + 0.04, 1.0, hz);
  box(0.02, 2.06, 0.74, steelDark, HX + 0.033, 1.03, hz);
  box(0.03, 0.12, 0.02, steel, HX + 0.065, 1.0, hz - 0.25, { detail: true });
  for (let i = 0; i < 4; i++) box(0.01, 0.01, 0.4, steelDark, HX + 0.058, 0.15 + i * 0.03, hz, { noCast: true, detail: true });      // (its vent)

  // ── The door onto the spine, aft of the head: a heavy frame, the sliding leaf, a status strip; a hook beside it ──
  const DX = 0.45;
  box(1.0, 2.2, 0.08, steelDark, DX, 1.1, ZC - 0.04);
  box(0.82, 2.02, 0.04, locker, DX, 1.01, ZC - 0.09);
  box(0.4, 0.02, 0.02, glowD, DX, 2.12, ZC - 0.1, { noCast: true });
  box(0.1, 0.16, 0.03, steelDark, DX + 0.62, 1.2, ZC - 0.05, { detail: true }); box(0.06, 0.03, 0.01, glowD, DX + 0.62, 1.24, ZC - 0.07, { noCast: true, detail: true });
  cyl(0.012, 0.012, 0.08, steel, X1 - 0.25, 1.7, ZC - 0.04, [Math.PI / 2, 0, 0], 8, { detail: true });

  // ── The ceiling: the light panel over the middle of the cabin, an air vent ──
  box(0.9, 0.03, 0.5, steelDark, -0.2, HT - 0.015, -1.0); box(0.8, 0.012, 0.4, glowW, -0.2, HT - 0.034, -1.0, { noCast: true });
  box(0.4, 0.02, 0.25, steelDark, 0.6, HT - 0.01, 1.4, { detail: true });
  for (let i = 0; i < 6; i++) box(0.36, 0.006, 0.012, steel, 0.6, HT - 0.022, 1.3 + i * 0.04, { noCast: true, detail: true });

  // ── Light: the ceiling panel (the key, casting the shadows), a soft fill; the night table's lamp by the pillow; the door's strip ──
  const hemi = new THREE.HemisphereLight(srgb('#e8e4da'), srgb('#2a2a2c'), 0.9); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#3a3a3c'), 0.5); G.add(amb);
  const key = new THREE.SpotLight(srgb('#fff0dc'), 7, 6, 1.05, 0.8, 2); key.position.set(-0.2, HT - 0.06, -1.0); key.target.position.set(-0.45, 0, -1.1);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; key.shadow.camera.near = 0.2; key.shadow.camera.far = 5; G.add(key); G.add(key.target);
  const fill = new THREE.PointLight(srgb('#f0ece4'), 1.6, 6, 2); fill.position.set(0, HT - 0.3, 1.2); G.add(fill);
  const readL = new THREE.PointLight(srgb('#ffbc78'), 1.2, 3, 2); readL.position.set(X0 + 0.24, NT + 0.18, ZO + 0.3); G.add(readL);
  const doorL = new THREE.PointLight(srgb('#5ad8e0'), 0.5, 1.6, 2); doorL.position.set(DX, 2.0, ZC - 0.3); G.add(doorL);

  // ── Where things happen ──
  const spots = {
    // (perched on the edge of the bunk, square to it, facing into the cabin: they lie along it in front, the head toward the pillow end, the
    // legs toward the foot)
    bench: { at: new V3(BX - 0.13, 0, BZ0 + 1.15), yaw: Math.PI / 2, turn: 0, seatY: MT - 0.02 },
    // (facing the fore wall between the bunk's foot and the locker, well back from it: bent forward, palms flat on it a little below the shoulder)
    wall: { at: new V3(X0 + 0.95, 0, (BZ1 + LZ0) / 2 + 0.05), yaw: -Math.PI / 2, support: { kind: 'wall', y: 1.1, d: 0.95, bend: 0.85 } },
    after: { at: new V3(BX - 0.15, 0, BZ0 + 1.4), yaw: Math.PI / 2, seatY: MT - 0.02, beside: new V3(BX - 0.15, 0, BZ0 + 0.78) },
    watch: [],
    corner: { at: new V3(1.05, 0, 2.55), yaw: Math.PI / 2 },
  };

  // ── Day and night: by day the ceiling panel's up and the cabin's lit evenly; at night it's turned right down and the reading light's on,
  // warm, over the pillow. Low-CPU mode: the room's own shadows go (only the figures cast them), the small lamps and the small things go. ──
  const meshes = []; G.traverse(o => { if (o.isMesh) meshes.push(o); });
  const cast0 = new Map(meshes.map(m => [m, m.castShadow]));
  let low = false, time = 'day';
  function apply() {
    const day = time === 'day';
    for (const m of meshes) m.castShadow = low ? false : cast0.get(m);
    for (const d of detail) d.visible = !low;
    doorL.visible = !low;
    key.intensity = day ? 7 : 2.2; glowW.emissiveIntensity = day ? 4 : 0.6; fill.intensity = day ? 1.6 : 0.35;
    readL.visible = !day || !low; readL.intensity = day ? 0.5 : 1.5; glowR.emissiveIntensity = day ? 1.2 : 2.4;
    hemi.color.copy(srgb(day ? '#f2eee4' : '#c8b8a0')); hemi.intensity = (day ? 1.1 : 0.55) + (low ? 0.3 : 0);
    amb.intensity = day ? 0.6 : 0.4;
    const sz = low ? 1024 : 2048;
    if (key.shadow.mapSize.x !== sz) { key.shadow.mapSize.set(sz, sz); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  }
  const setLow = on => { low = !!on; apply(); }, setTime = t => { time = t === 'night' ? 'night' : 'day'; apply(); };
  apply();
  const { sideOf, sidesAt } = K.roomSides(G, { minX: X0, maxX: X1, minZ: ZO, maxZ: ZC, ht: HT }, [floor, bunk]);
  // (their face, at the wall: from low at their right, under the arm, looking up into it; far enough off the wall that the wall stays)
  const cams = { wall: [['Side', [-1.9, 1.4, -0.05], [0.1, 1.0, 0.1]], ['Behind', [-0.35, 1.2, -1.25], [0, 0.85, 0.15]], ['Seat', [-0.55, 1.25, -0.75], [0, 0.88, 0]],
    ['Their face', [-0.6, 0.6, 0.45], [0.0, 1.1, 0.38]], ['Captain', [-0.4, 1.42, -0.25], [0.43, 1.5, -0.07]], ['Room', [1.05, 1.9, -2.95], [-0.15, 0.8, -0.15]]] };
  return { group: G, spots, key, cams, setLow, setTime, get time() { return time; }, sideOf, sidesAt, name: 'Crew quarters', private: true,
    bounds: { minX: X0 + 0.15, maxX: X1 - 0.15, minZ: ZO + 0.15, maxZ: ZC - 0.15 }, get low() { return low; }, tick() {} };
}

root.Quarters = { build };
})(typeof window !== 'undefined' ? window : globalThis);
