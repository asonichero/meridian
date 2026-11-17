// Project Meridian — the evening check-in (docs/proctor.md; GDD §3.5, §6.2): the Captain reports to the Proctor in the Ready Room, and the
// Proctor goes through the day. What it finds (the day's report: for now the set-up's stand-in), how it says it (its leaning), and, once it's
// hard light and cleared, what follows: authoritative, it holds the Captain to account, the roles reversed, the player choosing only how the
// Captain takes it and able to call their word; deferential, it goes through where the Captain might have done better and offers itself in
// the place of whoever was owed a correction that was missed or mishandled; balanced, the Captain chooses which.
//
//   Checkin.verdict(report) → { items, severity, owed }
//   Checkin.staging(stage, readyRoom, { captain, proctor: { sex, presence } | null, lean }) → the two of them before anything happens
//   Checkin.driver(session, verdict, { ask(i) }) → the Proctor at work in a correction it gives: update(dt), respond(kind), mood, position
(function (root) {
'use strict';
const THREE = root.THREE, V3 = THREE.Vector3;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// The day, weighed: what the Captain let slide, mishandled, or missed of their own. (The loop fills these in later.)
const WEIGHT = { slide: 0.3, harsh: 0.35, care: 0.25, protocol: 0.25 };
function verdict(rep) {
  rep = rep || {};
  const items = Object.keys(WEIGHT).filter(k => rep[k]);
  return { items, severity: clamp(items.reduce((a, k) => a + WEIGHT[k], 0), 0, 1), owed: items.filter(k => k === 'slide' || k === 'harsh' || k === 'care') };
}

// The two of them before anything happens: the Captain standing in front of the desk, as anyone called in does, at parade rest; the Proctor
// where its leaning puts it: authoritative, behind the desk in the Captain's own place; balanced, at the desk's corner; deferential, to one
// side and a step back, hands clasped in front. (A voice only: the Captain alone in the room.) Its forming, when it's first cleared for hard
// light: the image stuttering into solid.
const AT = { authoritative: [[1.2, 0.45], -Math.PI / 2, 'rest'], balanced: [[0.55, 1.85], -2.3, 'rest'], deferential: [[-0.05, 2.15], -2.6, 'clasp'] };
function staging(stage, bay, o) {
  const C = root.Crew, Fg = root.Figure, P = root.Poses, scene = stage.scene;
  const captain = Fg.make(C.captainSpec(o.captain)); scene.add(captain.root); captain.setClothes({ top: 'down', bottoms: 'up', under: 'up' });
  let proctor = null, mode = o.proctor ? o.proctor.presence : null, forming = 0, t = 0;
  if (o.proctor) { proctor = Fg.make(C.proctorSpec({ sex: o.proctor.sex })); scene.add(proctor.root); Fg.presence(proctor, mode); proctor.setClothes({ top: 'down', bottoms: 'up', under: 'up' }); proctor.setExpr(o.lean === 'authoritative' ? 'stern' : 'calm'); }
  const [pAt, pYaw, pArms] = AT[o.lean] || AT.balanced, capAt = new V3(-0.95, 0, 0.6), proAt = new V3(pAt[0], 0, pAt[1]);
  const W_ = P.W_;
  function pose() {
    const look = proctor ? W_(proctor, 'head') : new V3(1.2, 1.6, 0.6), a = Math.atan2(look.x - capAt.x, look.z - capAt.z) - Math.PI / 2;
    P.stand(captain, capAt, Math.PI / 2, { weight: 0.3, wide: 0.12, look: 0.05, headYaw: clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1.1, 1.1) * 0.8, lean: -0.02 }); P.arms(captain, 'rest');
    captain.root.updateMatrixWorld(true);
    if (proctor) {
      const h = W_(captain, 'head'), b = Math.atan2(h.x - proAt.x, h.z - proAt.z) - pYaw;
      P.stand(proctor, proAt, pYaw, { weight: 0.15, wide: 0.12, look: 0.08, headYaw: clamp(Math.atan2(Math.sin(b), Math.cos(b)), -1.0, 1.0) * 0.8 }); P.arms(proctor, pArms);
      if (mode === 'projected') proctor.root.position.y += 0.012;
      proctor.root.updateMatrixWorld(true);
    }
  }
  const mid = capAt.clone().lerp(proAt, 0.5);
  const cams = [['Two-shot', [-1.55, 1.55, 2.45], [mid.x, 1.35, mid.z]], ['Proctor', [capAt.x - 0.45, 1.6, capAt.z - 0.45], [proAt.x, 1.5, proAt.z]], ['Captain', [proAt.x + (capAt.x - proAt.x) * 0.25 + 0.3, 1.6, proAt.z + (capAt.z - proAt.z) * 0.25 + 0.4], [capAt.x, 1.5, capAt.z]]];
  const st = { cam: 0 };
  function camera(i, ms) { st.cam = ((i % cams.length) + cams.length) % cams.length; const [, p, l] = cams[st.cam]; stage.go(new V3(...p), new V3(...l), ms == null ? 900 : ms); return cams[st.cam][0]; }
  function update(dt) {
    t += dt;
    if (forming > 0) { forming -= dt; const m = forming <= 0 ? 'hardlight' : Math.floor(t * 9) % 3 === 0 ? 'hardlight' : 'projected'; if (m !== mode) { mode = m; Fg.presence(proctor, m); } }
    pose(); captain.tick(dt); if (proctor) proctor.tick(dt);
  }
  function form() { if (proctor) forming = 1.6; }
  function dispose() { scene.remove(captain.root); if (proctor) scene.remove(proctor.root); }
  pose();
  return { captain, proctor, cams, st, camera, update, form, dispose };
}

// The Proctor at work, correcting the Captain: as a player would run it. The position by how much is owed (a little: hands on the desk;
// more: over the desk; most: across its knee on the couch); what's owed is how far it takes them (a little, to flinching; more, to
// struggling; most, close to the edge; never past it), the pace and strength firmer the more it is; runs with a short pause between,
// soothing in the pauses only once they're close to the edge, and never for pushing back; trousers down once it's begun if more's owed,
// briefs too from halfway; the thighs as well toward the end when most is owed. Twice it pauses for the Captain's response (ask(i)):
// taking it brings the goal in; pushing back takes it further (never past the edge) and firmer; silence, it checks in and goes on.
const positionFor = v => (v.severity < 0.34 ? 'wall' : v.severity < 0.67 ? 'table' : 'otk');
function driver(ses, v, o) {
  // (what's owed, as how far it takes them: a little, to flinching; more, to struggling; most, close to the edge; never past it. The pace and
  // strength firmer the more is owed.)
  const st = { mood: 'accept', goal: clamp(0.4 + 0.6 * v.severity, 0.35, 0.98), cap: 160, asked: 0, waiting: false, dressed: 0, pause: 1.6, runStart: 0, runLen: 8, done: false };
  const position = positionFor(v);
  ses.set({ pace: clamp(1.0 + 0.5 * v.severity, 1, 1.5), strength: clamp(1.0 + 0.5 * v.severity, 1, 1.5), area: 'sitspot', side: 'alt', soothe: false });
  function update(dt) {
    const c = ses.current; if (st.done || !c || ses.st.phase !== 'turn' || ses.st.word || ses.st.ending) return;
    if (ses.busy || st.waiting) return;
    const hits = c.hits, D = ses.distress(), k = D / st.goal;
    // (twice it waits on the Captain: once it's begun, and again partway there)
    if (st.asked < 2 && (st.asked === 0 ? hits >= 4 : k >= 0.55)) { st.waiting = true; ses.run(false); ses.set({ soothe: false }); const i = st.asked++; if (o.ask) o.ask(i); return; }
    if (st.dressed === 0 && hits >= 3 && v.severity >= 0.3) { st.dressed = 1; ses.run(false); ses.dress({ bottoms: 'down' }); return; }
    if (st.dressed === 1 && k >= 0.3 && v.severity >= 0.5) { st.dressed = 2; ses.run(false); ses.dress({ under: 'down' }); return; }
    if (v.severity >= 0.65 && k >= 0.75 && ses.st.area !== 'thighs') ses.set({ area: 'thighs' });
    if (D >= st.goal || hits >= st.cap) { st.done = true; ses.run(false); ses.set({ soothe: true }); setTimeout(() => ses.endTurn(), 2400); return; }
    // (a short pause between runs, the hand only resting there; soothing only once it's close to the edge, and not for pushing back)
    if (ses.st.running) {
      if (hits - st.runStart >= st.runLen) { ses.run(false); st.pause = st.mood === 'defy' ? 0.8 : 1.2 + 0.5 * Math.random(); if (st.mood !== 'defy' && D > 0.8) ses.set({ soothe: true }); }
    } else {
      st.pause -= dt;
      if (st.pause <= 0) { ses.set({ soothe: false }); st.runStart = hits; st.runLen = 7 + Math.floor(Math.random() * 5); ses.run(true); }
    }
  }
  // (taking it: a little less; pushing back: further, and firmer, though never past the edge; silence: as it was)
  function respond(kind) {
    st.mood = kind; st.waiting = false; st.pause = 1.2;
    const c = ses.current;
    if (kind === 'accept') st.goal = Math.max(0.3, st.goal - 0.1);
    if (kind === 'defy') { st.goal = Math.min(0.98, st.goal + 0.15); ses.set({ strength: clamp(ses.st.strength + 0.15, 1, 1.6) }); if (c) c.def = Math.max(c.def, 0.6); }
  }
  return { update, respond, position, get mood() { return st.mood; }, get done() { return st.done; } };
}

root.Checkin = { verdict, staging, driver, positionFor, WEIGHT };
})(typeof window !== 'undefined' ? window : globalThis);
