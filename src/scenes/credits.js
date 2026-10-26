import { PAL } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { drawLogo } from '../render/logo.js';
import { umbrellaSprite } from '../render/umbrella.js';
import { drawHud } from '../ui/hud.js';
import { navigate, plate, menuItem, hint } from '../ui/menu.js';
import { inPlayfield } from './street.js';
import { menuHud } from './backdrop.js';
import { MenuScene } from './menu.js';

const PEOPLE = [
  { role: 'PROGRAMMING AND SOUND BY', name: 'CALVIN GUILLOT', site: 'CALVINGUILLOT.COM', url: 'https://calvinguillot.com/', color: 'blue', style: 'classic' },
  { role: 'INSPIRED BY THE ART OF', name: 'TERO JUUTI', site: 'TEROJUUTI.COM', url: 'https://terojuuti.com/', color: 'mint', style: 'wagasa' },
];
const ROW_Y = 70;
const ROW_H = 48;
const BACK_Y = 184;

// Who made the game. Picking a name opens their website in a new tab.
export class CreditsScene {
  constructor(game) {
    this.game = game;
    this.bd = game.backdrop;
    this.sel = 0;
    this.t = 0;
  }

  back() {
    this.game.go(new MenuScene(this.game, 4));
  }

  update(dt) {
    const { input } = this.game;
    this.t += dt;
    this.bd.update(dt);
    const rects = [...PEOPLE.map((_, i) => ({ x: 14, y: ROW_Y + i * ROW_H - 6, w: 152, h: ROW_H - 4 })), { x: 40, y: BACK_Y - 4, w: 100, h: 18 }];
    const { sel, act } = navigate(this.game, this.sel, rects);
    this.sel = sel;
    if (act) {
      if (sel === PEOPLE.length) return this.back();
      window.open(PEOPLE[sel].url, '_blank', 'noopener');
    }
    if (input.hit('pause')) this.back();
  }

  draw(ctx, L) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    drawHud(ctx, L, menuHud(this.game, this.bd), this.game.input);
    inPlayfield(ctx, L, () => {
      this.bd.draw(ctx);
      drawLogo(ctx, 90, 10, 1);
      drawText(ctx, 'CREDITS', 90, 48, PAL.text, { scale: 2, shadow: PAL.textShadow, align: 'center' });
      PEOPLE.forEach((p, i) => {
        const y = ROW_Y + i * ROW_H;
        const on = i === this.sel;
        plate(ctx, 14, y - 6, 152, ROW_H - 6);
        const s = umbrellaSprite(p.color, 9, Math.round(Math.sin(this.t * 2 + i) * 1.5), 1, false, 'j', p.style);
        ctx.drawImage(s.canvas, 30 - s.ax, y + 14 - s.ay + (on ? Math.round(Math.sin(this.t * 5) * 1) : 0));
        drawText(ctx, p.role, 46, y, PAL.textDim, { shadow: PAL.textShadow });
        drawText(ctx, p.name, 46, y + 10, on ? '#ffffff' : PAL.text, { shadow: PAL.textShadow });
        drawText(ctx, p.site, 46, y + 22, on ? PAL.rippleHi : PAL.rippleMid, { shadow: PAL.textShadow });
        if (on && Math.floor(this.t * 3) % 2 === 0) drawText(ctx, '>', 18, y + 10, PAL.text, { shadow: PAL.textShadow });
      });
      menuItem(ctx, 'BACK', 90, BACK_Y, this.sel === PEOPLE.length, this.t);
      hint(ctx, 'PICK A NAME TO VISIT THEIR SITE', 210);
      hint(ctx, 'ESC: BACK', 222);
    });
  }
}
