# Project Meridian: Alpha Plan

This plan comes from parsing the Game Design Document (GDD) and from what can be ported from **Little Red’s Lessons** (`asonichero/redlessons`). It keeps three things apart:

- **Stated**: what the GDD says.
- **Ported**: engine pieces from redlessons, and their state in this repo.
- **Open**: what the GDD leaves unsaid. These are questions for the designer. Nothing in this list is built until it's answered. Where I have a suggestion, it's marked *suggestion* and nothing has been built from it.

---

## 1. The alpha loop, as the GDD states it

One in-game day, repeated (GDD §3):

1. **Morning phase (diagnostics).** Review ship telemetry, systemic decay, and each crew member's meters: **Stress, Wilfulness, Resentment, Compliance**. The AI gives a briefing.
2. **Shift phase (deck patrol).** Walk the compartments, check telemetry, find hidden maintenance errors, enforce shift protocols.
3. **Discipline loop.**
   - **Minor infraction** (slacking, bad posture, minor cheek): an **in-situ public reset** (calisthenics, posture) where the crewmate stands.
   - **Severe infraction or trap** (defiant, burning out, traumatized): **escort** the crewmate to the nearest private node (Airlock, Maintenance Crawlspace, Hydroponics) for a **structured correction session**.
4. **Restoration and aftercare.** Every session ends with explicit restitution (rest details, assigned log resets, warm reassurances). This clears Resentment and keeps Compliance high.
5. **Night phase (command check-in).** The player reports to the AI in the ready room. If the player's performance has slipped, the AI temporarily takes command to hold the player accountable.

What the GDD says about stakes and progression:

- **Under-correction** (minor infractions ignored) leads to skipped pre-checks, uncalibrated suit seals and ignored thermal warnings, and ends in **catastrophic equipment failure or decompression: game over** (§7.2).
- **Over-correction** (harsh discipline on exhausted crew, or a misdiagnosed trap) spikes Resentment and Stress, and ends in **cognitive freezing, sabotage or human error during a crisis: game over** (§7.2).
- **Public boundary** (§7.1): early in the game, **every correction must happen behind sealed hatches**, because public discipline causes big Resentment spikes. Late in the game, minor infractions move to in-situ public resets on the bridge or in the galley.
- **The AI ("The Proctor")** (§6; decided since: docs/proctor.md): in Act I it's a voice in the earpiece; in Act II a projected hologram (Sefa builds the projectors); in Act III hard light (the Proctor finds it, the Captain clears it). It monitors telemetry, delivers historical protocols, points out subtle infractions, and learns and mirrors the player's language and leniency. In Act III and later it appears as a hard-light hologram. It is the **only one who can discipline the Player**. When it's embodied, it leans **submissive** or **dominant** depending on the player's interaction history.

### What the alpha needs (from the above)

| # | System | Source | Notes |
|---|---|---|---|
| 1 | Day cycle: morning, shift, evening | GDD §3 | Port `calendar.js` and `save.js` from redlessons |
| 2 | Crew meters (4 per crew member) | GDD §3.1 | Ranges, starting values and rules are **open** |
| 3 | Ship systems with decay | GDD §3.1, §7.2 | Which systems, and the decay rules, are **open** |
| 4 | Morning briefing screen and Proctor voice | GDD §3.1, §6.1 | Port `talk.js` (conversation box, typed lines, babble) |
| 5 | Walkable ship: 6 compartments (§4 table) | GDD §4 | Port `motion.js`, `mocap.js`, `hud.js`. New realistic set |
| 6 | Inspection: find hidden maintenance errors | GDD §3.2 | Mechanic is **open** |
| 7 | Infraction triage: minor, severe, trap | GDD §3.3 | Trap diagnosis is **open** |
| 8 | In-situ public reset | GDD §3.3 | Form is **open** (minigame? animation only?) |
| 9 | Escort to private node, then correction session | GDD §3.3 | Port `lap.js`, `correction.js`, `discipline.js`, `pain.js` |
| 10 | Aftercare choices | GDD §3.4 | The three named kinds: rest details, log resets, warm reassurances |
| 11 | Evening check-in and Proctor evaluation | GDD §3.5 | How it scores, and what "holding the player accountable" means while it's voice-only, are **open** |
| 12 | Public boundary progression | GDD §7.1 | Its rate is **open** |
| 13 | Loss conditions (2) | GDD §7.2 | Thresholds are **open** |
| 14 | Realistic skeletons and proportions in a *Young Suns*-like stylised look | Your brief | See open question A |

