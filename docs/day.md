# The ship's day

An ordinary day aboard, before the shear: the game from its beginning. It's a systems game with playable scenes. The Captain moves between
rooms on the **deck plan**, the Proctor suggests what's next, and each room is a short scene with choices. Nothing goes wrong yet: there are
no infractions. Play it at `day.html` (the start page).

## How it plays

- **The beginning.** The player chooses the Captain (gender and look), who the Captain is drawn to (setting the crew's genders, with the
  slider), and the Proctor's form. Then the day starts in the Captain's quarters at 06:30.
- **The deck plan.** The ship's general arrangement from above (`docs/ship-general-arrangement.html`), in a tablet's frame. Nothing in the
  world explains it: no tablet is carried. It shows:
  - the clock, and whether it's the ship's day or night;
  - who's where now: each crew member as a dot in their department's colour (faded when asleep), and the Captain as a ring;
  - the Captain's routine for the day, each step ticked, missed or next;
  - the Proctor's suggestion of what's next, with its room lit on the plan.

  Before the morning briefing it comes up by itself as each scene ends. From the briefing on, the Captain stays in the room once a scene's
  over, and the plan comes up only from its button (or **P**): it's always the player's choice to move on. Choosing a room on it shows who's
  there and what going there would be (a step of the routine, or arriving, and how long it takes), and goes there.
