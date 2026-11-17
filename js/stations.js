// Project Meridian — the bridge at stations (js/bridge.js; docs/ship.md). No correction here: the bridge crew at their posts (Ashdown at Helm,
// hands on the thruster grips; Lindqvist at Sensors; Varga at Survey), anyone else called up sitting in the jump seats along the back; the
// Captain standing at the plot table behind them, hands on its edge. Each at their screen, now and then a glance at the viewscreen or back
// at the Captain. From here the Captain calls someone into the Ready Room (the page cuts there and begins it, still in that mode).
//
//   const s = Stations.create(stage, bridge, { captain, crew: [{ id, sex, outfit }] })
//   s.update(dt) · s.camera(i, ms) → its name · s.cams · s.st.cam · s.people [{ id, f, station }] · s.captain · s.dispose()
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
  const people = (opts.crew || []).map(p => {
    const f = Fg.make(C.figureSpec(p.id, p.sex, p.outfit)); scene.add(f.root); f.setExpr('calm');
    const own = OWN[p.id];
    return { id: p.id, f, station: !!own, spot: own || S.jump[j++ % S.jump.length], ph: Math.random() * 20, glance: 0, glanceAt: null, next: 3 + Math.random() * 6 };
  });
  captain.setExpr('calm');
  const st = { t: 0, cam: 0 };

  // A hand flat on a surface: the palm on the point, the fingers along `fwd`, the wrist a hand's length back; or round a grip (the palm in
  // toward the other hand, the fingers wrapped forward).
  const flat = (F, side, at, fwd, pole) => { const s = sc(F); reach(F, side, at.clone().addScaledVector(UP, 0.028).addScaledVector(fwd, -0.075 * s), pole, UP.clone().negate(), fwd); F.grip(side, 0.18, 0.12, 0.2); };
  const onGrip = (F, side, at, fwd, inward, pole) => { const s = sc(F); reach(F, side, at.clone().addScaledVector(inward, -0.025).addScaledVector(fwd, -0.06 * s).addScaledVector(UP, -0.01), pole, inward, fwd.clone().addScaledVector(UP, -0.4).normalize()); F.grip(side, 0.75, 0.05, 0.6); };

  function pose(dt) {
    st.t += dt;
    for (const Q of people) {
      const F = Q.f, sp = Q.spot, s = sc(F);
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
    const cs = sc(captain), up = 0.5 + 0.5 * Math.sin(st.t * 0.17);
    P.stand(captain, S.plot.at, S.plot.yaw, { weight: 0.45, wide: 0.15, lean: 0.12, look: 0.5 - 0.42 * up * up, headYaw: 0.08 * Math.sin(st.t * 0.21), arms: null });
    const left = toWorldDir(captain, 1, 0, 0), fwd = toWorldDir(captain, 0, 0, 1), edge = S.plot.edge.slice().sort((a, b) => b.dot(left) - a.dot(left));
    for (const [side, sx, at] of [['L', 1, edge[0]], ['R', -1, edge[1]]]) flat(captain, side, at.clone().addScaledVector(fwd, 0.02 * cs), fwd.clone().addScaledVector(left, -sx * 0.2).normalize(), toWorldDir(captain, sx * 0.8, -0.5, -0.5).normalize());
    captain.root.updateMatrixWorld(true);
  }

  const cams = bay.stationCams;
  function camera(i, ms) { st.cam = ((i % cams.length) + cams.length) % cams.length; const [, p, l] = cams[st.cam]; stage.go(new V3(...p), new V3(...l), ms == null ? 900 : ms); return cams[st.cam][0]; }
  function update(dt) { pose(dt); captain.tick(dt); for (const Q of people) Q.f.tick(dt); }
  function dispose() { scene.remove(captain.root); for (const Q of people) scene.remove(Q.f.root); }
  pose(0);
  return { st, captain, people, cams, camera, update, dispose };
}

root.Stations = { create };
})(typeof window !== 'undefined' ? window : globalThis);
