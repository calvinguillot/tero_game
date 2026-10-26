import { charSprite, swayRows } from '../render/sprites.js';
import { PixBuf, ellipseSprite } from '../render/pixels.js';
import { rand, pick, choice } from '../core/math.js';
import { PF_W, PF_H, GROUND_L, GROUND_R } from '../config.js';

// ---- Sprites ---------------------------------------------------------------

const GREEN = { g: '#3f9a4a', G: '#2c7438', l: '#76cc5e' };

const SIDE = {
  // A round, outlined bush at the foot of the wall.
  bush: {
    colors: { o: '#1d4a26', G: '#2c7438', g: '#3f9a4a', l: '#76cc5e', p: '#f4a6c6' },
    overlap: 3,
    sway: 3,
    rows: [
      '...ooo....',
      '..oglgoo..',
      '.oglllgGo.',
      'oglpllggGo',
      'oggllgggGo',
      'oGggggpgGo',
      'oGGggggGGo',
      '.oGGGGGGo.',
      '..oooooo..',
    ],
  },
  fern: {
    colors: GREEN,
    overlap: 3,
    sway: 4,
    rows: [
      '....l....',
      '.l..g..l.',
      '..l.g.l..',
      'l.lgGgl.l',
      '.lgGGGgl.',
      '..gGGGg..',
      '.lgGGGgl.',
      '..gGGGg..',
      '...GGG...',
    ],
  },
  tuft: { colors: GREEN, overlap: 2, sway: 2, rows: ['l..g..l', '.l.g.l.', 'g.lgl.g', '.gGGGg.', '..GGG..'] },
  pot: {
    colors: { r: '#f05a6a', w: '#ffffff', y: '#ffd94a', g: '#3f9a4a', c: '#c8683a', C: '#94492a' },
    overlap: 0,
    sway: 2,
    rows: ['.r..y...', 'rwr.yy.w', '.rg.yg.w', '..gggg..', '.CCCCCC.', '.cccccc.', '..cccc..', '..CCCC..'],
  },
  crate: {
    colors: { o: '#f08a2a', r: '#e0404a', y: '#f2d04a', b: '#a8743a', B: '#7a4e22' },
    overlap: 0,
    rows: ['..o.r.y...', '.ooorryyy.', 'bbbbbbbbbb', 'bBBBBBBBBb', 'bbbbbbbbbb', 'bBBBBBBBBb', 'bbbbbbbbbb'],
  },
  mushroom: {
    colors: { r: '#d04a3a', R: '#a03428', w: '#f2ead8', s: '#cfc4a8' },
    overlap: -1,
    rows: ['.rrr...', 'rwrrr..', 'rrrwR.r', '.sws.rw', '.ss..s.'],
  },
  log: {
    colors: { b: '#7a5a38', B: '#5a4228', R: '#c8a070', g: '#4f9a4a' },
    overlap: 1,
    rows: ['..g.........', '.bbbbbbbbbbR.', 'bBbbbbBbbbbRR', 'bbbbBbbbbbBRR', '.BBBBBBBBBBR.'],
  },
  // Street lamp: a light pole with a lantern hanging over the pavement.
  lamp: {
    colors: { k: '#8a97a6', K: '#4a5664', h: '#2e3640', G: '#fff2c0' },
    overlap: 1,
    tall: true,
    rows: [
      '.kkkkkk...',
      '.kKkkkkk..',
      '.kK..hhhh.',
      '.kK.hGGGGh',
      '.kK.hGGGGh',
      '.kK..hhhh.',
      ...Array(16).fill('.kK.......'),
      'kkKk......',
      'kKKk......',
    ],
  },
  tree: { tall: true, crown: true, w: 44, h: 30 },
  bigtree: { tall: true, crown: true, w: 76, h: 52 },
};

