# A Rainy Day

A small pixel-art arcade game about an umbrella walking up a rainy street, dodging every other umbrella in the crowd. Each umbrella that gets past you scores a point. Bump into one and you lose a life.

It runs in the browser using plain JavaScript and the Canvas 2D API. All of the art and sound is generated in code, so the game ships with no image or audio files and needs no runtime libraries.

## Features

- **Arcade mode**: three lives, a crowd that speeds up as you score, an extra life every 100 points (four at most), and an arcade-style high-score table for each difficulty where you sign your three initials.
- **Force field**: a shockwave that pushes nearby umbrellas away and snaps them shut, and sweeps the water aside. It recharges over time, and near misses (**CLOSE!**) give it a boost.
- **SUN RUSH**: every 20 CLOSE! near misses, the sun breaks through for five seconds. Everyone shuts their umbrella, you run and can't be hurt, and every umbrella you pass or bump scores.
- **Attract mode**: leave the title screen alone and the game plays a demo of itself.
- **Walker types**: commuters, wanderers, elders, hurriers, kids and pairs, each with its own readable behavior. Some telegraph their moves with a `!` first.
- **Places**: Old Town, Rainy Park, Market St and Harbor, each with its own walls, ground, props and animals. A new place arrives every 25 points.
- **Day and night**: a four-minute day, with street lamps and fireflies after dark.
- **Weather**: rainy, drizzle, hazy and stormy, changing every 30–45 seconds and each changing how you play (fog hides the crowd; storms bring gusts and lightning).
- **Synthesized sound**: effects; rain built from individual drops (a few for a drizzle, a downpour in a storm), wind and thunder; crickets and birds; and a soft tune that changes key at night. Sound effects, music and rain each have their own on/off switch.
- **Desktop and mobile**: keyboard, gamepad-style on-screen controls on touch screens, and layouts for landscape and portrait.
- **Six umbrella styles and seven colors**: other walkers wear the same styles in muted tones.

## Running it

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:5173>. The page reloads as you edit files.

To make a production build:

```bash
npm run build
```

This writes a static site to `dist/` that you can upload to any static host (GitHub Pages, Netlify, itch.io as an HTML game, and so on). To try the build locally:

```bash
npm run preview
```

Vite is the only dependency, and it's for development only: it serves the ES modules and bundles them for release. The game itself has no runtime libraries.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD or arrow keys | Drag on the stick side (left panel, or bottom-left on phones) |
| Force field | Space or Shift | Tap the round button |
| Pause | Esc or P | The `II` key or the ESC key on screen |
| Menus | Arrows plus Space or Enter | Tap an option |

Sound starts after your first key press or tap, because browsers require a user gesture before playing audio.

## Project layout

```
index.html            Canvas page; loads src/main.js
src/
  main.js             Boot, fixed-step loop, scene changes with the rain-curtain wipe
  config.js           Playfield size (180×240) and wall width
  core/               Input (keys, pointer stick and button), math helpers, localStorage
  render/             Low-res display, palettes, pixel buffer, umbrella and text sprites, logo
  world/              The street: rain, water, zones and walls, props, animals, sky and weather
  game/               Player, walkers, force field, collisions, difficulty
  scenes/             Splash, menu, settings, guide, scores, credits, play, shared street drawing
  ui/                 HUD panels, arcade stick and button, menu helpers
  audio/              Web Audio synth: effects, ambience, music
refs/                 Original concept screenshots
```

## How the engine works

### The loop and scenes

`main.js` runs a fixed-timestep loop. Each animation frame adds the elapsed time to an accumulator, which is drained in steps of 1/60 s by calling `scene.update(1/60)`. The scene is then drawn once. Because the simulation step is fixed, speeds stay the same on 60 Hz and 144 Hz screens, and the game won't spiral if the tab stutters (frame time is capped at 0.1 s).

A **scene** is any object with `update(dt)` and `draw(ctx, layout)`; the game has one each for splash, menu, settings, guide, scores, credits and play. After 12 idle seconds on the splash screen, the play scene starts in **demo mode**: an `Autopilot` (`game/autopilot.js`) stands in for the input. Ten times a second it picks the spot with the most room among the walkers coming down, and it fires the force field when something is about to hit. The demo plays silently, never touches the high scores, and returns to the title after 30 seconds or on any key. `game.go(scene)` switches scenes behind a curtain of falling rain: columns of background color drop down, the scene swaps while the screen is covered, and the columns lift away.

**Input** keeps two sets: `down` (keys held right now) and `hits` (one-shot presses that a scene consumes with `input.hit('confirm')`). Presses are only cleared after a simulation step has run, so a quick tap is never lost between frames. Pointer events go through `zoneAt()`, which says whether a touch landed on the stick, the force field button or the pause key. Dragging on the stick gives an analog direction; any other tap counts as "confirm" and is also kept as a position, so menus can tell which option was tapped.

