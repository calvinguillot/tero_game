import { PAL } from '../render/palette.js';
import { drawText, textWidth } from '../render/font.js';

// Up/down moves the selection; Space/Enter or a tap on an item picks it.
// `rects` are item boxes in playfield coordinates. Returns { sel, act }.
export function navigate(game, sel, rects) {
  const { input, audio } = game;
  const L = game.display.layout;
  let s = sel;
  let act = false;
  if (input.hit('up')) s = (s + rects.length - 1) % rects.length;
  if (input.hit('down')) s = (s + 1) % rects.length;
  const tap = input.takeTap();
  if (tap) {
    input.hit('confirm');
    const x = tap.x - L.pfX;
    const y = tap.y - L.pfY;
    const i = rects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    if (i >= 0) {
      s = i;
      act = true;
    }
  } else if (input.hit('confirm')) {
    act = true;
  }
  if (act) audio.menuSelect();
  else if (s !== sel) audio.menuMove();
  return { sel: s, act };
}

export function plate(ctx, x, y, w, h) {
  ctx.fillStyle = PAL.overlay;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.panelLine;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
}

// A centred menu item; the selected one is bright with blinking pointers.
export function menuItem(ctx, text, cx, y, selected, t, scale = 2) {
  drawText(ctx, text, cx, y, selected ? PAL.text : PAL.textDim, { scale, shadow: PAL.textShadow, align: 'center' });
  if (selected && Math.floor(t * 3) % 2 === 0) {
    const half = Math.ceil(textWidth(text, scale) / 2);
    drawText(ctx, '>', cx - half - 6 * scale, y, PAL.text, { scale, shadow: PAL.textShadow });
    drawText(ctx, '<', cx + half + 3 * scale, y, PAL.text, { scale, shadow: PAL.textShadow });
  }
}

export function hint(ctx, text, y) {
  drawText(ctx, text, 90, y, PAL.textDim, { align: 'center', shadow: PAL.textShadow });
}
