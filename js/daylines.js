// Project Meridian — what's said through an ordinary day aboard, before the shear (docs/day.md): each step of the Captain's routine as a short
// scene, the Proctor's suggestions between, an ordinary visit to anyone at work or off duty, and the evening report. A first draft, in each
// voice, for review.
//
// A scene is steps for the page to play: { who: id | 'captain' | 'proctor', text, expr } lines, and { choose: [{ label, style, fx, then }] }.
// style: the Captain's manner (warm, formal or brisk), kept for the day (the Proctor learns it). fx: { id: { comfort, desire } }, what the
// choice moves in each crew member's relationship with the Captain (desire never for the asexual crew member; less on a second visit). need:
// ids that have to be there for a line or choice (whoever stood last night's watch is asleep half the day, and the bridge crew take it in turn).
// {w0}: last night's watch (relieved at the briefing); {w1}: tonight's; {time}: the time, as the Proctor says it.
//
//   DayLines.scene(stepId | 'rounds:' + room, ctx) → steps · DayLines.visit(room, ctx) → steps · DayLines.hint(next, ctx) → the Proctor's
//   suggestion · DayLines.report(ctx) → the evening report · DayLines.close(ctx) → the day's last line
(function (root) {
'use strict';
const pick = a => (Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a);
const C = () => root.Crew, D = () => root.Day;
const sur = id => (C().ROSTER[id] ? C().ROSTER[id].short : id);
const fill = (t, x) => t.replace(/\{w0\}/g, sur(x.w0)).replace(/\{w1\}/g, sur(x.w1)).replace(/\{time\}/g, D().spoken(x.t));
// (a line in each of the bridge crew's voices, for whichever of them it is)
const per = (o, id) => o[id] || o.any;

// ── The routine ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const SCENES = {
  // 06:30, the Captain's quarters: the Proctor's morning summary (a voice, in Act I)
  wake: x => [
    { who: 'proctor', text: 'Good morning, Captain. Ship’s time {time}. A quiet night: {w0} has the watch, and logged nothing worth waking you for.' },
    { who: 'proctor', text: 'The morning packet from Earth came in at oh-four-ten. Lindqvist will have it sorted by the briefing.' },
    { choose: [
      { label: '“Morning, Proctor. Anything I should know first?”', style: 'formal', then: [{ who: 'proctor', text: 'Nothing pressing. Reactor at sixty-two percent, scrubbers nominal, all six of the crew accounted for. Breakfast is at oh-seven-hundred.' }] },
      { label: '“Thank you. Give me five minutes.”', style: 'warm', then: [{ who: 'proctor', text: 'Five minutes, Captain. I’ll keep the ship.' }] },
      { label: '“Schedule.”', style: 'brisk', then: [{ who: 'proctor', text: 'Breakfast at oh-seven-hundred. The briefing on the bridge at oh-eight-hundred, the rounds after. An ordinary day.' }] },
    ] },
    { who: 'proctor', text: 'I’ll suggest what comes next as the day goes. Where you go is yours to decide.' },
  ],

  // 07:00, the mess: breakfast, everyone but last night's watch (theirs taken up to the bridge)
  breakfast: x => [
    { who: 'lifesupport', text: 'Morning, Captain. There’s flatbread: the first from the new wheat. Don’t tell me if it’s bad.', expr: 'shy' },
    { who: 'engineer', text: 'It’s not bad.' },
    { who: 'medic', text: 'It’s slightly bad. It’s also the best thing I’ve eaten this month.', expr: 'smile' },
    { choose: [
      { label: 'Sit by Haddad. “It’s good. Tell me about the wheat.”', style: 'warm', fx: { lifesupport: { comfort: 0.05, desire: 0.02 } }, then: [
        { who: 'lifesupport', text: 'Third harvest from the new strain. It likes the low light better than the old one did. I talk to it, which Okafor says is unscientific.', expr: 'smile' },
        { who: 'engineer', text: 'I said unengineered.' }] },
      { label: '“Varga. Where are we with the survey?”', style: 'formal', need: ['scientist'], fx: { scientist: { comfort: 0.04 } }, then: [
        { who: 'scientist', text: 'We cross the edge of the Parallax field in eleven days. Everything until then is calibration. After that, it’s the reason we came.' }] },
      { label: 'Eat, and listen.', style: 'brisk', fx: { all: { comfort: 0.01 } }, then: [
        { who: 'engineer', text: 'Showers are on the reactor’s heat again, before anyone asks.' },
        { who: 'medic', text: 'Somebody asked eleven times yesterday.' },
        { who: 'comms', need: ['comms'], text: 'Twelve. I logged it.' }] },
    ] },
    { who: 'comms', need: ['comms'], text: 'The packet’s sorted, Captain. Personal mail is in everyone’s queue. There’s one for you.' },
    { who: 'scientist', need: ['scientist'], unless: ['comms'], text: 'Lindqvist sorted the packet on watch. Mail’s in everyone’s queue, yours included.' },
  ],

  // 08:00, the bridge: the morning briefing at the plot table, last night's watch handing over; the others report in from their compartments
  briefing: x => [
    { who: 'proctor', text: 'Oh-eight-hundred, Captain. All stations reporting.' },
    { who: x.w0, text: per({
      pilot: 'Morning, Captain. Quiet night. Two micrometeoroid dings on the shield, both logged, both boring. Helm’s yours.',
      comms: 'Captain. Watch report: nothing on the long-range band but the packet. The array is aligned. I have nothing to add.',
      scientist: 'Captain. An uneventful watch, which I spent recalibrating the survey baseline. Don’t tell Ashdown. The ship is yours.' }, x.w0) },
    { who: 'engineer', text: 'Reactor, Captain. Sixty-two percent. Thermal loops nominal.', radio: true },
    { who: 'lifesupport', text: 'Life support’s green. Scrubbers at ninety-four. The wheat says hello.', radio: true },
    { who: 'medic', text: 'Med bay. Nothing to report, except that everyone’s due their monthly baseline this week. Everyone, Captain.', radio: true },
    { who: 'proctor', text: 'Course holds. Eleven days to the edge of the Parallax field.' },
    { choose: [
      { label: '“Good watch, {w0}. Get some sleep.”', style: 'warm', fx: { w0: { comfort: 0.04 } }, then: [{ who: x.w0, text: per({
        pilot: 'Bunk. Then lunch. Then I’m flying the boring bits again.', comms: 'Acknowledged. Eight hours, near enough.', scientist: 'If I can stop thinking about the baseline. Yes.' }, x.w0), expr: 'smile' }] },
      { label: '“I relieve you. I have the ship.”', style: 'formal', fx: { w0: { comfort: 0.02 } }, then: [{ who: x.w0, text: 'You have the ship, Captain.' }] },
      { label: '“Anything that isn’t in the log?”', style: 'brisk', then: [{ who: x.w0, text: per({
        pilot: 'Nope. I mean— no, Captain.', comms: 'Nothing that isn’t in the log. I’m thorough.', scientist: 'Only my opinions. They’re in a separate log.' }, x.w0) }] },
    ] },
    { who: 'proctor', text: 'Logged: {w0} relieved at oh-eight-oh-two. The Captain has the ship.' },
  ],

  // the rounds, any order through the morning: the reactor (Okafor), hydroponics (Haddad), the med bay (Ruel), the suit bay (nobody: the Proctor)
  'rounds:reactor': x => [
    { who: 'engineer', text: 'Captain. Come to see the core? It’s doing what it does. Hot, steady, loud.' },
    { choose: [
      { label: '“How are the loops?”', style: 'formal', fx: { engineer: { comfort: 0.02 } }, then: [{ who: 'engineer', text: 'Loop two’s pump runs a little warm. Inside spec. I’m watching it.' }] },
      { label: '“And how are you?”', style: 'warm', fx: { engineer: { comfort: 0.05, desire: 0.02 } }, then: [{ who: 'engineer', text: 'Me? Fine. Busy’s good. Ashdown says I should take a day. I say the reactor doesn’t take days.', expr: 'smile' }] },
      { label: '“Carry on.”', style: 'brisk', then: [{ who: 'engineer', text: 'Copy.' }] },
    ] },
    { who: 'engineer', text: 'I’ll have the loop figures on your desk by end of shift.' },
  ],
  'rounds:hydro': x => [
    { who: 'lifesupport', text: 'Captain! Mind the hose. I’m moving the beans up a rack: they want more light than I thought.', expr: 'smile' },
    { choose: [
      { label: '“Show me.”', style: 'warm', fx: { lifesupport: { comfort: 0.05, desire: 0.02 } }, then: [{ who: 'lifesupport', text: 'Here. See how they lean? They’ve been telling me for a week. I should have listened sooner.', expr: 'shy' }] },
      { label: '“How’s the air?”', style: 'formal', fx: { lifesupport: { comfort: 0.02 } }, then: [{ who: 'lifesupport', text: 'Scrubbers at ninety-four percent, water reclamation at ninety-eight. The numbers are good. The room feels good too, if that counts.' }] },
      { label: '“Don’t let me keep you.”', style: 'brisk', then: [{ who: 'lifesupport', text: 'You’re not keeping me. You’re welcome here. Anyone is.' }] },
    ] },
    { who: 'lifesupport', text: 'Come back when the tomatoes turn. It’s worth seeing.' },
  ],
  'rounds:medbay': x => [
    { who: 'medic', text: 'Captain. You’re early for your baseline. Or have you come to tell me you’re skipping it again?', expr: 'stern' },
    { choose: [
      { label: '“I’ll do it now.”', style: 'warm', fx: { medic: { comfort: 0.05, desire: 0.01 } }, then: [
        { who: 'medic', text: 'Sit, then. Heart rate, sleep log, a few questions you’ll find tedious.' },
        { who: 'medic', text: 'You’re sleeping six hours. Make it seven. That’s not advice.', expr: 'smile' }] },
      { label: '“Thursday. I promise.”', style: 'brisk', fx: { medic: { comfort: 0.01 } }, then: [{ who: 'medic', text: 'I’ll hold you to it. I hold everyone to it.' }] },
      { label: '“How’s the crew, by your numbers?”', style: 'formal', fx: { medic: { comfort: 0.03 } }, then: [
        { who: 'medic', text: 'Within range, all six. Varga’s sleep is short. Okafor’s is shorter. Ashdown sleeps like a cat. None of it worries me yet.' },
        { who: 'medic', text: 'Yet.' }] },
    ] },
    { who: 'medic', text: 'Thank you for coming round, Captain. Not every captain I’ve served with did.' },
  ],
  'rounds:suitbay': x => [
    { who: 'proctor', text: 'The suit bay, Captain. Seven suits, sealed and charged. Seal checks are due on the fourteenth; Dr. Ruel signs them off.' },
    { choose: [
      { label: '“Run a seal check on mine.”', style: 'formal', then: [{ who: 'proctor', text: 'Running. The seals hold at full pressure. Your suit is ready, Captain.' }] },
      { label: '“Thank you, Proctor.”', style: 'warm', then: [{ who: 'proctor', text: 'You’re welcome, Captain.' }] },
      { label: '“Next.”', style: 'brisk', then: [{ who: 'proctor', text: 'Next, then.' }] },
    ] },
  ],

  // 12:30, the mess: all six (last night's watch just up, tonight's about to rest)
  lunch: x => [
    { who: x.w0, text: per({ pilot: 'Morning. Afternoon. Whatever it is. What did I miss?', comms: 'I’m awake. Mostly.', scientist: 'I dreamt about the baseline. That isn’t rest, is it.' }, x.w0) },
    { who: 'engineer', text: 'Lunch.' },
    { who: x.w1, text: per({ pilot: 'I’ll eat and then I’m in my bunk. The watch is mine tonight.', comms: 'I’ll eat and turn in. The watch is mine tonight.', scientist: 'I’ll eat, and then try to sleep in the middle of the day. The watch is mine tonight.' }, x.w1) },
    { choose: [
      { label: '“{w1}, anything you need for tonight?”', style: 'warm', fx: { w1: { comfort: 0.04 } }, then: [{ who: x.w1, text: per({
        pilot: 'Coffee. A lot of it. And someone to tell me the stars aren’t moving.',
        comms: 'Quiet. And the packet window: I’d like to be on the band at oh-four-hundred.',
        scientist: 'Permission to run the survey console overnight? I can keep the watch and do both.' }, x.w1) }] },
      { label: '“Any news from home in the mail?”', style: 'warm', fx: { all: { comfort: 0.02 } }, then: [
        { who: 'lifesupport', text: 'My sister’s had the baby. Well. Had it eight months ago, by now.', expr: 'wistful' },
        { who: 'medic', text: 'Eight months of their time. We’ll be strangers to it before it can walk.' },
        { who: 'engineer', text: 'Cheerful.' }] },
      { label: 'Eat quickly; back to work.', style: 'brisk', then: [{ who: 'engineer', text: 'Copy that.' }] },
    ] },
  ],

  // 13:30, the Ready Room: the Captain's desk (the Proctor, a voice)
  desk: x => [
    { who: 'proctor', text: 'Your desk, Captain. The morning’s log to sign, the standing orders for the crossing to review, and your mail.' },
    { choose: [
      { label: 'Sign the log.', style: 'brisk', then: [{ who: 'proctor', text: 'Signed and sealed. Nothing in it but an ordinary morning.' }] },
      { label: 'Review the standing orders for the crossing.', style: 'formal', then: [
        { who: 'proctor', text: 'In eleven days, the edge of the Parallax field. Stations for the crossing, all six; I monitor.' },
        { who: 'proctor', text: 'I’ve drafted them in your words, as far as I know them yet.' }] },
      { label: 'Read your mail from home.', style: 'warm', then: [
        { who: 'proctor', text: 'I’ll leave you to it.' },
        { who: 'proctor', text: 'It was sent nineteen days ago, their time. Lindqvist says the lag grows a little every week we go on.' }] },
    ] },
    { who: 'proctor', text: 'That’s the desk for today. The afternoon is yours. The evening meal is at eighteen-thirty.' },
  ],

  // 18:30, the mess: the evening meal, off duty (tonight's watch with them, before resting again)
  dinner: x => [
    { who: 'medic', text: 'Captain. Sit. You’ve been on your feet since six.' },
    // (the evening's argument: whoever's there to have it)
    { who: 'pilot', need: ['pilot', 'engineer'], text: 'Captain, settle something. Okafor says the reactor’s louder at night. I say it’s psychological.', expr: 'cheeky' },
    { who: 'engineer', need: ['pilot', 'engineer'], text: 'It’s the loop pumps. Quieter ship at night, you hear them.' },
    { choose: [
      { label: 'Side with Okafor.', style: 'formal', need: ['pilot', 'engineer'], fx: { engineer: { comfort: 0.03 }, pilot: { comfort: 0.01 } }, then: [{ who: 'pilot', text: 'Traitor.', expr: 'pout' }, { who: 'engineer', text: 'Thank you, Captain.', expr: 'smile' }] },
      { label: 'Side with Ashdown.', style: 'warm', need: ['pilot', 'engineer'], fx: { pilot: { comfort: 0.03 }, engineer: { comfort: 0.01 } }, then: [{ who: 'engineer', text: 'Noted, Captain. Bitterly.' }, { who: 'pilot', text: 'Ha!', expr: 'cheeky' }] },
      { label: '“You’re both right.”', style: 'brisk', need: ['pilot', 'engineer', 'scientist'], fx: { pilot: { comfort: 0.02 }, engineer: { comfort: 0.02 } }, then: [{ who: 'scientist', text: 'Spoken like a captain.', expr: 'smile' }] },
      { label: '“Varga, can the field be seen from the viewport yet?”', style: 'formal', need: ['scientist'], unless: ['pilot'], fx: { scientist: { comfort: 0.03 } }, then: [
        { who: 'scientist', text: 'Not with eyes. On the survey it’s a smudge where the background stars bend. In eleven days you’ll see the bend yourself.' }] },
      { label: '“How was everyone’s day?”', style: 'warm', unless: ['pilot'], fx: { all: { comfort: 0.02 } }, then: [
        { who: 'engineer', text: 'Long. Good.' }, { who: 'lifesupport', text: 'The tomatoes are turning.', expr: 'smile' }] },
    ] },
    { who: 'lifesupport', text: 'Two more days for the tomatoes, Captain. I’ll save you the first one.', expr: 'shy' },
  ],

  // 20:00, the Ready Room: the evening report (built from the day: see report())
  report: x => report(x),

  // 21:45, the bridge: tonight's watch takes over from the Captain
  handover: x => [
    { who: x.w1, text: per({ pilot: 'Ashdown, reporting for the watch, Captain. Fully caffeinated. Possibly over.', comms: 'Lindqvist, reporting for the watch.', scientist: 'Varga, reporting for the watch. Rested, more or less.' }, x.w1) },
    { choose: [
      { label: '“You have the ship.”', style: 'formal', fx: { w1: { comfort: 0.02 } }, then: [{ who: x.w1, text: 'I have the ship, Captain.' }] },
      { label: '“Call me if anything changes. Anything.”', style: 'warm', fx: { w1: { comfort: 0.03 } }, then: [{ who: x.w1, text: per({
        pilot: 'Anything? The stars change colour every hour up here, Captain.', comms: 'Anything. Understood. I’ll use judgement.', scientist: 'I’ll wake you for physics. Only physics.' }, x.w1), expr: 'smile' }] },
      { label: '“Quiet night.”', style: 'brisk', then: [{ who: x.w1, text: per({ pilot: 'Boring’s good. Night, Captain.', comms: 'That’s the plan. Goodnight, Captain.', scientist: 'One hopes. Goodnight, Captain.' }, x.w1) }] },
    ] },
    { who: 'proctor', text: 'Logged: {w1} has the watch at twenty-one fifty.' },
  ],

  // 22:00, the Captain's quarters
  lights: x => [{ who: 'proctor', text: 'Goodnight, Captain. {w1} has the ship, and I have {w1}.' }],
};

// ── An ordinary visit: anyone there, at work or off duty ──────────────────────────────────────────────────────────────────────────────────
// duty / off / meal: how they greet the Captain; again: a second visit the same day; work, you, pass: their answer to how the work's going, how
// they are, and the Captain just looking in.
const VISIT = {
  scientist: { duty: 'Captain. The survey baseline is behaving. I find that suspicious.', off: 'Captain. I’m reading. Technically it’s work. Technically everything is.',
    again: 'Back already? Either something’s wrong or you’re avoiding your desk.',
    work: 'Eleven days to the edge of the field, and every instrument agrees. That’s either reassuring or a calibration error.',
    you: 'Interested. Honestly, it’s the best I’ve been in years. Out here the questions are bigger than the people asking them.', pass: 'Of course. I’ll be here, staring at numbers.' },
  engineer: { duty: 'Captain. All good down here.', off: 'Captain. Off the clock. Mostly.', again: 'Twice in a day? Something I should know?',
    work: 'Running sweet. Loop two’s a little warm. It’s on my list.', you: 'Tired in the good way. Ashdown’s making me sit still, which is new.', pass: 'Copy, Captain.' },
  pilot: { duty: 'Captain! Come to watch me fly in a straight line?', off: 'Captain. We’re off duty. You’re allowed to sit down, you know.', again: 'Missed me?',
    work: 'Straight line, constant thrust, nothing to dodge for eleven days. I’m running sims to stay awake.', you: 'Good. Bored. Good-bored. Ask me again after the crossing.', pass: 'Bye, Captain.' },
  lifesupport: { duty: 'Captain. Come in, it’s warm in here.', off: 'Captain. I’m not working. I’m just being with the plants.', again: 'You came back! The plants noticed.',
    work: 'Everything’s growing. The air tastes right. I can tell when it doesn’t, before the numbers do.', you: 'Happy, I think. It’s a good crew. Everyone’s easy with each other.', pass: 'Come back any time.' },
  comms: { duty: 'Captain.', off: 'Captain. I’m off duty.', again: 'Captain. Again.',
    work: 'The array is aligned and the packet came in clean. Earth is talking. That’s all I need it to do.', you: 'Operational. It’s a good word. It covers most things.', pass: 'Acknowledged.' },
  medic: { duty: 'Captain. Here for your baseline?', off: 'Captain. Off duty, and so are you, I hope.', again: 'Again, Captain? People will talk.',
    work: 'Quiet. Quiet is good. I’m writing up baselines nobody reads.', you: 'Content, which surprises me. I expected to be bored out here. I’m not.', pass: 'Captain.' },
};
const ASK = [
  { k: 'work', label: '“How’s the work?”', style: 'formal', fx: { comfort: 0.01 } },
  { k: 'you', label: '“How are you?”', style: 'warm', fx: { comfort: 0.03, desire: 0.01 } },
  { k: 'pass', label: '“Just looking in.”', style: 'brisk', fx: {} },
];
// (where someone else is, for the Proctor to say, when the room's empty)
const WHERE = { bridge: 'on the bridge', mess: 'in the mess', reactor: 'at the reactor', hydro: 'in hydroponics', medbay: 'in the med bay', ready: 'in the Ready Room', suitbay: 'in the suit bay', captain: 'in your quarters' };
const OWNER = { reactor: 'engineer', hydro: 'lifesupport', medbay: 'medic' };
function whereNow(id, x) { const w = D().whereIs(id, x.t, x.day); return w.room.startsWith('cabin:') ? (w.asleep ? 'asleep in their cabin' : 'in their cabin') : WHERE[w.room]; }
function visit(room, x) {
  const here = x.here;
  // (the Captain's own rooms, and the suit bay, with nobody there: time to themselves; anywhere else empty, the Proctor says where they are)
  if (!here.length) {
    if (room === 'captain') return [{ who: 'proctor', text: 'Your quarters, Captain.' }, { choose: [
      { label: 'Rest a while.', style: 'warm', rest: 60, then: [{ who: 'proctor', text: 'An hour. I’ll keep the ship.' }] },
      { label: 'Read the log.', style: 'formal', then: [{ who: 'proctor', text: 'The log is as you left it, Captain. Nothing amended.' }] },
      { label: 'Back out.', style: 'brisk', then: [] }] }];
    if (room === 'ready') return [{ who: 'proctor', text: 'Your desk, Captain.' }, { choose: [
      { label: 'Catch up on reports.', style: 'formal', rest: 30, then: [{ who: 'proctor', text: 'Okafor’s loop figures are in. Inside spec, all three.' }] },
      { label: 'Back out.', style: 'brisk', then: [] }] }];
    if (room === 'suitbay') return [{ who: 'proctor', text: 'The suit bay. Seven suits, sealed and charged.' }];
    const o = OWNER[room], name = D().ROOMS[room].name;
    if (o) return [{ who: 'proctor', text: `${name}. Nobody here at this hour, Captain. ${sur(o)} is ${whereNow(o, x)}.` }];
    if (room === 'bridge') return [{ who: 'proctor', text: 'The bridge, Captain. Nobody on it until the watch. I have the ship.' }];
    return [{ who: 'proctor', text: `${name}. Nobody here at this hour, Captain.` }];
  }
  // (one at a time: the Captain chooses whom to talk to, if there's more than one)
  const talk = id => {
    const V = VISIT[id], w = D().whereIs(id, x.t, x.day), again = (x.seen[id] || 0) > 0;
    return [{ who: id, text: again ? V.again : w.off ? V.off : V.duty, expr: id === 'pilot' ? 'cheeky' : 'calm' },
      { choose: ASK.map(a => ({ label: a.label, style: a.style, fx: { [id]: a.fx }, then: [{ who: id, text: V[a.k], expr: a.k === 'you' ? 'smile' : 'calm' }] })) }];
  };
  if (here.length === 1) return talk(here[0]);
  const names = here.map(sur), list = names.length === 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return [{ prompt: `${list} are here.`, choose: here.map(id => ({ label: `Talk to ${sur(id)}`, style: null, then: talk(id) })).concat([{ label: 'Leave them to it.', style: 'brisk', then: [] }]) }];
}

// ── The Proctor between: what it suggests next ─────────────────────────────────────────────────────────────────────────────────────────────
const HINT = {
  breakfast: 'Breakfast in the mess at oh-seven-hundred, Captain. {w0} has the watch until the briefing.',
  briefing: 'The morning briefing on the bridge at oh-eight-hundred. {w0} hands over to you there.',
  rounds: { reactor: 'Your rounds: Okafor at the reactor.', hydro: 'Your rounds: Haddad, in hydroponics.', medbay: 'Your rounds: Dr. Ruel, in the med bay.', suitbay: 'Your rounds: the suit bay last. Nobody’s there; I’ll go through the suits with you.' },
  lunch: 'The midday meal in the mess at twelve-thirty. Everyone will be there: {w0} is up by then.',
  desk: 'Your desk in the Ready Room. The log, the standing orders and your mail are waiting.',
  dinner: 'The evening meal in the mess at eighteen-thirty.',
  report: 'Your evening report, in the Ready Room at twenty-hundred.',
  handover: 'The night watch: {w1} takes the ship from you on the bridge at twenty-one forty-five.',
  lights: 'That’s the day, Captain. {w1} has the ship. Your quarters.',
};
function hint(n, x) {
  if (n.kind === 'end') return 'Goodnight, Captain.';
  const H = HINT[n.step.id], t = typeof H === 'object' ? H[n.room] : H;
  if (n.kind === 'free') {
    const who = D().unseen(x.state).filter(id => id !== x.w0 || x.t >= D().T.lunch);
    const lead = `Your own time until ${D().clock(n.at)}, Captain.`;
    return fill(`${lead} ${who.length ? `You haven’t seen ${who.slice(0, 2).map(sur).join(' or ')} today.` : ''} Then: ${t.charAt(0).toLowerCase() + t.slice(1)}`, x).replace(/ +/g, ' ');
  }
  return fill(t, x);
}

// ── The evening report: the day as it went ────────────────────────────────────────────────────────────────────────────────────────────────
function report(x) {
  const s = x.state, ST = D().STEP, out = [{ who: 'proctor', text: 'Your evening report, Captain.' }];
  const meals = ['breakfast', 'lunch', 'dinner'].filter(k => s.done[k]).length, seen = Object.keys(s.seen).filter(k => s.seen[k]).length;
  out.push({ who: 'proctor', text: `You ate ${meals === 3 ? 'all three meals' : meals === 0 ? 'none of the day’s meals' : meals === 1 ? 'one meal' : 'two meals'} with the crew, and spoke with ${seen === 6 ? 'all six of them' : `${seen} of the six`}.` });
  const r = ST.rounds.rooms.filter(k => s.rounds[k]).length;
  out.push({ who: 'proctor', text: r === 4 ? 'Your rounds were complete.' : r === 0 ? 'You didn’t make your rounds. The compartments reported to me instead.' : `Your rounds took in ${r} of the four compartments.` });
  if (s.missed.briefing) out.push({ who: 'proctor', text: `You missed the briefing. ${sur(x.w0)} handed the watch over to me, and I gave it back to you when you came on the bridge.` });
  if (s.missed.desk) out.push({ who: 'proctor', text: 'The desk waited for you all afternoon. I’ll keep it till tomorrow.' });
  out.push({ choose: [
    { label: '“An ordinary day. Log it so.”', style: 'brisk', then: [{ who: 'proctor', text: 'Logged: an ordinary day.' }] },
    { label: '“Log that the crew are well. And Haddad’s wheat.”', style: 'warm', then: [{ who: 'proctor', text: 'Logged, with the wheat.' }] },
    { label: '“Anything I didn’t get to?”', style: 'formal', then: [{ who: 'proctor', text: s.done.rounds === true && meals === 3 && !s.missed.desk ? 'Nothing, Captain. You got to everything.' : 'Only what I’ve said. None of it can’t keep.' }] },
  ] });
  out.push({ who: 'proctor', text: '{w1} takes the watch at twenty-one forty-five, on the bridge.' });
  return out;
}

// The Captain's manner through the day, as the Proctor has it (it learns the Captain's language from this)
function manner(style) {
  const k = Object.keys(style).sort((a, b) => style[b] - style[a]), tot = k.reduce((a, b) => a + style[b], 0);
  if (!tot) return 'unread';
  return style[k[0]] >= tot * 0.5 ? `mostly ${k[0]}` : `${k[0]} and ${k[1]}`;
}

// The page plays a scene's steps; this resolves them for who's there: lines and choices whose `need` isn't met (or whose `unless` is) dropped,
// {w0} {w1} {time} filled in, and each choice's fx resolved to crew ids (w0, w1, all: everyone there).
function resolve(steps, x) {
  const ok = o => (!o.need || o.need.every(id => x.here.includes(id))) && (!o.unless || !o.unless.some(id => x.here.includes(id)));
  const fx = f => { if (!f) return null; const out = {};
    for (const [k, v] of Object.entries(f)) for (const id of k === 'all' ? x.here : [k === 'w0' ? x.w0 : k === 'w1' ? x.w1 : k]) out[id] = v;
    return out; };
  const go = list => list.filter(ok).map(s => s.choose
    ? { prompt: s.prompt ? fill(s.prompt, x) : null, choose: s.choose.filter(ok).map(c => Object.assign({}, c, { label: fill(c.label, x), fx: fx(c.fx), then: go(c.then || []) })) }
    : Object.assign({}, s, { text: fill(s.text, x) }));
  return go(steps);
}
const scene = (id, x) => resolve((SCENES[id] || (() => []))(x), x);
const visitSteps = (room, x) => resolve(visit(room, x), x);

const api = { SCENES, VISIT, HINT, scene, visit: visitSteps, hint, report, manner, resolve, fill };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.DayLines = api;
})(typeof window !== 'undefined' ? window : globalThis);
