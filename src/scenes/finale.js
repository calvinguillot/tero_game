import { Sky } from '../world/sky.js';
import { lerp, clamp, rand } from '../core/math.js';
import { saveData } from '../core/storage.js';
import { PAL, UMBRELLA_COLORS, HANDLE } from '../render/palette.js';
import { PixBuf, ellipseSprite } from '../render/pixels.js';
import { drawText } from '../render/font.js';
import { drawHud } from '../ui/hud.js';
import { PF_W, PF_H } from '../config.js';
import { inPlayfield } from './street.js';
import { menuHud } from './backdrop.js';
import { MenuScene } from './menu.js';

const HORIZON = 100;
const RAIL_Y = 150; // the railing, between the promenade and the sea
const BACK_Y = 166; // the far edge of the promenade
const WALK_Y = 210; // where the umbrellas' handles touch the stones
const FRONT_Y = 222; // the near edge, then the sea wall
const R = 18; // umbrella size
const CREDITS = [
  'A RAINY DAY',
  '',
  'PROGRAMMING AND SOUND',
  'CALVIN GUILLOT',
  '',
  'INSPIRED BY THE ART OF',
  'TERO JUUTI',
  '',
  '',
  'THANK YOU FOR PLAYING',
];
const ROLL_AT = 21; // seconds: the credits start rolling
const ROLL_SPEED = 14; // px/s

function ease(t, t0, t1) {
  const k = clamp((t - t0) / (t1 - t0), 0, 1);
  return k * k * (3 - 2 * k);
}

// Blends two #rrggbb colours.
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// An umbrella seen from the side, as a pixel sprite: a scalloped dome, the
// shaft and the J of the handle. `lean` shifts the canopy over the handle;
// `open` (0..1) folds it down to a closed one. Cached by its parameters.
const sideCache = new Map();
function sideUmbrella(color, r, lean, open) {
  lean = Math.round(lean);
  open = Math.round(open * 4) / 4;
  const key = `${color}|${r}|${lean}|${open}`;
  let s = sideCache.get(key);
  if (s) return s;
  const pal = UMBRELLA_COLORS[color];
  const w = r * 2 + 8;
  const h = Math.round(r * 2.3) + 6;
  const b = new PixBuf(w, h);
  const cx = w / 2 + lean;
  const rw = lerp(r * 0.35, r, open); // canopy half-width
  const rh = lerp(r * 1.0, r * 0.62, open); // canopy height
  const top = 3;
  // Dome: an ellipse's upper half, with a scalloped hem.
  b.fillEllipse(cx, top + rh, rw, rh, 3);
  for (let y = Math.ceil(top + rh); y < h; y++) for (let x = 0; x < w; x++) if (b.get(x, y) === 3) b.set(x, y, 0);
  const hem = Math.round(top + rh);
  const n = Math.max(2, Math.round(rw / 3));
  for (let i = 0; i < n; i++) {
    const x0 = cx - rw + ((i + 0.5) * 2 * rw) / n;
    b.fillEllipse(x0, hem, rw / n, 1.5, 3);
  }
  // Light on top, ribs, and the tip.
  b.fillEllipse(cx - rw * 0.25, top + rh * 0.55, rw * 0.5, rh * 0.32, 4);
  for (let i = 1; i < n; i++) b.line(cx, top + 1, cx - rw + (i * 2 * rw) / n, hem, 2);
  b.outline(1);
  b.set(cx, top - 1, 1);
  b.set(cx, top - 2, 1);
  // Shaft and handle under the middle of the canopy.
  const sx = Math.round(w / 2);
  for (let y = hem + 1; y < h - 3; y++) b.set(sx, y, 5);
  b.set(sx, h - 3, 6);
  b.set(sx + 1, h - 2, 6);
  b.set(sx + 2, h - 3, 6);
  s = { canvas: b.toCanvas([null, pal.outline, pal.dark, pal.base, pal.light, '#c8c8d4', HANDLE.base]), ax: sx, ay: h - 2 };
  sideCache.set(key, s);
  return s;
}