const FLOOR = {
  drain: {
    colors: { K: '#33505f', k: '#14262f' },
    rows: ['KKKKKKKKKKKK', 'KkKkKkKkKkKK', 'KkKkKkKkKkKK', 'KkKkKkKkKkKK', 'KKKKKKKKKKKK'],
  },
  manhole: {
    colors: { K: '#24404e', k: '#3a5868', M: '#4e7080' },
    rows: [
      '....KKKKKKK....',
      '..KKkMkMkMkKK..',
      '.KkMkMkMkMkMkK.',
      'KkMkMkMkMkMkMkK',
      '.KkMkMkMkMkMkK.',
      '..KKkMkMkMkKK..',
      '....KKKKKKK....',
    ],
  },
};

function sideSprite(kind, frame, flip) {
  const d = SIDE[kind];
  const rows = frame ? swayRows(d.rows, d.sway) : d.rows;
  return charSprite(`side-${kind}-${frame}`, rows, d.colors, flip);
}

// Procedural one-off textures, a few variants each.
const LEAVES = [null, '#2a6a34', '#3a8a44', '#5aae52', '#1d4a26'];
const DARK_LEAVES = [null, '#1f5530', '#2c703c', '#46944a', '#163a20'];

// A leafy crown of overlapping blobs, with highlights and an outline.
function crown(w, h, colors = LEAVES) {
  const b = new PixBuf(w, h);
  const n = Math.round((w * h) / 180);
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const rx = rand(w * 0.16, w * 0.3);
    const ry = rx * rand(0.6, 0.75);
    blobs.push([rand(rx + 1, w - rx - 1), rand(ry + 1, h - ry - 1), rx, ry]);
  }
  blobs.push([w / 2, h / 2, w * 0.36, h * 0.36]);
  for (const [x, y, rx, ry] of blobs) b.fillEllipse(x, y, rx, ry, 2);
  for (const [x, y, rx, ry] of blobs) b.fillEllipse(x - rx * 0.2, y - ry * 0.25, rx * 0.55, ry * 0.55, 3);
  for (let i = 0; i < (w * h) / 25; i++) {
    const x = Math.floor(rand(0, w));
    const y = Math.floor(rand(0, h));
    if (b.get(x, y)) b.set(x, y, Math.random() < 0.6 ? 1 : 3);
  }
  b.outline(4);
  return b.toCanvas(colors);
}

function cobbles() {
  const b = new PixBuf(38, 16);
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 10; col++) {
      const x = col * 4 + (row % 2) * 2;
      const y = row * 3 + 1;
      const dx = (x + 1.5 - 19) / 18;
      const dy = (y + 1 - 8) / 7;
      if (dx * dx + dy * dy > 1 || Math.random() < 0.15) continue;
      const c = Math.random() < 0.5 ? 1 : 2;
      for (let j = 0; j < 3; j++) {
        b.set(x + j, y, c);
        b.set(x + j, y + 1, c);
      }
    }
  }
  return b.toCanvas([null, '#3a7896', '#29627f']);
}

function leaves() {
  const b = new PixBuf(26, 12);
  const n = Math.floor(rand(4, 8));
  for (let i = 0; i < n; i++) {
    const c = Math.floor(rand(1, 4));
    const x = Math.floor(rand(1, 24));
    const y = Math.floor(rand(1, 11));
    b.set(x, y, c);
    if (Math.random() < 0.6) b.set(x + 1, y, c);
  }
  return b.toCanvas([null, '#e0903a', '#f2c04a', '#c8503a']);
}

// A lumpy patch of mud with a wetter middle.
function mud() {
  const b = new PixBuf(40, 18);
  for (let i = 0; i < 4; i++) b.fillEllipse(rand(12, 28), rand(7, 11), rand(8, 12), rand(4, 6), 1);
  for (let i = 0; i < 2; i++) b.fillEllipse(rand(15, 25), rand(8, 10), rand(4, 7), rand(2, 3), 2);
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(rand(0, 40));
    const y = Math.floor(rand(0, 18));
    if (b.get(x, y) === 1) b.set(x, y, 3);
  }
  return b.toCanvas([null, '#4a4030', '#3a3326', '#5a4e3a']);
}

