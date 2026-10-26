import { charSprite } from '../render/sprites.js';
import { rand, randInt, pick } from '../core/math.js';
import { PF_H, GROUND_L, GROUND_R } from '../config.js';

// All sprites face right and are mirrored when walking left.
const PIGEON_ROWS = [
  ['......gg.', '.....gpkG', 'G...gpg..', 'GGgggggg.', '.Gggggg..', '...o.o...'],
  ['.......gg', '......gkG', 'G...gpg..', 'GGgggggg.', '.Gggggg..', '....o.o..'],
];
const BIRD_FLY = [
  ['g.......g', 'gg.....gg', '.ggggggg.', '..gpgkG..', '...ggg...'],
  ['.........', '.........', 'ggggggggg', '..gpgkG..', '...ggg...'],
];
const DUCK_ROWS = [
  ['......ww..', '.....wwkoo', 'w....wws..', 'ww.wwwwws.', 'wwwwwwwss.', '.sssssss..', '...o..o...'],
  ['......ww..', '.....wwkoo', 'w....wws..', 'ww.wwwwws.', 'wwwwwwwss.', '.sssssss..', '....oo....'],
];

const KINDS = {
  pigeon: {
    frames: PIGEON_ROWS,
    fly: BIRD_FLY,
    colors: { g: '#9aa6b4', G: '#6f7c8c', p: '#8a6aa8', k: '#1a2630', o: '#d07a8a' },
    speed: 16,
    startle: 'fly',
  },
  gull: {
    frames: PIGEON_ROWS,
    fly: BIRD_FLY,
    colors: { g: '#eef2f4', G: '#a7b2bc', p: '#d9e0e4', k: '#1a2630', o: '#f0c040' },
    speed: 18,
    startle: 'fly',
  },
  cat: {
    frames: [
      ['........d.d.', '........ddd.', 'd.......dyd.', '.d.dddddddd.', '..dDDDDDdd..', '..d.d...d.d.'],
      ['........d.d.', '........ddd.', 'd.......dyd.', '.d.dddddddd.', '..dDDDDDdd..', '...dd...dd..'],
    ],
    colors: { d: '#2c2f3a', D: '#454a58', y: '#f2d04a' },
    speed: 60,
    animRate: 12,
    startle: 'dash',
  },
  duck: {
    frames: DUCK_ROWS,
    colors: { w: '#f4f6f2', s: '#c3ced3', k: '#1a2630', o: '#f0a030' },
    speed: 14,
    trail: true,
    startle: 'hurry',
  },
  duckling: {
    frames: [
      ['...yy.', '..yyko', 'yyyyY.', '.YYY..', '.o..o.'],
      ['...yy.', '..yyko', 'yyyyY.', '.YYY..', '..oo..'],
    ],
    colors: { y: '#ffd94a', Y: '#e0b030', k: '#1a2630', o: '#f0a030' },
    speed: 14,
    trail: true,
    startle: 'hurry',
  },
  frog: {
    frames: [['G.....G', 'GgkgkgG', '.ggggg.', '.gGgGg.', 'Gg...gG', 'G.....G']],
    colors: { g: '#4fae4a', G: '#2f7a34', k: '#14261a' },
    speed: 0,
    hop: true,
    startle: 'hop',
  },
  snail: {
    frames: [['..bbb.....', '.bBbBb..k.', '.bbBbb..y.', 'yyyyyyyyy.']],
    colors: { b: '#a8743a', B: '#7a4e22', y: '#d8cfa0', k: '#3a3020' },
    speed: 3,
    startle: 'none',
  },
};

function sprite(kind, rows, frame, flip, fly = false) {
  return charSprite(`animal-${kind}-${fly ? 'f' : 'w'}${frame}`, rows[frame], KINDS[kind].colors, flip);
}

// Standing frame, for icons.
export function animalIcon(kind) {
  return sprite(kind, KINDS[kind].frames, 0, false);
}

class Animal {
  constructor(kind, x, y, dir) {
    const k = KINDS[kind];
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.speed = k.speed * rand(0.85, 1.15);
    this.t = rand(0, 1);
    this.state = 'walk'; // walk | fly | hurry
    this.z = 0;
    this.hopT = rand(0.2, 0.8);
    this.hopping = 0;
    this.trailT = 0;
  }

