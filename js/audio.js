// Project Meridian — sound, all synthesised (no audio files), ported from Little Red’s Lessons: a cold ambient score, the ship's own hum and air,
// the correction's smacks and the cries of whoever is across the lap, and a speech babble for dialogue (a short vowel burst per word, pitched per speaker).
// Browsers only start audio after a tap or key press: call GameAudio.init() from one (the title screen's buttons do).
(function (root) {
'use strict';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const A = { ctx: null, vols: { master: 0.8, music: 0.25, sfx: 0.8, voice: 0.7 }, nodes: {} };
try { const v = JSON.parse(localStorage.getItem('meridian:volumes') || 'null'); if (v) Object.assign(A.vols, v); } catch (e) { /* no storage */ }

function noiseBuffer(ctx, seconds) {
  const n = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

A.init = function () {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return A.ctx; }
  const Ctx = root.AudioContext || root.webkitAudioContext; if (!Ctx) return null;
  const ctx = A.ctx = new Ctx(), N = A.nodes;
  N.master = ctx.createGain(); N.master.connect(ctx.destination);
  N.music = ctx.createGain(); N.sfx = ctx.createGain(); N.voice = ctx.createGain(); N.amb = ctx.createGain();
  for (const g of [N.music, N.sfx, N.voice, N.amb]) g.connect(N.master);
  // A little room for the music and the voices: one soft feedback echo.
  N.echo = ctx.createDelay(1); N.echo.delayTime.value = 0.32; const fb = ctx.createGain(); fb.gain.value = 0.34; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  N.echo.connect(lp); lp.connect(fb); fb.connect(N.echo); lp.connect(N.master);
  N.music.connect(N.echo);                                                  // (the echo is fed after the music's volume, so the slider and the ducking govern it too)
  N.noise = noiseBuffer(ctx, 3);
  A.setVol();
  return ctx;
};
A.setVol = function (k, v) {
  if (k) { A.vols[k] = clamp(v, 0, 1); try { localStorage.setItem('meridian:volumes', JSON.stringify(A.vols)); } catch (e) { /* no storage */ } }
  const N = A.nodes; if (!A.ctx) return;
  N.master.gain.value = A.vols.master; N.music.gain.value = A.vols.music * 0.5; N.sfx.gain.value = A.vols.sfx; N.voice.gain.value = A.vols.voice * 1.1; N.amb.gain.value = A.vols.sfx * 0.16;      // (the dialogue sits well above the wind, the birds and the fire)
};

// ── Music: slow procedural pieces for the ship. `A.startMusic({ theme })` begins one (or crossfades from the one playing); `A.stopMusic(secs)` fades it out. ──
//   drift (patrol): a cold sustained pad in D dorian over a sub drone, sparse sine bells that ring on in the echo — the long quiet of deep space.
//   briefing (bridge, morning/evening): a pulsing low ostinato and a held fifth, clinical and steady.
//   session (a private node): almost nothing — a sub drone and a slow heartbeat, so the room's own sounds carry.
//   after (aftercare): warm major sevenths on a soft triangle pad, slow.   alarm (a failure): a minor second, pulsing.
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const THEMES = {
  drift: { dt: 1.1, cut: 1400, play(step, t, tone, rnd) {
    const CH = [[38, 50, 57, 64], [36, 48, 55, 62], [41, 53, 60, 65], [43, 50, 57, 62]], bar = Math.floor(step / 8) % 4, chord = CH[bar], beat = step % 8, SC = [74, 76, 77, 79, 81, 83, 84, 86];
    if (beat === 0) { for (const m of chord.slice(1)) tone(hz(m), t, 9.6, 'sawtooth', 0.012, 3.2); tone(hz(chord[0] - 12), t, 9.8, 'sine', 0.09, 2.4); }
    if ((beat === 3 || beat === 6) && rnd() < 0.55) { const m = SC[Math.floor(rnd() * SC.length)]; tone(hz(m), t, 4.6, 'sine', 0.035); tone(hz(m) * 2.01, t, 1.2, 'sine', 0.008); } } },
  briefing: { dt: 0.42, cut: 1800, play(step, t, tone) {
    const R = [38, 38, 45, 38, 41, 38, 45, 43], bar = Math.floor(step / 16) % 4, beat = step % 16, lift = [0, 0, -2, 3][bar];
    tone(hz(R[beat % 8] + lift), t, 0.36, 'triangle', beat % 4 === 0 ? 0.06 : 0.035, 0.01);
    if (beat === 0) { tone(hz(62 + lift), t, 6.6, 'sawtooth', 0.01, 1.5); tone(hz(69 + lift), t, 6.6, 'sawtooth', 0.008, 1.5); } } },
  session: { dt: 0.9, cut: 700, play(step, t, tone) {
    const beat = step % 4;
    if (step % 16 === 0) tone(hz(31), t, 15, 'sine', 0.1, 4);
    if (beat === 0) { tone(hz(36), t, 0.28, 'sine', 0.13, 0.01); tone(hz(36), t + 0.24, 0.24, 'sine', 0.08, 0.01); } } },
  after: { dt: 1.0, cut: 1700, play(step, t, tone) {
    const CH = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 53, 59]], bar = Math.floor(step / 6) % 4, beat = step % 6, c = CH[bar];
    if (beat === 0) { for (const m of c) tone(hz(m), t, 6.4, 'triangle', 0.04, 1.2); tone(hz(c[0] - 12), t, 6.4, 'sine', 0.07, 1.2); }
    if (beat === 3) tone(hz(c[3] + 12), t, 3, 'sine', 0.03); } },
  alarm: { dt: 0.5, cut: 2400, play(step, t, tone) { if (step % 2 === 0) { tone(hz(69), t, 0.42, 'square', 0.03, 0.01); tone(hz(70), t, 0.42, 'square', 0.025, 0.01); } } },
};

