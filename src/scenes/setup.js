import { PAL, PLAYER_COLORS } from '../render/palette.js';
import { STYLES, STYLE_KEYS } from '../render/umbrella.js';
import { drawText } from '../render/font.js';
import { DIFFICULTY, DIFFICULTY_KEYS } from '../game/difficulty.js';
import { saveData } from '../core/storage.js';
import { drawHud } from '../ui/hud.js';
import { navigate, plate, menuItem, hint } from '../ui/menu.js';
import { inPlayfield } from './street.js';
import { menuHud, heroUmbrella } from './backdrop.js';
import { MenuScene } from './menu.js';
import { PlayScene } from './play.js';
import { ZenScene } from './zen.js';
import { StoryMenuScene } from './storymenu.js';
import { DuoScene } from './duo.js';

const LEVEL_HELP = {
  easy: ['SLOWER CROWD, SOFTER HITBOX.', 'FIELD RECHARGES IN 8 S.'],
  normal: ['THE INTENDED GAME.', 'FIELD RECHARGES IN 12 S.'],
  hard: ['FAST CROWD, TRICKY WALKERS', 'SOONER. FIELD: 16 S.'],
};

const MODE_HELP = {
  arcade: ['DODGE THE CROWD, SCORE,', 'CHASE THE HIGH SCORES.'],
  zen: ['NO SCORE, NO LIVES.', 'JUST WALK IN THE RAIN.'],
  story: ['FOLLOW THE RED UMBRELLA', 'THROUGH ONE DAY AND NIGHT.'],
};

const TOGETHER_HELP = {
  zen: ['WALK WITH HER. YOU TAKE', 'WASD, SHE TAKES THE ARROWS.'],
  arcade: ['TWO PLAYERS: MOST CLOSE!', 'WINS. WASD VS ARROWS.'],
};

const ROWS = [
  { key: 'mode', label: 'MODE', list: ['arcade', 'zen', 'story'], show: (v) => v.toUpperCase(), help: (v) => MODE_HELP[v] },
  // Zen and arcade, once the story has been finished.
  { key: 'together', label: 'TOGETHER', list: [true, false], show: (v) => (v ? 'ON' : 'OFF'), help: (v, mode) => TOGETHER_HELP[mode] },
  { key: 'color', label: 'COLOR', list: PLAYER_COLORS, show: (v) => v.toUpperCase(), help: () => ['YOUR UMBRELLA COLOR.', 'THE STICK AND BUTTON MATCH.'] },
  { key: 'style', label: 'STYLE', list: STYLE_KEYS, show: (v) => STYLES[v].name, help: () => ['SHAPE AND PATTERN OF', 'YOUR UMBRELLA.'] },
  { key: 'difficulty', label: 'LEVEL', list: DIFFICULTY_KEYS, show: (v) => DIFFICULTY[v].name, help: (v) => LEVEL_HELP[v] },
  { key: null, label: 'START', help: () => ['CHOICES ARE KEPT FOR', 'THE NEXT RUN.'] },
];
const ROW_Y = 112;
const ROW_H = 11;
// START sits under the rows, lower when there are more of them.
const startY = (rows) => Math.max(170, ROW_Y + (rows - 1) * ROW_H + 14);

// Between PLAY and the run: pick the mode, your umbrella and the level, with a
// live preview. Zen has no levels, so LEVEL is hidden there. Choices are
// saved, and START is selected on arrival so a returning player can go
// straight in.
export class SetupScene {
  constructor(game) {
    this.game = game;
    this.bd = game.backdrop;
    this.sel = this.rows.length - 1;
    this.t = 0;
    this.changeT = 0;
    this.hero = heroUmbrella(game, 90, 74, 18);
  }

  // The rows on show (the last one is START).
  get rows() {
    const { mode } = this.game.data.settings;
    const unlocked = this.game.data.story.done;
    return ROWS.filter((r) => {
      if (r.key === 'difficulty') return mode === 'arcade';
      if (r.key === 'together') return mode !== 'story' && unlocked;
      return true;
    });
  }

  change(dir) {
    const row = this.rows[this.sel];
    if (!row.key) return;
    const s = this.game.data.settings;
    s[row.key] = row.list[(row.list.indexOf(s[row.key]) + dir + row.list.length) % row.list.length];
    this.hero.color = s.color;
    this.hero.style = s.style;
    if (row.key === 'color' || row.key === 'style') this.changeT = 0.35;
    saveData(this.game.data);
    this.game.audio.menuMove();
  }

  update(dt) {
    const { input } = this.game;
    this.t += dt;
    this.bd.update(dt, [this.hero]);

    const start = this.rows.length - 1;
    const rects = this.rows.map((_, i) => (i === start ? { x: 40, y: startY(this.rows.length) - 4, w: 100, h: 18 } : { x: 14, y: ROW_Y + i * ROW_H - 4, w: 152, h: ROW_H }));
    const prev = this.sel;
    const { sel, act } = navigate(this.game, this.sel, rects);
    this.sel = sel;
    if (input.hit('left')) this.change(-1);
    if (input.hit('right')) this.change(1);
    if (act) {
      if (sel === start) {
        const { mode } = this.game.data.settings;
        const duo = this.game.data.settings.together && this.game.data.story.done;
        const next = mode === 'zen' ? new ZenScene(this.game) : mode === 'story' ? new StoryMenuScene(this.game) : duo ? new DuoScene(this.game) : new PlayScene(this.game);
        return this.game.go(next);
      }
      // Tapping the row you're on steps its value; Space/Enter does too.
      if (sel === prev) this.change(1);
    }
    if (input.hit('pause')) return this.game.go(new MenuScene(this.game, 0));

    // A new colour or style gives the preview a close-and-open twirl.
    this.changeT = Math.max(0, this.changeT - dt);
    const twirl = this.changeT > 0 ? Math.sin((1 - this.changeT / 0.35) * Math.PI) : 0;
    this.hero.open = 1 - twirl * 0.6;
    this.hero.tilt = Math.sin(this.t * 0.9) * 2 + twirl * 3;
    this.hero.bobY = Math.round(Math.sin(this.t * 2.2) * 1.5);
  }

  draw(ctx, L) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    drawHud(ctx, L, menuHud(this.game, this.bd), this.game.input);
    inPlayfield(ctx, L, () => {
      this.bd.draw(ctx, [this.hero]);
      drawText(ctx, 'NEW RUN', 90, 14, PAL.text, { scale: 2, shadow: PAL.textShadow, align: 'center' });
      const s = this.game.data.settings;
      const rows = this.rows;
      const start = rows.length - 1;
      plate(ctx, 14, ROW_Y - 8, 152, start * ROW_H + 4);
      rows.slice(0, start).forEach((row, i) => {
        const y = ROW_Y + i * ROW_H;
        const on = i === this.sel;
        const color = on ? PAL.text : PAL.textDim;
        const opt = { shadow: PAL.textShadow };
        if (on && Math.floor(this.t * 3) % 2 === 0) drawText(ctx, '>', 20, y, PAL.text, opt);
        drawText(ctx, row.label, 28, y, color, opt);
        const v = row.show(s[row.key]);
        drawText(ctx, on ? `< ${v} >` : v, 118, y, color, { ...opt, align: 'center' });
      });
      menuItem(ctx, 'START', 90, startY(rows.length), this.sel === start, this.t);
      const help = rows[this.sel].help(s[rows[this.sel].key], s.mode);
      plate(ctx, 14, 192, 152, 22);
      help.forEach((line, i) => hint(ctx, line, 196 + i * 9));
      hint(ctx, '< >: CHANGE   ESC: BACK', 222);
    });
  }
}
