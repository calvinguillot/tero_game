import { charSprite, swayRows } from '../render/sprites.js';
import { PixBuf, ellipseSprite } from '../render/pixels.js';
import { rand, pick, choice } from '../core/math.js';
import { PF_H, GROUND_L, GROUND_R } from '../config.js';

// ---- Sprites ---------------------------------------------------------------

const GREEN = { g: '#3f9a4a', G: '#2c7438', l: '#76cc5e' };

const SIDE = {
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
  // Street lamp leaning over the pavement; it gets switched on at night (M5).
  lamp: {
    colors: { k: '#3d4856', K: '#2a333e', h: '#2a333e', G: '#ffe8a0' },
    overlap: 2,
    tall: true,
    rows: ['kkkkkk..', 'kk..hhh.', 'kk.hGGGh', 'kk.hGGGh', 'kk..hhh.', ...Array(17).fill('kk......'), 'KkkK....', 'KKKK....'],
  },
  tree: { tall: true },
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
function treeCrown() {
  const b = new PixBuf(44, 30);
  const blobs = [
    [22, 16, 16, 11],
    [12, 13, 9, 7],
    [32, 12, 10, 7],
    [21, 8, 10, 6],
    [31, 20, 9, 6],
    [12, 20, 8, 6],
  ];
  for (const [x, y, rx, ry] of blobs) b.fillEllipse(x + rand(-1, 1), y + rand(-1, 1), rx, ry, 2);
  for (const [x, y, rx, ry] of blobs) b.fillEllipse(x - 2, y - 2, rx * 0.55, ry * 0.55, 3);
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(rand(0, 44));
    const y = Math.floor(rand(0, 30));
    if (b.get(x, y)) b.set(x, y, Math.random() < 0.6 ? 1 : 3);
  }
  b.outline(4);
  return b.toCanvas([null, '#2a6a34', '#3a8a44', '#5aae52', '#1d4a26']);
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
      b.set(x, y, c);
      b.set(x + 1, y, c);
      b.set(x + 2, y, c);
      b.set(x, y + 1, c);
      b.set(x + 1, y + 1, c);
      b.set(x + 2, y + 1, c);
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

const variants = { tree: [], cobbles: [], leaves: [] };
const MAKERS = { tree: treeCrown, cobbles, leaves };
function variant(kind) {
  const list = variants[kind];
  if (list.length < 4) list.push(MAKERS[kind]());
  return choice(list);
}

// ---- Placement & behaviour --------------------------------------------------

// Props along the walls and details on the ground. Everything scrolls with the
// street; new items are picked from the location at the top of the screen.
export class Decor {
  constructor(world) {
    this.world = world;
    this.side = [];
    this.floor = [];
    this.t = 0;
    const loc = world.locAt(0);
    for (const s of [0, 1]) for (let y = PF_H + 10; y > -20; y -= rand(28, 70)) this.spawnSide(s, y, loc);
    for (let y = PF_H; y > -20; y -= rand(60, 140)) this.spawnFloor(y, loc);
    this.sideGap = [rand(10, 40), rand(10, 40)];
    this.floorGap = rand(30, 90);
  }

  spawnSide(side, y, loc) {
    const kind = pick(loc.side);
    const it = { kind, side, y, phase: rand(0, 6.3), dripT: rand(0.2, 1) };
    if (kind === 'tree') it.cv = variant('tree');
    this.side.push(it);
  }

  spawnFloor(y, loc) {
    const kind = pick(loc.floor);
    const it = { kind, y, x: rand(GROUND_L + 22, GROUND_R - 22), gurgleT: rand(0.3, 1.2) };
    if (kind === 'drain') it.x = Math.random() < 0.5 ? GROUND_L + 8 : GROUND_R - 8;
    if (kind === 'cobbles' || kind === 'leaves') it.cv = variant(kind);
    else it.cv = charSprite(`floor-${kind}`, FLOOR[kind].rows, FLOOR[kind].colors);
    this.floor.push(it);
  }

  update(dt, sc) {
    this.t += dt;
    const w = this.world;
    const top = w.locAt(-30);
    for (const s of [0, 1]) {
      this.sideGap[s] -= sc;
      if (this.sideGap[s] <= 0) {
        this.sideGap[s] = rand(28, 70);
        this.spawnSide(s, -30, top);
      }
    }
    this.floorGap -= sc;
    if (this.floorGap <= 0) {
      this.floorGap = rand(70, 150);
      this.spawnFloor(-24, top);
    }

    for (const it of this.side) {
      it.y += sc;
      // Trees shed big drops onto the pavement under their crown.
      if (it.kind === 'tree' && (it.dripT -= dt) <= 0) {
        it.dripT = rand(0.25, 0.7);
        const cx = it.side ? GROUND_R : GROUND_L;
        w.addRipple(cx + (it.side ? -1 : 1) * rand(3, 18), it.y - rand(4, 20), rand(6, 11), 2, 1.1);
      }
    }
    for (const it of this.floor) {
      it.y += sc;
      // Drains gurgle.
      if (it.kind === 'drain' && (it.gurgleT -= dt) <= 0) {
        it.gurgleT = rand(0.5, 1.4);
        w.addRipple(it.x + rand(-4, 4), it.y + 4, rand(3, 5), 1, 0.6);
      }
    }
    this.side = this.side.filter((it) => it.y < PF_H + 40);
    this.floor = this.floor.filter((it) => it.y < PF_H + 20);
  }

  drawFloor(ctx) {
    for (const it of this.floor) ctx.drawImage(it.cv, Math.round(it.x - it.cv.width / 2), Math.round(it.y - it.cv.height / 2));
  }

  // Low props sit on the pavement under the umbrellas; lamps and trees tower over them.
  drawSide(ctx, tall) {
    for (const it of this.side) {
      const d = SIDE[it.kind];
      if (!!d.tall !== tall) continue;
      if (it.kind === 'tree') {
        const cx = it.side ? GROUND_R : GROUND_L;
        ctx.drawImage(it.cv, cx - 22, Math.round(it.y) - 30);
        continue;
      }
      const frame = d.sway && Math.sin(this.t * 2 + it.phase) > 0.4 ? 1 : 0;
      const cv = sideSprite(it.kind, frame, it.side === 1);
      const x = it.side ? GROUND_R + d.overlap - cv.width : GROUND_L - d.overlap;
      ctx.drawImage(cv, x, Math.round(it.y) - cv.height);
    }
  }

  // Where each street lamp's glass is, and the ground its light falls on.
  lampHeads() {
    const out = [];
    for (const it of this.side) {
      if (it.kind !== 'lamp') continue;
      const cv = sideSprite('lamp', 0, it.side === 1);
      const x0 = it.side ? GROUND_R + SIDE.lamp.overlap - cv.width : GROUND_L - SIDE.lamp.overlap;
      const x = x0 + (it.side ? 2 : 5) + 0.5;
      out.push({ x, y: it.y - cv.height + 3, poolX: x + (it.side ? -4 : 4), groundY: it.y - 2 });
    }
    return out;
  }

  drawTreeShadows(ctx) {
    for (const it of this.side) {
      if (it.kind !== 'tree') continue;
      const cx = it.side ? GROUND_R - 4 : GROUND_L + 4;
      const cv = ellipseSprite(14, 6, this.world.locAt(it.y).shadow, true);
      ctx.drawImage(cv, cx - 14 + 3, Math.round(it.y) - 10);
    }
  }
}