A.startMusic = function (opts) {
  if (!A.ctx) return; const want = (opts && opts.theme) || (opts && 'drift'); if (A.musicOn && A.musicTheme === want) return;
  if (A.musicOn) A.stopMusic(2.2);
  A.musicOn = true; A.musicTheme = want; const ctx = A.ctx, N = A.nodes, T = THEMES[want] || THEMES.drift; let step = 0, next = ctx.currentTime + 0.1, seed = 7 + want.length * 13;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const sess = ctx.createGain(); sess.gain.value = 1; const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = T.cut; filt.connect(sess); sess.connect(N.music);
  N.musicFilter = filt; A.musicSess = sess; let alive = true; A.musicStop = () => { alive = false; };
  const tone = (f, t, dur, type, peak, atk) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + (atk || Math.min(0.6, dur * 0.3))); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(filt); o.start(t); o.stop(t + dur + 0.05);
  };
  const tick = () => {
    if (!alive) return;
    while (next < ctx.currentTime + 1.5) { T.play(step, next, tone, rnd); next += T.dt; step++; }
    setTimeout(tick, 400);
  };
  tick();
};
A.stopMusic = function (fade = 1.5) {
  A.musicOn = false; A.musicTheme = null; if (A.musicStop) A.musicStop(); A.musicStop = null; if (!A.ctx || !A.musicSess) return;
  const g = A.musicSess.gain, t = A.ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.0001, t + fade); A.musicSess = null;
};
A.duckMusic = function (to, secs = 1) { if (!A.ctx) return; const g = A.nodes.music, t = A.ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(Math.max(0.0001, A.vols.music * 0.5 * to), t + secs); };

