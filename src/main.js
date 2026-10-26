import { Display } from './render/display.js';
import { Input } from './core/input.js';
import { loadData } from './core/storage.js';
import { PAL } from './render/palette.js';
import { SplashScene } from './scenes/splash.js';
import { Backdrop } from './scenes/backdrop.js';
import { zoneAt } from './ui/hud.js';
import { AudioEngine } from './audio/audio.js';

const STEP = 1 / 60;
const WIPE = 0.22; // seconds to cover, and again to uncover

const canvas = document.getElementById('game');
const display = new Display(canvas);
const input = new Input(canvas, display);
input.zoneAt = (x, y) => zoneAt(display.layout, x, y);
const data = loadData();
const audio = new AudioEngine(data.settings);
// Browsers only start audio from a user gesture.
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => audio.unlock());
const game = {
  display,
  input,
  audio,
  data,
  scene: null,
  wipe: null,
  backdrop: null,
  setScene(s) {
    this.scene = s;
  },
  // Scene change behind a curtain of falling rain.
  go(s) {
    if (!this.wipe) this.wipe = { t: 0, next: s };
  },
};
game.backdrop = new Backdrop(game);
game.setScene(new SplashScene(game));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.scene.pause?.();
});

function drawWipe(ctx, L, cover) {
  for (let x = 0; x < L.w; x += 4) {
    const lag = ((x * 37) % 11) / 11;
    const h = Math.round(Math.max(0, cover * 1.35 - lag * 0.35) * L.h);
    if (h <= 0) continue;
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(x, 0, 4, h);
    ctx.fillStyle = PAL.rain;
    ctx.fillRect(x + 1, h - 3, 1, 3);
    ctx.fillStyle = PAL.rainTip;
    ctx.fillRect(x + 1, h, 1, 1);
  }
}

// Fixed-step simulation, one render per animation frame.
let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  let steps = 0;
  while (acc >= STEP) {
    const w = game.wipe;
    if (w) {
      w.t += STEP;
      if (!w.swapped && w.t >= WIPE) {
        w.swapped = true;
        game.scene = w.next;
      }
      if (w.t >= WIPE * 2) game.wipe = null;
    } else {
      game.scene.update(STEP);
    }
    acc -= STEP;
    steps++;
  }
  // Only drop unconsumed presses once a step has had a chance to see them.
  if (steps) game.input.endFrame();
  // Rain, wind and music follow whatever street is on screen.
  audio.duck = !!game.scene.paused;
  audio.update(steps * STEP, game.scene.world ?? game.backdrop.world);
  game.scene.draw(display.ctx, display.layout);
  if (game.wipe) {
    const t = game.wipe.t;
    drawWipe(display.ctx, display.layout, t < WIPE ? t / WIPE : 1 - (t - WIPE) / WIPE);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) window.__game = game;
