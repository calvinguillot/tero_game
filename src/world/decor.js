import { charSprite, swayRows } from '../render/sprites.js';
import { PixBuf, ellipseSprite } from '../render/pixels.js';
import { rand, randInt, lerp, pick, choice } from '../core/math.js';
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
  // Built procedurally (see broadleaf/pine below).
  tree: { tall: true, crown: true },
  bigtree: { tall: true, crown: true },
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

// ---- Trees -------------------------------------------------------------------

// Palette slots: 1 bark, 2 bark highlight, 3-5 leaves dark to light,
// 6 outline, 7 blossom. Slots from LEAF up are foliage and keep rain off.
const TREE_COLORS = {
  green: [null, '#5a4228', '#7a5a38', '#2a6a34', '#3a8a44', '#5aae52', '#1d4a26', '#f4a6c6'],
  dark: [null, '#4a3622', '#6a4e30', '#1f5530', '#2c703c', '#46944a', '#163a20', '#f4a6c6'],
  autumn: [null, '#5a4228', '#7a5a38', '#a8502a', '#d0803a', '#f2b04a', '#5a2a18', '#f2d04a'],
};
const LEAF = 3;

// Which kinds of tree grow where.
const SPECIES = {
  park: { green: 5, blossom: 3, autumn: 2 },
  forest: { pine: 5, darkround: 5 },
  other: { green: 8, autumn: 2 },
};

// A branch `w` pixels thick, lit on its left edge.
function limb(b, x0, y0, x1, y1, w) {
  for (let i = 0; i < w; i++) b.line(x0 + i, y0, x1 + i, y1, 1);
  if (w > 1) b.line(x0, y0, x1, y1, 2);
}

// A lumpy clump of leaves: dark underside with side lobes, lighter top-left,
// a bright spot.
function clump(b, x, y, rx, ry) {
  b.fillEllipse(x, y, rx, ry, 3);
  b.fillEllipse(x - rx * 0.6, y + ry * 0.25, rx * 0.55, ry * 0.6, 3);
  b.fillEllipse(x + rx * 0.62, y + ry * 0.15, rx * 0.5, ry * 0.55, 3);
  b.fillEllipse(x - rx * 0.15, y - ry * 0.2, rx * 0.78, ry * 0.72, 4);
  b.fillEllipse(x - rx * 0.62, y + ry * 0.1, rx * 0.36, ry * 0.4, 4);
  b.fillEllipse(x - rx * 0.35, y - ry * 0.42, rx * 0.36, ry * 0.32, 5);
}

// Leaf speckles, optional blossoms, and the outline.
function finishLeaves(b, blossom) {
  for (let i = 0; i < (b.w * b.h) / 14; i++) {
    const x = Math.floor(rand(0, b.w));
    const y = Math.floor(rand(0, b.h));
    if (b.get(x, y) === 4) b.set(x, y, Math.random() < 0.6 ? 3 : 5);
    else if (blossom && b.get(x, y) >= LEAF && Math.random() < 0.5) b.set(x, y, 7);
  }
  b.outline(6);
}

