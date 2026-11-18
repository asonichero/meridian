// Project Meridian — the bridge (docs/ship.md: at the bow, the width of the hull; about two-thirds modern control room, one-third starship).
// A single viewscreen across the front, the forward view, the stars crowded ahead into a ring of shifted colour; Helm in the middle of a U
// (Ashdown, with manual thruster controls), Sensors (Lindqvist) and Survey (Varga, for an anomaly) either side; the Captain standing at the
// plot table behind them (a fold-down harnessed seat on its pedestal, for burns); directly over the plot table, the armoured viewport, a well up
// through the shield looking straight along the course, the ship's one real window, shuttered when not needed; repeater panels for the
// in-situ stations along the back (reactor, life support, med bay, suit bay) with jump seats under them; the spine door aft in the middle, the
// Ready Room's door aft to port.
// Corrections: none at stations. Late in the story, minor ones in situ at the plot table: hands on its aft edge, in front of the bridge crew,
// who stay at their posts (docs/ship.md).
//
//   const br = Bridge.build(scene) → the same shape as Quarters.build, and setViewport(open), viewport (whether it's open)
//   spots.wall: standing at the plot table's aft edge, palms flat on it; spots.watch: the stations' seats (each for its own officer, turning
//   to it) and the jump seats; spots.stations: where each sits and what they hold, and the Captain's place, for the stations scene
//   (js/stations.js); spots.cams: its cameras. No across the knee (spots.bench is only a jump seat, for the session's sake) and no aftercare
//   here: it's taken elsewhere.
// Its frame: x across the ship (starboard −x, port +x), z along it (fore −z, aft +z).
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3;
const K = root.SuitBay.kit, Q = root.Quarters.kit, rnd = K.rnd, speckle = K.speckle;
const X0 = -5.8, X1 = 5.8, ZF = -3.9, ZA = 3.9, HT = 2.7, CH = 1.3;      // starboard, port, the screen wall (fore), the aft wall, height; the bow's corners cut back by CH
// the plot table (its middle, across, along, its top); the viewport's well over it; the stations' seats; the doors aft; the repeaters and jump seats
const PZ = 1.0, PW = 1.6, PD = 1.1, PY = 0.95, VR = 0.9, VH = 1.2;
const HELM = new V3(0, 0, ZF + 2.15), SENS = new V3(-2.55, 0, ZF + 2.5), SURV = new V3(2.55, 0, ZF + 2.5), SIDE_YAW = 0.45, SEAT_Y = 0.48;
const DOOR_X = 0, RR_X = 4.55, REP_X = [-4.6, -3.1, 1.75, 3.05];

