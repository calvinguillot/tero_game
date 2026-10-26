import { PAL } from '../render/palette.js';
import { drawLogo } from '../render/logo.js';
import { drawHud } from '../ui/hud.js';
import { navigate, plate, menuItem, hint } from '../ui/menu.js';
import { inPlayfield } from './street.js';
import { menuHud, heroUmbrella } from './backdrop.js';
import { PlayScene } from './play.js';
import { SettingsScene } from './settings.js';
import { GuideScene } from './guide.js';
import { ScoresScene } from './scores.js';
import { SplashScene } from './splash.js';
import { CreditsScene } from './credits.js';

const ITEMS = [
  ['PLAY', (g) => new PlayScene(g)],
  ['SETTINGS', (g) => new SettingsScene(g)],
  ['HOW TO PLAY', (g) => new GuideScene(g)],
  ['HIGH SCORES', (g) => new ScoresScene(g)],
  ['CREDITS', (g) => new CreditsScene(g)],
];
const ROW_Y = 114;
const ROW_H = 18;

export class MenuScene {
  constructor(game, sel = 0) {
    this.game = game;
    this.bd = game.backdrop;
    this.bd.walkers = true;
    this.bd.speed = 14;
    this.sel = sel;
    this.t = 0;
    this.hero = heroUmbrella(game, 90, 86, 16);
  }

  update(dt) {
    const { input } = this.game;
    this.t += dt;
    this.hero.bobY = Math.round(Math.sin(this.t * 2.2) * 1.5);
    this.hero.tilt = Math.sin(this.t * 0.9) * 2;
    this.bd.update(dt, [this.hero]);

    const rects = ITEMS.map((_, i) => ({ x: 20, y: ROW_Y + i * ROW_H - 4, w: 140, h: ROW_H }));
    const { sel, act } = navigate(this.game, this.sel, rects);
    this.sel = sel;
    if (act) this.game.go(ITEMS[sel][1](this.game));
    else if (input.hit('pause')) this.game.go(new SplashScene(this.game));
  }

  draw(ctx, L) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    drawHud(ctx, L, menuHud(this.game, this.bd), this.game.input);
    inPlayfield(ctx, L, () => {
      this.bd.draw(ctx, [this.hero]);
      drawLogo(ctx, 90, 18, 1);
      plate(ctx, 14, ROW_Y - 10, 152, ITEMS.length * ROW_H + 8);
      ITEMS.forEach(([label], i) => menuItem(ctx, label, 90, ROW_Y + i * ROW_H, i === this.sel, this.t));
      hint(ctx, 'ARROWS + SPACE, OR TAP', 218);
    });
  }
}
