import { ellipseSprite } from '../render/pixels.js';

const RED = '#ec3c48';
const PINK = '#ffa0a4';

// The red umbrella, as an umbrella object for drawUmbrella: always red, in
// the same style as yours. `alpha` is how much of her shows (0 hides her: the
// storm only shows her in the flashes).
export function loveUmbrella(x, y, r = 14, style = 'classic') {
  return { x, y, r, color: 'love', style, handle: 'j', tilt: 0, open: 1, inv: false, bobY: 0, pitch: 0, alpha: 1 };
}

// Her marker: the same red ring everywhere (walk over it for time), with a
// small glint in the colour of the place's water so it sits in each street.
// `fade` (0..1) lets the scenes between chapters fade them out.
export function drawMarker(ctx, k, world, t = 0, fade = 1) {
  const x = Math.round(k.x);
  const y = world.sy ? world.sy(k.y) : Math.round(k.y);
  ctx.globalAlpha = fade;
  ctx.drawImage(ellipseSprite(5, 2, RED, false), x - 5, y - 2);
  ctx.drawImage(ellipseSprite(2, 1, PINK, false), x - 2, y - 1);
  const glint = world.locAt?.(k.y)?.ripple?.[0] ?? '#ffffff';
  if (Math.floor(t * 3 + k.x) % 3 === 0) {
    ctx.fillStyle = glint;
    ctx.fillRect(x + 4, y - 3, 1, 1);
  }
  ctx.globalAlpha = 1;
}
