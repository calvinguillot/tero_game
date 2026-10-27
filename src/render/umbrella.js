import { PixBuf, ellipseSprite } from './pixels.js';
import { UMBRELLA_COLORS, HANDLE, PAL } from './palette.js';

// Umbrellas are a cone seen from slightly above and in front: a tip above an
// elliptical rim, with ribs fanning down to the front half of the rim. Moving
// the tip sideways tilts it, shrinking the rim closes it, and putting the tip
// below the rim turns it inside out.

// n: rib count, hK: tip height, ryK: rim depth, sag: scallop depth.
export const STYLES = {
  classic: { name: 'CLASSIC', n: 8, hK: 0.8, ryK: 0.38, sag: 0.1, pattern: 'alt' },
  polka: { name: 'POLKA', n: 8, hK: 0.8, ryK: 0.38, sag: 0.1, pattern: 'dots' },
  stripes: { name: 'STRIPES', n: 8, hK: 0.8, ryK: 0.38, sag: 0.1, pattern: 'stripe' },
  wagasa: { name: 'WAGASA', n: 12, hK: 0.6, ryK: 0.36, sag: 0.04, pattern: 'band' },
  bubble: { name: 'BUBBLE', n: 6, hK: 1.05, ryK: 0.46, sag: 0.05, pattern: 'clear' },
  frill: { name: 'FRILL', n: 8, hK: 0.8, ryK: 0.38, sag: 0.22, pattern: 'frill' },
};
export const STYLE_KEYS = Object.keys(STYLES);
export const NPC_STYLES = { classic: 6, polka: 1, stripes: 1, wagasa: 1, bubble: 1, frill: 1 };

export function canopyGeom(r, open = 1, style = 'classic') {
  const st = STYLES[style];
  const R = r * (0.25 + 0.75 * open);
  return {
    R,
    ry: Math.max(1, R * st.ryK),
    h: r * st.hK * (1 + (1 - open) * 0.9),
    L: Math.round(r * 0.75),
  };
}

const cache = new Map();

// tilt leans the tip sideways; pitch leans it forward (+, walking up the
// street: flatter, more of the top showing) or back (−: taller, narrower).
export function umbrellaSprite(color, r, tilt = 0, open = 1, inv = false, handle = 'j', style = 'classic', pitch = 0) {
  tilt = Math.max(-4, Math.min(4, Math.round(tilt)));
  pitch = Math.max(-2, Math.min(2, Math.round(pitch)));
  open = Math.round(open * 10) / 10;
  const key = `${color}|${r}|${tilt}|${open}|${inv ? 1 : 0}|${handle}|${style}|${pitch}`;
  let s = cache.get(key);
  if (!s) {
    s = build(color, r, tilt, open, inv, handle, style, pitch);
    cache.set(key, s);
  }
  return s;
}

// Colour indices inside the sprite buffer.
const OUTLINE = 1;
const DARK = 2;
const BASE = 3;
const LIGHT = 4;
const HANDLE_BASE = 5;
const HANDLE_DARK = 6;
const STICK = 7;
const ACCENT = 8;

