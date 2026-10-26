import { PAL } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { drawLogo } from '../render/logo.js';
import { drawUmbrella } from '../render/umbrella.js';
import { ellipseSprite } from '../render/pixels.js';
import { drawHud } from '../ui/hud.js';
import { inPlayfield } from './street.js';
import { menuHud, heroUmbrella } from './backdrop.js';
import { MenuScene } from './menu.js';

const GROUND_Y = 172; // where the floating umbrella's shadow falls

// After the original home screen: the wordmark, and a big umbrella floating
// over its own shadow while the rain ripples the still street.
export class SplashScene {
  constructor(game) {
    this.game = game;
    this.bd = game.backdrop;
    this.bd.walkers = false;
    this.bd.speed = 0;
    this.t = 0;
    this.hero = heroUmbrella(game, 132, 62, 26);
    this.hero.groundY = GROUND_Y;
  }

  update(dt) {
    this.t += dt;
    const h = this.hero;
    h.bobY = Math.round(Math.sin(this.t * 1.6) * 2);
    h.tilt = Math.sin(this.t * 0.7) * 1.5;
    this.bd.update(dt, [h]);
    if (this.game.input.hit('confirm') || this.game.input.hit('action')) this.game.go(new MenuScene(this.game));
    this.game.input.takeTap();
  }

  draw(ctx, L) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    drawHud(ctx, L, menuHud(this.game, this.bd), this.game.input);
    inPlayfield(ctx, L, () => {
      this.bd.draw(ctx, [], () => {
        const h = this.hero;
        // The shadow breathes with the float.
        const rx = 22 - h.bobY;
        const shadow = ellipseSprite(rx, 7, this.bd.world.locAt(GROUND_Y).shadow, true);
        ctx.drawImage(shadow, h.x + 4 - rx, GROUND_Y - 7);
        drawUmbrella(ctx, h);
        drawLogo(ctx, 78, 98, 2);
      });
      if (Math.floor(this.t * 2) % 2 === 0) {
        drawText(ctx, 'PRESS SPACE OR TAP', 90, 210, PAL.text, { align: 'center', shadow: PAL.textShadow });
      }
    });
  }
}