- **In a room**, once nothing's being said:
  - **Name tags** over each crew member there. Clicking one offers to talk to them (how the work's going, how they are) or to watch what
    they're doing: what the Captain sees, set apart from what's said. (Later in the story, the Captain will weigh what crew say against
    what they're doing.)
  - **Markers** on things to look at or use: the plot table, the viewscreen, the viewport (opened or shut), the repeaters on the bridge;
    the command terminal, the navigation plot, the plaque in the Ready Room; the repeater, the writing desk and the bed in the Captain's
    quarters (the bed turns in, once it's time); the clocks and the galley in the mess; the core and the Engineer's console at the
    reactor; the racks and the garden bench in hydroponics; Ruel's terminal and the vitals monitor in the med bay; the suits and the
    airlock hatch in the suit bay.
  - **What's next**, under the clock, with a button to begin it when it's in this room and it's time.
  - As the clock moves on, whoever's due somewhere else goes, and whoever's due here comes.
- **The clock** moves with what the Captain does, never in real time:
  - a step of the routine takes its own time;
  - arriving somewhere off the routine takes 5 minutes, talking to someone 10, watching them 5, looking at something 2, and using
    something as long as it takes (a tea, 5 minutes; resting, an hour);
  - arriving up to half an hour early for a step waits for it;
  - with time in hand, the plan offers to pass it until the next step.
- **Lines** move on with a click anywhere (not the end of a drag turning the view), or Space or Enter. Dialogue shows each crew member's
  full name.
- **Missing things.** Any step not begun by the end of its window is missed. On an ordinary day nothing follows from that except the
  Proctor noting it in the evening report. Very late (23:30) the Proctor sends the Captain to bed.
- **The day's end.** A summary: each step done or missed, who the Captain saw, what moved with each crew member, and the Captain's manner
  as the Proctor has it. Then the next day (the watch moves on), or this day again.
- **Saved** between visits (`meridian:day:v1`). The Captain, the crew's genders and the relationship values are the correction test's
  own settings, shared with it (`meridian:session:v1`).

## The Captain's routine

| Time | Where | What |
|---|---|---|
| 06:30 | Captain's quarters | Wake. The Proctor's morning summary: the night, the packet from Earth. |
| 07:00 | Galley & mess | Breakfast, everyone but last night's watch (theirs is taken up to the bridge). |
| 08:00 | Bridge | The morning briefing. Last night's watch reports across the plot table, face to face with the Captain, and goes off to sleep once relieved. Then the stations report: the bridge crew from their posts, the reactor, life support and the med bay over comms. The Proctor leaves the rounds to the Captain, on the deck plan when they're ready. |
| 09:00–12:30 | Reactor, hydroponics, med bay, suit bay | Rounds, in any order: Okafor, Haddad, Ruel, and the suit bay with the Proctor. |
| 12:30 | Galley & mess | The midday meal: all six. |
| 13:30–18:30 | Ready Room | At the desk: the log, the standing orders for the crossing, mail from home. The rest of the afternoon is the Captain's own. |
| 18:30 | Galley & mess | The evening meal, off duty. |
| 20:00 | Ready Room | The evening report to the Proctor. |
| 21:45 | Bridge | Tonight's watch reports across the plot table, takes the ship from the Captain, and goes to their station. |
| 22:00 | Captain's quarters | Lights down. |

## The night watch

The bridge crew take it in turn, one night in three: **Ashdown, then Lindqvist, then Varga**, and round again. Someone holds the ship from
22:00 until the morning briefing.

- **Before it:** tonight's watch rests after the midday meal, gets up for the evening meal, rests again, and takes the ship at 21:45.
- **After it:** last night's watch has breakfast taken up to the bridge, hands over at the 08:00 briefing, and sleeps until the midday meal
  (so they miss the morning).
- Between the evening meal and 21:45 the bridge is empty. The Captain has the ship, and the Proctor keeps watch.

## Who's where

| | On duty (08:00–12:30, 13:30–18:30) | Of an evening, off duty |
|---|---|---|
| Ashdown | Helm, on the bridge | The mess sofa, with Okafor |
| Lindqvist | Sensors, on the bridge | Their cabin |
| Varga | Survey, on the bridge | The mess table, with the day's readings |
| Okafor | The reactor | The mess sofa, with Ashdown |
| Haddad | Hydroponics | Hydroponics, among the plants |
| Ruel | The med bay | Their cabin |

Meals are together in the mess. Everyone is asleep in their cabin from 22:00 until 06:30. At work they wear the uniform; at the evening meal
and after, their own clothes.

## The scenes

Each step of the routine is a short scene in that room. Anywhere else, the Captain arrives and chooses whom to talk to or watch, and what
to look at (an empty working room, the Proctor says where its owner is). In each:

- **Lines of inquiry.** Most choices are things the Captain can ask or say, worked through one at a time:
  - after each answer the menu comes back, less what's been asked;
  - an option to end the conversation is always there ("Carry on.", "Leave the rest for tomorrow.");
  - once everything has been asked, the conversation ends by itself;
  - where there are several ways to end it (logging the day one way or another), the player chooses;
  - two answers to the same thing (doing the baseline now, or Thursday) are one choice: taking one takes both away.
- **Single decisions** stay single: how the Captain relieves the watch, whose side they take at dinner, how they hand the ship to the night
  watch.
- **Manner.** Each option is in one of three manners: **warm**, **formal** or **brisk**. The Proctor keeps the Captain's manner (it learns
  the Captain's language from it: GDD §6.1).
- **What it moves.** An option can move a crew member's **comfort** with the Captain, and for the romance candidates a little **desire**.
  These are the same values a correction reads (README, *The relationship*). Asking more moves more; a second visit to someone the same day
  moves them half as much.
- **Ordinary visits.** At work or off duty, the Captain asks how the work's going (formal), how they are (warm), or both, and then lets them
  get on (or is just looking in). With more than one there, the Captain talks to each in turn, or leaves them to it.
- **Who speaks.** Only someone in the room speaks, except over comms at the briefing. Whoever stood last night's watch sleeps half the
  day, and the watch goes round, so the lines are chosen by who's there.

**On screen:**
- **The staging:**
  - at work: at what they work at (Okafor at the reactor's guard rail, Haddad at the potting bench), with the Captain at their left; Ruel
    at their desk in the med bay, the baselines on the terminal;
  - at meals: round the mess table, a plate and a mug each, the Captain at the fore end of the spine-side bench;
  - on the bridge: at stations (`js/stations.js`), whoever's handing over the watch across the plot table from the Captain;
  - the evening report: in front of the Ready Room desk (`js/checkin.js`).
- **Looking:** everyone looks at whoever's speaking (the one speaking looks at the Captain), and now and then away.
- **Watching someone:** the camera comes round beside them, onto their face and what their hands are on. **Looking at something:** the
  camera turns onto it (the viewport, up its well).
- **The bridge** is as it was before the shear: the long-range array linked to Earth, the watch kept by the crew.

## Drafted for review

All the lines are drafts (`js/daylines.js`), as are these choices about the world:
- the packet from Earth each morning, and the growing lag;
- the edge of the Parallax field, eleven days out;
- Haddad's new wheat;
- loop two's warm pump;
- the monthly baselines.

## In the build

- `js/day.js`: the clock, the routine, the watch, and who's where. Logic only, tested in `tests/day.test.js`.
- `js/daylines.js`: the scenes, the visits, the Proctor's suggestions and the evening report.
- `js/talk.js`: a conversation played through, lines of inquiry and all (the correction's aftercare too).
- `js/deckplan.js`: the plan.
- `js/visit.js`: a visit's staging.
- `day.html`: the page.