  startle(fromX) {
    const how = KINDS[this.kind].startle;
    if (this.state !== 'walk' || how === 'none') return;
    if (how === 'fly') this.state = 'fly';
    else if (how === 'dash') this.speed = 140;
    else if (how === 'hurry') this.speed *= 2.2;
    else if (how === 'hop') {
      this.dir = this.x >= fromX ? 1 : -1;
      this.hopT = 0;
    }
    if (how !== 'fly') this.state = 'hurry';
  }

  update(dt, sc, world) {
    const k = KINDS[this.kind];
    this.t += dt;
    this.y += sc;
    if (this.state === 'fly') {
      this.x += this.dir * 70 * dt;
      this.y -= 70 * dt;
      this.z = Math.min(this.z + dt * 40, 20);
      return;
    }
    if (k.hop) {
      if (this.hopping > 0) {
        this.hopping -= dt;
        this.x += this.dir * 55 * dt;
        this.z = Math.sin((1 - this.hopping / 0.28) * Math.PI) * 4;
        if (this.hopping <= 0) {
          this.z = 0;
          world.addRipple(this.x, this.y, 5, 1, 0.6);
        }
      } else if ((this.hopT -= dt) <= 0) {
        this.hopping = 0.28;
        this.hopT = this.state === 'hurry' ? 0.05 : rand(0.4, 1.1);
      }
      return;
    }
    this.x += this.dir * this.speed * dt;
    if (k.trail && (this.trailT -= dt) <= 0) {
      this.trailT = 0.4;
      world.addRipple(this.x - this.dir * 3, this.y, 4, 1, 0.7);
    }
  }

  get gone() {
    return this.x < GROUND_L - 24 || this.x > GROUND_R + 24 || this.y > PF_H + 12 || this.y < -40;
  }

  draw(ctx) {
    const k = KINDS[this.kind];
    const flip = this.dir < 0;
    let cv;
    if (this.state === 'fly') cv = sprite(this.kind, k.fly, Math.floor(this.t * 10) % 2, flip, true);
    else cv = sprite(this.kind, k.frames, Math.floor(this.t * (k.animRate || 6)) % k.frames.length, flip);
    ctx.drawImage(cv, Math.round(this.x - cv.width / 2), Math.round(this.y - cv.height - this.z));
  }
}

// Wildlife crossing the street now and then. Harmless: it just gets out of
// the way when the player (or the force field) comes close.
export class Animals {
  constructor(world) {
    this.world = world;
    this.list = [];
    this.nextT = rand(2, 5);
  }

  spawn(loc) {
    const kind = pick(loc.animals);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x = dir > 0 ? GROUND_L - 8 : GROUND_R + 8;
    const y = rand(30, 120);
    if (kind === 'ducks') {
      this.list.push(new Animal('duck', x, y, dir));
      const n = randInt(2, 4);
      for (let i = 0; i < n; i++) this.list.push(new Animal('duckling', x - dir * (10 + i * 8), y + rand(-1, 2), dir));
      for (const a of this.list.slice(-n - 1)) a.speed = 14;
    } else {
      this.list.push(new Animal(kind, x, y, dir));
    }
  }

  startle(x, y, radius) {
    for (const a of this.list) {
      if (Math.hypot(a.x - x, (a.y - y) * 2) < radius) a.startle(x);
    }
  }

  update(dt, sc) {
    if ((this.nextT -= dt) <= 0) {
      this.nextT = rand(6, 13);
      this.spawn(this.world.locAt(60));
    }
    const p = this.world.player;
    for (const a of this.list) {
      a.update(dt, sc, this.world);
      if (p && !p.dead && Math.abs(a.x - p.x) < 22 && Math.abs(a.y - (p.y + 12)) < 14) a.startle(p.x);
    }
    this.list = this.list.filter((a) => !a.gone);
  }

  drawGround(ctx) {
    for (const a of this.list) if (a.state !== 'fly') a.draw(ctx);
  }

  drawAir(ctx) {
    for (const a of this.list) if (a.state === 'fly') a.draw(ctx);
  }
}
