import { PixBuf, ellipseSprite } from '../render/pixels.js';
import { rand, pick, choice, clamp } from '../core/math.js';
import { PF_H, GROUND_L, GROUND_R } from '../config.js';

// Things in the way: objects standing on the street (planters, benches, logs,
// snowbanks...) and outcrops where the wall juts out and narrows it. They
// scroll with the street, cast shadows, show a small reflector at night and an
// outline in fog, and are placed in patterns that always leave a way through.
// What touching one does is up to the scene (see PlayScene.hitObstacle).

// ---- Tuning -----------------------------------------------------------------

export const OBSTACLES = {
  minGap: 110, // px of street between patterns, at the very least
  spread: 300, // extra px between patterns when density is low
  minOpening: 70, // px: the narrowest way through any pattern (about 2.4 umbrellas)
  playerScale: 0.8, // how much of the umbrella's footprint counts for obstacles
};

// ---- Sprites ----------------------------------------------------------------

// shape: block (a box seen from above and in front), round (a mound), log
// (lying across), posts (a row of short posts). c: [outline, side, top,
// accent]. deco adds the details. lamp: a warning light that glows at night.
const KINDS = {
  planter: { shape: 'block', w: 20, h: 13, top: 6, c: ['#2e3640', '#8c949c', '#b8bfc6', '#3f9a4a'], deco: 'flowers' },
  barrier: { shape: 'block', w: 26, h: 10, top: 3, c: ['#2e3640', '#e05a4a', '#f4f0e8', '#f4f0e8'], deco: 'stripes', lamp: true },
  bollards: { shape: 'posts', w: 28, h: 9, c: ['#20283a', '#4a5664', '#8a97a6', '#f2d04a'] },
  bench: { shape: 'block', w: 24, h: 9, top: 5, c: ['#3a2a1a', '#7a4e22', '#a8743a', '#5a3a1a'], deco: 'planks' },
  flowerbed: { shape: 'round', w: 24, h: 13, c: ['#1d4a26', '#2c7438', '#4fa04a', '#f4a6c6'], deco: 'flowers' },
  fountain: { shape: 'round', w: 32, h: 16, c: ['#2e3640', '#8c949c', '#b8bfc6', '#4ab8e0'], deco: 'water' },
  log: { shape: 'log', w: 36, h: 9, c: ['#2a1c10', '#6a4e30', '#8a6a44', '#c8a070'] },
  boulder: { shape: 'round', w: 18, h: 13, c: ['#262c2c', '#6a7272', '#9aa2a2', '#4a8a4a'], deco: 'moss' },
  snowbank: { shape: 'round', w: 30, h: 11, c: ['#6a88a0', '#c4dcea', '#f4fbff', '#ffffff'] },
  sled: { shape: 'block', w: 18, h: 8, top: 4, c: ['#3a1a1a', '#b02a2a', '#e05a4a', '#7a1a1a'], deco: 'planks' },
  crates: { shape: 'block', w: 20, h: 16, top: 6, c: ['#3a2a14', '#8a6a3a', '#b08a52', '#5a4228'], deco: 'x' },
  barrel: { shape: 'round', w: 14, h: 14, c: ['#2a1c10', '#7a5434', '#a07448', '#3a3a44'], deco: 'hoops' },
  sandcastle: { shape: 'block', w: 18, h: 13, top: 5, c: ['#7a6040', '#c8a46a', '#e0c48a', '#e05a4a'], deco: 'towers' },
  deckchair: { shape: 'block', w: 14, h: 10, top: 6, c: ['#2e3640', '#3fa6ef', '#f4f0e8', '#3fa6ef'], deco: 'stripes' },
  rock: { shape: 'round', w: 22, h: 14, c: ['#4a2e1a', '#a0704a', '#c8946a', '#8a5a3a'] },
  cactusclump: { shape: 'round', w: 18, h: 14, c: ['#1e4a28', '#3a8a46', '#5ab060', '#f4a6c6'], deco: 'spines' },
  cart: { shape: 'block', w: 24, h: 13, top: 6, c: ['#3a2a14', '#8a6a3a', '#b08a52', '#262a30'], deco: 'wheels' },
};