const variants = { tree: [], bigtree: [], cobbles: [], leaves: [], mud: [], branches: [] };
const MAKERS = {
  tree: () => crown(44, 30),
  bigtree: () => crown(76, 52, Math.random() < 0.5 ? LEAVES : DARK_LEAVES),
  branches: () => crown(120, 40, DARK_LEAVES),
  cobbles,
  leaves,
  mud,
};
function variant(kind) {
  const list = variants[kind];
  if (list.length < 4) list.push(MAKERS[kind]());
  return choice(list);
}

// ---- Overhead: things that cross the street above you -----------------------

const FLAGS = ['#e05a6a', '#f2b03a', '#3fa6ef', '#8fcf63', '#e08cf6'];

// Bridge spanning the whole street (stone in town, timber at the harbor).
function bridge(wood) {
  const w = PF_W;
  const h = 22;
  const b = new PixBuf(w, h);
  const [deck, seam, rail, post, under] = wood ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 5];
  for (let y = 3; y < h - 4; y++) for (let x = 0; x < w; x++) b.set(x, y, deck);
  for (let y = 3; y < h - 4; y++) {
    for (let x = 0; x < w; x++) {
      if (wood ? x % 5 === 0 : (y - 3) % 5 === 0 || (x + ((y - 3) / 5 | 0) * 4) % 9 === 0) b.set(x, y, seam);
    }
  }
  for (const y0 of [0, h - 6]) {
    for (let x = 0; x < w; x++) {
      b.set(x, y0 + 1, rail);
      b.set(x, y0 + 2, rail);
      if (x % 12 < 2) for (let y = y0; y < y0 + 4; y++) b.set(x, y, post);
    }
  }
  for (let x = 0; x < w; x++) {
    b.set(x, h - 2, under);
    b.set(x, h - 1, under);
  }
  return b.toCanvas([null, '#8a6a44', '#6a4e30', '#5a4228', '#a8845a', '#1c3a4c', '#9aa1a8', '#7a838c', '#5a636e', '#c4cad0']);
}

// A string of little flags sagging across the street; the bulbs glow at night.
function bunting() {
  const w = PF_W;
  const h = 14;
  const b = new PixBuf(w, h);
  const sag = (x) => 2 + Math.round(Math.sin((x / w) * Math.PI) * 6);
  for (let x = 0; x < w; x++) b.set(x, sag(x), 1);
  for (let x = 4, i = 0; x < w - 4; x += 9, i++) {
    const y = sag(x) + 1;
    const c = 2 + (i % FLAGS.length);
    for (let r = 0; r < 4; r++) for (let dx = r; dx < 6 - r; dx++) b.set(x + dx - 1, y + r, c);
    b.set(x + 6, sag(x + 6), 7);
  }
  return b.toCanvas([null, '#2e3640', ...FLAGS, '#fff2c0']);
}

const OVERHEAD = {
  bridge: { make: (loc) => bridge(loc.key === 'harbor'), dry: true, fade: true },
  bunting: { make: () => bunting(), dry: false, fade: false },
  branches: { make: () => variant('branches'), dry: true, fade: true, side: true },
};

// ---- Placement & behaviour --------------------------------------------------

// Props along the walls, details on the ground, and the odd thing crossing
// overhead. Everything scrolls with the street; new items are picked from the
// location at the top of the screen.
export class Decor {
  constructor(world) {
    this.world = world;
    this.side = [];
    this.floor = [];
    this.over = [];
    this.t = 0;
    const loc = world.locAt(0);
    for (const s of [0, 1]) for (let y = PF_H + 10; y > -20; y -= rand(24, 60)) this.spawnSide(s, y, loc);
    for (let y = PF_H; y > -20; y -= rand(50, 120)) this.spawnFloor(y, loc);
    this.sideGap = [rand(10, 40), rand(10, 40)];
    this.floorGap = rand(30, 90);
    this.overGap = rand(120, 260);
  }

  spawnSide(side, y, loc) {
    const kind = pick(loc.side);
    const it = { kind, side, y, phase: rand(0, 6.3), dripT: rand(0.2, 1), fade: 1 };
    if (SIDE[kind].crown) it.cv = variant(kind);
    this.side.push(it);
  }

