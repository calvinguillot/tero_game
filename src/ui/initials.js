import { PAL } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { plate } from './menu.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const COLS = [66, 90, 114]; // letter centres (playfield x)
const LETTER_Y = 120;
const OK = { x: 66, y: 166, w: 48, h: 16 };

// Arcade-style three-letter name entry. Up/down changes the letter, left/right
// or Space moves along; on touch, tap above or below a letter, then OK.
export class InitialsEntry {
  constructor(start = 'AAA') {
    this.chars = (start + 'AAA').slice(0, 3).split('');
    this.pos = 0;
    this.done = false;
    this.t = 0;
  }

  get name() {
    return this.chars.join('');
  }

  bump(i, dir) {
    const k = (LETTERS.indexOf(this.chars[i]) + dir + LETTERS.length) % LETTERS.length;
    this.chars[i] = LETTERS[k];
  }

  update(dt, game) {
    const { input, audio } = game;
    this.t += dt;
    if (input.hit('up')) {
      this.bump(this.pos, 1);
      audio.menuMove();
    }
    if (input.hit('down')) {
      this.bump(this.pos, -1);
      audio.menuMove();
    }
    if (input.hit('left') && this.pos > 0) {
      this.pos--;
      audio.menuMove();
    }
    if (input.hit('right') && this.pos < 2) {
      this.pos++;
      audio.menuMove();
    }
    const tap = input.takeTap();
    if (tap) {
      input.hit('confirm');
      const L = game.display.layout;
      const x = tap.x - L.pfX;
      const y = tap.y - L.pfY;
      if (x >= OK.x && x < OK.x + OK.w && y >= OK.y && y < OK.y + OK.h) return this.finish(audio);
      const i = COLS.findIndex((cx) => Math.abs(x - cx) < 11);
      if (i >= 0 && y > LETTER_Y - 22 && y < LETTER_Y + 36) {
        this.pos = i;
        this.bump(i, y < LETTER_Y + 7 ? 1 : -1);
        audio.menuMove();
      }
    } else if (input.hit('confirm')) {
      if (this.pos < 2) {
        this.pos++;
        audio.menuMove();
      } else {
        this.finish(audio);
      }
    }
  }

  finish(audio) {
    this.done = true;
    audio.menuSelect();
  }

  draw(ctx, rank, score) {
    const opt = { shadow: PAL.textShadow, align: 'center' };
    drawText(ctx, 'NEW HIGH SCORE!', 90, 42, '#ffffff', { ...opt, scale: 2 });
    drawText(ctx, `RANK ${rank}`, 90, 62, PAL.textDim, opt);
    drawText(ctx, score, 90, 72, PAL.text, { ...opt, scale: 3 });
    drawText(ctx, 'ENTER YOUR NAME', 90, 96, PAL.text, opt);
    plate(ctx, 50, LETTER_Y - 14, 80, 40);
    const blink = Math.floor(this.t * 3) % 2 === 0;
    COLS.forEach((cx, i) => {
      const on = i === this.pos;
      drawText(ctx, this.chars[i], cx, LETTER_Y, on ? '#ffffff' : PAL.textDim, { ...opt, scale: 3 });
      if (on && blink) {
        drawText(ctx, '^', cx, LETTER_Y - 10, PAL.text, opt);
        drawText(ctx, 'V', cx, LETTER_Y + 19, PAL.text, opt);
      }
    });
    plate(ctx, OK.x, OK.y, OK.w, OK.h);
    drawText(ctx, 'OK', 90, OK.y + 3, this.pos === 2 && blink ? '#ffffff' : PAL.text, { ...opt, scale: 2 });
    drawText(ctx, 'UP/DOWN: LETTER', 90, 192, PAL.textDim, opt);
    drawText(ctx, 'SPACE: NEXT', 90, 201, PAL.textDim, opt);
  }
}