// ── Painted textures ──
// (the deck: carpet tiles, slate blue, laid alternately)
const deckTex = K.canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#3a4250'; c.fillRect(0, 0, w, h);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { const x0 = tx * 128, y0 = ty * 128, across = (tx + ty) % 2;
    for (let i = 0; i < 128; i += 3) { c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '200,220,255'},${0.03 + rnd() * 0.035})`; if (across) c.fillRect(x0, y0 + i, 128, 1.5); else c.fillRect(x0 + i, y0, 1.5, 128); } }
  speckle(c, w, h, 900, '#1a1e26', 0.25, 1.3); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, w, 1.5); c.fillRect(0, 0, 1.5, h); c.fillRect(0, 127, w, 1.5); c.fillRect(127, 0, 1.5, h);
}, [X1 - X0, ZA - ZF].map(v => v / 1.0));
// (the ceiling: square acoustic tiles in a dark grid)
const tileTex = K.canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#c4ccd4'; c.fillRect(0, 0, w, h); speckle(c, w, h, 700, '#8a949e', 0.25, 1.1); c.fillStyle = '#4a525a'; c.fillRect(0, 0, w, 3); c.fillRect(0, 0, 3, h); });
const tiled = (len, wid) => { const t = tileTex.clone(); t.needsUpdate = true; t.repeat.set(len / 0.6, wid / 0.6); return t; };
// (the front: dark acoustic fabric round the screen, so nothing but the view is bright there)
const fabricTex = K.canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#20252c'; c.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 3) { c.fillStyle = 'rgba(255,255,255,0.025)'; c.fillRect(i, 0, 1, h); c.fillRect(0, i, w, 1); } speckle(c, w, h, 400, '#0c0e12', 0.3, 1.2); }, [6, 2]);

// The starbow: at their speed the sky crowds ahead into a ring, blue inside, white at its brightest, reddening outside it; dark in the
// middle, the course marked there. sky: the bare view (the viewport's), without the screen's overlays.
function starbow(c, w, h, cx, cy, R, sky) {
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7); g.addColorStop(0, '#02030a'); g.addColorStop(0.5, '#050814'); g.addColorStop(1, '#020306');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const glow = c.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.5); glow.addColorStop(0, 'rgba(60,80,200,0)'); glow.addColorStop(0.42, 'rgba(120,140,255,0.10)'); glow.addColorStop(0.55, 'rgba(255,240,230,0.12)'); glow.addColorStop(0.75, 'rgba(255,120,60,0.06)'); glow.addColorStop(1, 'rgba(120,20,10,0)');
  c.fillStyle = glow; c.beginPath(); c.arc(cx, cy, R * 1.5, 0, 7); c.fill();
  const col = d => d < -0.15 ? [140, 150, 255] : d < -0.04 ? [190, 200, 255] : d < 0.05 ? [255, 250, 245] : d < 0.16 ? [255, 200, 150] : [255, 120, 80];
  for (let i = 0; i < 4200; i++) {
    const u = (rnd() + rnd() + rnd() - 1.5) / 1.5, d = u * 0.35, r = R * (1 + d), a = rnd() * Math.PI * 2, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const [cr, cg, cb] = col(d), b = Math.max(0.15, 1 - Math.abs(d) * 2.6) * (0.4 + 0.6 * rnd());
    c.fillStyle = `rgba(${cr},${cg},${cb},${b})`; const s = rnd() < 0.04 ? 2.4 : rnd() < 0.3 ? 1.6 : 1.1; c.fillRect(x - s / 2, y - s / 2, s, s);
  }
  for (let i = 0; i < 260; i++) { const x = rnd() * w, y = rnd() * h, d = Math.hypot(x - cx, y - cy) / R; if (d > 0.55 && d < 1.8) continue; c.fillStyle = `rgba(${d < 1 ? '150,160,255' : '255,140,110'},${0.15 + rnd() * 0.3})`; c.fillRect(x, y, 1, 1); }
  if (sky) return;
  c.strokeStyle = 'rgba(90,216,224,0.55)'; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, 16, 0, 7); c.stroke();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { c.beginPath(); c.moveTo(cx + dx * 22, cy + dy * 22); c.lineTo(cx + dx * 36, cy + dy * 36); c.stroke(); }
  c.strokeStyle = 'rgba(90,216,224,0.18)'; c.setLineDash([4, 6]); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke(); c.setLineDash([]);
}
const screenTex = K.canvasTex(1536, 384, (c, w, h) => {
  starbow(c, w, h, w / 2, h / 2, h * 0.36);
  c.fillStyle = 'rgba(90,216,224,0.75)'; c.font = '600 15px monospace'; c.fillText('FORWARD  ·  BOW ARRAY', 24, 30); c.textAlign = 'right'; c.fillText('COURSE ON PLOT', w - 24, 30); c.textAlign = 'left';
  // (a heading tape along the bottom)
  c.strokeStyle = 'rgba(90,216,224,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(w * 0.3, h - 34); c.lineTo(w * 0.7, h - 34); c.stroke();
  for (let i = -10; i <= 10; i++) { const x = w / 2 + i * w * 0.02; c.beginPath(); c.moveTo(x, h - 34); c.lineTo(x, h - (i % 5 ? 40 : 46)); c.stroke(); }
  c.fillStyle = 'rgba(90,216,224,0.6)'; c.font = '12px monospace'; c.textAlign = 'center'; c.fillText('000', w / 2, h - 16); c.textAlign = 'left';
});
const skyTex = K.canvasTex(512, 512, (c, w, h) => starbow(c, w, h, w / 2, h / 2, w * 0.3, true));
// (the plot table's top: range rings round the ship, the course on to the target, the shear's edge astern, the next burn)
const plotTex = K.canvasTex(640, 440, (c, w, h) => {
  c.fillStyle = '#04090c'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(90,216,224,0.07)'; c.lineWidth = 1; for (let x = 0; x < w; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  const sx = w * 0.42, sy = h * 0.58;
  for (let r = 50; r < 400; r += 60) { c.strokeStyle = `rgba(90,216,224,${0.25 - r / 2400})`; c.beginPath(); c.arc(sx, sy, r, 0, 7); c.stroke(); }
  c.strokeStyle = '#5ad8e0'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(sx, sy); c.bezierCurveTo(sx + 90, sy - 70, sx + 170, sy - 150, w - 40, 40); c.stroke();
  c.setLineDash([6, 6]); c.strokeStyle = 'rgba(232,176,74,0.6)'; c.beginPath(); c.moveTo(40, h - 30); c.quadraticCurveTo(sx - 120, sy + 40, sx, sy); c.stroke(); c.setLineDash([]);
  c.strokeStyle = 'rgba(220,80,70,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(sx - 190, sy + 120, 120, -1.2, 0.4); c.stroke();
  c.fillStyle = 'rgba(220,80,70,0.7)'; c.font = '12px monospace'; c.fillText('SHEAR · EDGE', sx - 150, sy + 30);
  c.fillStyle = '#e8b04a'; c.beginPath(); c.moveTo(sx + 10, sy - 6); c.lineTo(sx - 8, sy - 12); c.lineTo(sx - 4, sy + 8); c.fill();
  c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(w - 40, 40, 7, 0, 7); c.fill();
  c.fillStyle = 'rgba(90,216,224,0.8)'; c.font = '600 14px monospace'; c.fillText('PLOT  ·  COURSE', 16, 24); c.font = '12px monospace'; c.fillText('TARGET', w - 96, 66);
  c.fillStyle = 'rgba(232,176,74,0.85)'; c.fillText('NEXT BURN  T−41:12', 16, h - 14); c.fillStyle = 'rgba(90,216,224,0.06)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});
// (a station's screens: each its own; and the repeaters' faces, each in-situ station's state and who's there)
const panel = (title, rows, accent) => K.canvasTex(320, 200, (c, w, h) => {
  c.fillStyle = '#071014'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(90,216,224,0.25)'; c.lineWidth = 3; c.strokeRect(3, 3, w - 6, h - 6);
  c.fillStyle = accent || '#5ad8e0'; c.font = '600 16px monospace'; c.fillText(title, 14, 28);
  c.font = '13px monospace'; rows.forEach((s, i) => { c.fillStyle = s.startsWith('!') ? '#e8b04a' : 'rgba(90,216,224,0.7)'; c.fillText(s.replace(/^!/, ''), 14, 54 + i * 21); });
  c.fillStyle = 'rgba(90,216,224,0.06)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});
const graph = (title, kind) => K.canvasTex(320, 200, (c, w, h) => {
  c.fillStyle = '#071014'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(90,216,224,0.25)'; c.lineWidth = 3; c.strokeRect(3, 3, w - 6, h - 6);
  c.fillStyle = '#5ad8e0'; c.font = '600 14px monospace'; c.fillText(title, 14, 24);
  if (kind === 'sweep') { const cx = w / 2, cy = h / 2 + 12, r = 70; for (let k = 1; k <= 3; k++) { c.strokeStyle = 'rgba(90,216,224,0.25)'; c.beginPath(); c.arc(cx, cy, r * k / 3, 0, 7); c.stroke(); }
    const g = c.createLinearGradient(cx, cy, cx + r, cy - r); g.addColorStop(0, 'rgba(90,216,224,0.5)'); g.addColorStop(1, 'rgba(90,216,224,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, -1.1, -0.5); c.fill();
    for (let i = 0; i < 9; i++) { c.fillStyle = i === 3 ? '#e8b04a' : 'rgba(200,240,255,0.7)'; c.fillRect(cx + (rnd() - 0.5) * 120, cy + (rnd() - 0.5) * 120, 3, 3); } }
  else if (kind === 'spectrum') { c.strokeStyle = '#5ad8e0'; c.lineWidth = 1.5; c.beginPath(); for (let x = 14; x < w - 14; x++) { const t = (x - 14) / (w - 28), y = h - 30 - 90 * Math.exp(-((t - 0.32) ** 2) / 0.004) - 50 * Math.exp(-((t - 0.71) ** 2) / 0.01) - 10 * rnd(); x === 14 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); c.fillStyle = 'rgba(232,176,74,0.8)'; c.font = '12px monospace'; c.fillText('ANOMALY  —  NONE', 14, h - 12); }
  else if (kind === 'attitude') { const cx = w / 2, cy = h / 2 + 10; c.strokeStyle = 'rgba(90,216,224,0.6)'; c.beginPath(); c.moveTo(20, cy + 6); c.lineTo(w - 20, cy - 6); c.stroke(); c.beginPath(); c.arc(cx, cy, 34, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(cx - 22, cy); c.lineTo(cx - 8, cy); c.lineTo(cx, cy + 8); c.lineTo(cx + 8, cy); c.lineTo(cx + 22, cy); c.stroke(); c.fillStyle = 'rgba(90,216,224,0.7)'; c.font = '12px monospace'; c.fillText('ATTITUDE HOLD', 14, h - 14); c.fillText('RCS  OK', w - 74, h - 14); }
  else { c.strokeStyle = 'rgba(90,216,224,0.6)'; for (let k = 0; k < 4; k++) { c.beginPath(); for (let x = 14; x < w - 14; x += 4) { const y = 60 + k * 32 + 8 * Math.sin(x * 0.05 + k * 1.7) * rnd(); x === 14 ? c.moveTo(x, y) : c.lineTo(x, y); } c.stroke(); } }
  c.fillStyle = 'rgba(90,216,224,0.06)'; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
});
const REPEATERS = [['REACTOR', ['CORE  STABLE', 'COOLANT  NOMINAL', 'DRIVE  STANDBY', '!STATION  OKAFOR']], ['LIFE SUPPORT', ['O2  20.9%', 'CO2  0.3%', 'SCRUBBERS  2/2', '!STATION  HADDAD']],
  ['MED BAY', ['BAY  READY', 'CREW VITALS  6/6', 'DOSIMETRY  LOW', '!STATION  RUEL']], ['SUIT BAY', ['SUITS  6', 'AIRLOCK  SEALED', 'EVA  NONE', 'COLLAR  SECURE']]];
const repTex = REPEATERS.map(([t, rows]) => panel(t, rows));
const sysTex = panel('SHIP  ·  SYSTEMS', ['HULL  INTEGRITY 100%', 'SHIELD  WATER 96%', 'RADIATORS  DEPLOYED', 'POWER  71%', 'ARRAY  LOST (SHEAR)', '!PROCTOR  ON WATCH']);
// (before the shear (the ordinary day, docs/day.md): the long-range array still up, the link home live, the watch kept by the crew)
const sysTexBefore = panel('SHIP  ·  SYSTEMS', ['HULL  INTEGRITY 100%', 'SHIELD  WATER 97%', 'RADIATORS  DEPLOYED', 'POWER  62%', 'ARRAY  LINKED  ·  EARTH', '!WATCH  CREW']);

// opts.before: the bridge as it was before the shear
function build(scene, opts) {
  const before = !!(opts && opts.before);
  const G = new THREE.Group(); scene.add(G);
  const detail = [];
  const std = (o) => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.2 }, o)), { grain: 0.05, scale: 8 });
  const box = (w, h, d, m, x, y, z, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; if (o && o.rx) b.rotation.x = o.rx; b.castShadow = !(o && o.noCast); b.receiveShadow = true; ((o && o.to) || G).add(b); if (o && o.detail) detail.push(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, rot, seg, o) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 16, 1, !!(o && o.open)), m); c.position.set(x, y, z); if (rot) c.rotation.set(rot[0], rot[1], rot[2]); c.castShadow = !(o && o.noCast); c.receiveShadow = true; ((o && o.to) || G).add(c); if (o && o.detail) detail.push(c); return c; };
  const plane = (w, h, m, x, y, z, rx, ry, o) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx || 0, ry || 0, 0); p.receiveShadow = true; ((o && o.to) || G).add(p); return p; };
  const piece = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; G.add(g); return g; };

  // (cool and technical: pale grey panels over dark ones, graphite consoles, the deck slate blue; the bridge's blue in its strips and screens,
  // gold only for command)
  const paintM = std({ map: Q.wallTex, color: srgb('#aab4bc'), roughness: 0.75, metalness: 0.08 });
  const lowM = std({ map: K.panelTex('#3e464e', [1, 1]), roughness: 0.55, metalness: 0.4 });
  const steelDark = std({ map: K.panelTex('#2a3034', [1, 1]), roughness: 0.6, metalness: 0.4 });
  const steel = std({ color: srgb('#9aa0a2'), roughness: 0.45, metalness: 0.6 });
  const graphite = std({ color: srgb('#2a2f35'), roughness: 0.45, metalness: 0.3 }), consoleTop = std({ color: srgb('#1c2024'), roughness: 0.3, metalness: 0.4 });
  const seatM = std({ map: Q.weave('#2e3a48', 'rgba(255,255,255,0.04)'), roughness: 0.9, metalness: 0 }), strapM = std({ color: srgb('#4a4a42'), roughness: 0.8, metalness: 0 });
  const armour = std({ map: K.panelTex('#5a6066', [1, 1]), roughness: 0.5, metalness: 0.65 });
  const glowW = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#dfe8ff'), emissiveIntensity: 3 });
  const glowB = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#5ad8e0'), emissiveIntensity: 2 });
  const glowG = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#e8b04a'), emissiveIntensity: 2.2 });
  const basic = t => new THREE.MeshBasicMaterial({ map: t });

  // ── The shell: the deck, the ceiling (tiles round the viewport's well), the walls (pale panels over a dark band; the front dark fabric), the
  // bow's corners cut back ──
  const floor = plane(X1 - X0, ZA - ZF, std({ map: deckTex, roughness: 0.95, metalness: 0 }), 0, 0, 0, -Math.PI / 2);
  { const hx = 1.0, z0 = PZ - hx, z1 = PZ + hx, ceil = (x0, x1, za, zb) => plane(x1 - x0, zb - za, std({ map: tiled(x1 - x0, zb - za), roughness: 0.95, metalness: 0 }), (x0 + x1) / 2, HT, (za + zb) / 2, Math.PI / 2);
    ceil(X0, X1, ZF, z0); ceil(X0, X1, z1, ZA); ceil(X0, -hx, z0, z1); ceil(hx, X1, z0, z1); }
  const wallRun = (len, x, z, ry, m) => {
    const n = Math.max(1, Math.round(len / 0.9)), pw = len / n;
    for (let i = 0; i < n; i++) {
      const off = -len / 2 + pw * (i + 0.5), px = x + Math.cos(ry) * off, pz = z - Math.sin(ry) * off;
      plane(pw - 0.01, HT - 0.9, m || paintM, px, 0.9 + (HT - 0.9) / 2, pz, 0, ry); plane(pw - 0.01, 0.9, lowM, px, 0.45, pz, 0, ry);
    }
  };
  const fabric = std({ map: fabricTex, roughness: 0.95, metalness: 0 });
  wallRun(X1 - X0 - 2 * CH, 0, ZF, 0, fabric);
  wallRun(ZA - ZF - CH, X0, (ZF + CH + ZA) / 2, Math.PI / 2); wallRun(ZA - ZF - CH, X1, (ZF + CH + ZA) / 2, -Math.PI / 2); wallRun(X1 - X0, 0, ZA, Math.PI);
  // (the bow's corners: a panel set across each, a long display on it)
  for (const sx of [-1, 1]) {
    const cx = sx * (X1 - CH / 2), cz = ZF + CH / 2, len = Math.hypot(CH, CH), ry = -sx * Math.PI / 4;      // (facing in, across the corner)
    wallRun(len, cx, cz, ry, fabric);
    const d = 0.03, nx = -sx * Math.sin(Math.PI / 4), nz = Math.cos(Math.PI / 4);
    box(1.4, 0.75, 0.04, steelDark, cx + nx * d, 1.55, cz + nz * d, { ry });
    plane(1.3, 0.66, basic(sx < 0 ? (before ? sysTexBefore : sysTex) : graph('COMMS  ·  LINK', 'trace')), cx + nx * (d + 0.022), 1.55, cz + nz * (d + 0.022), 0, ry);
  }
  for (const [len, x, z, ry] of [[X1 - X0, 0, ZA - 0.012, 0], [ZA - ZF - CH, X0 + 0.012, (ZF + CH + ZA) / 2, Math.PI / 2], [ZA - ZF - CH, X1 - 0.012, (ZF + CH + ZA) / 2, Math.PI / 2]]) box(len, 0.03, 0.025, steel, x, 0.9, z, { ry, noCast: true });
  for (const [x, z] of [[X0, ZA], [X1, ZA], [X0, ZF + CH], [X1, ZF + CH], [X0 + CH, ZF], [X1 - CH, ZF]]) box(0.14, HT, 0.14, steelDark, x, HT / 2, z);
  for (const z of [-1.6, PZ - 1.15, PZ + 1.15, 3.2]) box(X1 - X0, 0.12, 0.14, steelDark, 0, HT - 0.06, z);      // (the beams across, clear of the well)

  // ── The viewscreen across the front: one long panel, its bezel, a strip of the bridge's blue under it ──
  const SW = 7.0, SH = 1.75, SY = 0.68 + SH / 2;
  box(SW + 0.16, SH + 0.16, 0.08, steelDark, 0, SY, ZF + 0.04);
  const screenM = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }), screen = plane(SW, SH, screenM, 0, SY, ZF + 0.082);
  box(SW, 0.02, 0.03, glowB, 0, 0.6, ZF + 0.06, { noCast: true });

  // ── The stations: Helm in the middle, square to the screen; Sensors to starboard and Survey to port, turned in toward it. Each a console
  // (a dark top, clear under it for the knees, its screens raised behind) and a harnessed seat on a pedestal that swivels. Helm has its
  // manual thruster controls, a grip either side of the seat. ──
  const station = (at, yaw, screens, helm) => {
    const g = piece(at.x, at.z, yaw);
    // (the console: its top, a back panel and end panels down to the deck, its screens on a raised spine)
    box(1.36, 0.04, 0.56, consoleTop, 0, 0.74, 0.74, { to: g }); box(1.36, 0.72, 0.05, graphite, 0, 0.36, 1.0, { to: g });
    for (const x of [-0.66, 0.66]) box(0.04, 0.72, 0.54, graphite, x, 0.36, 0.74, { to: g });
    box(1.3, 0.008, 0.04, glowB, 0, 0.742, 0.47, { to: g, noCast: true });
    box(1.36, 0.36, 0.06, graphite, 0, 0.94, 1.0, { to: g, rx: 0.25 });
    screens.forEach((t, i) => { const x = (i - (screens.length - 1) / 2) * 0.44; box(0.42, 0.28, 0.03, steelDark, x, 1.04, 0.97, { to: g, rx: 0.25 }); const p = plane(0.38, 0.24, basic(t), x, 1.04, 0.95, 0, 0, { to: g }); p.rotation.set(0.25, Math.PI, 0); });      // (each facing the seat, leaning back)
    box(0.5, 0.012, 0.18, steelDark, 0, 0.765, 0.62, { to: g, detail: true });      // (a keyboard)
    // (the seat: a pedestal, and on it, swivelling, the pan, a high back with a headrest, the harness over it)
    cyl(0.05, 0.05, 0.36, steel, 0, 0.2, 0, null, 10, { to: g }); cyl(0.26, 0.3, 0.03, steelDark, 0, 0.015, 0, null, 20, { to: g });
    const chair = new THREE.Group(); g.add(chair);
    box(0.5, 0.08, 0.48, seatM, 0, SEAT_Y - 0.04, 0, { to: chair }); box(0.5, 0.72, 0.09, seatM, 0, SEAT_Y + 0.36, -0.26, { to: chair, rx: 0.12 }); box(0.3, 0.16, 0.08, seatM, 0, SEAT_Y + 0.82, -0.32, { to: chair, rx: 0.12 });
    for (const x of [-0.13, 0.13]) box(0.05, 0.6, 0.012, strapM, x, SEAT_Y + 0.38, -0.205, { to: chair, rx: 0.12, noCast: true, detail: true });
    if (helm) for (const x of [-0.36, 0.36]) { cyl(0.025, 0.035, 0.6, steel, x, 0.3, 0.16, null, 8, { to: g }); cyl(0.03, 0.03, 0.12, graphite, x, 0.66, 0.16, [0.25, 0, 0], 10, { to: g }); box(0.012, 0.012, 0.02, glowG, x, 0.73, 0.18, { to: g, noCast: true, detail: true }); }
    return chair;
  };
  const chairs = {};
  chairs.helm = station(HELM, Math.PI, [graph('ATTITUDE', 'attitude'), graph('HELM  ·  THRUST', 'trace'), panel('NAV', ['HEADING  000.0', 'COURSE  ON PLOT', 'DEVIATION  0.4°', '!BURN  T−41:12'])], true);
  chairs.sensors = station(SENS, Math.PI - SIDE_YAW, [graph('SENSORS  ·  SWEEP', 'sweep'), panel('CONTACTS', ['DUST  LIGHT', 'RADIATION  NOMINAL', 'CONTACTS  0', 'COMMS  RELAY  IDLE'])]);
  chairs.survey = station(SURV, Math.PI + SIDE_YAW, [graph('SURVEY  ·  SPECTRUM', 'spectrum'), panel('SURVEY', [before ? 'ARRAY  LINKED' : 'ARRAY  LOST', 'OPTICAL  ONLINE', 'TARGETS  QUEUED 3', 'LOG  DAY 1,231'])]);

  // ── The plot table: a pedestal, a broad top that's all display, a blue edge; the Captain's place at its aft edge. Its fold-down seat, for
  // burns, folded up flat against the pedestal's aft face under the top. Its own piece: it never hides while someone's at it. ──
  const plot = piece(0, PZ);
  box(0.9, PY - 0.06, 0.6, graphite, 0, (PY - 0.06) / 2, 0, { to: plot });
  box(PW, 0.06, PD, consoleTop, 0, PY - 0.03, 0, { to: plot });
  const plotTop = plane(PW - 0.12, PD - 0.12, new THREE.MeshBasicMaterial({ map: plotTex, toneMapped: false }), 0, PY + 0.002, 0, -Math.PI / 2, 0, { to: plot });
  for (const [w, d, x, z] of [[PW, 0.015, 0, PD / 2], [PW, 0.015, 0, -PD / 2], [0.015, PD, PW / 2, 0], [0.015, PD, -PW / 2, 0]]) box(w, 0.012, d, glowB, x, PY - 0.035, z, { to: plot, noCast: true });
  box(0.42, 0.44, 0.04, seatM, 0, 0.42, 0.32, { to: plot }); for (const x of [-0.12, 0.12]) box(0.04, 0.4, 0.012, strapM, x, 0.44, 0.345, { to: plot, noCast: true, detail: true });
  box(0.5, 0.02, 0.06, steel, 0, 0.2, 0.33, { to: plot });

  // ── The armoured viewport over the plot table: a well up through the shield, its coaming in the ceiling, the shutter's two armoured leaves
  // across it near the top (they slide apart into the shield when it opens), and above them the sky straight along the course ──
  const well = new THREE.Group(); well.position.set(0, HT, PZ); G.add(well);
  cyl(VR, VR, VH, std({ map: K.panelTex('#3a4046', [4, 1]), roughness: 0.6, metalness: 0.5, side: THREE.BackSide }), 0, VH / 2, 0, null, 36, { to: well, open: true, noCast: true });
  { const ring = new THREE.Mesh(new THREE.RingGeometry(VR, 1.42, 40), armour); ring.rotation.x = Math.PI / 2; ring.position.y = -0.005; well.add(ring);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(VR + 0.02, 0.04, 8, 40), steel); lip.rotation.x = Math.PI / 2; lip.position.y = -0.03; well.add(lip);
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(VR + 0.09, 0.012, 6, 48), glowB); glowRing.rotation.x = Math.PI / 2; glowRing.position.y = -0.03; well.add(glowRing); }
  const sky = new THREE.Mesh(new THREE.CircleGeometry(VR, 40), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false })); sky.rotation.x = Math.PI / 2; sky.position.y = VH - 0.02; well.add(sky);
  const leaves = [-1, 1].map(sx => { const l = box(VR * 2 + 0.1, 0.07, VR * 2 + 0.1, armour, sx * (VR + 0.05), VH - 0.2, 0, { to: well, noCast: true }); l.scale.x = 0.5; l.userData.sx = sx; return l; });
  for (const l of leaves) l.position.x = l.userData.sx * (VR + 0.05) * 0.5;
  const skyL = new THREE.PointLight(srgb('#b8c4ff'), 0, 4.5, 2); skyL.position.set(0, HT + 0.4, PZ); G.add(skyL);

  // ── Along the back: the spine door in the middle (heavy, its strip the bridge's blue), the Ready Room's door to port (its plate gold);
  // the repeater panels for the in-situ stations, each with a jump seat folded down under it (a pan on a bracket, a harness on the wall) ──
  box(1.5, 2.35, 0.1, steelDark, DOOR_X, 1.175, ZA - 0.05); box(1.25, 2.15, 0.05, std({ map: K.panelTex('#5a646a', [1, 1]), roughness: 0.5, metalness: 0.5 }), DOOR_X, 1.075, ZA - 0.11);
  box(0.6, 0.02, 0.02, glowB, DOOR_X, 2.26, ZA - 0.12, { noCast: true }); box(0.012, 2.0, 0.02, steelDark, DOOR_X, 1.05, ZA - 0.14, { noCast: true });
  box(1.1, 2.25, 0.08, steelDark, RR_X, 1.125, ZA - 0.04); box(0.9, 2.05, 0.04, std({ map: K.panelTex('#5a646a', [1, 1]), roughness: 0.5, metalness: 0.5 }), RR_X, 1.03, ZA - 0.09);
  box(0.45, 0.02, 0.02, glowB, RR_X, 2.16, ZA - 0.1, { noCast: true }); box(0.3, 0.07, 0.012, glowG, RR_X, 1.62, ZA - 0.11, { noCast: true, detail: true });
  const jumps = REP_X.map((x, i) => {
    box(0.98, 0.62, 0.04, steelDark, x, 1.72, ZA - 0.02); plane(0.9, 0.55, basic(repTex[i]), x, 1.72, ZA - 0.042, 0, Math.PI);
    const g = piece(x, ZA, 0);
    box(0.46, 0.06, 0.4, seatM, 0, SEAT_Y - 0.03, -0.24, { to: g }); box(0.46, 0.04, 0.04, steel, 0, SEAT_Y - 0.08, -0.05, { to: g });
    for (const sx of [-1, 1]) box(0.03, 0.03, 0.4, steel, sx * 0.21, SEAT_Y - 0.1, -0.22, { to: g, rx: 0.35 });
    box(0.46, 0.6, 0.04, seatM, 0, SEAT_Y + 0.34, -0.04, { to: g }); for (const sx of [-1, 1]) box(0.05, 0.5, 0.012, strapM, sx * 0.12, SEAT_Y + 0.36, -0.065, { to: g, noCast: true, detail: true });
    return new V3(x, 0, ZA - 0.27);
  });

  // ── Down the sides: to starboard the comms rack and a status display; to port, the emergency lockers (masks, suppression) ──
  for (let i = 0; i < 3; i++) { const z = -0.6 + i * 0.7; box(0.5, 1.9, 0.62, graphite, X0 + 0.25, 0.95, z); for (let k = 0; k < 6; k++) box(0.01, 0.06, 0.5, k % 2 ? glowB : steelDark, X0 + 0.505, 0.5 + k * 0.22, z, { noCast: true, detail: true }); }
  box(0.04, 0.8, 1.5, steelDark, X0 + 0.02, 1.7, 2.3); plane(1.4, 0.72, basic(graph('PROCTOR  ·  WATCH', 'trace')), X0 + 0.042, 1.7, 2.3, 0, Math.PI / 2);
  for (let i = 0; i < 3; i++) { const z = -0.7 + i * 0.75; box(0.42, 1.95, 0.7, std({ color: srgb('#8a2a24'), roughness: 0.5, metalness: 0.3 }), X1 - 0.21, 0.975, z); box(0.012, 0.6, 0.04, steel, X1 - 0.425, 1.2, z + 0.25, { noCast: true }); box(0.012, 0.1, 0.3, glowW, X1 - 0.425, 1.8, z, { noCast: true, detail: true }); }

  // ── Sefa's projector for the Proctor (Act II on: docs/proctor.md), in the ceiling over the plot table's port end, built from the lost
  // array's optics: a dark housing, its lens the bridge's blue ──
  const PRX = PW / 2 + 0.62, PRZ = PZ + 0.2;
  cyl(0.11, 0.13, 0.12, steelDark, PRX, HT - 0.06, PRZ, null, 16, { noCast: true }); cyl(0.06, 0.06, 0.012, glowB, PRX, HT - 0.125, PRZ, null, 16, { noCast: true, detail: true });

  // ── The ceiling's lights: long panels down each side over the stations, a ring round the well ──
  for (const x of [-2.6, 2.6]) { box(0.5, 0.03, 3.0, steelDark, x, HT - 0.015, -1.4); box(0.42, 0.012, 2.9, glowW, x, HT - 0.034, -1.4, { noCast: true }); }
  for (const x of [-3.2, 3.2]) { box(0.5, 0.03, 1.8, steelDark, x, HT - 0.015, 2.4); box(0.42, 0.012, 1.7, glowW, x, HT - 0.034, 2.4, { noCast: true }); }

  // ── Light: cool, kept low at the front so the screen reads; brighter aft over the plot table; the screen's own glow on the stations, the
  // plot table's up into the faces at it; at the ship's night lower still ──
  const hemi = new THREE.HemisphereLight(srgb('#dfe8f8'), srgb('#262a32'), 1.2); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#363c46'), 0.7); G.add(amb);
  const key = new THREE.SpotLight(srgb('#eef4ff'), 12, 9, 1.0, 0.8, 2); key.position.set(-0.8, HT - 0.08, PZ + 1.6); key.target.position.set(0, 0.6, PZ - 0.2);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; key.shadow.camera.near = 0.2; key.shadow.camera.far = 8; G.add(key); G.add(key.target);
  const fillA = new THREE.PointLight(srgb('#e0eaff'), 2.6, 8, 2); fillA.position.set(-2.6, HT - 0.3, -1.4); G.add(fillA);
  const fillB = new THREE.PointLight(srgb('#e0eaff'), 2.6, 8, 2); fillB.position.set(2.6, HT - 0.3, -1.4); G.add(fillB);
  const fillC = new THREE.PointLight(srgb('#e0eaff'), 2.2, 7, 2); fillC.position.set(0, HT - 0.3, 3.0); G.add(fillC);
  // (the screen's glow: a pair of soft lights in front of it)
  const scrL = [-2, 2].map(x => { const l = new THREE.PointLight(srgb('#c8b8ff'), 1.4, 5, 2); l.position.set(x, 1.5, ZF + 0.6); G.add(l); return l; });
  const plotL = new THREE.PointLight(srgb('#5ad8e0'), 0.9, 2.4, 2); plotL.position.set(0, PY + 0.35, PZ); G.add(plotL);

  // ── Where things happen ──
  // (each station's seat and what its hands rest on, as world points; the jump seats; the Captain's place at the plot table)
  const inG = (at, yaw, x, y, z) => new V3(x, y, z).applyAxisAngle(new V3(0, 1, 0), yaw).add(at);
  // (its chair: turned with whoever sits in it, from its station's own facing)
  const seatSpot = (at, yaw, id, hands, chair) => ({ at: at.clone(), yaw, seatY: SEAT_Y, swivel: true, for: id, chair, hands: hands.map(([x, y, z]) => inG(at, yaw, x, y, z)), screen: inG(at, yaw, 0, 1.05, 0.97) });
  const helmS = seatSpot(HELM, Math.PI, 'pilot', [[0.36, 0.71, 0.16], [-0.36, 0.71, 0.16]], chairs.helm);      // (on the thruster grips)
  const sensS = seatSpot(SENS, Math.PI - SIDE_YAW, 'comms', [[0.2, 0.765, 0.6], [-0.2, 0.765, 0.6]], chairs.sensors);
  const survS = seatSpot(SURV, Math.PI + SIDE_YAW, 'scientist', [[0.2, 0.765, 0.6], [-0.2, 0.765, 0.6]], chairs.survey);
  const jumpS = jumps.map(at => ({ at, yaw: Math.PI, seatY: SEAT_Y }));
  const capAt = new V3(0, 0, PZ + PD / 2 + 0.42);
  const spots = {
    // (no across the knee here: a jump seat stands in, for the session's sake)
    bench: { at: jumps[1].clone(), yaw: Math.PI, seatY: SEAT_Y, turn: 0 },
    // (late in the story, in situ: standing at the plot table's aft edge, where the Captain stands, palms flat on it, bent well forward, facing
    // the bridge; the Captain at their left)
    wall: { at: new V3(0, 0, PZ + PD / 2 + 0.85), yaw: Math.PI, support: { kind: 'edge', y: PY + 0.01, d: 0.85, bend: 0.95, lines: 'plot' } },
    after: null,
    // (the bridge crew stay at their posts, each officer at their own, swivelled to it; anyone else in the jump seats)
    watch: [helmS, sensS, survS].map(s => ({ at: s.at, yaw: s.yaw, seatY: s.seatY, swivel: true, for: s.for, chair: s.chair })).concat(jumpS),
    corner: { at: new V3(X0 + 0.45, 0, 2.3), yaw: -Math.PI / 2, next: { base: new V3(0, 0, 0), step: new V3(0, 0, -0.85), yaw: -Math.PI / 2 } },
    stations: { helm: helmS, sensors: sensS, survey: survS, jump: jumpS, proctor: { at: new V3(PRX, 0, PRZ), yaw: -Math.PI / 2 }, plot: { at: capAt, yaw: Math.PI, edge: [[-0.32, PY + 0.012, PZ + PD / 2 - 0.05], [0.32, PY + 0.012, PZ + PD / 2 - 0.05]].map(a => new V3(...a)),
      // (across it from the Captain, at its fore edge: where the watch hands over, face to face)
      across: { at: new V3(0, 0, PZ - PD / 2 - 0.42), yaw: 0, edge: [[-0.32, PY + 0.012, PZ - PD / 2 + 0.05], [0.32, PY + 0.012, PZ - PD / 2 + 0.05]].map(a => new V3(...a)) } } },
  };
  // (its cameras: at the plot table, from across the bridge and over the stations; the stations scene's own, as world points)
  const cams = { wall: [['Side', [-1.9, 1.4, -0.05], [0.1, 1.0, 0.1]], ['Behind', [-0.35, 1.25, -1.15], [0, 0.85, 0.15]], ['Seat', [-0.55, 1.3, -0.7], [0, 0.88, 0]],
    ['Their face', [0.25, 1.12, 2.15], [0, 1.0, 0.75]], ['Captain', [-0.4, 1.42, -0.25], [0.43, 1.5, -0.07]], ['Bridge', [-3.6, 1.7, -0.9], [0.6, 1.0, 2.4]]] };
  // (their face from beyond the table's far edge, low over the plot; the bridge from its aft corner to port, the two of them and, beyond, the
  // watch at their posts turned to it)
  const stationCams = [['Bridge', [-4.7, 2.25, 3.4], [0.6, 0.9, -1.4]], ['Helm', [1.5, 1.25, -3.1], [0, 1.0, -1.6]], ['Captain', [0.7, 1.55, -0.5], [0, 1.45, 2.0]],
    ['Viewscreen', [0.35, 1.5, -0.2], [0, 1.45, ZF]], ['Sensors', [-1.0, 1.35, -2.7], [-2.6, 1.0, -1.3]], ['Viewport', [0.55, 1.45, PZ + 0.75], [0, HT + 1.0, PZ]]];

  const meshes = []; G.traverse(o => { if (o.isMesh) meshes.push(o); });
  const cast0 = new Map(meshes.map(m => [m, m.castShadow]));
  let low = false, time = 'day', open = false, openK = 0, t = 0;
  function apply() {
    const day = time === 'day';
    for (const m of meshes) m.castShadow = low ? false : cast0.get(m);
    for (const d of detail) d.visible = !low;
    for (const l of scrL) l.visible = !low; plotL.visible = !low;
    key.intensity = day ? 12 : 8; glowW.emissiveIntensity = day ? 3 : 1.8; fillA.intensity = fillB.intensity = day ? 2.6 : 1.5; fillC.intensity = day ? 2.2 : 1.3;
    hemi.intensity = (day ? 1.2 : 0.8) + (low ? 0.3 : 0); amb.intensity = day ? 0.7 : 0.5;
    const sz = low ? 1024 : 2048;
    if (key.shadow.mapSize.x !== sz) { key.shadow.mapSize.set(sz, sz); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
  }
  const setLow = on => { low = !!on; apply(); }, setTime = tt => { time = tt === 'night' ? 'night' : 'day'; apply(); };
  apply();
  // (the shutter: its leaves slide apart over a couple of seconds; the sky lights the table a little when it's open)
  function tick(dt) {
    t += dt; openK += ((open ? 1 : 0) - openK) * (1 - Math.exp(-dt * 1.6));
    for (const l of leaves) l.position.x = l.userData.sx * (VR + 0.05) * (0.5 + 1.1 * openK);
    skyL.intensity = 1.2 * openK; screenM.color.setScalar(0.94 + 0.06 * Math.sin(t * 0.7));
  }
  const { sideOf, sidesAt } = K.roomSides(G, { minX: X0, maxX: X1, minZ: ZF, maxZ: ZA, ht: HT }, [floor, plot]);
  return { group: G, spots, key, cams, stationCams, setLow, setTime, get time() { return time; }, sideOf, sidesAt, name: 'Bridge',
    setViewport(on) { open = !!on; }, get viewport() { return open; },
    bounds: { minX: X0 + 0.25, maxX: X1 - 0.25, minZ: ZF + 0.3, maxZ: ZA - 0.2 }, get low() { return low; }, tick };
}

root.Bridge = { build };
})(typeof window !== 'undefined' ? window : globalThis);
