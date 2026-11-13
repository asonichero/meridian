# Project Meridian (working title)

A deep-space sci-fi psychological action-adventure and management sim, built on the discipline and pain engine from [Little Red’s Lessons](https://github.com/asonichero/redlessons), with the safe-word model of [Birchwood House](https://github.com/asonichero/fairy-shoe). Plans and open questions are in `docs/alpha-plan.md`.

## Run it

```
npm run serve        # http://localhost:8123/ opens the correction test (session.html); /figures.html is the crew line-up
npm test             # the pain model, the scripted correction, the crew and their lines
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
- **Skeleton and skinning:** real adult proportions, with the head a little larger for the toon lean (`HEAD_SCALE` in `js/figure.js`; 1 is realistic, redlessons used 1.34). The rig has a pelvis, two spine joints, clavicles, fingers and thumbs. The trunk, limbs and neck are one continuous skinned surface, with each joint weight-blended so it bends smoothly.
- **Shading:** soft three-band toon shading, ink outlines (an inverted hull) and a faint rim light. Characters cast shadows but don't receive them, which keeps the shading clean, as in redlessons.
- **Faces:** redlessons' head shape and painted face layer (eyes, lids, brows, mouth, blush, tears), redrawn as expressions ease.
- **Lighting:** the room is moody, with cool steel, amber pockets and bloom on the lights.

## Files

| File | What it is |
|---|---|
| `js/figure.js` | The figures: skeleton, skinned body, toon materials and outlines, painted face and expressions, hair, boots, garments (each with lowered variants), marks, IK helpers |
| `js/session.js` | The correction: positions, the Captain's strike (arm IK onto the skin), runs, soothing, reactions, the safe word, turns, witnesses, corner, cameras, aftercare posing |
| `js/lines.js` | Each crew member's scripted responses and the aftercare conversation |
| `js/crew.js` | The roster (GDD roles, plus drafted names, body types, looks, safe words and pain stats) |
| `js/pain.js`, `js/discipline.js`, `js/audio.js` | Ported from redlessons: the pain model (with Meridian's higher, held too-harsh bar and soothing), the tiered script, synthesised sound |
| `js/stage.js` | Renderer: HDR buffer, bloom, grading (filmic curve, split tone, vignette, grain) |
| `js/suitbay.js` | The Airlock Anteroom and Suit Bay |
| `session.html`, `figures.html` | The correction test; the crew line-up |
| `vendor/` | three.js r128, OrbitControls, r128's post-processing passes |