### Resolution and scaling

Everything is drawn at a tiny fixed resolution and scaled up by a whole number, so every pixel stays a sharp square.

- The **playfield** is always 180×240 pixels.
- On wide screens the canvas is **320×240**: the playfield sits in the middle with 70-pixel HUD panels on both sides, like an arcade cabinet.
- On tall screens it's **180×320**: a HUD strip on top and a control strip at the bottom, so thumbs never cover the action.

`Display` picks the layout from the window's shape, sizes the canvas to the low-res buffer, and sets its CSS size to the largest whole-number multiple that fits, accounting for the screen's pixel density. CSS `image-rendering: pixelated` does the nearest-neighbor scaling, and nothing is ever drawn at fractional positions.

### Sprites without image files

All graphics are generated at startup and cached as small canvases.

- **`PixBuf`** (`render/pixels.js`) is an indexed-color pixel buffer. It fills polygons by testing each pixel's center (no anti-aliasing), draws Bresenham lines, and has an `outline()` pass that wraps the shape in a 1-pixel border. It then turns the indices into real colors on a canvas. This is how the crisp, hand-drawn look is achieved in code.
- **Umbrellas** (`render/umbrella.js`) are a cone seen from slightly above and in front: a tip point above an elliptical rim, with ribs fanning to the front half of the rim and scalloped fabric between the rib ends. Every animation is just a parameter:
  - moving the tip sideways **tilts** it;
  - shrinking the rim and raising the tip **closes** it;
  - putting the tip below the rim turns it **inside out**.

  Styles change the rib count, height and pattern (polka dots, stripes, the wagasa band, the clear bubble with its glint, the frilled edge). Colors come from small palettes of outline, dark, base, light and accent. Each combination of color, size, tilt, openness, style and handle is built once and cached.
- **Text-map sprites** (`render/sprites.js`): animals, plants, crates, lamps, drains and manholes are written as rows of characters, where each character maps to a color. Mirroring for left/right facing and a "sway" frame (the top rows shifted by a pixel) are generated from the same rows.
- **Ellipse sprites**: ripple rings, shadows and puddles are pixel-perfect ellipses, cached by size and color.
- **Text** uses a 3×5 bitmap font drawn with `fillRect`, scaled by whole numbers. The title wordmark is its own small chunky-serif glyph set, with a raindrop for the dot on the i.

### The street, tiles and zones

The street scrolls down as you walk up it. Everything that lies on the ground (ripples, puddles, props, animals, walkers) moves down by `speed × dt` each step.

- **Walls** are 12-pixel-wide tiles, one tile set per location: brick, hedge, shop awnings (three color variants), and a harbor rail with canal water. Tiles are built for the left wall and mirrored for the right. They're drawn in a column starting at `scrollY % tileHeight`, so the column scrolls smoothly without ever drawing off-grid. Each tile's variant is chosen from its position in the world rather than on screen, so an awning keeps its color as it scrolls by.
- **Ground patterns** (market paving, harbor planks) are lines drawn at scroll-relative offsets, with staggered seams on the planks.
- **Zones**: the street is a stack of location bands. A new location enters at the top behind a crosswalk and scrolls down. Each band is clipped and drawn with its own ground, pattern and walls, and anything that needs a color (ripples, puddles, shadows) asks `locAt(y)` which location it's in.
- **Props** are spawned by distance traveled, not time, from the location at the top of the screen. Side props (plants, lamps, crates, trees) hug the walls; floor details (drains, manholes, cobbles, leaves) sit on the ground. Trees drip ripples under their crowns and drains gurgle.

### Draw order

`scenes/street.js` draws the playfield in layers, back to front:

1. Ground, ground pattern and walls for each zone; puddles with their reflections; floor details; crosswalks.
2. Ripples and ground splashes.
3. Tree shadows, low props, animals on the ground.
4. Shadows of every umbrella, then the umbrellas themselves, sorted by y so nearer ones overlap farther ones.
5. Tall props (lamps, tree crowns), flying birds, spray and drips.
6. Rain, then haze.
7. **Lighting**: the time-of-day color is multiplied over everything, then lamp light, fireflies and the player's glow are added on top, followed by lightning.
8. The overlay: force field rings, `!` warnings, score popups, banners.

The HUD panels are drawn outside the playfield in the same frame.

### Rain and water

