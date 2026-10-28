import { Sky } from '../world/sky.js';
import { lerp, clamp, rand } from '../core/math.js';
import { saveData } from '../core/storage.js';
import { PAL } from '../render/palette.js';
import { ellipseSprite } from '../render/pixels.js';
import { umbrellaSprite } from '../render/umbrella.js';
import { drawText } from '../render/font.js';
import { drawHud } from '../ui/hud.js';
import { PF_W, PF_H } from '../config.js';
import { inPlayfield } from './street.js';
import { menuHud } from './backdrop.js';
import { MenuScene } from './menu.js';

const HORIZON = 100;
const SHORE_Y = 152; // where the waves reach, on average
const WALK_Y = 204; // where the umbrellas' handles touch the sand
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

// The end of the story, on the beach at dawn, seen from the side. She stands
// at the water's edge looking out to sea. You walk up beside her, the two of you
// lean in until the umbrellas touch, the rain eases off and the sun comes up
// over the water, and you walk on together. Then the credits. Seeing it
// unlocks Walk Together.
export class FinaleScene {
  constructor(game) {
    this.game = game;
    this.theme = 'ending'; // the music changes for the ending
    this.sky = new Sky({ time: 0.97, cycle: 1e9, dayNight: true, weather: 'drizzle' });
    // Enough of a world for the HUD and the rain sounds.
    this.world = { sky: this.sky, speed: 0, topLocation: { name: 'THE BEACH' }, locAt: () => ({}) };
    // Your umbrella as you picked it; hers always red, in the same style.
    const s = game.data.settings;
    this.you = { color: s.color, style: s.style, x: -24, lean: 0, open: 1, bob: 0 };
    this.her = { color: 'love', style: s.style, x: 128, lean: 0, open: 1, bob: 0 };
    this.drops = [];
    this.rings = [];
    this.prints = []; // their footprints in the sand
    this.stepT = 0;
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
    // Footprints in the sand behind whoever is walking.
    if (moving && (this.stepT -= dt) <= 0) {
      this.stepT = 0.17;
      this.side = -(this.side || 1);
      for (const u of t > 15 ? [you, her] : [you]) this.prints.push({ x: u.x + this.side * 2, t });
    }
    // It plays through; once the credits have rolled, a press goes on.
    const press = input.hit('confirm') || input.hit('action') || input.hit('pause');
    if (press && this.rollDone) this.game.go(new MenuScene(this.game));
  }

  // Rain over the sea and the beach: streaks, rings on the water, and dark
  // specks on the sand. It thins away when the weather turns.
  updateRain(dt) {
    const rate = 70 * this.sky.p.rain;
    this.rainAcc = (this.rainAcc ?? 0) + rate * dt;
    while (this.rainAcc >= 1) {
      this.rainAcc -= 1;
      const far = Math.random() < 0.5;
      this.drops.push({ x: rand(-10, PF_W + 10), y: rand(-20, 0), far, land: far ? rand(HORIZON + 4, SHORE_Y - 10) : rand(SHORE_Y + 8, PF_H - 4) });
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
    ctx.fillRect(0, HORIZON, PF_W, SHORE_Y - HORIZON);
    for (let y = HORIZON + 2; y < SHORE_Y - 8; y += 3) {
      const depth = (y - HORIZON) / (SHORE_Y - HORIZON);
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
    // The beach: waves wash up the sand and draw back, leaving it wet and
    // shining with the sky.
    const reach = SHORE_Y + Math.sin(t * 0.7) * 5;
    const sea = mix('#1c3450', '#3a6a8c', dawn);
    ctx.fillStyle = mix('#8a7656', '#d8b884', dawn);
    ctx.fillRect(0, SHORE_Y - 8, PF_W, PF_H - SHORE_Y + 8);
    ctx.fillStyle = mix('#5e5a58', '#b89070', dawn);
    ctx.fillRect(0, SHORE_Y - 8, PF_W, 22);
    if (dawn > 0) {
      ctx.globalAlpha = dawn * 0.6;
      ctx.fillStyle = '#ffe2a0';
      for (let y = SHORE_Y; y < SHORE_Y + 14; y += 2) ctx.fillRect(132 + Math.round(Math.sin(y + t * 2) * 3), y, 6, 1);
      ctx.globalAlpha = 1;
    }
    for (let x = 0; x < PF_W; x++) {
      const edge = Math.round(reach + Math.sin(x * 0.12 + t * 1.3) * 1.5);
      ctx.fillStyle = sea;
      ctx.fillRect(x, SHORE_Y - 8, 1, edge - SHORE_Y + 8);
      ctx.fillStyle = '#e8f4f6';
      ctx.fillRect(x, edge, 1, 1);
      if ((x + Math.floor(t * 8)) % 7 < 3) ctx.fillRect(x, edge - 2, 1, 1);
    }
    // A few shells and a strand of seaweed.
    ctx.fillStyle = mix('#a89070', '#f4e0d0', dawn);
    for (const [x, y] of [[22, 222], [70, 232], [150, 216], [118, 236]]) ctx.fillRect(x, y, 2, 1);
    ctx.fillStyle = mix('#3a4a30', '#6a8a4a', dawn);
    for (let x = 40; x < 56; x++) ctx.fillRect(x, 226 + Math.round(Math.sin(x * 0.8)), 1, 1);
    // Rain specks on the sand, and footprints, fading.
    const dent = mix('#6a5a44', '#a88a60', dawn);
    ctx.fillStyle = dent;
    for (const r of this.rings) if (!r.far && r.t < 0.4) ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, 1);
    for (const p of this.prints) {
      ctx.globalAlpha = clamp(1 - (t - p.t) / 14, 0, 0.8);
      ctx.fillRect(Math.round(p.x), WALK_Y + 1, 2, 1);
    }
    ctx.globalAlpha = 1;
    // The two of them, with soft shadows on the sand.
    for (const u of [this.her, this.you]) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(ellipseSprite(R - 4, 2, '#3a2a1a', true), Math.round(u.x) - R + 4, WALK_Y - 1);
      ctx.globalAlpha = 1;
      // The same sprite as in the game: your colour and style; hers red in
      // your style. The foot of its handle (r × 0.75 + 1 below the rim, see
      // render/umbrella.js) rests on the sand.
      const s = umbrellaSprite(u.color, R, u.lean, u.open, false, 'j', u.style, 0);
      const foot = s.ay + Math.round(R * 0.75) + 1;
      ctx.drawImage(s.canvas, Math.round(u.x) - s.ax, WALK_Y + u.bob - foot);
    }
    // Rain in front of everything; splashes on the walk.
    ctx.fillStyle = '#9ac4e0';
    for (const d of this.drops) ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, d.far ? 2 : 4);
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