// Wall outcrops, per place: [width into the street, height, colors, deco].
const OUTCROPS = {
  town: [30, 30, ['#3c4752', '#8c949c', '#b8bfc6', '#6b747d'], 'bricks'],
  park: [26, 26, ['#1d4a26', '#3a8644', '#5aa84f', '#f4a6c6'], 'leafy'],
  forest: [30, 30, ['#0f2a1c', '#24563a', '#3a7a4a', '#4a3a28'], 'leafy'],
  snow: [28, 22, ['#5a4228', '#6a4e30', '#f4fbff', '#a8d4ec'], 'fence'],
  harbor: [26, 26, ['#3a2a14', '#8a6a3a', '#b08a52', '#5a4228'], 'x'],
  beach: [30, 24, ['#9a7c4a', '#d4b67a', '#ecd49e', '#7a9a4a'], 'leafy'],
  desert: [28, 30, ['#5a3a22', '#c88a5a', '#e0a878', '#5a3a22'], 'beams'],
  market: [34, 22, ['#4a4258', '#f3e8da', '#e05a6a', '#4a4258'], 'awning'],
};

const PLACE = {
  town: ['planter', 'barrier', 'bollards'],
  park: ['bench', 'flowerbed', 'fountain'],
  forest: ['log', 'boulder', 'log'],
  snow: ['snowbank', 'sled', 'snowbank'],
  harbor: ['crates', 'barrel', 'bollards'],
  beach: ['sandcastle', 'deckchair'],
  desert: ['rock', 'cactusclump', 'cart'],
  market: ['crates', 'barrel', 'cart'],
};

// Palette slots: 1 outline, 2 side, 3 top, 4 accent, 5 white glint.
function paint(spec, w, h) {
  const b = new PixBuf(w + 2, h + 2);
  const [W, H] = [w, h];
  const X = (x) => x + 1;
  const Y = (y) => y + 1;
  if (spec.shape === 'block') {
    const top = spec.top;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b.set(X(x), Y(y), y < top ? 3 : 2);
    for (let x = 0; x < W; x++) b.set(X(x), Y(top), 1); // the edge between top and side
    decorate(b, spec.deco, W, H, top, X, Y);
  } else if (spec.shape === 'round') {
    b.fillEllipse(X(W / 2), Y(H / 2), W / 2, H / 2, 2);
    b.fillEllipse(X(W / 2 - W * 0.08), Y(H / 2 - H * 0.16), W * 0.36, H * 0.3, 3);
    decorate(b, spec.deco, W, H, 0, X, Y);
  } else if (spec.shape === 'log') {
    for (let y = 1; y < H; y++) for (let x = 0; x < W - 3; x++) b.set(X(x), Y(y), y < 3 ? 3 : 2);
    b.fillEllipse(X(W - 4), Y(H / 2 + 0.5), 3.5, H / 2, 4);
    b.fillEllipse(X(W - 4), Y(H / 2 + 0.5), 1.5, H / 4, 2);
    for (let x = 4; x < W - 6; x += 7) b.set(X(x), Y(H - 3), 1);
  } else if (spec.shape === 'posts') {
    for (let i = 0; i < 3; i++) {
      const x0 = Math.round(i * (W - 4) / 2);
      for (let y = 1; y < H; y++) for (let x = x0; x < x0 + 4; x++) b.set(X(x), Y(y), y < 3 ? 3 : 2);
      b.set(X(x0 + 1), Y(4), 4);
      b.set(X(x0 + 2), Y(4), 4);
    }
  }
  b.outline(1);
  return b;
}

