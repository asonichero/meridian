// Project Meridian — a crew cabin, as issued (docs/ship.md: six of them, three forward and three aft along the starboard side, each the same
// before its crew member makes it their own). Long and narrow, 3 m along the ship by 6 m from the hull to the spine. Down the fore wall, from
// the hull: a night table in the corner as wide as the bunk, the bunk (its head at the night table, drawers under it, a padded headboard and a
// shelf over it, a curtain drawn back to its foot), built-in storage from the bunk's foot to the head, and the head in its own cubicle by the
// way in, its door opening aft onto the entrance; along the hull, from the night table, a cork board, then a work surface at desk height (to
// sit or stand at; no terminal) under the view panel, a plant at its end; on the aft wall, toward the hull, the fold-down desk with the cabin's
// terminal and a stool, the rest of that wall clear; a rug in front of the bunk.
// Built for decades away: the ship's bones show (the ribs, the beam, the door's frame), but everything a person lives against is made for them,
// as in the mess: painted panels over a wood dado, pale oak furniture, painted storage, fabric, carpet, an acoustic ceiling; light kept to the ship's day
// and warm at night; privacy at the bunk; something growing; a window onto somewhere calm; somewhere to pin things.
// Private: nobody watches a correction here (spots.watch is empty, and `private` tells the session to leave everyone else outside).
//
//   const cabin = Quarters.build(scene) → the same shape as SuitBay.build: { group, spots, bounds, cams, sideOf, sidesAt, setLow, setTime('day' | 'night'), tick, name, private }
//   spots.bench: across the knee, the Captain perched on the edge of the bunk, facing into the cabin (the bunk's head to their left);
//   spots.wall: standing, palms flat on the aft wall; spots.after: side by side on the edge of the bunk.
// Its frame: x along the ship (fore −x), z across it (the hull −z, the spine +z).
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3;
const K = root.SuitBay.kit, rnd = K.rnd, speckle = K.speckle;
const X0 = -1.5, X1 = 1.5, ZO = -3, ZC = 3, HT = 2.45;      // fore and aft walls, the hull, the spine side, height
// the bunk down the fore wall (out to BX, its head at BZ0 by the night table, its foot at BZ1), its mattress's top; the night table as wide
// as the bunk; the work surface along the hull, its depth and height; the built-in storage's depth; the head's cubicle in the fore corner by
// the door (out to HX, from HZ to the spine); the desk's middle on the aft wall
const BX = X0 + 0.86, BZ0 = ZO + 0.48, BZ1 = BZ0 + 2.1, MT = 0.48, NW = BX - X0, WD = 0.5, WY = 0.78, SD = 0.6, HX = -0.4, HZ = 1.86, DZ = -0.7;

