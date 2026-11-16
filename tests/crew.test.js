// The crew and what they say: every crew member is an adult, each has a safe word of their own, and every one has every scripted line and
// a full aftercare conversation; nobody but the subject says their safe word, and only when they call it.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const Crew = require('../js/crew.js'), Lines = require('../js/lines.js');

test('every crew member is an adult', () => { for (const id of Crew.IDS) assert.ok(Crew.ROSTER[id].age >= 18, id); });

test('each has their own safe word', () => {
  const words = Crew.IDS.map(id => Crew.ROSTER[id].word); assert.equal(new Set(words).size, words.length);
});

test('every crew member has every scripted line', () => {
  for (const id of Crew.IDS) for (const k of ['start', 'first', 'flinching', 'struggling', 'edge', 'past', 'plead', 'soothe', 'word', 'end']) assert.ok(Lines.react(id, k), id + ' ' + k);
});

test('the safe word is said only when it is called', () => {
  for (const id of Crew.IDS) {
    const w = Crew.ROSTER[id].word;
    assert.ok(Lines.react(id, 'word').includes(w), id);
    for (const k of ['start', 'first', 'flinching', 'struggling', 'edge', 'past', 'plead', 'soothe', 'end']) for (const t of [].concat(Lines.REACT[id][k])) assert.ok(!t.includes('{word}') && !t.includes(w), id + ' ' + k);
    for (const t of Lines.PLACE.otk.concat(Lines.PLACE.wall)) assert.ok(!t.includes('{word}'));
  }
});

test('aftercare: an opening, a choice of approach, an instruction, a last word, for either outcome', () => {
  for (const id of Crew.IDS) for (const outcome of ['done', 'word']) {
    const steps = Lines.after(id, outcome);
    assert.equal(steps.length, 4); assert.ok(steps[0].text); assert.equal(steps[1].choose.length, 3); assert.equal(steps[2].choose.length, 4); assert.ok(steps[3].text);
    for (const c of steps[1].choose.concat(steps[2].choose)) for (const s of c.then) assert.ok(s.text && !s.text.includes('{'), id);
  }
});

test('figure specs translate each baseline body to either sex', () => {
  for (const id of Crew.IDS) for (const sex of ['m', 'f']) {
    const s = Crew.figureSpec(id, sex, 'uniform');
    assert.equal(s.sex, sex); assert.ok(s.height > 1.5 && s.height < 2.0); assert.ok(s.hairStyle);
  }
});

test('defiance: each crew member has back-talk, a breaking line and a guarded aftercare opening; the Captain has his', () => {
  for (const id of Crew.IDS) {
    const r = Crew.ROSTER[id], w = r.word;
    assert.ok(r.meters.wilfulness >= 0 && r.meters.wilfulness <= 1, id);
    for (const k of ['defy', 'yield']) { assert.ok(Lines.react(id, k), id + ' ' + k); for (const t of Lines.REACT[id][k]) assert.ok(!t.includes('{word}') && !t.includes(w), id + ' ' + k); }
    const steps = Lines.after(id, 'done', 'unbroken'); assert.ok(Lines.AFTER[id].open.unbroken.includes(steps[0].text), id);
    assert.ok(Lines.after(id, 'word', 'unbroken')[0].text, id);      // (a safe word's opening comes first all the same)
  }
  for (const k of ['hands', 'pin', 'down', 'rail']) assert.ok(Lines.captain(k, 'pilot') && !Lines.captain(k, 'pilot').includes('{'), k);
  // (the pilot is the wilful one: high ego, high wilfulness)
  assert.equal(Crew.IDS.reduce((a, id) => (Crew.ROSTER[id].meters.wilfulness > Crew.ROSTER[a].meters.wilfulness ? id : a)), 'pilot');
});
