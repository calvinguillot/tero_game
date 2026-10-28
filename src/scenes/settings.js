import { PAL } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { saveData, resetStory, resetAll } from '../core/storage.js';
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
  // Data: each asks first, and says exactly what goes.
  { action: 'story', label: 'RESET STORY', help: () => ['BACK TO CHAPTER 1. KEEPS', 'ARCADE SCORES AND SETTINGS.'] },
  { action: 'all', label: 'RESET ALL DATA', help: () => ['ERASES EVERYTHING SAVED.', 'ASKS FIRST.'] },
  { key: null, label: 'BACK', help: () => ['SETTINGS SAVE AUTOMATICALLY.', ''] },
];
const RESETS = {
  story: {
    title: 'RESET STORY?',
    lines: ['ERASES: CHAPTERS UNLOCKED,', 'HEARTS, STORY RECORDS AND', 'WALK TOGETHER / 2 PLAYERS.', '', 'KEEPS: ARCADE HIGH SCORES', 'AND YOUR SETTINGS.'],
    run: resetStory,
  },
  all: {
    title: 'RESET ALL DATA?',
    lines: ['ERASES: STORY PROGRESS AND', 'RECORDS, ALL ARCADE HIGH', 'SCORES, YOUR INITIALS,', 'UMBRELLA AND EVERY SETTING.', '', 'THIS CANNOT BE UNDONE.'],
    run: resetAll,
  },
};
const ROW_Y = 72;
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
    if (!row.list) return;
    const s = this.game.data.settings;
    s[row.key] = row.list[(row.list.indexOf(s[row.key]) + dir + row.list.length) % row.list.length];
    this.changeT = 0.35;
    saveData(this.game.data);
    this.game.audio.menuMove();
  }

  back() {
    this.game.go(new MenuScene(this.game, 1));
  }

  // A reset waits for YES (NO is picked first).
  updateConfirm() {
    const { input } = this.game;
    const c = this.confirm;
    if (input.hit('left') || input.hit('right') || input.hit('up') || input.hit('down')) {
      c.yes = !c.yes;
      this.game.audio.menuMove();
    }
    const tap = input.takeTap();
    if (tap) {
      const L = this.game.display.layout;
      c.yes = tap.x - L.pfX >= 90;
      input.hit('confirm');
      return this.answer();
    }
    if (input.hit('pause')) return (this.confirm = null);
    if (input.hit('confirm') || input.hit('action')) this.answer();
  }

  answer() {
    const c = this.confirm;
    this.confirm = null;
    if (!c.yes) return this.game.audio.menuMove();
    RESETS[c.action].run(this.game.data);
    this.done = RESETS[c.action].title.replace('?', '') + ': DONE';
    this.doneT = 2;
    this.game.audio.menuSelect();
    const { color, style } = this.game.data.settings;
    Object.assign(this.hero, { color, style });
  }

  update(dt) {
    const { input } = this.game;
    this.t += dt;
    this.doneT = Math.max(0, (this.doneT ?? 0) - dt);
    this.bd.update(dt, [this.hero]);
    if (this.confirm) return this.updateConfirm();

    const rects = ROWS.map((_, i) => ({ x: 14, y: ROW_Y + i * ROW_H - 3, w: 152, h: ROW_H }));
    const prev = this.sel;
    const { sel, act } = navigate(this.game, this.sel, rects);
    this.sel = sel;
    if (input.hit('left')) this.change(-1);
    if (input.hit('right')) this.change(1);
    if (act) {
      if (ROWS[sel].action) return (this.confirm = { action: ROWS[sel].action, yes: false });
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
      plate(ctx, 14, ROW_Y - 7, 152, (ROWS.length - 1) * ROW_H + 19);
      const s = this.game.data.settings;
      ROWS.forEach((row, i) => {
        const y = ROW_Y + i * ROW_H;
        const on = i === this.sel;
        const color = on ? PAL.text : PAL.textDim;
        const opt = { shadow: PAL.textShadow };
        if (on && Math.floor(this.t * 3) % 2 === 0) drawText(ctx, '>', 20, y, PAL.text, opt);
        drawText(ctx, row.label, 28, y, color, opt);
        if (row.key && row.list) {
          const v = row.show(s[row.key]);
          drawText(ctx, on ? `< ${v} >` : v, 124, y, color, { ...opt, align: 'center' });
        }
      });
      const help = this.doneT > 0 ? [this.done, ''] : ROWS[this.sel].help(s[ROWS[this.sel].key]);
      plate(ctx, 14, 192, 152, 22);
      help.forEach((line, i) => hint(ctx, line, 196 + i * 9));
      hint(ctx, 'ESC: BACK', 222);
      if (this.confirm) this.drawConfirm(ctx);
    });
  }

  drawConfirm(ctx) {
    const c = this.confirm;
    const r = RESETS[c.action];
    const opt = { shadow: PAL.textShadow, align: 'center' };
    ctx.fillStyle = PAL.overlay;
    ctx.fillRect(0, 0, 180, 240);
    plate(ctx, 10, 50, 160, 132);
    drawText(ctx, r.title, 90, 60, '#ffa0a4', { ...opt, scale: 2 });
    r.lines.forEach((line, i) => drawText(ctx, line, 90, 84 + i * 10, PAL.text, opt));
    const blink = Math.floor(this.t * 3) % 2 === 0;
    for (const [label, x, yes] of [['NO', 58, false], ['YES', 122, true]]) {
      const on = c.yes === yes;
      drawText(ctx, on && blink ? `> ${label} <` : label, x, 160, on ? PAL.text : PAL.textDim, opt);
    }
  }
}