- **Raindrops** are spawned with a landing point already chosen. They come in two depths: short, dim, slow far drops and long, bright near drops. Wind slants the streaks.
- **Landing:** a drop that lands on a canopy throws spray off the umbrella. One that lands on the ground may leave a ripple (more often and bigger in a puddle), and near drops throw a tiny three-drop crown.
- **Ripples** are 1–3 concentric pixel ellipses that grow, step down through three shades and fade.
- **Drips** run off the edges of open umbrellas and leave small rings where they land; footsteps in puddles splash.
- **Reflections:** puddles are drawn into an offscreen canvas. The umbrellas are then drawn upside down onto it with the `source-atop` blend mode, which keeps only the pixels that land on a puddle, so every puddle mirrors whoever walks past.
- **The force field** sweeps outward over a third of a second. Each frame, its edge carries every ripple and falling drop inside it out to the edge, adds new wavelets along it, and closes any umbrella it touches. For a moment afterwards a dry bubble remains, where rain bounces off the top.

### Day, night and weather

`world/sky.js` keeps two independent clocks:

- **Time of day** moves through keyframed light colors: sunrise, morning, afternoon, sunset, dusk, night. The current color is blended between keyframes and drawn over the scene with the `multiply` blend mode. Clouds dim it further, and a sunny day adds a little warmth with the `lighter` blend mode.
- **Weather** is a set of numbers: rain amount, wind, fog, clouds, lightning, umbrellas open, puddle size, sunlight. A change blends every number to the new weather, normally over six seconds, so nothing switches abruptly. The normal cycle picks rainy, drizzle, hazy or stormy every 30–45 seconds, never repeating the same state twice in a row and keeping storms away early in a run.
  - **Storms** schedule gusts with a one-second warning, and lightning strikes that flash twice.
  - **Haze** is an ordered-dither (Bayer 4×4) fog layer, densest at the top of the street, drifting sideways.
  - **Sunny** is only used for a SUN RUSH. The play scene pauses the automatic cycle, blends to sunny in 0.6 s, and blends back to the previous weather afterwards.
  - **Gameplay reads the same numbers**: walkers raise or lower umbrellas to match, puddles grow and shrink, and wind pushes everyone.

### Gameplay systems

- **Collisions** use ellipses half as tall as they are wide, because the street is seen at an angle. They're shrunk by a per-difficulty factor so near misses feel fair, and a closed umbrella is a thinner target. A pass that comes within about 1.4× of touching counts as a **CLOSE!**.
- **Difficulty** is a table (`game/difficulty.js`): scroll speed, spawn rate, walker speed and sway, how soon tough walkers unlock, hitbox size, recovery time after a hit, force field recharge and how soon storms can start. Within a run, a curve `1 − e^(−score/60)` ramps everything up quickly and then levels off.
- **Walkers** (`game/npc.js`) each have a personality from a table. Special moves use a telegraph: a lean or a hop and a `!`, then a sideways slide. Walkers flinch away from the player and gently push apart from each other.
- **Animals** cross now and then. They're harmless and react when you or the force field get close.

### Sound

`audio/audio.js` builds a Web Audio graph on the first user gesture: sound effects, ambience and music each feed their own volume control, which go into a master volume and a gentle compressor.

- **Effects** are short oscillator notes with pitch slides and quick volume envelopes, or bursts of filtered noise. That covers everything from the score blip (which rises with each point in a row) to the force field's whoosh and the thunder.
- **Rain** is mostly separate drops rather than a constant hiss. Each frame, a number of drops proportional to the rain amount is scheduled: high ticks on the pavement, soft pats on umbrellas, and the odd bright "plip" into a puddle. A drizzle is a few drops you can count, while a storm is a dense patter. Under steady rain, a soft low wash of brown noise (much gentler than white noise) fades in, plus a deeper roar in storms.
- **Wind** is a wandering band of the same soft noise, swelling with gusts.
- **Day and night**: occasional crickets at night and birds by day.
- **Music** is scheduled slightly ahead of time on the audio clock: a soft bass and a randomly wandering pentatonic melody, in a major key by day and a minor key at night, sparser during storms and bright and double-time during a SUN RUSH.
- **Switches**: SOUND, MUSIC and RAIN each control one of the three channels.

### Saving

Settings, your last initials and high scores (score, initials and date) are saved as one JSON object in `localStorage` under `rainyday.v1`. Every read and write is guarded, so the game still runs if storage is unavailable, and new settings are merged over the defaults when an older save is loaded.

## Tweaking

| What | Where |
|---|---|
| Difficulty numbers | `src/game/difficulty.js` |
| Walker personalities | `NPC_TYPES` in `src/game/npc.js` |
| Locations (colors, props, animals) | `src/world/locations.js` |
| Weather and the day's light | `WEATHER` and `DAY` in `src/world/sky.js` |
| Umbrella colors and styles | `src/render/palette.js` and `STYLES` in `src/render/umbrella.js` |
| Force field radius and timing | `src/game/forcefield.js` |
| Scoring, lives, near misses, SUN RUSH | Constants at the top of `src/scenes/play.js` |

## Credits

- **Calvin Guillot**, programming and sound: <https://calvinguillot.com/>
- **Tero Juuti**, art and inspiration: <https://terojuuti.com/>
