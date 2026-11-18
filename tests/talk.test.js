// A conversation played through (js/talk.js): lines of inquiry can be worked through one by one, each gone once taken (with its group), or
// the conversation ended at any point; once they're all explored it ends by itself; a single decision is just that.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const Talk = require('../js/talk.js');

// (a player who picks by label, in order, and a record of what was said and offered)
function run(steps, picks) {
  const said = [], offered = [], took = [];
  const io = {
    line: async (s, hold) => { said.push([s.text, hold]); },
    choose: async options => { offered.push(options.map(o => o.label)); const want = picks.shift(); const o = options.find(x => x.label === want); assert.ok(o, `"${want}" not offered: ${options.map(x => x.label).join(' | ')}`); return o; },
    took: o => took.push(o.label),
  };
  return Talk.play(steps, io).then(() => ({ said, offered, took }));
}
const menu = () => [
  { text: 'Hello.' },
  { explore: true, choose: [
    { label: 'A', then: [{ text: 'a' }] },
    { label: 'B', then: [{ text: 'b' }] },
    { label: 'Yes', group: 'q', then: [{ text: 'yes' }] },
    { label: 'No', group: 'q', then: [{ text: 'no' }] },
    { label: 'Bye', after: 'Bye, then', end: true, then: [{ text: 'bye' }] },
  ] },
  { text: 'After.' },
];

test('lines of inquiry come back, less what’s been asked, until they’re all asked', async () => {
  const r = await run(menu(), ['A', 'B', 'Yes']);
  assert.deepEqual(r.offered, [['A', 'B', 'Yes', 'No', 'Bye'], ['B', 'Yes', 'No', 'Bye, then'], ['Yes', 'No', 'Bye, then']]);
  // (all asked: the one way to end it is taken by itself, and the conversation goes on)
  assert.deepEqual(r.said.map(s => s[0]), ['Hello.', 'a', 'b', 'yes', 'bye', 'After.']);
  assert.deepEqual(r.took, ['A', 'B', 'Yes', 'Bye']);
});

test('the choices come up under the last line while there’s more to ask', async () => {
  const r = await run(menu(), ['A', 'Bye, then']);
  assert.deepEqual(r.said, [['Hello.', 'choices'], ['a', 'choices'], ['bye', 'click'], ['After.', 'click']]);
});

test('the conversation can be ended at any point', async () => {
  const r = await run(menu(), ['Bye']);
  assert.deepEqual(r.said.map(s => s[0]), ['Hello.', 'bye', 'After.']);
});

test('two answers to the same thing: one taken, both gone', async () => {
  const r = await run(menu(), ['No', 'A', 'Bye, then']);
  assert.deepEqual(r.offered[1], ['A', 'B', 'Bye, then']);
});

test('with several ways to end it, the player chooses once the questions are done', async () => {
  const steps = [{ text: 'Q?' }, { explore: true, choose: [{ label: 'Ask', then: [{ text: 'ans' }] }, { label: 'End 1', end: true, then: [] }, { label: 'End 2', end: true, then: [{ text: 'e2' }] }] }];
  const r = await run(steps, ['Ask', 'End 2']);
  assert.deepEqual(r.offered, [['Ask', 'End 1', 'End 2'], ['End 1', 'End 2']]);
  assert.deepEqual(r.said.map(s => s[0]), ['Q?', 'ans', 'e2']);
});

test('a single decision is one choice, and on', async () => {
  const steps = [{ text: 'Which?' }, { choose: [{ label: 'X', then: [{ text: 'x' }] }, { label: 'Y', then: [{ text: 'y' }] }] }, { text: 'Done.' }];
  const r = await run(steps, ['Y']);
  assert.deepEqual(r.said.map(s => s[0]), ['Which?', 'y', 'Done.']);
});
