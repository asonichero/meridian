// Project Meridian — posing a figure (js/figure.js): standing planted, how the arms are held, seated, and the hands and feet placed by IK. Used by the
// correction (js/session.js) and the figure viewer (figures.html). Positions are in the world; each figure's own heights (pelvis, ankle, seat) come
// from F.H, so the Blender-built bodies and the ones built in code pose alike.
//
//   Poses.stand(F, at, yaw, { weight, wide, crouch, lean, look, headYaw, stagger, arms }) · Poses.arms(F, 'fold' | 'rest' | 'clasp' | 'head')
//   Poses.seat(F, at, yaw, { seatY, lean, twist, roll, look, … }) · Poses.bend(F, at, yaw, rail) · Poses.reach(F, side, W, pole, palm, fingers)
(function (root) {
'use strict';
const THREE = root.THREE, Fg = root.Figure, V3 = THREE.Vector3, Q = THREE.Quaternion;
const UP = new V3(0, 1, 0);
const yawQ = yaw => new Q().setFromAxisAngle(UP, yaw);

const sc = F => F.root.scale.x;
// (each figure's own heights, in its own units: the pelvis, the ankle, the pelvis over a seat; and how far out its arms hang at rest)
const H = F => F.H || { hips: 0.95, ankle: 0.08, sit: 0.13, abd: 0 }, ankleY = F => H(F).ankle * sc(F) + 0.005;
const setRoot = (F, pos, yaw) => { F.root.position.copy(pos); F.root.quaternion.copy(yawQ(yaw)); F.root.updateMatrixWorld(true); };
const local = (F, x, y, z) => new V3(x, y, z).applyQuaternion(F.root.quaternion).add(F.root.position);
const toWorldDir = (F, x, y, z) => new V3(x, y, z).applyQuaternion(F.root.quaternion);
const W_ = (F, b) => F.bone[b].getWorldPosition(new V3());
// An arm's hand to a point, the elbow bending toward `pole`, the hand turned so its palm faces `palm` and the fingers run along `fingers`.
function reach(F, side, W, pole, palm, fingers) {
  Fg.ik2(F, F.bone['upperArm' + side], F.bone['foreArm' + side], F.bone['hand' + side], W, pole, -1);
  if (palm) Fg.aim(F.bone['hand' + side], side === 'R' ? palm.clone() : palm.clone().negate(), fingers.clone().negate());
  F.root.updateMatrixWorld(true);
}
function legTo(F, side, W, pole) { Fg.ik2(F, F.bone['thigh' + side], F.bone['shin' + side], F.bone['foot' + side], W, pole, 1); F.root.updateMatrixWorld(true); }
// A foot flat on the deck, its toes along `fwd` (world), heel lifted by `heel` (0 flat … 1 up on the toes).
function footFlat(F, side, fwd, heel) {
  const x = new V3().crossVectors(UP, fwd).normalize();
  Fg.aim(F.bone['foot' + side], x, UP.clone().applyAxisAngle(x, 0.9 * (heel || 0)));
  F.bone['toe' + side].rotation.x = -0.9 * (heel || 0);
  F.root.updateMatrixWorld(true);
}
// Standing, planted: the weight on one leg (contrapposto: that hip up and out, the other knee easy, the shoulders tilted back against it), feet set
// where they stand, the arms relaxed. o: { weight (−1 … 1), wide (stance), crouch (knees), lean (forward, at the waist), look (head down), arms: null to leave them }
function stand(F, at, yaw, o) {
  o = o || {}; F.resetPose(); setRoot(F, at, yaw);
  const w = o.weight == null ? 0.6 : o.weight, wide = o.wide == null ? 0.11 : o.wide, cr = o.crouch || 0, s = sc(F);
  F.bone.hips.position.x = 0.022 * w; F.bone.hips.position.y = H(F).hips - 0.006 * Math.abs(w) - 0.14 * cr; F.bone.hips.position.z = -0.06 * cr;
  F.bone.hips.rotation.set(0.3 * cr, 0.04 * w, -0.05 * w);
  F.bone.spine.rotation.set(0.02 + (o.lean || 0) * 0.6, -0.03 * w, 0.035 * w); F.bone.chest.rotation.set((o.lean || 0) * 0.4, -0.02 * w, 0.025 * w);
  F.bone.neck.rotation.set(o.look == null ? 0.08 : o.look, o.headYaw || 0, -0.02 * w);
  F.root.updateMatrixWorld(true);
  const fwd = toWorldDir(F, 0, 0, 1);
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const free = (sx > 0) !== (w > 0), out = free ? 0.025 : 0;
    const A = local(F, sx * (wide + out), ankleY(F), (free ? 0.05 : 0) + (o.stagger ? o.stagger * sx : 0));
    legTo(F, side, A, toWorldDir(F, sx * 0.15, 0, 1).normalize());
    footFlat(F, side, toWorldDir(F, sx * (free ? 0.25 : 0.1), 0, 1).normalize(), 0);
  }
  if (o.arms !== null) { for (const [side, sx] of [['L', 1], ['R', -1]]) { F.bone['upperArm' + side].rotation.set(0.04, 0, sx * (0.09 - H(F).abd)); F.bone['foreArm' + side].rotation.x = -0.22; F.bone['hand' + side].rotation.set(0, sx * 0.25, 0); F.grip(side, 0.32, 0.1, 0.3); } }
  F.root.updateMatrixWorld(true);
}
// How someone waiting holds their arms: folded across the chest, at parade rest (clasped behind), or clasped in front.
function arms(F, how) {
  const chest = W_(F, 'chest'), fwd = toWorldDir(F, 0, 0, 1), side = toWorldDir(F, 1, 0, 0), s = sc(F);
  if (how === 'fold') {
    // the forearms crossed in front of the chest, each hand tucked toward the other arm, the elbows a little out
    for (const [sd, sx] of [['L', 1], ['R', -1]]) {
      const T = chest.clone().addScaledVector(fwd, 0.19 * s).addScaledVector(UP, (sx > 0 ? -0.05 : -0.025) * s).addScaledVector(side, -sx * 0.12 * s);
      reach(F, sd, T, side.clone().multiplyScalar(sx).addScaledVector(UP, -0.5).normalize(), side.clone().multiplyScalar(sx).addScaledVector(fwd, 0.5).normalize(), side.clone().multiplyScalar(-sx));
      F.grip(sd, 0.5, 0, 0.5);
    }
  } else if (how === 'rest') {
    const hip = W_(F, 'hips');
    for (const [sd, sx] of [['L', 1], ['R', -1]]) reach(F, sd, hip.clone().addScaledVector(fwd, -0.17 * s).addScaledVector(side, sx * 0.02 * s).addScaledVector(UP, 0.02), side.clone().multiplyScalar(sx).addScaledVector(fwd, -0.4).normalize(), fwd.clone().negate().addScaledVector(side, -sx * 0.6).normalize().negate(), UP.clone().negate().addScaledVector(side, -sx * 0.5).normalize());
    F.grip('L', 0.55, 0, 0.4); F.grip('R', 0.4, 0, 0.6);
  } else if (how === 'clasp') {
    const hip = W_(F, 'hips');
    for (const [sd, sx] of [['L', 1], ['R', -1]]) reach(F, sd, hip.clone().addScaledVector(fwd, 0.15 * s).addScaledVector(side, sx * 0.025 * s).addScaledVector(UP, -0.06 * s), side.clone().multiplyScalar(sx).addScaledVector(fwd, -0.3).normalize(), side.clone().multiplyScalar(-sx), UP.clone().negate().addScaledVector(fwd, 0.4).normalize());
    F.grip('L', 0.45, 0, 0.5); F.grip('R', 0.5, 0, 0.5);
  }
}
// Seated: hips on the seat (o.seatY high), thighs forward, feet planted on the deck.
function seat(F, at, yaw, o) {
  o = o || {}; F.resetPose(); setRoot(F, at, yaw);
  const s = sc(F);
  F.bone.hips.position.y = ((o.seatY == null ? 0.46 : o.seatY) + H(F).sit * s) / s; F.bone.hips.position.z = -0.03 / s; F.bone.hips.rotation.x = -0.08 + (o.tilt || 0);
  F.bone.spine.rotation.set(0.06 + (o.lean || 0), o.twist || 0, o.roll || 0); F.bone.chest.rotation.set(0.04 + (o.lean || 0) * 0.5, (o.twist || 0) * 0.6, (o.roll || 0) * 0.5);
  F.bone.neck.rotation.set(o.look == null ? 0.12 : o.look, o.headYaw || 0, o.headRoll || 0);
  F.root.updateMatrixWorld(true);
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const ank = local(F, sx * (0.14 + (o.spread || 0)), ankleY(F), 0.43 + (o.feetZ || 0) + (sx > 0 ? 0.03 : -0.02));
    legTo(F, side, ank, toWorldDir(F, sx * 0.1, 0.5, 1).normalize());
    footFlat(F, side, toWorldDir(F, sx * 0.15, 0, 1).normalize(), 0);
  }
  for (const [side, sx] of [['L', 1], ['R', -1]]) { F.bone['upperArm' + side].rotation.set(-0.25, 0, sx * (0.1 - H(F).abd)); F.bone['foreArm' + side].rotation.x = -0.9; F.grip(side, 0.35, 0.1, 0.3); }
  F.root.updateMatrixWorld(true);
}

