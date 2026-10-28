import { CHAPTERS } from '../game/chapters.js';
import { LOCATIONS } from '../world/locations.js';
import { PAL, UMBRELLA_COLORS } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { ellipseSprite } from '../render/pixels.js';
import { drawHud } from '../ui/hud.js';
import { navigate, plate, hint } from '../ui/menu.js';
import { inPlayfield } from './street.js';
import { menuHud } from './backdrop.js';
import { SetupScene } from './setup.js';
import { VignetteScene } from './vignette.js';

const ROW_Y = 40;
const ROW_H = 17;
const DOT_X = 26;
const RED = UMBRELLA_COLORS.love;
const LOCKED = '#4f7f98';

// Story chapter select: the day as a path of eight stops. Cleared chapters
// glow red with their hearts (stars); locked ones are just a question mark.
// It opens on the next chapter you haven't finished.
export class StoryMenuScene {
  constructor(game, sel = null) {
    this.game = game;
    this.bd = game.backdrop;
    const s = game.data.story;
    this.sel = sel ?? Math.min(s.unlocked, CHAPTERS.length) - 1;
    this.t = 0;
  }

  update(dt) {
    const { input, data } = this.game;
    this.t += dt;
    this.bd.update(dt);
    const rects = CHAPTERS.map((_, i) => ({ x: 14, y: ROW_Y + i * ROW_H - 5, w: 152, h: ROW_H }));
    const { sel, act } = navigate(this.game, this.sel, rects);
    this.sel = sel;
    if (act) {
      if (sel < data.story.unlocked) return this.game.go(new VignetteScene(this.game, sel));
      this.game.audio.puddle();
    }
    if (input.hit('pause')) this.game.go(new SetupScene(this.game));
  }

  draw(ctx, L) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    drawHud(ctx, L, menuHud(this.game, this.bd), this.game.input);
    const story = this.game.data.story;
    const opt = { shadow: PAL.textShadow };
    inPlayfield(ctx, L, () => {
      this.bd.draw(ctx);
      drawText(ctx, 'FINDING LOVE', 90, 12, PAL.text, { ...opt, scale: 2, align: 'center' });
      plate(ctx, 14, ROW_Y - 9, 152, CHAPTERS.length * ROW_H + 6);
      // The path between the stops.
      ctx.fillStyle = PAL.textDim;
      for (let y = ROW_Y + 3; y < ROW_Y + (CHAPTERS.length - 1) * ROW_H; y += 3) ctx.fillRect(DOT_X, y, 1, 1);
      CHAPTERS.forEach((ch, i) => {
        const y = ROW_Y + i * ROW_H;
        const open = i < story.unlocked;
        const stars = story.stars[i] ?? 0;
        const on = i === this.sel;
        const dot = stars ? RED.base : open ? PAL.text : LOCKED;
        ctx.drawImage(ellipseSprite(3, 3, dot, stars > 0 || on), DOT_X - 3, y - 1);
        if (on && Math.floor(this.t * 3) % 2 === 0) drawText(ctx, '>', 16, y, PAL.text, opt);
        drawText(ctx, open ? ch.title : '? ? ?', 36, y, on ? PAL.text : open ? PAL.textDim : LOCKED, opt);
        if (stars) {
          for (let h = 0; h < 3; h++) drawText(ctx, '*', 140 + h * 7, y, h < stars ? RED.base : PAL.keySide, opt);
        }
      });
      // About the selected chapter.
      const ch = CHAPTERS[this.sel];
      plate(ctx, 14, 178, 152, 26);
      if (this.sel < story.unlocked) {
        hint(ctx, `${LOCATIONS[ch.place].name} - ${ch.hour}`, 182);
        const best = story.best[this.sel];
        hint(ctx, best != null ? `BEST: ${best.toFixed(1)} S TO SPARE` : `${ch.limit} SECONDS TO FIND HER`, 192);
      } else {
        hint(ctx, 'FINISH THE CHAPTER BEFORE', 182);
        hint(ctx, 'TO FIND YOUR WAY HERE.', 192);
      }
      hint(ctx, 'SPACE: PLAY   ESC: BACK', 222);
    });
  }
}