---

## 2. What's ported from redlessons

| redlessons | Meridian | State |
|---|---|---|
| `vendor/three.min.js` (r128), `OrbitControls.js` | `vendor/` | Copied as is |
| (none) | `vendor/postprocessing.js` | **New.** three r128's EffectComposer, RenderPass, ShaderPass and UnrealBloomPass, for HDR bloom and a grading pass, which a realistic look needs |
| `js/pain.js` | `js/pain.js` | Ported. The model (sting, ache, dread, dwell, tenderness, bands, receptivity, too-harsh) is unchanged. The implements list is cut to the **hand** and the garment cushions are emptied, until Meridian's are decided |
| `js/discipline.js` | `js/discipline.js` | Ported and generalised. The tiers and counts (Token 6, Light 20, Firm 34, Severe 46) are unchanged. The stages' clothing, the corrector's lines and the subject are all supplied by the caller. The safe-word and amber check-in logic is kept, pending question C |
| `js/audio.js` | `js/audio.js` | Ported: the smacks (`thwack`, `swish`, `birch`), cries (`voice`), speech babble (`speak`) and volumes. The village music, ambience and animal sounds are removed. *Provisional, not built from the GDD:* a ship ambience (air, hum, relays), a few cold ambient themes, and hatch, comm and scan sounds. Swap or remove them freely |
| `js/correctors.js` | `js/crew.js` | Holds **only what the GDD states** (roles, domains, profiles, dynamics). Names, ages, pronouns, looks, voices, meters and safe words are `null` |
| `tests/pain.test.js`, `tests/discipline.test.js` | `tests/` | Ported. `npm test` passes 7 of 7 |

### To port once the open questions are answered

- **`js/lap.js`**: the session scene. It has the corrector's arm IK (shoulder and elbow solved each frame so the hand lands flat), the swing phases (lift, hold for dread, strike, contact, back), the reaction springs (kicks, head lift, a wriggle that grows with distress), the distress bands driving expression and voice, marks, cameras, and aftercare poses (held, upright). It's tied to the toon rig's bone names. A new realistic rig can keep those names (`arm/elbow/hand`, `thigh/knee/ankle`, `hips/torso/neck/head`, `seat`) so most of lap.js carries over. It depends on question D (positions).
- **`js/correction.js`**: turns, **watchers**, corner time, safe word by context. The watchers matter for public in-situ resets.
- **`js/motion.js` and `js/mocap.js`**: walking with planted feet, turning, reaching, sitting, and the Mixamo clips retargeted to the rig. Mocap is the best route to realistic movement.
- **`js/talk.js`, `js/hud.js`**: the conversation box and portraits, keyboard and touch controls, the pause menu and settings. Restyle them for a sci-fi UI.
- **`js/save.js`, `js/calendar.js`, `js/quests.js`**: the saved game, the clock and the quest or phase engine.
- **`editor.html` and `rooms.html`**: the character and room editors. These are worth keeping as tools for tuning the realistic figures.
- **Not ported:** `js/toon.js` (the toon rig, cel shading, ink outlines, painted faces) is **replaced** by a new realistic figure. The village, cottage, wood and story content are not ported.

---

## 3. Decisions so far (from the designer)

