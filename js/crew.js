// Project Meridian — who's aboard: the Captain (the player), the Proctor (the ship's AI), and six crew (GDD §5). The roles, domains, profiles and
// dynamics are the GDD's. The rest is a first draft for review: names that read as either gender (the player chooses each crew member's gender,
// and the AI's, at the start), a baseline body type per crew member, translated to male or female, their looks, voices, and the safe word each
// agreed when the method was explained to them and they consented to it.
//
//   Crew.ROSTER.engineer · Crew.figureSpec('engineer', 'f', outfit) → a spec for Figure.make · Crew.pronouns('f') → { they, them, their }
(function (root) {
'use strict';

// meters (GDD §3.1): Stress, Wilfulness, Resentment, Compliance. For now: wilfulness, each crew member's baseline (meters.wilfulness, 0–1:
// how much defiance they bring to a correction, the set-up's starting point for it), and the Resentment and Compliance a correction leaves
// (js/session.js). Stress isn't tracked yet.
const METERS = ['stress', 'wilfulness', 'resentment', 'compliance'];

// pain: how much they can take (tolerance) and how fast it fades (resilience), for js/pain.js.
// body: the baseline type (height in metres for each sex; mass = muscle and frame, fat = softness, 0–1; bust: its size in the female translation,
// 0 (small) – 1 (large); in the male translation the same number sizes his sex, the Captain's the largest; response: how readily their body
// answers a correction (blood to the sex: a bodily response, not a measure of desire, so the asexual crew member is no different), 1 for
// everyone for now). dynamic.bond: the affection between them and the Captain, given and returned, 0–1 (not yet tracked by the game; the more
// of it, the less he keeps his own response in check). dept: their department colour on the uniform.
const ROSTER = {
  scientist: { id: 'scientist', meters: { wilfulness: 0.3 }, pain: { tolerance: 0.55, resilience: 0.5 }, name: 'Rowan Varga', short: 'Varga', title: 'Dr.', role: 'Mission Specialist (Chief Scientist)', age: 41,
    domain: ['anomaly mapping', 'research logs', 'mission objectives'],
    profile: 'Brilliant, intellectualized, suffering from severe temporal dissociation. Hides unraveling behind detachment; requires grounded, physical discipline to reconnect to purpose.',
    dynamic: { romance: true, switch: true, bond: 0 },
    body: { type: 'tall and lean, long-limbed', h: { m: 1.803, f: 1.702 }, mass: 0.3, fat: 0.3, bust: 0.25, response: 1 },
    look: { skin: '#d6ad8e', hair: '#2e2420', hairStyle: { m: 'short', f: 'bun' }, eyes: '#5a6a58', beard: false },
    dept: '#3a9a9e', word: 'Parallax', base: 'calm' },
  engineer: { id: 'engineer', meters: { wilfulness: 0.15 }, pain: { tolerance: 0.75, resilience: 0.65 }, name: 'Sam Okafor', short: 'Okafor', role: 'Chief Engineer', age: 38,
    domain: ['fusion drive', 'thermal loops', 'hull integrity'],
    profile: 'Utilitarian, overworked, hyper-competent. Prone to hiding equipment fatigue to avoid "bothering" command (the classic exhaustion trap).',
    dynamic: { romance: true, switch: true, partner: 'pilot', bond: 0 },
    body: { type: 'broad and heavy, powerful', h: { m: 1.93, f: 1.778 }, mass: 0.88, fat: 0.5, bust: 0.7, response: 1 },
    look: { skin: '#5e3c2a', hair: '#161210', hairStyle: { m: 'crop', f: 'curls' }, eyes: '#2a1c14', beard: true },
    dept: '#c8641e', word: 'Scram', base: 'calm' },
  pilot: { id: 'pilot', meters: { wilfulness: 0.75 }, pain: { tolerance: 0.5, resilience: 0.6 }, name: 'Kit Ashdown', short: 'Ashdown', role: 'Flight Officer (Pilot)', age: 31,
    domain: ['helm control', 'RCS thrusters', 'spatial maneuvers'],
    profile: 'High ego, high wilfulness. Translates deep-space anxiety into reckless shortcut-taking and protocol defiance.',
    dynamic: { romance: true, switch: true, partner: 'engineer', bond: 0 },
    body: { type: 'compact and athletic', h: { m: 1.702, f: 1.575 }, mass: 0.6, fat: 0.2, bust: 0.3, response: 1 },
    look: { skin: '#e4bc9a', hair: '#a8642e', hairStyle: { m: 'short', f: 'ponytail' }, eyes: '#3a6a8a', beard: false },
    dept: '#b8322e', word: 'Mayday', base: 'defiant' },
  lifesupport: { id: 'lifesupport', meters: { wilfulness: 0.1 }, pain: { tolerance: 0.42, resilience: 0.45 }, name: 'Noor Haddad', short: 'Haddad', role: 'Life Support Specialist', age: 29,
    domain: ['hydroponics', 'atmospheric scrubbers', 'water reclamation'],
    profile: 'Highly sensitive, deeply attuned to ambient crew mood. Stress causes focus slips that directly threaten the food/air supply.',
    dynamic: { romance: true, switch: true, bond: 0 },
    body: { type: 'soft and rounded, average height', h: { m: 1.753, f: 1.626 }, mass: 0.4, fat: 0.7, bust: 1.0, response: 1 },
    look: { skin: '#b07e56', hair: '#22160e', hairStyle: { m: 'curls', f: 'bob' }, eyes: '#3a2414', beard: false },
    dept: '#5a9a48', word: 'Greenhouse', base: 'concerned' },
  comms: { id: 'comms', meters: { wilfulness: 0.35 }, pain: { tolerance: 0.62, resilience: 0.5 }, name: 'Sefa Lindqvist', short: 'Lindqvist', role: 'Communications & Sensor Officer', age: 35,
    domain: ['deep-space telemetry', 'sensor array alignment', 'data logging'],
    profile: 'Obsessively focused on reinitiating contact with Earth. Tragically consumed by chasing dead signals.',
    dynamic: { romance: false, aromantic: true, asexual: true, basis: 'professional respect, operational trust, and mutual survival', bond: 0 },
    body: { type: 'slight and wiry', h: { m: 1.778, f: 1.676 }, mass: 0.32, fat: 0.15, bust: 0.06, response: 1 },
    look: { skin: '#e8cdb6', hair: '#d8d0c0', hairStyle: { m: 'shaved', f: 'crop' }, eyes: '#7a8aa0', beard: false },
    dept: '#8a62c0', word: 'Carrier', base: 'calm' },
  medic: { id: 'medic', meters: { wilfulness: 0.6 }, pain: { tolerance: 0.58, resilience: 0.62 }, name: 'Morgan Ruel', short: 'Ruel', title: 'Dr.', role: 'Systems Medic / Safety Warden', age: 47,
    domain: ['medical care', 'EVA safety enforcement', 'psychological baseline checks'],
    profile: 'Classically trained in modern corporate counseling. Begins as an ideological skeptic of archaic discipline, creating strong early-game friction before recognizing its survival necessity.',
    dynamic: { romance: true, switch: true, arc: 'hard-won trust', bond: 0 },
    body: { type: 'sturdy and solid, mature', h: { m: 1.778, f: 1.651 }, mass: 0.6, fat: 0.55, bust: 0.6, response: 1 },
    look: { skin: '#e2b896', hair: '#7a726a', hairStyle: { m: 'crop', f: 'bob' }, eyes: '#4a3a2a', beard: true },
    dept: '#d8d4cc', word: 'Triage', base: 'stern' },
};
// Off duty: each their own (the Captain keeps the henley, canvas trousers and boots). They never make landfall, so it's what they'd wear about
// the ship: their own style, practical at home, soft indoor shoes over socks rather than boots. top: thermal | open (a printed shirt open over
// a tee) | waistcoat (over a shirt: shirt, its colour; scarf, a scarf at the collar) | sweatervest (likewise, knitted, down to the hem) |
// cardigan (over a collared shirt) | tee (printed);
// sleeves: long, or rolled (pushed up); tunic: the top's main colour; shirt: what's under it; print, accent: its print's colours (or buttons,
// stitching, a scarf, a thread); legs: joggers | chinos | work | combat | pressed, in trousers, with legAccent; shoes: soft | deck | work |
// sneakers | flats | loafers, in shoe, on sole, with trim, over sock.
const OFFDUTY = {
  // Sefa: the simplest: base layers, comfort first: a fitted thermal and loose joggers, no prints, seams kept flat, in soft purples and lilacs
  // (a heathered lilac thermal, deep plum joggers, lilac socks); a violet thread at a cuff. Soft felt shoes.
  comms: { top: 'thermal', sleeves: 'long', tunic: '#a28ec6', accent: '#5e3f8e', trousers: '#4e3d6b', legs: 'joggers', legAccent: '#6a5888', shoes: 'soft', shoe: '#5e5078', sole: '#3a3248', sock: '#bba9da' },
  // Rowan: expressive, short of quirky: a bold botanical print, a shirt worn open over a plain long-sleeved tee, olive chinos, canvas deck shoes.
  scientist: { top: 'open', sleeves: 'long', tunic: '#24575a', shirt: '#d9d2c2', print: '#e0d2a6', accent: '#7fa05c', trousers: '#66663f', legs: 'chinos', legAccent: '#4e4e30', shoes: 'deck', shoe: '#2e3a4a', sole: '#ebe5d8', trim: '#ebe5d8', sock: '#8a7a5a' },
  // Sam: quiet, steady, comfortable but with a style of their own: a dark henley, sleeves pushed up, under a worn leather waistcoat; heavy
  // work trousers with double knees and rust stitching; soft-soled leather work shoes.
  engineer: { top: 'waistcoat', sleeves: 'rolled', tunic: '#6a4630', shirt: '#3a3d42', print: '#b08a4a', accent: '#a4562a', trousers: '#3e3a34', legs: 'work', legAccent: '#a4562a', shoes: 'work', shoe: '#5a3e2a', sole: '#2a2420', trim: '#a4562a', sock: '#4a4a4e' },
  // Kit: bright and cheerful: a sunny printed tee (small flowers), sleeves pushed up, faded red carpenter trousers with bellows pockets and a
  // hammer loop, canvas trainers.
  pilot: { top: 'tee', sleeves: 'rolled', tunic: '#e0b64a', print: '#f4efe2', accent: '#d0604a', trousers: '#9a4a3e', legs: 'combat', legAccent: '#6e3028', shoes: 'sneakers', shoe: '#ece9e0', sole: '#f6f4ee', trim: '#d0604a', sock: '#e0b64a' },
  // Noor: well presented: a high-collared cream blouse under a deep green knitted sweater vest (down to the blouse's hem, ribbed at the V,
  // armholes and hem), a soft scarf at the collar, pressed tapered trousers, neat flats.
  lifesupport: { top: 'sweatervest', sleeves: 'long', scarf: true, tunic: '#2f5a44', shirt: '#ece4d2', print: '#c8a45a', accent: '#c88a6a', trousers: '#2a2e3a', legs: 'pressed', legAccent: '#3a3f4e', shoes: 'flats', shoe: '#1e2a22', sole: '#141414', trim: '#c8a45a', sock: '#2a2e3a' },
  // Morgan: straight-laced but warm: a crisp collared shirt under a mustard cable-knit cardigan, pressed grey slacks, polished loafers.
  medic: { top: 'cardigan', sleeves: 'long', tunic: '#b8892e', shirt: '#eeeae2', print: '#4a3a2a', accent: '#8a6420', trousers: '#4e4f55', legs: 'pressed', legAccent: '#5e5f66', shoes: 'loafers', shoe: '#5a3424', sole: '#2a1a14', trim: '#3a2218', sock: '#3a3a40' },
};
for (const id in OFFDUTY) ROSTER[id].offduty = OFFDUTY[id];
const IDS = Object.keys(ROSTER);
// How much they squirm under a correction, 0 (stoic) – 1 (the most wriggly): the smaller they are the more (their height in that translation
// against the crew's, and their mass), and the more pain they can take, a little the less. body.wriggle, where given, overrides it.
// (So: Haddad 0.84–0.86, Ashdown 0.78–0.79, Varga 0.69–0.77, Lindqvist 0.70–0.76, Ruel 0.60–0.61, Okafor 0.15, the female and male translations.)
const H_SPAN = { f: [1.57, 1.78], m: [1.70, 1.93] };
function wriggle(id, sex) {
  const r = ROSTER[id]; if (!r) return 0.5; if (r.body.wriggle != null) return r.body.wriggle;
  const [h0, h1] = H_SPAN[sex] || H_SPAN.f, h = r.body.h[sex] || r.body.h.f, hn = Math.max(0, Math.min(1, (h - h0) / (h1 - h0)));
  const size = 0.4 * hn + 0.6 * r.body.mass, tol = r.pain && r.pain.tolerance != null ? r.pain.tolerance : 0.5;
  return Math.max(0.15, Math.min(1, 1.15 - size - 0.5 * (tol - 0.5)));
}
const CAPTAIN = { id: 'captain', name: 'Captain', role: 'Captain (Player)', dept: '#c89a3a',
  options: { skin: ['#f0d0b4', '#d6ad8e', '#b88a6a', '#8a5a3e', '#5e3c2a', '#3e281c'], hair: ['#161210', '#3a2a20', '#6a4a2e', '#a8642e', '#c8a46a', '#8a8580'],
    hairStyle: { m: ['crop', 'short', 'shaved', 'curls'], f: ['bun', 'ponytail', 'bob', 'short', 'crop', 'curls'] }, build: { lean: [0.35, 0.25], average: [0.55, 0.4], heavy: [0.8, 0.55] } } };
const PROCTOR = { id: 'proctor', name: 'The Proctor', role: 'Ship’s AI', onlyDisciplinesPlayer: true };

const PRONOUNS = { m: { they: 'he', them: 'him', their: 'his', They: 'He' }, f: { they: 'she', them: 'her', their: 'her', They: 'She' } };
const pronouns = sex => PRONOUNS[sex] || PRONOUNS.f;
// A crew member as a figure: their body type in the chosen sex, their look, and an outfit ('uniform' or 'offduty': their own, `off`).
function figureSpec(id, sex, outfit) {
  const r = ROSTER[id], L = r.look;
  return { sex, height: r.body.h[sex], mass: r.body.mass, fat: r.body.fat, skin: L.skin, hair: L.hair, hairStyle: L.hairStyle[sex], eyes: L.eyes,
    beard: sex === 'm' && L.beard, outfit: outfit || 'uniform', dept: r.dept, bust: r.body.bust, off: r.offduty || null };
}
function captainSpec(c) {
  c = Object.assign({ sex: 'm', skin: '#b88a6a', hair: '#3a2a20', hairStyle: 'crop', build: 'average', beard: true }, c || {});
  const [mass, fat] = CAPTAIN.options.build[c.build] || CAPTAIN.options.build.average;
  return { sex: c.sex, height: c.sex === 'f' ? 1.753 : 1.88, mass, fat, skin: c.skin, hair: c.hair, hairStyle: c.hairStyle, eyes: '#4a5a6a',
    beard: c.sex === 'm' && c.beard, outfit: c.outfit || 'uniform', dept: CAPTAIN.dept, bust: 0.45, size: 1 };
}
// Voice pitch for the babble and cries, by sex (Hz).
const pitch = (id, sex) => (sex === 'm' ? 128 : 208) + ({ scientist: 4, engineer: -14, pilot: 10, lifesupport: 8, comms: 0, medic: -6 }[id] || 0);

const api = { METERS, ROSTER, IDS, CAPTAIN, PROCTOR, pronouns, figureSpec, captainSpec, pitch, wriggle };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Crew = api;
})(typeof window !== 'undefined' ? window : globalThis);