// ── Ambience: the ship itself. air (the scrubbers' rush, 0..1), hum (the reactor's mains hum and the hull's low rumble), chatter (console blips and relays). ──
A.ambience = function (levels) {
  if (!A.ctx) return; const ctx = A.ctx, N = A.nodes; A.amb = Object.assign(A.amb || { air: 0, hum: 0, chatter: 0 }, levels);
  if (!N.airGain) {
    const src = ctx.createBufferSource(); src.buffer = N.noise; src.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5;
    N.airGain = ctx.createGain(); N.airGain.gain.value = 0; src.connect(bp); bp.connect(N.airGain); N.airGain.connect(N.amb); src.start();
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
    N.humGain = ctx.createGain(); N.humGain.gain.value = 0; N.humGain.connect(N.amb);
    for (const [f, g] of [[50, 0.5], [100, 0.28], [150, 0.1], [33, 0.6]]) { const o = ctx.createOscillator(), gg = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; gg.gain.value = g; o.connect(gg); gg.connect(N.humGain); o.start(); }
    const rsrc = ctx.createBufferSource(); rsrc.buffer = N.noise; rsrc.loop = true; const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 120; const rg = ctx.createGain(); rg.gain.value = 1.4; rsrc.connect(rlp); rlp.connect(rg); rg.connect(N.humGain); rsrc.start();
    const chirp = () => {
      const a = A.amb, t = ctx.currentTime;
      if (a.chatter > 0.02 && Math.random() < 0.5) {
        const n = 1 + Math.floor(Math.random() * 4), f0 = [880, 1320, 1760, 2093][Math.floor(Math.random() * 4)];
        for (let i = 0; i < n; i++) { const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * 0.09; o.type = 'square'; o.frequency.value = f0 * (i % 2 ? 1.5 : 1);
          g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.012 * a.chatter, s + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.06); o.connect(g); g.connect(N.amb); o.start(s); o.stop(s + 0.08); }
      }
      if (a.hum > 0.02 && Math.random() < 0.12) {       // a relay clacks somewhere in the bulkhead
        const s = t + Math.random() * 0.3, src2 = ctx.createBufferSource(); src2.buffer = N.noise; const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2400; hp.Q.value = 2;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.18 * a.hum, s + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.03); src2.connect(hp); hp.connect(g); g.connect(N.amb); src2.start(s, Math.random()); src2.stop(s + 0.05);
      }
      N.ambTimer = setTimeout(chirp, 300 + Math.random() * 900);
    };
    chirp();
  }
  const t = ctx.currentTime; N.airGain.gain.linearRampToValueAtTime(0.5 * A.amb.air, t + 1.5); N.humGain.gain.linearRampToValueAtTime(0.35 * A.amb.hum, t + 1.5);
};

