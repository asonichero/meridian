// Project Meridian — a correction, scripted (ported from Little Red’s Lessons' js/discipline.js): the corrector works through the stages of a tier,
// talking between and over the smacks. The four tiers (Token, Light, Firm, Severe) and their counts are redlessons' as they stand.
// PENDING (docs/alpha-plan.md): the GDD doesn't say what a Meridian session's stages are (positions, clothing, implements), nor the corrector's
// lines, nor whether safe words carry over. So a stage's `wear` is opaque here (whatever the scene says), and lines come from the caller (env.lines).
//
//   const r = await Discipline.run(session, 'firm', { lines, subject: { name, word, react }, implement, implementFrom,
//     stages: [...] (in place of the tier's), say: (text, kind, i) => …, react: (text) => …, sleep: ms => … })
//   → { hits, peak, stopped, tooHarsh, done, implement }
//
// The safe word (as redlessons; whether Meridian keeps it is pending) is the subject's own. Said at any point (session.safeword()), it ends at once, wherever it is, and the corrector's
// closing line answers it: the only line that says it. Amber (session.amber()) is a check-in: answered, and gentler from then on. At "too harsh"
// nothing more is struck and it stops.
(function (root) {
'use strict';
const TIERS = ['token', 'light', 'firm', 'severe'];
const TIER_NAMES = { token: 'Token', light: 'Light', firm: 'Firm', severe: 'Severe' };
const SCRIPTS = {      // (counts and strengths as redlessons; wear: null = unchanged, pending the stages)
  token:  [{ wear: null, n: 6, str: 0.7 }],
  light:  [{ wear: null, n: 10, str: 0.85 }, { wear: 1, n: 10, str: 0.85 }],
  firm:   [{ wear: null, n: 10, str: 1 }, { wear: 1, n: 12, str: 1 }, { wear: 2, n: 12, str: 1 }],
  severe: [{ wear: null, n: 10, str: 1 }, { wear: 1, n: 12, str: 1 }, { wear: 2, n: 12, str: 1.05 }, { wear: 2, n: 12, str: 1.1 }],
};
const total = tier => (SCRIPTS[tier] || []).reduce((a, s) => a + s.n, 0);
// The stage's line as it begins: what changes from the stage before (the first opens with the start line).
function stageKey(prev, s, implNow, implPrev) {
  if (!prev) return 'start';
  if (implNow && !implPrev) return 'implement';
  if (s.wear != null && s.wear !== prev.wear) return 'wear';
  return null;
}

async function run(ses, tier, env) {
  env = env || {};
  const script = env.stages || SCRIPTS[tier]; if (!script) throw new Error('Discipline: unknown tier ' + tier);
  const lines = env.lines || {}, s = env.subject || { name: '', word: '', react: { during: [] } };
  const own = env.implement || null, from = env.implementFrom == null ? script.length - 1 : env.implementFrom;
  const say = env.say || (() => {}), react = env.react || (() => {}), sleep = env.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const line = (k, i) => { let t = lines[k]; if (Array.isArray(t)) t = t[(i || 0) % t.length]; return t ? t.replace(/\{name\}/g, s.name).replace(/\{word\}/g, s.word) : null; };
  const tell = (k, i) => { const t = line(k, i); return t ? say(t, k, i || 0) : null; };
  const stopped = () => ses.st.word || ses.st.ended || ses.pain.tooHarsh;
  const idle = async () => { while (ses.busy() && !ses.st.word && !ses.st.ended) await sleep(50); };
  let ease = 1;
  const checkIn = async () => { if (!ses.st.amber) return; ses.st.amber = false; ease *= 0.75; tell('amber'); await sleep(1800); };
  let prev = null, chat = 0, used = false;
  for (let k = 0; k < script.length; k++) {
    const st = script[k]; if (stopped()) break;
    const implNow = !!own && k >= from, implPrev = !!own && k - 1 >= from && k > 0;
    ses.set({ wear: st.wear, implement: implNow ? own : 'hand', strength: st.str * ease });
    if (implNow) used = true;
    const key = stageKey(prev, st, implNow, implPrev);
    if (key) { tell(key); await sleep(1600); if (key === 'start' && s.react && s.react.start) { react(s.react.start); await sleep(1300); } }
    if (stopped()) break;
    let left = st.n;
    while (left > 0 && !stopped()) {
      const n = Math.min(left, 4 + (chat % 3));
      ses.run(n); await idle(); left -= n;
      await checkIn(); ses.set({ strength: st.str * ease });
      if (left > 0 && !stopped()) {
        if (chat % 2 === 1 && s.react && s.react.during && s.react.during.length) react(s.react.during[(chat >> 1) % s.react.during.length]); else tell('during', chat >> 1);
        chat++; await sleep(900);
      }
    }
    prev = st;
  }
  const word = !!ses.st.word, tooHarsh = !word && !!ses.pain.tooHarsh, closed = !word && !tooHarsh && ses.st.ended, done = !word && !tooHarsh && !closed;
  const out = { hits: ses.st.hits, peak: ses.st.peak, stopped: word, tooHarsh, done, implement: used ? own : null, tier };
  if (closed) return out;
  const said = tell(word ? 'stop' : tooHarsh ? 'harsh' : 'done');
  if (!done && said && said.then) await said;
  if (done) { await sleep(1800); tell('after'); }
  ses.end();
  return out;
}

const api = { TIERS, TIER_NAMES, SCRIPTS, total, stageKey, run };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Discipline = api;
})(typeof window !== 'undefined' ? window : globalThis);