// The end of the story, by the coast at dawn, seen from the side. She stands
// at the railing looking out to sea. You walk up beside her, the two of you
// lean in until the umbrellas touch, the rain eases off and the sun comes up
// over the water, and you walk on together. Then the credits. Seeing it
// unlocks Walk Together.
export class FinaleScene {
  constructor(game) {
    this.game = game;
    this.theme = 'ending'; // the music changes for the ending
    this.sky = new Sky({ time: 0.97, cycle: 1e9, dayNight: true, weather: 'drizzle' });
    // Enough of a world for the HUD and the rain sounds.
    this.world = { sky: this.sky, speed: 0, topLocation: { name: 'THE COAST' }, locAt: () => ({}) };
    const s = game.data.settings;
    this.you = { color: s.color, x: -24, lean: 0, open: 1, bob: 0 };
    this.her = { color: 'love', x: 128, lean: 0, open: 1, bob: 0 };
    this.drops = [];
    this.rings = [];
    this.t = 0;
    this.rainStopped = false;
    const story = game.data.story;
    this.firstTime = !story.done;
    story.done = true;
    saveData(game.data);
  }

  update(dt) {
    const { input } = this.game;
    const t = (this.t += dt);
    const you = this.you;
    const her = this.her;
    // You walk in from the left and stop beside her.
    you.x = lerp(-24, 84, ease(t, 1.2, 6.2));
    const walking = t > 1.2 && t < 6.2;
    // You both lean in until the umbrellas touch.
    you.lean = 3 * ease(t, 7, 8);
    her.lean = -3 * ease(t, 6.6, 7.6);
    her.x = lerp(128, 120, ease(t, 8, 10));
    // Then on together, slowly, toward the sunrise.
    const away = ease(t, 15, 21);
    you.x += away * 110;
    her.x += away * 110;
    const moving = walking || (t > 15 && t < 21);
    you.bob = moving ? (Math.floor(t * 6) % 2 ? -1 : 0) : Math.round(Math.sin(t * 2) * 0.5);
    her.bob = t > 15 && t < 21 ? (Math.floor(t * 6 + 1) % 2 ? -1 : 0) : Math.round(Math.sin(t * 2 + 1) * 0.5);
    // The rain stops and the sky clears.
    if (t > 10 && !this.rainStopped) {
      this.rainStopped = true;
      this.sky.setWeather('sunny', 5);
    }
    this.sky.update(dt);
    this.sky.takeEvents();
    this.updateRain(dt);
    if (t > 2 && (input.hit('confirm') || input.hit('action') || input.hit('pause'))) {
      if (t < ROLL_AT) this.t = ROLL_AT;
      else if (this.rollDone) this.game.go(new MenuScene(this.game));
    }
  }

