import { PAL } from '../render/palette.js';
import { WALL, GROUND_R } from '../config.js';

const AWNINGS = ['#e05a6a', '#3fa6ef', '#f2b03a'];

function canvas(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'));
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
  hedge: () => [
    canvas(WALL, 12, (c) => {
      c.fillStyle = '#2f6b3a';
      c.fillRect(0, 0, WALL, 12);
      c.fillStyle = '#3f8a45';
      for (let i = 0; i < 26; i++) c.fillRect((i * 7) % 11, (i * 5) % 12, 2, 1);
      c.fillStyle = '#5aa84f';
      for (let i = 0; i < 10; i++) c.fillRect((i * 5 + 3) % 11, (i * 7 + 1) % 12, 1, 1);
      c.fillStyle = '#f4a6c6';
      c.fillRect(3, 4, 1, 1);
      c.fillStyle = '#ffffff';
      c.fillRect(8, 9, 1, 1);
      c.fillStyle = '#24552e';
      c.fillRect(11, 0, 1, 12);
    }),
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