// A broadleaf tree for the left wall (mirrored on the right): a trunk leaning
// toward the street, forking into branches that end in separate clumps, so
// the bark and the street show through the gaps. Returns the trunk column and
// where the clumps are, for shadows and drips.
function broadleaf(W, H, blossom) {
  const b = new PixBuf(W, H);
  const k = W / 46;
  const tx = Math.round(W * 0.4);
  const tw = Math.max(2, Math.round(3 * k));
  const topX = tx + rand(3, 6) * k;
  const topY = H * 0.56;
  limb(b, tx, H - 1, topX, topY, tw);
  b.set(tx - 1, H - 1, 1);
  b.set(tx + tw, H - 1, 1);
  const top = H * 0.74; // clumps stay above the lower trunk
  const keep = (x, y, rx, ry) => [Math.max(rx + 1, Math.min(W - rx - 2, x)), Math.max(ry + 1, Math.min(top - ry, y))];
  const clumps = [];
  const grow = (x, y, size) => {
    const rx = size * rand(0.85, 1.15) * k;
    const ry = rx * rand(0.65, 0.8);
    const [cx, cy] = keep(x, y, rx, ry);
    clumps.push([cx, cy, rx, ry]);
    // A smaller clump or two hugging it, so the crown reads as one tree.
    for (let i = randInt(0, 2); i > 0; i--) {
      const a = rand(0, Math.PI * 2);
      const sr = rx * rand(0.5, 0.7);
      clumps.push([...keep(cx + Math.cos(a) * rx * 0.8, cy + Math.sin(a) * ry * 0.7, sr, sr * 0.7), sr, sr * 0.7]);
    }
  };
  grow(topX + tw / 2, topY - 5 * k, 7);
  const n = randInt(3, 5);
  for (let i = 0; i < n; i++) {
    // Branches leave the upper trunk, mostly reaching up and out over the street.
    const t = rand(0, 0.45);
    const sx = lerp(topX, tx, t) + tw / 2;
    const sy = lerp(topY, H - 1, t);
    const a = -Math.PI / 2 + rand(-0.9, 1.3);
    const len = rand(0.32, 0.5) * W;
    const [ex, ey] = keep(sx + Math.cos(a) * len, sy + Math.sin(a) * len * 0.8, 6 * k, 4 * k);
    limb(b, sx, sy, ex, ey, k > 1.3 && i < 2 ? 2 : 1);
    grow(ex, ey, rand(5, 7.5));
    if (Math.random() < 0.6) {
      // A twig forking off halfway, with a smaller clump.
      const mx = lerp(sx, ex, 0.55);
      const my = lerp(sy, ey, 0.55);
      const a2 = a + (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 0.9);
      const [fx, fy] = keep(mx + Math.cos(a2) * len * 0.45, my + Math.sin(a2) * len * 0.35, 4 * k, 3 * k);
      b.line(mx, my, fx, fy, 1);
      grow(fx, fy, rand(3.5, 5));
    }
  }
  // Back clumps first, so the lower (nearer) ones overlap them.
  clumps.sort((p, q) => p[1] - q[1]);
  for (const [x, y, rx, ry] of clumps) clump(b, x, y, rx, ry);
  finishLeaves(b, blossom);
  return { b, tx, clumps };
}

// A fir for the deep forest: a straight trunk and stacked, drooping tiers.
function pine(W, H) {
  const b = new PixBuf(W, H);
  const k = W / 46;
  const tx = Math.round(W * 0.42);
  const tw = Math.max(2, Math.round(2 * k));
  const cx = tx + tw / 2;
  limb(b, tx, H - 1, tx, H * 0.1, tw);
  const tiers = randInt(3, 4);
  const th = (H * 0.78) / (tiers * 0.8 + 0.2);
  let y = H - 7 * k;
  let half = W * 0.42;
  const clumps = [];
  for (let i = 0; i < tiers; i++) {
    const droop = 2 * k;
    b.fillPoly([[cx, y - th], [cx + half, y], [cx + half * 0.55, y + droop], [cx, y - th * 0.15], [cx - half * 0.55, y + droop], [cx - half, y]], 3);
    b.fillPoly([[cx, y - th + 1], [cx + half * 0.55, y - 2], [cx, y - th * 0.25], [cx - half * 0.8, y - 1]], 4);
    b.fillPoly([[cx - 1, y - th + 3], [cx - half * 0.15, y - th * 0.45], [cx - half * 0.6, y - 2]], 5);
    clumps.push([cx, y - th * 0.4, half * 0.8, th * 0.4]);
    y -= th * 0.8;
    half *= 0.74;
  }
  finishLeaves(b, false);
  return { b, tx, clumps };
}

// A long bough reaching across the street from the left edge, with clumps
// strung along it and gaps between them.
function bough(W, H) {
  const b = new PixBuf(W, H);
  const y0 = H * 0.55;
  const sag = rand(2, 6);
  const at = (x) => y0 + Math.sin((x / W) * Math.PI) * sag;
  const end = W * rand(0.8, 0.9);
  limb(b, 0, at(0), end * 0.5, at(end * 0.5), 3);
  limb(b, end * 0.5, at(end * 0.5), end, at(end), 2);
  const clumps = [];
  for (let x = rand(12, 18); x < end + 4; x += rand(13, 19)) {
    // Short twigs up or down off the bough, angled outward, each ending in a
    // clump; most spots also get leaves right on the bough.
    const up = Math.random() < 0.6;
    const ty = at(x) + (up ? -1 : 1) * rand(6, 10);
    const tx = x + rand(3, 9);
    b.line(x, at(x), tx, ty, 1);
    const rx = rand(6, 9);
    clumps.push([tx, ty, rx, rx * rand(0.6, 0.75)]);
    if (Math.random() < 0.7) clumps.push([x + rand(-4, 2), at(x) + rand(-2, 2), rx * 0.7, rx * 0.5]);
  }
  clumps.sort((p, q) => p[1] - q[1]);
  for (const [x, y, rx, ry] of clumps) clump(b, x, y, rx, ry);
  finishLeaves(b, false);
  return { b, tx: 0, clumps };
}

