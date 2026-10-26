import { PAL } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { umbrellaSprite } from '../render/umbrella.js';
import { ellipseSprite } from '../render/pixels.js';
import { LOCATIONS, LOCATION_ORDER } from '../world/locations.js';
import { wallTile } from '../world/walls.js';
import { animalIcon } from '../world/animals.js';
import { drawHud } from '../ui/hud.js';
import { drawKey, drawChargeBar } from '../ui/controls.js';
import { plate, hint } from '../ui/menu.js';
import { inPlayfield } from './street.js';
import { menuHud } from './backdrop.js';
import { MenuScene } from './menu.js';
import { PF_W, PF_H } from '../config.js';

const opt = { shadow: PAL.textShadow };

// Lines starting with '!' are highlighted (the '!' itself isn't drawn).
function lines(ctx, list, x, y, step = 9) {
  list.forEach((l, i) => {
    const hi = l.startsWith('!');
    drawText(ctx, hi ? l.slice(1) : l, x, y + i * step, hi ? PAL.text : PAL.textDim, opt);
  });
}

function umbrella(ctx, color, r, x, y, style = 'classic', handle = 'stick', open = 1) {
  const s = umbrellaSprite(color, r, 0, open, false, handle, style);
  ctx.drawImage(s.canvas, Math.round(x) - s.ax, Math.round(y) - s.ay);
}

function caption(ctx, text, x, y) {
  drawText(ctx, text, x, y, PAL.text, { ...opt, align: 'center' });
}

const WALKERS = [
  [
    { name: 'COMMUTER', color: 'npc', r: 13, lines: ['WALKS STRAIGHT AHEAD,', 'A LITTLE SWAY. THE', 'MOST COMMON WALKER.'] },
    { name: 'WANDERER', color: 'npcRose', r: 13, lines: ['WEAVES SLOWLY FROM', 'SIDE TO SIDE.', 'GIVE THEM ROOM.'] },
    { name: 'ELDER', color: 'npcSand', r: 16, style: 'wagasa', lines: ['BIG, SLOW AND WOBBLY.', 'A MOVING WALL: GO', 'AROUND EARLY.'] },
  ],
  [
    { name: 'HURRIER', color: 'npcSlate', r: 12, lines: ['SMALL AND FAST. LEANS,', 'SHOWS ! AND CHANGES', 'LANE ONCE.', '!FROM 8 POINTS'] },
    { name: 'PAIR', color: 'npc', r: 11, pair: true, lines: ['TWO FRIENDS SIDE BY', 'SIDE, IN STEP. GO', 'AROUND BOTH.', '!FROM 15 POINTS'] },
    { name: 'KID', color: 'npcYellow', r: 10, style: 'polka', lines: ['TINY AND BOUNCY. HOPS', 'WITH ! THEN DARTS', 'SIDEWAYS.', '!FROM 30 POINTS'] },
  ],
];

function walkerPage(ctx, list, footnote) {
  list.forEach((w, i) => {
    const y = 34 + i * 58;
    if (w.pair) {
      umbrella(ctx, w.color, 10, 22, y + 22, 'classic');
      umbrella(ctx, 'npcSand', 10, 42, y + 22, 'classic');
    } else {
      umbrella(ctx, w.color, w.r, 28, y + 22, w.style);
    }
    drawText(ctx, w.name, 58, y + 2, PAL.text, opt);
    lines(ctx, w.lines, 58, y + 12);
  });
  if (footnote) drawText(ctx, 'POINTS ON NORMAL. SOONER ON HARD.', 90, 206, PAL.textDim, { ...opt, align: 'center' });
}

const PLACES = {
  town: ['BRICK WALLS, DRAINS,', 'PIGEONS AND CATS.'],
  park: ['HEDGES, DRIPPING TREES,', 'DUCKS AND FROGS.'],
  market: ['SHOP AWNINGS, CRATES', 'AND TILED PAVEMENT.'],
  harbor: ['CANAL RAILS, LAMPS,', 'GULLS ON THE BOARDS.'],
};

const ANIMALS = [
  ['pigeon', 'PIGEON', 'FLIES OFF'],
  ['cat', 'CAT', 'DASHES AWAY'],
  ['duck', 'DUCKS', 'HURRY ALONG'],
  ['frog', 'FROG', 'HOPS AWAY'],
  ['gull', 'GULL', 'FLIES OFF'],
  ['snail', 'SNAIL', 'TAKES ITS TIME'],
];

