import { PAL, UMBRELLA_COLORS } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { umbrellaSprite } from '../render/umbrella.js';
import { drawJoystick, drawButton, drawChargeBar, drawKey } from './controls.js';

const RUSH_GOLD = '#ffd27a';

// Arcade-cabinet side panels (desktop) or top/bottom strips (phones).
// s: { title, zen, score, best, lives, maxLives, color, style, bumpT, lifeLostT,
//      charge, ready, location, nextAt, level, timeName, weatherName,
//      rush: { count, every, left }, t }

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
  if (s.maxLives > 3) gap = Math.round(gap * 0.8);
  const x0 = cx - ((s.maxLives - 1) * gap) / 2;
  for (let i = 0; i < s.maxLives; i++) {
    const alive = i < s.lives;
    const lost = i === s.lives && s.lifeLostT > 0;
    const gained = i === s.lives - 1 && s.lifeGainT > 0;
    if (lost && Math.floor(s.lifeLostT * 16) % 2) continue;
    const on = alive || lost;
    const spr = umbrellaSprite(on ? s.color : 'npc', 6, 0, 1, false, on ? 'j' : 'none', on ? s.style : 'classic');
    ctx.globalAlpha = on ? 1 : 0.35;
    // A lost life floats up as it blinks out; a new one bounces in.
    let dy = lost ? -Math.round((0.6 - s.lifeLostT) * 12) : 0;
    if (gained) dy = -Math.round(Math.abs(Math.sin(s.lifeGainT * 12)) * 4 * s.lifeGainT);
    ctx.drawImage(spr.canvas, Math.round(x0 + i * gap) - spr.ax, y - spr.ay + dy);
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

  // Left: score, best, lives, then the stick. Zen keeps none of that; Story
  // shows the clock and how close you are to her.
  if (s.zen) {
    drawText(ctx, 'ZEN', 35, 18, PAL.text, { scale: 3, shadow: PAL.textShadow, align: 'center' });
    label(ctx, s.together ? 'TOGETHER' : 'JUST WALK', 35, 40);
    if (s.together) label(ctx, 'HER: ARROWS', 35, 50);
  } else if (s.chapterInfo) {
    const { left, progress } = s.chapterInfo;
    label(ctx, 'TIME', 35, 9);
    clock(ctx, s, left, 35, 18, 3, 'center');
    label(ctx, 'TO HER', 35, 46);
    toHer(ctx, 11, 56, 40, progress, s.t);
  } else {
    if (!s.title) {
      label(ctx, 'SCORE', 35, 9);
      score(ctx, s, 35, 18, 3);
      rushMeter(ctx, s, 35, 37, 48);
    }
    label(ctx, 'BEST', 35, 56);
    drawText(ctx, s.best, 35, 64, PAL.text, { scale: 2, shadow: PAL.textShadow, align: 'center' });
    if (!s.title) {
      label(ctx, 'LIVES', 35, 82);
      lives(ctx, s, 35, 102, 20);
    }
  }
  label(ctx, 'MOVE', 35, 150);
  drawJoystick(ctx, 35, 198, v, s.color);
  label(ctx, 'WASD/ARROWS', 35, 222);

  // Right: where we are, the force field button and pause.
  label(ctx, 'A RAINY DAY', 285, 9);
  label(ctx, s.location, 285, 22, PAL.text);
  if (s.nextAt != null) label(ctx, `NEXT AT ${s.nextAt}`, 285, 32);
  if (s.level) label(ctx, s.level, 285, 46);
  if (s.timeName) {
    label(ctx, s.timeName, 285, 62, PAL.text);
    label(ctx, s.weatherName, 285, 72, ['STORMY', 'BLIZZARD', 'SUN RUSH'].includes(s.weatherName) ? RUSH_GOLD : PAL.text);
  }
  if (!s.zen) {
    label(ctx, 'FORCE FIELD', 285, 140);
    drawButton(ctx, 285, 168, pressed, s.ready, s.color, s.t);
    drawChargeBar(ctx, 285, 182, 44, s.charge, s.ready, s.color, s.t);
    label(ctx, s.ready ? 'SPACE!' : 'CHARGING', 285, 190, s.ready ? PAL.text : PAL.textDim);
  }
  label(ctx, 'PAUSE', 285, 204);
  drawKey(ctx, 277, 213, 'ESC', input.down.has('pause'), accent, 17);
}

