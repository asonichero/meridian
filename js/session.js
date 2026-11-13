// Project Meridian — a correction, played (after Little Red’s Lessons' js/lap.js and js/correction.js). The Captain takes each crew member in the
// queue in hand in turn, in one of two positions: across the Captain's knee on the suit bench, or standing at the wall, gripping the rail with feet
// apart. Witnesses stand in the room; between turns those done wait in the corner (redlessons' way) or stand aside with the witnesses.
//
// The player runs it: runs of smacks begin and end on a toggle (not counted runs), at the pace and strength set; which side, and where on the seat;
// and soothing (the palm in slow circles) on the area chosen, between. The crew member's responses are scripted per character (js/lines.js). Consent:
// each has agreed their safe word; if it goes too far (js/pain.js's high, held bar), they call it, and it stops at once.
//
//   const ses = Session.create(stage, bay, { captain, queue: [{ id, sex, outfit }], witnesses: [...], position: 'otk' | 'wall', between: 'corner' | 'aside' })
//   ses.run(on) · ses.set({ pace, strength, side, area, soothe, sootheArea }) · ses.dress({ top, bottoms, under }) · ses.endTurn() · ses.camera(i)
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
const AREAS = ['upper', 'centre', 'sitspot', 'thighs'];
const UP = new V3(0, 1, 0);
const yawQ = yaw => new Q().setFromAxisAngle(UP, yaw);

