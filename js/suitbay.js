// Project Meridian — the Airlock Anteroom & Suit Bay (GDD §4: "sealed, acoustic privacy node; hose-down stalls & suit benches"). Industrial bones (painted
// steel panels, exposed conduit, a pressure hatch, deck grating) with the crew's warm pockets in it (a synthetic-wood bench top, a drape over the suit
// alcove, an amber pendant, a rug, a plant). Painted in code.
//
//   const bay = SuitBay.build(scene) → { group, spots: { bench, wall, watch: [...], corner }, tick(dt) }
//   spots.bench: where the bench is (the corrector sits facing +z there); spots.wall: where the subject stands, facing the rail; watch: places for witnesses;
//   corner: where someone waits between turns, facing the wall.
(function (root) {
'use strict';
const THREE = root.THREE, F = root.Figure, srgb = F.srgb, V3 = THREE.Vector3;
const W = 2.7, D = 2.3, HT = 2.65;     // half width (x), half depth (z), height

// ── Painted textures ──
function canvasTex(w, h, draw, rep) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (rep) t.repeat.set(rep[0], rep[1]); return t;
}
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
function speckle(c, w, h, n, col, a, r) { for (let i = 0; i < n; i++) { c.fillStyle = col; c.globalAlpha = a * rnd(); c.beginPath(); c.arc(rnd() * w, rnd() * h, r * (0.3 + rnd()), 0, 7); c.fill(); } c.globalAlpha = 1; }
const panelTex = (base, rep) => canvasTex(512, 512, (c, w, h) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  speckle(c, w, h, 900, '#000', 0.06, 6); speckle(c, w, h, 500, '#fff', 0.04, 5);
  // brush strokes: the painted look
  for (let i = 0; i < 140; i++) { c.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; c.lineWidth = 6 + rnd() * 14; c.beginPath(); const x = rnd() * w, y = rnd() * h; c.moveTo(x, y); c.lineTo(x + 40 + rnd() * 80, y + (rnd() - 0.5) * 10); c.stroke(); }
  c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4); c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 2; c.strokeRect(7, 7, w - 14, h - 14);
  c.fillStyle = 'rgba(0,0,0,0.5)'; for (const [x, y] of [[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18], [w / 2, 18], [w / 2, h - 18]]) { c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, h * 0.82, w, h * 0.18);      // grime toward the deck
}, rep);
const gratingTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#23272b'; c.fillRect(0, 0, w, h); c.fillStyle = '#0c0e10';
  for (let y = 8; y < h; y += 32) for (let x = 8; x < w; x += 32) { c.beginPath(); c.roundRect ? c.roundRect(x, y, 20, 20, 5) : c.rect(x, y, 20, 20); c.fill(); }
  speckle(c, w, h, 300, '#8a7a60', 0.08, 3);
}, [10, 9]);
const hazardTex = canvasTex(256, 32, (c, w, h) => { c.fillStyle = '#c8901e'; c.fillRect(0, 0, w, h); c.fillStyle = '#16181a'; for (let x = -32; x < w; x += 32) { c.beginPath(); c.moveTo(x, h); c.lineTo(x + 16, 0); c.lineTo(x + 32, 0); c.lineTo(x + 16, h); c.fill(); } speckle(c, w, h, 120, '#000', 0.3, 3); }, [4, 1]);
const woodTex = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#7a4e30'; c.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { c.strokeStyle = `rgba(${rnd() < 0.5 ? '40,20,10' : '160,110,70'},0.25)`; c.lineWidth = 1 + rnd() * 2; c.beginPath(); const y = rnd() * h; c.moveTo(0, y); for (let x = 0; x <= w; x += 16) c.lineTo(x, y + Math.sin(x * 0.03 + i) * 3); c.stroke(); } }, [1, 1]);
const rugTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#5a2a26'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c89a52'; c.lineWidth = 6; c.strokeRect(14, 14, w - 28, h - 28);
  c.fillStyle = '#2a4a4c'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.save(); c.translate(48 + i * 54, 48 + j * 54); c.rotate(Math.PI / 4); c.fillRect(-12, -12, 24, 24); c.restore(); }
  speckle(c, w, h, 600, '#000', 0.08, 3);
});
const drapeTex = canvasTex(128, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? '#6a3a4a' : '#7e4a58'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#c89a52'; c.fillRect(0, h - 14, w, 5); speckle(c, w, h, 300, '#000', 0.1, 2); });

function build(scene) {
  const G = new THREE.Group(); scene.add(G);
  const std = (o) => F.paint(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.7, metalness: 0.25 }, o)), { grain: 0.05, scale: 8 });
  const box = (w, h, d, m, x, y, z, o) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); if (o && o.ry) b.rotation.y = o.ry; b.castShadow = !(o && o.noCast); b.receiveShadow = true; G.add(b); return b; };
  const cyl = (r0, r1, h, m, x, y, z, rot, seg) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 16), m); c.position.set(x, y, z); if (rot) c.rotation.set(rot[0], rot[1], rot[2]); c.castShadow = true; c.receiveShadow = true; G.add(c); return c; };

  const steel = std({ map: panelTex('#3a454e', [1, 1]), roughness: 0.62, metalness: 0.35 });
  const steelDark = std({ map: panelTex('#262d33', [1, 1]), roughness: 0.6, metalness: 0.4 });
  const teal = std({ map: panelTex('#2c4a4c', [1, 1]), roughness: 0.65, metalness: 0.3 });
  const pipeM = std({ color: srgb('#5a5e5c'), roughness: 0.45, metalness: 0.7 }), pipeY = std({ color: srgb('#a8761e'), roughness: 0.5, metalness: 0.4 }), pipeR = std({ color: srgb('#7a2a22'), roughness: 0.5, metalness: 0.35 });
  const glowC = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#5ad8e0'), emissiveIntensity: 3.5 });
  const glowA = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ffb05a'), emissiveIntensity: 6 });
  const glowR = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: srgb('#ff3a2a'), emissiveIntensity: 4 });

  // Deck, ceiling, walls (panelled: each wall a run of panels, alternating tones, a dado of darker panels below)
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D * 2), std({ map: gratingTex, roughness: 0.55, metalness: 0.6 })); deck.rotation.x = -Math.PI / 2; deck.receiveShadow = true; G.add(deck);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D * 2), steelDark); ceil.rotation.x = Math.PI / 2; ceil.position.y = HT; G.add(ceil);
  const wall = (len, x, z, ry, skip) => {
    const n = Math.round(len / 0.9), pw = len / n;
    for (let i = 0; i < n; i++) {
      if (skip && skip(i)) continue;
      const off = -len / 2 + pw * (i + 0.5), px = x + Math.cos(ry) * off, pz = z - Math.sin(ry) * off;
      const up = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.01, HT - 0.62), i % 3 === 1 ? teal : steel); up.position.set(px, 0.62 + (HT - 0.62) / 2, pz); up.rotation.y = ry; up.receiveShadow = true; G.add(up);
      const lo = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.01, 0.6), steelDark); lo.position.set(px, 0.3, pz); lo.rotation.y = ry; lo.receiveShadow = true; G.add(lo);
    }
    // a frame rib between every other panel
  };
  wall(W * 2, 0, -D, 0); wall(W * 2, 0, D, Math.PI); wall(D * 2, -W, 0, Math.PI / 2); wall(D * 2, W, 0, -Math.PI / 2, i => i === 2);
  // frame ribs, and the ceiling's beams
  for (let x = -W + 0.9; x < W - 0.1; x += 1.8) { box(0.12, HT, 0.1, steelDark, x, HT / 2, -D + 0.05); box(0.12, HT, 0.1, steelDark, x, HT / 2, D - 0.05); box(0.14, 0.14, D * 2, steelDark, x, HT - 0.07, 0); }
  for (let z = -D + 0.9; z < D - 0.1; z += 1.8) { box(0.1, HT, 0.12, steelDark, -W + 0.05, HT / 2, z); }
  // hazard stripe along the deck by the hatch wall
  const hz = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.12), std({ map: hazardTex, roughness: 0.7, metalness: 0.1 })); hz.rotation.x = -Math.PI / 2; hz.rotation.z = Math.PI / 2; hz.position.set(W - 0.5, 0.004, 0.0); G.add(hz);

  // The pressure hatch (east wall): a round door in a thick collar, with a hand wheel, a status strip and a red lamp over it.
  {
    const hg = new THREE.Group(); hg.position.set(W - 0.02, 1.1, 0.0); hg.rotation.y = -Math.PI / 2; G.add(hg);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.1, 16, 48), steelDark); collar.castShadow = true; hg.add(collar);
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.08, 48), std({ map: panelTex('#5a5246', [1, 1]), roughness: 0.6, metalness: 0.4 })); door.rotation.x = Math.PI / 2; door.position.z = 0.02; hg.add(door);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 10, 32), pipeY); wheel.position.z = 0.1; hg.add(wheel);
    for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.03, 0.03), pipeY); sp.rotation.z = i * Math.PI / 3; sp.position.z = 0.1; hg.add(sp); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 8), pipeM); bolt.rotation.x = Math.PI / 2; bolt.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0.09); hg.add(bolt); }
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.02), glowC); strip.position.set(0, 0.95, 0.06); hg.add(strip);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glowR); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, 1.1, 0.03); hg.add(lamp);
    const red = new THREE.PointLight(srgb('#ff3a22'), 2.2, 3.0, 2); red.position.set(W - 0.25, 2.2, 0); G.add(red);
    hg.userData.red = red; G.userData.hatch = hg;
  }
  // Suit alcoves (north wall): two EVA suits hanging on their frames, a drape half drawn across the second.
  const suitM = std({ color: srgb('#c8c0ae'), roughness: 0.8, metalness: 0.05 }), suitT = std({ color: srgb('#b0702a'), roughness: 0.75, metalness: 0.05 });
  const visor = new THREE.MeshStandardMaterial({ color: srgb('#14202a'), roughness: 0.08, metalness: 0.9, emissive: srgb('#1a3a44'), emissiveIntensity: 0.4 });
  for (const sx of [-1.55, -0.45]) {
    box(0.9, 2.2, 0.06, steelDark, sx, 1.1, -D + 0.04);
    box(0.06, 2.2, 0.5, steelDark, sx - 0.45, 1.1, -D + 0.28); box(0.06, 2.2, 0.5, steelDark, sx + 0.45, 1.1, -D + 0.28);
    const s = new THREE.Group(); s.position.set(sx, 0.05, -D + 0.32); G.add(s);
    const part = (geo, m, x, y, z, sc, r) => { const p = new THREE.Mesh(geo, m); p.position.set(x, y, z); if (sc) p.scale.set(sc[0], sc[1], sc[2]); if (r) p.rotation.set(r[0], r[1], r[2]); p.castShadow = true; s.add(p); return p; };
    const sph = new THREE.SphereGeometry(1, 20, 14), cap = new THREE.CylinderGeometry(1, 1, 1, 16);
    part(sph, suitM, 0, 1.3, 0, [0.24, 0.32, 0.18]); part(sph, suitT, 0, 1.32, -0.13, [0.2, 0.26, 0.1]);          // torso, life-support pack
    part(sph, suitM, 0, 0.98, 0, [0.2, 0.16, 0.15]);
    for (const k of [-1, 1]) { part(cap, suitM, 0.1 * k, 0.6, 0, [0.085, 0.62, 0.085]); part(sph, suitM, 0.1 * k, 0.1, 0.04, [0.08, 0.07, 0.14]); part(cap, suitM, 0.27 * k, 1.12, 0, [0.065, 0.55, 0.065], [0, 0, 0.12 * k]); part(sph, suitT, 0.31 * k, 0.83, 0, [0.06, 0.07, 0.06]); }
    part(sph, suitM, 0, 1.74, 0, [0.17, 0.17, 0.17]); part(sph, visor, 0, 1.74, 0.06, [0.14, 0.12, 0.13]);
    part(new THREE.TorusGeometry(0.15, 0.025, 8, 24), suitT, 0, 1.6, 0, null, [Math.PI / 2, 0, 0]);
    box(0.3, 0.02, 0.02, glowA, sx, 2.12, -D + 0.12, { noCast: true });
  }
  // the drape: a gathered curtain, its folds a wave
  {
    const g = new THREE.PlaneGeometry(0.62, 2.0, 40, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * 38) * 0.035 + 0.035); }
    g.computeVertexNormals();
    const dr = new THREE.Mesh(g, F.paint(new THREE.MeshStandardMaterial({ map: drapeTex, roughness: 0.92, side: THREE.DoubleSide }), { grain: 0.08, scale: 30 }));
    dr.position.set(-0.22, 1.12, -D + 0.56); dr.castShadow = true; G.add(dr);
    cyl(0.012, 0.012, 1.0, pipeM, -0.45, 2.14, -D + 0.56, [0, 0, Math.PI / 2]);
  }
  // Lockers along the west wall's north end, a mug and a plant on top
  for (let i = 0; i < 3; i++) { const l = box(0.5, 1.9, 0.5, i === 1 ? teal : steel, -W + 0.3, 0.95, -D + 1.45 + i * 0.52); l.material = i === 1 ? teal : steel; box(0.02, 0.18, 0.04, pipeM, -W + 0.56, 1.1, -D + 1.6 + i * 0.52); }
  {
    const pot = cyl(0.08, 0.06, 0.13, std({ color: srgb('#8a4a2e'), roughness: 0.85, metalness: 0 }), -W + 0.3, 1.97, -D + 2.0);
    const leafM = std({ color: srgb('#4a7a3a'), roughness: 0.7, metalness: 0 });
    for (let i = 0; i < 9; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), leafM); const a = i * 2.4; lf.scale.set(0.02, 0.11, 0.05); lf.position.set(-W + 0.3 + Math.cos(a) * 0.05, 2.1, -D + 2.0 + Math.sin(a) * 0.05); lf.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * 0.6); lf.castShadow = true; G.add(lf); }
    cyl(0.04, 0.035, 0.09, std({ color: srgb('#d8d0c0'), roughness: 0.4, metalness: 0 }), -W + 0.33, 1.945, -D + 1.42);
  }
  // Conduit: runs along the ceiling and down the walls
  const run = (m, r, a, b) => { const v = new V3().subVectors(b, a), c = cyl(r, r, v.length(), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, null, 10); c.quaternion.setFromUnitVectors(new V3(0, 1, 0), v.normalize()); return c; };
  run(pipeM, 0.05, new V3(-W, 2.42, -D + 0.25), new V3(W, 2.42, -D + 0.25)); run(pipeY, 0.035, new V3(-W, 2.3, -D + 0.18), new V3(W, 2.3, -D + 0.18));
  run(pipeR, 0.04, new V3(W - 0.18, 2.42, -D), new V3(W - 0.18, 2.42, D)); run(pipeM, 0.03, new V3(W - 0.12, 0.2, -D), new V3(W - 0.12, 0.2, D));
  run(pipeY, 0.035, new V3(-W + 0.15, 2.3, -D + 0.18), new V3(-W + 0.15, 2.3, D - 0.3)); run(pipeM, 0.045, new V3(-W + 0.12, 0.1, D - 0.3), new V3(-W + 0.12, 2.42, D - 0.3));
  for (let x = -W + 0.5; x < W; x += 0.9) { box(0.04, 0.2, 0.14, steelDark, x, 2.38, -D + 0.2); }

  // The rail station (west wall, south half): a padded panel with two grab rails, the place for standing correction.
  const railZ = 0.95, railY = 1.12;
  box(0.06, 1.3, 1.3, std({ color: srgb('#3a2c26'), roughness: 0.9, metalness: 0 }), -W + 0.04, 1.05, railZ);
  for (const dy of [0, 0.32]) {
    run(pipeY, 0.017, new V3(-W + 0.12, railY + dy, railZ - 0.55), new V3(-W + 0.12, railY + dy, railZ + 0.55));
    for (const dz of [-0.5, 0.5]) run(pipeM, 0.012, new V3(-W + 0.04, railY + dy, railZ + dz), new V3(-W + 0.12, railY + dy, railZ + dz));
  }
  box(0.02, 0.03, 0.8, glowC, -W + 0.08, 1.9, railZ, { noCast: true });

  // The suit bench: steel frame, a synthetic-wood top, a thin pad; a rug under it.
  const benchAt = new V3(0.15, 0, 0.0), seatY = 0.46;
  {
    const b = new THREE.Group(); b.position.copy(benchAt); G.add(b);
    const add = (m, mm) => { m.castShadow = true; m.receiveShadow = true; b.add(m); return m; };
    const top = add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.44), F.paint(new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55, metalness: 0 }), { grain: 0.06, scale: 20 })));
    top.position.y = seatY - 0.045;
    const pad = add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.4), F.paint(new THREE.MeshStandardMaterial({ color: srgb('#4a3a34'), roughness: 0.9 }), { grain: 0.08, scale: 40 }))); pad.position.y = seatY - 0.01;
    for (const x of [-0.62, 0.62]) for (const z of [-0.16, 0.16]) { const l = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, seatY - 0.07, 0.05), steelDark)); l.position.set(x, (seatY - 0.07) / 2, z); }
    for (const x of [-0.62, 0.62]) { const r = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.36), steelDark)); r.position.set(x, 0.12, 0); }
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.4), F.paint(new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95 }), { grain: 0.1, scale: 30 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 0.25); rug.receiveShadow = true; b.add(rug);
  }

  // Light: a cool, low fill; the amber pendant over the bench (the key, casting shadows); a cool rim from the status strips; the warm wash on the drape.
  const hemi = new THREE.HemisphereLight(srgb('#5a7088'), srgb('#1a1612'), 0.35); G.add(hemi);
  const amb = new THREE.AmbientLight(srgb('#2a3440'), 0.25); G.add(amb);
  const pendant = new THREE.Group(); pendant.position.set(benchAt.x, 2.2, 0.25); G.add(pendant);
  {
    const shadeM = std({ color: srgb('#a8762e'), roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide });
    const sh = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 24, 1, true), shadeM); pendant.add(sh);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), glowA); bulb.position.y = -0.06; pendant.add(bulb);
    cyl(0.008, 0.008, 0.38, pipeM, benchAt.x, 2.46, 0.25);
  }
  const key = new THREE.SpotLight(srgb('#ffc890'), 38, 7, 1.0, 0.65, 2); key.position.set(benchAt.x, 2.12, 0.25); key.target.position.set(benchAt.x, 0, 0.3);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4; key.shadow.camera.near = 0.3; key.shadow.camera.far = 6;
  G.add(key); G.add(key.target);
  const wallKey = new THREE.SpotLight(srgb('#ffbc80'), 12, 5, 0.75, 0.7, 2); wallKey.position.set(-1.2, 2.3, railZ + 0.2); wallKey.target.position.set(-2.1, 0.8, railZ);
  wallKey.castShadow = true; wallKey.shadow.mapSize.set(1024, 1024); wallKey.shadow.bias = -0.0005; wallKey.shadow.normalBias = 0.02; G.add(wallKey); G.add(wallKey.target);
  const rim = new THREE.PointLight(srgb('#4ac8d8'), 3.2, 5, 2); rim.position.set(-1.0, 1.9, -D + 0.6); G.add(rim);
  const rim2 = new THREE.PointLight(srgb('#3a7aa8'), 2.6, 6, 2); rim2.position.set(1.8, 1.6, 1.8); G.add(rim2);
  const alcove = new THREE.PointLight(srgb('#ffa860'), 1.6, 2.5, 2); alcove.position.set(-1.0, 2.0, -D + 0.5); G.add(alcove);

  const spots = {
    bench: { at: new V3(benchAt.x, 0, benchAt.z), yaw: 0, seatY },
    wall: { at: new V3(-W + 0.82, 0, railZ), yaw: -Math.PI / 2, rail: { x: -W + 0.12, y: railY, z: railZ, hi: railY + 0.32 } },
    watch: [{ at: new V3(1.55, 0, -1.2), yaw: -2.4 }, { at: new V3(-0.9, 0, -1.35), yaw: 2.6 }, { at: new V3(1.85, 0, 0.9), yaw: -1.9 }, { at: new V3(0.6, 0, -1.55), yaw: 3.0 }],
    corner: { at: new V3(-W + 0.32, 0, -D + 0.32 + 1.2 + 1.3), yaw: -Math.PI / 2 },
  };
  spots.corner = { at: new V3(W - 0.34, 0, D - 0.34), yaw: Math.PI / 4 };
  let t = 0;
  return { group: G, spots, key, tick(dt) { t += dt; glowR.emissiveIntensity = 3 + 1.5 * Math.sin(t * 2.2); G.userData.hatch.userData.red.intensity = 1.6 + 0.8 * Math.sin(t * 2.2); } };
}

root.SuitBay = { build };
})(typeof window !== 'undefined' ? window : globalThis);
