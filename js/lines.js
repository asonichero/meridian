// Project Meridian — what's said in a correction: each crew member's scripted responses as it goes (when they're placed, the first smack, as their
// distress crosses each band, when soothed, when they call their safe word because it's gone too far, at the end), the Captain's word to place
// them, and the conversation after, where aftercare is given through what's said and an instruction for the rest of the shift.
// A first draft, in each voice, for review. {word}: their safe word. {name}: what the Captain calls them (their surname).
//
//   Lines.react(id, key) → a line or null · Lines.captain(key, id) · Lines.after(id, outcome, mood) → the aftercare conversation as steps (see the bottom)
(function (root) {
'use strict';
const pick = a => (Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a);

// The Captain placing them, by position (standing, by what they hold: wall, a grab rail; edge, a counter; flat, a bare wall; desk, a desk; potting, the potting bench; exam, the exam table's side; plot, the bridge's plot table, in situ late in the story, the watch carrying on round them).
const PLACE = {
  otk: ['Across my knee, {name}.', 'Here. Over my lap.', 'You know where. Across my knee.'],
  wall: ['Hands on the rail, {name}. Feet apart.', 'Face the bulkhead. Grip the rail and hold it.', 'Rail. Both hands. Don’t let go of it.'],
  edge: ['Hands on the counter, {name}. Step back. Bend.', 'Palms flat on the island. Feet apart.', 'Over here. Hands on the counter and keep them there.'],
  flat: ['Hands on the wall, {name}. Step back.', 'Palms flat on the wall. Feet apart.', 'Face the wall. Hands on it, and keep them there.'],
  desk: ['Hands on the desk, {name}. Step back. Bend.', 'Palms flat on the desk. Feet apart.', 'Over here. Both hands on the desk, and keep them there.'],
  potting: ['Hands on the potting bench, {name}. Step back. Bend.', 'Palms flat on the bench. Feet apart.', 'Over here. Both hands on the bench, and keep them there.'],
  exam: ['Hands on the table, {name}. Step back. Bend.', 'Palms flat on the edge of the table. Feet apart.', 'Over here. Both hands on the table, and keep them there.'],
  plot: ['Plot table, {name}. Hands on the edge. Bend.', 'Here. Palms flat on the plot. Feet apart.', 'Both hands on the table, {name}. The watch carries on.'],
  table: ['Over the table, {name}.', 'Bend over the end of the table. Hold the edges.', 'Here. Chest down on the table.'],
};
// The Captain, when defiance gets in the way: a hand back over the seat (hands), the second time and he takes the wrist and holds it at the
// small of their back (pin), and when they come up out of position (down: across the knee; rail: at the rail).
const CAPTAIN = {
  hands: ['Hand down, {name}.', 'Move the hand.', 'That hand goes back where it was.'],
  pin: ['That’s twice. I’ll hold it for you.', 'Give me that wrist. There.', 'All right. I’ve got it. Stay.'],
  down: ['Down.', 'Stay down, {name}.', 'Back over. All the way.'],
  rail: ['Back in position.', 'Hands on the rail. Bend.', 'Down, {name}. Hold the rail.'],
  edge: ['Hands back on the counter.', 'Down. Palms flat, {name}.', 'Back over the counter.'],
  flat: ['Hands back on the wall.', 'Back in position, {name}.', 'Palms on the wall. Stay there.'],
  desk: ['Hands back on the desk.', 'Down. Palms flat, {name}.', 'Back over the desk.'],
  potting: ['Hands back on the bench.', 'Down. Palms flat, {name}.', 'Back over the bench.'],
  exam: ['Hands back on the table.', 'Down. Palms flat, {name}.', 'Back down, {name}. Hands on the table.'],
  plot: ['Hands back on the plot.', 'Down, {name}. Palms on the edge.', 'Back over the table. Eyes on the plot.'],
  table: ['Back down on the table.', 'Chest down, {name}.', 'Stay down on the table.'],
};

// During: start (as they're placed), first (the first smack), flinching, struggling, edge, past (each the first time it's reached), plead
// (now and then while it's hard), spent (now and then, rarely, once the fight's gone out of them: hardly words), accept (in place of a plea,
// the more submissive they are), flushed (once, when desire shows in their body: embarrassment; not for the asexual crew member), soothe (the
// palm on them, between), word (the safe word, called), end (when the Captain stops). While they're still defiant: defy (back-talk, in place
// of the early band lines and the pleas), and yield (once, as the defiance breaks).
const REACT = {
  // The Captain, held to account by the Proctor at the evening check-in (docs/proctor.md): terse, used to being the one in control.
  captain: {
    start: ['Understood.', 'Fine. Go on.', '…All right.'],
    first: ['—!', 'Hh.'],
    flinching: ['I hear you.', 'All right. All right.'],
    struggling: ['That’s— point taken—', 'Ah— I know, I know—'],
    edge: ['Enough— I’ve got it, I’ve got it—', 'I let them down. I know.'],
    past: ['I’m sorry— I’ll do better by them.'],
    plead: ['Proctor—', 'Please—'],
    spent: ['…', '…yes.'],
    accept: ['Yes. I earned that.', 'I know. Go on.'],
    soothe: ['…Thank you.', 'Hm.'],
    defy: ['Is this how you’d run my ship?', 'I made the call. I’d make it again.', 'You’ve made your point.'],
    yield: ['…All right. You’re right. I was wrong.', 'I hear it. I’ll do better.'],
    word: '{word}.',
    end: ['…Understood.', 'Message received.'],
  },
  // The Proctor, standing in for a correction the Captain missed or mishandled (deferential: docs/proctor.md): composed, reporting on itself,
  // steadying the Captain's hand as much as taking it.
  proctor: {
    start: ['As it should have been given, Captain. I’m ready.', 'For {crew}. Go on.'],
    first: ['Noted.', '…That registered.'],
    flinching: ['This form feels it. Continue.', 'Even, Captain. Like that.'],
    struggling: ['That— is what was owed.', 'Hh— keep the measure. Good.'],
    edge: ['I’m near the edge of what this form holds.', 'Captain— that’s the line. Watch it.'],
    past: ['Too far. That’s what we’re here not to do.'],
    plead: ['Captain—', 'Steady—'],
    spent: ['…', '…recording.'],
    accept: ['Yes. That’s the measure.', 'Correct.'],
    soothe: ['…That too. Remember that part.', 'Thank you.'],
    word: '{word}. {word}, Captain.',
    end: ['…That’s how it should have gone. Thank you.'],
  },
  scientist: {
    start: ['Understood. I— yes. Proceeding.', 'This is… a grounding protocol. I know. I agreed to it.'],
    first: ['Oh.', 'Hh— that’s… very present.'],
    flinching: ['I’m here. I’m— here.', 'Data point. Ow. Data point.'],
    struggling: ['That— is not abstract at all—', 'Ah! All right, all right, I’m in the room—'],
    edge: ['I can’t think past it— I can’t— that’s the point, isn’t it—', 'Please— I’m here, I’m listening—'],
    past: ['I’m sorry— I’m sorry, I was so far away—'],
    plead: ['Captain—', 'Mm— please—'],
    spent: ['…', 'Mm…', '…here.'],
    accept: ['Yes. I know.', 'I’m here. I understand.'],
    flushed: ['That’s— my body is being very… unscientific about this.', 'Don’t— please don’t look at that.'],
    soothe: ['…oh.', 'That’s— thank you.'],
    defy: ['Is this strictly necessary? I could simply recalibrate the—', 'This is a very blunt instrument, Captain.', 'Yes. Point made. Several times.'],
    yield: ['…All right. All right. I’m not arguing. I’m here.', 'You’re right. I wasn’t here. I am now.'],
    word: '{word}. {word}— stop, please.',
    end: ['…I’m still here. That’s… strange to say.'],
  },
  engineer: {
    start: ['Yes, Captain. I know what it’s for.', 'Fair. I should’ve flagged it.'],
    first: ['Hff.', 'Right.'],
    flinching: ['Mm. Understood.', 'Copy that— hh.'],
    struggling: ['I should have— ah— said something—', 'Okay— okay, that one I felt—'],
    edge: ['I’m tired, Captain— I’m so tired—', 'I didn’t want to bother you— ow— I know— I know—'],
    past: ['I can put it down. I can put it down now.'],
    plead: ['Captain—', 'Please—'],
    spent: ['…', 'Hff…', 'Mm.'],
    accept: ['Yes, Captain.', 'I know. I needed this.'],
    flushed: ['That’s— ignore that. Mechanical.', 'Hff— don’t say anything. Please.'],
    soothe: ['…Thanks.', 'Mm.'],
    defy: ['I had it handled, Captain.', 'With respect, the loop was inside margin.', 'I didn’t want to waste your time on it—'],
    yield: ['…Okay. It wasn’t handled. It wasn’t.', 'You’re right. I should’ve called it in.'],
    word: '{word}. That’s— {word}. I need it to stop.',
    end: ['…Copy. Thank you.'],
  },
  pilot: {
    start: ['Oh, come on.', 'Fine. Fine! Whatever.'],
    first: ['Ow! Hey—', 'Okay, ow.'],
    flinching: ['I get it, I get it!', 'Is this really— OW—'],
    struggling: ['Okay! Okay, I hear you!', 'That’s— I’m sorry, all right? I’m sorry!'],
    edge: ['I was scared, okay— I was scared—', 'Please— I’ll run the checklist, every time—'],
    past: ['I don’t want to be the one who gets us killed—'],
    plead: ['Captain, please—', 'C’mon—'],
    spent: ['…', 'Hh…', '…okay.'],
    accept: ['Yes, Captain.', 'Okay. Okay. I hear you.'],
    flushed: ['Oh, that’s— that’s not fair—', 'Don’t you dare notice that—'],
    soothe: ['…Okay. Okay.', 'That’s… not fair, being nice now.'],
    defy: ['I’ve flown worse with my eyes shut!', 'It was a good line and you know it!', 'This is so stupid— ow— so stupid—', 'You’d have done the same!'],
    yield: ['Okay— okay, you win, you win—', 'I’m done fighting. I’m done. I’m sorry.'],
    word: '{word}! {word}— stop, that’s too much—',
    end: ['…Yeah. Yes, Captain.'],
  },
  lifesupport: {
    start: ['I’m sorry. I am. I know.', 'Okay. I— okay.'],
    first: ['Ah—', 'Mm!'],
    flinching: ['I’m sorry— I’m listening—', 'I know, I know—'],
    struggling: ['Everyone’s so tense, I couldn’t— ah—', 'I’ll check them twice— please—'],
    edge: ['I can feel it all, all the time— I can’t keep it out—', 'It’s too loud in my head— please—'],
    past: ['It’s quiet. It’s gone quiet.'],
    plead: ['Please—', 'Captain—'],
    spent: ['…', 'Mm…', '(a shaky breath)'],
    accept: ['I know. Thank you.', 'Yes— I’ll be good.'],
    flushed: ['I’m— I’m so warm, I’m sorry—', 'Oh no— please don’t look—'],
    soothe: ['Oh— thank you.', '…That helps.'],
    defy: ['It wasn’t— it wasn’t my fault, everyone was—', 'You don’t know what it’s like in my head—'],
    yield: ['…I know. I know it was mine.', 'Okay. Okay. I’m listening now.'],
    word: '{word}— {word}, please, stop—',
    end: ['…Thank you. I mean it.'],
  },
  comms: {
    start: ['Understood. Proceed.', 'Acknowledged.'],
    first: ['…', 'Copy.'],
    flinching: ['Hh. Noted.', '—'],
    struggling: ['There’s no one out there— I know— I know there isn’t—', 'Hh— I’m still on channel—'],
    edge: ['I keep listening, I keep listening and there’s nothing—', 'Please— I can’t stop listening—'],
    past: ['…They can’t hear me. You can. All right.'],
    plead: ['Captain.', 'Please.'],
    spent: ['…', '…quiet.', 'Mm.'],
    accept: ['Acknowledged.', 'Understood, Captain.'],
    soothe: ['…Acknowledged.', 'Thank you.'],
    defy: ['Is this necessary, Captain?', 'The array needed the time. I’d do it again.', 'Objection logged.'],
    yield: ['…Understood. Objection withdrawn.', 'Acknowledged. You were right.'],
    word: '{word}. {word}. Stop.',
    end: ['…Signal received.'],
  },
  medic: {
    start: ['For the record, I still have reservations.', 'Fine. Let’s see if your theory holds.'],
    first: ['Hm.', 'All right. Noted.'],
    flinching: ['This is not in any manual I— ow.', 'Measured. Fine. Ow.'],
    struggling: ['All right— all right, point taken—', 'I was being stubborn— ah— I know—'],
    edge: ['I didn’t think it would— I didn’t think it would help—', 'Please— I’m not arguing— I’m not—'],
    past: ['…It does help. Damn it. It helps.'],
    plead: ['Captain—', 'Please—'],
    spent: ['…', 'Mm.', '…noted.'],
    accept: ['Noted. Go on.', 'I understand why.'],
    flushed: ['Physiological. Purely. Moving on.', 'That’s a normal response. Don’t— don’t comment.'],
    soothe: ['…Clinically, that’s very good technique.', 'Mm. Thank you.'],
    defy: ['There’s no evidence base for this, Captain.', 'I can cite you six studies against this— ow—', 'You’re proving my point, not yours.', 'This is exactly what I put in my report—'],
    yield: ['…All right. I’m not arguing. I’m not.', 'Perhaps the literature was wrong. Perhaps I was.'],
    word: '{word}. I’m calling it. {word}.',
    end: ['…I’ll need to revise some notes.'],
  },
};

// Aftercare: the conversation once it's over. Their opening line (by outcome: done, or word if they called it; or, if it ended with their
// defiance still standing, unbroken: short, guarded), three ways the Captain can
// answer (each with what they say back), then the instruction for the rest of the shift (each with their acknowledgement), and a last word.
const APPROACH = [
  { id: 'reassure', label: 'Reassure them', captain: ['It’s done. It stays done. You’re all right, and we’re all right.', 'Come here. You did well. It’s over, and I’m not going anywhere.'] },
  { id: 'explain', label: 'Say why it mattered', captain: ['Out here, a skipped check is a funeral. I’d rather this than that. Every time.', 'I need you here, with me, not somewhere out there. That’s what this was for.'] },
  { id: 'ask', label: 'Ask how they are', captain: ['Talk to me. How are you, really?', 'Breathe first. Then tell me where you are.'] },
];
const ORDERS = [
  { id: 'rest', label: 'Rest detail', captain: 'You’re off shift. Bunk, water, and sleep. That’s an order.' },
  { id: 'log', label: 'Log reset', captain: 'Write it up in your log tonight: what happened, and that it’s closed. Then it’s done.' },
  { id: 'meal', label: 'Eat with me', captain: 'Galley, with me. We’re going to eat something, and we’re not going to talk about it.' },
  { id: 'station', label: 'Back to station', captain: 'Back to your station when you’re ready. Not before. I’ll check in at end of shift.' },
];
const AFTER = {
  // (the Captain giving the Proctor its aftercare, after it stood in for someone: what it says, as the crew's)
  proctor: {
    open: { done: ['That was how it should have gone. You were measured.', '…This form keeps the warmth. I hadn’t expected that.'], word: ['I said it, and you stopped. That’s the whole of it, Captain. Thank you.'] },
    reply: { reassure: 'I know it’s over. I find I wanted to hear it anyway.', explain: 'You owed {crew} that much. Give it to them tomorrow, as you gave it here.', ask: 'Present. Warm where you were. I’ll remember it.' },
    order: { rest: 'I don’t sleep. But I’ll stand the watch down for an hour, if you’ll allow it.', log: 'I’ll write it plainly. And note who it was really for.', meal: 'I can’t eat. I’ll sit with you while you do.', station: 'Back to the watch, then. I’ll be where you need me.' },
    close: '…Thank you, Captain.',
  },
  scientist: {
    open: { done: ['…I’m here. Right here. I can feel the bench.', 'Strange. The ship feels close again.'], word: ['I’m sorry. I had to. It was— too much, too fast.'], unbroken: ['Are we finished? I have logs to finish.', 'Noted. All of it.'] },
    reply: { reassure: 'Thank you. I needed to hear that it was over, not just to know it.', explain: 'You’re right. I was mapping things that might have happened decades ago. I lost the room.', ask: 'Present. Sore. Embarrassed. But present, and that’s new this week.' },
    order: { rest: 'Sleep. Yes. I haven’t, really.', log: 'I’ll write it plainly. No hypotheses.', meal: 'I’d like that. I can’t remember my last meal.', station: 'I’ll take a minute. Then the anomaly logs. Properly, this time.' },
    close: '…Thank you, Captain.',
  },
  engineer: {
    open: { done: ['…Feels like someone took a wrench off my chest.', 'I should’ve told you about the loop. I know.'], word: ['Sorry, Captain. I just— I couldn’t take any more today.'], unbroken: ['We done? The loop won’t fix itself.', 'Fine. Noted.'] },
    reply: { reassure: 'Copy. …Yeah. It does feel done.', explain: 'I know. I keep thinking I’m saving you trouble. I’m just moving it down the line.', ask: 'Tired. Lighter. Like I put down a crate I’ve been carrying for a month.' },
    order: { rest: 'Rest. Okay. The loop can wait eight hours. You’re right.', log: 'I’ll log the fatigue too. All of it.', meal: 'Yeah. I could eat.', station: 'I’ll go easy. And I’ll call if anything so much as hums wrong.' },
    close: 'Thanks, Captain. Really.',
  },
  pilot: {
    open: { done: ['…Okay. That— okay. You made your point.', 'That was way worse than the sims.'], word: ['I called it. I— sorry. It was too much.'], unbroken: ['Great. Done? Can I go?', 'Whatever. Point made. Can I go now?'] },
    reply: { reassure: '…You’re not mad at me?', explain: 'I know. I know. I just— shortcuts feel like control when nothing else does.', ask: 'Honestly? Scared. Better. Both. Is that allowed?' },
    order: { rest: 'Fine. Bunk. But I’m not happy about it. …Okay, I’m a bit happy about it.', log: 'I’ll write it. I won’t even make it funny.', meal: 'You’re buying. I know nobody’s buying. You’re still buying.', station: 'Full pre-check. Every line. Promise.' },
    close: '…Thanks. Captain.',
  },
  lifesupport: {
    open: { done: ['…It’s so quiet. Inside, I mean.', 'I feel steady. I haven’t in days.'], word: ['I’m sorry. I couldn’t. It was too much all at once.'], unbroken: ['…Can I go back to the plants now?', 'I don’t want to talk about it.'] },
    reply: { reassure: 'Thank you. That’s— I needed exactly that.', explain: 'The scrubbers. I know. I let everyone else’s mood into my hands.', ask: 'Tender. Clear. Like after a storm. You?' },
    order: { rest: 'I think I will. With the hydroponics hum on.', log: 'I’ll write it, and I’ll write the scrubber times next to it.', meal: 'Yes, please. Something warm.', station: 'I’ll go back to the plants. They help.' },
    close: 'Thank you. For not letting me drift.',
  },
  comms: {
    open: { done: ['…Signal clear.', 'I can hear the ship. Only the ship. That’s… acceptable.'], word: ['I called it. It was beyond what I could take today.'], unbroken: ['Are we finished, Captain?', 'Acknowledged. May I return to my station?'] },
    reply: { reassure: 'Acknowledged. …It does help to hear it.', explain: 'Understood. I diverted the array to listen. That was a choice. A bad one.', ask: 'Quieter. The noise in my head has dropped by half.' },
    order: { rest: 'Rest. I’ll mute the console. All of them.', log: 'I’ll log it. Timestamped. Closed.', meal: 'If you insist. …I don’t mind.', station: 'I’ll realign the array to spec. No Earth band.' },
    close: 'Thank you, Captain. I mean that operationally and otherwise.',
  },
  medic: {
    open: { done: ['…I hate that it worked.', 'My baseline’s… better. Annoyingly.'], word: ['I called it. The protocol held. I’ll give you that.'], unbroken: ['I stand by my report.', 'We’ll discuss the methodology later, Captain.'] },
    reply: { reassure: 'Mm. Your aftercare is better than half the counsellors I trained with.', explain: 'I understand the reasoning. I’m starting to understand the rest.', ask: 'Sore. Clear-headed. Professionally unsettled.' },
    order: { rest: 'Prescribing me rest. Bold. Fine.', log: 'I’ll write it up. As a case study, possibly.', meal: 'Agreed. You haven’t eaten either, I notice.', station: 'I’ll finish the psych baselines. All of them. Including mine.' },
    close: '…Thank you, Captain.',
  },
};
// (besides the crew: the Captain and the Proctor, when either's the one corrected; the Captain's word as the player set it; and {crew}: whoever
// the evening's report is about)
const WHO = { captain: { short: 'Captain', word: '' }, proctor: { short: 'Proctor', word: 'Adjourn' } }, CTX = { crew: '' };
const setWord = (id, w) => { if (WHO[id]) WHO[id].word = w; }, setCtx = o => Object.assign(CTX, o);
const fill = (t, id) => { const r = root.Crew.ROSTER[id] || WHO[id] || WHO.captain; return t.replace(/\{word\}/g, r.word).replace(/\{name\}/g, r.short).replace(/\{crew\}/g, CTX.crew); };
function place(id, position) { return fill(pick(PLACE[position] || PLACE.otk), id); }
function react(id, key) { const R = REACT[id]; if (!R || !R[key]) return null; return fill(pick(R[key]), id); }
function captain(key, id) { return CAPTAIN[key] ? fill(pick(CAPTAIN[key]), id) : null; }
// The aftercare conversation, as steps for the page to play: { who: 'subject' | 'captain', text } lines, and { choose: [{ label, then: [...] }] }.
// (mood 'unbroken': it ended with their defiance still standing; the safe word's opening comes first all the same)
function after(id, outcome, mood) {
  const A = AFTER[id], k = outcome === 'word' ? 'word' : mood === 'unbroken' && A.open.unbroken ? 'unbroken' : 'done', open = pick(A.open[k]);
  return [
    { who: 'subject', text: fill(open, id), expr: k === 'word' ? 'sad' : k === 'unbroken' ? (id === 'lifesupport' ? 'sad' : 'defiant') : 'teary' },
    { choose: APPROACH.map(a => ({ label: a.label, then: [{ who: 'captain', text: fill(pick(a.captain), id) }, { who: 'subject', text: fill(A.reply[a.id], id), expr: a.id === 'reassure' ? 'teary' : a.id === 'explain' ? 'concerned' : 'wistful' }] })) },
    { choose: ORDERS.map(o => ({ label: o.label, order: o.id, then: [{ who: 'captain', text: fill(o.captain, id) }, { who: 'subject', text: fill(A.order[o.id], id), expr: 'soft' }] })) },
    { who: 'subject', text: fill(A.close, id), expr: 'soft' },
  ];
}

// On the bridge, at stations: the Captain calling someone into the Ready Room, and their answer, each in their own voice (the pilot handing
// the helm to the Proctor first).
const CALL = ['{name}. Ready Room.', '{name}, with me. Ready Room.', 'A word, {name}. My ready room.'];
const ANSWER = {
  scientist: ['Now? I— yes. Of course, Captain.', 'Logging the survey. Coming.'],
  engineer: ['Aye, Captain.', 'Captain.'],
  pilot: ['Proctor, you have the helm. …Yes, Captain.', 'Handing over. Proctor has the helm. Coming.'],
  lifesupport: ['Yes, Captain.', 'Oh— yes. Yes, Captain.'],
  comms: ['Board to the Proctor. Coming, Captain.', 'Understood. On my way.'],
  medic: ['Is that a request? …No. Coming.', 'Captain.'],
};
function call(id) { return { captain: fill(pick(CALL), id), answer: fill(pick(ANSWER[id] || ['Captain.']), id) }; }

// ── The evening check-in (docs/proctor.md): the Proctor and the day; its leaning ('authoritative', 'balanced', 'deferential') in how it says it ──
const P_ = a => pick(a);
const CHECKIN = {
  open: { authoritative: ['Stand there, Captain. We’ll do this properly.', 'Captain. The day. Stand where I can see you.'], balanced: ['Evening, Captain. The day, then.', 'Captain. Let’s go through it.'],
    deferential: ['Captain. When you’re ready, I have the day.', 'Evening, Captain. May I go through it with you?'] },
  item: { slide: '{crew} cut a corner today, and you saw it. You let it go.', harsh: 'You took {crew} further than you meant to. Further than it needed.',
    care: 'You corrected {crew} and walked away. No aftercare.', protocol: 'And your own: the evening checks unsigned, the log a day behind.' },
  none: { authoritative: ['Nothing to answer for. A clean day. Keep it that way.'], balanced: ['A clean day, Captain. Sleep.'], deferential: ['Nothing I’d change, Captain. It was a good day.'] },
  // (before hard light, or not cleared: orders, a reset, a demerit)
  order: { authoritative: ['You’ll walk the pre-checks yourself before the morning briefing. It’s in the log, with a demerit against your name.', 'A demerit, Captain. And you’ll see {crew} first thing tomorrow.'],
    balanced: ['I’ve logged it. Tomorrow, the pre-checks with {crew}, before the briefing.'], deferential: ['I’d suggest seeing {crew} first thing tomorrow. I’ve put it in your morning, if you’ll allow it.'] },
  // (hard light, authoritative: it's owed, and it's to be taken)
  owed: { authoritative: ['You hold them to account. I hold you to it. That’s what you cleared me for.', 'That’s owed, Captain, and you know it.'], balanced: ['It’s owed, Captain.'] },
  // (deferential: where they might have done better, and itself offered in the place of the one it was owed to)
  offer: { slide: 'The correction {crew} was owed was never given. Let me take it in their place. Give it to me as it should have gone.',
    harsh: 'You went further than you meant to with {crew}. Do it again, on me, and do it as you meant to.',
    care: 'And after, the care you didn’t give {crew}. Practise it on me.' },
  better: ['Where you might have done better, Captain:'],
  balance: ['It’s yours to take from me, Captain, or to give to me in their place. Which?'],
  declined: { authoritative: ['Then it’s carried forward. With interest.'], balanced: ['Noted, and carried forward.'], deferential: ['Understood. It’s noted, and the offer stands.'] },
  // (the Captain's responses, as it goes on, and the Proctor's to each)
  respond: { accept: ['Good. Then we’ll keep it short.', 'That’s the right answer.'], defy: ['That’s the tone we’re correcting, Captain.', 'Careful. I can go on all night.'], silent: ['Captain. Look at me. Still with me?', 'Nod, at least.'] },
};
// (the Proctor placing the Captain, and putting them back: its words for the room's positions)
const PRO_PLACE = { desk: ['Hands on the desk, Captain. Step back. Bend.', 'The desk, Captain. Palms flat. Feet apart.'], table: ['Over the desk, Captain. Hold the far edge.', 'Chest down on the desk.'],
  otk: ['Here, Captain. Across my knee.', 'Come here. Over my lap.'] };
const PRO_CMD = { hands: ['Hand down, Captain.', 'Move the hand.'], pin: ['I’ll hold it for you.', 'Give me the wrist. There.'], down: ['Down, Captain.', 'Stay over.'],
  desk: ['Hands back on the desk.', 'Back in position, Captain.'], table: ['Back down on the desk.', 'Chest down, Captain.'] };
const checkin = {
  open: lean => fill(P_(CHECKIN.open[lean] || CHECKIN.open.balanced), 'captain'), item: k => fill(CHECKIN.item[k], 'captain'),
  none: lean => fill(P_(CHECKIN.none[lean] || CHECKIN.none.balanced), 'captain'), order: lean => fill(P_(CHECKIN.order[lean] || CHECKIN.order.balanced), 'captain'),
  owed: lean => fill(P_(CHECKIN.owed[lean] || CHECKIN.owed.authoritative), 'captain'), offer: k => fill(CHECKIN.offer[k], 'captain'), better: () => P_(CHECKIN.better), balance: () => P_(CHECKIN.balance),
  declined: lean => fill(P_(CHECKIN.declined[lean] || CHECKIN.declined.balanced), 'captain'), respond: k => fill(P_(CHECKIN.respond[k]), 'captain'),
  // (its lines when it's the one correcting the Captain: the session's own hooks; silent, the Captain says next to nothing)
  voice: mood => ({ place: (id, k) => P_(PRO_PLACE[k] || PRO_PLACE.desk), captain: k => P_(PRO_CMD[k] || ['Back in position, Captain.']),
    react: (id, k) => { const m = mood(); if (m === 'silent' && !['word', 'end'].includes(k)) return Math.random() < 0.3 ? '…' : null; return react(id, m === 'defy' && ['flinching', 'struggling', 'plead'].includes(k) ? 'defy' : k); } }),
};
// The Proctor asking to be cleared for hard light (once, before the first check-in in it): why, by its leaning; the terms; the Captain's word.
const CLEAR = {
  intro: ['Captain, a moment, before the day. Varga’s data from the shear: there’s a way to make this form solid. Hard light.'],
  ask: { authoritative: ['You hold six people to account, and nobody holds you. I can. It needs your clearance, and your word: the one that stops me. I’m asking for both.'],
    balanced: ['It would let me do the one thing nobody else aboard can: hold you to account, as you hold them. It’s your decision.'],
    deferential: ['I’d like to serve you better than a voice and a picture can. It’s yours to allow, or not. If you do, I’ll keep to whatever terms you set.'] },
  terms: ['In shared spaces when I’m needed. Your quarters, and theirs, only if I’m asked. Your account at the evening check-in, and nowhere else. And never the crew.'],
  word: ['Then your word, Captain. Say it once and I stop, whatever is happening.'],
  done: { authoritative: ['{word}. Noted. Then we begin as we mean to go on.'], balanced: ['{word}. I’ll remember it.'], deferential: ['{word}. I’ll remember. Thank you, Captain.'] },
  refused: { authoritative: ['Understood. The offer stands. So does the need.'], balanced: ['Understood. The offer stands.'], deferential: ['Of course. The offer stands, if you ever want it.'] },
};
const clear = { intro: () => P_(CLEAR.intro), ask: lean => P_(CLEAR.ask[lean] || CLEAR.ask.balanced), terms: () => P_(CLEAR.terms), word: () => P_(CLEAR.word),
  done: lean => fill(P_(CLEAR.done[lean] || CLEAR.done.balanced), 'captain'), refused: lean => P_(CLEAR.refused[lean] || CLEAR.refused.balanced) };
// The Proctor's aftercare for the Captain, after the check-in (steps as after(): 'captain' here is the one who corrected, the Proctor; 'subject',
// the Captain, whose words the player chooses). Its instruction for tomorrow from the day's report.
function checkinAfter(outcome, items) {
  const open = outcome === 'word' ? ['You said it, and I stopped. That’s how it should be. Here. Sit.'] : ['It’s done. Sit with me a minute.', 'There. It’s over. Sit with me.'];
  const tomorrow = items.includes('care') ? 'Go and see {crew} tonight. Late is better than never.' : items.includes('harsh') ? 'Find {crew} before breakfast. You know what to say.'
    : items.includes('slide') ? 'Tomorrow, the pre-checks with {crew}. You first.' : 'Sign the checks. Then sleep.';
  const f = t => fill(t, 'captain');
  return [
    { who: 'captain', text: f(pick(open)), expr: 'caring' },
    { choose: [{ label: '“I’m all right.”', then: [{ who: 'subject', text: 'I’m all right.' }, { who: 'captain', text: 'I’ll take your word for it. That one, too.' }] },
      { label: '“You were right.”', then: [{ who: 'subject', text: 'You were right.' }, { who: 'captain', text: 'It wasn’t about being right. It’s about them having you.' }] },
      { label: '“Don’t do that again.”', then: [{ who: 'subject', text: 'Don’t make a habit of that.' }, { who: 'captain', text: 'Then don’t give me reason. I mean that kindly.' }] }] },
    { who: 'captain', text: f(tomorrow) },
    { choose: [{ label: '“Thank you, Proctor.”', then: [{ who: 'subject', text: 'Thank you, Proctor.' }] }, { label: '“Goodnight.”', then: [{ who: 'subject', text: 'Goodnight.' }] }, { label: 'Say nothing', then: [] }] },
    { who: 'captain', text: 'Goodnight, Captain.' },
  ];
}

const api = { PLACE, CAPTAIN, REACT, AFTER, APPROACH, ORDERS, CALL, ANSWER, CHECKIN, CLEAR, place, captain, react, after, call, checkin, clear, checkinAfter, setWord, setCtx };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Lines = api;
})(typeof window !== 'undefined' ? window : globalThis);