function mirror(cv) {
  const out = document.createElement('canvas');
  out.width = cv.width;
  out.height = cv.height;
  const c = out.getContext('2d');
  c.scale(-1, 1);
  c.drawImage(cv, -cv.width, 0);
  return out;
}

// Bakes a tree into both facings, plus a mask of its foliage pixels.
function bake({ b, tx, clumps }, colors) {
  const cv = b.toCanvas(colors);
  const mask = new Uint8Array(b.d.length);
  for (let i = 0; i < b.d.length; i++) mask[i] = b.d[i] >= LEAF ? 1 : 0;
  return { cv, flip: mirror(cv), mask, w: b.w, h: b.h, tx, clumps };
}

const TREE_SIZE = { tree: [46, 36], bigtree: [78, 60], branches: [120, 40] };
const treeCache = new Map();
function treeVariant(kind, locKey) {
  const [W, H] = TREE_SIZE[kind];
  const species = kind === 'branches' ? (locKey === 'forest' ? 'dark' : 'green') : pick(SPECIES[locKey] || SPECIES.other);
  const key = `${kind}-${species}`;
  let list = treeCache.get(key);
  if (!list) treeCache.set(key, (list = []));
  if (list.length < 4) {
    if (kind === 'branches') list.push(bake(bough(W, H), TREE_COLORS[species]));
    else if (species === 'pine') list.push(bake(pine(W, H), TREE_COLORS.dark));
    else {
      const colors = species === 'darkround' ? TREE_COLORS.dark : species === 'autumn' ? TREE_COLORS.autumn : TREE_COLORS.green;
      list.push(bake(broadleaf(W, H, species === 'blossom'), colors));
    }
  }
  return choice(list);
}

// Whether a baked tree drawn at (x0, y0), mirrored or not, has leaves at (x, y).
function leafAt(v, x0, y0, flipped, x, y) {
  let lx = Math.floor(x - x0);
  const ly = Math.floor(y - y0);
  if (lx < 0 || ly < 0 || lx >= v.w || ly >= v.h) return false;
  if (flipped) lx = v.w - 1 - lx;
  return v.mask[ly * v.w + lx] === 1;
}

// ---- Ground textures -----------------------------------------------------------

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

