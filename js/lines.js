// Project Meridian — what's said in a correction: each crew member's scripted responses as it goes (when they're placed, the first smack, as their
// distress crosses each band, when soothed, when they call their safe word because it's gone too far, at the end), the Captain's word to place
// them, and the conversation after, where aftercare is given through what's said and an instruction for the rest of the shift.
// A first draft, in each voice, for review. {word}: their safe word. {name}: what the Captain calls them (their surname).
//
//   Lines.react(id, key) → a line or null · Lines.after(id, outcome) → the aftercare conversation as steps (see the bottom)
(function (root) {
'use strict';
const pick = a => (Array.isArray(a) ? a[Math.floor(Math.random() * a.length)] : a);

// The Captain placing them, by position.
const PLACE = {
  otk: ['Across my knee, {name}.', 'Here. Over my lap.', 'You know where. Across my knee.'],
  wall: ['Hands on the rail, {name}. Feet apart.', 'Face the bulkhead. Grip the rail and hold it.', 'Rail. Both hands. Don’t let go of it.'],
};

// During: start (as they're placed), first (the first smack), flinching, struggling, edge, past (each the first time it's reached), plead
// (now and then while it's hard), soothe (the palm on them, between), word (the safe word, called), end (when the Captain stops).
const REACT = {
  scientist: {
    start: ['Understood. I— yes. Proceeding.', 'This is… a grounding protocol. I know. I agreed to it.'],
    first: ['Oh.', 'Hh— that’s… very present.'],
    flinching: ['I’m here. I’m— here.', 'Data point. Ow. Data point.'],
    struggling: ['That— is not abstract at all—', 'Ah! All right, all right, I’m in the room—'],
    edge: ['I can’t think past it— I can’t— that’s the point, isn’t it—', 'Please— I’m here, I’m listening—'],
    past: ['I’m sorry— I’m sorry, I was so far away—'],
    plead: ['Captain—', 'Mm— please—'],
    soothe: ['…oh.', 'That’s— thank you.'],
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
    soothe: ['…Thanks.', 'Mm.'],
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
    soothe: ['…Okay. Okay.', 'That’s… not fair, being nice now.'],
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
    soothe: ['Oh— thank you.', '…That helps.'],
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
    soothe: ['…Acknowledged.', 'Thank you.'],
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
    soothe: ['…Clinically, that’s very good technique.', 'Mm. Thank you.'],
    word: '{word}. I’m calling it. {word}.',
    end: ['…I’ll need to revise some notes.'],
  },
};

// Aftercare: the conversation once it's over. Their opening line (by outcome: done, or word if they called it), three ways the Captain can
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
  scientist: {
    open: { done: ['…I’m here. Right here. I can feel the bench.', 'Strange. The ship feels close again.'], word: ['I’m sorry. I had to. It was— too much, too fast.'] },
    reply: { reassure: 'Thank you. I needed to hear that it was over, not just to know it.', explain: 'You’re right. I was mapping things that might have happened decades ago. I lost the room.', ask: 'Present. Sore. Embarrassed. But present, and that’s new this week.' },
    order: { rest: 'Sleep. Yes. I haven’t, really.', log: 'I’ll write it plainly. No hypotheses.', meal: 'I’d like that. I can’t remember my last meal.', station: 'I’ll take a minute. Then the anomaly logs. Properly, this time.' },
    close: '…Thank you, Captain.',
  },
  engineer: {
    open: { done: ['…Feels like someone took a wrench off my chest.', 'I should’ve told you about the loop. I know.'], word: ['Sorry, Captain. I just— I couldn’t take any more today.'] },
    reply: { reassure: 'Copy. …Yeah. It does feel done.', explain: 'I know. I keep thinking I’m saving you trouble. I’m just moving it down the line.', ask: 'Tired. Lighter. Like I put down a crate I’ve been carrying for a month.' },
    order: { rest: 'Rest. Okay. The loop can wait eight hours. You’re right.', log: 'I’ll log the fatigue too. All of it.', meal: 'Yeah. I could eat.', station: 'I’ll go easy. And I’ll call if anything so much as hums wrong.' },
    close: 'Thanks, Captain. Really.',
  },
  pilot: {
    open: { done: ['…Okay. That— okay. You made your point.', 'That was way worse than the sims.'], word: ['I called it. I— sorry. It was too much.'] },
    reply: { reassure: '…You’re not mad at me?', explain: 'I know. I know. I just— shortcuts feel like control when nothing else does.', ask: 'Honestly? Scared. Better. Both. Is that allowed?' },
    order: { rest: 'Fine. Bunk. But I’m not happy about it. …Okay, I’m a bit happy about it.', log: 'I’ll write it. I won’t even make it funny.', meal: 'You’re buying. I know nobody’s buying. You’re still buying.', station: 'Full pre-check. Every line. Promise.' },
    close: '…Thanks. Captain.',
  },
  lifesupport: {
    open: { done: ['…It’s so quiet. Inside, I mean.', 'I feel steady. I haven’t in days.'], word: ['I’m sorry. I couldn’t. It was too much all at once.'] },
    reply: { reassure: 'Thank you. That’s— I needed exactly that.', explain: 'The scrubbers. I know. I let everyone else’s mood into my hands.', ask: 'Tender. Clear. Like after a storm. You?' },
    order: { rest: 'I think I will. With the hydroponics hum on.', log: 'I’ll write it, and I’ll write the scrubber times next to it.', meal: 'Yes, please. Something warm.', station: 'I’ll go back to the plants. They help.' },
    close: 'Thank you. For not letting me drift.',
  },
  comms: {
    open: { done: ['…Signal clear.', 'I can hear the ship. Only the ship. That’s… acceptable.'], word: ['I called it. It was beyond what I could take today.'] },
    reply: { reassure: 'Acknowledged. …It does help to hear it.', explain: 'Understood. I diverted the array to listen. That was a choice. A bad one.', ask: 'Quieter. The noise in my head has dropped by half.' },
    order: { rest: 'Rest. I’ll mute the console. All of them.', log: 'I’ll log it. Timestamped. Closed.', meal: 'If you insist. …I don’t mind.', station: 'I’ll realign the array to spec. No Earth band.' },
    close: 'Thank you, Captain. I mean that operationally and otherwise.',
  },
  medic: {
    open: { done: ['…I hate that it worked.', 'My baseline’s… better. Annoyingly.'], word: ['I called it. The protocol held. I’ll give you that.'] },
    reply: { reassure: 'Mm. Your aftercare is better than half the counsellors I trained with.', explain: 'I understand the reasoning. I’m starting to understand the rest.', ask: 'Sore. Clear-headed. Professionally unsettled.' },
    order: { rest: 'Prescribing me rest. Bold. Fine.', log: 'I’ll write it up. As a case study, possibly.', meal: 'Agreed. You haven’t eaten either, I notice.', station: 'I’ll finish the psych baselines. All of them. Including mine.' },
    close: '…Thank you, Captain.',
  },
};
const fill = (t, id) => { const r = root.Crew.ROSTER[id]; return t.replace(/\{word\}/g, r.word).replace(/\{name\}/g, r.short); };
function place(id, position) { return fill(pick(PLACE[position] || PLACE.otk), id); }
function react(id, key) { const R = REACT[id]; if (!R || !R[key]) return null; return fill(pick(R[key]), id); }
// The aftercare conversation, as steps for the page to play: { who: 'subject' | 'captain', text } lines, and { choose: [{ label, then: [...] }] }.
function after(id, outcome) {
  const A = AFTER[id], open = pick(A.open[outcome === 'word' ? 'word' : 'done']);
  return [
    { who: 'subject', text: fill(open, id), expr: outcome === 'word' ? 'sad' : 'teary' },
    { choose: APPROACH.map(a => ({ label: a.label, then: [{ who: 'captain', text: fill(pick(a.captain), id) }, { who: 'subject', text: fill(A.reply[a.id], id), expr: a.id === 'reassure' ? 'teary' : a.id === 'explain' ? 'concerned' : 'wistful' }] })) },
    { choose: ORDERS.map(o => ({ label: o.label, order: o.id, then: [{ who: 'captain', text: fill(o.captain, id) }, { who: 'subject', text: fill(A.order[o.id], id), expr: 'soft' }] })) },
    { who: 'subject', text: fill(A.close, id), expr: 'soft' },
  ];
}

const api = { PLACE, REACT, AFTER, APPROACH, ORDERS, place, react, after };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Lines = api;
})(typeof window !== 'undefined' ? window : globalThis);
