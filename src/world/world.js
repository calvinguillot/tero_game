import { PAL } from '../render/palette.js';
import { ellipseSprite } from '../render/pixels.js';
import { canopyContains, canopyGeom, drawReflection, drawUmbrella } from '../render/umbrella.js';
import { rand } from '../core/math.js';
import { PF_W, PF_H, GROUND_L, GROUND_R } from '../config.js';
import { drawWalls } from './walls.js';
import { LOCATIONS } from './locations.js';
import { Decor } from './decor.js';
import { Animals } from './animals.js';
import { Sky } from './sky.js';

const MAX_DROPS = 500;
const MAX_RIPPLES = 160;
const RING_LAG = 0.16;

// The street: scrolls down at `speed`, receives rain, keeps ripples, splashes,
// puddles, props and animals. `umbrellas` is set by the scene so drops can land
// on canopies, `player` so animals can react to it.
//
// The street is split into location zones stacked vertically. zones[0] is the
// newest (top) one; each zone ends at its screen-space boundary `b`, and the
// last one runs to the bottom. New locations enter from the top behind a
// crosswalk and scroll down like everything else.
export class World {
  constructor({ speed = 30, rainRate = 110, location = 'town', lowFx = false, sky = null } = {}) {
    this.lowFx = lowFx; // skips reflections and drips, halves spray
    this.sky = sky || new Sky();
    this.softFlash = false; // gentler lightning (accessibility)
    this.wetSlow = 1; // speed factor in puddles and mud (Hard: < 1)
    this.drips = [];
    this.refl = null;
    this.t = 0;
    this.scrollY = 0;
    // How far the view runs ahead of the last simulation step (set each
    // frame), so scrolling stays smooth when frames and steps don't line up.
    this.lead = 0;
    // Screen row for something riding the street at `y`. Everything that
    // scrolls is placed through here, so it moves on the same frame as the
    // pavement instead of rounding on its own schedule.
    this.sy = (y) => Math.round(y - this.scrollY) + this.viewY;
    this.speed = speed;
    this.rainRate = rainRate;
    this.rainAcc = 0;
    this.zones = [{ loc: location, b: Infinity }];
    this.drops = [];
    this.ripples = [];
    this.particles = [];
    this.puddles = [];
    this.umbrellas = [];
    this.player = null;
    this.domes = []; // force-field bubbles that keep rain off: { x, y, r }
    for (let i = 0; i < 5; i++) this.puddles.push(this.newPuddle(rand(-20, PF_H)));
    this.decor = new Decor(this);
    this.animals = new Animals(this);
    // Pre-simulate so the first frame is already raining.
    for (let i = 0; i < 180; i++) this.update(1 / 60);
  }

  locAt(y) {
    for (const z of this.zones) if (y <= z.b) return LOCATIONS[z.loc];
    return LOCATIONS[this.zones[this.zones.length - 1].loc];
  }

  // The pavement's own pixel offset.
  get viewY() {
    return Math.floor(this.scrollY + this.lead);
  }

  get topLocation() {
    return LOCATIONS[this.zones[0].loc];
  }

  // Returns true when a new location starts scrolling in.
  setLocation(key) {
    if (this.zones[0].loc === key) return false;
    this.zones.unshift({ loc: key, b: -40 });
    return true;
  }

  newPuddle(y) {
    const rx = Math.round(rand(10, 24));
    return { x: rand(GROUND_L + rx, GROUND_R - rx), y, rx, ry: Math.max(3, Math.round(rx * rand(0.35, 0.5))) };
  }

  addRipple(x, y, maxR, rings = 1, life = 1) {
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift();
    this.ripples.push({ x, y, maxR, rings, life, age: 0 });
  }

