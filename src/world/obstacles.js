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
  minGapTime: 1.1, // ... and seconds between them at the current pace (fast streets)
  spread: 300, // extra px between patterns when density is low
  minOpening: 70, // px: the narrowest way through any pattern (about 2.4 umbrellas)
  playerScale: 0.8, // how much of the umbrella's footprint counts for obstacles
  fieldPush: 180, // px/s the force field gives a 'slide' obstacle of mass 1 at point blank
};

// ---- Sprites ----------------------------------------------------------------

// shape: block (a box seen from above and in front), round (a mound), log
// (lying across), posts (a row of short posts). c: [outline, side, top,
// accent]. deco adds the details. lamp: a warning light that glows at night.
// What the force field does to each: 'slide' (pushed away, heavier ones
// less: `mass`), 'scatter' (blown apart), or 'fixed' (it only shudders).
// Outlines are always a darker shade of the object's own colour.
const KINDS = {
  planter: { shape: 'block', w: 20, h: 13, top: 6, c: ['#4a3428', '#a8806a', '#4f8a3e', '#f4a6c6'], deco: 'flowers', move: 'fixed' },
  barrier: { shape: 'block', w: 26, h: 10, top: 3, c: ['#6a1a1a', '#e05a4a', '#f4f0e8', '#f4f0e8'], deco: 'stripes', lamp: true, move: 'slide', mass: 2 },
  bollards: { shape: 'posts', w: 28, h: 9, c: ['#1e3a48', '#4a7a8c', '#8ab8c8', '#f2d04a'], move: 'fixed' },
  bench: { shape: 'block', w: 24, h: 9, top: 5, c: ['#4a2e14', '#7a4e22', '#a8743a', '#5a3a1a'], deco: 'planks', move: 'fixed' },
  flowerbed: { shape: 'round', w: 24, h: 13, c: ['#1d4a26', '#2c7438', '#4fa04a', '#f4a6c6'], deco: 'flowers', move: 'fixed' },
  fountain: { shape: 'round', w: 32, h: 16, c: ['#2e4c5a', '#8aa8b4', '#b8d0d8', '#4ab8e0'], deco: 'water', move: 'fixed' },
  log: { shape: 'log', w: 36, h: 9, c: ['#3a2414', '#6a4e30', '#8a6a44', '#c8a070'], move: 'slide', mass: 5 },
  boulder: { shape: 'round', w: 18, h: 13, c: ['#2e4034', '#6a8072', '#9ab0a0', '#4a8a4a'], deco: 'moss', move: 'fixed' },
  snowbank: { shape: 'round', w: 30, h: 11, c: ['#6a88a0', '#c4dcea', '#f4fbff', '#ffffff'], move: 'fixed' },
  snowpile: { shape: 'round', w: 18, h: 9, c: ['#7898b0', '#d0e4ee', '#f4fbff', '#ffffff'], move: 'scatter' },
  snowpine: { shape: 'pine', w: 16, h: 20, c: ['#163a20', '#2c703c', '#f4fbff', '#5a4228'], move: 'fixed' },
  crates: { shape: 'block', w: 20, h: 16, top: 6, c: ['#4a3018', '#8a6a3a', '#b08a52', '#5a4228'], deco: 'x', move: 'slide', mass: 2 },
  barrel: { shape: 'round', w: 14, h: 14, c: ['#3a2414', '#7a5434', '#a07448', '#4a3424'], deco: 'hoops', move: 'slide', mass: 1 },
  sandcastle: { shape: 'block', w: 18, h: 13, top: 5, c: ['#7a6040', '#c8a46a', '#e0c48a', '#e05a4a'], deco: 'towers', move: 'scatter' },
  deckchair: { shape: 'block', w: 14, h: 10, top: 6, c: ['#1a4a7a', '#3fa6ef', '#f4f0e8', '#3fa6ef'], deco: 'stripes', move: 'slide', mass: 1 },
  rock: { shape: 'round', w: 22, h: 14, c: ['#4a2e1a', '#a0704a', '#c8946a', '#8a5a3a'], move: 'fixed' },
  cactusclump: { shape: 'round', w: 18, h: 14, c: ['#1e4a28', '#3a8a46', '#5ab060', '#f4a6c6'], deco: 'spines', move: 'fixed' },
  cart: { shape: 'block', w: 24, h: 13, top: 6, c: ['#4a3018', '#8a6a3a', '#b08a52', '#3a2a20'], deco: 'wheels', move: 'slide', mass: 3 },
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
  snow: ['snowbank', 'snowpile', 'snowpine'],
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
  } else if (spec.shape === 'pine') {
    // A small fir: a trunk and three tiers, snow on the left of each.
    for (let y = H - 4; y < H; y++) for (let x = W / 2 - 1; x < W / 2 + 1; x++) b.set(X(x), Y(y), 4);
    for (let i = 0; i < 3; i++) {
      const y0 = i * (H / 4);
      const half = W / 2 - i * 1.5;
      b.fillPoly([[X(W / 2), Y(y0)], [X(W / 2 + half), Y(y0 + H / 3)], [X(W / 2 - half), Y(y0 + H / 3)]], 2);
      b.fillPoly([[X(W / 2), Y(y0 + 1)], [X(W / 2 - 1), Y(y0 + H / 3 - 1)], [X(W / 2 - half + 1), Y(y0 + H / 3 - 1)]], 3);
    }
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
    this.list.push({ kind, x, y, w: spec.w, h: spec.h, art, flip: false, lamp: spec.lamp, place, move: spec.move, mass: spec.mass ?? 1, colors: spec.c, vx: 0, vy: 0, shake: 0 });
  }

  // A piece of wall jutting out from one side.
  outcrop(side, y, place) {
    const [w, h, c, deco] = OUTCROPS[place] ?? OUTCROPS.town;
    const spec = { shape: 'block', top: Math.round(h * 0.4), c, deco };
    const art = sprite(`wall-${place}`, () => bake(spec, w, h));
    const x = side ? GROUND_R - w / 2 + 2 : GROUND_L + w / 2 - 2;
    this.list.push({ kind: 'outcrop', x, y, w, h, art, flip: side === 1, wall: true, place, move: 'fixed', mass: 1, colors: c, vx: 0, vy: 0, shake: 0 });
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

  update(sc, dt = 1 / 60) {
    for (const o of this.list) {
      o.y += sc + o.vy * dt;
      o.shake = Math.max(0, o.shake - dt);
      if (o.vx || o.vy) this.slide(o, dt);
    }
    this.list = this.list.filter((o) => !o.gone && o.y - o.h < PF_H + 10);
    if (this.density <= 0) return;
    this.gap -= sc;
    if (this.gap <= 0) {
      this.spawn(this.world.locAt(-30).key, this.density);
      const gap = OBSTACLES.minGap + 80 + rand(0, OBSTACLES.spread) * (1.15 - this.density);
      this.gap = Math.max(gap, this.world.speed * OBSTACLES.minGapTime);
    }
  }

  // ---- the force field -----------------------------------------------------

  // A force-field front of radius `rf` sweeping out from wave `w`: light
  // things are shoved away (heavier ones less), crumbly ones are blown apart,
  // and fixed ones just shudder. Each obstacle feels each wave once.
  blast(w, rf) {
    w.hitObstacles ??= new Set();
    for (const o of this.list) {
      if (w.hitObstacles.has(o)) continue;
      const cy = o.y - o.h / 2;
      const dx = o.x - w.x;
      const dy = (cy - w.y) * 2;
      const d = Math.hypot(dx, dy) || 1;
      if (d > rf + o.w / 2) continue;
      w.hitObstacles.add(o);
      const k = Math.max(0.3, 1 - d / (rf + o.w / 2));
      const world = this.world;
      if (o.move === 'slide') {
        const v = (OBSTACLES.fieldPush * k) / o.mass;
        o.vx += (dx / d) * v;
        o.vy += (dy / d) * v * 0.35;
        o.shake = 0.2;
        world.splash(o.x, o.y - 2, 4, o.colors[2], false, 40);
      } else if (o.move === 'scatter') {
        o.gone = true;
        world.burst(o.x, cy, 14, o.colors[2], 70);
        world.burst(o.x, cy, 8, o.colors[1], 50);
        world.addRipple(o.x, o.y - 2, o.w * 0.6, 2, 0.8);
      } else {
        o.shake = 0.35;
        world.splash(o.x, o.y - o.h, 3, o.colors[3], true, 30);
      }
    }
  }

  // A pushed obstacle slides, slowing down, and stops at the walls. If it
  // would close the way past another obstacle in its row, it's steered to
  // the wall instead, so there's always a way through.
  slide(o, dt) {
    const lo = GROUND_L + o.w / 2 + 2;
    const hi = GROUND_R - o.w / 2 - 2;
    o.x += o.vx * dt;
    if (o.x < lo || o.x > hi) {
      o.x = clamp(o.x, lo, hi);
      o.vx = 0;
    }
    const f = Math.exp(-4 * dt);
    o.vx *= f;
    o.vy *= f;
    if (Math.abs(o.vx) < 2 && Math.abs(o.vy) < 2) o.vx = o.vy = 0;
    for (const q of this.list) {
      if (q === o || Math.abs(q.y - o.y) > 16) continue;
      const [a, b] = o.x < q.x ? [o, q] : [q, o];
      const opening = b.x - b.w / 2 - (a.x + a.w / 2);
      if (opening >= 0 && opening < OBSTACLES.minOpening) {
        const toWall = o.x < (GROUND_L + GROUND_R) / 2 ? -1 : 1;
        o.vx = toWall * 60;
      }
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
    const jolt = o.shake > 0 ? (Math.floor(o.shake * 40) % 2 ? 1 : -1) : 0;
    ctx.drawImage(cv, Math.round(o.x - cv.width / 2) + jolt, this.world.sy(o.y) - cv.height + 1);
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
