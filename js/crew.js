// Project Meridian — who's aboard, as the Game Design Document states it (§5): the Player (Captain), the Ship's AI ("The Proctor"), and six
// subordinates. Only what the GDD says is filled in. Everything it doesn't say (names, ages, genders/pronouns, looks, voices, starting meter
// values, safe words, correction lines) is left null, pending the design questions in docs/alpha-plan.md.
(function (root) {
'use strict';

// meters (GDD §3.1): Stress, Wilfulness, Resentment, Compliance. Ranges and starting values: open question.
const METERS = ['stress', 'wilfulness', 'resentment', 'compliance'];
const pending = () => ({ name: null, age: null, pronouns: null, look: null, voice: null, meters: null, safeword: null });

const ROSTER = {
  scientist: Object.assign(pending(), { id: 'scientist', role: 'Mission Specialist (Chief Scientist)', domain: ['anomaly mapping', 'research logs', 'mission objectives'],
    profile: 'Brilliant, intellectualized, suffering from severe temporal dissociation. Hides unraveling behind detachment; requires grounded, physical discipline to reconnect to purpose.',
    dynamic: { romance: true, switch: true } }),
  engineer: Object.assign(pending(), { id: 'engineer', role: 'Chief Engineer', domain: ['fusion drive', 'thermal loops', 'hull integrity'],
    profile: 'Utilitarian, overworked, hyper-competent. Prone to hiding equipment fatigue to avoid "bothering" command (the classic exhaustion trap).',
    dynamic: { romance: true, switch: true, partner: 'pilot' } }),
  pilot: Object.assign(pending(), { id: 'pilot', role: 'Flight Officer (Pilot)', domain: ['helm control', 'RCS thrusters', 'spatial maneuvers'],
    profile: 'High ego, high wilfulness. Translates deep-space anxiety into reckless shortcut-taking and protocol defiance.',
    dynamic: { romance: true, switch: true, partner: 'engineer' } }),
  lifesupport: Object.assign(pending(), { id: 'lifesupport', role: 'Life Support Specialist', domain: ['hydroponics', 'atmospheric scrubbers', 'water reclamation'],
    profile: 'Highly sensitive, deeply attuned to ambient crew mood. Stress causes focus slips that directly threaten the food/air supply.',
    dynamic: { romance: true, switch: true } }),
  comms: Object.assign(pending(), { id: 'comms', role: 'Communications & Sensor Officer', domain: ['deep-space telemetry', 'sensor array alignment', 'data logging'],
    profile: 'Obsessively focused on reinitiating contact with Earth. Tragically consumed by chasing dead signals.',
    dynamic: { romance: false, aromantic: true, asexual: true, basis: 'professional respect, operational trust, and mutual survival' } }),
  medic: Object.assign(pending(), { id: 'medic', role: 'Systems Medic / Safety Warden', domain: ['medical care', 'EVA safety enforcement', 'psychological baseline checks'],
    profile: 'Classically trained in modern corporate counseling. Begins as an ideological skeptic of archaic discipline, creating strong early-game friction before recognizing its survival necessity.',
    dynamic: { romance: true, switch: true, arc: 'hard-won trust' } }),
};
const IDS = Object.keys(ROSTER);
const CAPTAIN = Object.assign(pending(), { id: 'captain', role: 'Captain (Player)' });
const PROCTOR = { id: 'proctor', role: 'Ship’s AI ("The Proctor")', onlyDisciplinesPlayer: true };

const api = { METERS, ROSTER, IDS, CAPTAIN, PROCTOR };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.Crew = api;
})(typeof window !== 'undefined' ? window : globalThis);