// ── Painted textures ──
// (the walls: painted panels, their seams and rivets showing (the ship's bones under the paint), clean: someone keeps it)
const wallTex = K.canvasTex(512, 512, (c, w, h) => {
  c.fillStyle = '#c2b59c'; c.fillRect(0, 0, w, h);
  speckle(c, w, h, 700, '#000', 0.04, 6); speckle(c, w, h, 500, '#fff', 0.05, 5);
  for (let i = 0; i < 90; i++) { c.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.035)'; c.lineWidth = 6 + rnd() * 14; c.beginPath(); const x = rnd() * w, y = rnd() * h; c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 60, y + 40 + rnd() * 80); c.stroke(); }
  c.strokeStyle = 'rgba(60,40,20,0.4)'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4); c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 2; c.strokeRect(7, 7, w - 14, h - 14);
  c.fillStyle = 'rgba(60,40,20,0.4)'; for (const [x, y] of [[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18], [w / 2, 18], [w / 2, h - 18]]) { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
}, [1, 1]);
// (the deck: carpet tiles, a warm grey-brown, each laid across its neighbours' grain; quiet underfoot)
const carpetTex = K.canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#6c5e52'; c.fillRect(0, 0, w, h);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { const x0 = tx * 128, y0 = ty * 128, across = (tx + ty) % 2;
    for (let i = 0; i < 128; i += 3) { c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,240,220'},${0.03 + rnd() * 0.04})`; if (across) c.fillRect(x0, y0 + i, 128, 1.5); else c.fillRect(x0 + i, y0, 1.5, 128); } }
  speckle(c, w, h, 2400, '#2a2420', 0.25, 1.4); speckle(c, w, h, 1600, '#b0a090', 0.18, 1.4);
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, 0, w, 1.5); c.fillRect(0, 128, w, 1.5); c.fillRect(0, 0, 1.5, h); c.fillRect(128, 0, 1.5, h);
}, [3, 6]);
// (the ceiling: acoustic tiles, perforated, a warm white)
const ceilTex = K.canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#d6cebe'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(80,60,40,0.16)'; for (let y = 6; y < h; y += 10) for (let x = 6 + (y / 10 % 2) * 5; x < w; x += 10) { c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(60,40,20,0.3)'; c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h);
}, [3, 6]);
const blanketTex = K.canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#3e6a66'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < w; i += 4) { c.fillStyle = i % 8 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'; c.fillRect(i, 0, 2, h); c.fillRect(0, i, w, 1); }
  c.fillStyle = 'rgba(230,210,170,0.7)'; c.fillRect(0, 14, w, 3); c.fillRect(0, 22, w, 1);      // (the issue stripe near the hem)
  speckle(c, w, h, 200, '#000', 0.05, 2);
}, [2, 2]);
const sheetTex = K.canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#e2dccc'; c.fillRect(0, 0, w, h); speckle(c, w, h, 120, '#000', 0.04, 2); }, [2, 2]);
// (woven fabric: the padded headboard's, the curtain's, the stool's)
const weave = (a, b, rep) => K.canvasTex(128, 128, (c, w, h) => { c.fillStyle = a; c.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 4) { c.fillStyle = i % 8 ? 'rgba(0,0,0,0.05)' : b; c.fillRect(i, 0, 2, h); c.fillRect(0, i, w, 1); } speckle(c, w, h, 220, '#000', 0.05, 2); }, rep || [2, 2]);
// (the rug: a flat weave, bands of rust, oat and teal)
const rugTex = K.canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#b8a487'; c.fillRect(0, 0, w, h);
  for (const [y, hh, col] of [[0, 18, '#7a4a32'], [26, 6, '#3e6a66'], [40, 4, '#7a4a32'], [h - 18, 18, '#7a4a32'], [h - 32, 6, '#3e6a66'], [h - 44, 4, '#7a4a32']]) { c.fillStyle = col; c.fillRect(0, y, w, hh); }
  for (let y = 70; y < h - 70; y += 24) { c.fillStyle = 'rgba(122,74,50,0.35)'; for (let x = 8; x < w; x += 24) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8, y + 8); c.lineTo(x, y + 16); c.lineTo(x - 8, y + 8); c.fill(); } }
  for (let i = 0; i < h; i += 2) { c.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.03})`; c.fillRect(0, i, w, 1); }
  speckle(c, w, h, 600, '#000', 0.06, 2);
});
// (pale oak: the furniture's veneer and the tops)
const oakTex = K.canvasTex(256, 64, (c, w, h) => {
  c.fillStyle = '#c9a77e'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) { c.strokeStyle = `rgba(${rnd() < 0.5 ? '120,80,40' : '240,215,180'},${0.12 + rnd() * 0.18})`; c.lineWidth = 0.6 + rnd() * 1.6; c.beginPath(); const y = rnd() * h; c.moveTo(0, y); for (let x = 0; x <= w; x += 16) c.lineTo(x, y + Math.sin(x * 0.03 + i) * 2.2); c.stroke(); }
  speckle(c, w, h, 160, '#5a3a1e', 0.08, 1.4);
}, [2, 1]);
const corkTex = K.canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#a4794e'; c.fillRect(0, 0, w, h); speckle(c, w, h, 900, '#5a3a1e', 0.35, 1.6); speckle(c, w, h, 600, '#d8b080', 0.3, 1.4); });
// The view panel's two scenes, painted: a still lake under hills in the late morning, and the same at night under the stars. On a ship this
// fast there's nothing outside a person would want to look at for long (the stars crowd ahead into a ring of shifted colour); every cabin is
// issued a window onto somewhere calm instead, kept to the ship's day.
const viewTex = night => K.canvasTex(512, 256, (c, w, h) => {
  const sky = c.createLinearGradient(0, 0, 0, h * 0.62);
  if (night) { sky.addColorStop(0, '#070b1c'); sky.addColorStop(1, '#1c2a48'); } else { sky.addColorStop(0, '#7fa8cf'); sky.addColorStop(0.7, '#cfdbe0'); sky.addColorStop(1, '#efe0c8'); }
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  if (night) { for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`; const r = rnd() < 0.08 ? 1.6 : 0.8; c.beginPath(); c.arc(rnd() * w, rnd() * h * 0.55, r, 0, 7); c.fill(); }
    c.fillStyle = '#f0ead8'; c.beginPath(); c.arc(w * 0.78, h * 0.18, 9, 0, 7); c.fill(); }
  else { c.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 7; i++) { const x = rnd() * w, y = 20 + rnd() * 60; c.beginPath(); c.ellipse(x, y, 40 + rnd() * 50, 6 + rnd() * 6, 0, 0, 7); c.fill(); } }
  const ridge = (y0, amp, f, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 4) c.lineTo(x, y0 - amp * (0.6 * Math.sin(x * f + y0) + 0.4 * Math.sin(x * f * 2.7 + 1.3))); c.lineTo(w, h); c.fill(); };
  ridge(h * 0.5, 22, 0.012, night ? '#141c30' : '#8ea0b0'); ridge(h * 0.58, 16, 0.02, night ? '#0e1424' : '#5e7a6a'); ridge(h * 0.64, 8, 0.035, night ? '#0a0e1a' : '#47634e');
  const lake = c.createLinearGradient(0, h * 0.66, 0, h); if (night) { lake.addColorStop(0, '#1a2640'); lake.addColorStop(1, '#0a0e1a'); } else { lake.addColorStop(0, '#a8bfcc'); lake.addColorStop(1, '#5f7f90'); }
  c.fillStyle = lake; c.fillRect(0, h * 0.68, w, h * 0.32);
  c.fillStyle = night ? 'rgba(240,234,216,0.25)' : 'rgba(255,255,255,0.25)'; for (let i = 0; i < 30; i++) c.fillRect(rnd() * w, h * 0.7 + rnd() * h * 0.28, 10 + rnd() * 30, 1);
  c.fillStyle = night ? '#06080f' : '#3a4e3a'; c.fillRect(0, h * 0.66, w, h * 0.025);      // (the far shore)
});
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

  // (the bones: the ribs, the beam, the door's frame, in dark steel as everywhere aboard; everything a person touches warm: painted panels over
  // a synthetic-wood dado, pale oak furniture, fabric, carpet underfoot, an acoustic ceiling)
  const paintM = std({ map: wallTex, roughness: 0.8, metalness: 0.05 });
  const dadoM = std({ color: srgb('#a07a54'), map: K.woodTex, roughness: 0.55, metalness: 0 });
  const kickM = std({ map: K.panelTex('#3a3430', [1, 1]), roughness: 0.6, metalness: 0.3 });
  const steelDark = std({ map: K.panelTex('#2a3034', [1, 1]), roughness: 0.6, metalness: 0.4 });
  const steel = std({ color: srgb('#9aa0a2'), roughness: 0.45, metalness: 0.6 });
  const veneer = std({ map: oakTex, roughness: 0.5, metalness: 0 });
  const topM = std({ color: srgb('#f2e6d4'), map: oakTex, roughness: 0.45, metalness: 0 });
  const creamM = std({ color: srgb('#d2c6ac'), roughness: 0.6, metalness: 0.03 });      // (the storage's doors, painted, as the galley's cupboards)
  const ceilM = std({ map: ceilTex, roughness: 0.95, metalness: 0 });
  const mattressM = std({ map: sheetTex, roughness: 0.95, metalness: 0 }), blanketM = std({ map: blanketTex, roughness: 0.95, metalness: 0 });
  const padM = std({ map: weave('#6a7e70', 'rgba(255,255,255,0.05)'), roughness: 0.95, metalness: 0 });
  const linenM = std({ map: weave('#c8b898', 'rgba(255,240,210,0.08)', [6, 2]), roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const seatM = std({ map: weave('#8a4a32', 'rgba(255,220,180,0.06)'), roughness: 0.95, metalness: 0 });
  const glowW = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#fff1dc'), emissiveIntensity: 4 });      // (the ceiling panel)
  const glowR = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ffc27a'), emissiveIntensity: 3 });      // (the night table's lamp)
  const glowC = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ffe2b8'), emissiveIntensity: 3 });      // (the coves' strips)
  const glowD = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#5ad8e0'), emissiveIntensity: 2 });      // (the door's status strip)
  const viewDay = viewTex(false), viewNight = viewTex(true), viewM = new THREE.MeshBasicMaterial({ map: viewDay });

  // ── The shell: the deck (carpet), the ceiling (acoustic tiles), the four walls (painted panels over a wood dado and a dark kick strip) ──
  const floor = plane(X1 - X0, ZC - ZO, std({ map: carpetTex, roughness: 0.95, metalness: 0 }), 0, 0, 0, -Math.PI / 2);
  plane(X1 - X0, ZC - ZO, ceilM, 0, HT, 0, Math.PI / 2);
  const wallRun = (len, x, z, ry) => {
    const n = Math.max(1, Math.round(len / 0.9)), pw = len / n;
    for (let i = 0; i < n; i++) {
      const off = -len / 2 + pw * (i + 0.5), px = x + Math.cos(ry) * off, pz = z - Math.sin(ry) * off;
      plane(pw - 0.01, HT - 0.9, paintM, px, 0.9 + (HT - 0.9) / 2, pz, 0, ry); plane(pw, 0.78, dadoM, px, 0.12 + 0.39, pz, 0, ry); plane(pw, 0.12, kickM, px, 0.06, pz, 0, ry);
    }
  };
  wallRun(X1 - X0, 0, ZO, 0);                         // (the hull)
  wallRun(ZC - ZO, X0, 0, Math.PI / 2);               // (fore: the next cabin beyond)
  wallRun(ZC - ZO, X1, 0, -Math.PI / 2);              // (aft)
  wallRun(X1 - X0, 0, ZC, Math.PI);                   // (the spine side, the door in it)
  // (the dado's rail, all round; the ribs at the corners and the beam across the ceiling's middle)
  for (const [len, x, z, ry] of [[X1 - X0, 0, ZO + 0.012, 0], [X1 - X0, 0, ZC - 0.012, 0], [ZC - ZO, X0 + 0.012, 0, Math.PI / 2], [ZC - ZO, X1 - 0.012, 0, Math.PI / 2]]) box(len, 0.03, 0.025, dadoM, x, 0.9, z, { ry, noCast: true });
  for (const [x, z] of [[X0, ZO], [X1, ZO], [X0, ZC], [X1, ZC]]) box(0.12, HT, 0.12, steelDark, x, HT / 2, z);
  box(X1 - X0, 0.1, 0.12, steelDark, 0, HT - 0.05, 0.4);

  // ── The bunk down the fore wall: a pale oak frame, two drawers under it facing into the cabin, the mattress, the pillow at its head by the
  // night table, a blanket folded square at its foot; along the wall over it, a padded headboard the bunk's length (soft to lean on, and it
  // quiets the cabin), a shelf over that with a warm strip under it; a curtain on a track along its open side, drawn back to its head. Its own
  // group, so it never hides with the fore wall when the camera comes close: it's what they sit on. ──
  const bunk = new THREE.Group(); G.add(bunk);
  const bw = BX - X0, bl = BZ1 - BZ0, bc = (BZ0 + BZ1) / 2, bx = (X0 + BX) / 2;
  box(bw, 0.3, bl, veneer, bx, 0.15, bc, { to: bunk });
  box(bw - 0.04, 0.06, bl - 0.04, kickM, bx - 0.02, 0.03, bc, { to: bunk, noCast: true });
  for (const z of [bc - bl / 4, bc + bl / 4]) { box(0.02, 0.18, bl / 2 - 0.08, veneer, BX + 0.01, 0.17, z, { to: bunk }); box(0.03, 0.025, 0.22, steel, BX + 0.035, 0.2, z, { to: bunk, detail: true }); }
  box(bw - 0.04, MT - 0.3, bl, mattressM, bx, (0.3 + MT) / 2, bc, { to: bunk });
  box(bw - 0.1, 0.07, 0.6, blanketM, bx, MT + 0.035, BZ1 - 0.36, { to: bunk });      // (folded at the foot, square)
  box(0.5, 0.09, 0.4, mattressM, bx - 0.02, MT + 0.045, BZ0 + 0.26, { to: bunk });    // (the pillow)
  box(0.05, 0.62, bl - 0.06, padM, X0 + 0.025, MT + 0.36, bc);                       // (the padded headboard)
  for (let i = 1; i < 4; i++) box(0.012, 0.6, 0.01, std({ color: srgb('#4a5a50'), roughness: 0.95 }), X0 + 0.052, MT + 0.36, BZ0 + 0.03 + (bl - 0.06) * i / 4, { noCast: true, detail: true });
  box(0.24, 0.03, bl - 0.3, topM, X0 + 0.12, 1.42, bc);                                // (the shelf, bare for now)
  box(0.02, 0.008, bl - 0.4, glowC, X0 + 0.2, 1.4, bc, { noCast: true });              // (its strip, lighting the headboard)
  box(0.05, 0.3, 0.4, std({ color: srgb('#e0d8c8'), roughness: 0.9 }), X0 + 0.15, 1.59, bc + 0.5, { detail: true });      // (a folded towel on the shelf, issue)
  box(0.025, 0.02, bl, steel, BX + 0.02, HT - 0.06, bc, { noCast: true });             // (the curtain's track)
  { const g = new THREE.PlaneGeometry(0.3, HT - 0.12 - (MT + 0.08), 24, 1), q = g.attributes.position;
    for (let i = 0; i < q.count; i++) { const x = q.getX(i); q.setZ(i, Math.sin(x * 60) * 0.025); }
    g.computeVertexNormals();
    const cu = new THREE.Mesh(g, linenM); cu.rotation.y = Math.PI / 2; cu.position.set(BX - 0.02, (HT - 0.12 + MT + 0.08) / 2, BZ0 + 0.2); cu.castShadow = true; cu.receiveShadow = true; G.add(cu); }

  // ── The night table in the corner at the bunk's head, as wide as the bunk: two drawers, a lamp on it ──
  const NT = 0.55;
  box(NW, NT, BZ0 - ZO - 0.02, veneer, X0 + NW / 2, NT / 2, (ZO + BZ0) / 2 - 0.01);
  box(NW + 0.01, 0.025, BZ0 - ZO, topM, X0 + NW / 2, NT + 0.012, (ZO + BZ0) / 2, { noCast: true });
  for (const y of [NT - 0.12, NT - 0.32]) { box(NW - 0.06, 0.16, 0.012, veneer, X0 + NW / 2, y, BZ0 - 0.016, { noCast: true }); box(0.18, 0.02, 0.03, steel, X0 + NW / 2, y, BZ0 - 0.005, { detail: true }); }
  cyl(0.06, 0.07, 0.03, steelDark, X0 + 0.22, NT + 0.04, ZO + 0.2, null, 16); cyl(0.008, 0.008, 0.22, steel, X0 + 0.22, NT + 0.16, ZO + 0.2, null, 8);
  const shade = cyl(0.07, 0.1, 0.12, std({ color: srgb('#e0d0b0'), roughness: 0.85, side: THREE.DoubleSide }), X0 + 0.22, NT + 0.29, ZO + 0.2, null, 16); shade.castShadow = false;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), glowR); bulb.position.set(X0 + 0.22, NT + 0.26, ZO + 0.2); G.add(bulb);
  // (over it on the hull, a cork board: somewhere to pin things, empty for now)
  box(0.62, 0.48, 0.02, std({ map: corkTex, roughness: 0.95, metalness: 0 }), X0 + 0.46, 1.32, ZO + 0.012);
  box(0.66, 0.52, 0.012, topM, X0 + 0.46, 1.32, ZO + 0.006, { noCast: true });

  // ── The work surface along the hull, from the night table to the aft wall: a long wood top at desk height on brackets, clear under it (to sit
  // at, on its stool, or stand at); over it, the view panel, a cove strip over that, a plant at its far end ──
  const W0 = X0 + NW + 0.02, wl = X1 - W0, wc = (W0 + X1) / 2;
  box(wl, 0.04, WD, topM, wc, WY, ZO + WD / 2);
  box(wl, 0.08, 0.03, steelDark, wc, WY - 0.06, ZO + 0.015);
  for (const x of [W0 + 0.12, wc, X1 - 0.12]) box(0.025, 0.22, WD - 0.08, steel, x, WY - 0.13, ZO + (WD - 0.08) / 2);
  cyl(0.17, 0.17, 0.06, seatM, wc - 0.35, 0.6, ZO + 0.62, null, 20); cyl(0.025, 0.025, 0.58, steel, wc - 0.35, 0.29, ZO + 0.62, null, 10); cyl(0.18, 0.2, 0.02, steelDark, wc - 0.35, 0.01, ZO + 0.62, null, 20);
  cyl(0.12, 0.12, 0.012, steel, wc - 0.35, 0.28, ZO + 0.62, [0, 0, 0], 16, { detail: true });      // (its foot ring)
  const VX = wc + 0.1, VW = 1.5, VH = 0.78, VY = 1.46;
  box(VW + 0.1, VH + 0.1, 0.04, steelDark, VX, VY, ZO + 0.02);
  const view = plane(VW, VH, viewM, VX, VY, ZO + 0.042, 0, 0);
  box(VW + 0.3, 0.04, 0.12, topM, VX, VY + VH / 2 + 0.16, ZO + 0.06);                 // (the cove over it)
  box(VW + 0.2, 0.008, 0.02, glowC, VX, VY + VH / 2 + 0.135, ZO + 0.03, { noCast: true });
  // (a plant from hydroponics, in a clay pot)
  cyl(0.08, 0.06, 0.13, std({ color: srgb('#a85a3a'), roughness: 0.85 }), X1 - 0.24, WY + 0.085, ZO + 0.24, null, 16);
  for (let i = 0; i < 14; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), std({ color: srgb(i % 3 ? '#4a7a3a' : '#5e8e44'), roughness: 0.7 })); const a_ = i * 2.4; lf.scale.set(0.022, 0.13, 0.05); lf.position.set(X1 - 0.24 + Math.cos(a_) * 0.05, WY + 0.22 + (i % 3) * 0.04, ZO + 0.24 + Math.sin(a_) * 0.05); lf.rotation.set(Math.sin(a_) * 0.7, a_, Math.cos(a_) * 0.7); lf.castShadow = true; G.add(lf); detail.push(lf); }

  // ── Built-in storage down the fore wall from the bunk's foot to the head: cream-painted doors on a recessed plinth, four tall ones (two with
  // vents), a row of cupboards over them, a handle each; stopping short of the ceiling, a warm strip on top washing up over it ──
  const S0 = BZ1 + 0.02, S1 = HZ - 0.03, sl = S1 - S0, sz = (S0 + S1) / 2, sf = X0 + SD, ST = HT - 0.22;
  box(SD - 0.05, 0.1, sl, kickM, X0 + (SD - 0.05) / 2, 0.05, sz);
  box(SD, ST - 0.1, sl, creamM, X0 + SD / 2, 0.1 + (ST - 0.1) / 2, sz);
  box(SD + 0.02, 0.04, sl + 0.02, topM, X0 + SD / 2, ST + 0.02, sz);
  box(0.02, 0.008, sl - 0.1, glowC, X0 + SD - 0.08, ST + 0.045, sz, { noCast: true });
  box(0.01, 0.012, sl, steelDark, sf + 0.005, 1.86, sz, { noCast: true });
  for (let i = 1; i < 4; i++) box(0.01, ST - 0.12, 0.012, steelDark, sf + 0.005, 0.1 + (ST - 0.1) / 2, S0 + sl * i / 4, { noCast: true });
  for (let i = 0; i < 4; i++) {
    const zc = S0 + sl * (i + 0.5) / 4, hz_ = zc + (i % 2 ? -1 : 1) * (sl / 8 - 0.06);
    box(0.03, 0.18, 0.02, steel, sf + 0.015, 1.05, hz_, { detail: true }); box(0.03, 0.02, 0.1, steel, sf + 0.015, 1.93, zc, { detail: true });
    if (i === 1 || i === 2) for (let k = 0; k < 5; k++) box(0.01, 0.012, sl / 4 - 0.16, steelDark, sf + 0.005, 1.6 + k * 0.035, zc, { noCast: true, detail: true });
  }

  // ── The fold-down desk on the aft wall, toward the hull: a wood top on two brackets, a stool tucked under, the cabin's terminal over it ──
  box(0.46, 0.035, 1.0, topM, X1 - 0.23, 0.74, DZ);
  for (const z of [DZ - 0.42, DZ + 0.42]) box(0.36, 0.2, 0.025, steel, X1 - 0.2, 0.63, z);
  cyl(0.17, 0.17, 0.05, seatM, X1 - 0.5, 0.46, DZ + 0.05, null, 20);
  cyl(0.025, 0.025, 0.44, steel, X1 - 0.5, 0.22, DZ + 0.05, null, 10); cyl(0.18, 0.2, 0.02, steelDark, X1 - 0.5, 0.01, DZ + 0.05, null, 20);
  box(0.03, 0.42, 0.62, steelDark, X1 - 0.02, 1.25, DZ);
  plane(0.58, 0.36, new THREE.MeshBasicMaterial({ map: screenTex }), X1 - 0.04, 1.25, DZ, 0, -Math.PI / 2);

  // ── The rug in front of the bunk ──
  { const r = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.012, 1.7), std({ map: rugTex, roughness: 0.95, metalness: 0 })); r.position.set(BX + 0.62, 0.006, bc - 0.05); r.receiveShadow = true; G.add(r); }

  // ── The head, in its cubicle in the fore corner by the way in: two partitions to the ceiling, its wood door in the aft one, opening onto the
  // entrance, shut ──
  const hz = (HZ + ZC) / 2;
  box(0.06, HT, ZC - HZ, paintM, HX, HT / 2, hz);
  box(HX - X0, HT, 0.06, paintM, (X0 + HX) / 2, HT / 2, HZ);
  box(0.03, 1.98, 0.66, veneer, HX + 0.04, 1.0, hz);
  box(0.02, 2.06, 0.74, steelDark, HX + 0.033, 1.03, hz);
  box(0.03, 0.12, 0.02, steel, HX + 0.065, 1.0, hz - 0.25, { detail: true });
  for (let i = 0; i < 4; i++) box(0.01, 0.01, 0.4, steelDark, HX + 0.058, 0.15 + i * 0.03, hz, { noCast: true, detail: true });      // (its vent)

  // ── The door onto the spine, aft of the head: a heavy frame, the sliding leaf, a status strip; a hook beside it ──
  const DX = 0.45;
  box(1.0, 2.2, 0.08, steelDark, DX, 1.1, ZC - 0.04);
  box(0.82, 2.02, 0.04, std({ map: K.panelTex('#6e7a78', [1, 1]), roughness: 0.55, metalness: 0.45 }), DX, 1.01, ZC - 0.09);
  box(0.4, 0.02, 0.02, glowD, DX, 2.12, ZC - 0.1, { noCast: true });
  box(0.1, 0.16, 0.03, steelDark, DX + 0.62, 1.2, ZC - 0.05, { detail: true }); box(0.06, 0.03, 0.01, glowD, DX + 0.62, 1.24, ZC - 0.07, { noCast: true, detail: true });
  cyl(0.012, 0.012, 0.08, steel, X1 - 0.25, 1.7, ZC - 0.04, [Math.PI / 2, 0, 0], 8, { detail: true });

  // ── The ceiling: the light panel over the middle of the cabin, an air vent ──
  box(0.9, 0.03, 0.5, steelDark, -0.2, HT - 0.015, -1.0); box(0.8, 0.012, 0.4, glowW, -0.2, HT - 0.034, -1.0, { noCast: true });
  box(0.4, 0.02, 0.25, steelDark, 0.6, HT - 0.01, 1.4, { detail: true });
  for (let i = 0; i < 6; i++) box(0.36, 0.006, 0.012, steel, 0.6, HT - 0.022, 1.3 + i * 0.04, { noCast: true, detail: true });

  // ── Light, kept to the ship's day: the ceiling panel (the key, casting the shadows) and a soft fill by day; the coves (over the storage,
  // under the shelf, over the view panel) warm and low at night, with the night table's lamp; the view panel's own glow; the door's strip ──
  const hemi = new THREE.HemisphereLight(srgb('#f2ead8'), srgb('#3a3028'), 0.9); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#3a3430'), 0.5); G.add(amb);
  const key = new THREE.SpotLight(srgb('#fff2e0'), 6, 6, 1.05, 0.85, 2); key.position.set(-0.2, HT - 0.06, -1.0); key.target.position.set(-0.45, 0, -1.1);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; key.shadow.camera.near = 0.2; key.shadow.camera.far = 5; G.add(key); G.add(key.target);
  const fill = new THREE.PointLight(srgb('#f6eee2'), 1.6, 6, 2); fill.position.set(0, HT - 0.3, 1.2); G.add(fill);
  const readL = new THREE.PointLight(srgb('#ffbc78'), 1.2, 3, 2); readL.position.set(X0 + 0.24, NT + 0.2, ZO + 0.3); G.add(readL);
  const coveS = new THREE.PointLight(srgb('#ffd8a8'), 1.0, 3.2, 2); coveS.position.set(X0 + 0.4, HT - 0.12, sz); G.add(coveS);
  const coveB = new THREE.PointLight(srgb('#ffcf98'), 0.8, 2.2, 2); coveB.position.set(X0 + 0.35, 1.3, bc); G.add(coveB);
  const viewL = new THREE.PointLight(srgb('#cfe0f0'), 0.8, 3, 2); viewL.position.set(VX, VY, ZO + 0.5); G.add(viewL);
  const doorL = new THREE.PointLight(srgb('#5ad8e0'), 0.5, 1.6, 2); doorL.position.set(DX, 2.0, ZC - 0.3); G.add(doorL);

  // ── Where things happen ──
  const spots = {
    // (perched on the edge of the bunk, square to it, facing into the cabin: they lie along it in front, the head toward the pillow end, the
    // legs toward the foot)
    // (and their near arm, beside the Captain, rests up on the mattress, the hand gripping its edge: `rest`, its top and its edge's distance out)
    bench: { at: new V3(BX - 0.13, 0, BZ0 + 1.15), yaw: Math.PI / 2, turn: 0, seatY: MT - 0.02, rest: { y: MT, edge: 0.11 } },
    // (facing the aft wall, between the desk and the way in, well back from it: bent forward, palms flat on it a little below the shoulder; far
    // enough along from the desk that the Captain, at their left, toward the hull, stands clear of it)
    wall: { at: new V3(X1 - 0.95, 0, DZ + 0.5 + 0.95), yaw: Math.PI / 2, support: { kind: 'wall', y: 1.1, d: 0.95, bend: 0.85 } },
    after: { at: new V3(BX - 0.15, 0, BZ0 + 1.4), yaw: Math.PI / 2, seatY: MT - 0.02, beside: new V3(BX - 0.15, 0, BZ0 + 0.78) },
    watch: [],
    corner: { at: new V3(1.05, 0, 2.55), yaw: Math.PI / 2 },
  };

  // ── Day and night: by day the ceiling panel's up and the cabin's lit evenly, the view panel bright, the coves a soft wash; at night the panel's
  // all but off and it's the coves, amber, the lamp by the pillow, and the view under the stars. Low-CPU mode: the room's own shadows go (only
  // the figures cast them), the small lamps and the small things go. ──
  const meshes = []; G.traverse(o => { if (o.isMesh) meshes.push(o); });
  const cast0 = new Map(meshes.map(m => [m, m.castShadow]));
  let low = false, time = 'day';
  function apply() {
    const day = time === 'day';
    for (const m of meshes) m.castShadow = low ? false : cast0.get(m);
    for (const d of detail) d.visible = !low;
    doorL.visible = !low; coveB.visible = !low; viewL.visible = !low;
    key.intensity = day ? 6 : 0.5; glowW.emissiveIntensity = day ? 3.5 : 0.15; fill.intensity = day ? 1.5 : 0.2;
    readL.visible = !day || !low; readL.intensity = day ? 0.4 : 1.4; glowR.emissiveIntensity = day ? 1.2 : 2.4;
    glowC.emissive.copy(srgb(day ? '#ffe6c4' : '#ffb466')); glowC.emissiveIntensity = day ? 2.5 : 3.5;
    coveS.color.copy(srgb(day ? '#ffe2bc' : '#ffb060')); coveS.intensity = (day ? 0.9 : 2.4) + (low ? 0.4 : 0);
    coveB.color.copy(srgb(day ? '#ffdcb0' : '#ffb060')); coveB.intensity = day ? 0.6 : 1.2;
    viewM.map = day ? viewDay : viewNight; viewM.needsUpdate = true; viewM.color.setScalar(day ? 1 : 0.85);
    viewL.color.copy(srgb(day ? '#d8e6f2' : '#4a5a8a')); viewL.intensity = day ? 0.9 : 0.35;
    hemi.color.copy(srgb(day ? '#f6efe2' : '#c8b49a')); hemi.intensity = (day ? 1.1 : 0.55) + (low ? 0.3 : 0);
    amb.intensity = day ? 0.6 : 0.35;
    const sz_ = low ? 1024 : 2048;
    if (key.shadow.mapSize.x !== sz_) { key.shadow.mapSize.set(sz_, sz_); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
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

root.Quarters = { build, kit: { wallTex, carpetTex, ceilTex, weave, rugTex, corkTex, viewTex, oakTex, sheetTex, blanketTex, screenTex } };
})(typeof window !== 'undefined' ? window : globalThis);
