// The ship's day (js/day.js, js/daylines.js): the night watch goes round the bridge crew; someone always holds the ship; everyone is somewhere
// all day; the routine can be followed through to lights down; a step left too long is missed; and every scene, for every watch, has its
// lines filled in and its choices whole.
const test = require('node:test'), assert = require('node:assert/strict');
globalThis.window = globalThis;
const Crew = require('../js/crew.js'), Day = require('../js/day.js'), DayLines = require('../js/daylines.js');

test('the night watch goes round the bridge crew', () => {
  assert.deepEqual([1, 2, 3, 4].map(Day.watchFor), ['pilot', 'comms', 'scientist', 'pilot']);
});

test('someone holds the bridge from 22:00 until the morning briefing', () => {
  for (const day of [1, 2, 3]) {
    for (let t = 0; t < Day.T.briefing; t += 10) assert.ok(Day.present('bridge', t, day).includes(Day.watchFor(day)), `day ${day} ${Day.clock(t)}`);
    for (let t = Day.T.lights; t < 24 * 60; t += 10) assert.ok(Day.present('bridge', t, day).includes(Day.watchFor(day + 1)), `day ${day} ${Day.clock(t)}`);
  }
});

test('everyone is somewhere at every hour, in a room or their cabin', () => {
  const rooms = Object.keys(Day.ROOMS);
  for (const day of [1, 2, 3]) for (const id of Crew.IDS) for (let t = 0; t < 24 * 60; t += 15) {
    const w = Day.whereIs(id, t, day); assert.ok(rooms.includes(w.room) || w.room === Day.CABIN(id), `${id} ${Day.clock(t)} ${w.room}`);
  }
});

test('last night’s watch sleeps the morning; tonight’s rests in the afternoon', () => {
  const w0 = Day.watchFor(2), w1 = Day.watchFor(3);
  assert.ok(Day.whereIs(w0, 600, 2).asleep); assert.equal(Day.whereIs(w0, 760, 2).room, 'mess');
  assert.ok(Day.whereIs(w1, 900, 2).asleep); assert.equal(Day.whereIs(w1, 1120, 2).room, 'mess');
});

test('following the Proctor’s suggestions takes the day through to lights down, everything done', () => {
  const s = Day.fresh(1); s.at = 'captain';
  for (let i = 0; i < 40 && !s.over; i++) {
    const n = Day.next(s), r = n.kind === 'free' ? (Day.wait(s, n.at), Day.resolve(s, n.room)) : Day.resolve(s, n.room || 'captain');
    if (i === 0) { const w = Day.resolve(s, 'captain'); Day.start(s, w); Day.finish(s, w, 'captain'); continue; }
    assert.equal(r.kind, 'step', `${Day.clock(s.t)} ${n.room}`); Day.start(s, r); Day.finish(s, r, n.room);
  }
  assert.ok(s.over);
  for (const st of Day.STEPS) assert.equal(s.done[st.id], true, st.id);
  assert.deepEqual(Object.keys(s.missed), []);
});

test('a step left past its window is missed; a visit takes forty minutes', () => {
  const s = Day.fresh(1); s.t = Day.T.breakfast;
  const r = Day.resolve(s, 'reactor'); assert.equal(r.kind, 'visit');
  Day.start(s, r); Day.finish(s, r, 'reactor'); assert.equal(s.t, Day.T.breakfast + 40);
  Day.wait(s, Day.T.briefing + 1); assert.ok(s.missed.breakfast);
  assert.equal(Day.resolve(s, 'mess').kind, 'visit');
});

test('the rounds count room by room, and part-done when the morning ends', () => {
  const s = Day.fresh(1); s.t = Day.T.rounds;
  for (const room of ['reactor', 'hydro']) { const r = Day.resolve(s, room); assert.equal(r.kind, 'step'); Day.start(s, r); Day.finish(s, r, room); }
  assert.equal(Day.resolve(s, 'reactor').kind, 'visit');
  Day.wait(s, Day.T.lunch); assert.equal(s.done.rounds, 'part');
});

test('every scene has its lines filled in and its choices whole, for every watch and whoever’s there', () => {
  for (const day of [1, 2, 3]) {
    const s = Day.fresh(day);
    const scenes = [['wake', 'captain', Day.T.wake], ['breakfast', 'mess', Day.T.breakfast], ['briefing', 'bridge', Day.T.briefing], ['rounds:reactor', 'reactor', Day.T.rounds],
      ['rounds:hydro', 'hydro', Day.T.rounds], ['rounds:medbay', 'medbay', Day.T.rounds], ['rounds:suitbay', 'suitbay', Day.T.rounds], ['lunch', 'mess', Day.T.lunch], ['desk', 'ready', Day.T.desk],
      ['dinner', 'mess', Day.T.dinner], ['report', 'ready', Day.T.report], ['handover', 'bridge', Day.T.handover], ['lights', 'captain', Day.T.lights]];
    for (const [id, room, t] of scenes) {
      const x = { day, t, w0: Day.watchFor(day), w1: Day.watchFor(day + 1), here: Day.present(room, t, day).filter(i => !Day.whereIs(i, t, day).asleep), seen: {}, state: s };
      const steps = DayLines.scene(id, x); assert.ok(steps.length, `${id} day ${day}`);
      const check = list => { for (const st of list) {
        if (st.choose) { assert.ok(st.choose.length, `${id}: an empty choice, day ${day}`); for (const c of st.choose) { assert.ok(c.label && !/[{}]/.test(c.label), c.label); check(c.then); } continue; }
        assert.ok(st.text && !/[{}]|undefined/.test(st.text), `${id}: ${st.text}`);
        assert.ok(st.who === 'proctor' || st.who === 'captain' || x.here.includes(st.who) || st.radio, `${id}: ${st.who} speaks but isn't there (day ${day})`);
      } };
      check(steps);
    }
  }
});

test('an ordinary visit has something for everyone there, at any hour', () => {
  for (const room of Object.keys(Day.ROOMS)) for (let t = Day.T.wake; t < Day.T.lights; t += 30) {
    const x = { day: 1, t, w0: 'pilot', w1: 'comms', here: Day.present(room, t, 1).filter(i => !Day.whereIs(i, t, 1).asleep), seen: {}, state: Day.fresh(1) };
    const steps = DayLines.visit(room, x); assert.ok(steps.length, `${room} ${Day.clock(t)}`);
    for (const st of steps) if (!st.choose) assert.ok(st.text && !/[{}]|undefined/.test(st.text), `${room} ${Day.clock(t)}: ${st.text}`);
  }
});
