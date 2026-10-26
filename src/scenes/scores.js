import { PAL } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { DIFFICULTY, DIFFICULTY_KEYS } from '../game/difficulty.js';
import { drawHud } from '../ui/hud.js';
import { plate, hint } from '../ui/menu.js';
import { inPlayfield } from './street.js';
import { menuHud } from './backdrop.js';
import { MenuScene } from './menu.js';

const SHOWN = 8;

// Best arcade runs per level; left/right switches level.
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
    const n = DIFFICULTY_KEYS.length;
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
      const key = DIFFICULTY_KEYS[this.level];
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
        drawText(ctx, e.score, 102, y, top ? '#ffffff' : PAL.text, { shadow: PAL.textShadow, scale: 2, align: 'right' });
        drawText(ctx, e.date.slice(2), 158, y + 2, col, { shadow: PAL.textShadow, align: 'right' });
      });
      hint(ctx, 'LEFT/RIGHT: LEVEL   ESC: BACK', 214);
    });
  }
}
