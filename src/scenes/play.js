import { World } from '../world/world.js';
import { LOCATIONS, LOCATION_ORDER } from '../world/locations.js';
import { Player } from '../game/player.js';
import { Npc, separate } from '../game/npc.js';
import { ForceField, FIELD_RADIUS } from '../game/forcefield.js';
import { DIFFICULTY, intensity, spawnWeights } from '../game/difficulty.js';
import { overlapRatio } from '../game/collision.js';
import { bestScore, submitScore } from '../core/storage.js';
import { lerp, rand, pick } from '../core/math.js';
import { PAL, UMBRELLA_COLORS } from '../render/palette.js';
import { drawText } from '../render/font.js';
import { drawHud } from '../ui/hud.js';
import { navigate, plate, menuItem } from '../ui/menu.js';
import { PF_W, PF_H, GROUND_L, GROUND_R } from '../config.js';
import { inPlayfield, drawStreet } from './street.js';
import { MenuScene } from './menu.js';

const START_LIVES = 3;
const POINTS_PER_LOCATION = 25;
const FIELD_BONUS = 0.5; // seconds of recharge per point scored
const MILESTONE = 10; // celebrate every N points
const NEAR_MISS = 2.0; // squared hitbox distance below which a pass sparkles
const PAUSE_ITEMS = ['RESUME', 'RESTART', 'MAIN MENU'];

// Arcade mode: dodge the crowd, +1 for every umbrella that gets past you.
export class PlayScene {
  constructor(game) {
    this.game = game;
    const { difficulty, color, style, fx } = game.data.settings;
    this.diffKey = difficulty;
    this.d = DIFFICULTY[difficulty];
    this.color = color;
    this.style = style;
    this.world = new World({ speed: this.d.speedStart, location: LOCATION_ORDER[0], lowFx: !fx });
    this.player = new Player(color, style);
    this.world.player = this.player;
    this.field = new ForceField(this.d.recharge);
    this.npcs = [];
    this.popups = [];
    this.toast = null;
    this.t = 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.maxLives = START_LIVES;
    this.prevBest = bestScore(game.data, 'arcade', difficulty);
    this.best = this.prevBest; // shown in the HUD, climbs with the score
    this.spawnT = 0.8;
    this.freeze = 0;
    this.shake = 0;
    this.hitFlash = 0;
    this.bumpT = 0;
    this.lifeLostT = 0;
    this.state = 'play'; // play | dying | over
    this.overT = 0;
    this.paused = false;
    this.pauseSel = 0;
    this.newBest = false;
  }

  // HUD fields.
  get charge() {
    return this.field.charge;
  }
  get ready() {
    return this.field.ready;
  }
  get location() {
    return this.world.topLocation.name;
  }
  get nextAt() {
    return (Math.floor(this.score / POINTS_PER_LOCATION) + 1) * POINTS_PER_LOCATION;
  }
  get level() {
    return this.d.name;
  }

  pause() {
    if (this.state === 'play') {
      this.paused = true;
      this.pauseSel = 0;
    }
  }

  shakeFor(seconds) {
    if (this.game.data.settings.shake) this.shake = Math.max(this.shake, seconds);
  }

  updatePause() {
    const { input, display } = this.game;
    if (input.hit('pause')) {
      this.paused = false;
      return;
    }
    const rects = PAUSE_ITEMS.map((_, i) => ({ x: 20, y: 102 + i * 20 - 4, w: 140, h: 20 }));
    const { sel, act } = navigate(input, display.layout, this.pauseSel, rects);
    this.pauseSel = sel;
    if (!act) return;
    input.hit('action');
    if (sel === 0) this.paused = false;
    else if (sel === 1) this.game.go(new PlayScene(this.game));
    else this.game.go(new MenuScene(this.game));
  }

  update(dt) {
    const { input } = this.game;
    this.t += dt;

    if (this.paused) return this.updatePause();
    if (this.state === 'play' && input.hit('pause')) return this.pause();
    if (this.state === 'over') {
      this.overT += dt;
      if (this.overT > 0.6) {
        if (input.hit('confirm')) return this.game.go(new PlayScene(this.game));
        if (input.hit('pause')) return this.game.go(new MenuScene(this.game));
      }
    }

    this.bumpT = Math.max(0, this.bumpT - dt);
    this.lifeLostT = Math.max(0, this.lifeLostT - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.toast) {
      this.toast.t += dt;
      if (this.toast.t > 2.6) this.toast = null;
    }
    // Hit-stop: freeze the action for a few frames on impact.
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }

    if (this.state === 'play' && input.hit('action')) this.fireField();

    const I = intensity(this.score);
    this.world.speed = this.state === 'play' ? lerp(this.d.speedStart, this.d.speedMax, I) : lerp(this.world.speed, 12, dt * 2);
    this.world.umbrellas = this.npcs.concat(this.player);
    this.world.update(dt);
    this.field.update(dt, this.world.speed * dt);
    this.player.update(dt, this.state === 'play' ? input : null, this.world);