  spawnFloor(y, loc) {
    const kind = pick(loc.floor);
    const it = { kind, y, x: rand(GROUND_L + 22, GROUND_R - 22), gurgleT: rand(0.3, 1.2) };
    if (kind === 'drain') it.x = Math.random() < 0.5 ? GROUND_L + 8 : GROUND_R - 8;
    if (kind === 'cobbles' || kind === 'leaves' || kind === 'mud') it.cv = variant(kind);
    else it.cv = charSprite(`floor-${kind}`, FLOOR[kind].rows, FLOOR[kind].colors);
    this.floor.push(it);
  }

  spawnOver(y, loc) {
    if (!loc.overhead) return;
    const kind = pick(loc.overhead);
    const cv = OVERHEAD[kind].make(loc);
    const side = Math.random() < 0.5 ? 0 : 1;
    const x = OVERHEAD[kind].side ? (side ? PF_W - cv.width + 10 : -10) : 0;
    this.over.push({ kind, y, x, cv, fade: 1 });
  }

  update(dt, sc) {
    this.t += dt;
    const w = this.world;
    const top = w.locAt(-30);
    for (const s of [0, 1]) {
      this.sideGap[s] -= sc;
      if (this.sideGap[s] <= 0) {
        this.sideGap[s] = rand(24, 60);
        this.spawnSide(s, -30, top);
      }
    }
    this.floorGap -= sc;
    if (this.floorGap <= 0) {
      this.floorGap = rand(60, 130);
      this.spawnFloor(-24, top);
    }
    this.overGap -= sc;
    if (this.overGap <= 0) {
      this.overGap = rand(300, 520);
      this.spawnOver(-60, top);
    }

    const p = w.player;
    for (const it of this.side) {
      it.y += sc;
      // Trees shed big drops onto the pavement under their crown.
      if (SIDE[it.kind].crown && (it.dripT -= dt) <= 0) {
        it.dripT = rand(0.25, 0.7);
        const reach = it.kind === 'bigtree' ? 34 : 18;
        const cx = it.side ? GROUND_R : GROUND_L;
        w.addRipple(cx + (it.side ? -1 : 1) * rand(3, reach), it.y - rand(4, 20), rand(6, 11), 2, 1.1);
      }
      if (SIDE[it.kind].crown) it.fade = fadeToward(it.fade, p && this.crownCovers(it, p.x, p.y), dt);
    }
    for (const it of this.floor) {
      it.y += sc;
      // Drains gurgle.
      if (it.kind === 'drain' && (it.gurgleT -= dt) <= 0) {
        it.gurgleT = rand(0.5, 1.4);
        w.addRipple(it.x + rand(-4, 4), it.y + 4, rand(3, 5), 1, 0.6);
      }
    }
    for (const it of this.over) {
      it.y += sc;
      if (OVERHEAD[it.kind].fade) it.fade = fadeToward(it.fade, p && this.overCovers(it, p.x, p.y - 4), dt);
    }
    this.side = this.side.filter((it) => it.y < PF_H + 60);
    this.floor = this.floor.filter((it) => it.y < PF_H + 20);
    this.over = this.over.filter((it) => it.y - it.cv.height < PF_H + 10);
  }

  // ---- queries --------------------------------------------------------------

  crownBox(it) {
    const d = SIDE[it.kind];
    const cx = it.side ? GROUND_R + (it.kind === 'bigtree' ? 6 : 0) : GROUND_L - (it.kind === 'bigtree' ? 6 : 0);
    return { x: cx - d.w / 2, y: it.y - d.h, w: d.w, h: d.h };
  }

  crownCovers(it, x, y) {
    const b = this.crownBox(it);
    return x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;
  }

  overCovers(it, x, y) {
    return x > it.x && x < it.x + it.cv.width && y > it.y - it.cv.height && y < it.y;
  }

  // Rain stops at bridges, branches and tree crowns: returns true if (x, y) is sheltered.
  shelters(x, y) {
    for (const it of this.over) if (OVERHEAD[it.kind].dry && this.overCovers(it, x, y)) return true;
    for (const it of this.side) if (SIDE[it.kind].crown && this.crownCovers(it, x, y)) return true;
    return false;
  }

