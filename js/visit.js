// Project Meridian — a visit, as it's seen (day.html; docs/day.md): whoever's in the room where they'd be at this hour, and the Captain with
// them. At work, at what they work at (Okafor at the reactor's guard rail, Haddad at the potting bench), the Captain at their left; Ruel at
// their desk in the med bay; at a meal, seated round the mess table, a plate and a mug each, the Captain at the fore end of the spine-side bench; off duty of
// an evening, Ashdown and Okafor on the mess sofa, Varga at the table with the day's readings; at the desk, the Captain in the Ready Room's
// chair; waking, and turning in, on the edge of the bed. Everyone looks at whoever's speaking (the one speaking at the Captain), now and then
// away; a line can set a face. (The bridge has its own scene: js/stations.js; the evening report its own: js/checkin.js.)
//
//   Visit.layout(room, bay, here, { t, day, kind }) → { cap: { at, yaw, how, seatY, hands }, people: [{ id, at, yaw, how, seatY, hands }], props }
//   const v = Visit.create(stage, bay, { captain, crew: { id: { sex, outfit } }, layout }) → { update(dt), focus(id), expr(id, e), camera(i, ms), cams, st, dispose() }
(function (root) {
'use strict';
const THREE = root.THREE, V3 = THREE.Vector3, UP = new V3(0, 1, 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fwdOf = yaw => new V3(Math.sin(yaw), 0, Math.cos(yaw)), leftOf = yaw => new V3(Math.cos(yaw), 0, -Math.sin(yaw));
const face = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

// Where everyone is, room by room. here: the crew in the room; kind: 'meal' | 'off' | 'work' | 'wake' | 'desk' | 'room'.
function layout(room, bay, here, o) {
  const S = bay.spots, out = { cap: null, people: [], props: [] };
  // (at work: standing a step from what they work at, hands on its edge; the Captain at their left, turned to them)
  const atWork = sp => {
    const f = fwdOf(sp.yaw), l = leftOf(sp.yaw), d = sp.support ? sp.support.d : 0.85, y = (sp.support ? sp.support.y : 0.9) + 0.01;
    const at = sp.at.clone().addScaledVector(f, d - 0.4), edge = sp.at.clone().addScaledVector(f, d + 0.04);
    return { at, yaw: sp.yaw, how: 'work', hands: [edge.clone().addScaledVector(l, 0.2).setY(y), edge.clone().addScaledVector(l, -0.2).setY(y)], lean: 0.18 };
  };
  const capBeside = (p, side, back) => { const c = p.at.clone().addScaledVector(leftOf(p.yaw), side).addScaledVector(fwdOf(p.yaw), -(back || 0.2)); return { at: c, yaw: face(c, p.at), how: 'stand' }; };
  if (room === 'mess') {
    if (o.kind === 'meal' || !here.length || here.every(id => !o.off(id))) {
      // round the table: the spine-side bench (facing fore… the table, −z), the hull side (facing it, +z); a plate and a mug each
      // (close in to it; some with their hands on the table, a forearm's length out, some with them in their lap)
      const seats = [[0.6, 1.24, Math.PI], [0.6, -0.44, 0], [1.4, -0.44, 0], [1.4, 1.24, Math.PI], [2.2, -0.44, 0], [2.2, 1.24, Math.PI], [3.0, -0.44, 0], [3.0, 1.24, Math.PI]];
      let n = 0;
      const sit = ([x, z, yaw]) => { const at = new V3(x, 0, z), f = fwdOf(yaw), l = leftOf(yaw), e = at.clone().addScaledVector(f, 0.37).setY(0.755);
        out.props.push({ kind: 'plate', at: at.clone().addScaledVector(f, 0.58).setY(0.758) }, { kind: 'mug', at: at.clone().addScaledVector(f, 0.52).addScaledVector(l, -0.26).setY(0.8) });
        return { at, yaw, how: 'seat', seatY: 0.45, hands: n++ % 3 === 2 ? null : [e.clone().addScaledVector(l, 0.19), e.clone().addScaledVector(l, -0.19)], lean: 0.08 }; };
      if (o.kind === 'meal') { out.cap = sit(seats[0]); here.forEach((id, i) => out.people.push(Object.assign({ id }, sit(seats[i + 1])))); }
      else { here.forEach((id, i) => out.people.push(Object.assign({ id }, sit(seats[i + 1])))); out.cap = { at: new V3(-0.55, 0, 0.4), yaw: Math.PI / 2, how: 'stand' }; }
      return out;
    }
    // off duty: the couple on the sofa, side by side; whoever else at the table
    const sofa = S.after, onSofa = here.filter(id => id === 'pilot' || id === 'engineer'), rest = here.filter(id => !onSofa.includes(id));
    onSofa.forEach((id, i) => out.people.push({ id, at: i ? sofa.beside.clone() : sofa.at.clone(), yaw: sofa.yaw, how: 'seat', seatY: sofa.seatY, lean: -0.05 }));
    rest.forEach((id, i) => { const at = new V3(1.4 + i * 0.8, 0, -0.5), e = at.clone().add(new V3(0, 0.755, 0.47)); out.people.push({ id, at, yaw: 0, how: 'seat', seatY: 0.45, hands: [e.clone().add(new V3(0.17, 0, 0)), e.clone().add(new V3(-0.17, 0, 0))], lean: 0.12 }); });
    out.cap = onSofa.length ? { at: new V3(2.6, 0, -0.95), yaw: Math.PI, how: 'stand' } : { at: new V3(1.8, 0, 0.0), yaw: face(new V3(1.8, 0, 0), out.people[0].at), how: 'stand' };
    return out;
  }
  if (room === 'medbay' && here.length) {
    // (Ruel at their desk against the fore wall, the baselines terminal in front of them; the Captain standing beside it, turned to them)
    const at = new V3(-1.62, 0, -1.75), e = new V3(-2.02, 0.765, -1.75);
    here.forEach((id, i) => out.people.push(i ? { id, at: new V3(-1.0, 0, -2.3), yaw: -Math.PI / 4, how: 'stand' } : { id, at, yaw: -Math.PI / 2, how: 'seat', seatY: 0.49, hands: [e.clone().add(new V3(0, 0, 0.18)), e.clone().add(new V3(0, 0, -0.18))], lean: 0.08 }));
    const c = new V3(-1.45, 0, -0.85); out.cap = { at: c, yaw: face(c, at), how: 'stand' }; out.camFrom = 'front';
    return out;
  }
  if (room === 'reactor' || room === 'hydro' || room === 'medbay') {
    // (whoever works here at what they work at; anyone else beside them)
    here.forEach((id, i) => { const p = atWork(S.wall); if (i) { p.at.addScaledVector(leftOf(p.yaw), -0.75 * i); p.hands = null; p.how = 'stand'; } out.people.push(Object.assign({ id }, p)); });
    out.cap = here.length ? capBeside(out.people[0], 1.0, 0.25) : { at: S.wall.at.clone(), yaw: S.wall.yaw, how: 'stand' };
    // (the reactor's core fills the middle of the room: seen from the walkway's outer side, the core behind them)
    if (room === 'reactor') out.camSide = 'out';
    // (elsewhere, from across what they work at: their face, the Captain's three-quarter)
    else if (here.length) out.camFrom = 'front';
    return out;
  }
  if (room === 'ready') {
    // (the desk: the Captain in the chair behind it, hands on its top)
    const at = new V3(1.36, 0, 0.6), e = new V3(0.94, 0.765, 0.6);
    out.cap = { at, yaw: -Math.PI / 2, how: 'seat', seatY: 0.545, hands: [e.clone().add(new V3(0, 0, -0.17)), e.clone().add(new V3(0, 0, 0.17))], lean: 0.1 };
    return out;
  }
  if (room === 'captain') {
    // (waking and turning in, on the edge of the bed; otherwise at the writing desk)
    if (o.kind === 'wake') { const b = S.seats.bed; out.cap = { at: b.at.clone(), yaw: b.yaw, how: 'seat', seatY: b.seatY, lean: 0.12 }; return out; }
    const at = new V3(-2.25, 0, -0.1), e = new V3(-1.84, 0.765, -0.1);
    out.cap = { at, yaw: Math.PI / 2, how: 'seat', seatY: 0.485, hands: [e.clone().add(new V3(0, 0, 0.17)), e.clone().add(new V3(0, 0, -0.17))], lean: 0.1 };
    return out;
  }
  // (anywhere else (the suit bay): the Captain in front of the suit alcoves, looking them over; anyone there at the watch spots)
  out.cap = { at: new V3(-1.0, 0, -0.75), yaw: Math.PI, how: 'stand' };
  if (room === 'suitbay' && !here.length) out.cams = [['Suits', new V3(0.75, 1.65, 0.95), new V3(-1.05, 1.15, -1.9)], ['You', new V3(-0.35, 1.6, -2.0), new V3(-1.0, 1.5, -0.75)], ['Room', new V3(1.9, 2.0, 1.6), new V3(-0.8, 0.8, -1.0)]];
  here.forEach((id, i) => { const w = S.watch[i % S.watch.length]; out.people.push({ id, at: w.at.clone(), yaw: face(w.at, out.cap.at), how: 'stand' }); });
  return out;
}

function create(stage, bay, o) {
  const C = root.Crew, Fg = root.Figure, P = root.Poses, scene = stage.scene, L = o.layout;
  const { sc, W_, reach, toWorldDir } = P;
  const captain = Fg.make(C.captainSpec(Object.assign({}, o.captain, { outfit: o.captainOutfit || 'uniform' }))); scene.add(captain.root); captain.setExpr('calm');
  const people = L.people.map(p => { const c = o.crew[p.id] || {}; const f = Fg.make(C.figureSpec(p.id, c.sex || 'f', c.outfit || 'uniform')); scene.add(f.root); f.setExpr(C.ROSTER[p.id].base === 'stern' ? 'calm' : 'calm'); return Object.assign({}, p, { f, ph: Math.random() * 20, away: 0, next: 4 + Math.random() * 6 }); });
  const all = [Object.assign({ id: 'captain', f: captain, ph: 1.3, away: 0, next: 6 }, L.cap)].concat(people);
  // the props: a plate and a mug at each place at a meal
  const propG = new THREE.Group(); scene.add(propG);
  const plateM = new THREE.MeshStandardMaterial({ color: Fg.srgb('#e0dace'), roughness: 0.4 }), mugM = new THREE.MeshStandardMaterial({ color: Fg.srgb('#5a7a8a'), roughness: 0.5 });
  for (const pr of L.props || []) {
    const m = pr.kind === 'plate' ? new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.015, 20), plateM) : new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 14), mugM);
    m.position.copy(pr.at); m.castShadow = true; propG.add(m);
  }
  const st = { t: 0, cam: 0, focus: null };
  // A hand flat on a surface: the palm on the point, the fingers along `fwd`, the wrist a hand's length back.
  const flat = (F, side, at, fwd, pole) => { const s = sc(F); reach(F, side, at.clone().addScaledVector(UP, 0.028).addScaledVector(fwd, -0.075 * s), pole, UP.clone().negate(), fwd); F.grip(side, 0.18, 0.12, 0.2); };
  // (whom each looks at: the one speaking; the one speaking, at the Captain; the Captain, at whoever's speaking, or the first of them)
  const lookAt = Q => {
    const f = st.focus;
    if (Q.id === 'captain') { const T = people.find(p => p.id === f) || people[0]; return T ? W_(T.f, 'head') : null; }
    if (!f || f === Q.id || f === 'captain' || !people.some(p => p.id === f)) return W_(captain, 'head');
    return W_(people.find(p => p.id === f).f, 'head');
  };
  function pose(dt) {
    st.t += dt;
    for (const Q of all) {
      const F = Q.f;
      // (now and then a look away: down at the table or their work, then back)
      Q.next -= dt; if (Q.next <= 0) { Q.away = 1.2 + Math.random() * 1.4; Q.next = 6 + Math.random() * 8; }
      Q.away = Math.max(0, Q.away - dt); const aw = Q.away > 0 ? Math.min(1, Q.away * 2, (2.6 - Q.away) * 2) : 0;
      const T = st.focus === Q.id && Q.id !== 'captain' ? W_(captain, 'head') : lookAt(Q);
      let headYaw = 0.05 * Math.sin(st.t * 0.3 + Q.ph), look = Q.how === 'work' ? 0.35 : 0.1;
      if (T && st.t > 0) {
        // (from where the head was last frame: near enough)
        const hp = W_(F, 'head'), d = Math.atan2(T.x - hp.x, T.z - hp.z) - Q.yaw, a = Math.atan2(Math.sin(d), Math.cos(d));
        headYaw = clamp(a, -1.25, 1.25) * 0.75; look = clamp(Math.atan2(hp.y - T.y, Math.hypot(T.x - hp.x, T.z - hp.z)) * 0.8, -0.3, 0.45);
      }
      headYaw *= 1 - aw; look = look * (1 - aw) + (Q.how === 'work' ? 0.55 : 0.4) * aw;
      const twist = clamp(headYaw * 0.35, -0.3, 0.3);
      if (Q.how === 'seat') P.seat(F, Q.at, Q.yaw, { seatY: Q.seatY, look, headYaw, twist, lean: Q.lean || 0.04 });
      else P.stand(F, Q.at, Q.yaw, { weight: 0.35 + 0.15 * Math.sin(st.t * 0.21 + Q.ph), wide: 0.12, look, headYaw, lean: Q.lean || 0, arms: Q.hands ? null : undefined });
      if (Q.hands) {
        const fwd = toWorldDir(F, 0, 0, 1);
        for (const [side, k, sx] of [['L', 0, 1], ['R', 1, -1]]) flat(F, side, Q.hands[k].clone().addScaledVector(toWorldDir(F, sx, 0, 0), 0.01 * Math.sin(st.t * 0.7 + Q.ph + k)), fwd.clone().addScaledVector(toWorldDir(F, -sx, 0, 0), 0.25).normalize(), toWorldDir(F, sx * 0.8, -0.6, -0.4).normalize());
      } else if (Q.how !== 'seat') P.arms(F, Q.id === 'captain' ? 'rest' : (Q.arms || 'clasp'));
      F.root.updateMatrixWorld(true);
    }
  }
  // The cameras, from where the Captain and the one they're with are: the two of them; over the Captain's shoulder onto them; over theirs onto
  // the Captain; the room. (A room's walls go when a camera's through them: js/suitbay.js sidesAt.)
  const cams = [];
  {
    const capH = L.cap.at.clone().setY(L.cap.how === 'seat' ? 1.15 : 1.6), main = people[0];
    const mid = main ? capH.clone().lerp(main.at.clone().setY(main.how === 'seat' ? 1.15 : 1.55), 0.5) : capH.clone().addScaledVector(fwdOf(L.cap.yaw), 0.8);
    const across = main ? main.at.clone().sub(L.cap.at).setY(0).normalize() : fwdOf(L.cap.yaw);
    let side = new V3(-across.z, 0, across.x); if ((side.dot(mid.clone().setY(0).negate()) < 0) !== (L.camSide === 'out')) side.negate();      // (toward the middle of the room, or away from it)
    if (L.camFrom === 'front' && main) side = fwdOf(main.yaw).multiplyScalar(0.85).addScaledVector(leftOf(main.yaw), 0.5).normalize();
    if (L.people.length > 2) cams.push(['Table', mid.clone().addScaledVector(side, 2.6).add(new V3(0, 0.9, 0)).addScaledVector(across, -0.4), mid.clone().add(new V3(0, -0.25, 0))]);
    cams.push(['Two-shot', mid.clone().addScaledVector(side, 2.2).add(new V3(0, 0.15, 0)), mid.clone()]);
    if (main) {
      const mH = main.at.clone().setY(main.how === 'seat' ? 1.15 : 1.55);
      cams.push([main.id === 'captain' ? 'Them' : C.ROSTER[main.id].short, capH.clone().addScaledVector(across, -0.55).addScaledVector(side, 0.35).add(new V3(0, 0.08, 0)), mH]);
      cams.push(['You', mH.clone().addScaledVector(across, 0.55).addScaledVector(side, 0.35).add(new V3(0, 0.08, 0)), capH]);
      cams.push(['Room', mid.clone().addScaledVector(side, 3.4).addScaledVector(across, -1.2).add(new V3(0, 1.4, 0)), mid.clone().add(new V3(0, -0.4, 0))]);
    } else {
      // (alone: the Captain from in front, three-quarter, and the room round them)
      const f = fwdOf(L.cap.yaw), l = leftOf(L.cap.yaw), low = L.cap.how === 'seat' ? -0.15 : 0;
      cams.length = 0;
      cams.push(['You', capH.clone().addScaledVector(f, 1.7).addScaledVector(l, 0.75).add(new V3(0, 0.05 + low, 0)), capH.clone().add(new V3(0, -0.12, 0))]);
      cams.push(['Close', capH.clone().addScaledVector(f, 0.95).addScaledVector(l, -0.35).add(new V3(0, 0.02, 0)), capH.clone().add(new V3(0, 0.02, 0))]);
      cams.push(['Room', capH.clone().addScaledVector(f, 2.9).addScaledVector(l, -1.1).add(new V3(0, 0.75, 0)), capH.clone().addScaledVector(f, 0.4).add(new V3(0, -0.5, 0))]);
    }
  }
  if (L.cams) { cams.length = 0; for (const c of L.cams) cams.push(c); }
  function camera(i, ms) { st.cam = ((i % cams.length) + cams.length) % cams.length; const [, p, l] = cams[st.cam]; stage.go(p.clone(), l.clone(), ms == null ? 900 : ms); return cams[st.cam][0]; }
  // (a wall the camera's come through goes, with all that's on it, as in a correction: drawn on a layer the camera doesn't see, its shadow
  // still cast)
  const HIDDEN = 1, hid = new Map();
  bay.group.traverse(x => { if (x.isLight && x.shadow) x.shadow.camera.layers.enable(HIDDEN); });
  const setHidden = (x, h) => { if ((hid.get(x) || false) === h) return; hid.set(x, h); x.traverse(m => { if (m.isMesh || m.isLine || m.isPoints || m.isSprite) m.layers.set(h ? HIDDEN : 0); }); };
  function occlude() {
    if (!bay.sideOf || !bay.sidesAt) return;
    const sides = bay.sidesAt(stage.camera.position);
    for (const x of bay.group.children) { const sd = bay.sideOf.get(x); if (sd) setHidden(x, sides.has(sd)); }
  }
  function update(dt) { pose(dt); for (const Q of all) Q.f.tick(dt); occlude(); }
  const focus = id => { st.focus = id; };
  const expr = (id, e) => { const Q = all.find(q => q.id === id); if (Q && e) Q.f.setExpr(e); };
  function dispose() { for (const Q of all) scene.remove(Q.f.root); scene.remove(propG); for (const x of hid.keys()) setHidden(x, false); }
  pose(0); pose(0.001);
  return { captain, people, cams, st, update, focus, expr, camera, dispose };
}

root.Visit = { layout, create };
})(typeof window !== 'undefined' ? window : globalThis);