function create(stage, bay, opts) {
  const scene = stage.scene, C = root.Crew, S = root.Pain, L = root.Lines, A = root.GameAudio;
  const listeners = [], emit = (type, data) => listeners.forEach(f => f(type, data));
  const st = { running: false, pace: 1, strength: 1, side: 'alt', nextSide: 'R', area: 'centre', soothe: false, sootheArea: 'seat', position: opts.position || 'otk',
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

  // ── Springs for the reactions ──
  const J = { kick: 0, side: 'R', flick: 0, stamp: 0 };
  const sp = {}; for (const k of ['kick', 'lift', 'wrig', 'toe', 'fwd', 'stamp', 'hx', 'grip']) sp[k] = spring(14, 0.55);

  // ── Positions ──
  const bench = bay.spots.bench, wall = bay.spots.wall;
  const sc = F => F.root.scale.x;
  const setRoot = (F, pos, yaw) => { F.root.position.copy(pos); F.root.quaternion.copy(yawQ(yaw)); };
  const local = (F, x, y, z) => new V3(x, y, z).applyQuaternion(F.root.quaternion).add(F.root.position);
  const toWorldDir = (F, x, y, z) => new V3(x, y, z).applyQuaternion(F.root.quaternion);
  // A standing idle: weight easing from foot to foot, a little sway, the arms at rest.
  function stand(F, t, o) {
    o = o || {};
    F.resetPose();
    const w = Math.sin(t * 0.5 + (F.phase || (F.phase = Math.random() * 6))) * 0.5;
    F.bone.hips.position.x = 0.012 * w; F.bone.hips.rotation.z = 0.025 * w; F.bone.spine.rotation.z = -0.02 * w;
    F.bone.upperArmL.rotation.z = 0.1; F.bone.upperArmR.rotation.z = -0.1; F.bone.foreArmL.rotation.x = -0.12; F.bone.foreArmR.rotation.x = -0.12;
    F.bone.thighL.rotation.z = -0.025 * w; F.bone.thighR.rotation.z = -0.025 * w;
    F.bone.neck.rotation.x = o.look == null ? 0.06 : o.look;
    if (o.headYaw) F.bone.neck.rotation.y = o.headYaw;
  }
  // Seated on the bench: hips on the seat, thighs forward, feet on the deck.
  function seat(F, at, yaw, o) {
    o = o || {}; F.resetPose(); setRoot(F, at, yaw); F.root.updateMatrixWorld(true);
    const s = sc(F);
    F.bone.hips.position.y = (bench.seatY + 0.13) / s; F.bone.hips.position.z = -0.03 / s; F.bone.hips.rotation.x = -0.05;
    F.bone.spine.rotation.x = 0.04 + (o.lean || 0); F.bone.chest.rotation.x = 0.03; F.bone.neck.rotation.x = o.look == null ? 0.12 : o.look;
    F.root.updateMatrixWorld(true);
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      const ank = local(F, sx * (0.13 + (o.spread || 0)), 0.085, 0.44 + (o.feetZ || 0));
      Fg.ik2(F, F.bone['thigh' + side], F.bone['shin' + side], F.bone['foot' + side], ank, toWorldDir(F, 0, 0.6, 1), 1);
      Fg.aim(F.bone['foot' + side], toWorldDir(F, 1, 0, 0), UP);
    }
  }
  // An arm's hand to a point, the elbow bending toward `pole`, the hand turned so its palm faces `palm` and the fingers run along `fingers`.
  function reach(F, side, W, pole, palm, fingers) {
    Fg.ik2(F, F.bone['upperArm' + side], F.bone['foreArm' + side], F.bone['hand' + side], W, pole, -1);
    if (palm) Fg.aim(F.bone['hand' + side], side === 'R' ? palm.clone() : palm.clone().negate(), fingers.clone().negate());
    F.root.updateMatrixWorld(true);
  }
  function legTo(F, side, W, pole) { Fg.ik2(F, F.bone['thigh' + side], F.bone['shin' + side], F.bone['foot' + side], W, pole, 1); }

  // ── Placing the subject ──
  const OTK = { pitch: 0.14 };
  let otkQ = null, otkH = new V3();
  function placeOTK(P, snap) {
    const F = P.f, s = sc(F), cs = sc(captain);
    // her (his) spine along world +x, tipped head-down; front to the deck; left side toward the Captain
    const p = OTK.pitch, X = new V3(0, 0, -1), Y = new V3(Math.cos(p), -Math.sin(p), 0), Z = new V3().crossVectors(X, Y);
    otkQ = new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
    const lapTop = bench.seatY + 0.155 * cs;
    otkH.set(bench.at.x - 0.11 * cs, lapTop + 0.125 * s * (0.9 + 0.2 * (P.r.body.fat + P.r.body.mass) / 2), bench.at.z + 0.24);
    F.root.quaternion.copy(otkQ); F.root.position.copy(otkH).sub(new V3(0, 0.95 * s, 0).applyQuaternion(otkQ));
  }
  function placeWall(P) { setRoot(P.f, wall.at, wall.yaw); }
  // The captain, for the position.
  function poseCaptain(dt) {
    const F = captain;
    if (st.position === 'otk' || st.phase === 'after') seat(F, bench.at, 0, { lean: st.phase === 'after' ? 0 : 0.1, look: st.phase === 'after' ? 0.05 : 0.38 });
    else {
      // standing to the subject's left, a little behind, turned to them
      const at = local(cur.f, 0.52, 0, -0.38); at.y = 0;
      const look = local(cur.f, 0, 0.9, -0.1); const yaw = Math.atan2(look.x - at.x, look.z - at.z) - 0.35;
      stand(F, st.t, { look: 0.3 }); setRoot(F, at, yaw); F.bone.spine.rotation.x = 0.08; F.bone.spine.rotation.y = 0.2;
    }
    F.root.updateMatrixWorld(true);
  }

  // ── Whoever's not in the middle: witnesses and those waiting stand at the watch spots, turned to the scene; those done wait in the corner,
  // hands on their head, or stand aside. ──
  const focus = () => (st.position === 'otk' ? bench.at.clone().setY(0.8) : wall.at.clone().setY(0.9));
  function poseOthers(t) {
    let w = 0;
    for (const P of people) {
      if (P === cur && st.phase === 'turn') continue;
      if (st.phase === 'after' && P === afterWith) continue;
      const F = P.f;
      if (P.done && st.between === 'corner' && st.phase === 'turn') {
        // the first in the corner; any after, along the east bulkhead, facing it
        const c = bay.spots.corner, off = people.filter(x => x.done).indexOf(P);
        stand(F, t, { look: 0.25 });
        if (off === 0) setRoot(F, c.at, c.yaw); else setRoot(F, new V3(c.at.x + 0.04, 0, c.at.z - 0.85 * off), Math.PI / 2);
        F.root.updateMatrixWorld(true);
        const head = F.bone.head.getWorldPosition(new V3()), side = toWorldDir(F, 1, 0, 0);
        for (const [sd, sx] of [['L', 1], ['R', -1]]) reach(F, sd, head.clone().addScaledVector(UP, 0.14 * sc(F)).addScaledVector(side, sx * 0.05), side.clone().multiplyScalar(sx).add(new V3(0, -0.2, 0)).normalize(), null, null);
        F.setExpr(P.outcome === 'word' ? 'sad' : 'teary');
        continue;
      }
      const spot = bay.spots.watch[w++ % bay.spots.watch.length], f = focus();
      stand(F, t, { look: 0.12 });
      setRoot(F, spot.at, Math.atan2(f.x - spot.at.x, f.z - spot.at.z));
      if (P.done) F.setExpr(P.outcome === 'word' ? 'sad' : 'teary'); else F.setExpr(P.role === 'witness' ? 'concerned' : 'shy');
      F.root.updateMatrixWorld(true);
    }
  }

  // ── The subject's pose and reactions ──
  function poseSubject(dt) {
    const P = cur, F = P.f, d = clamp(P.pain.distress(), 0, 1.8), dd = Math.min(1, d), t = st.t, s = sc(F);
    const k = sp.kick.to(J.kick, dt), wr = Math.sin(t * 6.3) * 0.5 + Math.sin(t * 3.7) * 0.5, wrig = sp.wrig.to(wr * dd * (st.running ? 1 : 0.5), dt);
    const mine = J.side === 'L' ? 1 : -1;
    F.resetPose();
    if (st.position === 'otk') {
      placeOTK(P);
      F.bone.hips.rotation.y = 0.07 * wrig; F.bone.hips.rotation.z = 0.04 * wrig;
      F.bone.spine.rotation.x = 0.06 - 0.06 * k; F.bone.chest.rotation.x = 0.04 - 0.05 * k;
      F.bone.neck.rotation.x = -0.25 - 0.45 * k + 0.08 * dd * Math.sin(t * 2.9); F.bone.neck.rotation.y = 0.5 + 0.1 * Math.sin(t * 1.7) * dd;
      F.root.updateMatrixWorld(true);
      // legs: the feet toward the deck beyond the bench's end; a kick lifts the foot on the side struck
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const m = side === J.side ? 1 : 0.35, kk = k * m + 0.25 * dd * Math.max(0, sx * wrig);
        const W = new V3(otkH.x - 0.66 * s + 0.12 * kk, 0.085 + 0.42 * kk, otkH.z - sx * 0.1 * s);
        legTo(F, side, W, new V3(-0.2, -1, 0).normalize());
        F.bone['foot' + side].rotation.x = 0.95 - 0.4 * kk;
      }
      // hands braced on the bench, beyond the Captain's left knee; lifted a little as they react
      const sh = F.bone.chest.getWorldPosition(new V3());
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const lift = sp.lift.to(k, dt);
        const W = new V3(sh.x + 0.36 * s, bench.seatY + 0.075 + 0.05 * lift, otkH.z - sx * 0.15 * s);
        reach(F, side, W, new V3(0.2, 0.6, -sx * 0.8).normalize(), new V3(0, -1, 0), new V3(1, 0, 0));
        F.bone['fingers' + side].rotation.x = 0;
      }
    } else {
      placeWall(P);
      const fwd = sp.fwd.to(k, dt), toe = sp.toe.to(k * 0.9 + 0.2 * dd * Math.max(0, wrig), dt);
      F.bone.hips.position.y = (0.95 - 0.05 + 0.035 * toe) ; F.bone.hips.position.z = -0.09 + 0.06 * fwd;
      F.bone.hips.rotation.x = 0.42 - 0.25 * fwd; F.bone.hips.rotation.y = 0.05 * wrig; F.bone.hips.rotation.z = 0.04 * wrig;
      F.bone.spine.rotation.x = 0.2 - 0.05 * fwd; F.bone.chest.rotation.x = 0.1 - 0.08 * fwd;
      F.bone.neck.rotation.x = -0.15 - 0.4 * k + 0.06 * dd * Math.sin(t * 2.6); F.bone.neck.rotation.y = 0.12 * Math.sin(t * 1.3) * dd;
      F.root.updateMatrixWorld(true);
      const stamp = sp.stamp.to(J.stamp, dt);
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const st_ = side === J.side ? stamp : 0;
        legTo(F, side, local(F, sx * 0.25, 0.085 + 0.045 * toe + 0.13 * st_, 0.02 + 0.05 * st_), toWorldDir(F, sx * 0.2, 0.2, 1).normalize());
        Fg.aim(F.bone['foot' + side], toWorldDir(F, 1, 0, 0), toWorldDir(F, 0, 1, -0.4 * toe).normalize());
      }
      const R = wall.rail, g = sp.grip.to(dd, dt);
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const W = new V3(R.x + 0.07, R.y + 0.03, R.z - sx * 0.3 * s);
        reach(F, side, W, toWorldDir(F, sx * 1, -0.6, -0.3).normalize(), toWorldDir(F, 0, -0.5, 1).normalize(), toWorldDir(F, 0, -1, 0.6).normalize());
        F.bone['fingers' + side].rotation.z = sx * -(1.1 + 0.3 * g); F.bone['thumb' + side].rotation.z = sx * -0.8;
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
    const n = sv.n.clone(), away = st.position === 'otk' ? new V3(0, 0, 1) : toWorldDir(cur.f, -1, 0.4, 0.2).normalize();
    const f = away.addScaledVector(n, -away.dot(n)).normalize();
    const W = sv.p.clone().addScaledVector(n, 0.018).addScaledVector(f, -0.085 * sc(captain));
    return { W, n, f, P: sv.p.clone() };
  }
  const handPose = { W: new V3(), n: new V3(0, 1, 0), f: new V3(0, 0, 1) };
  function poseCaptainHands(dt) {
    const F = captain, sw = st.swing, cs = sc(F);
    // the left hand: on the small of their back
    const back = cur.f.bone.spine.getWorldPosition(new V3()), bn = toWorldDir(cur.f, 0, 0, -1).normalize();
    const LW = back.clone().addScaledVector(bn, 0.13 * sc(cur.f)).add(st.position === 'otk' ? new V3(0.05, 0, -0.06) : new V3(0, 0, 0));
    reach(F, 'L', LW, st.position === 'otk' ? new V3(0.6, 0.3, -0.7).normalize() : toWorldDir(F, 1, -0.3, -0.4).normalize(), bn.clone().negate(), st.position === 'otk' ? new V3(0, 0, 1) : toWorldDir(cur.f, 1, 0, 0));
    // the right: by the swing, or soothing, or at rest above the seat
    const key = spotOf(sw ? sw.side : (st.side === 'alt' ? st.nextSide : st.side), st.area), c = contactFor(key);
    const raised = c.W.clone().addScaledVector(c.n, 0.3 * cs).add(new V3(0, 0.08, 0)).addScaledVector(c.f, -0.08);
    const rest = c.W.clone().addScaledVector(c.n, 0.1 * cs);
    let W = rest, phase = sw ? swingPhase(sw) : null;
    if (phase) {
      const A_ = phase.from === 'rest' ? rest : phase.from === 'raised' ? raised : c.W, B = phase.to === 'rest' ? rest : phase.to === 'raised' ? raised : c.W;
      W = A_.clone().lerp(B, phase.e); if (phase.arc) W.addScaledVector(c.n, 0.06 * Math.sin(Math.PI * phase.e));
    } else if (st.soothe) {
      // slow circles on the area chosen
      const ak = st.sootheArea === 'thighs' ? 'thighs' : st.sootheArea === 'back' ? 'upper' : 'centre';
      const sides = st.sootheArea === 'L' ? ['L'] : st.sootheArea === 'R' ? ['R'] : ['L', 'R'];
      const sd = sides[Math.floor(st.t / 2.4) % sides.length], c2 = contactFor(spotOf(sd, ak));
      const a = st.t * 2.1, tang = new V3().crossVectors(c2.n, c2.f).normalize();
      W = c2.W.clone().addScaledVector(c2.f, 0.03 * Math.cos(a)).addScaledVector(tang, 0.03 * Math.sin(a)).addScaledVector(c2.n, -0.004);
      if (st.sootheArea === 'back') W = back.clone().addScaledVector(bn, 0.12 * sc(cur.f)).addScaledVector(tang, 0.04 * Math.sin(a)).addScaledVector(c2.f, -0.06);
      handPose.n.lerp(c2.n, 0.3); handPose.f.lerp(c2.f, 0.3);
    }
    if (!st.soothe || sw) { handPose.n.lerp(c.n, 0.4); handPose.f.lerp(c.f, 0.4); }
    handPose.W.copy(W);
    const pole = st.position === 'otk' ? new V3(-0.8, 0.3, -0.6).normalize() : toWorldDir(F, -1, -0.3, -0.5).normalize();
    reach(F, 'R', W, pole, handPose.n.clone().negate().normalize(), handPose.f.clone().normalize());
    F.bone.fingersR.rotation.z = 0.05;
  }

  // ── Smacks ──
  const canStrike = () => cur && st.phase === 'turn' && !st.word && !cur.pain.tooHarsh;
  function pickSide() { const s = st.side === 'alt' ? st.nextSide : st.side; if (st.side === 'alt') st.nextSide = st.nextSide === 'R' ? 'L' : 'R'; return s; }
  function startSwing() { if (!canStrike() || st.swing) return false; st.swing = { phase: 'lift', t: 0, side: pickSide(), waited: 0 }; return true; }
  const cushion = () => { const S_ = cur.f.state, c = S.PAIN.CUSHION; let left = 1; if (S_.bottoms === 'up') left *= 1 - (c.trousers || 0.4); if (S_.under === 'up' && st.area !== 'thighs') left *= 1 - (c.briefs || 0.12); return 1 - left; };
  function impact(sw) {
    const P = cur, key = spotOf(sw.side, st.area), tender = P.f.spot[key].mark;
    const hit = P.pain.hit({ implement: 'hand', strength: st.strength, speed: st.pace, raised: sw.waited, tender, cushion: cushion() });
    P.f.mark(key, 0.022 * st.strength * (1 - 0.6 * cushion())); for (const a of AREAS) if (a !== st.area) P.f.mark(a + sw.side, 0.005 * st.strength);
    P.hits++; P.peak = Math.max(P.peak, P.pain.distress());
    J.kick = Math.max(J.kick, hit.reaction); J.side = sw.side; J.flick = 0.45;
    if (hit.reaction > 0.55 && bandIndex() >= 2 && Math.random() < 0.45) J.stamp = 1;
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
    otk: [['Side', [-0.45, 1.35, 1.95], [-0.05, 0.7, 0.2]], ['Behind', [-1.5, 1.2, 0.45], [-0.1, 0.75, 0.22]], ['Seat', [-0.75, 1.5, 0.8], [-0.2, 0.82, 0.24]],
      ['Their face', [1.05, 0.5, 0.55], [0.5, 0.55, 0.24]], ['Captain', [0.1, 1.3, 1.05], [0.0, 1.22, 0.0]], ['Room', [1.9, 1.9, 2.0], [0.0, 0.7, 0.0]]],
    wall: [['Side', [-1.3, 1.3, -0.55], [-1.95, 0.9, 1.0]], ['Behind', [-0.5, 1.2, 0.6], [-1.9, 0.85, 0.95]], ['Seat', [-1.0, 1.25, 0.4], [-1.75, 0.88, 0.95]],
      ['Their face', [-2.45, 1.05, 0.25], [-2.25, 1.2, 0.95]], ['Captain', [-2.1, 1.6, 0.85], [-1.5, 1.6, 1.45]], ['Room', [1.2, 1.9, 2.0], [-1.6, 0.8, 0.8]]],
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
    J.kick *= Math.exp(-dt * 5); J.stamp *= Math.exp(-dt * 4);
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
    if (cur && st.phase !== 'after' && st.phase !== 'over') { poseSubject(dt); poseCaptain(dt); poseCaptainHands(dt); captain.setExpr(st.position === 'otk' || st.phase === 'turn' ? 'stern' : 'calm'); }
    else if (st.phase === 'after' && afterWith) {
      poseCaptain(dt); seat(afterWith.f, bench.beside, -0.35, { look: 0.15 });
      // the Captain's arm round their shoulders
      const sh = afterWith.f.bone.clavR.getWorldPosition(new V3()).add(new V3(0, 0.03, -0.04));
      reach(captain, 'L', sh, new V3(0.3, 0.2, -1).normalize(), new V3(0, -1, 0), new V3(1, 0, 0));
      captain.setExpr('soft');
    } else { stand(captain, st.t, {}); setRoot(captain, bench.at.clone().add(new V3(0.3, 0, 0.6)), 0); }
    poseOthers(st.t);
    captain.tick(dt); for (const P of people) P.f.tick(dt);
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
