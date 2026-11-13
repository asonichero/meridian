# Project Meridian (working title)

A deep-space sci-fi psychological action-adventure and management sim, built on the discipline and pain engine from [Little Red’s Lessons](https://github.com/asonichero/redlessons). redlessons' toon style is being translated into realistic figures and environments.

**Status:** setting up. The engine core is ported. The alpha's content waits on design answers.

- `docs/alpha-plan.md`: the GDD parsed into an alpha loop, what's ported from redlessons, and the **open questions**.
- `js/pain.js`, `js/discipline.js`, `js/audio.js`: ported from redlessons (see the plan for what changed).
- `js/crew.js`: the roster as the GDD states it. Everything else about the cast is pending.
- `vendor/`: three.js r128, OrbitControls, and r128's post-processing passes (bloom).

```
npm test
```