// ── Effects: a smack (muffled through a wall when `muffle` is set) and her voice. ──────────────────────────────────────────────────────────────────
// A smack. muffle: false = bare skin in open air (a flat, bright slap with a crack and a little skin "pap"); true = through cloth (duller, with a thump);
// a number = a low-pass cutoff in Hz: a hand on bare skin heard through a wall, which opens up as the listener gets closer.
A.thwack = function (power, muffle, vol) {
  if (!A.init()) return; const ctx = A.ctx, N = A.nodes, t = ctx.currentTime + 0.01, k = vol == null ? 1 : vol, p = clamp(power, 0.2, 1.3);
  const clothed = muffle === true, cutoff = typeof muffle === 'number' ? muffle : clothed ? 1100 : 9000;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.6;
  const out = ctx.createGain(); out.gain.value = k * (1 + 0.5 * clamp(1 - cutoff / 6000, 0, 1)); lp.connect(out); out.connect(N.sfx);
  const burst = (start, len, peak, type, f, q) => {                                         // a slice of noise with a sharp edge and a quick decay
    const src = ctx.createBufferSource(); src.buffer = N.noise; const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, start); g.gain.linearRampToValueAtTime(peak, start + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, start + len);
    src.connect(flt); flt.connect(g); g.connect(lp); src.start(start, Math.random() * 2); src.stop(start + len + 0.02);
  };
  const tone = (start, f0, f1, len, peak) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, start); o.frequency.exponentialRampToValueAtTime(f1, start + len);
    g.gain.setValueAtTime(0.0001, start); g.gain.linearRampToValueAtTime(peak, start + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, start + len); o.connect(g); g.connect(lp); o.start(start); o.stop(start + len + 0.02);
  };
  if (clothed) { burst(t, 0.07, 0.5 * p, 'lowpass', 800, 0.5); tone(t, 170, 85, 0.12, 0.45 * p); return; }
  burst(t, 0.085, 0.9 * p, 'bandpass', 1500, 0.45);                                        // the flat of the palm, with some body to it
  burst(t + 0.002, 0.016, 0.5 * p, 'highpass', 3400, 0.7);                                  // the crack of the fingers
  burst(t + 0.011, 0.03, 0.25 * p, 'bandpass', 1200, 0.9);                                  // a second, softer slap as the hand settles
  tone(t, 380, 190, 0.09, 0.45 * p);                                                         // the "pap" of flesh
};
// The birch: the swish of the twigs through the air (call it as the arm comes down), and the sharp crack and scatter of them on bare skin.
A.swish = function (power, vol) {
  if (!A.init()) return; const ctx = A.ctx, N = A.nodes, t = ctx.currentTime + 0.005, k = vol == null ? 1 : vol, p = clamp(power, 0.3, 1.3);
  const src = ctx.createBufferSource(); src.buffer = N.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(1100, t); f.frequency.exponentialRampToValueAtTime(5200, t + 0.11);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32 * p * k, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  src.connect(f); f.connect(g); g.connect(N.sfx); src.start(t, Math.random() * 2); src.stop(t + 0.16);
};
A.birch = function (power, muffle, vol) {
  if (!A.init()) return; const ctx = A.ctx, N = A.nodes, t = ctx.currentTime + 0.01, k = vol == null ? 1 : vol, p = clamp(power, 0.2, 1.3), clothed = muffle === true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clothed ? 1500 : 11000; const out = ctx.createGain(); out.gain.value = k; lp.connect(out); out.connect(N.sfx);
  const burst = (start, len, peak, type, f, q) => { const src = ctx.createBufferSource(); src.buffer = N.noise; const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, start); g.gain.linearRampToValueAtTime(peak, start + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, start + len); src.connect(flt); flt.connect(g); g.connect(lp); src.start(start, Math.random() * 2); src.stop(start + len + 0.02); };
  burst(t, 0.05, 0.75 * p, 'highpass', 3600, 0.7);                                                  // the crack, high and thin
  burst(t + 0.001, 0.07, 0.55 * p, 'bandpass', 2300, 0.6);                                          // the sting of it
  for (let i = 0; i < 5; i++) burst(t + 0.006 + i * 0.006 + Math.random() * 0.004, 0.02, 0.25 * p, 'highpass', 4500 + Math.random() * 2000, 0.8);   // the twigs landing one after another
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(260, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.07);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22 * p, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o.connect(g); g.connect(lp); o.start(t); o.stop(t + 0.1);
};
// base: the voice's pitch at rest (Hz); a woman's by default. Her vowels sit a little higher with it.
// (A.cryPitch: where a cry sits, for how hard it landed and how far gone she is: what her words are pitched to, said over them)
A.cryPitch = (power, band, base) => { const b0 = base || 215; return b0 + 70 * (b0 / 125) * 0.8 * clamp(power, 0, 1.5) + 26 * band; };
A.voice = function (power, band, muffle, vol, base) {
  if (!A.init()) return; const ctx = A.ctx, N = A.nodes, k = (vol == null ? 1 : vol) * (muffle ? 2.2 : 1);
  const t0 = ctx.currentTime + 0.05 + Math.random() * 0.05, dur = [0.12, 0.2, 0.3, 0.42, 0.6, 0.6][band] || 0.3;
  const b0 = base || 215, f0 = A.cryPitch(power, band, b0) + Math.random() * 16, fm = b0 > 170 ? 1.15 : 1;
  const vowel = ([[420, 800], [760, 1150], [620, 1000], [700, 1100], [520, 920], [480, 880]][band] || [650, 1000]).map(f => f * fm);
  const osc = ctx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(f0, t0); osc.frequency.linearRampToValueAtTime(f0 * (band >= 3 ? 1.35 : band === 2 ? 1.12 : 0.9), t0 + dur);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = band >= 4 ? 7 : 5; lg.gain.value = band >= 4 ? f0 * 0.06 : f0 * 0.015; lfo.connect(lg); lg.connect(osc.frequency);
  const out = ctx.createGain(), peak = clamp(0.07 + 0.08 * power + 0.02 * band, 0.06, 0.28) * 3.6 * k;
  out.gain.setValueAtTime(0.0001, t0); out.gain.linearRampToValueAtTime(peak, t0 + 0.025); out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  for (const fc of vowel) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = 5; const g = ctx.createGain(); g.gain.value = fc === vowel[0] ? 1 : 0.6; osc.connect(f); f.connect(g); g.connect(out); }
  let dest = N.sfx; if (muffle) { const m = ctx.createBiquadFilter(); m.type = 'lowpass'; m.frequency.value = typeof muffle === 'number' ? muffle : 650; m.connect(N.sfx); dest = m; }
  out.connect(dest); osc.start(t0); lfo.start(t0); osc.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
};

