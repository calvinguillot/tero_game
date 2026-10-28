import { World } from '../world/world.js';
import { Sky } from '../world/sky.js';
import { LOCATION_ORDER } from '../world/locations.js';
import { Npc, separate } from '../game/npc.js';
import { DIFFICULTY } from '../game/difficulty.js';
import { bestScore } from '../core/storage.js';
import { rand } from '../core/math.js';
import { PF_H } from '../config.js';
import { drawStreet } from './street.js';

const SHOWCASE_EVERY = 14; // seconds per location while the street scrolls

// The rainy street behind the splash screen and menus. One instance is shared
// so moving between menus doesn't reset the rain.
export class Backdrop {
  constructor(game) {
    this.game = game;
    const s = game.data.settings;
    const sky = new Sky({ time: 0.3, cycle: 180, dayNight: s.dayNight });
    this.world = new World({ speed: 0, location: LOCATION_ORDER[0], lowFx: !s.fx, sky });
    this.npcs = [];
    this.walkers = false;
    this.speed = 0;
    this.spawnT = 1;
    this.showT = 0;
    this.locIndex = 0;
    this.t = 0;
  }

  update(dt, extra = []) {
    this.t += dt;
    const w = this.world;
    const s = this.game.data.settings;
    w.lowFx = !s.fx;
    w.softFlash = !s.flash;
    w.sky.setDayNight(s.dayNight);
    w.sky.takeEvents();
    w.speed +=(this.speed - w.speed) * Math.min(1, dt * 2);
    w.umbrellas = this.npcs.concat(extra);
    w.update(dt);

    if (this.walkers && (this.spawnT -= dt) <= 0) {
      this.spawnT = rand(2, 3.5);
      const x = Math.random() < 0.5 ? rand(26, 58) : rand(122, 154);
      this.npcs.push(new Npc(Math.random() < 0.5 ? 'commuter' : 'wanderer', x, -20, { sway: 0.6, npcSpeed: 1 }));
    }
    for (const n of this.npcs) n.update(dt, w, null);
    separate(this.npcs, dt);
    this.npcs = this.npcs.filter((n) => n.y < PF_H + 30);

    if (this.speed > 0 && (this.showT += dt) > SHOWCASE_EVERY) {
      this.showT = 0;
      this.locIndex++;
      w.setLocation(LOCATION_ORDER[this.locIndex % LOCATION_ORDER.length]);
    }
  }

  draw(ctx, extra = [], overlay = null) {
    drawStreet(ctx, this.world, this.npcs.concat(extra), { overlay });
  }
}

// HUD contents while in menus.
export function menuHud(game, backdrop) {
  const s = game.data.settings;
  return {
    title: true,
    color: s.color,
    style: s.style,
    best: bestScore(game.data, 'arcade', s.difficulty),
    location: backdrop.world.topLocation.name,
    timeName: backdrop.world.sky.timeName,
    weatherName: backdrop.world.sky.label(backdrop.world.locAt(150).precip === 'snow'),
    level: s.mode === 'arcade' ? DIFFICULTY[s.difficulty].name : s.mode.toUpperCase(),
    charge: 1,
    ready: true,
    t: backdrop.t,
  };
}

// The player's umbrella as shown in menus.
export function heroUmbrella(game, x, y, r) {
  const { color, style } = game.data.settings;
  return { x, y, r, color, style, tilt: 0, open: 1, inv: false, handle: 'j', bobY: 0 };
}
