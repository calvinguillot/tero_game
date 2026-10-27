import { rand, clamp, pick, choice } from '../core/math.js';
import { NPC_COLORS } from '../render/palette.js';
import { NPC_STYLES } from '../render/umbrella.js';
import { GROUND_L, GROUND_R } from '../config.js';
import { stepRipple } from './player.js';

// Passer-by personalities (like the Pac-Man ghosts: each one readable at a glance).
// Ranges are [min, max]; walk is px/s on top of the street scroll.
export const NPC_TYPES = {
  // Walks straight, a little sway.
  commuter: { r: [13, 15], walk: [8, 16], sway: [0, 3], freq: [0.6, 1.2] },
  // Slow, wide weave.
  wanderer: { r: [13, 15], walk: [4, 10], sway: [8, 14], freq: [0.5, 0.8] },
  // Big, slow and wobbly: a moving wall.
  elder: { r: [16, 17], walk: [2, 6], sway: [2, 4], freq: [1.6, 2.2], colors: ['npcSand'], styles: { classic: 2, wagasa: 2 } },
  // Small and fast, changes lane once after leaning into it.
  hurrier: { r: [12, 13], walk: [32, 42], sway: [0, 1], freq: [1, 1], colors: ['npcSlate'], styles: { classic: 1 }, laneChange: true },
  // Tiny, bouncy; hops in place, then darts sideways.
  kid: { r: [10, 11], walk: [10, 16], sway: [2, 4], freq: [2, 3], colors: ['npcYellow'], styles: { classic: 2, polka: 2, frill: 1 }, dart: true },
};

const TELEGRAPH = 0.4;

export class Npc {
  constructor(type, x, y, diff = { sway: 1, npcSpeed: 1 }) {
    const T = NPC_TYPES[type];
    this.type = type;
    this.rides = true; // carried down by the street (drawn through World.sy)
    this.x = x;
    this.baseX = x;
    this.y = y;
    this.r = Math.round(rand(T.r[0], T.r[1]));
    this.color = choice(T.colors || NPC_COLORS);
    this.style = pick(T.styles || NPC_STYLES);
    this.handle = 'stick';
    this.open = 1;
    this.inv = false;
    this.tilt = 0;
    this.lean = 0;
    this.bobY = 0;
    this.walk = rand(T.walk[0], T.walk[1]) * diff.npcSpeed;
    this.swayAmp = rand(T.sway[0], T.sway[1]) * diff.sway;
    this.swayFreq = rand(T.freq[0], T.freq[1]);
    this.phase = rand(0, Math.PI * 2);
    this.knockX = 0;
    this.knockV = 0;
    this.knockVY = 0;
    this.wob = 0;
    this.touched = false;
    this.scored = false;
    this.shooed = false; // hit by the force field: closes up, harmless, worth nothing
    this.flipT = 0;
    this.stepT = rand(0, 0.3);
    this.stepSide = 1;
    this.age = 0;
    // Special moves: a telegraph (lean or hop, with "!") then a sideways slide.
    this.alert = false;
    this.moveT = 0; // telegraph countdown
    this.slideT = 0;
    this.slideV = 0;
    this.laneAt = T.laneChange ? rand(20, 110) : Infinity;
    this.dartT = T.dart ? rand(0.8, 2) : Infinity;
  }

  // Walk in step with another walker (pairs).
  syncWith(o) {
    this.walk = o.walk;
    this.swayAmp = o.swayAmp;
    this.swayFreq = o.swayFreq;
    this.phase = o.phase;
  }

  shoo(nx, ny) {
    this.shooed = true;
    this.alert = false;
    this.slideT = 0;
    this.moveT = 0;
    this.knockV += nx * 230;
    this.knockVY += ny * 140;
    this.wob = 1;
  }

  startMove(dir, speed, duration) {
    this.moveT = TELEGRAPH;
    this.alert = true;
    this.slideV = dir * speed;
    this.slideDur = duration;
  }

