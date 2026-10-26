import { clamp } from '../core/math.js';
import { overlapRatio } from './collision.js';
import { GROUND_L, GROUND_R } from '../config.js';

const HOME_Y = 186; // where the demo player likes to stand
const LOOKAHEAD = 90; // px above the player it pays attention to

// Plays the game for the attract-mode demo. It stands in for Input: the
// player asks it for an `axis()`, the scene asks whether to burst.
export class Autopilot {
  constructor(scene) {
    this.scene = scene;
    this.tx = 90;
    this.retarget = 0;
    this.burst = false;
  }

  // Every 0.1 s, pick the x with the most room among the walkers coming down,
  // preferring not to wander far; burst when something is about to hit.
  update(dt) {
    const { player: p, npcs, field, d } = this.scene;
    if ((this.retarget -= dt) <= 0) {
      this.retarget = 0.1;
      let best = p.x;
      let bestScore = -Infinity;
      for (let x = GROUND_L + 14; x <= GROUND_R - 14; x += 6) {
        let room = 40;
        for (const n of npcs) {
          if (n.shooed || n.touched) continue;
          const ahead = p.y - n.y;
          if (ahead < -10 || ahead > LOOKAHEAD) continue;
          // Nearer walkers need more room.
          const need = (n.r + p.r) * 0.75 * (1.3 - ahead / LOOKAHEAD);
          room = Math.min(room, Math.abs(n.x - x) - need);
        }
        const score = room - Math.abs(x - p.x) * 0.1;
        if (score > bestScore) [bestScore, best] = [score, x];
      }
      this.tx = best;
    }
    if (field.ready) {
      for (const n of npcs) {
        if (!n.shooed && !n.touched && n.y < p.y + 4 && overlapRatio(p, n, d.hitScale) < 1.6) this.burst = true;
      }
    }
  }

  axis() {
    const p = this.scene.player;
    return { x: clamp((this.tx - p.x) / 8, -1, 1), y: clamp((HOME_Y - p.y) / 24, -1, 1) * 0.6 };
  }

  takeBurst() {
    const b = this.burst;
    this.burst = false;
    return b;
  }
}
