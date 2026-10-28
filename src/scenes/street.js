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
// umbrellas, tall props, bridges and branches overhead, flying birds, spray,
// rain, haze; then the light of
// the hour is multiplied over everything, night lights and lightning are
// added, and `overlay` (UI drawn in the street) goes on top.
// `hidden` umbrellas still cast a shadow (used for the blinking player);
// `glow` (an umbrella, or a list: the players) is kept bright at night.
// `ground` draws extra things on the street under the umbrellas.
export function drawStreet(ctx, world, umbrellas, { hidden = null, overlay = null, glow = null, ground = null } = {}) {
  if (Array.isArray(glow)) glow = glow.filter((u) => u !== hidden);
  world.drawGround(ctx);
  world.drawRipples(ctx);
  world.drawParticles(ctx, false);
  world.decor.drawShadows(ctx);
  world.decor.drawSide(ctx, false);
  world.animals.drawGround(ctx);
  ground?.();
  const sorted = [...umbrellas].sort((a, b) => a.y - b.y);
  const row = (u) => (u.rides ? world.sy : Math.round);
  for (const u of sorted) drawShadow(ctx, u, world.locAt(u.y).shadow, row(u));
  world.obstacles.drawShadows(ctx);
  // Umbrellas and obstacles together, by where they stand on the street, so
  // nearer things overlap farther ones.
  const things = sorted.filter((u) => u !== hidden).map((u) => ({ y: u.y + u.r * 0.95, u }));
  for (const o of world.obstacles.list) things.push({ y: o.y, o });
  things.sort((a, b) => a.y - b.y);
  for (const t of things) {
    if (t.u) drawUmbrella(ctx, t.u, row(t.u));
    else world.obstacles.drawOne(ctx, t.o);
  }
  world.decor.drawSide(ctx, true);
  world.decor.drawOverhead(ctx);
  world.animals.drawAir(ctx);
  world.drawParticles(ctx, true);
  world.drawRain(ctx);
  const sky = world.sky;
  sky.drawFog(ctx);
  world.obstacles.drawOutlines(ctx, sky.p.fog);
  sky.drawTint(ctx);
  world.drawLights(ctx, glow && glow !== hidden ? glow : null);
  sky.drawFlash(ctx, world.softFlash);
  overlay?.();
}
