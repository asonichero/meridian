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
//   ses.update(dt) each frame; ses.aftercare(id) poses the two of them on the bench for the conversation. ses.defiance() · ses.gains()
(function (root) {
'use strict';
const THREE = root.THREE, Fg = root.Figure, V3 = THREE.Vector3, Q = THREE.Quaternion;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t, ease = x => x * x * (3 - 2 * x);
const spring = (w, z) => ({ x: 0, v: 0, w, z, to(t, dt) { this.v += (this.w * this.w * (t - this.x) - 2 * this.z * this.w * this.v) * dt; this.x += this.v * dt; return this.x; } });
const TIMES = { lift: 0.42, hold: 0.14, strike: 0.1, contact: 0.24, back: 0.4 };
const BANDS = ['composed', 'flinching', 'struggling', 'close to the edge of resistance', 'past the edge of resistance', 'too harsh'];
const FACE = ['wince', 'gritted', 'gritted', 'crying'];
const AREAS = ['cheek', 'sitspot', 'thighs'];
// soothing works over all of them, both sides, in a slow round (from the Captain's side to the far one, down, and back)
const SOOTHE = ['cheekL', 'cheekR', 'sitspotR', 'sitspotL', 'thighsL', 'thighsR'];
const UP = new V3(0, 1, 0);
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const freshReact = () => ({ fight: 1, ff: 1, A: 0, bout: 0, cad: 2.6, stepPh: 0, stepAmp: 0, step: 0, ph: [0, 1, 2, 3, 4].map(() => Math.random() * 20), n: { kicks: 0, bucks: 0, bouts: 0, stamps: 0, reaches: 0, covers: 0, ups: 0, glances: 0 },
  pride: 0, cover: null, coverK: 0, pinOn: false, pinK: 0, up: null, upK: 0, glance: 0, glanceK: 0, cool: 0, broke: 0, afterStill: 0 });
const yawQ = yaw => new Q().setFromAxisAngle(UP, yaw);

function create(stage, bay, opts) {
  const scene = stage.scene, C = root.Crew, S = root.Pain, L = root.Lines, A = root.GameAudio;
  const listeners = [], emit = (type, data) => listeners.forEach(f => f(type, data));
  const st = { running: false, pace: 1, strength: 1, side: 'alt', nextSide: 'R', area: 'sitspot', soothe: false, position: opts.position || 'otk',
    between: opts.between || 'corner', turn: -1, swing: null, ended: false, word: false, t: 0, sound: opts.sound !== false, cam: 0, phase: 'turn', results: [],
    act: null, actQ: [], ending: null };

  // ── The cast ──
  const captain = Fg.make(C.captainSpec(opts.captain)); scene.add(captain.root);
  const people = [];
  const addPerson = (p, role) => {
    const f = Fg.make(C.figureSpec(p.id, p.sex, p.outfit)); scene.add(f.root);
    const r = C.ROSTER[p.id], pain = S.createPain(r.pain || {});
    const P = { id: p.id, sex: p.sex, f, role, pain, r, done: false, outcome: null, hits: 0, peak: 0, marks: 0, said: {}, bandSeen: 0, pitch: C.pitch(p.id, p.sex), spot: null, resp: 0,
      wrig0: C.wriggle(p.id, p.sex), rx: freshReact(), def: 0, def0: 0, gain: { compliance: 0, resentment: 0 } };
    setRel(P, (opts.rel || {})[p.id]);
    people.push(P); return P;
  };
  // Where they are with the Captain and the new method, 0–1 (through the story; the set-up's sliders for now): submission, desire, comfort.
  // Desire speeds their body's response and lets it go further; comfort lowers their inhibitions, so they wriggle more; all three bring them
  // closer in the aftercare, and submission and desire have them lean into the Captain, his hand rubbing between their shoulder blades. (The
  // asexual crew member has no desire to speak of: it stays at nothing for them.)
  // And what they bring to this correction: defiance (their wilfulness, Crew meters.wilfulness, unless set), with half of any resentment they
  // carry from before on top of it. It's attitude, never a withdrawal of consent: it moves nothing about their safe word, the edge, or the
  // stillness that tells the player to wind down.
  function setRel(P, v) {
    v = v || {}; const no = P.r.dynamic && P.r.dynamic.asexual, c01 = x => clamp(+x || 0, 0, 1);
    P.rel = { submission: c01(v.submission), desire: no ? 0 : c01(v.desire), comfort: c01(v.comfort),
      defiance: v.defiance == null ? (P.r.meters && P.r.meters.wilfulness) || 0 : c01(v.defiance), resentment: c01(v.resentment) };
    P.wrig = P.wrig0 + (1 - P.wrig0) * 0.5 * P.rel.comfort;
    P.def0 = clamp(P.rel.defiance + 0.5 * P.rel.resentment, 0, 1); if (!P.hits) P.def = P.def0;      // (before the first smack, it follows the set-up)
  }
  const queue = (opts.queue || []).map(p => addPerson(p, 'subject'));
  const witnesses = (opts.witnesses || []).map(p => addPerson(p, 'witness'));
  let cur = null;      // the one across the lap / at the rail now

  // ── The body's response (purely visual for now): blood to the sex as a correction goes on. It builds with each smack (less through cloth),
  // with the warmth of the marks and with soothing, and fades over minutes once it's over. How far it may go: partway in these corrections
  // (opts.desire, for later ones where desire is present, lets it go all the way). Each crew member has their own scale (Crew: body.response;
  // a bodily response, not a measure of desire). The Captain's builds more slowly, from giving it; he keeps most of it in check, and what shows
  // grows with the affection between him and the one in his care, given and returned (Crew: dynamic.bond), and he colours a little. ──
  const RESP = { hit: 0.005, soothe: 0.006, warm: 0.003, tau: 150, captain: 0.6, cap: opts.desire ? 1 : 0.5 };
  let capResp = 0;
  const respond = (P, amt) => {
    const k = (P.r.body && P.r.body.response != null ? P.r.body.response : 1) * (1 + 1.5 * P.rel.desire), cap = Math.max(RESP.cap, 0.5 + 0.5 * P.rel.desire);
    P.resp = Math.min(cap, P.resp + amt * k * Math.max(0, 1 - P.resp / cap));
    capResp = Math.min(RESP.cap, capResp + amt * RESP.captain * Math.max(0, 1 - capResp / RESP.cap));
  };
  function responses(dt) {
    if (cur && st.phase === 'turn') {
      let warm = 0; for (const a of AREAS) for (const sd of ['L', 'R']) warm += cur.f.spot[a + sd].mark / (AREAS.length * 2);
      respond(cur, (RESP.warm * warm + (st.soothe && !st.swing ? RESP.soothe * (1 + 2 * cur.rel.desire) * (1 - 0.5 * cur.def) : 0)) * dt);
    }
    const fade = Math.exp(-dt / RESP.tau);
    for (const P of people) { P.resp *= fade; P.f.setResponse(P.resp, { blush: Math.min(0.9, 1.4 * P.resp * P.rel.desire), chest: P.resp * P.rel.desire }); }
    capResp *= fade;
    // (his guard eases as the affection's returned: their desire, or the bond between them once the story keeps it)
    const W = cur || afterWith, bond = W ? Math.max(W.r.dynamic && W.r.dynamic.bond || 0, W.rel.desire) : 0;
    captain.setResponse(capResp * (0.3 + 0.7 * bond), { blush: Math.min(0.45, capResp * 0.7) });
  }

  // ── Springs for the reactions: each driven toward a target and kicked by impulses as smacks land, so they snap and settle ──
  const J = { kick: 0, side: 'R', flick: 0, stamp: 0 };
  const sp = {}; for (const k of ['kick', 'kickO', 'lift', 'wrig', 'toe', 'fwd', 'stamp', 'flinch', 'arch', 'head', 'grip', 'raise', 'rebound']) sp[k] = spring(15, 0.5);
  sp.raise.w = 9; sp.raise.z = 0.9; sp.rebound.w = 30; sp.rebound.z = 0.35;
  const kickSp = (k, v) => { sp[k].v += v; };
  for (const k of ['lkL', 'lkR', 'twist', 'shift', 'away', 'armL', 'armR', 'shrug']) sp[k] = spring(14, 0.45);
  sp.rbL = spring(7, 0.55); sp.rbR = spring(7, 0.55);
  sp.buck = spring(9, 0.42);

  // ── How they fight it ──
  // Agitation: how much they're moving, from nothing while composed, rising through flinching and struggling to its height at the edge of
  // resistance. The fight in them: well past the edge it goes out of them, and by STILL (1.8, just short of too harsh at 2) they've stilled
  // (the player's tell to wind down): breathing hard, head hanging, crying, still answering each smack, but less; as distress falls it slowly
  // returns. They know it's for their good and try to hold their position: what moves, until they're still, is involuntary.
  // Their temperament (Crew.wriggle: the smaller, the more) sets how much of what agitation there is goes into squirming and kicking.
  // Over the knee: light kicks now and then (from the knee, the foot leaving the deck), squirming (the hips rolling, pulling away from the side
  // struck, the back, the legs scissoring), and at its worst a buck, the hips heaving up off the lap. At the rail: no wriggling, but stepping,
  // in bouts of a few seconds, and a stamp now and then on a hard smack. The men don't kick from the hip or stamp: at the rail their stepping is
  // a shift of the weight, a heel coming up.
  function react(dt) {
    const P = cur, R = P.rx, D = P.pain.distress(), under = st.running || !!st.swing, otk = st.position === 'otk';
    // (the more submissive, the sooner they still; the more comfortable, the sooner the fight comes back)
    const sub = P.rel.submission, com = P.rel.comfort, still = S.PAIN.STILL - 0.12 * sub;
    const tgt = 1 - sm(still - 0.4, still, D);
    R.fight += (tgt - R.fight) * (tgt < R.fight ? 1 - Math.exp(-dt * 2) : dt * (1 + 2 * com) / 45);      // (going: as fast as distress rises; coming back: slowly)
    R.fight = clamp(R.fight, 0, 1); R.ff = R.fight;
    R.A = sm(0.15, 0.95, D) * lerp(0.05, 1, R.ff);
    const A = R.A, Wg = P.wrig, act = under ? 1 : 0.3;
    // stepping, in bouts: a few seconds of it now and then once it really hurts, then not
    if (R.bout > 0) R.bout -= dt;
    else if (A > 0.35 && Math.random() < dt * (otk ? 0.11 : 0.16) * A * (0.3 + 0.7 * Wg) * act) { R.bout = 1.4 + Math.random() * 2.6; R.cad = 2.2 + Math.random(); R.n.bouts++; }
    R.stepPh += dt * R.cad * Math.PI * 2; R.stepAmp += ((R.bout > 0 ? A : 0) - R.stepAmp) * (1 - Math.exp(-dt * 5)); R.step = Math.sin(R.stepPh) * R.stepAmp;
    if (otk) {
      // a light kick now and then, one leg flicking up
      if (Math.random() < dt * 0.6 * A * (0.05 + 0.95 * Wg) * act) { kickSp(Math.random() < 0.5 ? 'lkL' : 'lkR', (4 + 5 * Math.random()) * (0.4 + 0.6 * A)); R.n.kicks++; }
      // and, at its worst, a buck
      if (Math.random() < dt * 0.015 * A * A * Wg * act * (1 - 0.6 * sub)) { kickSp('buck', 5 + 4 * A); R.n.bucks++; }
      // a hand that won't stay put: off the deck a moment, or starting back toward the seat before they stop it (the more submissive, the
      // better they hold their position)
      if (Math.random() < dt * 0.25 * A * (0.3 + 0.7 * Wg) * act * (1 - 0.7 * sub)) kickSp(Math.random() < 0.5 ? 'armL' : 'armR', 3 + 3 * Math.random());
      if (A > 0.5 && Math.random() < dt * 0.08 * A * Wg * act * (1 - 0.85 * sub)) { kickSp(Math.random() < 0.5 ? 'rbL' : 'rbR', 4 + 2 * A); R.n.reaches++; }
    } else {
      // (over a table: now and then a lower leg kicks up behind)
      if (st.position === 'table' && Math.random() < dt * 0.35 * A * (0.05 + 0.95 * Wg) * act) { kickSp(Math.random() < 0.5 ? 'lkL' : 'lkR', (4 + 5 * Math.random()) * (0.4 + 0.6 * A)); R.n.kicks++; }
      if (A > 0.4 && Math.random() < dt * 0.05 * A * act) kickSp(Math.random() < 0.5 ? 'armL' : 'armR', 3 + 2 * Math.random());      // (a hand lets go and grips again)
    }
    defy(dt, D);
  }

  // ── Defiance: what they do on purpose, until it breaks ──
  // Pride first: below the edge they hold back what they show (less squirming, fewer cries), so it breaks bigger. What's deliberate: a look
  // back over the shoulder at the Captain; coming up out of position (pushing up off the knee, straightening at the rail) until the Captain
  // puts them back; and, across the knee, the far hand back over the seat to cover it. The first time, he tells them to move it; the second,
  // he takes the wrist and holds it at the small of their back for the rest of it. Each needs the fight still in them; none of it touches the
  // involuntary (that's react's).
  function defy(dt, D) {
    const P = cur, R = P.rx, dfy = P.def, otk = st.position === 'otk', sub = P.rel.submission, ease_ = (x, to, k) => x + (to - x) * (1 - Math.exp(-dt * k));
    R.pride = dfy * (1 - sm(0.7, 1.05, D));
    R.cool -= dt; R.broke -= dt;
    const free = !st.ending && !st.act && st.phase === 'turn' && !st.word && R.ff > 0.4 && R.cool <= 0 && !R.cover && !R.up;
    const w = dfy * (1 - 0.6 * sub);
    if (free && dfy > 0.25 && D > 0.3) {
      if (otk && !R.pinOn && Math.random() < dt * 0.1 * w) { R.cover = { t: 0, dur: 1.3 + 0.6 * Math.random(), said: false }; R.n.covers++; }
      else if (Math.random() < dt * 0.045 * w) { R.up = { t: 0, dur: 1.2 + 0.8 * Math.random(), said: false }; R.n.ups++; }
    }
    if (R.glance <= 0 && dfy > 0.2 && R.ff > 0.4 && !st.ending && Math.random() < dt * 0.18 * dfy) { R.glance = 0.9 + 0.8 * Math.random(); R.n.glances++; }
    if (R.glance > 0) R.glance -= dt;
    // a hand over the seat: told once; the second time, held
    if (R.cover) {
      const c = R.cover; c.t += dt;
      if (!c.said && c.t > 0.5) { c.said = true; say('captain', L.captain(R.n.covers >= 2 ? 'pin' : 'hands', P.id)); }
      if (c.t >= c.dur) { R.cover = null; R.cool = 2.5; if (R.n.covers >= 2) R.pinOn = true; }
    }
    // up out of position, till they're put back (as they're placed, the defiant are slow to settle: up from the start)
    if (R.up) {
      const u = R.up; u.t += dt;
      if (!u.said && u.t > (u.start ? u.dur - 0.5 : 0.45)) { u.said = true; say('captain', L.captain(otk ? 'down' : st.position === 'table' ? 'table' : sup.kind === 'rail' ? 'rail' : sup.kind, P.id)); }
      if (u.t >= u.dur) { R.up = null; R.cool = 2.5; }
    }
    if (st.ending || st.phase !== 'turn') R.pinOn = false;      // (let go once it's over)
    R.coverK = ease_(R.coverK, R.cover ? 1 : 0, R.cover ? 5 : 3); R.upK = ease_(R.upK, R.up && R.up.t >= 0 ? 1 : 0, R.up ? 4 : 2.5);
    R.pinK = ease_(R.pinK, R.pinOn ? 1 : 0, 3); R.glanceK = ease_(R.glanceK, R.glance > 0 ? 1 : 0, 4);
  }
  // What a smack takes out of their defiance, and what that becomes. It can't fall further than how much it hurts lets it (gone by about the
  // edge; sooner the more submissive, later the more there was); each smack takes a share of what's left above that. Drained inside the edge,
  // it becomes Compliance; drained by going well past it, or by main force (full strength), Resentment. And smacks run on long after they've stilled, with nothing left to
  // break, are resented too.
  function drain(P, r) {
    const R = P.rx, D = P.pain.distress(), was = P.def;
    const brk = 0.85 + 0.35 * P.def0 - 0.3 * P.rel.submission, tgt = P.def0 * (1 - sm(0.3, brk, D));
    if (tgt < P.def) P.def += (tgt - P.def) * 0.4;
    // (harsh: well past the edge, or broken by main force, smacks at full strength)
    const x = was - P.def, h = Math.max(sm(1.1, 1.6, D), 0.5 * sm(1.25, 1.5, st.strength));
    P.gain.compliance += x * (1 - h); P.gain.resentment += x * h;
    if (P.def < 0.05 && R.ff < 0.35) { if (++R.afterStill > 5) P.gain.resentment += 0.012 * r; } else R.afterStill = 0;
    // (the break: the defiance going out of them all at once, with a sob, the head dropping)
    if (P.def0 >= 0.35 && was >= 0.2 && P.def < 0.2 && !P.said.yield) { P.said.yield = 1; R.broke = 2.4; kickSp('head', -5); return true; }
    return false;
  }

  // Nothing through the deck: the lowest of a foot (the ball of it and the tip) and of a hand's fingers, as posed; where they'd go under it, the
  // leg or the arm is drawn up by that much and posed again.
  function footLow(F, side) { const s = sc(F), ft = W_(F, 'foot' + side), to = W_(F, 'toe' + side), tip = to.clone().addScaledVector(to.clone().sub(ft).normalize(), 0.065 * s); return Math.min(to.y - 0.022 * s, tip.y - 0.012 * s); }
  function handLow(F, side) { const s = sc(F), m1 = W_(F, 'middle1' + side), m2 = W_(F, 'middle2' + side), tip = m2.clone().addScaledVector(m2.clone().sub(m1).normalize(), 0.035 * s); return Math.min(m1.y, m2.y, tip.y) - 0.009 * s; }
  // A knee bent further than the leg's pose has it: the lower leg turned about the hinge (their own left–right), the foot with it.
  const _kq = new Q(), _kr = new Q();
  function flexKnee(F, side, a) {
    if (a <= 0.001) return;
    const shin = F.bone['shin' + side], ax = toWorldDir(F, 1, 0, 0).normalize();
    shin.getWorldQuaternion(_kq); _kr.setFromAxisAngle(ax, a).multiply(_kq);
    shin.parent.getWorldQuaternion(_kq).invert(); shin.quaternion.copy(_kq.multiply(_kr)); shin.updateMatrixWorld(true);
  }

  // ── Positions ──
  const bench = bay.spots.bench, wall = bay.spots.wall, table = bay.spots.table || null;
  // (each room's own. Across the knee: the seat, the Captain at its end, the bench running on to their left. Standing: what they hold or lean
  // on, ahead of where they stand (rail: a grab rail; edge: a counter's edge, palms flat on its top; wall: palms flat on a wall), and how far
  // they bend to it. Over the table: where its end is, its height and width, and how they hold it (sides, or a desk's far edge). The
  // aftercare's seat: the Captain's place on it, theirs beside.)
  const sup = wall.support || { kind: 'rail', y: wall.rail.y, d: Math.abs(wall.rail.x - wall.at.x), bend: 0.72 };
  const after = bay.spots.after || { at: bench.at, yaw: bench.yaw || 0, seatY: bench.seatY, beside: bench.beside };
  const inFrame = (at, yaw, x, y, z) => new V3(x, y, z).applyQuaternion(yawQ(yaw)).add(at);
  // (the posing helpers, js/poses.js; seated, on the bench)
  const { sc, H, ankleY, setRoot, local, toWorldDir, W_, reach, legTo, footFlat, stand, arms } = root.Poses;
  const seat = (F, at, yaw, o) => root.Poses.seat(F, at, yaw, Object.assign({ seatY: bench.seatY }, o));

  // ── Placing the subject ──
  // The pelvis over the Captain's right thigh toward the knee, the belly over the left, the chest bending down past it and the hands braced on the
  // deck: in front of the bench, not over it (the body turned a little out into the room, head end first, so the arms hang clear of it).
  // The Captain sits at the bench's end turned 45° to their right, so their lap points off its corner and nothing of the subject's is over the
  // bench: the head end out to the Captain's left, the legs to their right.
  const OTK = { pitch: 0.0, yaw: 0, z: 0.3, seat: inFrame(bench.at, bench.yaw || 0, -0.08, 0, 0), seatYaw: (bench.yaw || 0) - Math.PI / 4 };
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
    if (st.phase === 'after') { seat(F, after.at, after.yaw, { look: 0.05, lean: -0.02, seatY: after.seatY }); return; }
    if (st.position === 'otk') {
      // leaning into it over the lap, turned a little to the right toward the seat, watching; the right shoulder lifts with the arm, the
      // torso turning a touch more into it, and leans in as the hand comes down
      seat(F, OTK.seat, OTK.seatYaw, { lean: 0.08 - 0.03 * rz, twist: -0.1 - 0.05 * rz, roll: 0.02 * rz, look: 0.45 - 0.08 * rz, headYaw: -0.25, headRoll: 0.05, spread: 0.03 });
    } else {
      // right beside them at their left, facing their side (turned a little toward the seat): hips level with theirs, feet planted wide either
      // side of their nearest foot, knees a little bent, leaning in; the left hand on their back, the right at the seat
      const hipZ = cur.f.bone.hips.position.z * sc(cur.f), at = local(cur.f, 0.44 * sc(cur.f), 0, hipZ + 0.04); at.y = 0;
      const face = toWorldDir(cur.f, -1, 0, -0.1).normalize(), yaw = Math.atan2(face.x, face.z);
      // (and as a defiant one comes up off the rail, or stands taller to it, he straightens to give them room)
      const up_ = Math.max(cur.rx.upK, 0.6 * cur.def);
      stand(F, at, yaw, { weight: 0.25, wide: 0.22, crouch: 0.22 - 0.06 * up_, lean: 0.34 - 0.08 * rz - 0.26 * up_, look: 0.45 - 0.15 * up_, headYaw: 0.1 + 0.15 * up_, arms: null });
      F.bone.spine.rotation.y += 0.1 - 0.12 * rz; F.bone.chest.rotation.y += 0.06 - 0.08 * rz;
    }
    F.bone.clavR.rotation.z = -0.08 * rz; F.bone.clavR.rotation.y = 0.06 * rz;
    F.root.updateMatrixWorld(true);
  }

  // ── Whoever's not in the middle: witnesses and those waiting stand at the watch spots, turned to the scene; those done wait in the corner,
  // hands on their head, or stand aside. Each holds their arms their own way. ──
  const focus = () => (st.position === 'otk' ? bench.at : st.position === 'table' && table ? table.at : wall.at).clone().setY(st.position === 'otk' ? 0.8 : 0.9);
  const HOLDS = ['fold', 'rest', 'clasp', 'rest', 'fold', 'clasp'];
  function poseOthers(t) {
    let w = 0;
    for (const P of people) {
      if (P === cur && (st.phase === 'turn' || st.phase === 'closing')) continue;      // (the one in the scene stays in it till the cut)
      if (st.phase === 'after' && P === afterWith) continue;
      const F = P.f, i = people.indexOf(P);
      if (P.done && st.between === 'corner' && st.phase === 'turn') {
        // the first in the corner; any after, along the east bulkhead, facing it; feet together, hands on the head, the head bowed
        const c = bay.spots.corner, off = people.filter(x => x.done).indexOf(P);
        const nx = c.next || { base: new V3(0.04, 0, 0), step: new V3(0, 0, -0.85), yaw: Math.PI / 2 };      // (the room says where the next ones stand)
        if (off === 0) stand(F, c.at, c.yaw, { weight: 0.3, wide: 0.08, look: 0.32 }); else stand(F, c.at.clone().add(nx.base).addScaledVector(nx.step, off), nx.yaw, { weight: 0.3, wide: 0.08, look: 0.32 });
        const head = W_(F, 'head'), side = toWorldDir(F, 1, 0, 0), fwd = toWorldDir(F, 0, 0, 1);
        for (const [sd, sx] of [['L', 1], ['R', -1]]) {
          reach(F, sd, head.clone().addScaledVector(UP, 0.15 * sc(F)).addScaledVector(side, sx * 0.045).addScaledVector(fwd, -0.01), side.clone().multiplyScalar(sx).addScaledVector(UP, -0.15).normalize(), UP.clone(), side.clone().multiplyScalar(-sx).addScaledVector(fwd, 0.3).normalize());
          F.grip(sd, 0.3, 0, 0.2);
        }
        F.setExpr(P.outcome === 'word' ? 'sad' : 'teary');
        continue;
      }
      // (more of them than the room has places: each lap round them stands beside a place, alternately to either side, never on top of
      // whoever's there)
      const ws_ = bay.spots.watch, spot = ws_[w % ws_.length], lap = Math.floor(w++ / ws_.length), f = focus(), at = spot.at.clone();
      if (lap) { const to = new V3(f.x - at.x, 0, f.z - at.z).normalize(); at.addScaledVector(new V3(-to.z, 0, to.x), 0.7 * Math.ceil(lap / 2) * (lap % 2 ? 1 : -1)); }
      const waiting = !P.done && P.role === 'subject';
      stand(F, at, Math.atan2(f.x - at.x, f.z - at.z), { weight: i % 2 ? 0.6 : -0.6, look: waiting ? 0.3 : 0.15, headYaw: 0.05 * Math.sin(i * 1.7) });
      arms(F, waiting ? 'clasp' : HOLDS[i % HOLDS.length]);
      if (P.done) F.setExpr(P.outcome === 'word' ? 'sad' : 'teary'); else F.setExpr(P.role === 'witness' ? 'concerned' : 'shy');
    }
  }

  // ── The subject's pose and reactions ──
  function poseSubject(dt) {
    const P = cur, F = P.f, d = clamp(P.pain.distress(), 0, 1.8), dd = Math.min(1, d), t = st.t, s = sc(F), R = P.rx, otk = st.position === 'otk';
    // squirming (over the knee only): smooth and irregular (each their own rhythm), as much as they're agitated and their temperament lets out
    const sq = otk ? R.A * (0.3 + 0.7 * P.wrig) * (st.running ? 1 : 0.6) * (1 - 0.4 * R.pride) : 0, ph = R.ph;      // (pride holds some of it in)
    const wrig = sp.wrig.to(sq * (Math.sin(t * 2.3 + ph[0]) * 0.6 + Math.sin(t * 3.9 + ph[1]) * 0.4), dt);
    const twist = sp.twist.to(sq * (Math.sin(t * 1.4 + ph[2]) * 0.6 + Math.sin(t * 5.1 + ph[3]) * 0.4), dt), shift = sp.shift.to(sq * Math.sin(t * 0.47 + ph[4]), dt);
    const k = sp.kick.to(0, dt), ko = sp.kickO.to(0, dt), fl = sp.flinch.to(0, dt), ar = sp.arch.to(0, dt), bk = sp.buck.to(0, dt);
    const lk = { L: sp.lkL.to(0, dt), R: sp.lkR.to(0, dt) }, spent = 1 - R.ff, aw = otk ? sp.away.to(0, dt) : 0, shr = sp.shrug.to(0, dt);
    const armUp = { L: sp.armL.to(0, dt), R: sp.armR.to(0, dt) }, rb = { L: sp.rbL.to(0, dt), R: sp.rbR.to(0, dt) };
    // (spent: the head hangs, the hands loosen, the breath long)
    const hd = sp.head.to(0.15 * dd * R.ff - 0.3 * dd * spent, dt);
    const g = sp.grip.to((0.25 + 0.75 * dd) * (0.35 + 0.65 * R.ff), dt);
    const pedal = R.step;      // (stepping, in bouts: −1…1, a foot at a time)
    // (the more submissive: the head bowed rather than turned to the room, and at the end they stay down till they're told; the less, they
    // start to come up as soon as it's over)
    const sub = P.rel.submission, rise = (st.ending || st.phase === 'closing') ? sm(0, 1, (st.ending ? st.ending.t : 3) / 1.5) * (1 - sub) : 0;
    // (defiance: the head up; a look back at the Captain now and then; up out of position till they're put back)
    const dfy = P.def * (R.broke > 0 ? 0 : 1), gK = R.glanceK, uK = R.upK;
    F.resetPose(); F.tuck = otk;      // (face down across the lap: his tucked forward into it)
    if (otk) {
      placeOTK(P, fl);
      // over the left thigh the back rounds down toward the deck, the head up and turned to the room; on a smack the back arches and the head
      // comes up. Squirming rolls and turns the hips and the back; a buck heaves the hips up off the lap, the back hollowing under it.
      F.bone.hips.position.z -= 0.035 * Math.max(0, bk) * s; F.bone.hips.position.x += 0.022 * (wrig + aw) * s;
      F.bone.hips.rotation.set(0.04 - 0.05 * ar - 0.16 * bk, 0.26 * wrig + 0.14 * shift + 0.3 * aw, 0.07 * wrig + 0.09 * shift + 0.04 * fl * (J.side === 'L' ? 1 : -1));
      F.bone.spine.rotation.set(0.04 - 0.08 * ar + 0.12 * bk, -0.1 * wrig + 0.1 * twist - 0.12 * aw, 0.03 * wrig + 0.05 * twist);
      F.bone.chest.rotation.set(0.85 - 0.14 * ar + 0.06 * bk + 0.12 * spent * dd - 0.42 * uK, 0.04 * twist + 0.14 * gK, 0);
      F.bone.spine.rotation.x -= 0.1 * uK; F.bone.spine.rotation.y += 0.1 * gK;
      // (the head: turned out to the room, or, glancing back, round and up over the near shoulder to the Captain)
      F.bone.neck.rotation.set(-0.7 + 0.4 * sub - 0.25 * dfy - 0.4 * hd - 0.2 * ar - 0.15 * bk - 0.35 * rise - 0.15 * gK - 0.15 * uK,
        lerp(-0.7 * (1 - 0.75 * sub), 0.75, gK) + (0.1 * dd * R.ff + 0.12 * sq) * Math.sin(t * 1.7 + ph[1]), -0.1 + 0.15 * gK);
      F.bone.chest.rotation.x -= 0.2 * rise;
      F.bone.clavL.rotation.z += 0.1 * Math.max(0, shr); F.bone.clavR.rotation.z -= 0.1 * Math.max(0, shr);
      F.root.updateMatrixWorld(true);
      // legs: the toes on the deck beyond the bench's end, knees soft; a kick bends the knee, the foot leaving the deck (the side struck on a
      // smack, either now and then as they squirm); squirming scissors them a little; stepping lifts one foot then the other
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        // (kicks come from the knee: the lower leg flicking up, the foot leaving the deck; the hip goes with it only a little)
        const kick = side === J.side ? k : ko, knee = Math.max(0, 1.15 * kick + 1.3 * lk[side] + 0.8 * Math.max(0, side === 'L' ? pedal : -pedal));
        const kk = P.sex === 'm' ? 0 : Math.max(0, 0.3 * kick + 0.3 * Math.max(0, sx * wrig));      // (the men: none from the hip at all)
        // (the men keep their legs closer, the thighs meeting below the crotch: what hangs between them tucked forward, out of reach behind)
        const Wt = otkH.clone().addScaledVector(otkU, -(0.62 * s - 0.2 * kk) + sx * 0.05 * twist * s).addScaledVector(otkX, sx * ((P.sex === 'm' ? 0.035 : 0.085) * s + 0.04 * kk)); Wt.y = 0.06 + 0.5 * kk;
        const legOTK = () => { legTo(F, side, Wt, new V3(-0.15, -1, 0).normalize()); flexKnee(F, side, Math.min(1.5, knee));
          F.bone['foot' + side].rotation.x = 1.0 - 0.3 * Math.min(1, knee); F.bone['toe' + side].rotation.x = -0.6 + 0.3 * Math.min(1, knee); F.bone['foot' + side].updateMatrixWorld(true); };
        legOTK(); const low = footLow(F, side); if (low < 0) { Wt.y -= low; legOTK(); }
      }
      // the hands down to the deck, a little ahead of the shoulders and out to their sides, the elbows soft: braced flat on it where they reach
      // it, else hanging, the fingertips brushing it; on a smack they push and grip
      const lift = sp.lift.to(0, dt);
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const shd = W_(F, 'upperArm' + side), out = otkX.clone().multiplyScalar(sx), arm = (F.bone['foreArm' + side].position.length() + F.bone['hand' + side].position.length()) * s;
        const held = side === 'R' ? Math.max(R.pinK, R.coverK) : 0, up = Math.max(0, armUp[side]) * (1 - held), back = clamp(rb[side], 0, 0.55) * (1 - held);
        const Wt = new V3(shd.x, 0, shd.z).addScaledVector(otkU, 0.1 * s + 0.02 * lift - 0.05 * up * s).addScaledVector(out, 0.05 * s); Wt.y = 0.032 + 0.02 * Math.max(0, lift) + 0.09 * up * s;
        // (a hand starting back toward the seat, as if to cover it, before they stop it: never more than halfway)
        if (back > 0.01) Wt.lerp(W_(F, 'hips').addScaledVector(out, 0.16 * s).addScaledVector(UP, 0.06 * s), back);
        const short = Math.max(clamp((Wt.distanceTo(shd) - arm * 0.97) / (0.08 * s), 0, 1), clamp(3 * up + 2 * back, 0, 1));      // (0: on the deck … 1: off it)
        const flat = otkU.clone().addScaledVector(out, 0.35).normalize(), hang = UP.clone().negate().addScaledVector(otkU, 0.35).normalize();
        const fingers = flat.clone().lerp(hang, short).normalize(), palm = new V3(0, -1, 0).lerp(otkU.clone().negate(), short).normalize();
        const pole = out.clone().addScaledVector(otkU, -0.6).addScaledVector(UP, 0.3).normalize();
        // the far hand, on purpose: back over the seat, flat on it, the elbow up; or held, the wrist at the small of their back, palm up, the
        // forearm across it, the elbow out to their side
        const cK = side === 'R' ? R.coverK : 0, pK = side === 'R' ? R.pinK : 0;
        if (cK > 0.001) {
          const cv = F.surface('cheekR', null, 0.012), fd = otkU.clone().negate().addScaledVector(otkX, 0.3); fd.addScaledVector(cv.n, -fd.dot(cv.n)).normalize();
          Wt.lerp(cv.p.clone().addScaledVector(cv.n, 0.012).addScaledVector(fd, -0.075 * s), cK).addScaledVector(out, 0.16 * s * Math.sin(Math.PI * cK));      // (round their side, not through it)
          fingers.lerp(fd, cK).normalize(); palm.lerp(cv.n.clone().negate(), cK).normalize(); pole.lerp(out.clone().addScaledVector(UP, 0.9).normalize(), cK).normalize();
        }
        if (pK > 0.001) {
          const bk = F.surface('back', null, 0.012), ac = otkX.clone().addScaledVector(otkU, 0.25); ac.addScaledVector(bk.n, -ac.dot(bk.n)).normalize();
          const at = bk.p.clone().addScaledVector(otkU, -0.07 * s).addScaledVector(otkX, -0.035 * s).addScaledVector(bk.n, 0.035);
          Wt.lerp(at, pK).addScaledVector(out, 0.16 * s * Math.sin(Math.PI * pK)).addScaledVector(bk.n, 0.06 * Math.sin(Math.PI * pK)); fingers.lerp(ac, pK).normalize(); palm.lerp(bk.n, pK).normalize(); pole.lerp(otkX.clone().negate().addScaledVector(bk.n, 0.7).normalize(), pK).normalize();
        }
        const handOTK = () => { reach(F, side, Wt, pole, palm, fingers); F.grip(side, lerp(lerp(0.1 + 0.3 * g, 0.35 + 0.3 * g, short), 0.12, cK) * (1 - pK) + 0.45 * pK, 0.35 - 0.25 * g, 0.25); F.bone['hand' + side].updateMatrixWorld(true); };
        handOTK(); const hl = handLow(F, side); if (hl < 0) { Wt.y -= hl; handOTK(); }
      }
    } else if (st.position === 'table') {
      // Over the end of the table: the front of the hips against its edge, the chest down on it, the head turned to the side, the arms out along
      // it, the hands holding its sides (or, a desk, its far edge); the feet on the deck, apart. A smack drives the hips into the edge and up onto
      // their toes, the head up; they step in bouts, and now and then a lower leg kicks up behind (the women stamp; the men only shift their
      // weight). Defiant, they push up off it on their hands till they're put back.
      setRoot(F, table.at, table.yaw);
      const toe = sp.toe.to(0, dt), fwd = Math.max(0, fl), stamp = sp.stamp.to(0, dt);
      const hipZ = table.d - 0.12 * s + 0.01 * fwd, hipY = (H(F).hips - 0.02 + 0.035 * Math.max(0, toe)) * s;
      F.bone.hips.position.set(0, hipY / s, hipZ / s);
      // (bent as far as it takes for the chest to lie on the top: past level for the tall, short of it for the short)
      const Lt = (F.bone.spine.position.length() + F.bone.chest.position.length() + F.bone.neck.position.length() * 0.4) * s;
      const lie = Math.PI / 2 + Math.asin(clamp((hipY - (table.top + 0.12 * s)) / Lt, -0.6, 0.95));
      const up = 0.15 * ar + 0.6 * uK + 0.45 * rise + 0.1 * dfy;
      F.bone.hips.rotation.set(lie - up, 0.03 * Math.sin(t * 1.1 + ph[2]) * dd * R.ff, 0);
      F.bone.spine.rotation.set(0.03 - 0.04 * ar, 0.06 * gK, 0); F.bone.chest.rotation.set(0.02 - 0.05 * ar, 0.1 * gK, 0);
      F.bone.neck.rotation.set(-0.5 + 0.35 * sub - 0.5 * hd - 0.15 * ar - 0.2 * dfy - 0.2 * gK - 0.25 * rise, -0.7 * (1 - 0.6 * sub) + 1.0 * gK + 0.05 * Math.sin(t * 1.3 + ph[0]) * dd * R.ff, 0.12 - 0.2 * gK);
      F.root.updateMatrixWorld(true);
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const st_ = side === J.side ? Math.max(0, stamp) : 0, pd = side === 'L' ? Math.max(0, pedal) : Math.max(0, -pedal);
        const lift_ = 0.03 * Math.max(0, toe) + (P.sex === 'm' ? 0 : 0.14 * st_ + 0.08 * pd);
        const at_ = local(F, sx * 0.21 * s, ankleY(F) + lift_, hipZ - 0.1 * s - 0.06 * st_), pole_ = toWorldDir(F, sx * 0.12, 0.1, 1).normalize(), heel = clamp(toe * 1.2 + st_ + pd, 0, 1);
        legTo(F, side, at_, pole_); footFlat(F, side, toWorldDir(F, sx * 0.12, 0, 1).normalize(), heel);
        const low = footLow(F, side); if (low < 0) { at_.y -= low; legTo(F, side, at_, pole_); footFlat(F, side, toWorldDir(F, sx * 0.12, 0, 1).normalize(), heel); }
        flexKnee(F, side, Math.min(1.5, 1.4 * Math.max(0, lk[side])));
      }
      // the hands: a table's sides, the palm on the top by the edge and the fingers curled round it; a desk's far edge, the fingers over it
      const U = toWorldDir(F, 0, 0, 1), X = toWorldDir(F, 1, 0, 0);
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const off = clamp(armUp[side], 0, 1) * (1 - uK);
        let Wt, palm, fdir;
        if (table.grip === 'far') {
          fdir = U.clone().addScaledVector(UP, -0.6).normalize(); palm = UP.clone().negate().addScaledVector(U, 0.3).normalize();
          Wt = inFrame(table.at, table.yaw, sx * 0.2 * s, table.top + 0.012, table.d + table.len - 0.02).addScaledVector(U, -0.07 * s).addScaledVector(UP, 0.02 + 0.05 * off);
        } else {
          fdir = X.clone().multiplyScalar(sx).addScaledVector(U, 0.35).addScaledVector(UP, -0.25).normalize(); palm = UP.clone().negate();
          Wt = inFrame(table.at, table.yaw, sx * (table.w / 2 - 0.035), table.top + 0.014, table.d + 0.5 * s).addScaledVector(fdir, -0.06 * s).addScaledVector(UP, 0.02 + 0.06 * off);
        }
        reach(F, side, Wt, X.clone().multiplyScalar(sx).addScaledVector(UP, 0.5).normalize(), palm, fdir);
        F.grip(side, clamp(0.45 + 0.35 * g - 0.4 * off, 0.1, 0.9), 0.05, 0.6);
        F.bone['clav' + side].rotation.z += sx * 0.1 * Math.max(0, shr);
      }
    } else {
      // bent well forward from the hips, back long, head down between the arms; a smack brings them up onto their toes, the hips driving toward
      // the bulkhead and the back straightening, the head coming up. No wriggling here: what they do is step, in bouts, a foot coming off the
      // deck then the other, and now and then stamp.
      setRoot(F, wall.at, wall.yaw);
      const toe = sp.toe.to(0, dt), fwd = Math.max(0, fl);
      F.bone.hips.position.set(0, H(F).hips - 0.05 + 0.04 * toe, -0.1 + 0.07 * fwd);
      // (defiant, they stand a little taller to it, the head up; coming up, they straighten off the rail till they're put back; a glance goes
      // back over the left shoulder to the Captain)
      F.bone.hips.rotation.set((sup.bend || 0.72) - 0.35 * fwd - 0.15 * ar - 0.14 * dfy - 0.42 * uK, 0, 0);
      F.bone.spine.rotation.set(0.12 - 0.06 * ar - 0.08 * uK, 0.1 * gK, 0); F.bone.chest.rotation.set(0.06 - 0.08 * ar + 0.06 * spent * dd - 0.06 * uK, 0.12 * gK, 0);
      F.bone.neck.rotation.set(0.25 + 0.25 * sub - 0.3 * dfy - 0.7 * hd - 0.15 * ar - 0.4 * rise - 0.2 * gK - 0.2 * uK, 0.06 * Math.sin(t * 1.3 + ph[0]) * dd * R.ff + 0.75 * gK, 0.12 * gK);
      F.bone.hips.rotation.x -= 0.25 * rise;
      F.root.updateMatrixWorld(true);
      const stamp = sp.stamp.to(0, dt);
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const st_ = side === J.side ? Math.max(0, stamp) : 0, pd = side === 'L' ? Math.max(0, pedal) : Math.max(0, -pedal);
        // (the men don't lift a foot: their stepping is a shift of the weight, a heel coming up, the foot staying on the deck)
        const up = 0.03 * Math.max(0, toe) + (P.sex === 'm' ? 0 : 0.16 * st_ + 0.1 * pd);
        const at_ = local(F, sx * 0.25, ankleY(F) + up, 0.0 - 0.1 * st_), pole_ = toWorldDir(F, sx * 0.15, 0.1, 1).normalize(), heel = clamp(toe * 1.2 + st_ + pd, 0, 1);
        legTo(F, side, at_, pole_); footFlat(F, side, toWorldDir(F, sx * 0.12, 0, 1).normalize(), heel);
        const low = footLow(F, side); if (low < 0) { at_.y -= low; legTo(F, side, at_, pole_); footFlat(F, side, toWorldDir(F, sx * 0.12, 0, 1).normalize(), heel); }      // (up on the toes, not through the deck)
      }
      // the hands on what they hold: over a rail, palms down on it, the fingers wrapped over its far side, the wrists a hand's length back toward
      // them; on a counter, palms flat on its top just past the edge, the fingers forward; on a wall, palms flat on it at shoulder height, the
      // fingers up. A hand coming off it lifts clear.
      const toWall = toWorldDir(F, 0, 0, 1), hk = sc(F);
      for (const [side, sx] of [['L', 1], ['R', -1]]) {
        const off = clamp(armUp[side], 0, 1);
        let Wt, palm, fdir, hold = null;
        if (sup.kind === 'edge') {
          fdir = toWall.clone(); palm = UP.clone().negate(); hold = 0.18;
          Wt = local(F, sx * 0.22 * s, sup.y, sup.d + 0.07).addScaledVector(fdir, -0.07 * hk - 0.03 * off).addScaledVector(UP, 0.028 + 0.05 * off);
        } else if (sup.kind === 'wall') {
          fdir = UP.clone().addScaledVector(toWall, -0.1).normalize(); palm = toWall.clone(); hold = 0.12;
          Wt = local(F, sx * 0.24 * s, sup.y, sup.d - 0.015).addScaledVector(fdir, -0.07 * hk).addScaledVector(toWall, -0.04 * off);
        } else {
          fdir = toWall.clone().addScaledVector(UP, -0.25).normalize(); palm = UP.clone().negate().addScaledVector(toWall, 0.25).normalize();
          Wt = local(F, sx * 0.25 * s, sup.y, sup.d).addScaledVector(fdir, -0.07 * hk - 0.03 * off).addScaledVector(UP, 0.036 + 0.05 * off);
        }
        reach(F, side, Wt, toWorldDir(F, sx * 1, -0.6, -0.2).normalize(), palm, fdir);
        F.grip(side, hold == null ? clamp((0.72 + 0.2 * g) * (1 - 0.3 * P.rel.comfort) - 0.7 * off, 0.1, 1) : clamp(hold + 0.25 * g - 0.1 * off, 0.05, 0.6), 0.05, 0.7);      // (the more at ease, the looser)
        F.bone['clav' + side].rotation.z += sx * 0.12 * Math.max(0, shr);
      }
    }
    F.breath = 0.3 + 0.7 * dd + 0.4 * P.resp * P.rel.desire;      // (desire quickens it)
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
      const LW = palmAt.clone().addScaledVector(fing, -0.06 * cs), pn = bk.n.clone().negate();
      const elbowAt = bk.p.clone().addScaledVector(otkU, 0.22 * s_).addScaledVector(otkX, 0.03 * s_).addScaledVector(bk.n, 0.05), sh = W_(F, 'upperArmL');
      // (holding their far wrist at the small of their back: the hand over it from above, the fingers round it toward their feet)
      const pK = cur.rx.pinK;
      if (pK > 0.001) {
        const wr = W_(cur.f, 'handR').addScaledVector(bk.n, 0.028), wf = otkU.clone().negate().addScaledVector(otkX, -0.3); wf.addScaledVector(bk.n, -wf.dot(bk.n)).normalize();
        LW.lerp(wr.addScaledVector(wf, -0.05 * cs), pK); fing.lerp(wf, pK).normalize();
      }
      reach(F, 'L', LW, elbowAt.sub(sh.clone().lerp(LW, 0.5)).normalize(), pn, fing);
      F.grip('L', lerp(0.22, 0.62, pK), 0.15, lerp(0.2, 0.5, pK));
    } else if (st.position === 'table') {
      // (bent over the table: as across the knee, the hand on the small of their back, the fingers toward their hips and round the far side)
      const U = toWorldDir(cur.f, 0, 0, 1), X = toWorldDir(cur.f, 1, 0, 0), far = X.clone().negate(), s_ = sc(cur.f);
      const bk = cur.f.surface('back', { p: new V3(), n: new V3() }, cloth);
      const fing = U.clone().negate().addScaledVector(far, 0.6); fing.addScaledVector(bk.n, -fing.dot(bk.n)).normalize();
      const LW = bk.p.clone().addScaledVector(U, -0.05 * s_).addScaledVector(far, 0.04 * s_).addScaledVector(bk.n, 0.016).addScaledVector(fing, -0.06 * cs);
      const elbowAt = bk.p.clone().addScaledVector(U, 0.22 * s_).addScaledVector(X, 0.03 * s_).addScaledVector(bk.n, 0.05), sh = W_(F, 'upperArmL');
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
    } else if (st.act && cur) {
      // dressing: to the garment's edge (the first quarter), a grip, the edge carried along them (arcing out over the seat), let go, and back
      const a = st.act, u = clamp(a.t / a.dur, 0, 1), pth = dressPath(a), go = pth.to.clone().sub(pth.from).normalize(), carry = ease(clamp((u - 0.32) / 0.5, 0, 1));
      const at = pth.from.clone().lerp(pth.to, carry).addScaledVector(pth.bn, 0.07 * sc(cur.f) * Math.sin(Math.PI * carry));
      const nn = pth.bn.clone(), ff = go.clone().addScaledVector(nn, -go.dot(nn)).normalize();
      const k = u < 0.25 ? ease(u / 0.25) : u > 0.86 ? 1 - ease((u - 0.86) / 0.14) : 1;
      W = rest.clone().lerp(at.clone().addScaledVector(nn, 0.014).addScaledVector(ff, -0.07 * cs), k);
      handPose.n.lerp(nn, 0.3); handPose.f.lerp(ff, 0.3); cock = 0.1; curl = u > 0.25 && u < 0.86 ? 0.55 : 0.12;
    }
    if ((!st.soothe || sw) && !st.act) { handPose.n.lerp(c.n, 0.5); handPose.f.lerp(c.f, 0.5); }
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
  const canRun = () => cur && st.phase === 'turn' && !st.word && !cur.pain.tooHarsh && !st.act && !st.actQ.length && !st.ending;
  // (and not while a hand's over the seat, or they're up out of position: the run waits for them to be put back)
  const canStrike = () => canRun() && !cur.rx.cover && !cur.rx.up;
  function pickSide() { const s = st.side === 'alt' ? st.nextSide : st.side; if (st.side === 'alt') st.nextSide = st.nextSide === 'R' ? 'L' : 'R'; return s; }
  function startSwing() { if (!canStrike() || st.swing) return false; st.swing = { phase: 'lift', t: 0, side: pickSide(), waited: 0 }; return true; }
  const cushion = () => { const S_ = cur.f.state, c = S.PAIN.CUSHION; let left = 1; if (S_.bottoms === 'up') left *= 1 - (c.trousers || 0.4); if (S_.under === 'up' && st.area !== 'thighs') left *= 1 - (c.briefs || 0.12); return 1 - left; };
  function impact(sw) {
    const P = cur, key = spotOf(sw.side, st.area), tender = P.f.spot[key].mark;
    // (the more comfortable they are with it, the less they dread the hand waiting raised)
    const hit = P.pain.hit({ implement: 'hand', strength: st.strength, speed: st.pace, raised: sw.waited * (1 - 0.6 * P.rel.comfort), tender, cushion: cushion() });
    P.f.mark(key, 0.032 * st.strength * (1 - 0.6 * cushion())); for (const a of AREAS) if (a !== st.area) P.f.mark(a + sw.side, 0.005 * st.strength);
    respond(P, RESP.hit * st.strength * (1 - 0.5 * cushion()));
    P.hits++; P.peak = Math.max(P.peak, P.pain.distress());
    J.side = sw.side; J.flick = 0.45;
    const r = hit.reaction, R = P.rx;
    P.f.impact(sw.side, r * (0.6 + 0.4 * st.strength) * (cushion() > 0.3 ? 0.4 : 1));
    // (how much of the smack they show: the stoic less, and less again as the fight goes out of them; pride holds some of it back)
    const m = (0.45 + 0.55 * P.wrig) * lerp(0.5, 1, R.ff) * (1 - 0.45 * R.pride), rm = r * m, away = sw.side === 'L' ? 1 : -1;
    const broke = drain(P, r);
    kickSp('kick', 10 * rm); kickSp('kickO', 4 * rm * Math.random()); kickSp('flinch', 6 * r * lerp(0.5, 1, R.ff)); kickSp('arch', 5 * rm); kickSp('head', 6 * rm); kickSp('lift', 4 * rm);
    kickSp('toe', 5 * r * lerp(0.5, 1, R.ff)); kickSp('rebound', 6); kickSp('grip', 3 * rm);
    // (and, until they've stilled, the involuntary: the hips pulling away from the side struck, a hand coming up, the shoulders hunching)
    kickSp('away', away * 7 * rm * (0.4 + 0.6 * P.wrig) * R.ff); kickSp('shrug', 5 * rm);
    for (const sd of ['L', 'R']) if (Math.random() < 0.5) kickSp('arm' + sd, 3.5 * rm * R.ff * Math.random() * (1 - 0.7 * P.rel.submission));
    if (st.position === 'otk') { if (r > 0.5 && Math.random() < 0.045 * R.A * R.A * P.wrig * (1 - 0.6 * P.rel.submission)) { kickSp('buck', 6 + 5 * R.A); R.n.bucks++; } }
    else if (P.sex !== 'm' && r > 0.5 && Math.random() < 0.28 * R.A * (0.35 + 0.65 * P.wrig)) { kickSp('stamp', 9 * r); R.n.stamps++; }      // (the men don't stamp)
    if (st.sound && A && A.ctx) { A.thwack(hit.reaction, cushion() > 0.3); if (broke || Math.random() < (lerp(0.45, 1, R.ff) + 0.3 * P.rel.comfort) * (1 - 0.6 * R.pride)) A.voice(hit.reaction * lerp(0.55, 1, R.ff) * (broke ? 1.3 : 1), bandIndex(), false, 0.9, P.pitch); }
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
    const P = cur, b = bandIndex(), dfy = P.def > 0.4;
    // (the moment their defiance breaks comes before anything else)
    if (P.said.yield === 1) { P.said.yield = 2; say('subject', L.react(P.id, 'yield'), P); return; }
    if (P.hits === 1 && !P.said.first) { P.said.first = 1; say('subject', L.react(P.id, dfy ? 'defy' : 'first'), P); return; }
    const keys = [null, 'flinching', 'struggling', 'edge', 'past'];
    // (while still defiant, back-talk in place of the early band lines)
    if (b > P.bandSeen && b <= 4) { P.bandSeen = b; if (keys[b] && !P.said[keys[b]]) { P.said[keys[b]] = 1; say('subject', L.react(P.id, dfy && b <= 2 ? 'defy' : keys[b]), P); return; } }
    if (dfy) { if (b >= 1 && sayCool <= 0 && Math.random() < 0.16 * P.def) say('subject', L.react(P.id, 'defy'), P); return; }
    // (as the fight goes out of them they say less, and less in words: past halfway to stillness, now and then a breath or a fragment)
    if (P.rx.ff < 0.5) { if (sayCool <= 0 && Math.random() < 0.05) say('subject', L.react(P.id, 'spent'), P); return; }
    const rl = P.rel, often = 0.12 * (0.4 + 0.6 * P.rx.ff) * (1 + rl.comfort);
    if (!P.said.flushed && rl.desire > 0.3 && P.resp > 0.25 && sayCool <= 0) { P.said.flushed = 1; const ln = L.react(P.id, 'flushed'); if (ln) { say('subject', ln, P); return; } }
    if (b >= 2 && sayCool <= 0 && Math.random() < often) say('subject', L.react(P.id, Math.random() < 0.7 * rl.submission ? 'accept' : 'plead'), P);
  }

  // ── Turns ──
  let afterWith = null;
  const placeKey = () => (st.position === 'wall' ? (sup.kind === 'rail' ? 'wall' : sup.kind) : st.position);      // (what the Captain says to place them)
  function beginTurn(i) {
    st.turn = i; cur = queue[i]; st.word = false; st.swing = null; st.running = false; st.soothe = false; st.phase = 'turn';
    J.kick = 0; J.stamp = 0; for (const k in sp) { sp[k].x = 0; sp[k].v = 0; }
    cur.rx = freshReact(); cur.def = cur.def0; cur.gain = { compliance: 0, resentment: 0 };
    // (the defiant are slow to settle as they're placed: up off the knee, or upright at the rail, looking back, till he puts them down)
    if (cur.def0 > 0.4) { cur.rx.up = { t: -0.2, dur: 2.6 + 1.6 * cur.def0, said: false, start: true }; cur.rx.glance = 1.6; cur.rx.n.ups++; }
    cur.f.setClothes({ top: 'down', bottoms: 'up', under: 'up' }); cur.f.setExpr(cur.r.base || 'calm');
    emit('turn', { i, id: cur.id }); emit('state');
    setTimeout(() => { say('captain', L.place(cur.id, placeKey())); setTimeout(() => say('subject', L.react(cur.id, cur.def0 > 0.5 && !/defiant|stern/.test(cur.r.base) ? 'defy' : 'start'), cur), 1600); }, 300);      // (their own way in, unless they're far more defiant than they usually are)
  }
  // ── The end of a turn: the player's (the Captain soothes them a little, then dresses them, then on), or their safe word (straight to their
  // aftercare). They stay where they are until the cut. ──
  function endTurn(outcome) {
    if (!cur || st.phase !== 'turn' || st.ending) return;
    st.running = false; st.actQ = [];
    if (outcome === 'word') return finishTurn('word');
    st.ending = { t: 0, stage: 'soothe' }; st.soothe = true; emit('state');
  }
  function ending(dt) {
    const E = st.ending; E.t += dt;
    if (E.stage === 'soothe' && E.t > 2.8 && !st.swing) { st.soothe = false; E.stage = 'dress'; dressTo({ under: 'up', bottoms: 'up', top: 'down' }); emit('state'); }
    else if (E.stage === 'dress' && !st.act && !st.actQ.length) { st.ending = null; finishTurn('done'); }
  }
  function finishTurn(outcome) {
    const P = cur; st.running = false; st.soothe = false; st.act = null; st.actQ = [];
    P.outcome = outcome || 'done'; P.done = true;
    if (P.outcome === 'done') say('subject', L.react(P.id, 'end'), P);
    const r2 = x => Math.round(x * 100) / 100;
    const res = { id: P.id, outcome: P.outcome, hits: P.hits, peak: P.peak, band: BANDS[Math.min(5, P.peak < 0.3 ? 0 : P.peak < 0.6 ? 1 : P.peak < 0.9 ? 2 : P.peak < 1 ? 3 : P.peak < S.PAIN.TOO_HARSH ? 4 : 5)], position: st.position,
      defiance: { from: r2(P.def0), to: r2(P.def) }, compliance: r2(P.gain.compliance), resentment: r2(Math.min(1, P.gain.resentment)) };
    st.results.push(res); emit('turnEnd', res);
    st.phase = 'closing';      // (held where they are till the cut)
    if (outcome === 'word') { emit('aftercareNow', { id: P.id, result: res }); emit('state'); return; }
    setTimeout(next, 900);
  }
  // on to the next in the queue, or, all done, to the aftercare (for those not yet cared for)
  function next() {
    if (cur && st.phase !== 'after') cur.f.setClothes({ top: 'down', bottoms: 'up', under: 'up' });
    const n = queue.findIndex(x => !x.done);
    if (n >= 0) beginTurn(n); else { st.phase = 'closing'; emit('done', { results: st.results.filter(r => !r.cared) }); emit('state'); }      // (held where they are till the cut)
  }

  // ── Dressing and undressing: the Captain's right hand to the garment's edge, a grip, and the edge carried along them (the waistband down
  // the back of the thighs to the knees, or to mid-thigh for the briefs; the top's hem pushed up their back), and the reverse; the garment
  // changes over midway, so the hand ends where the cloth now is. A change stops a run; another can't start until it's done. ──
  const ORDER = { up: ['under', 'bottoms', 'top'], down: ['top', 'bottoms', 'under'] };
  function dressTo(o) {
    if (!cur) return;
    st.running = false;
    const want = Object.assign({}, cur.f.state, ...st.actQ.map(a => ({ [a.key]: a.to }))), restoring = (o.under || o.bottoms) === 'up' || o.top === 'down';
    for (const k of ORDER[restoring ? 'up' : 'down']) if (o[k] && o[k] !== want[k]) st.actQ.push({ key: k, to: o[k] });
    emit('state');
  }
  function dressing(dt) {
    if (!st.act && st.actQ.length && !st.swing) st.act = Object.assign(st.actQ.shift(), { t: 0, dur: 2.0, swapped: false });
    const a = st.act; if (!a) return;
    a.t += dt; const u = a.t / a.dur;
    if (!a.swapped && u >= 0.55) { a.swapped = true; cur.f.setClothes({ [a.key]: a.to }); emit('state'); }
    if (u >= 1) { st.act = null; emit('state'); }
  }
  // where the hand goes for each: the edge's path along their back, from where it is to where it's going
  function dressPath(a) {
    const F = cur.f, s = sc(F), bn = toWorldDir(F, 0, 0, -1).normalize(), down = W_(F, 'hips').sub(W_(F, 'spine')).normalize();
    const waist = F.surface('back', null, 0.01).p, knees = W_(F, 'shinL').lerp(W_(F, 'shinR'), 0.5).addScaledVector(bn, 0.075 * s);
    const thighs = W_(F, 'thighL').lerp(W_(F, 'thighR'), 0.5).lerp(knees, 0.42).addScaledVector(bn, 0.09 * s);
    const seat = F.surface('cheekL', null, 0.02).p.lerp(F.surface('cheekR', null, 0.02).p, 0.5);
    let A_, B_;
    if (a.key === 'top') { A_ = seat.clone().lerp(waist, 0.55); B_ = waist.clone().addScaledVector(down, -0.1 * s); }
    else if (a.key === 'bottoms') { A_ = waist.clone(); B_ = knees; }
    else { A_ = waist.clone().addScaledVector(down, 0.1 * s); B_ = thighs; }
    const lowering = a.key === 'top' ? a.to === 'up' : a.to === 'down';
    return lowering ? { from: A_, to: B_, bn, over: seat } : { from: B_, to: A_, bn, over: seat };
  }
  function callWord() {
    if (!cur || st.word) return;
    st.word = true; st.running = false; st.soothe = false; emit('word', { id: cur.id, word: cur.r.word });
    cur.gain.resentment += 0.12;      // (taken past what they could bear: over-correction is resented)
    say('subject', L.react(cur.id, 'word'), cur); cur.f.setExpr('crying');
    setTimeout(() => endTurn('word'), 900);
  }

  // ── Aftercare: the two of them sat on the bench, side by side, the crew member turned a little to the Captain ──
  // How thick a body's thigh and calf are (its own mesh, with its shape keys, at rest), for sitting two people side by side without one's legs
  // going through the other's: the outer reach of the skin from each bone's axis, plus the cloth over it.
  function limbRadii(F) {
    if (F._limbR) return F._limbR;
    const g = F.body.geometry, pos = g.attributes.position, mp = g.morphAttributes.position || [], inf = F.body.morphTargetInfluences || [], s = sc(F), R = F.rest;
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bi = n => F.body.skeleton.bones.indexOf(F.bone[n]), iT = bi('thighL'), iS = bi('shinL');
    const v = new V3(), d = new V3(), out = { thigh: [], shin: [] }, GET = ['getX', 'getY', 'getZ', 'getW'];
    const seg = (a, b, lo, hi, list) => { const ab = b.clone().sub(a), L2 = ab.lengthSq(); d.copy(v).sub(a); const t = d.dot(ab) / L2; if (t < lo || t > hi) return; list.push(d.addScaledVector(ab, -t).length()); };
    for (let i = 0; i < pos.count; i++) {
      // (only the skin that moves mostly with that bone: not the hands hanging beside the thighs, nor the other leg)
      let top = -1, w = 0; for (let k = 0; k < 4; k++) { const wk = sw[GET[k]](i); if (wk > w) { w = wk; top = si[GET[k]](i); } }
      if (top !== iT && top !== iS) continue;
      v.fromBufferAttribute(pos, i); for (let k = 0; k < mp.length; k++) if (inf[k]) v.x += mp[k].getX(i) * inf[k], v.y += mp[k].getY(i) * inf[k], v.z += mp[k].getZ(i) * inf[k];
      v.multiplyScalar(s);
      if (top === iT) seg(R.thighL, R.shinL, 0.3, 0.8, out.thigh); else seg(R.shinL, R.footL, 0.15, 0.6, out.shin);
    }
    // (most of the way out: the bulk of the limb's surface, not the odd vertex at the knee or the seat)
    const pc = a => { a.sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * 0.8)] : 0.07; };
    return (F._limbR = { thigh: pc(out.thigh) + 0.005, shin: pc(out.shin) + 0.005 });
  }
  // the nearest two segments come (a–b, c–d)
  function segDist(a, b, c, d) {
    const u = b.clone().sub(a), v = d.clone().sub(c), w = a.clone().sub(c), A = u.dot(u), B = u.dot(v), Cc = v.dot(v), D = u.dot(w), E = v.dot(w), den = A * Cc - B * B;
    let sN = den < 1e-9 ? 0 : clamp((B * E - Cc * D) / den, 0, 1), tN = Cc < 1e-9 ? 0 : (B * sN + E) / Cc;
    if (tN < 0) { tN = 0; sN = clamp(-D / A, 0, 1); } else if (tN > 1) { tN = 1; sN = clamp((B - D) / A, 0, 1); }
    return a.clone().addScaledVector(u, sN).distanceTo(c.clone().addScaledVector(v, tN));
  }
  // how far the crew member's near leg (their right) is into the Captain's (his left), hip, thigh and calf: 0 when they only touch. With the
  // leg over his, only the hips.
  function overlap(Cp, G, draped) {
    const rc = limbRadii(Cp), rg = limbRadii(G), j = (F, b) => W_(F, b);
    const cH = j(Cp, 'thighL'), cK = j(Cp, 'shinL'), cA = j(Cp, 'footL'), gH = j(G, 'thighR'), gK = j(G, 'shinR'), gA = j(G, 'footR');
    let o = 1.15 * (rc.thigh + rg.thigh) - Math.hypot(cH.x - gH.x, cH.z - gH.z);      // (the hips, a little broader than the thighs)
    if (!draped) o = Math.max(o, rc.thigh + rg.thigh - segDist(cH, cK, gH, gK), rc.shin + rg.shin - segDist(cK, cA, gK, gA), rc.thigh + rg.shin - segDist(cH, cK, gK, gA), rc.shin + rg.thigh - segDist(cK, cA, gH, gK));
    return o;
  }
  // their near leg over his: the knee over his thigh toward the knee, resting on it, the shin hanging down inside it, the foot off the deck
  function drapeLeg(G, k) {
    const rc = limbRadii(captain), rg = limbRadii(G), sG = sc(G);
    const cH = W_(captain, 'thighL'), cK = W_(captain, 'shinL'), top = cH.clone().lerp(cK, 0.7).addScaledVector(UP, rc.thigh + rg.shin * 0.85);
    const H_ = W_(G, 'thighR'), tl = G.bone.shinR.position.length() * sG, sl = G.bone.footR.position.length() * sG;
    const K = H_.clone().add(top.sub(H_).setLength(tl)), inward = toWorldDir(captain, -1, 0, 0), fwd = toWorldDir(captain, 0, 0, 1);
    const A = K.clone().addScaledVector(UP.clone().negate().addScaledVector(inward, 0.35).addScaledVector(fwd, 0.25).normalize(), sl);
    const A0 = W_(G, 'footR'), K0 = W_(G, 'shinR'); A0.lerp(A, k); K0.lerp(K, k);
    legTo(G, 'R', A0, K0.sub(H_.clone().lerp(A0, 0.5)).normalize());
    G.bone.footR.rotation.x += 0.5 * k;      // (the foot easing down, toes pointing)
    G.root.updateMatrixWorld(true);
  }
  function aftercare(id) {
    st.phase = 'after'; afterWith = people.find(p => p.id === id); cur = afterWith;
    afterWith.f.setClothes({ top: 'down', bottoms: 'up', under: 'up' }); emit('state');
  }

  // ── Cameras ──
  // Each position's own, placed in its frame (x to the left, z ahead): across the knee, the Captain's seat; standing, where they stand facing
  // what they hold; over the table, where they stand at its end; the aftercare's seat. Kept inside the room's walls; a room can give its own.
  const LOCAL_CAMS = {
    otk: [['Side', [0.05, 1.2, 2.4], [0.05, 0.76, 0.3]], ['Behind', [-1.4, 1.3, 0.67], [-0.05, 0.72, 0.3]], ['Seat', [-0.46, 1.5, 1.07], [-0.1, 0.82, 0.35]],
      ['Their face', [0.42, 0.36, 1.05], [0.24, 0.55, 0.36]], ['Captain', [0.3, 0.92, 0.95], [0.0, 1.18, 0.1]], ['Room', [1.5, 1.9, 1.5], [0.0, 0.7, 0.25]]],
    wall: [['Side', [-1.9, 1.4, -0.05], [0.1, 1.0, 0.1]], ['Behind', [-0.35, 1.2, -1.25], [0, 0.85, 0.15]], ['Seat', [-0.55, 1.25, -0.75], [0, 0.88, 0]],
      ['Their face', [-0.7, 1.05, 0.7], [0, 1.2, 0.5]], ['Captain', [-0.4, 1.42, -0.25], [0.43, 1.5, -0.07]], ['Room', [1.05, 1.9, -2.95], [-0.15, 0.8, -0.15]]],
    table: [['Side', [-1.8, 1.35, 0.35], [0, 0.85, 0.3]], ['Behind', [-0.3, 1.3, -1.4], [0, 0.85, 0.2]], ['Seat', [-0.45, 1.35, -0.7], [0, 0.9, 0.05]],
      ['Their face', [0.2, 1.15, 1.9], [0, 0.9, 0.7]], ['Captain', [-0.6, 1.45, 0.2], [0.5, 1.5, 0]], ['Room', [1.6, 1.9, -2.2], [0, 0.8, 0.3]]],
    after: [['Two-shot', [0.3, 1.0, 1.75], [0.3, 0.85, 0.0]], ['Close', [0.55, 1.05, 1.1], [0.3, 0.95, 0.0]]],
  };
  const BOUNDS = bay.bounds || { minX: -2.4, maxX: 2.4, minZ: -2.0, maxZ: 2.0 };
  const FRAMES = { otk: [OTK.seat, OTK.seatYaw], wall: [wall.at, wall.yaw], table: table ? [table.at, table.yaw] : null, after: [after.at, after.yaw] };
  const CAMS = {};
  for (const k in LOCAL_CAMS) {
    if (!FRAMES[k]) continue; const [at, yaw] = FRAMES[k];
    CAMS[k] = ((bay.cams && bay.cams[k]) || LOCAL_CAMS[k]).map(([n, p, l]) => [n, ...[p, l].map(v => { const w = inFrame(at, yaw, v[0], 0, v[2]); return [clamp(w.x, BOUNDS.minX, BOUNDS.maxX), v[1], clamp(w.z, BOUNDS.minZ, BOUNDS.maxZ)]; })]);
  }
  function camera(i, ms) {
    const set = CAMS[st.phase === 'after' ? 'after' : st.position]; st.cam = ((i % set.length) + set.length) % set.length;
    const [, p, l] = set[st.cam]; stage.go(new V3(...p), new V3(...l), ms == null ? 900 : ms);
    return set[st.cam][0];
  }

  // ── Each frame ──
  function update(dt) {
    st.t += dt; sayCool -= dt;
    if (cur && st.phase === 'turn') {
      dressing(dt); if (st.ending) ending(dt);
      advance(dt);
      const onSkin = st.swing && st.swing.phase === 'contact';
      cur.pain.update(dt, onSkin); if (st.soothe && !st.swing) cur.pain.soothe(dt * (1 + cur.rel.comfort) * (1 - 0.5 * cur.def));      // (soothing reaches them less while they're still defiant)
      react(dt);
      if (cur.pain.tooHarsh && !st.word) callWord();
      // the face: their band, flickering one on as a smack lands
      J.flick -= dt; const b = bandIndex();
      if (!st.word) {
        // (composed: their own face; then wincing, gritted teeth; past the edge, tears welling, the eyes screwed shut as each lands; and from
        // CRYING (1.7) on, crying steadily, eyes closed, tears streaking)
        const Dd = cur.pain.distress();
        let e = b === 0 ? (cur.r.base || 'calm') : FACE[Math.min(3, b - 1)];
        if (J.flick > 0) e = FACE[Math.min(3, b)];
        if (Dd >= S.PAIN.EDGE) e = J.flick > 0 || Dd >= S.PAIN.CRYING ? 'crying' : 'teary';
        if (st.soothe && !st.swing && b <= 2) e = b === 0 || cur.rel.desire > 0.35 ? 'shy' : 'teary';
        // (defiant: set against it, the teeth gritted once it's hard; soothed, sulking; as it breaks, tears)
        if (cur.def > 0.35 && b <= 3) e = st.soothe && !st.swing ? 'pout' : J.flick > 0 ? (b >= 2 ? 'gritted' : 'wince') : b >= 2 ? 'gritted' : 'defiant';
        if (cur.rx.broke > 0) e = 'crying';
        cur.f.setExpr(e);
      }
      if (st.soothe && !st.swing && !cur.said.soothe && sayCool <= 0) { cur.said.soothe = 1; say('subject', L.react(cur.id, 'soothe'), cur); }
    }
    if (cur && st.phase !== 'after' && st.phase !== 'over') { if (st.position === 'otk') { poseCaptain(dt); poseSubject(dt); } else { poseSubject(dt); poseCaptain(dt); } poseCaptainHands(dt); captain.setExpr(st.position === 'otk' || st.phase === 'turn' ? 'stern' : 'calm'); }
    else if (st.phase === 'after' && afterWith) {
      // sat side by side: they lean in, the head toward the Captain's shoulder, hands in their lap; the Captain's arm round them, the hand on
      // their far shoulder, the other hand on their own knee
      // (closer the more of all three there is between them; leaning in, their head to his shoulder and his to theirs, with submission and desire)
      // (but defiance still standing, or resentment, holds them off: further along the bench, not leaning in, arms folded if they're still
      // defiant, the head turned aside and up)
      const G = afterWith.f, Rl = afterWith.rel, resid = clamp((afterWith.def - 0.15) / 0.6, 0, 1), cold = Math.max(resid, clamp(Rl.resentment + afterWith.gain.resentment, 0, 1)), warmth = 1 - cold;
      const close = (1 - (1 - 0.7 * Rl.comfort) * (1 - 0.6 * Rl.submission) * (1 - 0.7 * Rl.desire)) * warmth, lean = Math.max(Rl.submission, Rl.desire) * warmth;
      // (with desire and comfort both high, their near leg over his: the knee over his thigh, the shin hanging inside it)
      const drape = sm(0.6, 0.75, Math.min(Rl.desire, Rl.comfort)) * warmth;
      const at0 = after.beside.clone().add(new V3(-0.06 - 0.2 * close + 0.07 * cold, 0, 0.02 - 0.04 * close).applyQuaternion(yawQ(after.yaw))), yawG = after.yaw - 0.3 - 0.15 * close + 0.2 * cold;
      const gOpt = { look: 0.3 + 0.22 * lean - 0.3 * resid, lean: 0.1 + 0.06 * lean - 0.08 * cold, roll: 0.14 + 0.1 * lean - 0.12 * cold, headRoll: 0.18 + 0.24 * lean - 0.18 * cold, headYaw: lerp(-0.2 - 0.15 * lean, 0.4, resid), spread: -0.03, seatY: after.seatY };
      // room for the two of them, measured from their bodies (so the broader get more): side by side, hip to hip and leg to leg, touching but
      // not through each other; moved along the bench away from him till they're clear
      seat(captain, after.at, after.yaw, { lean: 0.02, seatY: after.seatY });
      const away = W_(G, 'hips').sub(W_(captain, 'hips')).setY(0).normalize(); let push = 0;
      for (let i = 0; i < 5; i++) { seat(G, at0.clone().addScaledVector(away, push), yawG, gOpt); const o = overlap(captain, G, drape > 0.5); if (o <= 0.002) break; push += o; }
      if (drape > 0.01) drapeLeg(G, drape);
      // (the Captain looks at them: the head turned and tipped to their face, the shoulders a little with it. With their head on his shoulder his
      // body angles to take them, leaning a touch away so his head stays clear of theirs, and his face comes round almost to the front, only a
      // little toward them, his eyes on them)
      const ch = W_(captain, 'head'), dl = W_(G, 'head').addScaledVector(UP, 0.04).sub(ch);
      const dlL = dl.clone().applyQuaternion(yawQ(-after.yaw)), yawTo = clamp(Math.atan2(dlL.x, dlL.z), -1.3, 1.3), pitchTo = clamp(Math.atan2(-dl.y, Math.hypot(dl.x, dl.z)), -0.3, 0.6);
      const tw = yawTo * (0.2 + 0.12 * lean), face = yawTo * lerp(1.07, 0.14, lean), hy = face - 1.6 * tw;      // (the face's turn is the torso's twist, spine and chest, and the neck's)
      seat(captain, after.at, after.yaw, { look: pitchTo * lerp(0.8, 0.35, lean) + 0.06, headYaw: hy, twist: tw, roll: 0.06 * lean, headRoll: 0.07 * lean, lean: 0.02, seatY: after.seatY });
      const eyes = clamp((yawTo - face) * 1.4, -1, 1) * lerp(1, 0.55, lean);
      if (resid > 0.5) arms(G, 'fold');
      else for (const [sd, sx] of [['L', 1], ['R', -1]]) { const T = local(G, sx * 0.05, after.seatY + 0.16, 0.24); reach(G, sd, T, toWorldDir(G, sx * 0.3, -0.6, -0.5).normalize(),      // (the elbows in at their sides)
 UP.clone().negate(), toWorldDir(G, -sx * 0.6, 0, 1).normalize()); G.grip(sd, 0.4, 0, 0.4); }
      // the Captain's arm round them: the hand resting on their far shoulder, the elbow low behind their back; with submission and desire it
      // moves to between their shoulder blades and rubs there, slow circles. His other hand on his own knee. (Each hand on the skin: the palm on
      // the place, the wrist a hand's length back along the fingers.)
      const s = sc(captain), on = (F, k, fingers, lift) => { const c = F.surface(k, null, lift); const f = fingers.addScaledVector(c.n, -fingers.dot(c.n)).normalize(); return { W: c.p.clone().addScaledVector(c.n, 0.012).addScaledVector(f, -0.085 * s), n: c.n, f }; };
      const rub = sm(0.3, 0.75, lean), sh = on(G, 'shoulderL', toWorldDir(G, 0.2, -0.3, 1).normalize(), 0.004);
      const bl = on(G, 'blades', toWorldDir(G, 0.35, 1, 0).normalize(), 0.004), ph = st.t * 1.6;
      bl.W.addScaledVector(toWorldDir(G, 0, 1, 0), 0.022 * Math.sin(ph) * s).addScaledVector(toWorldDir(G, 1, 0, 0), 0.016 * Math.cos(ph) * s);
      const L_ = { W: sh.W.clone().lerp(bl.W, rub), n: sh.n.clone().lerp(bl.n, rub).normalize(), f: sh.f.clone().lerp(bl.f, rub).normalize() };
      // (held off, he gives them the room: both hands on his own knees; and his face keeps more of its authority till they soften)
      const onKnee = (sd, sx) => { const knee = W_(captain, 'shin' + sd).addScaledVector(UP, 0.05 * s), kf = toWorldDir(captain, -sx * 0.15, -0.2, 1).normalize();
        reach(captain, sd, knee.clone().addScaledVector(UP, 0.012).addScaledVector(kf, -0.085 * s), toWorldDir(captain, -sx, -0.4, -0.5).normalize(), UP.clone().negate(), kf); captain.grip(sd, 0.3, 0.1, 0.3); };
      if (cold > 0.5) onKnee('L', -1);
      else {
        // (the elbow low behind their back either way: reaching across to the far shoulder, or, rubbing, dropped by his side, the forearm up
        // their back)
        const pole = toWorldDir(G, 0.4, -0.7, -1).normalize().lerp(toWorldDir(G, -0.35, -1, -0.25).normalize(), rub).normalize();
        reach(captain, 'L', L_.W, pole, L_.n.clone().negate(), L_.f); captain.grip('L', 0.25 - 0.1 * rub, 0.12, 0.25);
      }
      // (his right: on his own knee; with their leg over his, on their knee instead, reaching across)
      const nearK = drape;
      if (nearK < 0.01) onKnee('R', 1);
      else {
        const kf0 = toWorldDir(captain, 0.15, -0.2, 1).normalize(), own = W_(captain, 'shinR').addScaledVector(UP, 0.062 * s).addScaledVector(kf0, -0.085 * s);
        const kf1 = toWorldDir(G, 0.5, -0.2, 0.8).normalize(), theirs = W_(G, 'shinR').addScaledVector(UP, 0.05 * sc(G) + 0.012).addScaledVector(kf1, -0.085 * s);
        const W = own.lerp(theirs, nearK).addScaledVector(UP, 0.05 * Math.sin(Math.PI * nearK)), kf = kf0.lerp(kf1, nearK).normalize();
        reach(captain, 'R', W, toWorldDir(captain, -1, -0.4, -0.5).normalize().lerp(toWorldDir(captain, -0.25, -0.7, 0.65).normalize(), nearK).normalize(), UP.clone().negate(), kf); captain.grip('R', 0.3, 0.1, 0.3);
      }
      if (cold > 0.3) captain.setExpr('caring', { look: eyes, brow: lerp(-0.1, -0.34, cold), browY: lerp(-0.03, -0.08, cold), mc: lerp(0.22, 0.04, cold) });
      else captain.setExpr(Rl.desire > 0.6 ? 'soft' : 'caring', { look: eyes });      // (care, warmth and authority in balance; softer where desire's between them)
    } else { stand(captain, inFrame(bench.at, bench.yaw || 0, 0.3, 0, 0.6), bench.yaw || 0, {}); }
    poseOthers(st.t);
    responses(dt);
    captain.tick(dt); for (const P of people) P.f.tick(dt);
    occlude();
  }

  // ── Whatever stands between the camera and the two in the middle (a fitting of the bay, someone watching) is hidden: moved to a layer the
  // camera doesn't draw, while still casting its shadow. What they're on (the bench, the rug, the deck) and the room's shell stay. ──
  const HIDDEN = 1;
  bay.group.traverse(o => { if (o.isLight && o.shadow) o.shadow.camera.layers.enable(HIDDEN); });
  // (each with its box, the wall it's on, and whether it's one of the big planes, the room's shell, which nothing can be behind)
  const fittings = bay.group.children.filter(o => !o.isLight).map(o => { const box = new THREE.Box3().setFromObject(o); return { o, box, side: bay.sideOf ? bay.sideOf.get(o) : null,
    inWay: box.max.y > 0.62 && [box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z].filter(d => d > 2.5).length < 2 }; })
    .filter(f => !f.box.isEmpty() && (f.side || f.inWay));
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
    // (a whole wall goes, with all that's on it, when the camera comes through it; anything else, if it's in the way)
    const sides = bay.sidesAt ? bay.sidesAt(cam) : new Set();
    for (const f of fittings) setHidden(f.o, (f.side && sides.has(f.side)) || (f.inWay && blocks(f.box)));
    // (people: a box round where their bones are now)
    for (const P of people) {
      if (P === cur || (st.phase === 'after' && P === afterWith)) { setHidden(P.f.root, false); continue; }
      _box.makeEmpty(); for (const b of ['head', 'handL', 'handR', 'footL', 'footR', 'hips']) _box.expandByPoint(W_(P.f, b)); _box.expandByScalar(0.1);
      setHidden(P.f.root, blocks(_box));
    }
  }

  const api = { limbRadii: F => limbRadii(F),
    st, captain, people, queue, witnesses, BANDS, AREAS, CAMS, bench, RESP, get captainResponse() { return capResp; },
    setRel(id, v) { const P = people.find(p => p.id === id); if (P) setRel(P, v); },
    get current() { return cur; },
    on: fn => listeners.push(fn),
    start() { beginTurn(0); camera(0, 0); },
    run(on) { if (!canRun()) { st.running = false; emit('state'); return; } st.running = on == null ? !st.running : !!on; if (st.running) st.soothe = false; emit('state'); },
    set(o) { if (st.ending && 'soothe' in o) delete o.soothe; Object.assign(st, o); if (o.soothe) st.running = false; emit('state'); },
    get busy() { return !!(st.act || st.actQ.length || st.ending); },
    next, cared(id) { const r = st.results.find(x => x.id === id); if (r) r.cared = true; },
    position(p) { if (st.position === p || (p === 'table' && !table)) return; st.position = p; st.swing = null; st.running = false; if (cur) { say('captain', L.place(cur.id, placeKey())); } camera(0); emit('state'); },
    positions: ['otk', 'wall'].concat(table ? ['table'] : []), support: sup.kind,
    dress(o) { if (cur && st.phase === 'turn' && !st.ending) dressTo(o); },
    endTurn: () => endTurn('done'), callWord, camera, aftercare, update,
    distress: () => (cur ? cur.pain.distress() : 0), band: () => (cur ? BANDS[bandIndex()] : ''), harshAt: S.PAIN.TOO_HARSH,
    fight: () => (cur ? cur.rx.fight : 1), agitation: () => (cur ? cur.rx.A : 0),
    defiance: () => (cur ? cur.def : 0), gains: () => (cur ? Object.assign({}, cur.gain) : null),
  };
  return api;
}

root.Session = { create };
})(typeof window !== 'undefined' ? window : globalThis);