    if (this.state === 'play') {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = lerp(this.d.spawnStart, this.d.spawnMin, I) * rand(0.75, 1.25);
        this.spawn();
      }
    }

    for (const n of this.npcs) n.update(dt, this.world, this.player);
    separate(this.npcs, dt);
    this.applyField();
    this.npcs = this.npcs.filter((n) => n.y < PF_H + 30 && n.y > -80);

    if (this.state === 'play') this.checkNpcs();

    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.life);

    if (this.state === 'dying' && this.player.deadT > 1.3) {
      this.state = 'over';
      this.newBest = this.score > this.prevBest;
      submitScore(this.game.data, 'arcade', this.diffKey, this.score);
    }
  }

  checkNpcs() {
    const p = this.player;
    for (const n of this.npcs) {
      if (n.touched || n.shooed) continue;
      const gap = overlapRatio(p, n, this.d.hitScale);
      n.minGap = Math.min(n.minGap ?? Infinity, gap);
      if (p.invT <= 0 && p.shieldT <= 0 && gap < 1) {
        this.hit(n);
        if (this.state !== 'play') return;
      } else if (!n.scored && n.y > p.y + 6) {
        n.scored = true;
        this.addPoint(n);
      }
    }
  }

  popup(text, x, y, { color = PAL.text, scale = 1, life = 0.7 } = {}) {
    this.popups.push({ text, x, y, color, scale, life, t: 0 });
  }

  addPoint(n) {
    const p = this.player;
    this.score++;
    this.best = Math.max(this.best, this.score);
    this.bumpT = 0.15;
    this.field.bonus(FIELD_BONUS);
    if (n.minGap < NEAR_MISS && p.invT <= 0) {
      // Squeezed past: sparkle in the gap.
      const mx = (n.x + p.x) / 2;
      const my = (n.y + p.y) / 2 - 10;
      this.world.burst(mx, my, 8, UMBRELLA_COLORS[p.color].accent, 50);
      this.popup('CLOSE!', mx, my - 6, { color: UMBRELLA_COLORS[p.color].light });
    } else {
      this.popup('+1', n.x, n.y - n.r);
    }
    if (this.score % MILESTONE === 0) {
      this.bumpT = 0.6;
      this.popup(`${this.score}!`, p.x, p.y - 30, { scale: 2, color: UMBRELLA_COLORS[p.color].light, life: 1.1 });
      this.world.burst(p.x, p.y - 8, 18, UMBRELLA_COLORS[p.color].light, 90);
    }
    const loc = LOCATION_ORDER[Math.floor(this.score / POINTS_PER_LOCATION) % LOCATION_ORDER.length];
    if (this.world.setLocation(loc)) this.toast = { text: LOCATIONS[loc].name, t: 0 };
  }

  // The lane (x) farthest from walkers near the top, for a walker of half-width `half`.
  freeLane(half) {
    let bestX = GROUND_L + half;
    let bestGap = -1;
    for (let i = 0; i < 8; i++) {
      const x = rand(GROUND_L + half, GROUND_R - half);
      let gap = Infinity;
      for (const n of this.npcs) if (n.y < 40) gap = Math.min(gap, Math.abs(n.x - x));
      if (gap > bestGap) [bestGap, bestX] = [gap, x];
    }
    return bestX;
  }

  spawn() {
    const kind = pick(spawnWeights(this.score, this.d));
    if (kind === 'pair') {
      // Two commuters walking side by side, in step.
      const x = this.freeLane(32);
      const a = new Npc('commuter', x - 15, -20, this.d);
      const b = new Npc('commuter', x + 15, -21, this.d);
      b.syncWith(a);
      this.npcs.push(a, b);
      return;
    }
    this.npcs.push(new Npc(kind, this.freeLane(16), -20, this.d));
  }

  // Burst: the field's front sweeps outward over the next few frames (applyField).
  fireField() {
    const p = this.player;
    if (!this.field.fire(p.x, p.y)) return;
    p.shieldT = 0.5;
    this.world.displace(p.x, p.y, 20);
    this.world.addRipple(p.x, p.y + 10, 26, 3, 1.2);
    this.world.animals.startle(p.x, p.y, FIELD_RADIUS * 1.2);
    this.freeze = 0.05;
    this.shakeFor(0.18);
  }

  // Every umbrella the expanding front reaches is shoved away and closes up
  // (harmless, no point); the water inside is pushed out with it, and rain
  // bounces off the dome until it fades.
  applyField() {
    const domes = [];
    for (const w of this.field.waves) {
      const rf = this.field.front(w);
      domes.push({ x: w.x, y: w.y, r: rf });
      if (!this.field.expanding(w)) continue;
      for (const n of this.npcs) {
        if (n.shooed) continue;
        const dx = n.x - w.x;
        const dy = (n.y - w.y) * 2;
        const d = Math.hypot(dx, dy) || 1;
        if (d > rf + n.r * 0.6) continue;
        n.shoo(dx / d, dy / d);
        this.world.splash(n.x, n.y - n.r * 0.6, 6, PAL.splash, true, 50);
      }
      this.world.pushWater(w.x, w.y, rf);
    }
    this.world.domes = domes;
  }

  hit(npc) {
    const p = this.player;
    const dir = Math.sign(npc.x - p.x) || 1;
    npc.touched = true;
    npc.knockV = dir * 70;
    npc.wob = 1;
    npc.flashT = 0.12;
    p.vx -= dir * 80;
    p.hitT = 0.55;
    p.invT = this.d.invuln;
    p.flashT = 0.12;
    this.lives--;
    this.lifeLostT = 0.6;
    this.freeze = 0.08;
    this.hitFlash = 0.15;
    this.shakeFor(0.25);
    this.world.addRipple(p.x, p.y + 10, 18, 3, 1.1);
    this.world.splash(p.x, p.y - 6, 12, PAL.splash, true, 70);
    if (this.lives <= 0) {
      this.state = 'dying';
      p.die();
    }
  }

  draw(ctx, L) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    drawHud(ctx, L, this, this.game.input);

    const p = this.player;
    const umbrellas = this.npcs.concat(p);
    inPlayfield(
      ctx,
      L,
      () =>
        drawStreet(ctx, this.world, umbrellas, p.visible ? null : p, () => {
          this.field.draw(ctx, p);
          // "!" over walkers about to make a move.
          for (const n of this.npcs) {
            if (n.alert && Math.floor(this.t * 10) % 2 === 0) {
              drawText(ctx, '!', n.x, n.y - n.r * 1.4 - 8, '#ffffff', { align: 'center', shadow: PAL.textShadow });
            }
          }
          this.drawPopups(ctx);
          this.drawToast(ctx);
        }),
      this.shake,
    );
    // A brief warm tint when you get hit.
    if (this.hitFlash > 0 && this.game.data.settings.fx) {
      inPlayfield(ctx, L, () => {
        ctx.fillStyle = `rgba(255, 120, 140, ${(this.hitFlash / 0.15) * 0.22})`;
        ctx.fillRect(0, 0, PF_W, PF_H);
      });
    }

    if (this.paused) inPlayfield(ctx, L, () => this.drawPaused(ctx));
    if (this.state === 'over') inPlayfield(ctx, L, () => this.drawGameOver(ctx));
  }

  drawPopups(ctx) {
    for (const p of this.popups) {
      const k = p.t / p.life;
      // Pop up fast, then drift; blink out at the end.
      const rise = (1 - (1 - Math.min(1, k * 2.5)) ** 2) * 14 + k * 6;
      if (k > 0.75 && Math.floor(p.t * 20) % 2) continue;
      drawText(ctx, p.text, p.x, p.y - rise, p.color, { align: 'center', shadow: PAL.textShadow, scale: p.scale });
    }
  }

  // Location name slides in from the top when a new area begins.
  drawToast(ctx) {
    if (!this.toast) return;
    const t = this.toast.t;
    const y = Math.round(t < 0.3 ? -10 + (t / 0.3) * 30 : t > 2.3 ? 20 - ((t - 2.3) / 0.3) * 30 : 20);
    drawText(ctx, `- ${this.toast.text} -`, PF_W / 2, y, PAL.text, { scale: 2, shadow: PAL.textShadow, align: 'center' });
  }

  drawPaused(ctx) {
    ctx.fillStyle = PAL.overlay;
    ctx.fillRect(0, 0, PF_W, PF_H);
    drawText(ctx, 'PAUSED', 90, 66, PAL.text, { scale: 2, shadow: PAL.textShadow, align: 'center' });
    plate(ctx, 14, 92, 152, PAUSE_ITEMS.length * 20 + 8);
    PAUSE_ITEMS.forEach((label, i) => menuItem(ctx, label, 90, 102 + i * 20, i === this.pauseSel, this.t));
    drawText(ctx, 'ESC TO RESUME', 90, 172, PAL.textDim, { align: 'center', shadow: PAL.textShadow });
  }

  drawGameOver(ctx) {
    ctx.globalAlpha = Math.min(1, this.overT * 3);
    ctx.fillStyle = PAL.overlay;
    ctx.fillRect(0, 0, PF_W, PF_H);
    const c = PF_W / 2;
    const blink = Math.floor(this.overT * 2.5) % 2 === 0;
    drawText(ctx, 'GAME OVER', c, 70, PAL.text, { scale: 2, shadow: PAL.textShadow, align: 'center' });
    drawText(ctx, 'SCORE', c, 98, PAL.textDim, { align: 'center' });
    drawText(ctx, this.score, c, 108, PAL.text, { scale: 3, shadow: PAL.textShadow, align: 'center' });
    if (this.newBest) {
      if (blink) drawText(ctx, '* NEW BEST *', c, 132, PAL.rippleHi, { align: 'center', shadow: PAL.textShadow });
    } else {
      drawText(ctx, `BEST ${this.prevBest}`, c, 132, PAL.textDim, { align: 'center' });
    }
    if (this.overT > 0.6) {
      if (blink) drawText(ctx, 'SPACE OR TAP TO RETRY', c, 172, PAL.text, { align: 'center', shadow: PAL.textShadow });
      drawText(ctx, 'ESC FOR MENU', c, 184, PAL.textDim, { align: 'center' });
    }
    ctx.globalAlpha = 1;
  }
}
