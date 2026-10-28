import { DIFFICULTY } from './difficulty.js';
import { lerp } from '../core/math.js';

// Story mode, "Finding Love": one day and one night following a red umbrella
// through town. Each chapter is a race down one street, at a fixed hour and
// weather, to a finish line before the clock runs out.
//
// Everything that shapes Story's difficulty lives in STORY. Values given as
// "first ... last" are spread evenly across the chapters.
export const STORY = {
  startTime: 90, // seconds on the clock at the start of every chapter
  baseSpeed: 34, // px/s: the street's pace at 1×
  // Per chapter: the pace it starts at and the pace it builds up to, as
  // multiples of baseSpeed.
  levels: [
    { startSpeed: 1, maxSpeed: 2 },
    { startSpeed: 1, maxSpeed: 2 },
    { startSpeed: 1, maxSpeed: 3 },
    { startSpeed: 1, maxSpeed: 3 },
    { startSpeed: 1, maxSpeed: 5 },
    { startSpeed: 1, maxSpeed: 5 },
    { startSpeed: 1, maxSpeed: 7 },
    { startSpeed: 1, maxSpeed: 7 },
  ],
  rampPower: 1.6, // how the pace builds within a chapter (1 = evenly, higher = later)
  // A chapter's length is set so that walking it cleanly takes startTime /
  // slack seconds: the rest of the clock is room for bumps. Faster chapters
  // get more room (bumps come quicker at speed), so their streets are a
  // little shorter.
  slackFirst: 1.25,
  slackLast: 1.4,
  hitCost: 3, // seconds lost per bump
  keepsakeTime: 2, // seconds gained per marker of hers picked up
  trailEvery: 6, // seconds between markers waiting up the street
  dropEvery: 1.2, // ... and between the ones she drops while in view
  sightEvery: [12, 20], // seconds between glimpses of her
  sightFor: [1.5, 3], // seconds she stays in view
  spawnFirst: 1.6, // seconds between walkers in the first chapter
  spawnLast: 0.75, // ... and in the last
  npcSpeedFirst: 0.8, // how fast walkers walk (× normal)
  npcSpeedLast: 1.2,
  obstaclesFirst: 0.2, // obstacle density, 0..1
  obstaclesLast: 0.9,
};

// time: hour of the day (see sky.js); crowd: walker weights. special:
// 'mirage' (false red umbrellas shimmer next to her), 'lightning' (she shows
// only in the flashes), 'reunion' (the last chapter: the ending follows).
const PLAN = [
  { title: 'FIRST GLANCE', place: 'town', hour: 'MORNING', time: 0.13, weather: 'drizzle', crowd: { commuter: 5, wanderer: 2 } },
  { title: 'LOST IN THE CROWD', place: 'market', hour: 'NOON', time: 0.2, weather: 'rainy', crowd: { commuter: 5, wanderer: 3, pair: 3, elder: 1 } },
  { title: 'THROUGH THE FOG', place: 'park', hour: 'AFTERNOON', time: 0.34, weather: 'hazy', crowd: { commuter: 4, wanderer: 3, elder: 2, pair: 1 } },
  { title: 'MIRAGE', place: 'desert', hour: 'SUNSET', time: 0.5, weather: 'drizzle', special: 'mirage', crowd: { commuter: 4, wanderer: 2, hurrier: 2, elder: 1 } },
  { title: 'FALLEN PETALS', place: 'forest', hour: 'DUSK', time: 0.61, weather: 'rainy', crowd: { commuter: 4, wanderer: 3, kid: 2, hurrier: 1 } },
  { title: 'FOOTPRINTS', place: 'snow', hour: 'NIGHT', time: 0.76, weather: 'rainy', crowd: { commuter: 4, wanderer: 2, kid: 2, hurrier: 2, pair: 1 } },
  { title: 'THE STORM', place: 'harbor', hour: 'MIDNIGHT', time: 0.84, weather: 'stormy', special: 'lightning', crowd: { commuter: 5, hurrier: 2, kid: 2, pair: 2, wanderer: 1 } },
  { title: 'REUNION', place: 'beach', hour: 'DAWN', time: 0.02, weather: 'drizzle', special: 'reunion', crowd: { commuter: 3, wanderer: 3, elder: 2, kid: 1 } },
];

// The street's pace at `progress` (0..1) through a chapter: smoothly from its
// start speed to its top speed.
export function speedAt(ch, progress) {
  const k = Math.min(1, Math.max(0, progress)) ** STORY.rampPower;
  return STORY.baseSpeed * lerp(ch.startSpeed, ch.maxSpeed, k);
}

// Seconds to walk one pixel of a chapter, averaged over its speed curve.
function secondsPerPx(ch) {
  let t = 0;
  const steps = 400;
  for (let i = 0; i < steps; i++) t += 1 / steps / speedAt(ch, (i + 0.5) / steps);
  return t;
}

export const CHAPTERS = PLAN.map((p, i) => {
  const k = i / (PLAN.length - 1);
  const S = STORY;
  const ch = {
    ...p,
    ...S.levels[i],
    limit: S.startTime,
    walk: S.startTime / lerp(S.slackFirst, S.slackLast, k), // a clean run
    obstacles: lerp(S.obstaclesFirst, S.obstaclesLast, k),
    d: {
      ...DIFFICULTY.normal,
      name: 'STORY',
      spawnStart: lerp(S.spawnFirst, S.spawnLast, k),
      npcSpeed: lerp(S.npcSpeedFirst, S.npcSpeedLast, k),
      sway: lerp(0.6, 1.3, k),
    },
  };
  // The length follows from the clock and the speed curve.
  ch.dist = Math.round(ch.walk / secondsPerPx(ch) / 100) * 100;
  return ch;
});

// Hearts for the time left at the finish, against the spare time the chapter
// allows: 3 for keeping most of it, 2 for half-ish, 1 for just making it.
export function starsFor(ch, left) {
  const spare = ch.limit - ch.walk;
  return left >= spare * 0.75 ? 3 : left >= spare * 0.35 ? 2 : 1;
}
