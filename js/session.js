// Project Meridian — a correction, played (after Little Red’s Lessons' js/lap.js and js/correction.js). The Captain takes each crew member in the
// queue in hand in turn, in one of two positions: across the Captain's knee on the suit bench, or standing at the wall, gripping the rail with feet
// apart. Witnesses stand in the room; between turns those done wait in the corner (redlessons' way) or stand aside with the witnesses.
//
// The player runs it: runs of smacks begin and end on a toggle (not counted runs), at the pace and strength set; which side, and where on the seat;
// and soothing (the palm in slow circles) on the area chosen, between. The crew member's responses are scripted per character (js/lines.js). Consent:
// each has agreed their safe word; if it goes too far (js/pain.js's high, held bar), they call it, and it stops at once.
//
//   const ses = Session.create(stage, bay, { captain, queue: [{ id, sex, outfit }], witnesses: [...], position: 'otk' | 'wall', between: 'corner' | 'aside' })
//   ses.run(on) · ses.set({ pace, strength, side, area, soothe }) · ses.dress({ top, bottoms, under }) · ses.endTurn() · ses.camera(i)
//   ses.on(fn): 'say' { who, id, text }, 'hit' {…}, 'state', 'turn' { i, id }, 'word' { id }, 'turnEnd' { id, outcome, stats }, 'done' { results }
//   ses.update(dt) each frame; ses.aftercare(id) poses the two of them on the bench for the conversation.
(function (root) {
'use strict';
const THREE = root.THREE, Fg = root.Figure, V3 = THREE.Vector3, Q = THREE.Quaternion;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t, ease = x => x * x * (3 - 2 * x);
const spring = (w, z) => ({ x: 0, v: 0, w, z, to(t, dt) { this.v += (this.w * this.w * (t - this.x) - 2 * this.z * this.w * this.v) * dt; this.x += this.v * dt; return this.x; } });
const TIMES = { lift: 0.42, hold: 0.14, strike: 0.1, contact: 0.24, back: 0.4 };
const BANDS = ['composed', 'flinching', 'struggling', 'close to the edge of resistance', 'past the edge of resistance', 'too harsh'];
const FACE = ['wince', 'gritted', 'crying', 'crying'];
const AREAS = ['cheek', 'sitspot', 'thighs'];
// soothing works over all of them, both sides, in a slow round (from the Captain's side to the far one, down, and back)
const SOOTHE = ['cheekL', 'cheekR', 'sitspotR', 'sitspotL', 'thighsL', 'thighsR'];
const UP = new V3(0, 1, 0);
const yawQ = yaw => new Q().setFromAxisAngle(UP, yaw);

function create(stage, bay, opts) {
  const scene = stage.scene, C = root.Crew, S = root.Pain, L = root.Lines, A = root.GameAudio;
  const listeners = [], emit = (type, data) => listeners.forEach(f => f(type, data));
  const st = { running: false, pace: 1, strength: 1, side: 'alt', nextSide: 'R', area: 'cheek', soothe: false, position: opts.position || 'otk',
    between: opts.between || 'corner', turn: -1, swing: null, ended: false, word: false, t: 0, sound: opts.sound !== false, cam: 0, phase: 'turn', results: [] };

  // ── The cast ──
  const captain = Fg.make(C.captainSpec(opts.captain)); scene.add(captain.root);
  const people = [];
  const addPerson = (p, role) => {
    const f = Fg.make(C.figureSpec(p.id, p.sex, p.outfit)); scene.add(f.root);
    const r = C.ROSTER[p.id], pain = S.createPain(r.pain || {});
    const P = { id: p.id, sex: p.sex, f, role, pain, r, done: false, outcome: null, hits: 0, peak: 0, marks: 0, said: {}, bandSeen: 0, pitch: C.pitch(p.id, p.sex), spot: null };
    people.push(P); return P;
  };
  const queue = (opts.queue || []).map(p => addPerson(p, 'subject'));
  const witnesses = (opts.witnesses || []).map(p => addPerson(p, 'witness'));
  let cur = null;      // the one across the lap / at the rail now

  // ── Springs for the reactions: each driven toward a target and kicked by impulses as smacks land, so they snap and settle ──
  const J = { kick: 0, side: 'R', flick: 0, stamp: 0 };
  const sp = {}; for (const k of ['kick', 'kickO', 'lift', 'wrig', 'toe', 'fwd', 'stamp', 'flinch', 'arch', 'head', 'grip', 'raise', 'rebound']) sp[k] = spring(15, 0.5);
  sp.raise.w = 9; sp.raise.z = 0.9; sp.rebound.w = 30; sp.rebound.z = 0.35;
  const kickSp = (k, v) => { sp[k].v += v; };

  // ── Positions ──
  const bench = bay.spots.bench, wall = bay.spots.wall;
  // (the posing helpers, js/poses.js; seated, on the bench)
  const { sc, H, ankleY, setRoot, local, toWorldDir, W_, reach, legTo, footFlat, stand, arms } = root.Poses;
  const seat = (F, at, yaw, o) => root.Poses.seat(F, at, yaw, Object.assign({ seatY: bench.seatY }, o));

  // ── Placing the subject ──
  // The pelvis over the Captain's right thigh toward the knee, the belly over the left, the chest bending down past it and the hands braced on the
  // deck: in front of the bench, not over it (the body turned a little out into the room, head end first, so the arms hang clear of it).
  // The Captain sits at the bench's end turned 45° to their right, so their lap points off its corner and nothing of the subject's is over the
  // bench: the head end out to the Captain's left, the legs to their right.
  const OTK = { pitch: 0.0, yaw: 0, z: 0.3, seat: bench.at.clone().add(new V3(-0.08, 0, 0)), seatYaw: -Math.PI / 4 };
  let otkQ = null, otkH = new V3(), otkU = new V3(1, 0, 0), otkX = new V3(0, 0, -1);
  // the top of the Captain's thighs at a point (world), between hip and knee
  function lapAt(P) {
    const fwd = toWorldDir(captain, 0, 0, 1); let y = 0;
    for (const sd of ['L', 'R']) { const a = W_(captain, 'thigh' + sd), b = W_(captain, 'shin' + sd), t = clamp(P.clone().sub(a).dot(fwd) / (b.clone().sub(a).dot(fwd) || 1), 0, 1); y += lerp(a.y, b.y, t) / 2; }
    return y + 0.078 * sc(captain);
  }
  function placeOTK(P, flinch) {
    const F = P.f, s = sc(F), cs = sc(captain);
    // along the body toward the head (the Captain's left, turned out toward their knees by the yaw), tipped head-down; front to the deck; left
    // side toward the Captain
    const cl = toWorldDir(captain, 1, 0, 0), cf = toWorldDir(captain, 0, 0, 1);
    const p = OTK.pitch, u = cl.multiplyScalar(Math.cos(OTK.yaw)).addScaledVector(cf, Math.sin(OTK.yaw)).normalize(), X = new V3(u.z, 0, -u.x), Y = u.clone().multiplyScalar(Math.cos(p)).addScaledVector(UP, -Math.sin(p)), Z = new V3().crossVectors(X, Y);
    otkQ = new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); otkU.copy(u); otkX.copy(X);
    // the hips over the Captain's right thigh, a little past its middle; a flinch presses them down into the lap and away from the hand
    const at = local(captain, -0.1 * cs, 0, OTK.z * cs).addScaledVector(toWorldDir(captain, 1, 0, 0), 0.012 * flinch);
    const lap = Math.max(lapAt(at), lapAt(local(captain, 0.1 * cs, 0, OTK.z * cs)) - 0.01);
    otkH.set(at.x, lap + 0.115 * s * (0.9 + 0.2 * (P.r.body.fat + P.r.body.mass) / 2) - 0.012 * flinch, at.z);
    F.root.quaternion.copy(otkQ); F.root.position.copy(otkH).sub(new V3(0, H(F).hips * s, 0).applyQuaternion(otkQ)); F.root.updateMatrixWorld(true);
  }
  // How far the hand is raised, 0 … 1, by the swing's phase (for the shoulder and the torso turning into it).
  function raiseOf(sw) { if (!sw) return 0; const ph = swingPhase(sw); const at = x => (x === 'raised' ? 1 : 0); return lerp(at(ph.from), at(ph.to), ph.e); }
  // The Captain, for the position: seated on the bench (across the knee), or standing at the subject's left, a little behind (at the wall).
  function poseCaptain(dt) {
    const F = captain, rz = sp.raise.to(raiseOf(st.swing), dt);
    if (st.phase === 'after') { seat(F, bench.at, 0, { look: 0.05, lean: -0.02 }); return; }
    if (st.position === 'otk') {
      // leaning into it over the lap, turned a little to the right toward the seat, watching; the right shoulder lifts with the arm, the
      // torso turning a touch more into it, and leans in as the hand comes down
      seat(F, OTK.seat, OTK.seatYaw, { lean: 0.08 - 0.03 * rz, twist: -0.1 - 0.05 * rz, roll: 0.02 * rz, look: 0.45 - 0.08 * rz, headYaw: -0.25, headRoll: 0.05, spread: 0.03 });
    } else {
      // right beside them at their left, facing their side (turned a little toward the seat): hips level with theirs, feet planted wide either
      // side of their nearest foot, knees a little bent, leaning in; the left hand on their back, the right at the seat
      const hipZ = cur.f.bone.hips.position.z * sc(cur.f), at = local(cur.f, 0.44 * sc(cur.f), 0, hipZ + 0.04); at.y = 0;
      const face = toWorldDir(cur.f, -1, 0, -0.1).normalize(), yaw = Math.atan2(face.x, face.z);
      stand(F, at, yaw, { weight: 0.25, wide: 0.22, crouch: 0.22, lean: 0.34 - 0.08 * rz, look: 0.45, headYaw: 0.1, arms: null });
      F.bone.spine.rotation.y += 0.1 - 0.12 * rz; F.bone.chest.rotation.y += 0.06 - 0.08 * rz;
    }
    F.bone.clavR.rotation.z = -0.08 * rz; F.bone.clavR.rotation.y = 0.06 * rz;
    F.root.updateMatrixWorld(true);
  }

  // ── Whoever's not in the middle: witnesses and those waiting stand at the watch spots, turned to the scene; those done wait in the corner,
  // hands on their head, or stand aside. Each holds their arms their own way. ──
  const focus = () => (st.position === 'otk' ? bench.at.clone().setY(0.8) : wall.at.clone().setY(0.9));
  const HOLDS = ['fold', 'rest', 'clasp', 'rest', 'fold', 'clasp'];
  function poseOthers(t) {
    let w = 0;
    for (const P of people) {
      if (P === cur && st.phase === 'turn') continue;
      if (st.phase === 'after' && P === afterWith) continue;
      const F = P.f, i = people.indexOf(P);
      if (P.done && st.between === 'corner' && st.phase === 'turn') {
        // the first in the corner; any after, along the east bulkhead, facing it; feet together, hands on the head, the head bowed
        const c = bay.spots.corner, off = people.filter(x => x.done).indexOf(P);
        if (off === 0) stand(F, c.at, c.yaw, { weight: 0.3, wide: 0.08, look: 0.32 }); else stand(F, new V3(c.at.x + 0.04, 0, c.at.z - 0.85 * off), Math.PI / 2, { weight: 0.3, wide: 0.08, look: 0.32 });
        const head = W_(F, 'head'), side = toWorldDir(F, 1, 0, 0), fwd = toWorldDir(F, 0, 0, 1);
        for (const [sd, sx] of [['L', 1], ['R', -1]]) {
          reach(F, sd, head.clone().addScaledVector(UP, 0.15 * sc(F)).addScaledVector(side, sx * 0.045).addScaledVector(fwd, -0.01), side.clone().multiplyScalar(sx).addScaledVector(UP, -0.15).normalize(), UP.clone(), side.clone().multiplyScalar(-sx).addScaledVector(fwd, 0.3).normalize());
          F.grip(sd, 0.3, 0, 0.2);
        }
        F.setExpr(P.outcome === 'word' ? 'sad' : 'teary');
        continue;
      }
      const spot = bay.spots.watch[w++ % bay.spots.watch.length], f = focus();
      const waiting = !P.done && P.role === 'subject';
      stand(F, spot.at, Math.atan2(f.x - spot.at.x, f.z - spot.at.z), { weight: i % 2 ? 0.6 : -0.6, look: waiting ? 0.3 : 0.15, headYaw: 0.05 * Math.sin(i * 1.7) });
      arms(F, waiting ? 'clasp' : HOLDS[i % HOLDS.length]);
      if (P.done) F.setExpr(P.outcome === 'word' ? 'sad' : 'teary'); else F.setExpr(P.role === 'witness' ? 'concerned' : 'shy');
    }
  }

  // ── The subject's pose and reactions ──
  function poseSubject(dt) {
    const P = cur, F = P.f, d = clamp(P.pain.distress(), 0, 1.8), dd = Math.min(1, d), t = st.t, s = sc(F);
    const wr = Math.sin(t * 6.3) * 0.5 + Math.sin(t * 3.7) * 0.5, wrig = sp.wrig.to(wr * dd * (st.running ? 1 : 0.4), dt);
    const k = sp.kick.to(0, dt), ko = sp.kickO.to(0, dt), fl = sp.flinch.to(0, dt), ar = sp.arch.to(0, dt), hd = sp.head.to(0.15 * dd, dt);
    const g = sp.grip.to(0.25 + 0.75 * dd, dt);
    // past the edge, while it goes on, the legs keep going: a slow alternating kick
    const pedal = st.running && d > 0.95 ? Math.sin(t * 5.2) * 0.5 * clamp((d - 0.95) * 2, 0, 1) : 0;
    F.resetPose();
    if (st.position === 'otk') {
      placeOTK(P, fl);
      // over the left thigh the back rounds down toward the deck, the head up and turned to the room; on a smack the back arches and the head
      // comes up
      F.bone.hips.rotation.set(0.04 - 0.05 * ar, 0.07 * wrig, 0.04 * wrig + 0.04 * fl * (J.side === 'L' ? 1 : -1));
      F.bone.spine.rotation.set(0.04 - 0.08 * ar, 0, 0.02 * wrig); F.bone.chest.rotation.set(0.85 - 0.14 * ar, 0, 0);
      F.bone.neck.rotation.set(-0.7 - 0.4 * hd - 0.2 * ar, -0.7 + 0.1 * Math.sin(t * 1.7) * dd, -0.1);
      F.root.updateMatrixWorld(true);
      // legs: the toes on the deck beyond the bench's end, knees soft; a kick bends the knee on the side struck, the foot leaving the deck
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const kk = Math.max(0, (side === J.side ? k : ko) + 0.3 * dd * Math.max(0, sx * wrig) + (side === 'L' ? pedal : -pedal));
        const Wt = otkH.clone().addScaledVector(otkU, -(0.62 * s - 0.2 * kk)).addScaledVector(otkX, sx * (0.085 * s + 0.04 * kk)); Wt.y = 0.06 + 0.5 * kk;
        legTo(F, side, Wt, new V3(-0.15, -1, 0).normalize());
        F.bone['foot' + side].rotation.x = 1.0 - 0.35 * kk; F.bone['toe' + side].rotation.x = -0.6 + 0.3 * kk;
      }
      // the hands down to the deck, a little ahead of the shoulders and out to their sides, the elbows soft: braced flat on it where they reach
      // it, else hanging, the fingertips brushing it; on a smack they push and grip
      const lift = sp.lift.to(0, dt);
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const shd = W_(F, 'upperArm' + side), out = otkX.clone().multiplyScalar(sx), arm = (F.bone['foreArm' + side].position.length() + F.bone['hand' + side].position.length()) * s;
        const Wt = new V3(shd.x, 0, shd.z).addScaledVector(otkU, 0.1 * s + 0.02 * lift).addScaledVector(out, 0.05 * s); Wt.y = 0.032 + 0.02 * Math.max(0, lift);
        const short = clamp((Wt.distanceTo(shd) - arm * 0.97) / (0.08 * s), 0, 1);      // (0: it reaches the deck … 1: well short of it)
        const flat = otkU.clone().addScaledVector(out, 0.35).normalize(), hang = UP.clone().negate().addScaledVector(otkU, 0.35).normalize();
        const fingers = flat.clone().lerp(hang, short).normalize(), palm = new V3(0, -1, 0).lerp(otkU.clone().negate(), short).normalize();
        reach(F, side, Wt, out.clone().addScaledVector(otkU, -0.6).addScaledVector(UP, 0.3).normalize(), palm, fingers);
        F.grip(side, lerp(0.1 + 0.3 * g, 0.35 + 0.3 * g, short), 0.35 - 0.25 * g, 0.25);
      }
    } else {
      // bent well forward from the hips, back long, head down between the arms; a smack brings them up onto their toes, the hips driving toward
      // the bulkhead and the back straightening, the head coming up; now and then a foot comes off the deck
      setRoot(F, wall.at, wall.yaw);
      const toe = sp.toe.to(0, dt), fwd = Math.max(0, fl);
      F.bone.hips.position.set(0.012 * wrig, H(F).hips - 0.05 + 0.04 * toe, -0.1 + 0.07 * fwd);
      F.bone.hips.rotation.set(0.72 - 0.35 * fwd - 0.15 * ar, 0.05 * wrig, 0.05 * wrig);
      F.bone.spine.rotation.set(0.12 - 0.06 * ar, 0, 0.03 * wrig); F.bone.chest.rotation.set(0.06 - 0.08 * ar, 0, 0);
      F.bone.neck.rotation.set(0.25 - 0.7 * hd - 0.15 * ar, 0.1 * Math.sin(t * 1.3) * dd, 0);
      F.root.updateMatrixWorld(true);
      const stamp = sp.stamp.to(0, dt);
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const st_ = side === J.side ? Math.max(0, stamp) : 0, pd = side === 'L' ? Math.max(0, pedal) : Math.max(0, -pedal);
        const up = 0.03 * Math.max(0, toe) + 0.16 * st_ + 0.1 * pd;
        legTo(F, side, local(F, sx * 0.25, ankleY(F) + up, 0.0 - 0.1 * st_), toWorldDir(F, sx * 0.15, 0.1, 1).normalize());
        footFlat(F, side, toWorldDir(F, sx * 0.12, 0, 1).normalize(), clamp(toe * 1.2 + st_ + pd, 0, 1));
      }
      // the hands over the rail: palms down on it, the fingers wrapped over its far side, the wrists a hand's length back toward them
      const R = wall.rail, toWall = toWorldDir(F, 0, 0, 1), hk = sc(F);
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const fdir = toWall.clone().addScaledVector(UP, -0.25).normalize();
        const G = local(F, sx * 0.25 * s, 0, 0); G.set(R.x, R.y, G.z);
        const Wt = G.clone().addScaledVector(fdir, -0.07 * hk).addScaledVector(UP, 0.036);
        reach(F, side, Wt, toWorldDir(F, sx * 1, -0.6, -0.2).normalize(), UP.clone().negate().addScaledVector(toWall, 0.25).normalize(), fdir);
        F.grip(side, 0.72 + 0.2 * g, 0.05, 0.7);
      }
    }
    F.breath = 0.3 + 0.7 * dd;
    F.root.updateMatrixWorld(true);
  }

  // ── The Captain's hands ──
  const sv = { p: new V3(), n: new V3() };
  function spotOf(side, area) { return area + side; }
  function lift() { const S_ = cur.f.state; return S_.bottoms === 'up' ? 0.022 : S_.under === 'up' ? 0.01 : 0.004; }
  // the contact: palm flat on the spot, fingers running across the seat away from the Captain
  function contactFor(spotKey) {
    cur.f.surface(spotKey, sv, lift());
    const n = sv.n.clone(), away = st.position === 'otk' ? toWorldDir(captain, 0.15, 0, 1) : toWorldDir(cur.f, -1, 0.4, 0.2).normalize();
    const f = away.addScaledVector(n, -away.dot(n)).normalize();
    const W = sv.p.clone().addScaledVector(n, 0.016).addScaledVector(f, -0.085 * sc(captain));
    return { W, n, f, P: sv.p.clone() };
  }
  const handPose = { n: new V3(0, 1, 0), f: new V3(0, 0, 1), cock: 0 };
  function poseCaptainHands(dt) {
    const F = captain, sw = st.swing, cs = sc(F);
    // the left hand: across the knee, resting on the small of their back, the fingers on toward their hips and round the far side, the forearm
    // lying along their back (the elbow down on it, toward their shoulders); at the wall, the arm along their shoulders, the hand on the far one
    const back = W_(cur.f, 'spine'), bn = toWorldDir(cur.f, 0, 0, -1).normalize(), cloth = lift() * 0.6;
    if (st.position === 'otk') {
      const bk = cur.f.surface('back', { p: new V3(), n: new V3() }, cloth), far = otkX.clone().negate(), s_ = sc(cur.f);
      const fing = otkU.clone().negate().addScaledVector(far, 0.6); fing.addScaledVector(bk.n, -fing.dot(bk.n)).normalize();
      const palmAt = bk.p.clone().addScaledVector(otkU, -0.05 * s_).addScaledVector(far, 0.04 * s_).addScaledVector(bk.n, 0.016);
      const LW = palmAt.clone().addScaledVector(fing, -0.06 * cs);
      const elbowAt = bk.p.clone().addScaledVector(otkU, 0.22 * s_).addScaledVector(otkX, 0.03 * s_).addScaledVector(bk.n, 0.05), sh = W_(F, 'upperArmL');
      reach(F, 'L', LW, elbowAt.sub(sh.clone().lerp(LW, 0.5)).normalize(), bk.n.clone().negate(), fing);
      F.grip('L', 0.22, 0.15, 0.2);
    } else {
      // (the arm resting along their shoulders: the forearm across the top of their back, the hand on the far shoulder, the fingers over it)
      const sh = cur.f.surface('shoulderR', { p: new V3(), n: new V3() }, cloth), over = toWorldDir(cur.f, -1, 0, 0.35), fing = over.clone().addScaledVector(sh.n, -over.dot(sh.n)).normalize();
      reach(F, 'L', sh.p.clone().addScaledVector(sh.n, 0.014).addScaledVector(fing, -0.06 * cs), UP.clone().negate().addScaledVector(toWorldDir(cur.f, 0, 0, 1), 0.3).normalize(), sh.n.clone().negate(), fing);
      F.grip('L', 0.34, 0.1, 0.3);
    }
    // the right: by the swing, or soothing, or resting just above the seat
    const key = spotOf(sw ? sw.side : (st.side === 'alt' ? st.nextSide : st.side), st.area), c = contactFor(key);
    const sh = W_(F, 'upperArmR'), toSh = sh.clone().sub(c.W); toSh.addScaledVector(c.n, -toSh.dot(c.n)).normalize();
    // the elbow's place: low at the Captain's side, a little out and back (where it stays as the forearm swings up from it and down again).
    // Raised, the hand is a forearm's length above it, leaning a little toward the seat.
    const E0 = sh.clone().addScaledVector(UP, -0.21 * cs).addScaledVector(toWorldDir(F, -1, 0, 0), 0.08 * cs).addScaledVector(toWorldDir(F, 0, 0, -1), 0.03 * cs);
    const toSeat = c.W.clone().sub(E0); toSeat.y = 0; toSeat.normalize();
    const raised = E0.clone().addScaledVector(UP.clone().multiplyScalar(0.92).addScaledVector(toSeat, 0.4).normalize(), 0.27 * cs);
    const rest = c.W.clone().addScaledVector(c.n, 0.012 * cs);      // (between smacks the hand rests on the seat)
    let W = rest, cock = 0.05, curl = 0.06, phase = sw ? swingPhase(sw) : null;
    if (phase) {
      const at = x => (x === 'rest' ? rest : x === 'raised' ? raised : c.W), A_ = at(phase.from), B_ = at(phase.to);
      W = A_.clone().lerp(B_, phase.e); if (phase.arc) W.addScaledVector(c.n, 0.05 * Math.sin(Math.PI * phase.e)).addScaledVector(toSh, 0.04 * Math.sin(Math.PI * phase.e));
      // the wrist: cocked back raised, flat on the skin at contact; on the way down it stays cocked till the last moment, then snaps flat
      const ck = x => (x === 'raised' ? 0.85 : x === 'rest' ? 0.05 : 0), e2 = phase.from === 'raised' && phase.to === 'contact' ? Math.pow(phase.e, 2.5) : phase.e;
      cock = lerp(ck(phase.from), ck(phase.to), e2); curl = phase.to === 'contact' || phase.from === 'contact' ? 0.03 : 0.12;
      if (sw.phase === 'contact') W.addScaledVector(c.n, 0.012 * sp.rebound.x);      // (a little give, coming off the skin)
    } else if (st.soothe) {
      // slow circles over every place a smack can land: each cheek, each sit spot, each thigh in turn, gliding from one to the next
      const n_ = SOOTHE.length, k = st.t / 2.2, i = Math.floor(k) % n_, fr = k - Math.floor(k), glide = ease(clamp((fr - 0.72) / 0.28, 0, 1));
      const ca = contactFor(SOOTHE[i]), cb = glide > 0 ? contactFor(SOOTHE[(i + 1) % n_]) : ca;
      const c2 = { W: ca.W.clone().lerp(cb.W, glide), n: ca.n.clone().lerp(cb.n, glide).normalize(), f: ca.f.clone().lerp(cb.f, glide).normalize() };
      const a = st.t * 2.1, tang = new V3().crossVectors(c2.n, c2.f).normalize(), r = 0.03 * (1 - glide);
      W = c2.W.clone().addScaledVector(c2.f, r * Math.cos(a)).addScaledVector(tang, r * Math.sin(a)).addScaledVector(c2.n, -0.004);
      handPose.n.lerp(c2.n, 0.25); handPose.f.lerp(c2.f, 0.25); cock = 0; curl = 0.06;
    }
    if (!st.soothe || sw) { handPose.n.lerp(c.n, 0.5); handPose.f.lerp(c.f, 0.5); }
    handPose.cock = lerp(handPose.cock, cock, sw ? 1 : 0.15);
    // the hand's frame: fingers along the skin, cocked back toward the normal by the wrist
    const n = handPose.n.clone().normalize(), f = handPose.f.clone().addScaledVector(n, -handPose.f.dot(n)).normalize(), a = handPose.cock;
    const fC = f.clone().multiplyScalar(Math.cos(a)).addScaledVector(n, Math.sin(a)), nC = n.clone().multiplyScalar(Math.cos(a)).addScaledVector(f, -Math.sin(a));
    // the elbow bends toward its place, so it stays low and back at their side all through the swing
    const pole = E0.clone().sub(sh.clone().lerp(W, 0.5)).normalize();
    reach(F, 'R', W, pole, nC.negate(), fC);
    F.grip('R', curl, 0.12, 0.1);
  }

  // ── Smacks ──
  const canStrike = () => cur && st.phase === 'turn' && !st.word && !cur.pain.tooHarsh;
  function pickSide() { const s = st.side === 'alt' ? st.nextSide : st.side; if (st.side === 'alt') st.nextSide = st.nextSide === 'R' ? 'L' : 'R'; return s; }
  function startSwing() { if (!canStrike() || st.swing) return false; st.swing = { phase: 'lift', t: 0, side: pickSide(), waited: 0 }; return true; }
  const cushion = () => { const S_ = cur.f.state, c = S.PAIN.CUSHION; let left = 1; if (S_.bottoms === 'up') left *= 1 - (c.trousers || 0.4); if (S_.under === 'up' && st.area !== 'thighs') left *= 1 - (c.briefs || 0.12); return 1 - left; };
  function impact(sw) {
    const P = cur, key = spotOf(sw.side, st.area), tender = P.f.spot[key].mark;
    const hit = P.pain.hit({ implement: 'hand', strength: st.strength, speed: st.pace, raised: sw.waited, tender, cushion: cushion() });
    P.f.mark(key, 0.032 * st.strength * (1 - 0.6 * cushion())); for (const a of AREAS) if (a !== st.area) P.f.mark(a + sw.side, 0.005 * st.strength);
    P.hits++; P.peak = Math.max(P.peak, P.pain.distress());
    J.side = sw.side; J.flick = 0.45;
    const r = hit.reaction;
    P.f.impact(sw.side, r * (0.6 + 0.4 * st.strength) * (cushion() > 0.3 ? 0.4 : 1));
    kickSp('kick', 9 * r); kickSp('kickO', 3 * r * Math.random()); kickSp('flinch', 6 * r); kickSp('arch', 5 * r); kickSp('head', 6 * r); kickSp('lift', 4 * r);
    kickSp('toe', 5 * r); kickSp('rebound', 6); kickSp('grip', 3 * r);
    if (r > 0.55 && bandIndex() >= 2 && Math.random() < 0.45) kickSp('stamp', 9 * r);
    if (st.sound && A && A.ctx) { A.thwack(hit.reaction, cushion() > 0.3); A.voice(hit.reaction, bandIndex(), false, 0.9, P.pitch); }
    emit('hit', { hit, side: sw.side, area: st.area, distress: P.pain.distress(), band: BANDS[bandIndex()], hits: P.hits });
    scripted();
  }
  function swingPhase(sw) {
    const k = x => clamp(sw.t / x, 0, 1);
    switch (sw.phase) {
      case 'lift': return { from: 'rest', to: 'raised', e: ease(k(TIMES.lift)), arc: true };
      case 'hold': return { from: 'raised', to: 'raised', e: 1 };
      case 'strike': { const x = k(TIMES.strike); return { from: 'raised', to: 'contact', e: x * x }; }
      case 'contact': return { from: 'contact', to: 'contact', e: 1 };
      case 'rise': return { from: 'contact', to: 'raised', e: ease(k(TIMES.lift)), arc: true };
      case 'back': return { from: 'contact', to: 'rest', e: ease(k(TIMES.back)) };
    }
  }
  function advance(dt) {
    const sw = st.swing; if (!sw) { if (st.running && canStrike()) startSwing(); return; }
    sw.t += dt * st.pace;
    const go = ph => { sw.phase = ph; sw.t = 0; };
    switch (sw.phase) {
      case 'lift': if (sw.t >= TIMES.lift) go('hold'); break;
      case 'hold': sw.waited = sw.t; if (sw.t >= TIMES.hold) go(canStrike() ? 'strike' : 'back'); break;
      case 'strike': if (sw.t >= TIMES.strike) { go('contact'); impact(sw); } break;
      case 'contact': if (sw.t >= TIMES.contact) { if (st.running && canStrike()) { sw.side = pickSide(); sw.waited = 0; go('rise'); } else go('back'); } break;
      case 'rise': if (sw.t >= TIMES.lift) go('hold'); break;
      case 'back': if (sw.t >= TIMES.back) st.swing = null; break;
    }
  }
  const bandIndex = () => { const d = cur.pain.distress(); return d < 0.3 ? 0 : d < 0.6 ? 1 : d < 0.9 ? 2 : d < 1 ? 3 : d < S.PAIN.TOO_HARSH ? 4 : 5; };

  // ── Their words: scripted by character, as the correction goes ──
  let sayCool = 0;
  function say(who, text, P) { if (!text) return; emit('say', { who, id: P ? P.id : 'captain', text }); sayCool = 2.2; }
  function scripted() {
    const P = cur, b = bandIndex();
    if (P.hits === 1 && !P.said.first) { P.said.first = 1; say('subject', L.react(P.id, 'first'), P); return; }
    const keys = [null, 'flinching', 'struggling', 'edge', 'past'];
    if (b > P.bandSeen && b <= 4) { P.bandSeen = b; if (keys[b] && !P.said[keys[b]]) { P.said[keys[b]] = 1; say('subject', L.react(P.id, keys[b]), P); return; } }
    if (b >= 2 && sayCool <= 0 && Math.random() < 0.12) say('subject', L.react(P.id, 'plead'), P);
  }

  // ── Turns ──
  let afterWith = null;
  function beginTurn(i) {
    st.turn = i; cur = queue[i]; st.word = false; st.swing = null; st.running = false; st.soothe = false; st.phase = 'turn';
    J.kick = 0; J.stamp = 0; for (const k in sp) { sp[k].x = 0; sp[k].v = 0; }
    cur.f.setClothes({ top: 'down', bottoms: 'up', under: 'up' }); cur.f.setExpr(cur.r.base || 'calm');
    emit('turn', { i, id: cur.id }); emit('state');
    setTimeout(() => { say('captain', L.place(cur.id, st.position)); setTimeout(() => say('subject', L.react(cur.id, 'start'), cur), 1600); }, 300);
  }
  function endTurn(outcome) {
    if (!cur || st.phase !== 'turn') return;
    const P = cur; st.running = false; st.soothe = false;
    P.outcome = outcome || 'done'; P.done = true;
    if (P.outcome === 'done') say('subject', L.react(P.id, 'end'), P);
    const res = { id: P.id, outcome: P.outcome, hits: P.hits, peak: P.peak, band: BANDS[Math.min(5, P.peak < 0.3 ? 0 : P.peak < 0.6 ? 1 : P.peak < 0.9 ? 2 : P.peak < 1 ? 3 : P.peak < S.PAIN.TOO_HARSH ? 4 : 5)], position: st.position };
    st.results.push(res); emit('turnEnd', res);
    st.phase = 'between';
    setTimeout(() => {
      P.f.setClothes({ top: 'down', bottoms: 'up', under: 'up' });
      const next = queue.findIndex(x => !x.done);
      if (next >= 0) beginTurn(next); else { cur = null; st.phase = 'over'; emit('done', { results: st.results }); emit('state'); }
    }, outcome === 'word' ? 3200 : 2400);
  }
  function callWord() {
    if (!cur || st.word) return;
    st.word = true; st.running = false; st.soothe = false; emit('word', { id: cur.id, word: cur.r.word });
    say('subject', L.react(cur.id, 'word'), cur); cur.f.setExpr('crying');
    setTimeout(() => endTurn('word'), 900);
  }

  // ── Aftercare: the two of them sat on the bench, side by side, the crew member turned a little to the Captain ──
  function aftercare(id) {
    st.phase = 'after'; afterWith = people.find(p => p.id === id); cur = afterWith;
    afterWith.f.setClothes({ top: 'down', bottoms: 'up', under: 'up' }); emit('state');
  }

  // ── Cameras ──
  const CAMS = {
    // (across the knee: placed in the Captain's own frame (x to their left, z ahead of them) from where they sit, and kept inside the bay's walls)
    otk: [['Side', [0.05, 1.2, 2.4], [0.05, 0.76, 0.3]], ['Behind', [-1.4, 1.3, 0.67], [-0.05, 0.72, 0.3]], ['Seat', [-0.46, 1.5, 1.07], [-0.1, 0.82, 0.35]],
      ['Their face', [0.42, 0.36, 1.05], [0.24, 0.55, 0.36]], ['Captain', [0.3, 0.92, 0.95], [0.0, 1.18, 0.1]], ['Room', [1.5, 1.9, 1.5], [0.0, 0.7, 0.25]]]
      .map(([n, p, l]) => [n, ...[p, l].map(v => { const q = new V3(v[0], 0, v[2]).applyAxisAngle(UP, OTK.seatYaw).add(OTK.seat); return [clamp(q.x, -2.4, 2.4), v[1], clamp(q.z, -2.0, 2.0)]; })]),
    wall: [['Side', [-1.7, 1.4, -0.95], [-1.85, 1.0, 1.05]], ['Behind', [-0.5, 1.2, 0.6], [-1.9, 0.85, 0.95]], ['Seat', [-1.0, 1.25, 0.4], [-1.75, 0.88, 0.95]],
      ['Their face', [-2.45, 1.05, 0.25], [-2.25, 1.2, 0.95]], ['Captain', [-1.5, 1.42, 0.55], [-1.68, 1.5, 1.38]], ['Room', [1.2, 1.9, 2.0], [-1.6, 0.8, 0.8]]],
    after: [['Two-shot', [0.3, 1.0, 1.75], [0.3, 0.85, 0.0]], ['Close', [0.55, 1.05, 1.1], [0.3, 0.95, 0.0]]],
  };
  function camera(i, ms) {
    const set = CAMS[st.phase === 'after' ? 'after' : st.position]; st.cam = ((i % set.length) + set.length) % set.length;
    const [, p, l] = set[st.cam]; stage.go(new V3(...p), new V3(...l), ms == null ? 900 : ms);
    return set[st.cam][0];
  }

  // ── Each frame ──
  function update(dt) {
    st.t += dt; sayCool -= dt;
    if (cur && st.phase === 'turn') {
      advance(dt);
      const onSkin = st.swing && st.swing.phase === 'contact';
      cur.pain.update(dt, onSkin); if (st.soothe && !st.swing) cur.pain.soothe(dt);
      if (cur.pain.tooHarsh && !st.word) callWord();
      // the face: their band, flickering one on as a smack lands
      J.flick -= dt; const b = bandIndex();
      if (!st.word) {
        let e = b === 0 ? (cur.r.base || 'calm') : FACE[Math.min(3, b - 1)];
        if (J.flick > 0) e = FACE[Math.min(3, b)];
        if (st.soothe && !st.swing && b <= 2) e = b === 0 ? 'shy' : 'teary';
        cur.f.setExpr(e);
      }
      if (st.soothe && !st.swing && !cur.said.soothe && sayCool <= 0) { cur.said.soothe = 1; say('subject', L.react(cur.id, 'soothe'), cur); }
    }
    if (cur && st.phase !== 'after' && st.phase !== 'over') { if (st.position === 'otk') { poseCaptain(dt); poseSubject(dt); } else { poseSubject(dt); poseCaptain(dt); } poseCaptainHands(dt); captain.setExpr(st.position === 'otk' || st.phase === 'turn' ? 'stern' : 'calm'); }
    else if (st.phase === 'after' && afterWith) {
      // sat side by side: they lean in, the head toward the Captain's shoulder, hands in their lap; the Captain's arm round them, the hand on
      // their far shoulder, the other hand on their own knee
      const G = afterWith.f;
      seat(captain, bench.at, 0, { look: 0.18, headYaw: 0.3, roll: -0.03, lean: 0.02 });
      seat(G, bench.beside.clone().add(new V3(-0.06, 0, 0.02)), -0.3, { look: 0.3, lean: 0.1, roll: 0.14, headRoll: 0.18, headYaw: -0.2, spread: -0.03 });
      for (const [sd, sx] of [['L', 1], ['R', -1]]) { const T = local(G, sx * 0.05, bench.seatY + 0.16, 0.24); reach(G, sd, T, toWorldDir(G, sx, -0.3, -0.4).normalize(), UP.clone().negate(), toWorldDir(G, -sx * 0.6, 0, 1).normalize()); G.grip(sd, 0.4, 0, 0.4); }
      const far = W_(G, 'clavL').add(toWorldDir(G, 0.06, 0.05, -0.02));
      reach(captain, 'L', far, new V3(0.1, 0.3, -1).normalize(), toWorldDir(G, 0.3, -1, 0).normalize(), toWorldDir(G, 0, 0, 1)); captain.grip('L', 0.35, 0.1, 0.3);
      reach(captain, 'R', local(captain, -0.13, bench.seatY + 0.17, 0.33), new V3(-1, 0, -0.3).normalize(), UP.clone().negate(), new V3(0, 0, 1)); captain.grip('R', 0.3, 0.1, 0.3);
      captain.setExpr('soft');
    } else { stand(captain, bench.at.clone().add(new V3(0.3, 0, 0.6)), 0, {}); }
    poseOthers(st.t);
    captain.tick(dt); for (const P of people) P.f.tick(dt);
    occlude();
  }

  // ── Whatever stands between the camera and the two in the middle (a fitting of the bay, someone watching) is hidden: moved to a layer the
  // camera doesn't draw, while still casting its shadow. What they're on (the bench, the rug, the deck) and the room's shell stay. ──
  const HIDDEN = 1;
  bay.group.traverse(o => { if (o.isLight && o.shadow) o.shadow.camera.layers.enable(HIDDEN); });
  const fittings = bay.group.children.filter(o => !o.isLight).map(o => ({ o, box: new THREE.Box3().setFromObject(o) }))
    .filter(({ box }) => !box.isEmpty() && box.max.y > 0.62 && [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z].filter(d => d > 2.5).length < 2);
  const hiddenNow = new Map();
  function setHidden(o, h) {
    if (hiddenNow.get(o) === h) return; hiddenNow.set(o, h);
    o.traverse(m => { if (m.isMesh || m.isLine || m.isPoints || m.isSprite) m.layers.set(h ? HIDDEN : 0); });
  }
  const _ray = new THREE.Ray(), _hit = new V3(), _box = new THREE.Box3();
  function occlude() {
    const cam = stage.camera.position, focus = [];
    const add = (F, bones) => { if (F) for (const b of bones) focus.push(W_(F, b)); };
    if (st.phase === 'after' && afterWith) add(afterWith.f, ['hips', 'chest', 'head']); else if (cur && st.phase === 'turn') add(cur.f, ['hips', 'chest', 'head', 'shinL']);
    if (focus.length) add(captain, ['hips', 'chest', 'head']);
    const blocks = box => focus.length && (box.containsPoint(cam) || focus.some(t => { const d = t.distanceTo(cam); _ray.set(cam, t.clone().sub(cam).divideScalar(d)); return _ray.intersectBox(box, _hit) && _hit.distanceTo(cam) < d - 0.05; }));
    for (const f of fittings) setHidden(f.o, blocks(f.box));
    // (people: a box round where their bones are now)
    for (const P of people) {
      if (P === cur || (st.phase === 'after' && P === afterWith)) { setHidden(P.f.root, false); continue; }
      _box.makeEmpty(); for (const b of ['head', 'handL', 'handR', 'footL', 'footR', 'hips']) _box.expandByPoint(W_(P.f, b)); _box.expandByScalar(0.1);
      setHidden(P.f.root, blocks(_box));
    }
  }

  const api = {
    st, captain, people, queue, witnesses, BANDS, AREAS, CAMS, bench,
    get current() { return cur; },
    on: fn => listeners.push(fn),
    start() { beginTurn(0); camera(0, 0); },
    run(on) { if (!canStrike()) { st.running = false; emit('state'); return; } st.running = on == null ? !st.running : !!on; if (st.running) st.soothe = false; emit('state'); },
    set(o) { Object.assign(st, o); if (o.soothe) st.running = false; emit('state'); },
    position(p) { if (st.position === p) return; st.position = p; st.swing = null; st.running = false; if (cur) { say('captain', L.place(cur.id, p)); } camera(0); emit('state'); },
    dress(o) { if (cur) { cur.f.setClothes(o); emit('state'); } },
    endTurn: () => endTurn('done'), callWord, camera, aftercare, update,
    distress: () => (cur ? cur.pain.distress() : 0), band: () => (cur ? BANDS[bandIndex()] : ''), harshAt: S.PAIN.TOO_HARSH,
  };
  return api;
}

root.Session = { create };
})(typeof window !== 'undefined' ? window : globalThis);
