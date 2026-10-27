import { PAL } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { saveData } from '../core/storage.js';
import { drawHud } from '../ui/hud.js';
import { navigate, plate, hint } from '../ui/menu.js';
import { inPlayfield } from './street.js';
import { menuHud, heroUmbrella } from './backdrop.js';
import { MenuScene } from './menu.js';

// Umbrella colour, style and level are picked before each run (SetupScene).
const ROWS = [
  { key: 'dayNight', label: 'DAY/NIGHT', list: [true, false], show: (v) => (v ? 'ON' : 'OFF'), help: () => ['THE DAY PASSES AS YOU PLAY.', 'OFF: ALWAYS AFTERNOON.'] },
  { key: 'fx', label: 'EFFECTS', list: [true, false], show: (v) => (v ? 'FULL' : 'LOW'), help: () => ['PUDDLE REFLECTIONS, DRIPS', 'AND SPRAY. LOW IS LIGHTER.'] },
  { key: 'shake', label: 'SHAKE', list: [true, false], show: (v) => (v ? 'ON' : 'OFF'), help: () => ['SCREEN SHAKE ON HITS', 'AND FORCE FIELD BURSTS.'] },
  { key: 'flash', label: 'LIGHTNING', list: [true, false], show: (v) => (v ? 'FULL' : 'SOFT'), help: () => ['HOW BRIGHT STORM FLASHES ARE.', 'SOFT IS EASIER ON THE EYES.'] },
  { key: 'sound', label: 'SOUND', list: [true, false], show: (v) => (v ? 'ON' : 'OFF'), help: () => ['EFFECTS: SCORES, CLOSE!,', 'HITS, FORCE FIELD, MENUS.'] },
  { key: 'music', label: 'MUSIC', list: [true, false], show: (v) => (v ? 'ON' : 'OFF'), help: () => ['A SOFT TUNE THAT CHANGES', 'KEY AT NIGHT.'] },
  { key: 'rain', label: 'RAIN', list: [true, false], show: (v) => (v ? 'ON' : 'OFF'), help: () => ['RAIN, WIND, THUNDER,', 'BIRDS AND CRICKETS.'] },
  { key: null, label: 'BACK', help: () => ['SETTINGS SAVE AUTOMATICALLY.', ''] },
];
const ROW_Y = 84;
const ROW_H = 11;

export class SettingsScene {
  constructor(game) {
    this.game = game;
    this.bd = game.backdrop;
    this.sel = 0;
    this.t = 0;
    this.changeT = 0;
    this.hero = heroUmbrella(game, 90, 42, 12);
  }

  change(dir) {
    const row = ROWS[this.sel];
    if (!row.key) return;
    const s = this.game.data.settings;
    s[row.key] = row.list[(row.list.indexOf(s[row.key]) + dir + row.list.length) % row.list.length];
    this.changeT = 0.35;
    saveData(this.game.data);
    this.game.audio.menuMove();
  }

  back() {
    this.game.go(new MenuScene(this.game, 1));
  }

  update(dt) {
    const { input } = this.game;
    this.t += dt;
    this.bd.update(dt, [this.hero]);

    const rects = ROWS.map((_, i) => ({ x: 14, y: ROW_Y + i * ROW_H - 3, w: 152, h: ROW_H }));
    const prev = this.sel;
    const { sel, act } = navigate(this.game, this.sel, rects);
    this.sel = sel;
    if (input.hit('left')) this.change(-1);
    if (input.hit('right')) this.change(1);
    if (act) {
      if (!ROWS[sel].key) return this.back();
      // Tapping the row you're on steps its value.
      if (sel === prev) this.change(1);
    }
    if (input.hit('pause')) return this.back();

    // Any change gives the umbrella a close-and-open twirl.
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
      drawText(ctx, 'SETTINGS', 90, 14, PAL.text, { scale: 2, shadow: PAL.textShadow, align: 'center' });
      plate(ctx, 14, ROW_Y - 7, 152, ROWS.length * ROW_H + 4);
      const s = this.game.data.settings;
      ROWS.forEach((row, i) => {
        const y = ROW_Y + i * ROW_H;
        const on = i === this.sel;
        const color = on ? PAL.text : PAL.textDim;
        const opt = { shadow: PAL.textShadow };
        if (on && Math.floor(this.t * 3) % 2 === 0) drawText(ctx, '>', 20, y, PAL.text, opt);
        drawText(ctx, row.label, 28, y, color, opt);
        if (row.key) {
          const v = row.show(s[row.key]);
          drawText(ctx, on ? `< ${v} >` : v, 124, y, color, { ...opt, align: 'center' });
        }
      });
      const help = ROWS[this.sel].help(s[ROWS[this.sel].key]);
      plate(ctx, 14, 192, 152, 22);
      help.forEach((line, i) => hint(ctx, line, 196 + i * 9));
      hint(ctx, 'ESC: BACK', 222);
    });
  }
}
