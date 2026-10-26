import { PAL } from '../render/palette.js';
import { PixBuf } from '../render/pixels.js';
import { WALL, GROUND_R } from '../config.js';

const AWNINGS = ['#e05a6a', '#3fa6ef', '#f2b03a'];

function canvas(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'));
  return cv;
}

// A wall tile of leafy blobs: a dark base up to the wall line, round blobs
// that bulge onto the pavement, highlights, an outline, and a few `dots`.
// colors: [base, leaf, highlight, outline].
function leafy(h, blobs, colors, dots) {
  const b = new PixBuf(WALL, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < WALL - 2; x++) b.set(x, y, 1);
  for (const [x, y, rx, ry] of blobs) b.fillEllipse(x, y, rx, ry, 2);
  for (const [x, y, rx, ry] of blobs) b.fillEllipse(x - 1, y - 1.5, rx * 0.45, ry * 0.45, 3);
  b.outline(4);
  const cv = b.toCanvas([null, ...colors]);
  const c = cv.getContext('2d');
  for (const [x, y, col] of dots) {
    c.fillStyle = col;
    c.fillRect(x, y, 1, 1);
  }
  return cv;
}

function mirrored(src) {
  return canvas(src.width, src.height, (c) => {
    c.scale(-1, 1);
    c.drawImage(src, -src.width, 0);
  });
}

// Tiles are drawn for the left wall (street on their right) and mirrored.
const BUILDERS = {
  brick: () => [
    canvas(WALL, 12, (c) => {
      c.fillStyle = PAL.wallMortar;
      c.fillRect(0, 0, WALL, 12);
      c.fillStyle = PAL.wallFace;
      c.fillRect(1, 1, 10, 10);
      c.fillStyle = PAL.wallHi;
      c.fillRect(1, 1, 10, 1);
      c.fillRect(1, 1, 1, 10);
      c.fillStyle = PAL.wallShadow;
      c.fillRect(1, 10, 10, 1);
      c.fillRect(10, 2, 1, 9);
      c.fillStyle = PAL.wallDot;
      for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) c.fillRect(3 + x * 2, 3 + y * 2, 1, 1);
    }),
  ],
  // A row of round, clipped bushes with a few flowers; the street edge is bumpy.
  hedge: () => [
    leafy(16, [
      [5, 4, 6.5, 5],
      [6, 12, 6.5, 5],
    ], ['#24552e', '#3a8644', '#5aa84f', '#1d4a26'], [[7, 5, '#f4a6c6'], [3, 13, '#ffffff'], [8, 11, '#f4a6c6']]),
    leafy(16, [
      [6, 8, 6.5, 6],
      [3, 1, 5, 3],
      [3, 15, 5, 3],
    ], ['#24552e', '#3a8644', '#5aa84f', '#1d4a26'], [[5, 7, '#ffffff']]),
  ],
  // Dense treeline: dark crowns with the odd trunk showing.
  forest: () => [
    leafy(20, [
      [4, 4, 6, 5],
      [7, 12, 6, 5],
      [3, 18, 5, 4],
    ], ['#163a26', '#24563a', '#3a7a4a', '#0f2a1c'], [[2, 9, '#4a3a28'], [2, 10, '#4a3a28']]),
    leafy(20, [
      [6, 6, 6.5, 6],
      [4, 15, 6, 5],
    ], ['#163a26', '#2c6040', '#46884e', '#0f2a1c'], []),
  ],
  // Shopfronts with striped awnings reaching over the pavement.
  shop: () =>
    AWNINGS.map((col) =>
      canvas(WALL, 24, (c) => {
        for (let y = 0; y < 18; y++) {
          c.fillStyle = Math.floor(y / 3) % 2 ? '#f3e8da' : col;
          c.fillRect(0, y, 11, 1);
          if (y % 3 !== 2) c.fillRect(11, y, 1, 1);
        }
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(0, 17, 12, 1);
        c.fillStyle = '#4a4258';
        c.fillRect(0, 18, WALL, 6);
        c.fillStyle = '#ffe39a';
        c.fillRect(2, 20, 6, 2);
      }),
    ),
  // Canal water behind a wooden rail.
  rail: () => [
    canvas(WALL, 12, (c) => {
      c.fillStyle = '#23597a';
      c.fillRect(0, 0, WALL, 12);
      c.fillStyle = '#3a86a8';
      c.fillRect(1, 3, 3, 1);
      c.fillRect(4, 8, 3, 1);
      c.fillStyle = '#8a6a44';
      c.fillRect(9, 0, 2, 12);
      c.fillStyle = '#5a4228';
      c.fillRect(11, 0, 1, 12);
      c.fillStyle = '#6a4e30';
      c.fillRect(7, 0, 5, 3);
    }),
  ],
};

const tiles = {};
function tileSet(type) {
  if (!tiles[type]) {
    const left = BUILDERS[type]();
    tiles[type] = { left, right: left.map(mirrored), h: left[0].height };
  }
  return tiles[type];
}

// A left-wall tile, for icons.
export function wallTile(type) {
  return tileSet(type).left[0];
}

export function drawWalls(ctx, scrollY, type, top, bottom) {
  const set = tileSet(type);
  const th = set.h;
  const off = Math.floor(scrollY) % th;
  for (let y = off - th; y < bottom; y += th) {
    if (y + th < top) continue;
    // Index in world space so each tile keeps its variant while scrolling.
    const i = Math.abs(Math.round((y - Math.floor(scrollY)) / th)) % set.left.length;
    ctx.drawImage(set.left[i], 0, y);
    ctx.drawImage(set.right[(i + 1) % set.left.length], GROUND_R, y);
  }
  ctx.fillStyle = 'rgba(10, 30, 45, 0.25)';
  ctx.fillRect(WALL, top, 2, bottom - top);
  ctx.fillRect(GROUND_R - 1, top, 1, bottom - top);
}
