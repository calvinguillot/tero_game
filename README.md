# A Rainy Day

A small pixel-art arcade game about an umbrella walking up a rainy street, dodging every other umbrella in the crowd. Each umbrella that gets past you scores a point. Bump into one and you lose a life.

It runs in the browser using plain JavaScript and the Canvas 2D API. All of the art and sound is generated in code, so the game ships with no image or audio files and needs no runtime libraries.

## Features

- **Arcade mode**: three lives, a crowd that speeds up as you score, an extra life every 100 points (four at most), and an arcade-style high-score table for each difficulty where you sign your three initials (it also records each run's CLOSE! count). On Hard, puddles and mud slow you down a little.
- **Force field**: a shockwave that pushes nearby umbrellas away and snaps them shut, and sweeps the water aside. It recharges over time, and near misses (**CLOSE!**) give it a boost.
- **SUN RUSH**: every 20 CLOSE! near misses (15 on Easy, 25 on Hard), the sun breaks through for five seconds, even at night. Everyone shuts their umbrella, you run with your own umbrella closed and glowing, nothing can hurt you, and every umbrella you pass or bump scores.
- **Zen mode**: nothing to win and nothing to lose. There's no score, lives, force field or game over, and bumping someone is just a wobble. The crowd keeps Easy's gentle pace with no hurriers, the day is twice as long, and the weather (storms included) changes half as often. Drops on your umbrella play soft notes in the music's key. When you leave, the game tells you how far you walked and through how many places; it isn't saved anywhere.
- **Photo mode**: in any mode, pause and pick PHOTO (or press C). The street holds still while the rain keeps falling, and Space or a tap saves a PNG of the playfield at 4× size.
- **Attract mode**: leave the title screen alone and the game plays a demo of itself.
- **Walker types**: commuters, wanderers, elders, hurriers, kids and pairs, each with its own readable behavior. Some telegraph their moves with a `!` first.
- **Places**: eight of them, in a loop: Old Town → Rainy Park → Deep Forest → Snowy Village → Harbor → Beach → Desert → Market St. Each has its own walls, ground, props and animals.
  - **Snowy Village:** snow falls instead of rain, the puddles are ice, and the rain sound turns to a soft hush.
  - **Beach:** dunes on one side and the surf on the other.
  - **Desert:** the sand soaks up the rain, so its puddles are small.
  - **Overhead:** bridges, flag bunting, branches, palm fronds and shade sails sometimes cross over the street, and large trees reach over it. They all turn see-through when you walk underneath.

  Each run starts in a random place, at a random time of day and in random weather, and a new place arrives every 25 points (in Zen, every 90 seconds or so of walking).
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
| Photo mode | C while paused (or PHOTO in the pause menu), then Space to save | PHOTO in the pause menu, then tap to save |
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
  scenes/             Splash, menu, run setup, settings, guide, scores, credits, play, zen, shared street drawing
  ui/                 HUD panels, arcade stick and button, menu helpers
  audio/              Web Audio synth: effects, ambience, music
refs/                 Original concept screenshots
```

## How the engine works

### The loop and scenes

`main.js` runs a fixed-timestep loop. Each animation frame adds the elapsed time to an accumulator, which is drained in steps of 1/60 s by calling `scene.update(1/60)`. The scene is then drawn once. Because the simulation step is fixed, speeds stay the same on 60 Hz and 144 Hz screens, and the game won't spiral if the tab stutters (frame time is capped at 0.1 s). The time left in the accumulator also sets the street's **lead** (`speed × leftover`), so the street is drawn where it is at that moment rather than where the last step left it. This keeps scrolling smooth when frames and steps don't line up, such as on high-refresh screens.

A **scene** is any object with `update(dt)` and `draw(ctx, layout)`; the game has one each for splash, menu, run setup, settings, guide, scores, credits and play. PLAY opens the **run setup** screen (mode, umbrella color, style and level, with a live preview; Zen hides the level); START is selected on arrival, and the choices are saved for next time. Retrying from the pause menu or the game-over screen skips it.

**Zen** (`scenes/zen.js`) is a subclass of the arcade scene. It overrides only what differs:
- `tuning()`: a fixed Easy crowd, an 8-minute day, and weather twice as slow (the sky's `pace`).
- `crowdWeights()`: no hurriers.
- `checkNpcs()`: bumps wobble instead of costing a life.
- `fireField()`: does nothing.
- `leave()`: shows the walk summary.

Places change by distance walked rather than by score. The world counts drops that land on the player's canopy, and the scene turns a few of them into notes (`audio.rainNote`).

**Photo mode** lives in the arcade scene, so every mode has it. While it's on, the scene runs only `world.stepWater(dt, 0)`, the rain, drips, ripples and spray with no scrolling. The panels show only the controls. Saving redraws the street into a playfield-sized canvas, scales it up 4× without smoothing and downloads it as a PNG. After 12 idle seconds on the splash screen, the play scene starts in **demo mode**: an `Autopilot` (`game/autopilot.js`) stands in for the input. Ten times a second it picks the spot with the most room among the walkers coming down, and it fires the force field when something is about to hit. The demo plays silently, never touches the high scores, and returns to the title after 30 seconds or on any key. `game.go(scene)` switches scenes behind a curtain of falling rain: columns of background color drop down, the scene swaps while the screen is covered, and the columns lift away.

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

  A fourth parameter, **pitch**, leans the cone forward (flatter, more of the top showing) when you walk up the street and back (taller, narrower) when you walk down. Styles change the rib count, height and pattern (polka dots, stripes, the wagasa band, the clear bubble with its glint, the frilled edge). Colors come from small palettes of outline, dark, base, light and accent. Each combination of color, size, tilt, openness, style and handle is built once and cached.
- **Text-map sprites** (`render/sprites.js`): animals, plants, crates, lamps, drains and manholes are written as rows of characters, where each character maps to a color. Mirroring for left/right facing and a "sway" frame (the top rows shifted by a pixel) are generated from the same rows.
- **Ellipse sprites**: ripple rings, shadows and puddles are pixel-perfect ellipses, cached by size and color.
- **Text** uses a 3×5 bitmap font drawn with `fillRect`, scaled by whole numbers. The title wordmark is its own small chunky-serif glyph set, with a raindrop for the dot on the i.

### The street, tiles and zones

The street scrolls down as you walk up it. Everything that lies on the ground (ripples, puddles, props, animals, walkers) moves down by `speed × dt` each step.

Positions are fractional, but pixels are not. If each object rounded its own `y`, objects spawned at different moments would step to the next pixel on different frames from the pavement, and layers would seem to slide against each other by a pixel. So everything that scrolls is placed through one helper, `world.sy(y)`. It rounds the object's offset from the street and adds the pavement's own pixel row, so everything steps on the same frame. The only things meant to move at other speeds are the far rain layer and the fireflies.

- **Walls** are 12-pixel-wide tiles, one tile set per location: brick, hedge, a treeline, shop awnings (three color variants), a harbor rail with canal water, a snow-capped fence and snowy bushes, sand dunes, and adobe with roof beams and windows. Tiles are built for the left wall and mirrored for the right; a location can name a different right-hand wall (`wallRight`), which is how the beach gets the surf. They're drawn in a column starting at the pavement's pixel row modulo the tile height, so the column scrolls smoothly without ever drawing off-grid. Each tile's variant is chosen from its position in the world rather than on screen, so an awning keeps its color as it scrolls by.
- **Ground patterns** (market paving, harbor planks) are lines drawn at scroll-relative offsets, with staggered seams on the planks.
- **Zones**: the street is a stack of location bands. A new location enters at the top behind a crosswalk and scrolls down. Each band is clipped and drawn with its own ground, pattern and walls, and anything that needs a color (ripples, puddles, shadows) asks `locAt(y)` which location it's in.
- **Props** are spawned by distance traveled, not time, from the location at the top of the screen. Side props (bushes, lamps, crates, mushrooms, logs, trees) hug the walls; floor details (drains, manholes, cobbles, leaves, mud) sit on the ground. **Overhead** pieces (stone or timber bridges, flag bunting, arching branches) cross the street above the umbrellas. Trees, bridges and branches fade smoothly to see-through while you are under them, keep the ground beneath them dry, and cast shadows. Trees drip ripples under their leaves and drains gurgle.
- **Trees** are built procedurally, a few variants of each kind:
  - **Broadleaf:** a trunk leaning toward the street forks into branches and twigs. Each one ends in a lumpy clump of leaves (dark underside, lighter top-left, a highlight), with gaps where the bark and the street show through.
  - **By place:** the park grows green, blossom and autumn trees; the forest grows tiered firs and dark broadleaves.
  - **Boughs:** the overhead branches are long boughs with clumps strung along them.
  - **Leaf mask:** each tree keeps a mask of its leaf pixels, so rain only stops where there are leaves, and shadows are dappled patches under the clumps.

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
- **Snow:** a drop whose landing spot is in a snowy location becomes a flake when it's spawned. Flakes fall slowly, sway and drift further with the wind. When one lands it leaves a white speck that melts away, instead of a ripple. Since this is decided per drop, the snow starts exactly at the crosswalk as the Snowy Village scrolls in. In snow the audio drops the patter for a low hush, and rainy, drizzle and stormy weather show as SNOWY, FLURRIES and BLIZZARD.
- **Dry ground:** a location's `wet` factor shrinks its puddles (the desert drinks the rain).
- **Ripples** are 1–3 concentric pixel ellipses that grow, step down through three shades and fade.
- **Drips** run off the edges of open umbrellas and leave small rings where they land; footsteps in puddles splash.
- **Reflections:** puddles are drawn into an offscreen canvas. The umbrellas are then drawn upside down onto it with the `source-atop` blend mode, which keeps only the pixels that land on a puddle, so every puddle mirrors whoever walks past.
- **The force field** sweeps outward over a third of a second. Each frame, its edge carries every ripple and falling drop inside it out to the edge, adds new wavelets along it, and closes any umbrella it touches. For a moment afterwards a dry bubble remains, where rain bounces off the top.

### Day, night and weather

`world/sky.js` keeps two independent clocks:

- **Time of day** moves through keyframed light colors: sunrise, morning, afternoon, sunset, dusk, night. The current color is blended between keyframes and drawn over the scene with the `multiply` blend mode. Clouds dim it further, and a sunny day adds a little warmth with the `lighter` blend mode.
- **Weather** is a set of numbers: rain amount, wind, fog, clouds, lightning, umbrellas open, puddle size, sunlight. A change blends every number to the new weather, normally over six seconds, so nothing switches abruptly. The normal cycle picks rainy, drizzle, hazy or stormy every 30–45 seconds, never repeating the same state twice in a row and keeping storms away early in a run.
  - **Storms** schedule gusts with a one-second warning (each gust turns about half the open umbrellas inside out), and a lightning strike every 4–8 seconds: a jagged bolt drawn into the street, a double flash, a splash where it lands, and thunder.
  - **Haze** is an ordered-dither (Bayer 4×4) fog layer, densest at the top of the street, drifting sideways.
  - **Sunny** is only used for a SUN RUSH. The play scene pauses the automatic cycle, blends to sunny in 0.6 s, and blends back to the previous weather afterwards. A rush also pulls the light to full day for its duration (the clock keeps running underneath).
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

- Programming and sound by **Calvin Guillot**: <https://calvinguillot.com/>
- Inspired by the art of **Tero Juuti**: <https://terojuuti.com/>