// Hands on the head (waiting in the corner): fingers laced over the crown, elbows out.
function handsOnHead(F) {
  const head = W_(F, 'head'), side = toWorldDir(F, 1, 0, 0), fwd = toWorldDir(F, 0, 0, 1);
  for (const [sd, sx] of [['L', 1], ['R', -1]]) {
    reach(F, sd, head.clone().addScaledVector(UP, 0.15 * sc(F)).addScaledVector(side, sx * 0.045).addScaledVector(fwd, -0.01), side.clone().multiplyScalar(sx).addScaledVector(UP, -0.15).normalize(), UP.clone(), side.clone().multiplyScalar(-sx).addScaledVector(fwd, 0.3).normalize());
    F.grip(sd, 0.3, 0, 0.2);
  }
}
const _arms = arms;
function armsHow(F, how) { if (how === 'head') handsOnHead(F); else _arms(F, how); }
// Bent forward from the hips with a long back, gripping a rail ({ x, y, z } in front of them, running across), feet apart (as at the wall).
function bend(F, at, yaw, rail) {
  F.resetPose(); setRoot(F, at, yaw);
  const s = sc(F);
  F.bone.hips.position.set(0, H(F).hips - 0.05, -0.1);
  F.bone.hips.rotation.set(0.72, 0, 0); F.bone.spine.rotation.set(0.12, 0, 0); F.bone.chest.rotation.set(0.06, 0, 0); F.bone.neck.rotation.set(0.25, 0, 0);
  F.root.updateMatrixWorld(true);
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    legTo(F, side, local(F, sx * 0.25, ankleY(F), 0), toWorldDir(F, sx * 0.15, 0.1, 1).normalize());
    footFlat(F, side, toWorldDir(F, sx * 0.12, 0, 1).normalize(), 0);
  }
  const toWall = toWorldDir(F, 0, 0, 1), hk = s;
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const fdir = toWall.clone().addScaledVector(UP, -0.25).normalize(), G = local(F, sx * 0.25 * s, 0, 0); G.y = rail.y;
    const along = toWall.clone(); G.addScaledVector(along, (rail.d == null ? 0.62 : rail.d) * s);
    const Wt = G.clone().addScaledVector(fdir, -0.07 * hk).addScaledVector(UP, 0.036);
    reach(F, side, Wt, toWorldDir(F, sx, -0.6, -0.2).normalize(), UP.clone().negate().addScaledVector(toWall, 0.25).normalize(), fdir);
    F.grip(side, 0.8, 0.05, 0.7);
  }
  F.root.updateMatrixWorld(true);
}

root.Poses = { UP, yawQ, sc, H, ankleY, setRoot, local, toWorldDir, W_, reach, legTo, footFlat, stand, arms: armsHow, seat, bend };
})(typeof window !== 'undefined' ? window : globalThis);