- **Look:** redlessons' toon style (cel shading, outlines, painted faces) with smoother skeletons, limbs and joints, leaning toward sculpted stylised models (the Mixamo examples). Real body proportions; natural joint movement; a moodier palette than Young Suns.
- **Consent:** each crew member is taken in hand separately, only after the method has been fully explained to them, their safe word agreed, and their full consent given. The player is the disciplinarian, so the stop relies on a "too harsh" trigger with a high bar, so sequences don't trend short. As in fairy-shoe, the crew member calls the word themselves.
- **Positions:** for now, two: seated over the knee, and hands on the wall or gripping supports with feet spread. More can be added as the narrative offers them.
- **Clothes:** a standard uniform (original, inspired by utopian-militaristic uniforms, but not close to Star Trek) and off-duty wear (closer to Firefly). Both separate into trousers and top. Each garment is a separate mesh with lowered or raised variants.
- **Implements:** unlocked through the narrative with the ship's AI as the Captain learns. The test has the hand only.
- **Control:** the player controls when runs begin and end (a toggle, not numbered runs), pace and strength, plus soothing on chosen areas. Some scripted responses per character. A conversation follows each correction, giving aftercare through dialogue and an instruction to the crew member.
- **Witnesses and turns:** corrections can have other crew as witnesses, or several crew members disciplined in turn, as redlessons does.
- **Cast:** the player chooses the Captain's gender and look, who the Captain is drawn to (setting the crew's genders by default, with a slider for the balance), and the Proctor's gender (male, female or non-gendered: docs/proctor.md). Each crew member has a baseline body type, translated to male or female. The rest is drafted (`js/crew.js`) for review.
- **Assets:** allowed. For now everything is still made in code.
- **First milestone:** a playable correction scene to test the control scheme, models and style (`session.html`).

## 4. Open questions

### A. Look