  // Rain over the sea and the promenade: streaks, rings on the water, and
  // splashes on the stones. It thins away when the weather turns.
  updateRain(dt) {
    const rate = 70 * this.sky.p.rain;
    this.rainAcc = (this.rainAcc ?? 0) + rate * dt;
    while (this.rainAcc >= 1) {
      this.rainAcc -= 1;
      const far = Math.random() < 0.5;
      this.drops.push({ x: rand(-10, PF_W + 10), y: rand(-20, 0), far, land: far ? rand(HORIZON + 4, RAIL_Y - 2) : rand(BACK_Y + 2, FRONT_Y - 2) });
    }
    for (const d of this.drops) {
      d.y += (d.far ? 120 : 190) * dt;
      d.x -= (d.far ? 6 : 10) * dt;
      if (d.y >= d.land) {
        d.done = true;
        this.rings.push({ x: d.x, y: d.land, t: 0, far: d.far });
      }
    }
    this.drops = this.drops.filter((d) => !d.done);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.5);
  }

  get rollDone() {
    return (this.t - ROLL_AT) * ROLL_SPEED > PF_H / 2 + CREDITS.length * 6;
  }

  draw(ctx, L) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    drawHud(ctx, L, menuHud(this.game, this), this.game.input);
    inPlayfield(ctx, L, () => {
      this.drawCoast(ctx);
      this.drawEnd(ctx);
    });
  }

  drawCoast(ctx) {
    const t = this.t;
    const dawn = ease(t, 9, 16); // how far the sunrise has come
    // Sky: night blue going to dawn, warmest at the horizon.
    for (let y = 0; y < HORIZON; y += 4) {
      const k = y / HORIZON;
      ctx.fillStyle = mix(mix('#16223e', '#3a4670', k), mix('#5a6ab0', '#f0a878', k * k), dawn);
      ctx.fillRect(0, y, PF_W, 4);
    }
    // Clouds drifting off as it clears.
    ctx.globalAlpha = 0.55 * (1 - dawn * 0.8);
    ctx.fillStyle = '#2a3452';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 47 + t * (3 + i)) % (PF_W + 60)) - 40;
      ctx.drawImage(ellipseSprite(26 + i * 3, 5, '#2a3452', true), Math.round(x), 18 + i * 14);
    }
    ctx.globalAlpha = 1;
    // The sun, rising out of the sea.
    const sunY = HORIZON + 10 - dawn * 22;
    if (dawn > 0) {
      ctx.drawImage(ellipseSprite(14, 14, '#f8d890', true), 126, Math.round(sunY) - 14);
      ctx.drawImage(ellipseSprite(10, 10, '#fff0c0', true), 130, Math.round(sunY) - 10);
    }
    // A far lighthouse with its light going round.
    ctx.fillStyle = '#1c2438';
    ctx.fillRect(18, HORIZON - 14, 4, 14);
    ctx.fillRect(17, HORIZON - 16, 6, 2);
    if (Math.floor(t * 1.5) % 3 === 0 && dawn < 0.7) {
      ctx.fillStyle = '#ffe9a0';
      ctx.fillRect(19, HORIZON - 15, 2, 1);
    }
    // The sea, with rolling bands of light and a path of sunlight.
    ctx.fillStyle = mix('#1c3450', '#3a6a8c', dawn);
    ctx.fillRect(0, HORIZON, PF_W, RAIL_Y - HORIZON);
    for (let y = HORIZON + 2; y < RAIL_Y; y += 3) {
      const depth = (y - HORIZON) / (RAIL_Y - HORIZON);
      ctx.fillStyle = mix('#2c4a68', '#6aa0c0', dawn);
      for (let x = 0; x < PF_W; x += 9 + Math.round(depth * 8)) {
        const wx = (x + Math.sin(t * 0.8 + y * 0.7) * 6 + t * (4 + depth * 6)) % PF_W;
        ctx.fillRect(Math.round(wx), y, 2 + Math.round(depth * 3), 1);
      }
      if (dawn > 0) {
        ctx.globalAlpha = dawn * (1 - depth * 0.6);
        ctx.fillStyle = '#ffe2a0';
        const spread = 4 + depth * 14;
        const sx = 140 + Math.sin(y * 1.3 + t * 3) * spread;
        ctx.fillRect(Math.round(sx - spread / 2), y, Math.round(spread * 0.5), 1);
        ctx.globalAlpha = 1;
      }
    }
    // Rings where the rain hits the water.
    for (const r of this.rings) {
      if (!r.far) continue;
      const rx = 1 + Math.round(r.t * 6);
      ctx.drawImage(ellipseSprite(rx, 1, '#6a98b8', false), Math.round(r.x) - rx, Math.round(r.y) - 1);
    }
    // The railing behind them, then the promenade's stones and the sea wall.
    ctx.fillStyle = mix('#1a1a26', '#3a3040', dawn);
    ctx.fillRect(0, RAIL_Y, PF_W, 2);
    ctx.fillRect(0, RAIL_Y + 7, PF_W, 1);
    for (let x = 6; x < PF_W; x += 16) ctx.fillRect(x, RAIL_Y, 2, BACK_Y - RAIL_Y);
    ctx.fillStyle = mix('#4a4a5c', '#8a7a80', dawn);
    ctx.fillRect(0, BACK_Y, PF_W, FRONT_Y - BACK_Y);
    ctx.fillStyle = mix('#3e3e50', '#76686e', dawn);
    for (let y = BACK_Y + 4; y < FRONT_Y; y += 7) {
      const off = ((y - BACK_Y) / 7) % 2 ? 0 : 11;
      for (let x = off; x < PF_W; x += 22) ctx.fillRect(x, y, 20, 1);
    }
    ctx.fillStyle = mix('#2a2a38', '#4a3c44', dawn);
    ctx.fillRect(0, FRONT_Y, PF_W, PF_H - FRONT_Y);
    ctx.fillStyle = mix('#5a5a6c', '#a08c8c', dawn);
    ctx.fillRect(0, FRONT_Y, PF_W, 2);
    // Wet stones shine, and the sunrise shows in them.
    ctx.globalAlpha = 0.6;
    ctx.drawImage(ellipseSprite(16, 1, dawn > 0.3 ? '#e0b088' : '#7a8aa8', true), 34, WALK_Y + 6);
    ctx.drawImage(ellipseSprite(11, 1, dawn > 0.3 ? '#e0b088' : '#7a8aa8', true), 146, WALK_Y + 4);
    ctx.globalAlpha = 1;
    // The two of them, with shadows on the stones.
    for (const u of [this.her, this.you]) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(ellipseSprite(R - 4, 2, '#1a1a26', true), Math.round(u.x) - R + 4, WALK_Y - 1);
      ctx.globalAlpha = 1;
      const s = sideUmbrella(u.color, R, u.lean, u.open);
      ctx.drawImage(s.canvas, Math.round(u.x) - s.ax, WALK_Y + u.bob - s.ay);
    }
    // Rain in front of everything; splashes on the walk.
    ctx.fillStyle = '#9ac4e0';
    for (const d of this.drops) ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, d.far ? 2 : 4);
    ctx.fillStyle = '#c6e4f4';
    for (const r of this.rings) if (!r.far && r.t < 0.15) ctx.fillRect(Math.round(r.x) - 1, Math.round(r.y) - 1, 3, 1);
  }

  drawEnd(ctx) {
    const t = this.t;
    const opt = { shadow: PAL.textShadow, align: 'center' };
    if (t > 18 && t < ROLL_AT + 1) {
      ctx.globalAlpha = ease(t, 18, 19) * (1 - ease(t, ROLL_AT, ROLL_AT + 1));
      drawText(ctx, 'THE END', PF_W / 2, 40, PAL.text, { ...opt, scale: 2 });
      ctx.globalAlpha = 1;
    }
    if (t < ROLL_AT) return;
    // The credits roll up over a darkened scene.
    ctx.globalAlpha = Math.min(0.7, (t - ROLL_AT) * 0.7);
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, PF_W, PF_H);
    ctx.globalAlpha = 1;
    const y0 = PF_H - (t - ROLL_AT) * ROLL_SPEED;
    CREDITS.forEach((line, i) => {
      const y = Math.round(Math.max(y0 + i * 12, PF_H / 2 - CREDITS.length * 6 + i * 12));
      const bright = i === 0 || line === 'THANK YOU FOR PLAYING';
      drawText(ctx, line, PF_W / 2, y, bright ? PAL.text : PAL.textDim, opt);
    });
    if (this.rollDone) {
      if (this.firstTime) drawText(ctx, 'UNLOCKED: WALK TOGETHER', PF_W / 2, 196, '#ffa0a4', opt);
      if (this.firstTime) drawText(ctx, 'IN ZEN AND ARCADE', PF_W / 2, 205, '#ffa0a4', opt);
      if (Math.floor(t * 2.5) % 2 === 0) drawText(ctx, 'SPACE OR TAP FOR MENU', PF_W / 2, 220, PAL.text, opt);
    }
  }
}
