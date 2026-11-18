// Project Meridian — the bridge at stations (js/bridge.js; docs/ship.md). No correction here: the bridge crew at their posts (Ashdown at Helm,
// hands on the thruster grips; Lindqvist at Sensors; Varga at Survey), anyone else called up sitting in the jump seats along the back; the
// Captain standing at the plot table behind them, hands on its edge. Each at their screen, now and then a glance at the viewscreen or back
// at the Captain. From here the Captain calls someone into the Ready Room (the page cuts there and begins it, still in that mode).
//
// The Proctor (docs/proctor.md), once it has a presence: at the plot table's port end under Sefa's projector, composed, hands behind its
// back, its eyes on the Captain and the plot by turns. Projected (Act II) it's the image, clothed, hovering a finger's breadth off the deck;
// in hard light (Act III), solid. As a voice (Act I) there's nothing to see.
//
//   const s = Stations.create(stage, bridge, { captain, crew: [{ id, sex, outfit }], proctor: { sex, presence } })
//   s.update(dt) · s.camera(i, ms) → its name · s.cams · s.st.cam · s.people [{ id, f, station }] · s.captain · s.proctor · s.dispose()
//   crew: { across: true } stands across the plot table from the Captain (handing over the watch); s.leave(id) · s.seat(id) (to their own
//   station) · s.focus(id) (the Captain's eyes on whoever's speaking) · s.expr(id, e)
(function (root) {
'use strict';
const THREE = root.THREE, V3 = THREE.Vector3, UP = new V3(0, 1, 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function create(stage, bay, opts) {
  const C = root.Crew, Fg = root.Figure, P = root.Poses, scene = stage.scene, S = bay.spots.stations;
  const { sc, W_, reach, toWorldDir, local } = P;
  const captain = Fg.make(C.captainSpec(opts.captain)); scene.add(captain.root);
  // (each officer at their own station; anyone else in a jump seat, in turn)
  const OWN = { pilot: S.helm, comms: S.sensors, scientist: S.survey };
  let j = 0;
  // (or, handing over the watch, standing across the plot table from the Captain: p.across)
  const people = (opts.crew || []).map(p => {
    const f = Fg.make(C.figureSpec(p.id, p.sex, p.outfit)); scene.add(f.root); f.setExpr('calm');
    const own = OWN[p.id], across = !!(p.across && S.plot.across);
    return { id: p.id, f, across, station: !across && !!own, spot: across ? S.plot.across : own || S.jump[j++ % S.jump.length], ph: Math.random() * 20, glance: 0, glanceAt: null, next: 3 + Math.random() * 6 };
  });
  const acrossOf = () => people.find(Q => Q.across);
  captain.setExpr('calm');
  const st = { t: 0, cam: 0 };
  const pro = opts.proctor && opts.proctor.presence && opts.proctor.presence !== 'voice' && S.proctor ? opts.proctor : null;
  const proctor = pro ? Fg.make(C.proctorSpec({ sex: pro.sex })) : null;
  if (proctor) { scene.add(proctor.root); Fg.presence(proctor, pro.presence === 'hardlight' ? 'hardlight' : 'projected'); proctor.setClothes({ top: 'down', bottoms: 'up', under: 'up' }); proctor.setExpr('calm'); }

  // A hand flat on a surface: the palm on the point, the fingers along `fwd`, the wrist a hand's length back; or round a grip (the palm in
  // toward the other hand, the fingers wrapped forward).
  const flat = (F, side, at, fwd, pole) => { const s = sc(F); reach(F, side, at.clone().addScaledVector(UP, 0.028).addScaledVector(fwd, -0.075 * s), pole, UP.clone().negate(), fwd); F.grip(side, 0.18, 0.12, 0.2); };
  const onGrip = (F, side, at, fwd, inward, pole) => { const s = sc(F); reach(F, side, at.clone().addScaledVector(inward, -0.025).addScaledVector(fwd, -0.06 * s).addScaledVector(UP, -0.01), pole, inward, fwd.clone().addScaledVector(UP, -0.4).normalize()); F.grip(side, 0.75, 0.05, 0.6); };

  function pose(dt) {
    st.t += dt;
    for (const Q of people) {
      const F = Q.f, sp = Q.spot, s = sc(F);
      // (across the plot table, handing over: standing square to it, hands on its edge, eyes on the Captain)
      if (Q.across) {
        const c = W_(captain, 'head'), h = W_(F, 'head'), d = Math.atan2(c.x - sp.at.x, c.z - sp.at.z) - sp.yaw, a = Math.atan2(Math.sin(d), Math.cos(d));
        P.stand(F, sp.at, sp.yaw, { weight: 0.35 + 0.1 * Math.sin(st.t * 0.2 + Q.ph), wide: 0.13, lean: 0.08, look: clamp(Math.atan2(h.y - c.y, Math.hypot(c.x - h.x, c.z - h.z)) * 0.8, -0.3, 0.4), headYaw: clamp(a, -1, 1) * 0.7, arms: null });
        const lf = toWorldDir(F, 1, 0, 0), fw = toWorldDir(F, 0, 0, 1), ed = sp.edge.slice().sort((p1, p2) => p2.dot(lf) - p1.dot(lf));
        for (const [side, sx, at] of [['L', 1, ed[0]], ['R', -1, ed[1]]]) flat(F, side, at.clone().addScaledVector(fw, 0.02 * s), fw.clone().addScaledVector(lf, -sx * 0.2).normalize(), toWorldDir(F, sx * 0.8, -0.5, -0.5).normalize());
        F.root.updateMatrixWorld(true); continue;
      }
      // (now and then a glance: officers up at the viewscreen or back toward the Captain; the jump seats round the room)
      Q.next -= dt; if (Q.next <= 0) { Q.glance = 1.4 + Math.random() * 1.6; Q.glanceAt = Math.random() < 0.55 ? 'screen' : 'captain'; Q.next = 5 + Math.random() * 9; }
      Q.glance = Math.max(0, Q.glance - dt); const g = Q.glance > 0 ? Math.min(1, Q.glance * 2, (3.2 - Q.glance) * 2) : 0;
      const drift = 0.05 * Math.sin(st.t * 0.31 + Q.ph), nod = 0.03 * Math.sin(st.t * 0.23 + 2 * Q.ph);
      let look = Q.station ? 0.38 : 0.1, headYaw = drift;
      if (g > 0) {
        if (Q.glanceAt === 'screen') { look = -0.05; headYaw = 0; }
        else { const c = W_(captain, 'head'), d = Math.atan2(c.x - sp.at.x, c.z - sp.at.z) - sp.yaw, a = Math.atan2(Math.sin(d), Math.cos(d)); headYaw = clamp(a, -1.3, 1.3) * 0.7; look = 0.05; }
        look = (Q.station ? 0.38 : 0.1) * (1 - g) + look * g; headYaw = drift * (1 - g) + headYaw * g;
      }
      if (sp.chair) sp.chair.rotation.y = 0;      // (square to the station)
      P.seat(F, sp.at, sp.yaw, { seatY: sp.seatY, look: look + nod, headYaw, twist: 0.25 * (headYaw - drift), lean: Q.station ? 0.12 : 0.02 });
      if (Q.station) {
        const fwd = toWorldDir(F, 0, 0, 1);
        for (const [side, k, sx] of [['L', 0, 1], ['R', 1, -1]]) {
          const pole = toWorldDir(F, sx * 0.8, -0.6, -0.4).normalize();
          if (Q.id === 'pilot') onGrip(F, side, sp.hands[k], fwd, toWorldDir(F, -sx, 0, 0), pole);
          else { const a = sp.hands[k].clone().addScaledVector(toWorldDir(F, sx, 0, 0), 0.02 * Math.sin(st.t * 0.9 + Q.ph + k)); flat(F, side, a, fwd.clone().addScaledVector(toWorldDir(F, -sx, 0, 0), 0.25).normalize(), pole); }
        }
      }
      F.root.updateMatrixWorld(true);
    }
    // the Captain at the plot table: standing square to it, weight on one leg, leaning a little over it, a hand either side on its edge;
    // looking down at the plot, and now and then up over the stations to the screen
    // (with someone across the table, or someone speaking, the eyes on them)
    const cs = sc(captain), up = 0.5 + 0.5 * Math.sin(st.t * 0.17), them = people.find(Q => Q.id === st.focus) || acrossOf();
    let cLook = 0.5 - 0.42 * up * up, cYaw = 0.08 * Math.sin(st.t * 0.21);
    if (them && st.t > 0) { const t = W_(them.f, 'head'), h = W_(captain, 'head'), d = Math.atan2(t.x - S.plot.at.x, t.z - S.plot.at.z) - S.plot.yaw, a = Math.atan2(Math.sin(d), Math.cos(d));
      cYaw = clamp(a, -1.2, 1.2) * 0.75; cLook = clamp(Math.atan2(h.y - t.y, Math.hypot(t.x - h.x, t.z - h.z)) * 0.8 + 0.1, -0.2, 0.5); }
    P.stand(captain, S.plot.at, S.plot.yaw, { weight: 0.45, wide: 0.15, lean: 0.12, look: cLook, headYaw: cYaw, arms: null });
    const left = toWorldDir(captain, 1, 0, 0), fwd = toWorldDir(captain, 0, 0, 1), edge = S.plot.edge.slice().sort((a, b) => b.dot(left) - a.dot(left));
    for (const [side, sx, at] of [['L', 1, edge[0]], ['R', -1, edge[1]]]) flat(captain, side, at.clone().addScaledVector(fwd, 0.02 * cs), fwd.clone().addScaledVector(left, -sx * 0.2).normalize(), toWorldDir(captain, sx * 0.8, -0.5, -0.5).normalize());
    captain.root.updateMatrixWorld(true);
    // (the Proctor: standing easy, hands clasped behind it, the head turning between the Captain and the plot; projected, just off the deck)
    if (proctor) {
      const sp = S.proctor, toCap = W_(captain, 'head'), a = Math.atan2(toCap.x - sp.at.x, toCap.z - sp.at.z) - sp.yaw, w = 0.5 + 0.5 * Math.sin(st.t * 0.13 + 1.3);
      P.stand(proctor, sp.at, sp.yaw, { weight: 0.15, wide: 0.12, look: 0.05 + 0.3 * (1 - w), headYaw: Math.atan2(Math.sin(a), Math.cos(a)) * 0.8 * w });
      P.arms(proctor, 'rest'); if (pro.presence !== 'hardlight') proctor.root.position.y += 0.012;
      proctor.root.updateMatrixWorld(true);
    }
  }

  // (the cameras; with someone across the plot table, the two of them first: from the side, over the Captain's shoulder, over theirs)
  const cams = [];
  function makeCams() {
    const ac = acrossOf(), A = S.plot.across, c = S.plot.at;
    cams.length = 0;
    if (ac) { const mz = (A.at.z + c.z) / 2; cams.push(['Across', [2.4, 1.6, mz + 0.35], [0, 1.35, mz]], [C.ROSTER[ac.id].short, [0.42, 1.68, c.z + 0.45], [0, 1.5, A.at.z]], ['You', [-0.42, 1.65, A.at.z - 0.45], [0, 1.55, c.z]]); }
    cams.push(...bay.stationCams);
    if (proctor) cams.push(['Proctor', [S.proctor.at.x - 1.75, 1.55, S.proctor.at.z - 0.9], [S.proctor.at.x, 1.45, S.proctor.at.z]]);
  }
  makeCams();
  // (whoever was across the table going: off the bridge, or to their own station)
  function leave(id) { const i = people.findIndex(Q => Q.id === id); if (i < 0) return; scene.remove(people[i].f.root); people.splice(i, 1); makeCams(); st.cam = 0; }
  function seat(id) { const Q = people.find(q => q.id === id); if (!Q) return; Q.across = false; Q.station = !!OWN[id]; Q.spot = OWN[id] || S.jump[j++ % S.jump.length]; makeCams(); st.cam = 0; }
  const focus = id => { st.focus = id; };
  const expr = (id, e) => { const Q = people.find(q => q.id === id); if (Q && e) Q.f.setExpr(e); else if (id === 'captain' && e) captain.setExpr(e); };
  function camera(i, ms) { st.cam = ((i % cams.length) + cams.length) % cams.length; const [, p, l] = cams[st.cam]; stage.go(new V3(...p), new V3(...l), ms == null ? 900 : ms); return cams[st.cam][0]; }
  function update(dt) { pose(dt); captain.tick(dt); for (const Q of people) Q.f.tick(dt); if (proctor) proctor.tick(dt); }
  function dispose() { scene.remove(captain.root); for (const Q of people) scene.remove(Q.f.root); if (proctor) scene.remove(proctor.root); }
  pose(0);
  return { st, captain, people, proctor, cams, camera, update, dispose, leave, seat, focus, expr };
}

root.Stations = { create };
})(typeof window !== 'undefined' ? window : globalThis);