  splash(x, y, n, color, onCanopy, speed) {
    if (this.lowFx) n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x,
        y,
        vx: rand(-speed, speed) * 0.6,
        vy: -rand(speed * 0.6, speed * 1.2),
        age: 0,
        life: rand(0.12, 0.24),
        color,
        top: onCanopy,
      });
    }
  }

  // A ring of sparkles flying out from a point, drawn above the umbrellas.
  burst(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const v = speed * rand(0.7, 1);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 30, age: 0, life: rand(0.3, 0.5), color, top: true, float: true });
    }
  }

  // Shoves water away from a point: ripples and falling drops move outward,
  // and a ring of spray flies off.
  displace(x, y, radius) {
    const push = (o, k) => {
      const dx = o.x - x;
      const dy = (o.y - y) * 2;
      const d = Math.hypot(dx, dy) || 1;
      if (d > radius) return;
      const f = (1 - d / radius) * k;
      o.x += (dx / d) * f;
      o.y += (dy / d) * f * 0.5;
    };
    for (const r of this.ripples) push(r, 14);
    for (const d of this.drops) {
      const gy = d.gy;
      push(d, 10);
      d.gy = gy;
    }
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.particles.push({ x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 4, vx: Math.cos(a) * 90, vy: Math.sin(a) * 45 - 40, age: 0, life: rand(0.25, 0.4), color: PAL.splash, top: true });
    }
  }

  // A force-field front sweeping outward: everything on the water inside
  // radius `rf` is carried out to the front, which leaves new wavelets behind.
  pushWater(x, y, rf) {
    const toFront = (px, py) => {
      const dx = px - x;
      const dy = (py - y) * 2;
      const d = Math.hypot(dx, dy);
      if (d >= rf) return null;
      if (d < 0.01) return [x + rf, y];
      return [x + (dx / d) * rf, y + ((dy / d) * rf) / 2];
    };
    for (const r of this.ripples) {
      const p = toFront(r.x, r.y);
      if (p) [r.x, r.y] = p;
    }
    for (const d of this.drops) {
      const p = toFront(d.x, d.gy);
      if (!p) continue;
      const shift = p[1] - d.gy;
      d.x = p[0];
      d.gy += shift;
      d.y += shift;
    }
    for (let i = 0; i < 4; i++) {
      const a = rand(0, Math.PI * 2);
      const px = x + Math.cos(a) * rf;
      const py = y + (Math.sin(a) * rf) / 2;
      if (px > GROUND_L + 2 && px < GROUND_R - 2) this.addRipple(px, py, rand(4, 8), 1, 0.7);
    }
  }

  // Puddles swell in storms and shrink in the sun.
  puddleSize(p) {
    const k = 0.4 + 0.6 * this.sky.p.wet;
    return { rx: Math.max(3, Math.round(p.rx * k)), ry: Math.max(2, Math.round(p.ry * k)) };
  }

  inPuddle(x, y) {
    return this.puddles.some((p) => {
      const { rx, ry } = this.puddleSize(p);
      return ((x - p.x) / rx) ** 2 + ((y - p.y) / ry) ** 2 <= 1;
    });
  }

  // Standing water or mud (they slow you down on Hard).
  isWet(x, y) {
    return this.inPuddle(x, y) || this.decor.inMud(x, y);
  }

  update(dt) {
    this.t += dt;
    const sc = this.speed * dt;
    this.scrollY += sc;

    for (const z of this.zones) if (z.b !== Infinity) z.b += sc;
    while (this.zones.length > 1 && this.zones[this.zones.length - 2].b > PF_H + 20) {
      this.zones.pop();
      this.zones[this.zones.length - 1].b = Infinity;
    }

    const sky = this.sky;
    sky.update(dt);
    // Drops drift with the wind; spawn them upwind so the edges stay covered.
    const drift = sky.wind * 0.9;
    const spread = Math.min(60, Math.abs(drift) * 0.6);

    this.rainAcc += this.rainRate * sky.p.rain * dt;
    while (this.rainAcc >= 1) {
      this.rainAcc -= 1;
      if (this.drops.length < MAX_DROPS) {
        // Two depths: far drops are short, dim and slow; near ones long and bright.
        const far = Math.random() < 0.45;
        const gy = rand(-10, PF_H + 10);
        this.drops.push({
          x: rand(-spread, PF_W + spread),
          gy,
          y: gy - rand(40, 170),
          speed: far ? rand(130, 170) : rand(190, 250),
          len: far ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 3),
          far,
        });
      }
    }

    const drops = this.drops;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.speed * dt + sc;
      d.gy += sc;
      d.x += drift * dt;
      if (d.y >= d.gy) {
        this.land(Math.round(d.x), d.gy, d.far);
        drops[i] = drops[drops.length - 1];
        drops.pop();
      }
    }

    if (!this.lowFx) this.updateDrips(dt, sc, sky.p.rain > 0.2);

    const rip = this.ripples;
    for (let i = rip.length - 1; i >= 0; i--) {
      const r = rip[i];
      r.age += dt;
      r.y += sc;
      if (r.age > r.life + (r.rings - 1) * RING_LAG || r.y - r.maxR > PF_H + 8) rip.splice(i, 1);
    }

    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      p.vy += (p.float ? 60 : 260) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt + sc;
      if (p.age > p.life) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
      }
    }

    for (const p of this.puddles) {
      p.y += sc;
      if (p.y - p.ry > PF_H) Object.assign(p, this.newPuddle(-rand(10, 120)));
    }

    this.decor?.update(dt, sc);
    this.animals?.update(dt, sc);
  }

  // Water runs off the canopy edges and drips to the ground.
  updateDrips(dt, sc, raining) {
    for (const u of this.umbrellas) {
      if (u.open < 0.8 || !raining) continue;
      u.dripT = (u.dripT ?? rand(0, 0.6)) - dt;
      if (u.dripT > 0) continue;
      u.dripT = rand(0.3, 0.8);
      const { R } = canopyGeom(u.r, u.open, u.style);
      const side = Math.random() < 0.5 ? -1 : 1;
      const y = u.y + (u.bobY || 0) + 1;
      this.drips.push({ x: u.x + side * R * rand(0.8, 0.98), y, gy: u.groundY ?? u.y + u.r * 0.95, vy: 10 });
    }
    const ds = this.drips;
    for (let i = ds.length - 1; i >= 0; i--) {
      const d = ds[i];
      d.vy += 320 * dt;
      d.y += d.vy * dt + sc;
      d.gy += sc;
      if (d.y >= d.gy) {
        if (d.x > GROUND_L + 1 && d.x < GROUND_R - 1) this.addRipple(d.x, d.gy, rand(3, 6), 1, 0.7);
        ds[i] = ds[ds.length - 1];
        ds.pop();
      }
    }
  }

  land(x, y, far = false) {
    for (const dm of this.domes) {
      if (Math.hypot(x - dm.x, (y - dm.y) * 2) < dm.r) {
        this.splash(x, y, 2, PAL.splash, true, 50);
        return;
      }
    }
    // Bridges, branches and tree crowns keep the street under them dry.
    if (this.decor.shelters(x, y)) {
      if (!far) this.splash(x, y, 1, PAL.splash, true, 30);
      return;
    }
    for (const u of this.umbrellas) {
      if (canopyContains(u, x, y)) {
        this.splash(x, y, 2, PAL.splash, true, 40);
        return;
      }
    }
    if (x <= GROUND_L + 1 || x >= GROUND_R - 1) return;
    const wet = this.inPuddle(x, y);
    if (far) {
      if (Math.random() < (wet ? 0.6 : 0.25)) this.addRipple(x, y, rand(3, 7), 1, rand(0.7, 1));
      return;
    }
    if (Math.random() < (wet ? 0.9 : 0.45)) {
      const rings = wet ? (Math.random() < 0.35 ? 3 : 2) : Math.random() < 0.45 ? 2 : 1;
      this.addRipple(x, y, wet ? rand(10, 20) : rand(6, 13), rings, rand(1.0, 1.6));
    }
    // A tiny crown: drops thrown left, up and right.
    if (!this.lowFx || Math.random() < 0.5) {
      for (const vx of [-26, 0, 26]) {
        this.particles.push({ x, y, vx: vx + rand(-6, 6), vy: vx ? -rand(35, 50) : -rand(50, 65), age: 0, life: rand(0.14, 0.2), color: PAL.rainTip, top: false });
      }
    }
  }

  // Street surface for every visible zone, then puddles, ground details and crosswalks.
  drawGround(ctx) {
    for (let i = 0; i < this.zones.length; i++) {
      const top = Math.max(0, i === 0 ? 0 : this.sy(this.zones[i - 1].b));
      const bottom = Math.min(PF_H, this.zones[i].b === Infinity ? PF_H : this.sy(this.zones[i].b));
      if (bottom <= top) continue;
      const loc = LOCATIONS[this.zones[i].loc];
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, top, PF_W, bottom - top);
      ctx.clip();
      ctx.fillStyle = loc.ground;
      ctx.fillRect(0, top, PF_W, bottom - top);
      this.drawPattern(ctx, loc, top, bottom);
      drawWalls(ctx, this.viewY, loc.wall, top, bottom);
      ctx.restore();
    }
    this.drawPuddles(ctx);
    this.decor.drawFloor(ctx);
    for (let i = 0; i < this.zones.length - 1; i++) this.drawCrosswalk(ctx, this.sy(this.zones[i].b));
  }

  // Puddles mirror the umbrellas walking past them: the puddles are drawn
  // into an offscreen layer, reflections composited only onto puddle pixels.
  drawPuddles(ctx) {
    let target = ctx;
    if (!this.lowFx) {
      if (!this.refl) {
        this.refl = document.createElement('canvas');
        this.refl.width = PF_W;
        this.refl.height = PF_H;
      }
      target = this.refl.getContext('2d');
      target.globalCompositeOperation = 'source-over';
      target.globalAlpha = 1;
      target.clearRect(0, 0, PF_W, PF_H);
    }
    for (const p of this.puddles) {
      const { rx, ry } = this.puddleSize(p);
      target.drawImage(ellipseSprite(rx, ry, this.locAt(p.y).puddle, true), Math.round(p.x) - rx, this.sy(p.y) - ry);
    }
    if (!this.lowFx) {
      target.globalCompositeOperation = 'source-atop';
      target.globalAlpha = 0.35;
      for (const u of this.umbrellas) drawReflection(target, u, u.rides ? this.sy : Math.round);
      ctx.drawImage(this.refl, 0, 0);
    }
    // A glint along the far edge of each puddle.
    for (const p of this.puddles) {
      const { rx, ry } = this.puddleSize(p);
      const ring = ellipseSprite(rx, ry, this.locAt(p.y).ripple[2], false);
      const h = Math.ceil(ry * 0.6);
      ctx.drawImage(ring, 0, 0, ring.width, h, Math.round(p.x) - rx, this.sy(p.y) - ry, ring.width, h);
    }
  }

  // Night lighting, drawn after the scene is tinted: lamp pools, fireflies,
  // and a lift on `glow` (the player) so it never sinks into the dark.
  drawLights(ctx, glow) {
    const night = this.sky.night;
    if (night < 0.05) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.decor.lampHeads()) {
      ctx.globalAlpha = night * 0.8;
      const pool = (rx, ry) => ctx.drawImage(ellipseSprite(rx, ry, '#30230f', true), Math.round(l.poolX) - rx, this.sy(l.groundY) - ry);
      pool(24, 10);
      pool(15, 6);
      pool(7, 3);
      ctx.drawImage(ellipseSprite(5, 3, '#6a5220', true), Math.round(l.x) - 5, this.sy(l.y) - 3);
      ctx.fillStyle = '#ffe9a0';
      ctx.fillRect(Math.round(l.x) - 1, this.sy(l.y), 3, 1);
    }
    // Bunting bulbs.
    for (const b of this.decor.bulbs()) {
      const y = this.sy(b.y);
      ctx.globalAlpha = night;
      ctx.drawImage(ellipseSprite(3, 2, '#5a4418', true), b.x - 3, y - 2);
      ctx.fillStyle = '#fff2c0';
      ctx.fillRect(b.x, y, 1, 1);
    }
    // Fireflies, mostly in the park and the forest.
    ctx.fillStyle = '#e8ff8a';
    for (let i = 0; i < 12; i++) {
      const y = ((i * 71 + (this.scrollY + this.lead) * 0.6 + Math.cos(this.t * 0.5 + i * 2) * 10) % (PF_H + 20)) - 10;
      const where = this.locAt(y).key;
      if (i >= 4 && where !== 'park' && where !== 'forest') continue;
      if (Math.sin(this.t * 2.5 + i * 1.7) < 0.2) continue;
      const x = GROUND_L + ((i * 53 + Math.sin(this.t * 0.7 + i) * 18 + 400) % (GROUND_R - GROUND_L));
      ctx.globalAlpha = night * 0.8;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      ctx.globalAlpha = night * 0.3;
      ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (glow) {
      ctx.globalAlpha = night * 0.55;
      drawUmbrella(ctx, glow);
    }
    ctx.globalAlpha = 1;
  }

  drawPattern(ctx, loc, top, bottom) {
    if (loc.pattern === 'none') return;
    ctx.fillStyle = loc.line;
    const s = this.viewY;
    if (loc.pattern === 'tiles') {
      for (let y = (s % 16) - 16; y < bottom; y += 16) ctx.fillRect(GROUND_L, y, GROUND_R - GROUND_L, 1);
      for (let x = GROUND_L + 26; x < GROUND_R; x += 26) ctx.fillRect(x, top, 1, bottom - top);
    } else if (loc.pattern === 'planks') {
      for (let y = (s % 7) - 7, row = Math.floor(s / 7); y < bottom; y += 7, row--) {
        ctx.fillRect(GROUND_L, y, GROUND_R - GROUND_L, 1);
        // Staggered butt joints between boards.
        const off = ((row % 3) + 3) % 3;
        for (let x = GROUND_L + 14 + off * 17; x < GROUND_R; x += 51) ctx.fillRect(x, y, 1, 7);
      }
    }
  }

  drawCrosswalk(ctx, y) {
    if (y < -8 || y > PF_H + 8) return;
    ctx.fillStyle = '#d4e2ea';
    for (let x = GROUND_L + 4; x < GROUND_R - 6; x += 10) ctx.fillRect(x, y - 6, 6, 12);
    ctx.fillStyle = 'rgba(20, 50, 70, 0.35)';
    for (let x = GROUND_L + 4; x < GROUND_R - 6; x += 10) ctx.fillRect(x + 2, y - 3 + ((x / 10) % 3), 1, 1);
  }

  drawRipples(ctx) {
    for (const r of this.ripples) {
      const pal = this.locAt(r.y).ripple;
      for (let i = 0; i < r.rings; i++) {
        const t = (r.age - i * RING_LAG) / r.life;
        if (t <= 0 || t >= 1) continue;
        const e = 1 - (1 - t) * (1 - t);
        const rx = Math.max(1, Math.round(1 + (r.maxR - 1) * e));
        const ry = Math.max(1, Math.round(rx * 0.45));
        const color = t < 0.4 ? pal[0] : t < 0.75 ? pal[1] : pal[2];
        ctx.drawImage(ellipseSprite(rx, ry, color, false), Math.round(r.x) - rx, this.sy(r.y) - ry);
        if (i === 0 && t < 0.25) {
          ctx.fillStyle = pal[0];
          ctx.fillRect(Math.round(r.x) - 1, this.sy(r.y), 3, 1);
        }
      }
    }
  }

  // Ground splashes go under umbrellas, canopy splashes on top of them.
  drawParticles(ctx, top) {
    for (const p of this.particles) {
      if (p.top !== top) continue;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), this.sy(p.y), 1, 1);
    }
    if (top) {
      ctx.fillStyle = PAL.rainTip;
      for (const d of this.drips) ctx.fillRect(Math.round(d.x), this.sy(d.y), 1, 2);
    }
  }

  // Streaks lean with the wind (that's also how a gust shows itself).
  drawRain(ctx) {
    const drift = this.sky.wind * 0.9;
    const streak = (d, from, to) => {
      const slope = drift / d.speed;
      if (Math.abs(slope) < 0.08) {
        ctx.fillRect(Math.round(d.x), this.sy(d.y) - to, 1, to - from);
        return;
      }
      for (let i = from; i < to; i++) ctx.fillRect(Math.round(d.x - slope * i), this.sy(d.y) - i - 1, 1, 1);
    };
    ctx.fillStyle = PAL.rainFar;
    for (const d of this.drops) if (d.y >= 0 && d.far) streak(d, 0, d.len);
    ctx.fillStyle = PAL.rain;
    for (const d of this.drops) if (d.y >= 0 && !d.far) streak(d, 1, d.len);
    ctx.fillStyle = PAL.rainTip;
    for (const d of this.drops) if (d.y >= 0 && !d.far) ctx.fillRect(Math.round(d.x), this.sy(d.y) - 1, 1, 1);
  }
}
