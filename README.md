# Project Meridian (working title)

A deep-space sci-fi psychological action-adventure and management sim, built on the discipline and pain engine from [Little Red’s Lessons](https://github.com/asonichero/redlessons), with the safe-word model of [Birchwood House](https://github.com/asonichero/fairy-shoe). Plans and open questions are in `docs/alpha-plan.md`.

## Run it

```
npm run serve        # http://localhost:8123/ opens the correction test (session.html); /figures.html is the crew line-up
npm test             # the pain model, the scripted correction, the crew and their lines, the figures' rig
```

## The correction test (`session.html`)

This is the first playable piece. It tests the control scheme, the models and the style. The setting is the Airlock Anteroom and Suit Bay, a private node.

- **Setup:** choose the position (across the Captain's knee on the suit bench, or at the wall gripping the rail with feet apart), and who is corrected, in order. Choose who witnesses, and where each crew member waits between turns (the corner, hands on head, as redlessons does; or standing aside with the witnesses).
  - Each crew member's gender is a toggle. Their baseline body type is translated to male or female.
  - The outfit is uniform or off duty.
  - Basic customisation for the Captain: gender, skin, hair colour and style, and build.
- **Controls:**
  - Runs of smacks start and stop on a toggle (**Space**), not in counted runs.
  - **Pace** (`[` `]`) and **strength** (`-` `=`).
  - **Side**: alternate, left or right (**D**). **Where**: upper, centre, sit spot or thighs (**A**).
  - **Soothe** (**S**): the palm in slow circles, between runs, on both cheeks, either one, the thighs or the small of the back (**F**). It takes the sting down.
  - **Clothes** (**T B U**): each garment is its own mesh with a raised or lowered variant (top raised, trousers lowered to the knees, briefs lowered to mid-thigh).
  - **End turn** (**Enter**), and **cameras** (**C**, or the buttons).
- **Consent:** each crew member has agreed a safe word (it's shown on screen). The player is the disciplinarian, so the trigger is the pain model's *too harsh* threshold. That bar is higher than redlessons' (1.8 against 1.5) and has to be held for 1.2 s, or overshot by a quarter, so corrections don't trend short. When it's crossed, the crew member calls their word and everything stops.
- **Scripted responses** per character: as they're placed, at the first smack, as their distress reaches each band, now and then while it's hard, when soothed, the safe word, and at the end.
- **After:** a conversation with each crew member in turn, seated side by side on the bench. Aftercare is delivered through what's said (reassure, say why it mattered, or ask how they are), followed by an instruction for the rest of the shift (rest detail, log reset, eat together, or back to station).

## The look

The style is redlessons' toon look on a smoother, more anatomical skeleton:
- **Skeleton:** real adult proportions, with the head a little larger for the toon lean (`HEAD_SCALE` in `js/figure.js`; 1 is realistic, redlessons used 1.34). The rig has:
  - a pelvis, two spine joints and clavicles;
  - hands with four two-jointed fingers and a two-jointed thumb, set with a grip (curl, spread, thumb);
  - a bone in each buttock for the flesh's give.
- **Skinning:** dual-quaternion, applied to the body, the clothes, the outlines and the shadows. Elbows, knees, shoulders and hips keep their volume as they bend instead of collapsing or pinching.
- **Surface:** the trunk, limbs and neck are one continuous surface. Each profile is interpolated on a smooth curve between its rows, so silhouettes flow rather than facet. Muscle forms are sculpted into the profiles and softened under clothing: pecs, shoulder blades and the spine's groove; deltoid, biceps, triceps and forearm; quads, the inner quad above the knee, the kneecap, the calves and the ankle bones.
- **Shading:** soft three-band toon shading, ink outlines (an inverted hull) and a faint rim light. Characters cast shadows but don't receive them, which keeps the shading clean, as in redlessons. Garment details (the closure edge, belt and buckle, collar, hem, the shoulder flash and cuff bands, knee panels, seams and buttons) are drawn per pixel from rest-pose coordinates, so they stay crisp at any distance.
- **Faces:** redlessons' head shape and painted face layer (eyes, lids, brows, mouth, blush, tears), redrawn as expressions ease.
- **Lighting:** the room is moody, with cool steel, amber pockets and bloom on the lights.

## Poses and animation

- **Across the knee:** the crew member lies across the Captain's right thigh, back slightly arched, hands braced on the bench, toes on the deck past its end, the head turned to the room. The Captain sits leaning in over the lap, turned toward the seat, the left hand flat on the small of the back.
- **At the wall:** bent well forward from the hips with a long back, gripping the rail over the top (fingers wrapped round it), feet apart. The Captain stands close at their left side, knees bent and leaning over them, the left hand on their back.
- **The strike:** the hand lifts up and out to the Captain's right with the wrist cocked back, the shoulder rising and the torso turning into it. It comes down with the wrist held back until the last moment, snaps flat onto the skin, gives a little coming off, and settles. The elbow lifts high while the hand is raised.
- **Reactions** are springs kicked by each smack:
  - **Across the knee:** the leg kicks on the side struck, the hips press down into the lap, the back arches, the head comes up, and the hands push and grip.
  - **At the wall:** they come up onto their toes, the hips drive toward the bulkhead, and a foot comes off the deck now and then.
  - **Either position:** past the edge of resistance, the legs keep going in a slow alternating kick. The struck cheek gives and springs back.
- **Everyone else** stands planted in contrapposto: witnesses with arms folded, at parade rest or hands clasped; whoever's waiting their turn with hands clasped, head down; those done in the corner, feet together, hands on head.
- **Aftercare:** side by side on the bench, the crew member leaning in, hands in their lap, the Captain's arm round them.
- **Fades:** a short fade covers each change of set-up (a new turn, a change of position, the aftercare), so nobody snaps into place.

## Files

| File | What it is |
|---|---|
| `js/figure.js` | The figures: skeleton (with fingers and cheek bones), dual-quaternion skinned body with smoothed, muscled profiles, toon materials and outlines, per-pixel garment details, painted face and expressions, hair, boots, garments (each with lowered variants), grip, the flesh's spring, marks, IK helpers |
| `js/session.js` | The correction: positions, the Captain's strike (arm IK onto the skin), runs, soothing, reactions, the safe word, turns, witnesses, corner, cameras, aftercare posing |
| `js/lines.js` | Each crew member's scripted responses and the aftercare conversation |
| `js/crew.js` | The roster (GDD roles, plus drafted names, body types, looks, safe words and pain stats) |
| `js/pain.js`, `js/discipline.js`, `js/audio.js` | Ported from redlessons: the pain model (with Meridian's higher, held too-harsh bar and soothing), the tiered script, synthesised sound |
| `js/stage.js` | Renderer: HDR buffer, bloom, grading (filmic curve, split tone, vignette, grain) |
| `js/suitbay.js` | The Airlock Anteroom and Suit Bay |
| `session.html`, `figures.html` | The correction test; the crew line-up |
| `vendor/` | three.js r128, OrbitControls, r128's post-processing passes |
