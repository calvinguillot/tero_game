import { PAL, UMBRELLA_COLORS } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { umbrellaSprite } from '../render/umbrella.js';
import { drawJoystick, drawButton, drawChargeBar, drawKey } from './controls.js';

// Arcade-cabinet side panels (desktop) or top/bottom strips (phones).
// s: { title, score, best, lives, maxLives, color, style, bumpT, lifeLostT,
//      charge, ready, location, nextAt, level, t }

// Pointer zones in buffer pixels; checked in order.
const ZONES = {
  landscape: [
    ['pause', 268, 200, 34, 28],
    ['stick', 0, 0, 70, 240],
    ['button', 250, 0, 70, 240],
  ],
  portrait: [
    ['pause', 150, 0, 30, 24],
    ['stick', 0, 264, 80, 56],
    ['button', 100, 264, 80, 56],
  ],
};

export function zoneAt(L, x, y) {
  for (const [name, zx, zy, zw, zh] of ZONES[L.name]) {
    if (x >= zx && y >= zy && x < zx + zw && y < zy + zh) return name;
  }
  return null;
}

export function drawHud(ctx, L, s, input) {
  if (L.name === 'landscape') landscape(ctx, s, input);
  else portrait(ctx, s, input);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PAL.panel;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.panelLine;
  ctx.fillRect(x + 3, y + 3, w - 6, 1);
  ctx.fillRect(x + 3, y + h - 4, w - 6, 1);
  ctx.fillRect(x + 3, y + 3, 1, h - 6);
  ctx.fillRect(x + w - 4, y + 3, 1, h - 6);
}

function label(ctx, text, cx, y, color = PAL.textDim) {
  drawText(ctx, text, cx, y, color, { align: 'center' });
}

function score(ctx, s, x, y, scale, align = 'center') {
  const bump = s.bumpT > 0;
  drawText(ctx, s.score, x, y - (bump ? 1 : 0), bump ? '#ffffff' : PAL.text, { scale, shadow: PAL.textShadow, align });
}

function lives(ctx, s, cx, y, gap) {
  const x0 = cx - ((s.maxLives - 1) * gap) / 2;
  for (let i = 0; i < s.maxLives; i++) {
    const alive = i < s.lives;
    const lost = i === s.lives && s.lifeLostT > 0;
    if (lost && Math.floor(s.lifeLostT * 16) % 2) continue;
    const on = alive || lost;
    const spr = umbrellaSprite(on ? s.color : 'npc', 6, 0, 1, false, on ? 'j' : 'none', on ? s.style : 'classic');
    ctx.globalAlpha = on ? 1 : 0.35;
    const rise = lost ? Math.round((0.6 - s.lifeLostT) * 12) : 0;
    ctx.drawImage(spr.canvas, Math.round(x0 + i * gap) - spr.ax, y - spr.ay - rise);
    ctx.globalAlpha = 1;
  }
}

function controls(input) {
  return { v: input.axis(), pressed: input.down.has('action') };
}

function landscape(ctx, s, input) {
  panel(ctx, 0, 0, 70, 240);
  panel(ctx, 250, 0, 70, 240);
  ctx.fillStyle = PAL.panelEdge;
  ctx.fillRect(69, 0, 1, 240);
  ctx.fillRect(250, 0, 1, 240);
  const { v, pressed } = controls(input);
  const accent = UMBRELLA_COLORS[s.color].base;

  // Left: score, best, lives, then the stick.
  if (!s.title) {
    label(ctx, 'SCORE', 35, 9);
    score(ctx, s, 35, 18, 3);
  }
  label(ctx, 'BEST', 35, 42);
  drawText(ctx, s.best, 35, 50, PAL.text, { scale: 2, shadow: PAL.textShadow, align: 'center' });
  if (!s.title) {
    label(ctx, 'LIVES', 35, 68);
    lives(ctx, s, 35, 88, 20);
  }
  label(ctx, 'MOVE', 35, 150);
  drawJoystick(ctx, 35, 198, v, s.color);
  label(ctx, 'WASD/ARROWS', 35, 222);

  // Right: where we are, the force field button and pause.
  label(ctx, 'A RAINY DAY', 285, 9);
  label(ctx, s.location, 285, 22, PAL.text);
  if (s.nextAt != null) label(ctx, `NEXT AT ${s.nextAt}`, 285, 32);
  label(ctx, s.level, 285, 46);
  label(ctx, 'FORCE FIELD', 285, 140);
  drawButton(ctx, 285, 168, pressed, s.ready, s.color, s.t);
  drawChargeBar(ctx, 285, 182, 44, s.charge, s.ready, s.color, s.t);
  label(ctx, s.ready ? 'SPACE!' : 'CHARGING', 285, 190, s.ready ? PAL.text : PAL.textDim);
  label(ctx, 'PAUSE', 285, 204);
  drawKey(ctx, 277, 213, 'ESC', input.down.has('pause'), accent, 17);
}

function portrait(ctx, s, input) {
  panel(ctx, 0, 0, 180, 24);
  panel(ctx, 0, 264, 180, 56);
  const { v, pressed } = controls(input);
  const accent = UMBRELLA_COLORS[s.color].base;

  if (!s.title) {
    score(ctx, s, 8, 8, 2, 'left');
    lives(ctx, s, 112, 15, 14);
  }
  drawText(ctx, `BEST ${s.best}`, s.title ? 90 : 42, 10, PAL.textDim, { align: s.title ? 'center' : 'left' });
  drawKey(ctx, 160, 7, 'II', false, accent, 11);

  drawJoystick(ctx, 38, 308, v, s.color);
  drawButton(ctx, 142, 302, pressed, s.ready, s.color, s.t);
  label(ctx, s.location, 90, 272, PAL.text);
  label(ctx, 'FIELD', 90, 284);
  drawChargeBar(ctx, 90, 292, 30, s.charge, s.ready, s.color, s.t);
  if (s.nextAt != null) label(ctx, `NEXT ${s.nextAt}`, 90, 304);
}
