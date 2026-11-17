// Project Meridian — the Ready Room (docs/ship.md: port, at the bow, opening onto the bridge forward and, through a connecting door aft, into
// the Captain's quarters; no door onto the spine). The office of command, where duty is dealt with: the Captain takes someone in here
// straight after a critical phase on the bridge, still in that mode. Formal, not personal (the Captain's quarters are that): a large command
// desk facing the bridge door, its terminal, the Captain's high-backed chair behind it; two upright chairs at its front corners (being called
// in means standing in front of that desk); a wall display beside the bridge door with the navigation plot and the mission timeline; a low
// cabinet along the hull with a model of the Meridian on it and the commissioning plaque over it; a firm, formal couch along the spine side.
// Lit like the bridge, brighter and cooler; no rug, no lamps, no plants. 3.5 m along the ship by 6 m across.
// Private: the bridge crew stay on the bridge.
//
//   const rr = ReadyRoom.build(scene) → the same shape as Quarters.build
//   spots.bench: across the knee on the couch, square to it (the near arm on its seat); spots.wall: standing, palms flat on the desk's front
//   edge; spots.table: over the desk, hands holding its far edge; spots.after: the couch.
// Its frame: x along the ship (fore −x), z across it (the spine −z, the hull +z).
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3;
const K = root.SuitBay.kit, Q = root.Quarters.kit, rnd = K.rnd, speckle = K.speckle;
const X0 = -1.75, X1 = 1.75, ZS = -3, ZH = 3, HT = 2.5;      // fore (the bridge) and aft (the Captain's quarters), the spine side, the hull, height
// the desk (its front edge at DX0, facing the bridge door; from DZ0 to DZ1), its top; the couch along the spine (from CX0 to CX1, out to CZ)
const DX0 = 0.15, DX1 = 1.0, DZ0 = -0.2, DZ1 = 1.4, DY = 0.76, CX0 = -1.35, CX1 = 0.85, CZ = ZS + 0.8, CY = 0.45;

