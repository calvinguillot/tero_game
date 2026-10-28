import { ellipseSprite } from '../render/pixels.js';

const RED = '#ec3c48';
const PINK = '#ffa0a4';

// The red umbrella, as an umbrella object for drawUmbrella. `alpha` is how
// much of her shows (0 hides her: the storm only shows her in the flashes).
export function loveUmbrella(x, y, r = 14) {
  return { x, y, r, color: 'love', style: 'classic', handle: 'j', tilt: 0, open: 1, inv: false, bobY: 0, pitch: 0, alpha: 1 };
}

// What she leaves behind her: red ripples, petals or small footprints.
// `row` turns a y into a screen row (World.sy, as they lie on the street);
// `fade` (0..1) lets the scenes between chapters fade them out.
export function drawKeepsake(ctx, k, row, fade = 1) {
  const x = Math.round(k.x);
  const y = row(k.y);
  ctx.globalAlpha = fade;
  if (k.kind === 'ripples') {
    ctx.drawImage(ellipseSprite(5, 2, RED, false), x - 5, y - 2);
    ctx.drawImage(ellipseSprite(2, 1, PINK, false), x - 2, y - 1);
  } else if (k.kind === 'petals') {
    ctx.fillStyle = RED;
    ctx.fillRect(x - 2, y, 2, 1);
    ctx.fillRect(x + 2, y - 2, 1, 2);
    ctx.fillStyle = PINK;
    ctx.fillRect(x, y + 1, 2, 1);
    ctx.fillRect(x - 3, y - 2, 1, 1);
  } else {
    ctx.fillStyle = RED;
    ctx.fillRect(x - 2, y - 1, 1, 2);
    ctx.fillRect(x + 1, y - 3, 1, 2);
  }
  ctx.globalAlpha = 1;
}