function build(color, r, tilt, open, inv, handle, style, pitch) {
  const pal = UMBRELLA_COLORS[color];
  const st = STYLES[style];
  const g = canopyGeom(r, open, style);
  const { R, L } = g;
  const ry = Math.max(1, g.ry * (1 + pitch * 0.2));
  const h = g.h * (1 - pitch * 0.14);
  const W = 2 * r + 14;
  const ay = Math.round(r * 2.05) + 4;
  const H = ay + Math.round(r * 1.5) + 6;
  const ax = Math.floor(W / 2);
  const cx = ax + 0.5;
  const cy = ay + 0.5;
  const b = new PixBuf(W, H);

  // The handle leans opposite to the tip.
  const bx = ax - Math.round(tilt * 0.4);
  if (handle === 'j') {
    b.line(ax, ay, bx, ay + L, HANDLE_BASE);
    b.line(ax + 1, ay, bx + 1, ay + L, HANDLE_DARK);
    for (let x = bx - 2; x <= bx + 1; x++) b.set(x, ay + L + 1, x === bx + 1 ? HANDLE_DARK : HANDLE_BASE);
    b.set(bx - 3, ay + L, HANDLE_BASE);
    b.set(bx - 3, ay + L - 1, HANDLE_BASE);
  }

  const tipX = cx + tilt;
  const tipY = inv ? cy + h * 0.7 : cy - h;
  const n = r < 9 ? (style === 'wagasa' ? 6 : 4) : st.n;
  const a0 = inv ? Math.PI : 0;
  const rim = [];
  const mid = [];
  for (let k = 0; k <= n; k++) {
    const a = a0 + (k * Math.PI) / n;
    rim.push([cx + Math.cos(a) * R, cy + Math.sin(a) * ry]);
  }
  // Scallops: the fabric between two rib ends sags toward the tip.
  for (let k = 0; k < n; k++) {
    const a = a0 + ((k + 0.5) * Math.PI) / n;
    const ex = cx + Math.cos(a) * R;
    const ey = cy + Math.sin(a) * ry;
    mid.push([ex + (tipX - ex) * st.sag, ey + (tipY - ey) * st.sag]);
  }

  const tip = [tipX, tipY];
  const along = (p, t) => [tipX + (p[0] - tipX) * t, tipY + (p[1] - tipY) * t];
  const hull = [tip];
  for (let k = 0; k <= n; k++) {
    hull.push(rim[k]);
    if (k < n) hull.push(mid[k]);
  }
  b.fillPoly(hull, BASE);

  for (let k = 0; k < n; k++) {
    let shade;
    if (inv) shade = k % 2 ? DARK : BASE;
    else if (st.pattern === 'stripe') shade = k % 2 ? BASE : ACCENT;
    else if (st.pattern === 'clear') shade = LIGHT;
    else shade = k % 2 ? BASE : LIGHT;
    b.fillPoly([tip, rim[k], mid[k], rim[k + 1]], shade);
  }
  const ribColor = inv ? OUTLINE : st.pattern === 'clear' ? BASE : DARK;
  for (let k = 1; k < n; k++) b.line(tipX, tipY, rim[k][0], rim[k][1], ribColor);

  if (!inv) {
    if (st.pattern === 'dots') {
      const big = r >= 12;
      for (let k = 0; k < n; k++) {
        for (const t of k % 2 ? [0.42, 0.82] : [0.62]) {
          const [px, py] = along(mid[k], t);
          b.set(px, py, ACCENT);
          if (big) {
            b.set(px + 1, py, ACCENT);
            b.set(px, py + 1, ACCENT);
            b.set(px + 1, py + 1, ACCENT);
          }
        }
      }
    } else if (st.pattern === 'band') {
      for (let k = 0; k < n; k++) {
        const p0 = along(rim[k], 0.4);
        const p1 = along(rim[k + 1], 0.4);
        b.line(p0[0], p0[1], p1[0], p1[1], ACCENT);
      }
      b.set(tipX, tipY - 2, OUTLINE);
    } else if (st.pattern === 'clear') {
      for (let t = 0.25; t < 0.75; t += 0.08) {
        const [px, py] = along(rim[n - 2], t);
        b.set(px + 1, py, ACCENT);
      }
    } else if (st.pattern === 'frill') {
      for (let k = 0; k < n; k++) {
        b.line(rim[k][0], rim[k][1], mid[k][0], mid[k][1], ACCENT);
        b.line(mid[k][0], mid[k][1], rim[k + 1][0], rim[k + 1][1], ACCENT);
      }
    }
    b.set(tipX, tipY - 1, OUTLINE);
  }
  for (let k = 0; k <= n; k++) b.set(rim[k][0], rim[k][1], OUTLINE);

  b.outline(OUTLINE);

  // NPCs only show a dark stick under the canopy, as in the reference.
  if (handle === 'stick') {
    const y0 = ay + Math.ceil(ry) + 2;
    const y1 = ay + L + 2;
    for (let y = y0; y <= y1; y++) {
      const x = Math.round(ax + (bx - ax) * ((y - y0) / Math.max(1, y1 - y0)));
      b.set(x, y, STICK);
      b.set(x + 1, y, STICK);
    }
  }

  const canvas = b.toCanvas([
    null,
    pal.outline,
    pal.dark,
    pal.base,
    pal.light,
    HANDLE.base,
    HANDLE.dark,
    PAL.npcHandle,
    pal.accent,
  ]);
  return { canvas, ax, ay };
}

const whiteCache = new WeakMap();

// Solid white silhouette of a sprite (hit flash).
function white(cv) {
  let w = whiteCache.get(cv);
  if (!w) {
    w = document.createElement('canvas');
    w.width = cv.width;
    w.height = cv.height;
    const c = w.getContext('2d');
    c.drawImage(cv, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w.width, w.height);
    whiteCache.set(cv, w);
  }
  return w;
}

// Umbrella objects carry x, y (rim centre), r, color, style, tilt, open, inv,
// handle, bobY, and optionally flashT (white flash) and groundY (for floaters).
// `row` turns a y into a screen row: World.sy for umbrellas the street carries
// along (u.rides), so they step together with the pavement.
export function drawUmbrella(ctx, u, row = Math.round) {
  const s = umbrellaSprite(u.color, u.r, u.tilt, u.open, u.inv, u.handle, u.style, u.pitch);
  const cv = u.flashT > 0 ? white(s.canvas) : s.canvas;
  ctx.drawImage(cv, Math.round(u.x) - s.ax, row(u.y + (u.bobY || 0)) - s.ay);
}

// Upside-down copy mirrored about the ground under the umbrella.
export function drawReflection(ctx, u, row = Math.round) {
  const s = umbrellaSprite(u.color, u.r, u.tilt, u.open, u.inv, u.handle, u.style, u.pitch);
  const gy = row(u.groundY ?? u.y + u.r * 0.95);
  ctx.save();
  ctx.translate(0, gy * 2);
  ctx.scale(1, -1);
  ctx.drawImage(s.canvas, Math.round(u.x) - s.ax, row(u.y + (u.bobY || 0)) - s.ay);
  ctx.restore();
}

export function drawShadow(ctx, u, color = PAL.shadow, row = Math.round) {
  const rx = Math.max(2, Math.round(u.r * 0.8 * (0.4 + 0.6 * u.open)));
  const ry = Math.max(1, Math.round(u.r * 0.3));
  const cv = ellipseSprite(rx, ry, color, true);
  ctx.drawImage(cv, Math.round(u.x + 3) - rx, row(u.y + u.r * 0.95) - ry);
}

// Whether a raindrop landing at (x, y) hits this umbrella's canopy.
export function canopyContains(u, x, y) {
  const { R, ry, h } = canopyGeom(u.r, u.open, u.style);
  const top = u.y - h;
  if (y < top || y > u.y + ry) return false;
  const t = Math.min(1, (y - top) / h);
  return Math.abs(x - (u.x + (u.tilt || 0) * (1 - t))) <= R * Math.max(0.15, t);
}