function decorate(b, deco, W, H, top, X, Y) {
  const on = (x, y) => b.get(X(x), Y(y)) > 1;
  if (deco === 'flowers') {
    for (let i = 0; i < (W * H) / 14; i++) {
      const x = Math.floor(rand(1, W - 1));
      const y = Math.floor(rand(1, Math.max(2, top || H * 0.6)));
      if (on(x, y)) b.set(X(x), Y(y), Math.random() < 0.7 ? 4 : 5);
    }
  } else if (deco === 'stripes') {
    for (let x = 0; x < W; x++) if (Math.floor(x / 3) % 2) for (let y = top + 1; y < H; y++) b.set(X(x), Y(y), 4);
  } else if (deco === 'planks') {
    for (let y = 1; y < top; y += 2) for (let x = 1; x < W - 1; x++) b.set(X(x), Y(y), 4);
    b.set(X(2), Y(H - 1), 1);
    b.set(X(W - 3), Y(H - 1), 1);
  } else if (deco === 'x') {
    for (let i = 0; i < W - 4; i++) {
      const y = top + 1 + Math.round((i / (W - 5)) * (H - top - 3));
      b.set(X(2 + i), Y(y), 4);
      b.set(X(W - 3 - i), Y(y), 4);
    }
  } else if (deco === 'towers') {
    for (let x = 1; x < W - 1; x += 4) b.set(X(x), Y(0), 1);
    b.set(X(W - 4), Y(1), 4);
  } else if (deco === 'wheels') {
    for (const cx of [4, W - 5]) b.fillEllipse(X(cx), Y(H - 2), 2.5, 2.5, 4);
  } else if (deco === 'water') {
    b.fillEllipse(X(W / 2), Y(H / 2 - 1), W * 0.32, H * 0.26, 4);
    b.set(X(W / 2 - 2), Y(H / 2 - 2), 5);
    b.set(X(W / 2 + 3), Y(H / 2 - 1), 5);
  } else if (deco === 'moss' || deco === 'leafy') {
    for (let i = 0; i < (W * H) / 20; i++) {
      const x = Math.floor(rand(1, W - 1));
      const y = Math.floor(rand(1, H * 0.5));
      if (on(x, y)) b.set(X(x), Y(y), 4);
    }
  } else if (deco === 'spines') {
    for (let i = 0; i < (W * H) / 12; i++) {
      const x = Math.floor(rand(1, W - 1));
      const y = Math.floor(rand(1, H - 1));
      if (on(x, y)) b.set(X(x), Y(y), 5);
    }
    b.set(X(W / 2), Y(1), 4);
  } else if (deco === 'hoops') {
    for (const y of [Math.round(H * 0.3), Math.round(H * 0.7)]) for (let x = 0; x < W; x++) if (on(x, y)) b.set(X(x), Y(y), 4);
  } else if (deco === 'bricks') {
    for (let y = top + 3; y < H; y += 4) for (let x = 0; x < W; x++) b.set(X(x), Y(y), 4);
  } else if (deco === 'fence') {
    for (let x = 0; x < W; x++) {
      b.set(X(x), Y(top + 2), 1);
      b.set(X(x), Y(top + 6), 1);
    }
    for (let x = 1; x < W; x += 6) b.set(X(x), Y(top + 1), 4);
  } else if (deco === 'awning') {
    for (let x = 0; x < W; x++) if (Math.floor(x / 3) % 2) for (let y = 0; y < top; y++) b.set(X(x), Y(y), 4);
  } else if (deco === 'beams') {
    for (let y = top + 3; y < H; y += 8) for (const x of [2, W - 4]) {
      b.set(X(x), Y(y), 4);
      b.set(X(x + 1), Y(y), 4);
    }
  }
}

// A baked obstacle: the sprite, its mirror, and a pale outline for fog.
function bake(spec, w, h) {
  const b = paint(spec, w, h);
  const colors = [null, spec.c[0], spec.c[1], spec.c[2], spec.c[3], '#ffffff'];
  const cv = b.toCanvas(colors);
  const flip = document.createElement('canvas');
  flip.width = cv.width;
  flip.height = cv.height;
  const fc = flip.getContext('2d');
  fc.scale(-1, 1);
  fc.drawImage(cv, -cv.width, 0);
  const edge = new PixBuf(b.w, b.h);
  for (let i = 0; i < b.d.length; i++) if (b.d[i] === 1) edge.d[i] = 1;
  return { cv, flip, edge: edge.toCanvas([null, '#d8eef8']), w, h };
}