  inMud(x, y) {
    for (const it of this.floor) {
      if (it.kind !== 'mud') continue;
      const dx = (x - it.x) / (it.cv.width * 0.4);
      const dy = (y - it.y) / (it.cv.height * 0.4);
      if (dx * dx + dy * dy <= 1) return true;
    }
    return false;
  }

  // ---- drawing --------------------------------------------------------------

  drawFloor(ctx) {
    for (const it of this.floor) ctx.drawImage(it.cv, Math.round(it.x - it.cv.width / 2), Math.round(it.y - it.cv.height / 2));
  }

  // Low props sit on the pavement under the umbrellas; lamps and trees tower
  // over them, and go see-through when you walk underneath.
  drawSide(ctx, tall) {
    for (const it of this.side) {
      const d = SIDE[it.kind];
      if (!!d.tall !== tall) continue;
      if (d.crown) {
        const b = this.crownBox(it);
        ctx.globalAlpha = it.fade;
        ctx.drawImage(it.cv, Math.round(b.x), Math.round(b.y));
        ctx.globalAlpha = 1;
        continue;
      }
      const frame = d.sway && Math.sin(this.t * 2 + it.phase) > 0.4 ? 1 : 0;
      const cv = sideSprite(it.kind, frame, it.side === 1);
      const x = it.side ? GROUND_R + d.overlap - cv.width : GROUND_L - d.overlap;
      ctx.drawImage(cv, x, Math.round(it.y) - cv.height);
    }
  }

  drawOverhead(ctx) {
    for (const it of this.over) {
      ctx.globalAlpha = it.fade;
      ctx.drawImage(it.cv, Math.round(it.x), Math.round(it.y) - it.cv.height);
    }
    ctx.globalAlpha = 1;
  }

  // Bunting bulbs, for the night lights.
  bulbs() {
    const out = [];
    for (const it of this.over) {
      if (it.kind !== 'bunting') continue;
      for (let x = 10; x < PF_W - 4; x += 9) out.push({ x, y: it.y - it.cv.height + 2 + Math.round(Math.sin((x / PF_W) * Math.PI) * 6) });
    }
    return out;
  }

  // Where each street lamp's glass is, and the ground its light falls on.
  lampHeads() {
    const out = [];
    for (const it of this.side) {
      if (it.kind !== 'lamp') continue;
      const cv = sideSprite('lamp', 0, it.side === 1);
      const x0 = it.side ? GROUND_R + SIDE.lamp.overlap - cv.width : GROUND_L - SIDE.lamp.overlap;
      const x = x0 + (it.side ? 3 : 6) + 0.5;
      out.push({ x, y: it.y - cv.height + 4, poolX: x + (it.side ? -4 : 4), groundY: it.y - 2 });
    }
    return out;
  }

  // Shadows on the ground: under tree crowns and under bridges.
  drawShadows(ctx) {
    for (const it of this.side) {
      if (!SIDE[it.kind].crown) continue;
      const big = it.kind === 'bigtree';
      const rx = big ? 26 : 14;
      const ry = big ? 9 : 6;
      const cx = it.side ? GROUND_R - (big ? 12 : 4) : GROUND_L + (big ? 12 : 4);
      ctx.drawImage(ellipseSprite(rx, ry, this.world.locAt(it.y).shadow, true), cx - rx + 3, Math.round(it.y) - ry - 4);
    }
    for (const it of this.over) {
      if (!OVERHEAD[it.kind].dry) continue;
      ctx.fillStyle = this.world.locAt(it.y).shadow;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(Math.max(GROUND_L, it.x), Math.round(it.y) - it.cv.height + 6, Math.min(it.cv.width, GROUND_R - GROUND_L), it.cv.height - 4);
      ctx.globalAlpha = 1;
    }
  }
}

function fadeToward(f, covered, dt) {
  const target = covered ? 0.4 : 1;
  return f + Math.max(-dt * 4, Math.min(dt * 4, target - f));
}
