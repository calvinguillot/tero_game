import { ellipseSprite } from '../render/pixels.js';
import { UMBRELLA_COLORS } from '../render/palette.js';

export const FIELD_RADIUS = 64;
const EXPAND = 0.35;
const HOLD = 0.45; // the dry dome lingers while the rings fade
const READY_FLASH = 0.6;

// The umbrella's burst: a shockwave whose front sweeps outward, then a
// recharge. Scoring tops it up. The scene applies the front to umbrellas and
// water each frame (see `front`).
export class ForceField {
  constructor(recharge) {
    this.recharge = recharge;
    this.charge = 1;
    this.waves = [];
    this.readyT = 0; // counts down after the field becomes ready again
  }

  get ready() {
    return this.charge >= 1;
  }

  fire(x, y) {
    if (!this.ready) return false;
    this.charge = 0;
    this.waves.push({ x, y, t: 0 });
    return true;
  }

  // Current radius of a wave's front, and whether it is still expanding.
  front(w) {
    const e = Math.min(1, w.t / EXPAND);
    return FIELD_RADIUS * (1 - (1 - e) ** 3);
  }

  expanding(w) {
    return w.t < EXPAND;
  }

  // Seconds of recharge granted (e.g. per point scored).
  bonus(seconds) {
    this.gain(seconds / this.recharge);
  }

  gain(amount) {
    if (this.ready) return;
    this.charge = Math.min(1, this.charge + amount);
    if (this.ready) this.readyT = READY_FLASH;
  }

  update(dt, scroll) {
    this.gain(dt / this.recharge);
    this.readyT = Math.max(0, this.readyT - dt);
    for (const w of this.waves) {
      w.t += dt;
      w.y += scroll;
    }
    this.waves = this.waves.filter((w) => w.t < EXPAND + HOLD);
  }

  draw(ctx, player) {
    const pal = UMBRELLA_COLORS[player.color];
    for (const w of this.waves) {
      const rx = Math.max(2, Math.round(this.front(w)));
      const ry = Math.max(1, Math.round(rx * 0.5));
      ctx.globalAlpha = w.t < EXPAND ? 1 : 1 - (w.t - EXPAND) / HOLD;
      if (w.t < 0.08) {
        const f = ellipseSprite(14, 7, '#ffffff', true);
        ctx.drawImage(f, Math.round(w.x) - 14, Math.round(w.y) - 7);
      }
      ring(ctx, w.x, w.y, rx, ry, '#ffffff');
      ring(ctx, w.x, w.y, rx - 1, ry, pal.accent);
      ring(ctx, w.x, w.y, Math.round(rx * 0.85), Math.round(ry * 0.85), pal.light);
      if (rx > 20) ring(ctx, w.x, w.y, Math.round(rx * 0.66), Math.round(ry * 0.66), pal.base);
      ctx.globalAlpha = 1;
    }
    // When ready again, a ring sweeps in from the full radius so the reach is visible.
    if (this.readyT > 0 && !player.dead) {
      const k = this.readyT / READY_FLASH;
      ctx.globalAlpha = 0.7;
      ring(ctx, player.x, player.y - 2, Math.max(2, Math.round(FIELD_RADIUS * k)), Math.max(1, Math.round(FIELD_RADIUS * k * 0.5)), pal.light);
      ctx.globalAlpha = 1;
      if (Math.floor(this.readyT * 12) % 2 === 0) sparkle(ctx, player.x + 9, player.y - 20, pal.accent);
    }
  }
}

function ring(ctx, x, y, rx, ry, color) {
  if (rx < 1) return;
  ctx.drawImage(ellipseSprite(rx, Math.max(1, ry), color, false), Math.round(x) - rx, Math.round(y) - Math.max(1, ry));
}

function sparkle(ctx, x, y, color) {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = color;
  ctx.fillRect(x, y - 2, 1, 5);
  ctx.fillRect(x - 2, y, 5, 1);
}