function portrait(ctx, s, input) {
  panel(ctx, 0, 0, 180, 24);
  panel(ctx, 0, 264, 180, 56);
  const { v, pressed } = controls(input);
  const accent = UMBRELLA_COLORS[s.color].base;

  if (s.zen) {
    drawText(ctx, 'ZEN', 8, 8, PAL.text, { scale: 2, shadow: PAL.textShadow });
    if (s.timeName) drawText(ctx, s.timeName, 40, 10, PAL.textDim);
  } else if (s.chapterInfo) {
    clock(ctx, s, s.chapterInfo.left, 8, 8, 2, 'left');
    toHer(ctx, 52, 11, 80, s.chapterInfo.progress, s.t);
  } else {
    if (!s.title) {
      score(ctx, s, 8, 8, 2, 'left');
      lives(ctx, s, 112, 15, 14);
    }
    drawText(ctx, `BEST ${s.best}`, s.title ? 90 : 42, 10, PAL.textDim, { align: s.title ? 'center' : 'left' });
  }
  drawKey(ctx, 160, 7, 'II', false, accent, 11);

  drawJoystick(ctx, 38, 308, v, s.color);
  label(ctx, s.location, 90, 270, PAL.text);
  if (s.weatherName) label(ctx, s.weatherName, 90, 279);
  if (s.zen) return;
  drawButton(ctx, 142, 302, pressed, s.ready, s.color, s.t);
  label(ctx, 'FIELD', 90, 288);
  drawChargeBar(ctx, 90, 296, 30, s.charge, s.ready, s.color, s.t);
  if (s.rush) rushMeter(ctx, s, 90, 305, 40, true);
}

// Photo mode: plain panels with just what the keys do, and a note once saved.
export function drawPhotoHud(ctx, L, saved, color) {
  const accent = UMBRELLA_COLORS[color].light;
  if (L.name === 'landscape') {
    panel(ctx, 0, 0, 70, 240);
    panel(ctx, 250, 0, 70, 240);
    ctx.fillStyle = PAL.panelEdge;
    ctx.fillRect(69, 0, 1, 240);
    ctx.fillRect(250, 0, 1, 240);
    drawText(ctx, 'PHOTO', 35, 18, PAL.text, { scale: 2, shadow: PAL.textShadow, align: 'center' });
    label(ctx, 'SPACE OR TAP', 35, 104);
    label(ctx, 'TO SAVE', 35, 114);
    if (saved) label(ctx, 'SAVED!', 35, 134, accent);
    label(ctx, 'ESC', 285, 104);
    label(ctx, 'TO GO BACK', 285, 114);
  } else {
    panel(ctx, 0, 0, 180, 24);
    panel(ctx, 0, 264, 180, 56);
    drawText(ctx, 'PHOTO', 8, 8, PAL.text, { scale: 2, shadow: PAL.textShadow });
    if (saved) drawText(ctx, 'SAVED!', 146, 10, accent, { align: 'right' });
    drawKey(ctx, 160, 7, 'II', false, UMBRELLA_COLORS[color].base, 11);
    label(ctx, 'TAP TO SAVE', 90, 284);
    label(ctx, 'II TO GO BACK', 90, 296);
  }
}

// CLOSE! near misses collected towards the next SUN RUSH; during the rush, a
// gold bar running down.
function rushMeter(ctx, s, cx, y, w, compact = false) {
  const r = s.rush;
  if (!r) return;
  const x = Math.round(cx - w / 2);
  const barY = compact ? y + 7 : y + 8;
  if (r.left > 0) {
    if (Math.floor(s.t * 6) % 2 === 0) label(ctx, 'SUN RUSH!', cx, y, RUSH_GOLD);
    bar(ctx, x, barY, w, r.left, RUSH_GOLD);
  } else {
    label(ctx, `CLOSE ${r.count}/${r.every}`, cx, y);
    bar(ctx, x, barY, w, r.count / r.every, UMBRELLA_COLORS[s.color].light);
  }
}

// Story: seconds left, blinking red when it's nearly out.
function clock(ctx, s, left, x, y, scale, align) {
  const low = left < 10 && Math.floor(s.t * 4) % 2 === 0;
  drawText(ctx, Math.ceil(left), x, y, low ? UMBRELLA_COLORS.love.light : PAL.text, { scale, shadow: PAL.textShadow, align });
}

// Story: a bar filling towards a red heart (the font's '*').
function toHer(ctx, x, y, w, k, t) {
  bar(ctx, x, y, w, k, UMBRELLA_COLORS.love.base);
  const beat = Math.floor(t * 2) % 2 === 0 ? 0 : 1;
  drawText(ctx, '*', x + w + 3, y - 2 - beat, UMBRELLA_COLORS.love.base, { shadow: PAL.textShadow });
}

function bar(ctx, x, y, w, k, color) {
  ctx.fillStyle = PAL.textShadow;
  ctx.fillRect(x - 1, y - 1, w + 2, 4);
  ctx.fillStyle = PAL.keySide;
  ctx.fillRect(x, y, w, 2);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, k))), 2);
}