// ── Painted textures ──
const deckTex = K.canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#4c535a'; c.fillRect(0, 0, w, h);
  speckle(c, w, h, 1800, '#6a727a', 0.2, 1.4); speckle(c, w, h, 1200, '#1e2226', 0.25, 1.4);
  for (let i = 0; i < 30; i++) { c.strokeStyle = 'rgba(255,255,255,0.025)'; c.lineWidth = 8 + rnd() * 20; c.beginPath(); const x = rnd() * w; c.moveTo(x, 0); c.lineTo(x + (rnd() - 0.5) * 40, h); c.stroke(); }
  c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h);
}, [3, 5]);
// (the display: the navigation plot, the course an arc from home toward the target, the ship on it; under it the mission timeline)
const plotTex = K.canvasTex(768, 384, (c, w, h) => {
  c.fillStyle = '#060c10'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(90,216,224,0.08)'; c.lineWidth = 1; for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h * 0.72); c.stroke(); } for (let y = 0; y < h * 0.72; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(200,230,255,${0.2 + rnd() * 0.5})`; c.fillRect(rnd() * w, rnd() * h * 0.7, 1.5, 1.5); }
  c.strokeStyle = '#5ad8e0'; c.lineWidth = 3; c.beginPath(); c.moveTo(70, 220); c.bezierCurveTo(250, 40, 520, 40, 690, 150); c.stroke();
  c.setLineDash([8, 8]); c.strokeStyle = 'rgba(90,216,224,0.4)'; c.beginPath(); c.moveTo(70, 220); c.bezierCurveTo(250, 60, 520, 70, 690, 150); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#5ad8e0'; c.beginPath(); c.arc(70, 220, 6, 0, 7); c.fill(); c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(690, 150, 9, 0, 7); c.fill();
  c.fillStyle = '#e8b04a'; c.beginPath(); c.moveTo(442, 66); c.lineTo(430, 58); c.lineTo(430, 74); c.fill();      // (the ship, on the arc)
  c.font = '600 18px monospace'; c.fillStyle = '#5ad8e0'; c.fillText('NAVIGATION PLOT', 20, 30); c.fillStyle = 'rgba(90,216,224,0.7)'; c.font = '14px monospace';
  c.fillText('SOL', 52, 248); c.fillText('TARGET', 664, 182); c.fillStyle = '#e8b04a'; c.fillText('MERIDIAN  0.4° OFF PLOT', 380, 98);
  // the timeline
  const ty = h * 0.8, x0 = 30, x1 = w - 30, seg = [['BURN', 0.0, 0.14, '#3a7a8a'], ['COAST', 0.14, 0.46, '#2a4a5a'], ['TURNOVER', 0.46, 0.5, '#8a6a2a'], ['COAST', 0.5, 0.82, '#2a4a5a'], ['DECEL', 0.82, 1.0, '#3a7a8a']];
  for (const [n, a, b, col] of seg) { c.fillStyle = col; c.fillRect(x0 + (x1 - x0) * a, ty, (x1 - x0) * (b - a) - 3, 22); c.fillStyle = 'rgba(220,240,255,0.8)'; c.font = '12px monospace'; c.fillText(n, x0 + (x1 - x0) * a + 6, ty + 16); }
  const now = x0 + (x1 - x0) * 0.31; c.fillStyle = '#e8b04a'; c.fillRect(now - 1, ty - 14, 3, 50); c.font = '600 13px monospace'; c.fillText('DAY 1,231', now + 6, ty - 4);
  c.fillStyle = 'rgba(90,216,224,0.06)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});
const commandTex = K.canvasTex(320, 200, (c, w, h) => {
  c.fillStyle = '#0a1214'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a3420'; c.lineWidth = 4; c.strokeRect(4, 4, w - 8, h - 8);
  c.fillStyle = '#e8b04a'; c.font = '600 16px monospace'; c.fillText('COMMAND · CAPTAIN', 16, 30);
  c.fillStyle = 'rgba(90,216,224,0.75)'; c.font = '13px monospace';
  for (const [i, s] of ['SHIP\'S LOG          DAY 1,231', 'STANDING ORDERS      12', 'CREW                 6 ABOARD', '  ASHDOWN · VARGA · LINDQVIST', '  RUEL · HADDAD · OKAFOR', 'CORRECTIONS LOG      —'].entries()) c.fillText(s, 16, 58 + i * 21);
  c.fillStyle = 'rgba(90,216,224,0.07)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});
const plaqueTex = K.canvasTex(256, 176, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#c8a050'); g.addColorStop(1, '#8a6a2a'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(60,40,10,0.7)'; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16);
  c.fillStyle = 'rgba(50,30,8,0.9)'; c.textAlign = 'center'; c.font = '600 22px serif'; c.fillText('MERIDIAN', w / 2, 52);
  c.font = '13px serif'; c.fillText('COMMISSIONED IN ORBIT', w / 2, 84); c.fillText('LONG-RANGE SURVEY', w / 2, 104); c.font = 'italic 12px serif'; c.fillText('"Steady on the line."', w / 2, 140);
});
const leatherTex = K.canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#2a2e34'; c.fillRect(0, 0, w, h); speckle(c, w, h, 900, '#121418', 0.3, 2.2); speckle(c, w, h, 500, '#4a525a', 0.12, 2); }, [2, 2]);

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const detail = [];
  const std = (o) => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.2 }, o)), { grain: 0.05, scale: 8 });
  const box = (w, h, d, m, x, y, z, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; b.castShadow = !(o && o.noCast); b.receiveShadow = true; ((o && o.to) || G).add(b); if (o && o.detail) detail.push(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, rot, seg, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 16), m); c.position.set(x, y, z); if (rot) c.rotation.set(rot[0], rot[1], rot[2]); c.castShadow = true; c.receiveShadow = true; ((o && o.to) || G).add(c); if (o && o.detail) detail.push(c); return c; };
  const plane = (w, h, m, x, y, z, rx, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx || 0, ry || 0, 0); p.receiveShadow = true; G.add(p); return p; };

  // (cool and orderly: pale grey panels over dark steel ones, a dark composite deck, brass only on what's ceremonial)
  const paintM = std({ map: Q.wallTex, color: srgb('#bcc6cc'), roughness: 0.75, metalness: 0.08 });
  const lowM = std({ map: K.panelTex('#4e575e', [1, 1]), roughness: 0.55, metalness: 0.4 });
  const steelDark = std({ map: K.panelTex('#2a3034', [1, 1]), roughness: 0.6, metalness: 0.4 });
  const steel = std({ color: srgb('#9aa0a2'), roughness: 0.45, metalness: 0.6 });
  const brass = std({ color: srgb('#b08a3e'), roughness: 0.35, metalness: 0.75 });
  const deskTop = std({ color: srgb('#2c3236'), roughness: 0.3, metalness: 0.35 }), deskBody = std({ map: K.panelTex('#4a5258', [1, 1]), roughness: 0.5, metalness: 0.4 });
  const leather = std({ map: leatherTex, roughness: 0.5, metalness: 0.05 });
  const ceilM = std({ map: Q.ceilTex, color: srgb('#d8dee4'), roughness: 0.95, metalness: 0 });
  const glowW = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#e8f0ff'), emissiveIntensity: 4 });
  const glowB = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#5ad8e0'), emissiveIntensity: 2 });
  const glowG = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#e8b04a'), emissiveIntensity: 2.2 });
  const plotM = new THREE.MeshBasicMaterial({ map: plotTex });

  // ── The shell ──
  const floor = plane(X1 - X0, ZH - ZS, std({ map: deckTex, roughness: 0.4, metalness: 0.25 }), 0, 0, 0, -Math.PI / 2);
  plane(X1 - X0, ZH - ZS, ceilM, 0, HT, 0, Math.PI / 2);
  const wallRun = (len, x, z, ry) => {
    const n = Math.max(1, Math.round(len / 0.9)), pw = len / n;
    for (let i = 0; i < n; i++) {
      const off = -len / 2 + pw * (i + 0.5), px = x + Math.cos(ry) * off, pz = z - Math.sin(ry) * off;
      plane(pw - 0.01, HT - 0.9, paintM, px, 0.9 + (HT - 0.9) / 2, pz, 0, ry); plane(pw - 0.01, 0.9, lowM, px, 0.45, pz, 0, ry);
    }
  };
  wallRun(X1 - X0, 0, ZS, 0); wallRun(ZH - ZS, X0, 0, Math.PI / 2); wallRun(ZH - ZS, X1, 0, -Math.PI / 2); wallRun(X1 - X0, 0, ZH, Math.PI);
  for (const [len, x, z, ry] of [[X1 - X0, 0, ZS + 0.012, 0], [X1 - X0, 0, ZH - 0.012, 0], [ZH - ZS, X0 + 0.012, 0, Math.PI / 2], [ZH - ZS, X1 - 0.012, 0, Math.PI / 2]]) box(len, 0.03, 0.025, steel, x, 0.9, z, { ry, noCast: true });
  for (const [x, z] of [[X0, ZS], [X1, ZS], [X0, ZH], [X1, ZH]]) box(0.12, HT, 0.12, steelDark, x, HT / 2, z);
  for (const z of [-1.2, 1.2]) box(X1 - X0, 0.1, 0.12, steelDark, 0, HT - 0.05, z);

  // ── The doors: onto the bridge, forward (heavy, its strip the bridge's blue); into the Captain's quarters, aft toward the spine (as on the
  // Captain's side: dark wood, a brass plate, its strip gold) ──
  const BZ_ = 1.0;
  box(0.08, 2.25, 1.15, steelDark, X0 + 0.04, 1.125, BZ_); box(0.04, 2.05, 0.95, std({ map: K.panelTex('#5a646a', [1, 1]), roughness: 0.5, metalness: 0.5 }), X0 + 0.09, 1.03, BZ_);
  box(0.02, 0.02, 0.5, glowB, X0 + 0.1, 2.16, BZ_, { noCast: true }); box(0.03, 0.16, 0.1, steelDark, X0 + 0.06, 1.25, BZ_ - 0.66, { detail: true }); box(0.01, 0.03, 0.06, glowB, X0 + 0.08, 1.29, BZ_ - 0.66, { noCast: true, detail: true });
  const RZ = ZS + 1.43;
  box(0.08, 2.2, 0.95, steelDark, X1 - 0.04, 1.1, RZ); box(0.04, 2.02, 0.78, std({ color: srgb('#9a6a46'), map: K.woodTex, roughness: 0.4, metalness: 0 }), X1 - 0.09, 1.01, RZ);
  box(0.02, 0.02, 0.36, glowG, X1 - 0.1, 2.12, RZ, { noCast: true }); box(0.012, 0.07, 0.3, brass, X1 - 0.115, 1.6, RZ, { detail: true });

  // ── The command desk: a long dark top on a steel body, its front toward the bridge door; the terminal at its spine end (clear of where
  // they hold its far edge, over it), a slate, the log; the Captain's high-backed chair behind it ──
  const dz = (DZ0 + DZ1) / 2, dl = DZ1 - DZ0, dd = DX1 - DX0, dx = (DX0 + DX1) / 2;
  box(dd + 0.04, 0.05, dl + 0.04, deskTop, dx, DY - 0.025, dz);
  box(0.05, DY - 0.05, dl - 0.1, deskBody, DX0 + 0.12, (DY - 0.05) / 2, dz);      // (its front panel, set back a little)
  for (const z of [DZ0 + 0.05, DZ1 - 0.05]) box(dd - 0.1, DY - 0.05, 0.06, deskBody, dx + 0.02, (DY - 0.05) / 2, z);
  box(0.012, 0.012, dl + 0.04, brass, DX0 - 0.018, DY - 0.035, dz, { noCast: true, detail: true });
  box(0.04, 0.32, 0.04, steelDark, DX1 - 0.2, DY + 0.16, DZ0 + 0.3); box(0.03, 0.32, 0.54, steelDark, DX1 - 0.22, DY + 0.42, DZ0 + 0.3);
  plane(0.5, 0.3, new THREE.MeshBasicMaterial({ map: commandTex }), DX1 - 0.238, DY + 0.42, DZ0 + 0.3, 0, -Math.PI / 2);
  box(0.22, 0.012, 0.3, steelDark, DX1 - 0.4, DY + 0.006, dz + 0.3, { detail: true }); box(0.18, 0.004, 0.26, glowB, DX1 - 0.4, DY + 0.014, dz + 0.3, { noCast: true, detail: true });
  box(0.2, 0.03, 0.28, std({ color: srgb('#2a3a5a'), roughness: 0.7 }), dx - 0.05, DY + 0.015, dz + 0.55, { detail: true });
  // (the chair: high-backed, dark leather, on a pedestal)
  const CCX = DX1 + 0.42;
  box(0.52, 0.09, 0.52, leather, CCX, 0.5, dz); box(0.09, 0.85, 0.5, leather, CCX + 0.24, 0.98, dz);
  for (const z of [dz - 0.27, dz + 0.27]) box(0.4, 0.05, 0.06, leather, CCX - 0.02, 0.68, z);
  cyl(0.035, 0.035, 0.42, steel, CCX, 0.23, dz, null, 10); cyl(0.26, 0.28, 0.02, steelDark, CCX, 0.01, dz, null, 20);

  // ── Two upright chairs at the desk's front corners, turned a little toward it, the middle left clear ──
  for (const [z, ry] of [[DZ0 - 0.25, 0.35], [DZ1 + 0.25, -0.35]]) {
    const g = new THREE.Group(); g.position.set(DX0 - 0.55, 0, z); g.rotation.y = ry; G.add(g);
    box(0.44, 0.05, 0.44, leather, 0, 0.46, 0, { to: g }); box(0.44, 0.03, 0.44, steelDark, 0, 0.42, 0, { to: g });
    for (const [ox, oz] of [[-0.19, -0.19], [-0.19, 0.19], [0.19, -0.19], [0.19, 0.19]]) box(0.03, 0.42, 0.03, steel, ox, 0.21, oz, { to: g });
    box(0.04, 0.46, 0.42, steelDark, -0.2, 0.72, 0, { to: g }); box(0.03, 0.3, 0.38, leather, -0.18, 0.76, 0, { to: g });
  }

  // ── The couch along the spine side: firm, dark leather, buttoned, square arms. Its own group, kept: it never hides, with the wall behind it
  // or for standing between the camera and the two on it ──
  const couch = new THREE.Group(); couch.userData.keep = true; G.add(couch);
  const cl = CX1 - CX0, ccx = (CX0 + CX1) / 2, cd = CZ - ZS;
  box(cl, 0.3, cd, leather, ccx, 0.15, ZS + cd / 2, { to: couch });
  box(cl - 0.3, CY - 0.3, cd - 0.22, leather, ccx, (0.3 + CY) / 2, ZS + 0.22 + (cd - 0.22) / 2, { to: couch });
  box(cl, 0.5, 0.2, leather, ccx, CY + 0.25, ZS + 0.1, { to: couch });
  for (const x of [CX0 + 0.075, CX1 - 0.075]) box(0.15, 0.25, cd, leather, x, CY + 0.08, ZS + cd / 2, { to: couch });
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), steelDark); b.position.set(CX0 + 0.3 + i * (cl - 0.6) / 7, CY + 0.12 + j * 0.2, ZS + 0.2); couch.add(b); detail.push(b); }
  for (const x of [CX0 + 0.06, CX1 - 0.06]) for (const z of [ZS + 0.06, CZ - 0.06]) box(0.04, 0.05, 0.04, steel, x, 0.025, z, { to: couch, detail: true });

  // ── The display beside the bridge door: the plot and the timeline ──
  const PZ = -1.3, PW = 1.7, PH = 0.85;
  box(0.05, PH + 0.1, PW + 0.1, steelDark, X0 + 0.025, 1.55, PZ);
  plane(PW, PH, plotM, X0 + 0.052, 1.55, PZ, 0, Math.PI / 2);

  // ── Along the hull: a low cabinet, the model of the Meridian on it, the commissioning plaque over it ──
  box(1.8, 0.72, 0.42, deskBody, 0, 0.36, ZH - 0.21); box(1.84, 0.03, 0.44, deskTop, 0, 0.735, ZH - 0.22);
  for (let i = 1; i < 4; i++) box(0.01, 0.6, 0.01, steelDark, -0.9 + i * 0.45, 0.36, ZH - 0.42, { noCast: true });
  { const m = new THREE.Group(); m.position.set(0, 0.75, ZH - 0.22); G.add(m);
    box(0.24, 0.02, 0.12, brass, 0, 0.01, 0, { to: m }); cyl(0.006, 0.006, 0.12, brass, 0, 0.07, 0, null, 6, { to: m });
    const hull_ = std({ color: srgb('#8a929a'), roughness: 0.5, metalness: 0.5 });
    box(0.06, 0.05, 0.42, hull_, 0, 0.16, 0, { to: m });                                       // (the spine of her, bow to stern)
    box(0.18, 0.012, 0.1, hull_, 0, 0.19, -0.16, { to: m });                                  // (the dorsal shield, forward)
    for (const sx of [-1, 1]) box(0.14, 0.006, 0.12, std({ color: srgb('#c8ccd0'), roughness: 0.4, metalness: 0.6 }), sx * 0.09, 0.135, 0.04, { to: m });      // (the radiator wings)
    cyl(0.03, 0.035, 0.06, hull_, 0, 0.16, 0.22, [Math.PI / 2, 0, 0], 10, { to: m });         // (the reactor and drive, aft)
    m.rotation.y = Math.PI / 2 - 0.4; }
  box(0.5, 0.34, 0.015, std({ map: plaqueTex, roughness: 0.35, metalness: 0.7 }), 0, 1.55, ZH - 0.01);

  // ── The ceiling: two long light panels, cool ──
  for (const z of [-1.6, 1.0]) { box(0.6, 0.03, 1.8, steelDark, 0, HT - 0.015, z); box(0.5, 0.012, 1.7, glowW, 0, HT - 0.034, z, { noCast: true }); }

  // ── Light, as the bridge's: cool and even, brighter than anywhere aft; the display's glow; at night (the ship's night: the room in use is
  // still a working one) a little lower ──
  const hemi = new THREE.HemisphereLight(srgb('#eef3fa'), srgb('#2e3238'), 1.5); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#3a3e44'), 0.8); G.add(amb);
  const key = new THREE.SpotLight(srgb('#eef4ff'), 10, 7, 1.15, 0.8, 2); key.position.set(0.0, HT - 0.06, 0.2); key.target.position.set(-0.2, 0, -0.2);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; key.shadow.camera.near = 0.2; key.shadow.camera.far = 6; G.add(key); G.add(key.target);
  const fill = new THREE.PointLight(srgb('#e8f0ff'), 3.0, 7, 2); fill.position.set(0, HT - 0.3, -1.6); G.add(fill);
  const fill2 = new THREE.PointLight(srgb('#e8f0ff'), 2.4, 7, 2); fill2.position.set(0, HT - 0.3, 1.6); G.add(fill2);
  const plotL = new THREE.PointLight(srgb('#5ad8e0'), 0.6, 2.5, 2); plotL.position.set(X0 + 0.6, 1.5, PZ); G.add(plotL);

  // ── Where things happen ──
  const spots = {
    // (across the knee on the couch, square to it, near its fore end: they lie along it in front, the head aft, the near arm on its seat)
    bench: { at: new V3(ccx - 0.35, 0, CZ - 0.16), yaw: 0, turn: 0, seatY: CY, rest: { y: CY, edge: 0.16 } },
    // (standing at the desk's front, palms flat on its edge, bent well forward, between the two chairs; the Captain at their left)
    wall: { at: new V3(DX0 - 0.85, 0, dz), yaw: Math.PI / 2, support: { kind: 'edge', y: DY + 0.01, d: 0.85, bend: 0.95, lines: 'desk' } },
    // (over the desk: chest down on it, hands holding its far edge)
    table: { at: new V3(DX0 - 0.55, 0, dz), yaw: Math.PI / 2, top: DY, d: 0.55, w: dl, len: dd, grip: 'far' },
    // (the aftercare: side by side on the couch; it stays here)
    after: { at: new V3(ccx - 0.35, 0, ZS + 0.52), yaw: 0, seatY: CY, beside: new V3(ccx + 0.27, 0, ZS + 0.52) },
    watch: [],
    corner: { at: new V3(X0 + 0.4, 0, 2.4), yaw: Math.PI / 2 },
  };

  const meshes = []; G.traverse(o => { if (o.isMesh) meshes.push(o); });
  const cast0 = new Map(meshes.map(m => [m, m.castShadow]));
  let low = false, time = 'day';
  function apply() {
    const day = time === 'day';
    for (const m of meshes) m.castShadow = low ? false : cast0.get(m);
    for (const d of detail) d.visible = !low;
    plotL.visible = !low;
    key.intensity = day ? 10 : 7.5; glowW.emissiveIntensity = day ? 4 : 3.2; fill.intensity = day ? 3.0 : 2.1; fill2.intensity = day ? 2.4 : 1.7;
    hemi.intensity = (day ? 1.5 : 1.15) + (low ? 0.3 : 0); amb.intensity = day ? 0.8 : 0.65;
    const sz = low ? 1024 : 2048;
    if (key.shadow.mapSize.x !== sz) { key.shadow.mapSize.set(sz, sz); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  }
  const setLow = on => { low = !!on; apply(); }, setTime = t => { time = t === 'night' ? 'night' : 'day'; apply(); };
  apply();
  const { sideOf, sidesAt } = K.roomSides(G, { minX: X0, maxX: X1, minZ: ZS, maxZ: ZH, ht: HT }, [floor, couch]);
  // (over the desk, their face from behind it, beside the Captain's chair on the hull side, clear of the terminal)
  // (standing at the desk, their face from behind it too, low over its top, looking up under their head)
  const cams = { wall: [['Side', [-1.9, 1.4, -0.05], [0.1, 1.0, 0.1]], ['Behind', [-0.35, 1.2, -1.25], [0, 0.85, 0.15]], ['Seat', [-0.55, 1.25, -0.75], [0, 0.88, 0]],
    ['Their face', [-0.5, 0.92, 1.9], [0.0, 1.02, 0.5]], ['Captain', [-0.4, 1.42, -0.25], [0.43, 1.5, -0.07]], ['Room', [1.05, 1.9, -2.95], [-0.15, 0.8, -0.15]]], table: [['Side', [-1.8, 1.35, 0.35], [0, 0.85, 0.3]], ['Behind', [-0.3, 1.3, -1.4], [0, 0.85, 0.2]], ['Seat', [-0.45, 1.35, -0.7], [0, 0.9, 0.05]],
    ['Their face', [-0.75, 1.1, 1.75], [0, 0.9, 0.7]], ['Captain', [-0.6, 1.45, 0.2], [0.5, 1.5, 0]], ['Room', [1.6, 1.9, -2.2], [0, 0.8, 0.3]]] };
  return { group: G, spots, key, cams, setLow, setTime, get time() { return time; }, sideOf, sidesAt, name: 'Ready Room', private: true,
    bounds: { minX: X0 + 0.15, maxX: X1 - 0.15, minZ: ZS + 0.15, maxZ: ZH - 0.15 }, get low() { return low; }, tick() {} };
}

root.ReadyRoom = { build };
})(typeof window !== 'undefined' ? window : globalThis);
