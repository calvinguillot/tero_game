import { DIFFICULTY } from './difficulty.js';

// Story mode, "Finding Love": one day and one night following a red umbrella
// through town. Each chapter is a place at a fixed hour and weather, walked
// against the clock.
//
// time: hour of the day (see sky.js); dist: pixels of street to walk; limit:
// seconds; crowd: walker weights; spawn: seconds between walkers.
// keepsake: what she leaves behind (each one picked up is +2 s).
// special: 'glance' (she starts close and looks back), 'mirage' (false red
// umbrellas shimmer next to her), 'lightning' (she shows only in the flashes),
// 'reunion' (the crowd thins, the rain stops and she waits).
const tune = (o) => ({ ...DIFFICULTY.normal, name: 'STORY', ...o });

export const CHAPTERS = [
  {
    title: 'FIRST GLANCE',
    place: 'town',
    hour: 'MORNING',
    time: 0.13,
    weather: 'drizzle',
    dist: 1800,
    limit: 40,
    special: 'glance',
    crowd: { commuter: 5, wanderer: 2 },
    d: tune({ spawnStart: 1.6, npcSpeed: 0.8, sway: 0.6 }),
  },
  {
    title: 'LOST IN THE CROWD',
    place: 'market',
    hour: 'NOON',
    time: 0.2,
    weather: 'rainy',
    dist: 2200,
    limit: 44,
    keepsake: 'ripples',
    crowd: { commuter: 5, wanderer: 3, pair: 3, elder: 1 },
    d: tune({ spawnStart: 1.05 }),
  },
  {
    title: 'THROUGH THE FOG',
    place: 'park',
    hour: 'AFTERNOON',
    time: 0.34,
    weather: 'hazy',
    dist: 2200,
    limit: 46,
    crowd: { commuter: 4, wanderer: 3, elder: 2, pair: 1 },
    d: tune({ spawnStart: 1.2 }),
  },
  {
    title: 'MIRAGE',
    place: 'desert',
    hour: 'SUNSET',
    time: 0.5,
    weather: 'drizzle',
    dist: 2400,
    limit: 46,
    keepsake: 'ripples',
    special: 'mirage',
    crowd: { commuter: 4, wanderer: 2, hurrier: 2, elder: 1 },
    d: tune({ spawnStart: 1.1 }),
  },
  {
    title: 'FALLEN PETALS',
    place: 'forest',
    hour: 'DUSK',
    time: 0.61,
    weather: 'rainy',
    dist: 2400,
    limit: 46,
    keepsake: 'petals',
    crowd: { commuter: 4, wanderer: 3, kid: 2, hurrier: 1 },
    d: tune({ spawnStart: 1.0 }),
  },
  {
    title: 'FOOTPRINTS',
    place: 'snow',
    hour: 'NIGHT',
    time: 0.76,
    weather: 'rainy',
    dist: 2600,
    limit: 48,
    keepsake: 'prints',
    crowd: { commuter: 4, wanderer: 2, kid: 2, hurrier: 2, pair: 1 },
    d: tune({ spawnStart: 0.95 }),
  },
  {
    title: 'THE STORM',
    place: 'harbor',
    hour: 'MIDNIGHT',
    time: 0.84,
    weather: 'stormy',
    dist: 2600,
    limit: 50,
    special: 'lightning',
    crowd: { commuter: 4, hurrier: 3, kid: 2, pair: 2, wanderer: 1 },
    d: tune({ spawnStart: 0.9, npcSpeed: 1.1 }),
  },
  {
    title: 'REUNION',
    place: 'beach',
    hour: 'DAWN',
    time: 0.02,
    weather: 'drizzle',
    dist: 2000,
    limit: 42,
    special: 'reunion',
    crowd: { commuter: 3, wanderer: 3, elder: 2 },
    d: tune({ spawnStart: 1.4, npcSpeed: 0.85, sway: 0.7 }),
  },
];

// Stars for the time left at the end: 3 with a third of the limit to spare,
// 2 with a sixth.
export function starsFor(ch, left) {
  return left >= ch.limit / 3 ? 3 : left >= ch.limit / 6 ? 2 : 1;
}
