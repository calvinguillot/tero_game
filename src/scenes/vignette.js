import { CHAPTERS } from '../game/chapters.js';
import { loveUmbrella, drawMarker } from '../game/love.js';
import { World } from '../world/world.js';
import { Sky } from '../world/sky.js';
import { LOCATIONS } from '../world/locations.js';
import { lerp, clamp, rand } from '../core/math.js';
import { PAL } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { drawUmbrella } from '../render/umbrella.js';
import { drawHud } from '../ui/hud.js';
import { PF_W, PF_H } from '../config.js';
import { inPlayfield, drawStreet } from './street.js';
import { menuHud } from './backdrop.js';
import { StoryScene } from './story.js';

const SCENE = 6.5; // seconds of the wordless scene
const CARD = 2.2; // then the chapter's title card
const BARS = 14; // letterbox

// Eases from a to b while t goes from t0 to t1.
function move(t, t0, t1, a, b) {
  const k = clamp((t - t0) / (t1 - t0), 0, 1);
  return lerp(a, b, k * k * (3 - 2 * k));
}

// What happens before each chapter, as a function of time. Each script places
// `her` and `you`, and may leave marks (her keepsakes), show mirages or flash
// the lightning. No words: just where she goes and what she leaves.
const SCRIPTS = [
  // She crosses the street, stops, looks back at you, and goes on.
  (v, t) => {
    v.her.x = t < 3.2 ? move(t, 0, 2, 30, 90) : move(t, 3.2, 5.6, 90, 170);
    v.her.y = 70;
    v.her.tilt = t > 2 && t < 3.2 ? -3 : 0;
    v.you.y = move(t, 0, 2.5, 250, 176);
    v.you.tilt = t > 3.2 ? 2 : 0;
  },
  // She walks away up the street; her ripples mark the way.
  (v, t) => {
    v.her.y = move(t, 0.3, 4.5, 150, -30);
    v.her.x = 90 + Math.sin(t * 1.5) * 10;
    v.trail(t, 'ripples', 0.35);
    v.you.y = move(t, 2.5, 5, 260, 196);
  },
  // Into the fog.
  (v, t) => {
    v.her.y = move(t, 0, 6, 120, 16);
    v.you.y = move(t, 1, 4, 260, 190);
  },
  // Three red umbrellas in the heat; two of them were never there.
  (v, t) => {
    v.her.y = t < 3.5 ? 80 : move(t, 3.5, 6, 80, -30);
    v.mirages[0].x = 46;
    v.mirages[1].x = 134;
    for (const m of v.mirages) {
      m.y = 80;
      m.alpha = t < 1.5 ? 1 : t < 3 ? (Math.floor(t * 12) % 2 ? 0.7 : 0.2) : 0;
    }
    v.you.y = move(t, 0.5, 3, 260, 196);
  },
  // Petals fall around her, then she's off.
  (v, t) => {
    v.her.y = t < 3 ? 100 : move(t, 3, 6, 100, -30);
    if (t < 3 && Math.random() < 0.3) v.petal();
    v.trail(t, 'petals', 0.4, 3);
    v.you.y = move(t, 1.5, 4.5, 260, 200);
  },
  // Footprints in the snow; halfway she looks back over her shoulder.
  (v, t) => {
    v.her.y = t < 2 ? move(t, 0, 2, 160, 110) : t < 3.2 ? 110 : move(t, 3.2, 6, 110, -30);
    v.her.tilt = t > 2 && t < 3.2 ? 3 : 0;
    v.trail(t, 'prints', 0.3);
    v.you.y = move(t, 2.5, 5, 260, 200);
  },
  // The storm: she's only there when the lightning is.
  (v, t) => {
    v.her.y = 44;
    v.her.alpha = Math.min(1, v.world.sky.flash * 3);
    for (const at of [1.2, 3.3, 5.2]) if (v.prevT < at && t >= at) v.flash();
    v.you.y = move(t, 0, 2.5, 260, 200);
  },
  // Dawn on the beach. Far away, someone in red is waiting.
  (v, t) => {
    v.her.y = 40;
    v.her.tilt = Math.sin(t * 1.5) * 1.5;
    v.you.y = move(t, 0.5, 4, 260, 196);
  },
];