  update(dt, world, player) {
    this.age += dt;
    this.y += (world.speed + this.walk) * dt;
    const T = NPC_TYPES[this.type];

    // Umbrellas go up and down with the weather; the force field shuts them for good.
    const wantOpen = this.shooed ? 0.15 : Math.max(0.15, world.sky.p.open);
    this.open += clamp(wantOpen - this.open, -dt * 3, dt * 1.5);
    if (!this.shooed) this.baseX += world.sky.wind * 0.3 * dt;
    // A gust can turn an umbrella inside out for a moment.
    if (this.flipT > 0) this.flipT -= dt;
    this.inv = this.flipT > 0;

    if (!this.shooed && this.y > 0) {
      // Hurrier: once, lean into a lane change.
      if (this.y > this.laneAt) {
        this.laneAt = Infinity;
        this.startMove(this.baseX < (GROUND_L + GROUND_R) / 2 ? 1 : -1, 50, 0.6);
      }
      // Kid: every so often, hop, then dart.
      if ((this.dartT -= dt) <= 0 && this.moveT <= 0 && this.slideT <= 0) {
        this.dartT = rand(1.4, 2.6);
        const dir = this.baseX < GROUND_L + 30 ? 1 : this.baseX > GROUND_R - 30 ? -1 : Math.random() < 0.5 ? 1 : -1;
        this.startMove(dir, 60, 0.45);
      }
    }
    if (this.moveT > 0 && (this.moveT -= dt) <= 0) {
      this.alert = false;
      this.slideT = this.slideDur;
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      this.baseX += this.slideV * dt;
    }

    // Flinch: step aside a little when the player gets close.
    if (player && !player.dead && !this.shooed) {
      const dx = this.x - player.x;
      const dy = this.y - player.y;
      if (Math.abs(dy) < 28 && Math.abs(dx) < 36) this.baseX += (dx >= 0 ? 1 : -1) * 9 * dt;
    }

    this.knockX += this.knockV * dt;
    this.knockV *= Math.exp(-5 * dt);
    this.y += this.knockVY * dt;
    this.knockVY *= Math.exp(-5 * dt);

    const prev = this.x;
    this.x = this.baseX + Math.sin(this.phase + world.t * this.swayFreq) * this.swayAmp + this.knockX;
    const lo = GROUND_L + this.r * 0.8;
    const hi = GROUND_R - this.r * 0.8;
    if (this.x < lo || this.x > hi) {
      const c = clamp(this.x, lo, hi);
      this.baseX += c - this.x;
      this.x = c;
      this.knockV *= -0.4;
    }

    const vx = (this.x - prev) / dt;
    // During a telegraph, lean hard toward where it's about to go.
    const leanTo = this.moveT > 0 && T.laneChange ? Math.sign(this.slideV) * 3 : clamp(vx / 10, -2, 2);
    this.lean += (leanTo - this.lean) * Math.min(1, dt * 8);
    this.wob = Math.max(0, this.wob - dt * 2);
    this.flashT = Math.max(0, (this.flashT || 0) - dt);
    this.tilt = this.lean + world.sky.wind / 30 + Math.sin(this.age * 30) * 3 * this.wob;
    if (this.moveT > 0 && T.dart) this.bobY = Math.floor(this.age * 12) % 2 ? -2 : 0;
    else this.bobY = Math.round(Math.sin(this.age * 5 + this.phase) * 0.6);

    this.stepT -= dt;
    if (this.stepT <= 0 && this.y > 0) {
      this.stepT = this.type === 'hurrier' ? 0.18 : 0.32;
      this.stepSide *= -1;
      stepRipple(world, this.x + this.stepSide * 2, this.y + this.r * 0.75 + 2, 4);
    }
  }
}

// Nudges overlapping walkers apart so they don't merge into each other.
export function separate(npcs, dt) {
  for (let i = 0; i < npcs.length; i++) {
    for (let j = i + 1; j < npcs.length; j++) {
      const a = npcs[i];
      const b = npcs[j];
      const dx = b.x - a.x;
      if (Math.abs(b.y - a.y) < (a.r + b.r) * 0.5 && Math.abs(dx) < (a.r + b.r) * 0.9) {
        const push = (dx >= 0 ? 1 : -1) * 12 * dt;
        a.baseX -= push;
        b.baseX += push;
      }
    }
  }
}