const PAGES = [
  {
    title: 'THE STREET',
    draw(ctx) {
      lines(ctx, ['WALK UP THE RAINY STREET.', '', '!EVERY UMBRELLA THAT GETS', '!PAST YOU SCORES +1.', '', 'BUMP INTO ONE AND YOU LOSE', 'A LIFE. YOU HAVE THREE, AND', 'EVERY 100 POINTS GIVES ONE', 'BACK (UP TO FOUR).', '', 'THE CROWD GETS FASTER AND', 'BUSIER AS YOU SCORE.'], 14, 34);
      umbrella(ctx, 'npc', 13, 44, 178);
      umbrella(ctx, 'npcSand', 13, 136, 172);
      caption(ctx, '+1', 44, 152);
      caption(ctx, '+1', 136, 146);
      umbrella(ctx, menuColor, 14, 90, 196, menuStyle, 'j');
      caption(ctx, 'YOU', 116, 196);
    },
  },
  {
    title: 'CONTROLS',
    draw(ctx) {
      const acc = '#86bcd6';
      ['W', 'A', 'S', 'D'].forEach((k, i) => drawKey(ctx, i === 0 ? 24 : 14 + (i - 1) * 10, i === 0 ? 34 : 44, k, false, acc));
      ['^', '<', 'V', '>'].forEach((k, i) => drawKey(ctx, i === 0 ? 64 : 54 + (i - 1) * 10, i === 0 ? 34 : 44, k, false, acc));
      drawText(ctx, 'MOVE', 100, 44, PAL.text, opt);
      drawKey(ctx, 14, 64, 'SPACE', false, acc, 25);
      drawKey(ctx, 42, 64, 'SHIFT', false, acc, 25);
      drawText(ctx, 'FORCE FIELD', 100, 66, PAL.text, opt);
      drawKey(ctx, 14, 82, 'ESC', false, acc, 17);
      drawKey(ctx, 34, 82, 'P', false, acc);
      drawText(ctx, 'PAUSE', 100, 84, PAL.text, opt);
      lines(ctx, ['!ON A TOUCH SCREEN', 'DRAG ON THE STICK SIDE TO', 'MOVE. TAP THE ROUND BUTTON', 'FOR THE FORCE FIELD. THE', 'II KEY PAUSES.', '', '!IN MENUS', 'ARROWS AND SPACE, OR', 'JUST TAP AN OPTION.'], 14, 108);
    },
  },
  {
    title: 'FORCE FIELD',
    draw(ctx, t) {
      lines(ctx, ['PRESS SPACE (OR THE BUTTON)', 'TO BURST. EVERY UMBRELLA', 'THE WAVE TOUCHES IS PUSHED', 'AWAY AND SNAPS SHUT. RAIN', 'AND RIPPLES ARE SWEPT OUT.', '', '!CLOSED UMBRELLAS CAN\'T', '!HURT YOU - BUT THEY GIVE', '!NO POINT.', '', 'IT RECHARGES OVER TIME. EACH', 'CLOSE! NEAR MISS ADDS A BOOST.'], 14, 34);
      umbrella(ctx, 'npc', 14, 44, 182);
      caption(ctx, '>', 90, 178);
      umbrella(ctx, 'npc', 14, 136, 182, 'classic', 'stick', 0.15);
      drawChargeBar(ctx, 90, 206, 60, (t * 0.25) % 1, false, menuColor, t);
    },
  },
  { title: "WHO'S WHO 1/2", draw: (ctx) => walkerPage(ctx, WALKERS[0]) },
  { title: "WHO'S WHO 2/2", draw: (ctx) => walkerPage(ctx, WALKERS[1], true) },
  {
    title: 'PLACES',
    draw(ctx) {
      drawText(ctx, 'A NEW PLACE EVERY 25 POINTS.', 90, 32, PAL.text, { ...opt, align: 'center' });
      LOCATION_ORDER.forEach((key, i) => {
        const loc = LOCATIONS[key];
        const y = 46 + i * 40;
        ctx.fillStyle = loc.ground;
        ctx.fillRect(26, y, 22, 28);
        const tile = wallTile(loc.wall);
        for (let ty = 0; ty < 28; ty += tile.height) ctx.drawImage(tile, 0, 0, tile.width, Math.min(tile.height, 28 - ty), 14, y + ty, tile.width, Math.min(tile.height, 28 - ty));
        ctx.drawImage(ellipseSprite(6, 3, loc.ripple[0], false), 31, y + 11);
        drawText(ctx, loc.name, 56, y + 3, PAL.text, opt);
        lines(ctx, PLACES[key], 56, y + 13);
      });
    },
  },
  {
    title: 'ANIMALS',
    draw(ctx) {
      lines(ctx, ['ANIMALS CROSS NOW AND THEN.', 'THEY ARE HARMLESS AND GET', 'OUT OF YOUR WAY.'], 14, 34);
      ANIMALS.forEach(([kind, name, what], i) => {
        const x = i % 2 ? 98 : 14;
        const y = 76 + Math.floor(i / 2) * 40;
        const cv = animalIcon(kind);
        ctx.drawImage(cv, x + 8 - Math.floor(cv.width / 2), y + 8 - cv.height);
        drawText(ctx, name, x + 20, y, PAL.text, opt);
        drawText(ctx, what, x + 20, y + 9, PAL.textDim, opt);
      });
    },
  },
  {
    title: 'SKY',
    draw(ctx) {
      lines(ctx, [
        'THE DAY PASSES AS YOU PLAY,',
        'FROM MORNING TO NIGHT. AT',
        'NIGHT, STREET LAMPS LIGHT',
        'THE WAY. THE WEATHER CHANGES',
        'TOO, AND IT MATTERS:',
        '',
        '!SUNNY',
        'UMBRELLAS CLOSE: THINNER TO',
        'DODGE. BUT PUDDLES ARE SLICK.',
        '!HAZY',
        'FOG HIDES WHO IS COMING.',
        'WATCH THEIR SHADOWS.',
        '!STORMY',
        'HEAVY RAIN AND LIGHTNING.',
        'GUSTS PUSH YOU SIDEWAYS -',
        'WIND >>> WARNS YOU FIRST.',
      ], 14, 32, 10);
    },
  },
  {
    title: 'TIPS',
    draw(ctx) {
      lines(ctx, ['- WATCH FOR ! : SOMEONE IS', '  ABOUT TO MOVE.', '', '- NEAR MISSES CHARGE THE', '  FIELD. SQUEEZE THROUGH!', '', '- SAVE THE FIELD FOR', '  TIGHT SPOTS.', '', '- STAY LOW ON THE SCREEN TO', '  SEE THE CROWD COMING.', '', '- PASS ELDERS EARLY.', '', '- NEW TO IT? TRY EASY.'], 14, 34);
    },
  },
];

