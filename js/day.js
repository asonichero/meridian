// Project Meridian — the ship's day, before the shear (docs/day.md): the clock, the Captain's routine, where everyone is through it, the night
// watch (the bridge crew in turn), and what the Captain has done so far today. Logic only: the page (day.html) draws it on the deck plan
// (js/deckplan.js) and plays each visit (js/visit.js, js/daylines.js).
//
// The clock moves with what the Captain does, never in real time: a step of the routine takes its own time; otherwise arriving somewhere takes
// a few minutes, and what the Captain does there its own (talking to someone, watching them at work, looking something over).
// The Proctor suggests what's next; where the Captain goes is the player's choice. A step not begun by the end of its window is missed (on an
// ordinary day nothing follows from that but the Proctor noting it at the evening report).
//
//   Day.fresh(day) → a new day's state · Day.whereIs(id, t, day) → { room, doing, outfit, asleep, station, meal, off }
//   Day.present(room, t, day) → the crew there · Day.resolve(state, room) → { kind: 'step', step, sub } | { kind: 'visit' } | { kind: 'shut' }
//   Day.start(state, r) · Day.finish(state, r) · Day.next(state) → { kind, step, room, at } · Day.wait(state, to) · Day.light(t) · Day.clock(t)
(function (root) {
'use strict';
const pad = n => String(n).padStart(2, '0');
const clock = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
// (as the Proctor says it: oh-seven-hundred, thirteen-thirty, twenty-one forty-five)
const NUM = ['oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three'];
const TENS = { 2: 'twenty', 3: 'thirty', 4: 'forty', 5: 'fifty' };
const spoken = m => {
  const h = Math.floor(m / 60) % 24, mm = m % 60, H = h < 10 ? `oh-${NUM[h]}` : NUM[h];
  if (!mm) return `${H}-hundred`;
  const M = mm < 10 ? `oh-${NUM[mm]}` : mm < 20 ? NUM[mm] : TENS[Math.floor(mm / 10)] + (mm % 10 ? '-' + NUM[mm % 10] : '');
  return `${H}${h >= 21 || M.includes('-') ? ' ' : '-'}${M}`;      // (oh-six-thirty, thirteen-thirty, twenty-one forty-five)
};

// The rooms a visit can be paid to (each built: js/*.js), and the cabins (shown on the plan, each with whoever's in it; not visited yet).
const ROOMS = {
  bridge: { name: 'Bridge' }, ready: { name: 'Ready Room' }, captain: { name: 'Captain’s quarters' }, mess: { name: 'Galley & mess' },
  suitbay: { name: 'Suit bay' }, medbay: { name: 'Med bay' }, hydro: { name: 'Hydroponics' }, reactor: { name: 'Reactor' },
};
const CABIN = id => 'cabin:' + id;
// The night watch: 22:00 until the morning briefing, the bridge crew in turn (Ashdown, Lindqvist, Varga, and round again). watchFor(day): who
// stood the night that ends on the morning of `day` (and so hands over at that day's briefing); tonight's watch is watchFor(day + 1).
const WATCH = ['pilot', 'comms', 'scientist'];
const watchFor = d => WATCH[(((d - 1) % 3) + 3) % 3];
// Where each works, on duty; and where they are of an evening, off duty (Okafor and Ashdown on the mess sofa together, Varga at the mess table
// with the day's readings, Haddad in hydroponics among the plants; Ruel and Lindqvist in their cabins).
const STATION = { pilot: 'bridge', comms: 'bridge', scientist: 'bridge', engineer: 'reactor', lifesupport: 'hydro', medic: 'medbay' };
const EVENING = { pilot: 'mess', engineer: 'mess', scientist: 'mess', lifesupport: 'hydro', medic: null, comms: null };
// The times of the day (minutes past midnight)
const T = { wake: 390, breakfast: 420, briefing: 480, relieved: 510, rounds: 540, lunch: 750, desk: 810, dinner: 1110, evening: 1170, report: 1200, handover: 1305, lights: 1320 };

function whereIs(id, t, day) {
  const w0 = watchFor(day), w1 = watchFor(day + 1);
  const at = (room, doing, o) => Object.assign({ room, doing, outfit: 'uniform' }, o);
  const cabin = doing => at(CABIN(id), doing, { outfit: 'offduty', asleep: doing === 'asleep' || doing === 'resting' });
  // (last night's watch: on the bridge until relieved at the briefing, breakfast brought up to the station; then asleep until the midday meal)
  if (id === w0 && t < T.relieved) return at('bridge', t < T.briefing ? 'on watch' : 'handing over', { station: true });
  if (id === w0 && t < T.lunch) return cabin('asleep');
  // (tonight's: rests after the midday meal until the evening meal, and again after it, then takes the watch at 21:45)
  if (id === w1 && t >= T.handover) return at('bridge', t < T.lights ? 'taking the watch' : 'on watch', { station: true });
  if (id === w1 && t >= T.desk && t < T.dinner) return cabin('resting');
  if (id === w1 && t >= T.evening) return cabin('resting');
  if (t < T.wake || t >= T.lights) return cabin('asleep');
  if (t < T.breakfast) return cabin('getting up');
  if (t < T.briefing) return at('mess', 'breakfast', { meal: true });
  if (t < T.lunch) return at(STATION[id], 'on duty', { station: true });
  if (t < T.desk) return at('mess', 'midday meal', { meal: true });
  if (t < T.dinner) return at(STATION[id], 'on duty', { station: true });
  if (t < T.evening) return at('mess', 'evening meal', { meal: true, outfit: 'offduty' });
  return EVENING[id] ? at(EVENING[id], 'off duty', { outfit: 'offduty', off: true }) : cabin('off duty');
}
const IDS = () => (root.Crew ? root.Crew.IDS : ['scientist', 'engineer', 'pilot', 'lifesupport', 'comms', 'medic']);
const present = (room, t, day) => IDS().filter(id => whereIs(id, t, day).room === room);

// The Captain's routine. at: when it begins (the clock waits for it, if the Captain's there a little early); until: the last it can be begun
// (after that, missed); dur: how long it takes. The rounds are a step of their own: each of their rooms once, any order, within the morning.
const STEPS = [
  { id: 'wake', at: T.wake, until: T.breakfast, room: 'captain', dur: 20, name: 'Wake' },
  { id: 'breakfast', at: T.breakfast, until: T.briefing, room: 'mess', dur: 45, name: 'Breakfast' },
  { id: 'briefing', at: T.briefing, until: T.rounds, room: 'bridge', dur: 45, name: 'Morning briefing' },
  { id: 'rounds', at: T.rounds, until: T.lunch, rooms: ['reactor', 'hydro', 'medbay', 'suitbay'], dur: 45, name: 'Rounds' },
  { id: 'lunch', at: T.lunch, until: T.desk, room: 'mess', dur: 50, name: 'Midday meal' },
  { id: 'desk', at: T.desk, until: T.dinner, room: 'ready', dur: 60, name: 'At the desk' },
  { id: 'dinner', at: T.dinner, until: T.evening, room: 'mess', dur: 55, name: 'Evening meal' },
  { id: 'report', at: T.report, until: T.handover, room: 'ready', dur: 30, name: 'Evening report' },
  { id: 'handover', at: T.handover, until: T.lights + 15, room: 'bridge', dur: 15, name: 'The night watch' },
  { id: 'lights', at: T.lights, until: 24 * 60 + 60, room: 'captain', dur: 0, name: 'Lights down' },
];
const STEP = Object.fromEntries(STEPS.map(s => [s.id, s]));
const LEAD = 30, LATE = 23 * 60 + 30;      // (how early a step can be gone to; when the Proctor sends the Captain to bed)
// (minutes: arriving somewhere off the routine; talking to someone; watching them at it; looking something over)
const VISIT = 5, TALK = 10, OBSERVE = 5, LOOK = 2;

function fresh(day) {
  return { v: 1, day: day || 1, t: T.wake, done: {}, missed: {}, rounds: {}, seen: {}, visits: {}, style: { warm: 0, formal: 0, brisk: 0 }, log: [], over: false };
}
const open = (s, st) => !s.done[st.id] && !s.missed[st.id];
const roomsOf = st => st.rooms || [st.room];
// What going to `room` now would be: a step of the routine (if it's that step's room and its time, or near it), an ordinary visit, or shut (a
// cabin, or a room not on the plan).
function resolve(s, room) {
  if (!ROOMS[room]) return { kind: 'shut' };
  for (const st of STEPS) {
    if (!open(s, st) || s.t >= st.until || s.t < st.at - LEAD || !roomsOf(st).includes(room)) continue;
    if (st.rooms && s.rounds[room]) continue;
    return { kind: 'step', step: st, sub: st.rooms ? room : null };
  }
  return { kind: 'visit' };
}
// Begun: the clock to the step's time if the Captain's there early.
function start(s, r) { if (r.kind === 'step') s.t = Math.max(s.t, r.step.at); }
// Done: the step marked (each of the rounds' rooms; the rounds when all four are), the time it took, anything whose window has closed missed.
function finish(s, r, room) {
  if (r.kind === 'step') {
    const st = r.step;
    if (st.rooms) { s.rounds[r.sub] = true; if (st.rooms.every(x => s.rounds[x])) s.done[st.id] = true; }
    else s.done[st.id] = true;
    s.t += st.dur;
    if (st.id === 'lights') s.over = true;
  } else { s.t += VISIT; s.visits[room] = (s.visits[room] || 0) + 1; }
  s.log.push({ t: s.t, room, step: r.kind === 'step' ? r.step.id : null, sub: r.sub || null });
  settle(s);
}
function settle(s) {
  for (const st of STEPS) if (open(s, st) && s.t >= st.until) {
    if (st.rooms && st.rooms.some(x => s.rounds[x])) s.done[st.id] = 'part'; else s.missed[st.id] = true;
  }
}
// Pass the time (in the Captain's quarters or at the desk, waiting on the next thing): the clock on to `to`. Spend: the clock on by `m`.
function wait(s, to) { s.t = Math.max(s.t, to); settle(s); }
function spend(s, m) { s.t += m; settle(s); }
// What the Proctor suggests next: the next step still open (the rounds, the first of their rooms not yet seen), or, between steps, the
// Captain's own time until the next one (and, late, bed).
function next(s) {
  if (s.over) return { kind: 'end' };
  for (const st of STEPS) {
    if (!open(s, st) || st.id === 'wake') continue;
    const room = st.rooms ? st.rooms.find(x => !s.rounds[x]) : st.room;
    if (s.t >= st.at - LEAD) return { kind: 'step', step: st, room, at: st.at };
    return { kind: 'free', step: st, room, at: st.at };
  }
  return { kind: 'end' };
}
const late = s => s.t >= LATE;
// The ship's lights: the day from waking until the evening report, the night after it.
const light = t => (t >= T.wake && t < T.report ? 'day' : 'night');
// Who the Captain hasn't seen yet today, among those awake and about (for the Proctor to suggest, in the Captain's own time).
const unseen = s => IDS().filter(id => !s.seen[id] && !whereIs(id, s.t, s.day).room.startsWith('cabin:'));

const api = { ROOMS, CABIN, WATCH, STATION, EVENING, T, STEPS, STEP, LEAD, VISIT, TALK, OBSERVE, LOOK, LATE, spend, watchFor, whereIs, present, fresh, resolve, start, finish, settle, wait, next, late, light, unseen, clock, spoken };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Day = api;
})(typeof window !== 'undefined' ? window : globalThis);
