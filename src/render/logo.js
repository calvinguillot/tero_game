import { PixBuf } from './pixels.js';

// "A Rainy Day" wordmark in a chunky serif, after the original title screen:
// mixed case, a raindrop instead of the dot on the i, and a hard shadow.
const CAPS = 2; // rows above cap height (room for the raindrop)
const LOWER = 6; // x-height starts here

const G = {
  A: [
    '.....#.....',
    '....###....',
    '....###....',
    '...#.###...',
    '...#.###...',
    '..#...###..',
    '..#######..',
    '.#.....###.',
    '.#.....###.',
    '#.......###',
    '###....####',
  ],
  R: [
    '#######...',
    '.###..###.',
    '.###...###',
    '.###...###',
    '.###..###.',
    '.######...',
    '.###.###..',
    '.###..###.',
    '.###..###.',
    '.###...###',
    '#####..###',
  ],
  D: [
    '########...',
    '.###...##..',
    '.###....##.',
    '.###....###',
    '.###....###',
    '.###....###',
    '.###....###',
    '.###....###',
    '.###....##.',
    '.###...##..',
    '########...',
  ],
  a: ['.#####..', '##...##.', '.....##.', '.######.', '##...##.', '##..###.', '.###.###'],
  i: ['###.', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  n: ['###.###..', '.###..##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '####.####'],
  y: ['###...###', '.##....#.', '..##..##.', '..##..#..', '...####..', '...###...', '....##...', '....#....', '#..##....', '###......'],
};
const DROP = ['.#.', '.#.', '###', '###', '.#.'];

const LINES = [
  { x: 0, top: 0, text: 'A Rainy' },
  { x: 20, top: 14, text: 'Day' },
];

function build() {
  const width = (t) => [...t].reduce((w, ch) => w + (ch === ' ' ? 4 : G[ch][0].length + 1), 0);
  const W = Math.max(...LINES.map((l) => l.x + width(l.text))) + 2;
  const H = 14 + CAPS + 16 + 2;
  const b = new PixBuf(W, H);
  for (const line of LINES) {
    let x = line.x;
    for (const ch of line.text) {
      if (ch === ' ') {
        x += 4;
        continue;
      }
      const rows = G[ch];
      const top = line.top + (ch === ch.toUpperCase() ? CAPS : LOWER);
      rows.forEach((row, y) => {
        for (let i = 0; i < row.length; i++) if (row[i] === '#') b.set(x + i, top + y, 1);
      });
      if (ch === 'i') {
        DROP.forEach((row, y) => {
          for (let i = 0; i < row.length; i++) if (row[i] === '#') b.set(x + i, line.top + y, 3);
        });
        b.set(x, line.top + 2, 4);
      }
      x += rows[0].length + 1;
    }
  }
  // Hard drop shadow down-right.
  const shadow = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (b.get(x, y) && !b.get(x + 1, y + 1)) shadow.push([x + 1, y + 1]);
  }
  for (const [x, y] of shadow) b.set(x, y, 2);
  return b.toCanvas([null, '#f4fbff', '#14384d', '#62e2ff', '#ffffff']);
}

let logo = null;

export function drawLogo(ctx, cx, y, scale = 1) {
  logo ??= build();
  const w = logo.width * scale;
  ctx.drawImage(logo, Math.round(cx - w / 2), Math.round(y), w, logo.height * scale);
}
