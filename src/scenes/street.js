import { drawUmbrella, drawShadow } from '../render/umbrella.js';
import { PF_W, PF_H } from '../config.js';

// Runs `fn` with the context translated and clipped to the playfield.
export function inPlayfield(ctx, L, fn, shake = 0) {
  ctx.save();
  ctx.translate(L.pfX, L.pfY);
  ctx.beginPath();
  ctx.rect(0, 0, PF_W, PF_H);
  ctx.clip();
  if (shake > 0) ctx.translate(Math.floor(Math.random() * 3) - 1, Math.floor(Math.random() * 3) - 1);
  fn();
  ctx.restore();
}

// Layers, back to front: street, water, low props and animals, shadows,
// umbrellas, tall props and flying birds, spray, rain, haze; then the light of
// the hour is multiplied over everything, night lights and lightning are
// added, and `overlay` (UI drawn in the street) goes on top.
// `hidden` umbrellas still cast a shadow (used for the blinking player);
// `glow` is kept bright at night (the player).
export function drawStreet(ctx, world, umbrellas, { hidden = null, overlay = null, glow = null } = {}) {
  world.drawGround(ctx);
  world.drawRipples(ctx);
  world.drawParticles(ctx, false);
  world.decor.drawTreeShadows(ctx);
  world.decor.drawSide(ctx, false);
  world.animals.drawGround(ctx);
  const sorted = [...umbrellas].sort((a, b) => a.y - b.y);
  for (const u of sorted) drawShadow(ctx, u, world.locAt(u.y).shadow);
  for (const u of sorted) if (u !== hidden) drawUmbrella(ctx, u);
  world.decor.drawSide(ctx, true);
  world.animals.drawAir(ctx);
  world.drawParticles(ctx, true);
  world.drawRain(ctx);
  const sky = world.sky;
  sky.drawFog(ctx);
  sky.drawTint(ctx);
  world.drawLights(ctx, glow && glow !== hidden ? glow : null);
  sky.drawFlash(ctx, world.softFlash);
  overlay?.();
}
