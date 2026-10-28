import { DIFFICULTY } from './difficulty.js';
import { lerp } from '../core/math.js';

// Story mode, "Finding Love": one day and one night following a red umbrella
// through town. Each chapter is a race down one street, at a fixed hour and
// weather, to a finish line before the clock runs out.
//
// Everything that shapes the difficulty lives in STORY. A chapter's values
// are spread evenly from the first chapter's to the last one's.
export const STORY = {
  baseSpeed: 34, // px/s: every chapter starts at this pace
  finalSpeedMul: 5, // the last chapter builds up to this many times baseSpeed
  rampPower: 1.6, // how the pace builds within a chapter (higher = later)
  firstDist: 2400, // px of street in the first chapter
  lastDist: 8000, // ... and in the last
  slackFirst: 1.3, // time limit = time to walk it at its own pace × this,
  slackLast: 1.2, // ... from roomy in the first chapter to tighter in the last
  hitCost: 3, // seconds lost per bump
  keepsakeTime: 2, // seconds gained per thing of hers picked up
  trailEvery: 6, // seconds between things of hers waiting up the street
  dropEvery: 1.2, // ... and between the ones she drops while in view
  sightEvery: [12, 20], // seconds between glimpses of her
  sightFor: [1.5, 3], // seconds she stays in view
  spawnFirst: 1.6, // seconds between walkers in the first chapter
  spawnLast: 0.75, // ... and in the last
  npcSpeedFirst: 0.8,
  npcSpeedLast: 1.2,
  obstaclesFirst: 0.2, // obstacle density, 0..1
  obstaclesLast: 0.9,
};

// time: hour of the day (see sky.js); keepsake: what she leaves behind;
// crowd: walker weights. special: 'mirage' (false red umbrellas shimmer next
// to her), 'lightning' (she shows only in the flashes), 'reunion' (the crowd
// thins and the rain stops near the end).
const PLAN = [
  { title: 'FIRST GLANCE', place: 'town', hour: 'MORNING', time: 0.13, weather: 'drizzle', keepsake: 'ripples', crowd: { commuter: 5, wanderer: 2 } },
  { title: 'LOST IN THE CROWD', place: 'market', hour: 'NOON', time: 0.2, weather: 'rainy', keepsake: 'ripples', crowd: { commuter: 5, wanderer: 3, pair: 3, elder: 1 } },
  { title: 'THROUGH THE FOG', place: 'park', hour: 'AFTERNOON', time: 0.34, weather: 'hazy', keepsake: 'petals', crowd: { commuter: 4, wanderer: 3, elder: 2, pair: 1 } },
  { title: 'MIRAGE', place: 'desert', hour: 'SUNSET', time: 0.5, weather: 'drizzle', keepsake: 'ripples', special: 'mirage', crowd: { commuter: 4, wanderer: 2, hurrier: 2, elder: 1 } },
  { title: 'FALLEN PETALS', place: 'forest', hour: 'DUSK', time: 0.61, weather: 'rainy', keepsake: 'petals', crowd: { commuter: 4, wanderer: 3, kid: 2, hurrier: 1 } },
  { title: 'FOOTPRINTS', place: 'snow', hour: 'NIGHT', time: 0.76, weather: 'rainy', keepsake: 'prints', crowd: { commuter: 4, wanderer: 2, kid: 2, hurrier: 2, pair: 1 } },
  { title: 'THE STORM', place: 'harbor', hour: 'MIDNIGHT', time: 0.84, weather: 'stormy', keepsake: 'ripples', special: 'lightning', crowd: { commuter: 5, hurrier: 2, kid: 2, pair: 2, wanderer: 1 } },
  { title: 'REUNION', place: 'beach', hour: 'DAWN', time: 0.02, weather: 'drizzle', keepsake: 'prints', special: 'reunion', crowd: { commuter: 3, wanderer: 3, elder: 2, kid: 1 } },
];

// The street's pace at `progress` (0..1) through a chapter.
export function speedAt(ch, progress) {
  return STORY.baseSpeed * (1 + (ch.maxMul - 1) * Math.max(0, progress) ** STORY.rampPower);
}

// Seconds to walk a chapter at its own pace (no bumps, nothing picked up).
function walkTime(ch) {
  let t = 0;
  const steps = 200;
  for (let i = 0; i < steps; i++) t += ch.dist / steps / speedAt(ch, (i + 0.5) / steps);
  return t;
}

export const CHAPTERS = PLAN.map((p, i) => {
  const k = i / (PLAN.length - 1);
  const S = STORY;
  const ch = {
    ...p,
    maxMul: lerp(1, S.finalSpeedMul, k),
    dist: Math.round(lerp(S.firstDist, S.lastDist, k) / 100) * 100,
    obstacles: lerp(S.obstaclesFirst, S.obstaclesLast, k),
    d: {
      ...DIFFICULTY.normal,
      name: 'STORY',
      spawnStart: lerp(S.spawnFirst, S.spawnLast, k),
      npcSpeed: lerp(S.npcSpeedFirst, S.npcSpeedLast, k),
      sway: lerp(0.6, 1.3, k),
    },
  };
  ch.walk = walkTime(ch);
  ch.limit = Math.ceil(ch.walk * lerp(S.slackFirst, S.slackLast, k));
  return ch;
});

// Hearts for the time left at the finish, against the spare time the chapter
// allows: 3 for keeping most of it, 2 for half-ish, 1 for just making it.
export function starsFor(ch, left) {
  const spare = ch.limit - ch.walk;
  return left >= spare * 0.75 ? 3 : left >= spare * 0.35 ? 2 : 1;
}
