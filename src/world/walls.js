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
  // Snowy village: a snow bank behind a capped wooden fence with icicles,
  // and snow-covered bushes.
  snowfence: () => [
    canvas(WALL, 12, (c) => {
      c.fillStyle = '#dfeef6';
      c.fillRect(0, 0, WALL, 12);
      c.fillStyle = '#b8d2e2';
      c.fillRect(8, 0, 1, 12);
      c.fillStyle = '#6a4e30';
      c.fillRect(0, 4, 9, 2);
      c.fillRect(0, 9, 9, 2);
      c.fillStyle = '#4a3622';
      c.fillRect(2, 2, 2, 10);
      c.fillStyle = '#ffffff';
      c.fillRect(0, 3, 9, 1);
      c.fillRect(0, 8, 9, 1);
      c.fillRect(2, 1, 2, 1);
      c.fillStyle = '#a8d4ec';
      c.fillRect(9, 4, 1, 3);
      c.fillRect(10, 5, 1, 1);
      c.fillRect(9, 9, 1, 2);
    }),
    leafy(16, [
      [5, 5, 6.5, 5],
      [5, 13, 6, 4.5],
    ], ['#c8dce8', '#e8f4fa', '#ffffff', '#8aa8bc'], [[3, 8, '#2c5a44'], [7, 9, '#2c5a44'], [4, 15, '#2c5a44']]),
  ],
  // Sand dunes with marram grass.
  dune: () => [
    leafy(16, [
      [4, 4, 6, 5],
      [6, 12, 6.5, 5],
    ], ['#b8985e', '#d4b67a', '#ecd49e', '#9a7c4a'], [[4, 2, '#6a8a3a'], [5, 1, '#6a8a3a'], [7, 11, '#7a9a4a'], [8, 10, '#7a9a4a'], [3, 13, '#6a8a3a']]),
    leafy(16, [
      [6, 8, 6.5, 6],
      [3, 1, 5, 3],
      [3, 15, 5, 3],
    ], ['#b8985e', '#d4b67a', '#ecd49e', '#9a7c4a'], [[5, 6, '#7a9a4a'], [6, 5, '#7a9a4a']]),
  ],
  // The sea, with foam where the waves wash up the sand.
  surf: () =>
    [0, 1].map((v) =>
      canvas(WALL, 12, (c) => {
        c.fillStyle = '#2a6a8a';
        c.fillRect(0, 0, WALL, 12);
        c.fillStyle = '#4a9ab8';
        c.fillRect(1, 2 + v * 4, 4, 1);
        c.fillRect(3, 8 - v * 3, 3, 1);
        const edge = (y) => 8 + Math.round(Math.sin((y + v * 6) * 0.55) * 1.5);
        c.fillStyle = '#cfe8ee';
        for (let y = 0; y < 12; y++) c.fillRect(edge(y), y, 4, 1);
        c.fillStyle = '#ffffff';
        for (let y = 0; y < 12; y += 3) c.fillRect(edge(y), y, 1, 1);
      }),
    ),
  // Adobe walls with roof-beam ends and the odd window.
  adobe: () =>
    [false, true].map((win) =>
      canvas(WALL, 20, (c) => {
        c.fillStyle = '#c88a5a';
        c.fillRect(0, 0, WALL, 20);
        c.fillStyle = '#e0a878';
        c.fillRect(0, 0, WALL, 1);
        c.fillRect(0, 10, WALL, 1);
        c.fillStyle = '#a86a40';
        c.fillRect(10, 0, 2, 20);
        c.fillStyle = '#5a3a22';
        c.fillRect(9, 3, 3, 2);
        c.fillRect(9, 13, 3, 2);
        if (win) {
          c.fillStyle = '#e0a878';
          c.fillRect(2, 5, 5, 7);
          c.fillStyle = '#4a2a1a';
          c.fillRect(3, 6, 3, 5);
        } else {
          c.fillStyle = '#b87a4c';
          c.fillRect(3, 6, 1, 1);
          c.fillRect(6, 16, 1, 1);
        }
      }),
    ),
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

// `rightType` gives the right-hand side a different wall (the sea at the beach).
export function drawWalls(ctx, scrollY, type, top, bottom, rightType = type) {
  column(ctx, scrollY, tileSet(type).left, 0, top, bottom, 0);
  column(ctx, scrollY, tileSet(rightType).right, GROUND_R, top, bottom, 1);
  ctx.fillStyle = 'rgba(10, 30, 45, 0.25)';
  ctx.fillRect(WALL, top, 2, bottom - top);
  ctx.fillRect(GROUND_R - 1, top, 1, bottom - top);
}

function column(ctx, scrollY, list, x, top, bottom, shift) {
  const th = list[0].height;
  const off = Math.floor(scrollY) % th;
  for (let y = off - th; y < bottom; y += th) {
    if (y + th < top) continue;
    // Index in world space so each tile keeps its variant while scrolling.
    const i = Math.abs(Math.round((y - Math.floor(scrollY)) / th)) + shift;
    ctx.drawImage(list[i % list.length], x, y);
  }
}
