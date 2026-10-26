import { PixBuf } from './pixels.js';

const cache = new Map();

// Builds a sprite from text rows: each character maps to a colour in
// `colors`, '.' is transparent. Cached per key and facing.
export function charSprite(key, rows, colors, flip = false) {
  const k = `${key}|${flip ? 1 : 0}`;
  let cv = cache.get(k);
  if (cv) return cv;
  const chars = Object.keys(colors);
  const w = Math.max(...rows.map((r) => r.length));
  const b = new PixBuf(w, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const i = chars.indexOf(row[x]);
      if (i >= 0) b.set(flip ? w - 1 - x : x, y, i + 1);
    }
  });
  cv = b.toCanvas([null, ...chars.map((c) => colors[c])]);
  cache.set(k, cv);
  return cv;
}

// Shifts the top `n` rows sideways by one pixel (cheap sway frame).
export const swayRows = (rows, n) => rows.map((r, i) => (i < n ? '.' + r.slice(0, -1) : r));
