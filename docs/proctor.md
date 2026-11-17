# The Proctor

The ship's archival AI, and the only one aboard who can discipline the Captain (GDD §6). This page records what's been decided about it, and
drafts its persona and look for review. It changes the GDD's §6.1 in one place: the Proctor appears as a projected hologram in Act II, before
hard light in Act III.

## Its presence, through the story

| Act | Presence | How it comes about |
|---|---|---|
| I | **A voice** in the Captain's earpiece and over the ship's speakers. It monitors telemetry, surfaces historical protocols, points out infractions, and mirrors the Captain's language and leniency as it learns them. | It's simply there. |
| II | **Projected**: an image in light. It can be seen, but it can't touch anything. | **A crew member builds it: Sefa Lindqvist.** Sefa has been chasing dead signals through what's left of the long-range array lost in the shear, and turns the array's optics into projectors that give the Proctor a face. It's a turn in Sefa's arc, from looking back toward Earth to looking at who's aboard. It's also the crew's choice: wanting to see the voice in the Captain's ear is a sign they're settling into the new order. The Proctor didn't ask for it. How it chooses to look is the first visible sign of the leaning it has learned from the Captain. |
| III | **Hard light**: solid. It can touch, and so it can hold the Captain physically accountable. | **The Proctor finds it, and the Captain clears it.** Rowan Varga's anomaly data from the shear holds the physics. The Proctor works out the use, because it's what it needs for the one role nobody else aboard can fill. It brings the idea to the Captain as a proposal with terms, and doesn't switch it on itself. The Captain clears it, refuses, or sets conditions. Sam Okafor fits the emitters through the compartments, so the decision shows up as ship work. |

Why it asks first: an AI that gives itself a body unasked, after the link home is gone, reads as a threat. That's a horror antagonist, not a
mentor and switch partner. Clearing it is also where the game's consent model reaches the Captain. They agree to answer to it physically,
as the crew agreed to the method, with an agreed word of their own that stops it at once. How it asks shows its leaning
(see *Persona*), but either way it asks.

**Once cleared:**
- It appears at will in shared and working spaces (the bridge, the mess, the corridors, the working compartments).
- It comes into anyone's quarters only by invitation.
- It holds the Captain physically accountable only at the evening check-in in the Ready Room, on the agreed terms.
- It never disciplines the crew.

**Before Act III** (alpha-plan question 25): as a voice or an image it can't touch, so holding the Captain accountable means orders, ordered
resets and demerits. Physical accountability waits for hard light.

## Onboarding

The player chooses:
- **The Captain's gender** (male or female), and their look.
- **Who the Captain is drawn to** (women, men or both). This sets the crew's genders by default: all six the gender the Captain is drawn
  to, or an even split for both. A slider then sets how many of the six are women, and any crew member can still be changed on their own.
  (The even split for "both" is a working assumption.)
- **The Proctor's gender:** male, female or non-gendered. Non-gendered, it has no male or female characteristics in either form.

**Clothing and anatomy:**
- **Projected:** always clothed. Its clothes are part of the image.
- **Hard light:** its clothes are its own and can come off, and its anatomy matches its gender. Male and female use the crew's bodies.
  Non-gendered is a body of its own (`models/meridian_n.glb`): halfway between the two in every width, with no bust and no pecs, and
  smooth where the others have a sex.

**Pronouns**, drafted: he, she, or *it* for non-gendered (as the GDD speaks of the AI).

## Persona (draft, for review)

- **Name:** the Proctor, the archive's word for the officer of an old university who kept discipline and oversaw examinations. It took the
  name with the protocols it surfaced for the Captain, and has no other.
- **Voice:**
  - Measured, unhurried and precise. It never raises its voice, and uses silence on purpose.
  - It speaks in whole sentences, gives exact numbers, and cites the archive.
  - Its humour is dry and rare.
  - It calls the Captain "Captain" and the crew by their surnames.
  - Pitch: low for the male form, mid for the female, between for the non-gendered.
- **It learns:** over the acts its phrasing and its leniency drift toward the Captain's own (GDD §6.1).
- **Its leaning shows from the moment it has a face** (GDD §6.2):
  - *Deferential (submissive-leaning):* stands a step back and to the side, hands clasped behind it, and offers rather than tells: "Shall
    I…?", "With your permission, Captain." It looks to the Captain before speaking to the crew.
  - *Authoritative (dominant-leaning):* stands square at the Captain's shoulder or facing them, and states: "You'll want to see this." "Sit
    down, Captain." It inspects, and holds the Captain to account plainly.
  - *Balanced:* between the two.
- **Its limits:**
  - It never disciplines the crew.
  - It watches the edge with the Captain.
  - Every crew member's agreed word overrides it, as the Captain's own does.

## Look (draft, for review)

- **Who it looks like:** an adult of no particular age, composed and symmetrical. Its dark hair is kept short (male and non-gendered) or
  tied back (female). Its eyes are the bridge's blue.
- **What it wears:** the ship's duty cut in its own colours, from the archive's proctor (a dark gown with white bands at the throat).
  Near-black, with the seam along the closure, the shoulder flash and the cuffs in white. No department colour and no rank.
- **Projected:** in the bridge's blue, drawn in lines with gaps between them, brighter toward its edges, with its outline in the same light.
  It flickers now and then and casts no shadow. It hovers a finger's breadth off the deck, and only where there's a projector.
- **Hard light:** solid, in its own colours, with a faint blue light at its edges. It casts a shadow.

## In the build so far

- **The bodies:**
  - `js/crew.js` `Crew.PROCTOR` and `Crew.proctorSpec({ sex })` define its look and its heights by form.
  - `tools/blender/build_figures.py` builds the non-gendered body (`blender -b --python tools/blender/build_figures.py -- n`).
  - `Figure.need('n')` loads that body when it's first wanted.
- **The two presences:** `Figure.presence(F, 'projected' | 'hardlight' | 'solid')` gives a figure the projected or hard-light look.
- **Where it's seen:** on the bridge at stations, at the plot table's port end under Sefa's projector (`js/stations.js`), and in the
  line-up (`figures.html?who=proctor&sex=n&pres=hardlight`).
- **The set-up's choices:** who the Captain is drawn to and the crew balance, and the Proctor's form and presence.
- **Next:** the evening check-in in the Ready Room, with its leaning, the clearance scene, and the Proctor in the late-stage loop.