// ── Speech babble: a vowel burst per word, so a line of dialogue is "spoken" over the length of its typing. who: a crew id, 'proctor', 'captain' or 'narrator' ──
const PITCH = { narrator: 150 };      // PENDING: the cast's voices (docs/alpha-plan.md); a speaker without one uses 160 Hz
A.speak = function (who, text, seconds, opts) {   // opts.muffle: heard through a wall (louder in the filter, to carry); opts.vol scales it; opts.pitch: in place of the speaker's own (Hz)
  if (!A.init()) return { stop() {} }; const ctx = A.ctx, N = A.nodes, base = (opts && opts.pitch) || PITCH[who] || 160, muffle = opts && opts.muffle;
  const words = text.split(/\s+/).filter(Boolean); let t = ctx.currentTime + 0.05; const step = seconds / Math.max(1, words.length), stopAt = t + seconds + 0.3, nodes = [];
  let dest = N.voice; if (muffle) { const m = ctx.createBiquadFilter(); m.type = 'lowpass'; m.frequency.value = (opts && opts.cutoff) || 520; m.connect(N.sfx); dest = m; }
  const vowels = [[700, 1100], [500, 1700], [350, 2300], [450, 800], [320, 900]];
  words.forEach((w, i) => {
    const s = t + i * step, len = clamp(0.05 + w.length * 0.018, 0.07, 0.2), v = vowels[(w.charCodeAt(0) + w.length) % vowels.length], q = /[?]$/.test(w) ? 1.18 : /[.!]$/.test(w) ? 0.88 : 1;
    const f0 = base * (0.92 + 0.16 * ((w.charCodeAt(w.length - 1) % 7) / 6)) * q;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, s); o.frequency.linearRampToValueAtTime(f0 * (q === 0.88 ? 0.9 : 1.05), s + len);
    g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.6 * (muffle ? 2 : 1) * ((opts && opts.vol) || 1), s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + len);
    for (const fc of v) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = 4; const gg = ctx.createGain(); gg.gain.value = fc === v[0] ? 1 : 0.5; o.connect(f); f.connect(gg); gg.connect(g); }
    g.connect(dest); o.start(s); o.stop(s + len + 0.05); nodes.push(o);
  });
  return { stop() { for (const o of nodes) { try { o.stop(); } catch (e) { /* already stopped */ } } } };
};
// A bell rung: a bright strike and a long hum, a few partials not quite in tune with each other, as a small cast bell has. (n: strokes)
A.blip = function () { if (!A.init()) return; const ctx = A.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 660; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); g.connect(A.nodes.sfx); o.start(t); o.stop(t + 0.15); };
// ── Ship sounds ──
// A pneumatic hatch: a hiss of escaping air and the clunk of the seal (open: hiss first; close: clunk first).
A.hatch = function (open, vol) {
  if (!A.init()) return; const ctx = A.ctx, N = A.nodes, t = ctx.currentTime + 0.01, k = vol == null ? 0.7 : vol;
  const hiss = s => { const src = ctx.createBufferSource(); src.buffer = N.noise; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600; const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.32 * k, s + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.55); src.connect(hp); hp.connect(g); g.connect(N.sfx); src.start(s, Math.random()); src.stop(s + 0.6); };
  const clunk = s => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(140, s); o.frequency.exponentialRampToValueAtTime(55, s + 0.18);
    g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.7 * k, s + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.3); o.connect(g); g.connect(N.sfx); o.start(s); o.stop(s + 0.35); };
  if (open) { clunk(t); hiss(t + 0.05); } else { hiss(t); clunk(t + 0.45); }
};
// The Proctor's comm chirp: two clean sine tones, up for attention, down for an evaluation.
A.comm = function (down) {
  if (!A.init()) return; const ctx = A.ctx, t = ctx.currentTime + 0.01;
  [0, 0.09].forEach((d, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = (down ? [1568, 1175] : [1175, 1568])[i];
    g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(0.07, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.14); o.connect(g); g.connect(A.nodes.sfx); o.start(t + d); o.stop(t + d + 0.16); });
};
// A scan: a rising sweep through a band-pass, for inspecting a system.
A.scan = function () {
  if (!A.init()) return; const ctx = A.ctx, t = ctx.currentTime + 0.01, src = ctx.createBufferSource(); src.buffer = A.nodes.noise; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 8;
  bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(4800, t + 0.7); const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
  src.connect(bp); bp.connect(g); g.connect(A.nodes.sfx); src.start(t, Math.random()); src.stop(t + 0.85);
};

root.GameAudio = A;
})(typeof window !== 'undefined' ? window : globalThis);