const cache = new Map();
function sprite(key, make) {
  let list = cache.get(key);
  if (!list) cache.set(key, (list = []));
  if (list.length < 3) list.push(make());
  return choice(list);
}

// ---- Placement & queries ----------------------------------------------------

export class Obstacles {
  constructor(world) {
    this.world = world;
    this.list = [];
    this.density = 0; // set by the scene each frame: 0 none, 1 busiest
    this.gap = 200;
  }

  // One obstacle: x centre, y ground line (bottom of the sprite).
  add(kind, x, y, place) {
    const spec = KINDS[kind];
    const art = sprite(kind, () => bake(spec, spec.w, spec.h));
    this.list.push({ kind, x, y, w: spec.w, h: spec.h, art, flip: false, lamp: spec.lamp, place });
  }

  // A piece of wall jutting out from one side.
  outcrop(side, y, place) {
    const [w, h, c, deco] = OUTCROPS[place] ?? OUTCROPS.town;
    const spec = { shape: 'block', top: Math.round(h * 0.4), c, deco };
    const art = sprite(`wall-${place}`, () => bake(spec, w, h));
    const x = side ? GROUND_R - w / 2 + 2 : GROUND_L + w / 2 - 2;
    this.list.push({ kind: 'outcrop', x, y, w, h, art, flip: side === 1, wall: true, place });
  }

  // Picks a pattern for the place at the top of the street. Busier streets get
  // more of the harder ones (chicanes, narrowings).
  spawn(place, density) {
    const kinds = PLACE[place] ?? PLACE.town;
    const k = () => choice(kinds);
    const y = -24;
    const pattern = pick({ single: 4, pair: 1 + density * 2, chicane: density * 3, narrow: 1 + density * 2 });
    const width = GROUND_R - GROUND_L;
    // Two pieces side by side must leave the opening; a chicane's pieces are
    // offset so each leaves the other side open.
    if (pattern === 'single') {
      this.add(k(), rand(GROUND_L + 20, GROUND_R - 20), y, place);
      this.clampLast();
    } else if (pattern === 'pair') {
      // One by each wall, a clear way through the middle.
      const a = k();
      const b = k();
      if (KINDS[a].w + KINDS[b].w + OBSTACLES.minOpening > width - 8) {
        this.add(a, rand(GROUND_L + 20, GROUND_R - 20), y, place);
        return this.clampLast();
      }
      this.add(a, GROUND_L + KINDS[a].w / 2 + rand(2, 10), y, place);
      this.add(b, GROUND_R - KINDS[b].w / 2 - rand(2, 10), y - rand(0, 8), place);
    } else if (pattern === 'chicane') {
      // Left, then right a little further on (or the other way round).
      const left = Math.random() < 0.5;
      const a = k();
      const b = k();
      this.add(a, left ? GROUND_L + KINDS[a].w / 2 + 14 : GROUND_R - KINDS[a].w / 2 - 14, y, place);
      this.add(b, left ? GROUND_R - KINDS[b].w / 2 - 14 : GROUND_L + KINDS[b].w / 2 + 14, y - 74, place);
    } else {
      // The wall closes in from one side, or both.
      const both = Math.random() < 0.4;
      const side = Math.random() < 0.5 ? 0 : 1;
      this.outcrop(side, y, place);
      if (both) this.outcrop(1 - side, y - rand(0, 30), place);
    }
  }

  // Keeps a lone obstacle inside the street.
  clampLast() {
    const o = this.list[this.list.length - 1];
    o.x = clamp(o.x, GROUND_L + o.w / 2 + 2, GROUND_R - o.w / 2 - 2);
  }

  update(sc) {
    for (const o of this.list) o.y += sc;
    this.list = this.list.filter((o) => o.y - o.h < PF_H + 10);
    if (this.density <= 0) return;
    this.gap -= sc;
    if (this.gap <= 0) {
      this.spawn(this.world.locAt(-30).key, this.density);
      this.gap = OBSTACLES.minGap + 80 + rand(0, OBSTACLES.spread) * (1.15 - this.density);
    }
  }