**What Young Suns looks like** (KO_OP's press kit, docs.ko-op.com, and youngsuns.com, read 2026-11-13). It's **stylised, painterly 3D, not photoreal**:
- **Characters:** close to real human proportions (no oversized heads, unlike redlessons). Chunky, simplified forms with hand-painted textures. Faces are expressive but not cartoon. Bulky suits and backpacks, some with helmets.
- **Ship interiors:** cosy and cluttered. Industrial pipes, panels and crates in saturated paint (yellows, oranges, teals), with crew-made decoration (patterned wall panels, bunting, rugs, plants, mismatched furniture) and warm practical lights.
- **Exteriors:** pastel skies and planetscapes (purple, pink, peach) against deep blues.
- **Effects:** soft bloom and glowing emissives, with clean readable silhouettes.
- **UI:** rounded dialogue boxes with a speaker-name tab, much like redlessons' `talk.js` box.

That suits the GDD's §4 description well: "brushed steel, exposed conduit … balanced by warm, personalized pockets … synthetic wood wrapping, ambient amber lighting, replicated drapes."

1. Is the reading above right: **realistic skeletons and proportions** (adult bodies, normal head size, a fuller rig), rendered in Young Suns' **stylised painterly** way (soft PBR or painted shading, no ink outlines)? Or do you want the rendering itself to be more realistic than Young Suns?
2. "Realistic skeletons": a fuller bone rig (spine segments, clavicles, fingers), realistic **animation** (mocap, which redlessons already retargets), or both?
3. Faces: keep redlessons' painted expression system (ten expressions that morph smoothly), restyled for Young Suns-like faces, or move to sculpted 3D faces with blend shapes?
4. Palette: Young Suns is bright and optimistic. Meridian's premise (isolation, relativistic crisis) suggests something moodier. Should the palette stay saturated, or be muted and colder with warm pockets?

### B. Cast
4. Names, ages, genders and pronouns, and appearances for the six crew and the Captain.
5. Is the Captain a fixed character, or is the player character customisable (look, gender)?
6. The Proctor's voice, persona and name: is it just "The Proctor"? *(Drafted in docs/proctor.md, for review.)*

### C. Consent framing
7. redlessons builds consent into the engine: each subject's **safe word** ends a session at once, there's an **amber** check-in, and subjects **ask** to be taken in hand. Does Meridian keep safe words, and what are they? Is there an onboarding step where each crew member agrees to the archaic protocol (the GDD calls early game "Private Onboarding"), or is the Captain's authority enough by itself?

### D. Correction sessions
8. Positions: redlessons has over-the-knee only. The GDD's nodes mention **suit benches**, **hose-down stalls** and **formal bench corrections**. Which positions does the alpha need?
9. Clothing stages per tier (redlessons: skirt down, skirt lifted, drawers down). What do the crew wear, and what changes across a session?
10. Implements, if any (redlessons gives each corrector their own). What's aboard?
11. Do the four tiers (Token, Light, Firm, Severe) carry over? Does the player choose the tier, or does the infraction set it?
12. Does each private node change anything mechanically (GDD: Reactor is "loud, metallic, crisp resets"; Airlock is "acoustic privacy"; Hydroponics is for "emotional debriefs and aftercare"; Quarters are "high-trust intimate sessions")? Are Quarters in the alpha?
13. Is the session played (the player triggers each smack, as on redlessons' `lap.html`) or scripted (redlessons' `Discipline.run`)?

### E. In-situ public reset
14. What is it in play: a calisthenics or posture **minigame**, an animation with a choice, or a short scripted scene? What exercises?
15. Early game the GDD says all corrections must be private. Does that include in-situ calisthenics, or only physical correction?

### F. Meters and rules
16. Ranges and starting values for Stress, Wilfulness, Resentment and Compliance, per crew member.
17. How each action moves them: in-situ reset, private session (by tier), aftercare (by kind), letting it slide, and so on.
18. **Traps**: which crew have them? The GDD names the Engineer's exhaustion trap explicitly. Are there others (the Comms Officer's grief? the Scientist's dissociation)? How does the player diagnose a trap, and what's the right response (rest, talk)?

### G. Ship systems
19. Which systems are tracked? The GDD mentions thermal loops, suit seals, pre-checks, life support (food and air), helm and RCS, sensors, hull integrity and medical. Does each map to one crew member's domain?
20. How do infractions and hidden maintenance errors come about: random each day, driven by meters, or authored?
21. How does inspection work (scan a console, a minigame, read a log)?

### H. Patrol
22. Camera: third-person like redlessons, or first-person?
23. Is the shift clock real time, or does it advance per action? How long is a shift?

### I. Evening check-in
24. What does the Proctor evaluate, and what counts as "performance slipping"? *(For now, the day's report in the set-up: an infraction let slide, a correction too harsh, an aftercare skipped, a protocol of the Captain's own missed. The day's loop will fill it in: docs/proctor.md.)*
25. In Acts I–II the Proctor is voice-only, so what does it "assuming command to hold the player accountable" look like? Is it a reset ordered for the player, a demerit, or a scene? *(Proposed in docs/proctor.md: orders, ordered resets and demerits until hard light; physical accountability from Act III, at the evening check-in.)*
26. How is the AI's alignment (submissive or dominant) tracked in the alpha, given that embodiment is Act III? *(For now it's set in the set-up: authoritative, balanced or deferential. It shows from Act II, in how the Proctor stands and speaks, and at the check-in in what it does: docs/proctor.md. Tracking it from the Captain's history with the Proctor is still open.)*

### J. Scope
27. How long is the alpha: one day, a week, or the end of Act I?
28. All six crew, or a subset?
29. Do romance or switch arcs appear in the alpha at all?
30. Platform: a browser game and installable mobile web app like redlessons (three.js, no build step, everything made in code, no asset files)? Or are asset files (models, textures, audio) now allowed for the realistic look?