const variants = { cobbles: [], leaves: [], mud: [] };
const MAKERS = {
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
  branches: { make: (loc) => treeVariant('branches', loc.key), dry: true, fade: true, side: true },
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
    if (SIDE[kind].crown) it.tree = treeVariant(kind, loc.key);
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
    const side = Math.random() < 0.5 ? 0 : 1;
    const made = OVERHEAD[kind].make(loc);
    // Boughs come baked with a leaf mask, and grow in from either side.
    const tree = made.mask ? made : null;
    const cv = tree ? (side ? tree.flip : tree.cv) : made;
    const x = OVERHEAD[kind].side ? (side ? PF_W - cv.width + 10 : -10) : 0;
    this.over.push({ kind, y, x, cv, tree, side, fade: 1 });
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
      // Trees shed big drops from their clumps onto the pavement below.
      if (it.tree && (it.dripT -= dt) <= 0) {
        it.dripT = rand(0.25, 0.7);
        const [cx] = choice(it.tree.clumps);
        const x = this.treeX(it, cx + rand(-3, 3));
        if (x > GROUND_L + 2 && x < GROUND_R - 2) w.addRipple(x, it.y - rand(2, 10), rand(6, 11), 2, 1.1);
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

  // Where a tree sprite sits: its trunk stands just off the wall, and the
  // right-hand trees are mirrored.
  crownBox(it) {
    const v = it.tree;
    const x = it.side ? GROUND_R + 3 - (v.w - 1 - v.tx) : GROUND_L - 3 - v.tx;
    return { x, y: it.y - v.h, w: v.w, h: v.h };
  }

  // Screen x of a column of the tree sprite.
  treeX(it, lx) {
    return this.crownBox(it).x + (it.side ? it.tree.w - 1 - lx : lx);
  }

  // The leafy part, for see-through: the sprite box above the bare trunk.
  crownCovers(it, x, y) {
    const b = this.crownBox(it);
    return x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h * 0.75;
  }

  overCovers(it, x, y) {
    return x > it.x && x < it.x + it.cv.width && y > it.y - it.cv.height && y < it.y;
  }

  // Rain stops at bridges, boughs and leaves: returns true if (x, y) is
  // sheltered. Trees and boughs only shelter where they actually have leaves,
  // so rain falls through the gaps.
  shelters(x, y) {
    for (const it of this.over) {
      if (!OVERHEAD[it.kind].dry) continue;
      if (it.tree ? leafAt(it.tree, it.x, it.y - it.cv.height, it.side === 1, x, y) : this.overCovers(it, x, y)) return true;
    }
    for (const it of this.side) {
      if (!it.tree) continue;
      const b = this.crownBox(it);
      if (leafAt(it.tree, b.x, b.y, it.side === 1, x, y)) return true;
    }
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
    const sy = this.world.sy;
    for (const it of this.floor) ctx.drawImage(it.cv, Math.round(it.x - it.cv.width / 2), sy(it.y - it.cv.height / 2));
  }

  // Low props sit on the pavement under the umbrellas; lamps and trees tower
  // over them, and go see-through when you walk underneath.
  drawSide(ctx, tall) {
    for (const it of this.side) {
      const d = SIDE[it.kind];
      if (!!d.tall !== tall) continue;
      if (it.tree) {
        const b = this.crownBox(it);
        ctx.globalAlpha = it.fade;
        ctx.drawImage(it.side ? it.tree.flip : it.tree.cv, Math.round(b.x), this.world.sy(b.y));
        ctx.globalAlpha = 1;
        continue;
      }
      const frame = d.sway && Math.sin(this.t * 2 + it.phase) > 0.4 ? 1 : 0;
      const cv = sideSprite(it.kind, frame, it.side === 1);
      const x = it.side ? GROUND_R + d.overlap - cv.width : GROUND_L - d.overlap;
      ctx.drawImage(cv, x, this.world.sy(it.y) - cv.height);
    }
  }

  drawOverhead(ctx) {
    for (const it of this.over) {
      ctx.globalAlpha = it.fade;
      ctx.drawImage(it.cv, Math.round(it.x), this.world.sy(it.y) - it.cv.height);
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

  // Shadows on the ground: dappled patches under each clump of leaves, and
  // under bridges.
  drawShadows(ctx) {
    for (const it of this.side) {
      if (!it.tree) continue;
      const color = this.world.locAt(it.y).shadow;
      const ground = this.world.sy(it.y);
      it.tree.clumps.forEach(([cx, , crx], i) => {
        const rx = Math.max(3, Math.round(crx * 0.9));
        const ry = Math.max(2, Math.round(rx * 0.38));
        const x = Math.round(this.treeX(it, cx)) + 2;
        ctx.drawImage(ellipseSprite(rx, ry, color, true), x - rx, ground - ry - 2 - (i % 3) * 2);
      });
    }
    for (const it of this.over) {
      if (!OVERHEAD[it.kind].dry) continue;
      if (it.tree) {
        // A bough's clumps cast patches a little below them.
        const color = this.world.locAt(it.y).shadow;
        const top = it.y - it.cv.height;
        for (const [cx, cy, crx] of it.tree.clumps) {
          const rx = Math.max(3, Math.round(crx * 0.9));
          const ry = Math.max(2, Math.round(rx * 0.4));
          const x = Math.round(it.x + (it.side ? it.tree.w - 1 - cx : cx)) + 3;
          ctx.drawImage(ellipseSprite(rx, ry, color, true), x - rx, this.world.sy(top + cy) + 6 - ry);
        }
        continue;
      }
      ctx.fillStyle = this.world.locAt(it.y).shadow;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(Math.max(GROUND_L, it.x), this.world.sy(it.y) - it.cv.height + 6, Math.min(it.cv.width, GROUND_R - GROUND_L), it.cv.height - 4);
      ctx.globalAlpha = 1;
    }
  }
}

// Eases toward see-through when the player is underneath, and back.
function fadeToward(f, covered, dt) {
  const target = covered ? 0.4 : 1;
  return f + (target - f) * (1 - Math.exp(-dt * 7));
}