let menuColor = 'mint';
let menuStyle = 'classic';

// How to play, one page at a time: left/right or tap the sides to flip.
export class GuideScene {
  constructor(game) {
    this.game = game;
    this.bd = game.backdrop;
    this.page = 0;
    this.t = 0;
  }

  flip(dir) {
    const page = Math.max(0, Math.min(PAGES.length - 1, this.page + dir));
    if (page !== this.page) this.game.audio.menuMove();
    this.page = page;
  }

  update(dt) {
    const { input } = this.game;
    this.t += dt;
    this.bd.update(dt);
    if (input.hit('left')) this.flip(-1);
    if (input.hit('right')) this.flip(1);
    const tap = input.takeTap();
    if (tap) {
      input.hit('confirm');
      const x = tap.x - this.game.display.layout.pfX;
      if (x < PF_W / 3) this.flip(-1);
      else if (this.page === PAGES.length - 1) return this.game.go(new MenuScene(this.game, 2));
      else this.flip(1);
    }
    if (input.hit('confirm')) {
      if (this.page === PAGES.length - 1) return this.game.go(new MenuScene(this.game, 2));
      this.flip(1);
    }
    if (input.hit('pause')) this.game.go(new MenuScene(this.game, 2));
  }

  draw(ctx, L) {
    ({ color: menuColor, style: menuStyle } = this.game.data.settings);
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    drawHud(ctx, L, menuHud(this.game, this.bd), this.game.input);
    inPlayfield(ctx, L, () => {
      this.bd.draw(ctx);
      plate(ctx, 6, 6, PF_W - 12, PF_H - 12);
      const page = PAGES[this.page];
      drawText(ctx, page.title, 90, 14, PAL.text, { ...opt, scale: 2, align: 'center' });
      page.draw(ctx, this.t);
      const first = this.page === 0;
      const lastPage = this.page === PAGES.length - 1;
      drawText(ctx, `${first ? ' ' : '<'} ${this.page + 1}/${PAGES.length} ${lastPage ? ' ' : '>'}`, 90, 218, PAL.text, { ...opt, align: 'center' });
      hint(ctx, lastPage ? 'SPACE: DONE' : 'SPACE: NEXT   ESC: BACK', 228);
    });
  }
}
