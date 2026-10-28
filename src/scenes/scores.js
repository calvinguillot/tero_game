import { PAL } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { DIFFICULTY, DIFFICULTY_KEYS } from '../game/difficulty.js';
import { drawHud } from '../ui/hud.js';
import { plate, hint } from '../ui/menu.js';
import { inPlayfield } from './street.js';
import { menuHud } from './backdrop.js';
import { MenuScene } from './menu.js';
import { CHAPTERS } from '../game/chapters.js';
import { UMBRELLA_COLORS } from '../render/palette.js';

const SHOWN = 8;
// One page per arcade level, then Story's records.
const PAGES = [...DIFFICULTY_KEYS, 'story'];

// Best arcade runs per level, and Story's records per chapter; left/right
// switches page.
export class ScoresScene {
  constructor(game) {
    this.game = game;
    this.bd = game.backdrop;
    this.level = DIFFICULTY_KEYS.indexOf(game.data.settings.difficulty);
    this.t = 0;
  }

  update(dt) {
    const { input } = this.game;
    this.t += dt;
    this.bd.update(dt);
    const n = PAGES.length;
    if (input.hit('left')) this.level = (this.level + n - 1) % n;
    if (input.hit('right')) this.level = (this.level + 1) % n;
    const tap = input.takeTap();
    if (tap) {
      const x = tap.x - this.game.display.layout.pfX;
      if (x < 60) this.level = (this.level + n - 1) % n;
      else if (x > 120) this.level = (this.level + 1) % n;
      else this.game.go(new MenuScene(this.game, 3));
      input.hit('confirm');
    }
    if (input.hit('pause') || input.hit('confirm')) this.game.go(new MenuScene(this.game, 3));
  }

  draw(ctx, L) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    drawHud(ctx, L, menuHud(this.game, this.bd), this.game.input);
    inPlayfield(ctx, L, () => {
      this.bd.draw(ctx);
      const opt = { shadow: PAL.textShadow, align: 'center' };
      drawText(ctx, 'HIGH SCORES', 90, 14, PAL.text, { ...opt, scale: 2 });
      const key = PAGES[this.level];
      if (key === 'story') return this.drawStory(ctx);
      drawText(ctx, `< ${DIFFICULTY[key].name} >`, 90, 34, PAL.text, opt);
      plate(ctx, 14, 46, 152, SHOWN * 16 + 8);
      const list = this.game.data.highScores.arcade[key] || [];
      if (!list.length) drawText(ctx, 'NO SCORES YET. GO PLAY!', 90, 100, PAL.textDim, opt);
      list.slice(0, SHOWN).forEach((e, i) => {
        const y = 54 + i * 16;
        const top = i === 0;
        const col = top ? PAL.text : PAL.textDim;
        drawText(ctx, `${i + 1}.`, 22, y + 2, col, { shadow: PAL.textShadow });
        drawText(ctx, e.name || '---', 36, y + 2, top ? '#ffffff' : PAL.text, { shadow: PAL.textShadow });
        drawText(ctx, e.score, 98, y, top ? '#ffffff' : PAL.text, { shadow: PAL.textShadow, scale: 2, align: 'right' });
        // The run's CLOSE! count, small, beside the score.
        if (e.closes != null) drawText(ctx, e.closes, 102, y + 5, PAL.rippleMid, { shadow: PAL.textShadow });
        drawText(ctx, e.date.slice(2), 158, y + 2, col, { shadow: PAL.textShadow, align: 'right' });
      });
      drawText(ctx, 'SMALL BLUE NUMBER: CLOSE! COUNT', 90, 202, PAL.rippleMid, opt);
      hint(ctx, 'LEFT/RIGHT: PAGE   ESC: BACK', 214);
    });
  }

  // Story: for each chapter cleared, the fastest finish, the most CLOSE! and
  // the hearts (finished runs only).
  drawStory(ctx) {
    const opt = { shadow: PAL.textShadow };
    const story = this.game.data.story;
    drawText(ctx, '< STORY >', 90, 34, PAL.text, { ...opt, align: 'center' });
    plate(ctx, 14, 44, 152, CHAPTERS.length * 18 + 6);
    CHAPTERS.forEach((ch, i) => {
      const y = 50 + i * 18;
      const r = story.records?.[i];
      const open = i < story.unlocked;
      drawText(ctx, `${i + 1} ${open ? ch.title : '? ? ?'}`, 20, y, r ? PAL.text : PAL.textDim, opt);
      const hearts = story.stars[i] ?? 0;
      for (let h = 0; h < 3 && hearts; h++) drawText(ctx, '*', 140 + h * 7, y, h < hearts ? UMBRELLA_COLORS.love.base : PAL.keySide, opt);
      const line = r?.time != null ? `${r.time.toFixed(1)} S   CLOSE! ${r.closes}` : open ? 'NOT FINISHED YET' : '';
      drawText(ctx, line, 28, y + 8, r ? PAL.rippleMid : PAL.textDim, opt);
    });
    hint(ctx, 'LEFT/RIGHT: PAGE   ESC: BACK', 214);
  }
}
