// Project Meridian — a conversation played through (day.html, session.html): lines in turn, and choices between them.
//
// A choice is one of two kinds:
// - A single decision (how the Captain relieves the watch, which side they take, the instruction after aftercare): one is taken, its lines
//   follow, and the conversation goes on.
// - Lines of inquiry (explore: true): the player works through them one at a time, coming back to what's left after each. Each is gone once
//   it's taken, along with any other in its group (two ways of answering the same thing). An option marked end closes the conversation
//   (its lines first) and is always on offer; once every line of inquiry is explored, the conversation ends there (a single end option
//   left is taken by itself; several, the player chooses how it ends). An option's `after` is its label once something has been explored
//   ("Just looking in." becomes "I'll let you get on.").
//
//   await Talk.play(steps, { line(step, hold) → Promise, choose(options, prompt) → Promise<option>, took(option) })
//   hold: 'click' (wait for the player) or 'choices' (the choices come up under it). prompt: what the box says over a choice that comes
//   first, with nothing said before it.
(function (root) {
'use strict';
const hasChoice = s => !!(s && s.choose && s.choose.length);

async function play(steps, io, tail) {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i], last = i === steps.length - 1, after = last ? tail : hasChoice(steps[i + 1]) ? 'choices' : 'click';
    if (s.choose) {
      if (!s.choose.length) continue;
      if (s.explore) await explore(s, io, after, i === 0);
      else { const o = await io.choose(s.choose, s.prompt || (i === 0 ? ' ' : null)); io.took(o); await play(o.then || [], io, after); }
      continue;
    }
    await io.line(s, after || 'click');
  }
}

async function explore(s, io, after, opening) {
  let left = s.choose.slice(), first = true;
  for (;;) {
    const inq = left.filter(o => !o.end), ends = left.filter(o => o.end);
    if (!inq.length) {
      if (!ends.length) return;
      if (ends.length === 1 && !first) { io.took(ends[0]); await play(ends[0].then || [], io, after); return; }
    }
    const shown = inq.concat(ends).map(o => Object.assign({}, o, { label: !first && o.after ? o.after : o.label, src: o }));
    const pick = await io.choose(shown, first ? s.prompt || (opening ? ' ' : null) : null), o = pick.src || pick;
    io.took(o);
    if (o.end) { await play(o.then || [], io, after); return; }
    left = left.filter(x => x !== o && !(o.group && x.group === o.group));
    // (what follows this one: the choices again, under its last line, while there's more to ask or more than one way to end; the one way
    // left to end it, after a click; nothing left, whatever comes next)
    const more = left.some(x => !x.end), endsLeft = left.filter(x => x.end).length;
    await play(o.then || [], io, more || endsLeft > 1 ? 'choices' : endsLeft === 1 ? 'click' : after);
    first = false;
  }
}

const api = { play };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Talk = api;
})(typeof window !== 'undefined' ? window : globalThis);
