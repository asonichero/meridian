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

  It comes up by itself when a scene ends, and from its button (or **P**) between scenes. Choosing a room shows who's there and what going
  there would be (a step of the routine, or a visit, and how long it takes), and goes there.
- **The clock** moves with what the Captain does, never in real time. A step of the routine takes its own time; any other visit takes 40
  minutes. Arriving up to half an hour early for a step waits for it. With time in hand, the plan offers to pass it until the next step.
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
| 08:00 | Bridge | The morning briefing at the plot table. Last night's watch hands over to the Captain; the reactor, life support and the med bay report in over comms. |
| 09:00–12:30 | Reactor, hydroponics, med bay, suit bay | Rounds, in any order: Okafor, Haddad, Ruel, and the suit bay with the Proctor. |
| 12:30 | Galley & mess | The midday meal: all six. |
| 13:30–18:30 | Ready Room | At the desk: the log, the standing orders for the crossing, mail from home. The rest of the afternoon is the Captain's own. |
| 18:30 | Galley & mess | The evening meal, off duty. |
| 20:00 | Ready Room | The evening report to the Proctor. |
| 21:45 | Bridge | The night watch takes the ship from the Captain. |
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

Each step of the routine is a short scene in that room, and anywhere else is an ordinary visit to whoever's there. In each:

- **Choices.** One or two choices in each scene, each in one of three manners: **warm**, **formal** or **brisk**.
  - The Proctor keeps the Captain's manner (it learns the Captain's language from it: GDD §6.1).
  - A choice can move a crew member's **comfort** with the Captain, and for the romance candidates a little **desire**. These are the same
    values a correction reads (README, *The relationship*).
  - A second visit to someone the same day moves them half as much.
- **Ordinary visits.** At work or off duty, the Captain asks how the work's going (formal), how they are (warm), or is just looking in
  (brisk). With more than one there, the Captain chooses whom to talk to.
- **Empty rooms.** The Proctor says where whoever works there is. The Captain's quarters and the desk offer time to rest or catch up.
- **Who speaks.** Only someone in the room speaks, except over comms at the briefing. Whoever stood last night's watch sleeps half the
  day, and the watch goes round, so the lines are chosen by who's there.

**On screen:**
- **The staging:**
  - at work: at what they work at (Okafor's guard rail, Haddad's potting bench, Ruel's exam table), with the Captain at their left;
  - at meals: round the mess table, a plate and a mug each, the Captain at the fore end of the spine-side bench;
  - on the bridge: at stations (`js/stations.js`);
  - the evening report: in front of the Ready Room desk (`js/checkin.js`).
- **Looking:** everyone looks at whoever's speaking (the one speaking looks at the Captain), and now and then away.
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
- `js/deckplan.js`: the plan.
- `js/visit.js`: a visit's staging.
- `day.html`: the page.
