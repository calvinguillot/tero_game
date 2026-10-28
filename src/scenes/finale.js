import { loveUmbrella } from '../game/love.js';
import { World } from '../world/world.js';
import { Sky } from '../world/sky.js';
import { lerp, clamp } from '../core/math.js';
import { saveData } from '../core/storage.js';
import { PAL } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { ellipseSprite } from '../render/pixels.js';
import { drawHud } from '../ui/hud.js';
import { PF_W, PF_H } from '../config.js';
import { inPlayfield, drawStreet } from './street.js';
import { menuHud } from './backdrop.js';
import { MenuScene } from './menu.js';

const RAINBOW = ['#e8505a', '#f2994a', '#f2d04a', '#7acc5e', '#4aa6e8', '#8a6ae8'];
const HEART_AT = [90, 168];
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
const ROLL_AT = 14; // seconds: the credits start rolling
const ROLL_SPEED = 14; // px/s

function ease(t, t0, t1) {
  const k = clamp((t - t0) / (t1 - t0), 0, 1);
  return k * k * (3 - 2 * k);
}

// The end of the story, at dawn on the beach. You walk up to her, the rain
// stops, both umbrellas close, and hers opens again over the two of you. A
// rainbow, ripples settling into a heart, and the credits. Seeing it unlocks
// Walk Together in Zen.
export class FinaleScene {
  constructor(game) {
    this.game = game;
    const s = game.data.settings;
    const sky = new Sky({ time: 0.03, cycle: 1e9, dayNight: true, weather: 'drizzle' });
    this.world = new World({ speed: 0, location: 'beach', lowFx: !s.fx, sky });
    this.her = loveUmbrella(96, 104);
    this.you = { x: 90, y: 250, r: 14, color: s.color, style: s.style, handle: 'j', tilt: 0, open: 1, inv: false, bobY: 0, pitch: 0 };
    this.shared = loveUmbrella(90, 112, 19); // hers, held over you both (drawn in front)
    this.shared.open = 0;
    this.t = 0;
    this.heartN = 0;
    this.rainStopped = false;
    const story = game.data.story;
    this.firstTime = !story.done;
    story.done = true;
    saveData(game.data);
  }

  update(dt) {
    const { input } = this.game;
    const t = (this.t += dt);
    const w = this.world;
    const you = this.you;
    const her = this.her;
    // Walk up to her.
    you.y = lerp(250, 110, ease(t, 0, 3.5));
    you.bobY = t < 3.5 ? (Math.floor(t * 8) % 2 ? -1 : 0) : 0;
    you.x = lerp(90, 82, ease(t, 3, 4));
    her.x = lerp(96, 98, ease(t, 3, 4));
    her.tilt = t < 3.5 ? Math.sin(t * 2) : -2 * ease(t, 3.5, 4);
    you.tilt = 2 * ease(t, 3.5, 4);
    // The rain stops; both close up and step together.
    if (t > 4 && !this.rainStopped) {
      this.rainStopped = true;
      w.sky.setWeather('sunny', 3);
    }
    const close = ease(t, 4.5, 5.5);
    you.open = her.open = lerp(1, 0.3, close);
    you.x = lerp(you.x, 86, ease(t, 5.5, 6.5));
    her.x = lerp(her.x, 94, ease(t, 5.5, 6.5));
    // Hers opens again over the two of them.
    this.shared.open = ease(t, 6.8, 7.8);
    // Ripples settle into a heart.
    if (t > 8.5 && this.heartN < 28 && t > 8.5 + this.heartN * 0.12) {
      const a = (this.heartN / 28) * Math.PI * 2;
      const x = HEART_AT[0] + 16 * Math.sin(a) ** 3 * 1.4;
      const y = HEART_AT[1] - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 0.9;
      w.addRipple(x, y, 4, 1, 6);
      this.heartN++;
    }
    w.umbrellas = [you, her];
    w.update(dt);
    w.sky.takeEvents();
    if (t > 2 && (input.hit('confirm') || input.hit('action') || input.hit('pause'))) {
      if (t < ROLL_AT) this.t = ROLL_AT;
      else if (this.rollDone) this.game.go(new MenuScene(this.game));
    }
  }

  get rollDone() {
    // Once the first line has risen to where the block settles.
    return (this.t - ROLL_AT) * ROLL_SPEED > PF_H / 2 + CREDITS.length * 6;
  }

  draw(ctx, L) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    drawHud(ctx, L, menuHud(this.game, this), this.game.input);
    const sharing = this.shared.open > 0.05;
    const umbrellas = sharing ? [this.you, this.her, this.shared] : [this.you, this.her];
    inPlayfield(ctx, L, () => {
      drawStreet(ctx, this.world, umbrellas, { glow: umbrellas, overlay: () => this.drawEnd(ctx) });
    });
  }

  drawEnd(ctx) {
    const t = this.t;
    // The rainbow.
    const k = ease(t, 8, 10);
    if (k > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, PF_W, 66);
      ctx.clip();
      ctx.globalAlpha = k * 0.75;
      RAINBOW.forEach((c, i) => {
        for (const d of [0, 1]) {
          const rx = 86 - i * 3 - d;
          ctx.drawImage(ellipseSprite(rx, Math.round(rx * 0.62), c, false), 90 - rx, 66 - Math.round(rx * 0.62));
        }
      });
      ctx.restore();
    }
    const opt = { shadow: PAL.textShadow, align: 'center' };
    if (t > 11 && t < ROLL_AT + 1) {
      ctx.globalAlpha = ease(t, 11, 12) * (1 - ease(t, ROLL_AT, ROLL_AT + 1));
      drawText(ctx, 'THE END', PF_W / 2, 30, PAL.text, { ...opt, scale: 2 });
      ctx.globalAlpha = 1;
    }
    if (t < ROLL_AT) return;
    // The credits roll up over a darkened street.
    ctx.globalAlpha = Math.min(0.7, (t - ROLL_AT) * 0.7);
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, PF_W, PF_H);
    ctx.globalAlpha = 1;
    const y0 = PF_H - (t - ROLL_AT) * ROLL_SPEED;
    CREDITS.forEach((line, i) => {
      const y = Math.round(Math.max(y0 + i * 12, PF_H / 2 - CREDITS.length * 6 + i * 12));
      drawText(ctx, line, PF_W / 2, y, i === 0 || line === 'THANK YOU FOR PLAYING' ? PAL.text : PAL.textDim, opt);
    });
    if (this.rollDone) {
      if (this.firstTime) drawText(ctx, 'UNLOCKED IN ZEN: WALK TOGETHER', PF_W / 2, 200, '#ffa0a4', opt);
      if (Math.floor(t * 2.5) % 2 === 0) drawText(ctx, 'SPACE OR TAP FOR MENU', PF_W / 2, 214, PAL.text, opt);
    }
  }
}
