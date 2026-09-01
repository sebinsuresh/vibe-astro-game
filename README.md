# ASTRO FLY

A third-person rocket-flying prototype for the browser — a recreation of
[ShawnTheMiller's Astro-Boy flight prototype](https://x.com/ShawnTheMiller/status/2093596563180237081)
built with [three.js](https://threejs.org/) (no build step, no dependencies).

![menu](docs/screenshots/menu.png)

## Screenshots

| Cruise | Boost + banked turn |
| --- | --- |
| ![cruise](docs/screenshots/gameplay-cruise.png) | ![boost](docs/screenshots/gameplay-boost.png) |

## Play

Open `index.html` in any modern browser (or just open this repo on
[GitHub Pages](https://pages.github.com) — it's static, so it works as-is).

### Controls

| Key | Action |
| --- | --- |
| **W / S** | Thrust forward / back |
| **A / D** | **Strafe** left / right (side rockets, no turning) |
| **R / F** | Ascend / descend |
| **SHIFT** | Boost (drains the **BOOST** meter; auto-refills when released) |
| **MOUSE** | Steer · look up/down (click the page to lock) |
| **WHEEL** | Zoom camera in / out |
| **T** | Toggle FWD / BACK orientation markers (dev aid) |
| **ESC** | Release mouse + open the Feel Lab menu |
| **M** | Resume (from the menu) |

Fly through the foggy low-poly city and collect all **25 rings**.

## Feel Lab

The game has a built-in feel laboratory: **ESC** pauses the flight and opens
a menu where **13 control / camera / VFX features** can be toggled one by one
(hot, persisted to `localStorage`, number-key shortcuts). This lets you A/B
the feel of each improvement in flight:

| Key | Feature | What it does |
| --- | --- | --- |
| **1** | Rocket dive pose | The foot rockets do the flying, so the body pitches into the dive — ~60° at full cruise, near-flat (feet up) at full boost, while the flames stay held near-vertical |
| **2** | Turn assist | Velocity eases onto the nose — kills the floaty crosswind drift |
| **3** | Coast brake | Strong extra drag when the throttle is off — snappy settle |
| **4** | Smooth steering | Mouse drives an eased yaw rate (control-surface feel) instead of an instant turn |
| **5** | Camera bank & look-ahead | Camera rolls into turns and aims ahead of you, with the look-ahead growing with speed |
| **6** | Speed FOV warp | Field of view widens with speed |
| **7** | Speed shake | Subtle high-frequency camera vibration at speed |
| **8** | Streamlined arms | Arms sweep back at speed, gentle idle bob at rest |
| **9** | Boost speed streaks | Radial speed lines at high speed / boost |
| **0** | Impact feedback | Camera shake + spark burst scaled by the impact speed |
| **Q** | Ring pickup juice | Pop, spark burst and HUD pulse when you grab a ring |
| **W** | Spark trail | Flame spark particles behind you |
| **E** | GLB model body | Character = the model loaded from `models/manifest.json` (off = the built-in procedural chibi body) |

All features in `js/features.js` are plain booleans checked inline by the
game modules, so toggling is instant and cannot leave stale state behind.

The chase camera keeps its world up-vector pinned to (0,1,0) every frame and
applies its turn-bank as a rotation about the *view axis* (quaternion
post-multiplication) rather than an Euler-angle write — this is what keeps
the horizon level through sustained turns (a `camera.rotation.z` write after
`lookAt` used to rebuild the orientation from stale Euler angles and flip
the whole view upside down on hard spinning turns). The camera's heading lag
is also clamped so it can never trail more than ~90° around you.

## Features

- Chibi Astro-Boy character with signature black hair spikes, spread-wing pose,
  and solid orange rocket flames with a spark trail
- Foggy, high-key pastel city: ~180 procedurally generated towers with lit
  window textures, rooftop clutter, antenna spires, and a central flight corridor
- Flight model: mouse steering, A/D lateral strafe, heading-relative thrust,
  banked turns, vertical control, boost, drag and speed caps
- Velocity-based body pose: leans forward with speed (extra while boosting),
  leans back when flying backwards, subtle nose-up/down on climb/descend,
  and banks into turns — matching the reference's diving feel
- **GLB character model with animations** (loadable from `models/manifest.json`,
  flight-state-driven clips, hot-swappable with the procedural body) plus a
  standalone model/animation viewer (`tools/model_viewer.html`)
- Trailing chase camera that follows your heading (pointer-lock, zoom,
  building collision) — W always flies you "into the screen"; it pulls back
  and the FOV widens slightly with speed for a stronger sense of velocity
- Building + ground collision, ring collection with HUD (speed / altitude / rings)

## Character model (GLB + animations)

The pilot is a **loadable, skinned GLB model** with its own animation clips
(loaded via `THREE.GLTFLoader`), not just the built-in procedural body:

- `models/manifest.json` selects the model (`file`), its facing orientation,
  an optional `scale`, the `fitHeight` (world units the model is normalised
  to, so any model's native units work), the `defaultAnim`, and provenance.
  **To swap the character** (e.g. a real Astro Boy `.glb`), drop the file in
  `models/astro/`, point the manifest at it, and nothing else changes — the
  loader, fit, animation mapping and VFX anchors are all model-agnostic.
- `js/model.js` loads the model into the same `tilt` rig the procedural body
  uses, so **movement, dive-lean, strafe-lean and turn-bank are unchanged** —
  the loaded model simply wears them. Foot-rocket flames + the jet light stay
  anchored to the feet, and side strafe-jets still show.
- Flight state drives the clips: slow → `idle`, cruising → `walk` (legs cycle
  = the rockets churning), boosting → `run`, with short crossfades.
- Toggling the **GLB model body** feature (E) swaps between the loaded model
  and the procedural chibi body on the fly; if the model fails to load the
  game falls back to the procedural body automatically.

### Standalone model viewer

`tools/model_viewer.html` is an **isolated** viewer for checking models and
animations without touching the game: manifest- or URL-driven (`?file=…`),
drag-and-drop a `.glb`/`.gltf` straight onto it, orbit camera, per-clip
play/pause, speed + scale sliders, and a stats readout (meshes/tris/size/
clips). It's also how model changes are verified before they're wired into
the game.

```
python3 -m http.server 8000        # then open /tools/model_viewer.html
```

## Repo layout

```
index.html              # loads the game (HTML/CSS + script tags only)
js/
  config.js             # all tuning constants (colours, physics, camera, ...)
  features.js           # the 12 hot-toggleable feel features (ESC menu)
  scene.js              # renderer, scene, fog, lights, ground
  city.js               # procedural city + window textures
  player.js             # chibi astro-boy, flames, glow, spark trail
  pose.js               # per-frame body pose (rocket-dive lean, bank, climb tilt)
  model.js              # GLB model load (manifest-driven), clip mapping, body swap
  marker.js             # FWD / BACK orientation markers (T to toggle, dev aid)
  physics.js            # flight model + collision
  effects.js            # flame / glow / spark / streak VFX updates
  rings.js              # collectible rings
  input.js              # keyboard + pointer-lock mouse steering, wheel zoom
  camera.js             # trailing chase camera (speed pullback, bank, FOV warp)
  hud.js                # speed / altitude / ring HUD
  menu.js               # ESC menu: pointer-lock lifecycle + feature toggles
  main.js               # game loop + resize
lib/three.min.js        # vendored three.js r149
lib/GLTFLoader.js       # vendored GLTFLoader (classic build, three r147)
models/
  manifest.json         # character model manifest (file / fit / anims / provenance)
  astro/                # the character .glb files
docs/screenshots/       # screenshots used in this README
reference/
  proto.mp4             # the original prototype video (the reference)
  frames/               # frames extracted from proto.mp4 (1 fps)
tools/
  model_viewer.html     # standalone model + animation viewer (isolated)
  cdp_helper.py         # Chrome DevTools Protocol helper (dev/test only)
  _record.py            # scripted-demo screencast recorder (dev/test only)
  _feat_test.py         # CDP feature-verification suite (dev/test only)
.venv/                  # Python venv for the tools (gitignored)
```

The scripts are plain (non-module) classic scripts loaded in dependency
order, so they share a single global scope — this keeps the game trivially
hostable as static files (no bundler, no CORS/module restrictions) while
still being cleanly separated by concern.

## Development / testing notes

The game was verified by driving a headful Chrome over the DevTools Protocol:
`tools/cdp_helper.py` connects to `127.0.0.1:9222`, injects keyboard events,
and captures screenshots; `tools/record_demo.py` records a scripted flight via
CDP screencast. Serve the repo root locally with:

```bash
./serve.sh        # http://0.0.0.0:8000  (reachable on the LAN IP too)
```

A full 60 fps recording of a scripted flight can be produced with
`record_demo.py` on a machine where Chrome composites at display refresh rate
(this authoring environment composites at only a few fps, so the README uses
still screenshots instead of a choppy video).

## Credits

- Inspired by the prototype in the X post above (original by ShawnTheMiller).
- three.js by the [three.js authors](https://github.com/mrdoob/three.js) (MIT).
- Character model: “Astro Boy” by [Daniel Pachon](https://sketchfab.com/3d-models/astro-boy-528785036ccf41248f5cf6afb0a5f20d) is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
