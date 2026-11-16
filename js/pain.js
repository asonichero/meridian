// Project Meridian — the pain model, ported unchanged in its workings from Little Red’s Lessons (and Climbing Toward Consequence before it): each
// smack adds a sharp sting (which fades in seconds) and a deep ache (which fades over minutes); distress is their total against how much the subject
// can take, and the band it falls in drives their reactions (expression, kicking, voice). Clothing takes the edge off the sting only. Implements and
// garments are pending (docs/alpha-plan.md).
// Standalone: it needs nothing from the old engine. Exposes root.Pain = { PAIN, createPain }.
(function (root) {
'use strict';
const PAIN = {
  // base: pain of a full-strength smack at standard speed; sting: the share that is sharp (fades fast).
  // PENDING: Meridian's implements aren't in the GDD (docs/alpha-plan.md); only the hand, as redlessons has it, until they're decided.
  implement: {
    hand: { base: 0.8, sting: 0.55 },
  },
  TAU_STING: 3.0, TAU_ACHE: 120,         // seconds for the sting and the ache to fall by 1/e, at resilience 0.5
  RESIST: 0.5,                          // resilience takes up to this share off every smack
  SPEED_EXP: 1.0,                        // pain ∝ speed ^ this
  ANTIC_MAX: 0.6, ANTIC_TAU: 1.0,        // dread adds up to this share, building over this many seconds of waiting
  DWELL_RATE: 0.9, DWELL_MAX: 2.0,      // staying on the skin adds this share of the smack per second, up to this many seconds
  TENDER: 0.6,                           // fully marked skin hurts this much more
  // What clothing takes off the sting (the sharp part; the deep ache goes through cloth untouched): by garment, stacking.
  CUSHION: {}, CUSHION_MAX: 0.7,   // PENDING: what's worn in a session isn't in the GDD; garments and how much each cushions are added once decided
  CAP: 70,                               // the capacity at tolerance 0.5 is CAP × (0.7 + 0.6 × tolerance)
  // Distress at the edge of resistance, and where it's too harsh. Meridian raises redlessons' bar (1.5) and asks that it be held a moment
  // (HARSH_HOLD seconds) before it counts, or overshot by a quarter, so a correction can run long without tripping it: since the player is the
  // one who disciplines, this is what the crew member's safe word is called on (js/session.js).
  EDGE: 1, TOO_HARSH: 1.8, HARSH_HOLD: 1.2, HARSH_SPIKE: 1.25,
  // Up to the edge, distress is the pain they hold against what they can take. Past it, it grows with the pain's logarithm: each step further
  // takes more than the last, so the stretch from the edge to too harsh is far longer than the way to the edge (too harsh at HARSH_RAW times
  // the edge's pain, rather than 1.8). A correction can settle well past the edge for a long while, the fight going out of them, without tipping.
  HARSH_RAW: 4,
  BANDS: [[0.3, 'composed'], [0.6, 'flinching'], [0.9, 'struggling'], [1, 'close to the edge of resistance'], [1.8, 'past the edge of resistance: most receptive'], [Infinity, 'too harsh']],
};

// Distress from the pain held (as a share of capacity), and back.
const LOGK = () => (PAIN.TOO_HARSH - PAIN.EDGE) / Math.log(PAIN.HARSH_RAW / PAIN.EDGE);
const perceive = x => (x <= PAIN.EDGE ? x : PAIN.EDGE + LOGK() * Math.log(x / PAIN.EDGE));
const rawAt = d => (d <= PAIN.EDGE ? d : PAIN.EDGE * Math.exp((d - PAIN.EDGE) / LOGK()));

function createPain(stats = {}) {
  const st = { tolerance: 0.5, resilience: 0.5, ...stats };
  const P = { stats: st, sting: 0, ache: 0, hits: 0, last: null, dwell: 0, atEdge: false, atLimit: false, tooHarsh: false, peak: 0, over: 0 };
  P.capacity = () => PAIN.CAP * (0.7 + 0.6 * st.tolerance);
  P.level = () => P.sting + P.ache;
  P.raw = () => P.level() / P.capacity();
  P.distress = () => perceive(P.raw());
  // How receptive they are to the lesson: little while composed, building as they struggle, fullest from the edge of resistance to half again past it, and gone once it's too harsh.
  P.receptivity = () => { const d = P.distress(), t = Math.max(0, Math.min(1, (d - 0.5) / 0.5)), r = 0.15 + 0.85 * t * t * (3 - 2 * t); return d < PAIN.TOO_HARSH ? r : 0; };
  P.inEdge = () => { const d = P.distress(); return d >= PAIN.EDGE && d < PAIN.TOO_HARSH; };
  const mark = (dt) => { const d = P.distress(); if (d >= PAIN.EDGE) P.atEdge = P.atLimit = true; P.over = d >= PAIN.TOO_HARSH ? P.over + (dt || 0) : 0; if (P.over >= PAIN.HARSH_HOLD || d >= PAIN.TOO_HARSH * PAIN.HARSH_SPIKE) P.tooHarsh = true; };
  P.band = () => PAIN.BANDS.find(([max]) => P.distress() < max)[1];
  // A smack lands. info: { implement, strength (0–1), speed (1 = standard), raised (seconds the arm waited raised), tender (0–1), cushion (0–1) }.
  // Returns { pain, reaction }: this smack's pain, and how hard they react (0–1) given it and how they already are.
  P.hit = info => {
    const cushion = Math.max(0, Math.min(PAIN.CUSHION_MAX, info.cushion || 0));
    const I = PAIN.implement[info.implement] || PAIN.implement.hand;
    const speed = Math.max(0.2, info.speed == null ? 1 : info.speed);
    const antic = PAIN.ANTIC_MAX * (1 - Math.exp(-(info.raised || 0) / PAIN.ANTIC_TAU)) * (1 - 0.5 * st.tolerance);
    const p = I.base * (info.strength == null ? 1 : info.strength) * Math.pow(speed, PAIN.SPEED_EXP) * (1 + antic)
      * (1 + PAIN.TENDER * (info.tender || 0)) * (1 - PAIN.RESIST * st.resilience);
    // Clothing blunts the sting only: the sharp share is cut, the ache comes through whole.
    const sting = p * I.sting * (1 - cushion), ache = p * (1 - I.sting), eff = sting + ache;
    P.sting += sting; P.ache += ache;
    P.hits++; P.dwell = 0; P.last = { sting, ache, p: eff, cushion };
    P.peak = Math.max(P.peak, P.distress());
    mark();
    // The reaction: how big this smack is against what they can take, how worked up they already are, and how long they waited for it.
    const reaction = Math.max(0, Math.min(1, 0.2 + 0.8 * (0.5 * eff / (0.3 * P.capacity()) + 0.35 * Math.min(1, P.distress()) + 0.15 * (antic / PAIN.ANTIC_MAX))));
    return { pain: eff, reaction, cushion };
  };
  // Every frame. `onSkin`: the hand or the implement is still on the skin from the last smack.
  P.update = (dt, onSkin = false) => {
    if (onSkin && P.last && P.dwell < PAIN.DWELL_MAX) {
      const d = Math.min(dt, PAIN.DWELL_MAX - P.dwell);
      P.sting += P.last.sting * PAIN.DWELL_RATE * d; P.ache += P.last.ache * PAIN.DWELL_RATE * d; P.dwell += d;
    }
    const k = 0.5 + st.resilience;   // the fade rate: resilient people recover faster
    P.sting *= Math.exp(-dt * k / PAIN.TAU_STING); P.ache *= Math.exp(-dt * k / PAIN.TAU_ACHE);
    mark(dt);
  };
  P.reset = () => { P.sting = P.ache = 0; P.hits = 0; P.last = null; P.dwell = 0; P.atEdge = P.atLimit = P.tooHarsh = false; P.peak = 0; P.over = 0; };
  // Soothing: a palm in slow circles takes the edge off the sting (faster than it fades by itself), and a little of the ache.
  P.soothe = dt => { P.sting *= Math.exp(-dt * 0.6); P.ache *= Math.exp(-dt * 0.004); };
  return P;
}

const api = { PAIN, createPain, perceive, rawAt };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Pain = api;
})(typeof window !== 'undefined' ? window : globalThis);
