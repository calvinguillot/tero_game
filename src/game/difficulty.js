// Speeds in px/s, spawn intervals and invulnerability in seconds.
// npcSpeed scales how fast passers-by walk; unlock scales the score at which
// tougher walkers start appearing (lower = sooner).
export const DIFFICULTY = {
  easy: { name: 'EASY', speedStart: 30, speedMax: 70, spawnStart: 1.6, spawnMin: 0.7, sway: 0.6, npcSpeed: 0.8, unlock: 1.5, hitScale: 0.6, invuln: 2.0, recharge: 8 },
  normal: { name: 'NORMAL', speedStart: 40, speedMax: 95, spawnStart: 1.3, spawnMin: 0.5, sway: 1, npcSpeed: 1, unlock: 1, hitScale: 0.7, invuln: 1.5, recharge: 12 },
  hard: { name: 'HARD', speedStart: 50, speedMax: 120, spawnStart: 1.0, spawnMin: 0.38, sway: 1.4, npcSpeed: 1.25, unlock: 0.6, hitScale: 0.75, invuln: 1.2, recharge: 16 },
};
export const DIFFICULTY_KEYS = Object.keys(DIFFICULTY);

// 0 at the start, rising quickly and flattening out toward 1.
export const intensity = (score) => 1 - Math.exp(-score / 60);

// Which walker (or pattern) to spawn next, by score.
export function spawnWeights(score, d) {
  const I = intensity(score);
  const after = (n) => score >= n * d.unlock;
  return {
    commuter: 5,
    wanderer: 3,
    elder: 1.5,
    hurrier: after(8) ? 2 * (1 + I) : 0,
    pair: after(15) ? 2 : 0,
    kid: after(30) ? 2.5 : 0,
  };
}