// The short, wordless scene before a chapter, then its title card.
export class VignetteScene {
  constructor(game, index) {
    this.game = game;
    this.index = index;
    this.ch = CHAPTERS[index];
    const ch = this.ch;
    const s = game.data.settings;
    const sky = new Sky({ time: ch.time, cycle: 1e9, dayNight: true, weather: ch.weather });
    sky.strikeT = 1e9; // lightning only when the script says so
    this.world = new World({ speed: 0, location: ch.place, lowFx: !s.fx, sky });
    this.world.softFlash = !s.flash;
    this.her = loveUmbrella(90, 70, 14, s.style);
    this.you = { x: 90, y: 260, r: 14, color: s.color, style: s.style, handle: 'j', tilt: 0, open: 1, inv: false, bobY: 0, pitch: 0 };
    this.mirages = ch.special === 'mirage' ? [loveUmbrella(46, 80, 14, s.style), loveUmbrella(134, 80, 14, s.style)] : [];
    this.marks = [];
    this.lastMark = 0;
    this.t = 0;
    this.prevT = 0;
  }

  // Leave a keepsake where she is every `every` seconds (until `until`).
  trail(t, kind, every, until = Infinity) {
    if (t - this.lastMark < every || t > until || this.her.y < 0 || this.her.y > PF_H) return;
    this.lastMark = t;
    this.marks.push({ kind, x: this.her.x + rand(-3, 3), y: this.her.y + 14, t });
  }

  petal() {
    const h = this.her;
    this.world.particles.push({ x: h.x + rand(-14, 14), y: h.y - rand(8, 16), vx: rand(-8, 8), vy: 0, age: 0, life: 1.4, color: Math.random() < 0.5 ? '#ec3c48' : '#ffa0a4', top: true, float: true });
  }

  flash() {
    this.world.sky.flash = 1;
    this.game.audio.thunder(this.world.softFlash);
  }

  next() {
    this.game.go(new StoryScene(this.game, this.index));
  }

  update(dt) {
    const { input } = this.game;
    this.prevT = this.t;
    this.t += dt;
    const [hx, hy, yx, yy] = [this.her.x, this.her.y, this.you.x, this.you.y];
    SCRIPTS[this.index](this, this.t);
    // Footprints on snow and sand behind whoever is walking (hers faintly red).
    if ((this.stepT = (this.stepT ?? 0) - dt) <= 0) {
      this.stepT = 0.22;
      this.side = -(this.side || 1);
      const w = this.world;
      if (Math.hypot(this.her.x - hx, this.her.y - hy) > 0.05) w.leavePrint(this.her.x + this.side * 2, this.her.y + 13, true);
      if (Math.hypot(this.you.x - yx, this.you.y - yy) > 0.05) w.leavePrint(this.you.x + this.side * 2, this.you.y + 13);
    }
    this.her.bobY = Math.round(Math.sin(this.t * 5) * 0.6);
    this.you.bobY = Math.floor(this.t * 8) % 2 ? -1 : 0;
    this.world.umbrellas = [this.you, this.her];
    this.world.update(dt);
    this.world.sky.takeEvents();
    const skip = input.hit('confirm') || input.hit('action') || input.hit('pause');
    if (this.t > SCENE + CARD || (skip && this.t > 0.5)) this.next();
  }

  draw(ctx, L) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    drawHud(ctx, L, menuHud(this.game, this), this.game.input);
    const her = this.her.alpha > 0.5 ? [this.her] : [];
    inPlayfield(ctx, L, () => {
      drawStreet(ctx, this.world, [this.you, ...her], {
        glow: [this.you, ...her],
        ground: () => {
          for (const m of this.marks) drawMarker(ctx, m, this.world, this.t, clamp(1 - (this.t - m.t) / 4, 0, 1));
        },
        overlay: () => {
          for (const m of this.mirages) {
            ctx.globalAlpha = m.alpha;
            drawUmbrella(ctx, m);
          }
          ctx.globalAlpha = 1;
          this.drawFrame(ctx);
        },
      });
    });
  }

  // Letterbox bars, then the chapter's title card.
  drawFrame(ctx) {
    ctx.fillStyle = '#081c28';
    ctx.fillRect(0, 0, PF_W, BARS);
    ctx.fillRect(0, PF_H - BARS, PF_W, BARS);
    if (this.t < SCENE) {
      drawText(ctx, 'SPACE TO SKIP', PF_W / 2, PF_H - 10, PAL.textDim, { align: 'center' });
      return;
    }
    const k = Math.min(1, (this.t - SCENE) / 0.4);
    ctx.globalAlpha = k;
    ctx.fillStyle = PAL.overlay;
    ctx.fillRect(0, 0, PF_W, PF_H);
    const opt = { shadow: PAL.textShadow, align: 'center' };
    const ch = this.ch;
    drawText(ctx, `CHAPTER ${this.index + 1}`, PF_W / 2, 86, PAL.textDim, opt);
    drawText(ctx, ch.title, PF_W / 2, 100, PAL.text, { ...opt, scale: 2 });
    drawText(ctx, `${LOCATIONS[ch.place].name} - ${ch.hour}`, PF_W / 2, 124, PAL.textDim, opt);
    ctx.globalAlpha = 1;
  }
}