  // The street the obstacle takes up, as a rectangle on the ground.
  box(o) {
    return { x0: o.x - o.w / 2 + 1, x1: o.x + o.w / 2 - 1, y0: o.y - o.h * 0.8, y1: o.y };
  }

  // The ellipse of an umbrella's footprint that obstacles care about.
  foot(u) {
    const s = OBSTACLES.playerScale;
    return { x: u.x, y: u.y + 4, rx: u.r * 0.62 * (0.55 + 0.45 * u.open) * s, ry: u.r * 0.4 * s };
  }

  // The obstacle an umbrella is touching, if any.
  touching(u) {
    const f = this.foot(u);
    for (const o of this.list) {
      if (o.ghost === u) continue;
      const b = this.box(o);
      const nx = clamp(f.x, b.x0, b.x1);
      const ny = clamp(f.y, b.y0, b.y1);
      if (((nx - f.x) / f.rx) ** 2 + ((ny - f.y) / f.ry) ** 2 < 1) return o;
    }
    return null;
  }

  // Solid obstacles (Zen): slide the umbrella out the shortest way. If the
  // street would push it off the bottom, let it drift through instead.
  pushOut(u, o) {
    const f = this.foot(u);
    const b = this.box(o);
    const right = b.x1 + f.rx - f.x;
    const left = f.x - (b.x0 - f.rx);
    const down = b.y1 + f.ry - f.y;
    const m = Math.min(right, left, down);
    if (m === down) u.y += down;
    else if (m === right) u.x += right;
    else u.x -= left;
    if (u.y > PF_H - 20) o.ghost = u;
  }

  // Walkers step around anything coming up in front of them.
  steer(npcs, dt) {
    for (const n of npcs) {
      for (const o of this.list) {
        const below = o.y - n.y;
        if (below < -6 || below > 60) continue;
        const dx = n.x - o.x;
        if (Math.abs(dx) > o.w / 2 + n.r * 0.7) continue;
        let dir = Math.sign(dx) || 1;
        if (o.wall) dir = o.x < (GROUND_L + GROUND_R) / 2 ? 1 : -1;
        n.baseX += dir * 70 * dt;
      }
    }
  }

  // How much room an obstacle near the top leaves around x (for spawning walkers).
  roomAt(x) {
    let room = Infinity;
    for (const o of this.list) {
      if (o.y > 90) continue;
      room = Math.min(room, Math.max(0, Math.abs(x - o.x) - o.w / 2));
    }
    return room;
  }

  // ---- drawing --------------------------------------------------------------

  drawShadows(ctx) {
    const sy = this.world.sy;
    for (const o of this.list) {
      const rx = Math.round(o.w / 2);
      ctx.drawImage(ellipseSprite(rx, 3, this.world.locAt(o.y).shadow, true), Math.round(o.x) - rx + 2, sy(o.y) - 3);
    }
  }

  drawOne(ctx, o) {
    const cv = o.flip ? o.art.flip : o.art.cv;
    ctx.drawImage(cv, Math.round(o.x - cv.width / 2), this.world.sy(o.y) - cv.height + 1);
  }

  // In haze, a pale outline keeps them readable through the fog.
  drawOutlines(ctx, fog) {
    if (fog < 0.05) return;
    ctx.globalAlpha = Math.min(0.8, fog * 0.8);
    for (const o of this.list) {
      const cv = o.art.edge;
      const x = Math.round(o.x - cv.width / 2);
      const y = this.world.sy(o.y) - cv.height + 1;
      if (o.flip) {
        ctx.save();
        ctx.translate(x + cv.width, y);
        ctx.scale(-1, 1);
        ctx.drawImage(cv, 0, 0);
        ctx.restore();
      } else ctx.drawImage(cv, x, y);
    }
    ctx.globalAlpha = 1;
  }

  // Reflectors (and the barrier's lamp) for the night lights.
  lights() {
    return this.list.map((o) => ({ x: o.x, y: o.y - o.h + 1, lamp: o.lamp }));
  }
}
