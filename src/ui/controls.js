import { ellipseSprite } from '../render/pixels.js';
import { UMBRELLA_COLORS, PAL } from '../render/palette.js';
import { drawText, textWidth } from '../render/font.js';

const HW = {
  shadow: '#122e3f',
  rim: '#46607a',
  plate: '#2c3e4e',
  hole: '#0f1a22',
  shaft: '#c9ccd6',
  shaftDark: '#8a90a0',
};

function blob(ctx, x, y, rx, ry, color) {
  ctx.drawImage(ellipseSprite(rx, ry, color, true), Math.round(x) - rx, Math.round(y) - ry);
}

// Arcade joystick seen from the front: base plate at `by`, ball top
// following the input vector `v`, in the player's umbrella colour.
export function drawJoystick(ctx, cx, by, v, color) {
  const pal = UMBRELLA_COLORS[color];
  blob(ctx, cx + 1, by + 2, 15, 5, HW.shadow);
  blob(ctx, cx, by, 14, 5, HW.rim);
  blob(ctx, cx, by - 1, 12, 4, HW.plate);
  blob(ctx, cx, by, 3, 1, HW.hole);

  const kx = cx + v.x * 7;
  const ky = by - 20 + v.y * 4;
  const steps = Math.max(1, Math.ceil(Math.hypot(kx - cx, ky - by)));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(cx + ((kx - cx) * i) / steps);
    const y = Math.round(by + ((ky - by) * i) / steps);
    ctx.fillStyle = HW.shaft;
    ctx.fillRect(x - 1, y, 1, 1);
    ctx.fillStyle = HW.shaftDark;
    ctx.fillRect(x, y, 1, 1);
  }

  blob(ctx, kx, ky, 7, 7, pal.outline);
  blob(ctx, kx, ky, 6, 6, pal.dark);
  blob(ctx, kx - 1, ky - 1, 5, 5, pal.base);
  blob(ctx, kx - 2, ky - 3, 2, 2, pal.light);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(kx) - 3, Math.round(ky) - 4, 2, 1);
}

// Round arcade button: grey while recharging, the umbrella colour when ready.
export function drawButton(ctx, cx, cy, pressed, ready, color, t) {
  const pal = UMBRELLA_COLORS[ready ? color : 'npcSlate'];
  blob(ctx, cx + 1, cy + 3, 16, 7, HW.shadow);
  blob(ctx, cx, cy + 1, 15, 6, HW.rim);
  blob(ctx, cx, cy + 1, 13, 5, HW.hole);
  const lift = pressed ? 1 : 4;
  for (let i = 0; i < lift; i++) blob(ctx, cx, cy - i, 11, 5, pal.dark);
  blob(ctx, cx, cy - lift, 11, 5, pal.outline);
  blob(ctx, cx, cy - lift, 10, 4, pal.base);
  blob(ctx, cx - 3, cy - lift - 1, 4, 2, pal.light);
  if (ready && Math.floor(t * 2) % 2 === 0) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 6, cy - lift - 2, 3, 1);
  }
}

export function drawChargeBar(ctx, cx, y, w, charge, ready, color, t) {
  const x = Math.round(cx - w / 2);
  ctx.fillStyle = PAL.textShadow;
  ctx.fillRect(x - 1, y - 1, w + 2, 6);
  ctx.fillStyle = PAL.keySide;
  ctx.fillRect(x, y, w, 4);
  const pal = UMBRELLA_COLORS[color];
  ctx.fillStyle = ready && Math.floor(t * 4) % 2 ? pal.light : pal.base;
  ctx.fillRect(x, y, Math.round(w * charge), 4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, Math.round(w * charge), 1);
}

export function drawKey(ctx, x, y, text, on, accent, w = 9) {
  ctx.fillStyle = PAL.textShadow;
  ctx.fillRect(x, y, w, 10);
  const dy = on ? 1 : 0;
  ctx.fillStyle = on ? accent : PAL.keyFace;
  ctx.fillRect(x + 1, y + 1 + dy, w - 2, 7);
  if (!on) {
    ctx.fillStyle = PAL.keySide;
    ctx.fillRect(x + 1, y + 8, w - 2, 1);
  }
  drawText(ctx, text, x + Math.floor((w - textWidth(text)) / 2), y + 2 + dy, on ? PAL.textShadow : PAL.text);
}
