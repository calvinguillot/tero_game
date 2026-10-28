import { CHAPTERS, starsFor } from "../game/chapters.js";
import { overlapRatio } from "../game/collision.js";
import { loveUmbrella, drawKeepsake, drawRibbon } from "../game/love.js";
import { Decor } from "../world/decor.js";
import { saveData } from "../core/storage.js";
import { rand, clamp } from "../core/math.js";
import { PAL, UMBRELLA_COLORS } from "../render/palette.js";
import { drawText } from "../render/font.js";
import { drawUmbrella } from "../render/umbrella.js";
import { PF_W, PF_H, GROUND_L, GROUND_R } from "../config.js";
import { inPlayfield } from "./street.js";
import { PlayScene } from "./play.js";
import { StoryMenuScene } from "./storymenu.js";
import { VignetteScene } from "./vignette.js";
import { FinaleScene } from "./finale.js";

const BASE_SPEED = 34; // the street's pace when you just keep up
const PUSH_LINE = 150; // walking above this line pushes the street faster
const PUSH = 1.1; // extra px/s of street for each px above the line
const MAX_PUSH = 56;
const HIT_COST = 3; // seconds
const KEEPSAKE_TIME = 2; // seconds
const DROP_EVERY = 2.2; // seconds between keepsakes
const NEAR_MISS = 2.0;
const HER_Y = 20; // she walks just ahead, near the top of the street

// The chapter being built: tuning() runs inside PlayScene's constructor,
// before `this` holds anything of ours.
let building = null;

// Story mode: one chapter of "Finding Love". The place, hour and weather are
// fixed; you have a distance to walk before the time runs out. Walking up the
// street pushes it along faster (less time to see who's coming), a bump costs
// three seconds, and what she leaves behind gives some back. Halfway there's
// a ribbon: run out of time after it and you start again from there.
export class StoryScene extends PlayScene {
  constructor(game, index, { checkpoint = null } = {}) {
    building = CHAPTERS[index];
    super(game);
    const ch = building;
    this.index = index;
    this.ch = ch;
    const w = this.world;
    w.sky.dayNight = true;
    w.sky.time = ch.time;
    w.sky.cycle = 1e9;
    w.sky.autoWeather = false;
    w.zones = [{ loc: ch.place, b: Infinity }];
    w.decor = new Decor(w);
    w.animals.list = [];
    this.timeLeft = checkpoint ? checkpoint.time : ch.limit;
    this.walked = checkpoint ? ch.dist / 2 : 0;
    this.checkpoint = checkpoint;
    this.ribbon = null; // screen y of the halfway post while it passes
    this.her = loveUmbrella(90, ch.special === "glance" ? 72 : HER_Y);
    this.herTarget = 90;
    this.herT = 2;
    this.mirages =
      ch.special === "mirage" ? [loveUmbrella(50, HER_Y), loveUmbrella(130, HER_Y)] : [];
    this.keepsakes = [];
    this.dropT = 1;
    this.sunny = false;
    this.endT = 0;
    this.stars = 0;
    this.toasts.push({ text: ch.title, t: 0 });
  }

  tuning() {
    return {
      diffKey: "story",
      d: building.d,
      dayLength: 1e9,
      weatherPace: 1,
      weathers: [building.weather],
    };
  }

  get pauseItems() {
    return ["RESUME", "RESTART", "PHOTO", "CHAPTERS"];
  }

  restart() {
    this.game.go(new StoryScene(this.game, this.index));
  }

  leave() {
    this.game.go(new StoryMenuScene(this.game, this.index));
  }

  // HUD fields.
  get nextAt() {
    return null;
  }
  get level() {
    return `CHAPTER ${this.index + 1}`;
  }
  get timeName() {
    return this.ch.hour;
  }
  get progress() {
    return clamp(this.walked / this.ch.dist, 0, 1);
  }
  get chapterInfo() {
    return { left: Math.max(0, this.timeLeft), progress: this.progress };
  }

  // She's drawn and lit with you, when she can be seen.
  get walkers() {
    return this.her.alpha > 0.5 ? [this.player, this.her] : [this.player];
  }

  crowdWeights() {
    return this.ch.crowd;
  }

  // On the last stretch to her, the crowd thins out to nobody.
  spawn() {
    if (this.ch.special === "reunion" && this.progress > 0.5) return;
    super.spawn();
  }

  streetSpeed() {
    const ahead = (PUSH_LINE - this.player.y) * PUSH;
    return BASE_SPEED + clamp(ahead, 0, MAX_PUSH);
  }

  update(dt) {
    const before = this.world.scrollY;
    super.update(dt);
    if (this.photo || this.paused) return;
    const sc = this.world.scrollY - before;
    if (this.state === "play" && this.freeze <= 0) this.updateRun(dt, sc);
    else if (this.state !== "play") this.updateEnd(dt);
    this.updateHer(dt);
    this.updateKeepsakes(dt, sc);
    if (this.ribbon !== null) {
      this.ribbon += sc;
      if (this.ribbon > PF_H + 20) this.ribbon = null;
    }
  }

  updateRun(dt, sc) {
    const ch = this.ch;
    this.walked += sc;
    const was = this.timeLeft;
    this.timeLeft -= dt;
    // The last five seconds tick.
    if (this.timeLeft < 5 && Math.ceil(this.timeLeft) !== Math.ceil(was))
      this.sound("tick");
    if (!this.checkpoint && this.walked >= ch.dist / 2) {
      this.checkpoint = { time: this.timeLeft };
      this.ribbon = -4;
      this.toasts.push({ text: "HALFWAY", t: 0 });
      this.sound("checkpoint");
    }
    // At dawn the rain stops for the last of the way.
    if (ch.special === "reunion" && !this.sunny && this.progress > 0.75) {
      this.sunny = true;
      if (this.world.sky.setWeather("sunny", 5)) this.quietWeather++;
    }
    if (this.walked >= ch.dist) this.arrive();
    else if (this.timeLeft <= 0) this.outOfTime();
  }

  arrive() {
    const { data } = this.game;
    const s = data.story;
    const i = this.index;
    this.state = "arrive";
    this.endT = 0;
    this.stars = starsFor(this.ch, this.timeLeft);
    s.stars[i] = Math.max(s.stars[i] ?? 0, this.stars);
    s.best[i] = Math.max(s.best[i] ?? 0, Math.round(this.timeLeft * 10) / 10);
    s.unlocked = Math.max(s.unlocked, Math.min(CHAPTERS.length, i + 2));
    saveData(data);
    this.sound("lifeUp");
  }

  outOfTime() {
    this.state = "timeup";
    this.endT = 0;
    this.timeLeft = 0;
    this.sound("gameOver");
  }

  updateEnd(dt) {
    const { input } = this.game;
    this.endT += dt;
    if (this.endT < 0.8) return;
    const go = input.hit("confirm") || input.hit("action");
    if (input.hit("pause")) return this.leave();
    if (!go) return;
    if (this.state === "timeup") {
      const from = this.checkpoint;
      this.game.go(new StoryScene(this.game, this.index, { checkpoint: from }));
    } else if (this.index === CHAPTERS.length - 1) {
      this.game.go(new FinaleScene(this.game));
    } else {
      this.game.go(new VignetteScene(this.game, this.index + 1));
    }
  }

  // She walks ahead, drifting from side to side. At the start of the first
  // chapter she's close and looks back; in the storm only the lightning shows
  // her; at the end of a chapter she slips away (or, at dawn, waits).
  updateHer(dt) {
    const h = this.her;
    const ch = this.ch;
    const sky = this.world.sky;
    if ((this.herT -= dt) <= 0) {
      this.herT = rand(2.5, 4);
      this.herTarget = rand(GROUND_L + 22, GROUND_R - 22);
    }
    const waiting = ch.special === "reunion" && this.state === "arrive";
    let ty = HER_Y;
    if (this.state === "arrive") ty = waiting ? 80 : -40;
    else if (ch.special === "glance" && this.t < 3) ty = 72;
    h.y += (ty - h.y) * Math.min(1, dt * (this.state === "arrive" ? 1.2 : 0.8));
    h.x += clamp(this.herTarget - h.x, -18 * dt, 18 * dt);
    const glancing = ch.special === "glance" && this.t > 0.8 && this.t < 2.6;
    h.tilt = glancing ? -3 : Math.sin(this.t * 1.7) * 1.2;
    h.bobY = Math.round(Math.sin(this.t * 6) * 0.6);
    h.open += ((sky.p.open > 0.5 ? 1 : 0.35) - h.open) * Math.min(1, dt * 3);
    h.alpha = ch.special === "lightning" ? Math.min(1, sky.flash * 3) : 1;
    // Mirages shimmer beside her and fade in and out.
    this.mirages.forEach((m, i) => {
      m.x = clamp(h.x + (i ? 44 : -44), GROUND_L + 14, GROUND_R - 14);
      m.y = h.y + Math.sin(this.t * 2 + i) * 2;
      m.tilt = Math.sin(this.t * 3 + i * 2) * 2;
      m.alpha = 0.25 + 0.3 * Math.abs(Math.sin(this.t * 1.3 + i * 1.7));
    });
  }

  // She leaves a trail; walk over it to pick it up.
  updateKeepsakes(dt, sc) {
    const kind = this.ch.keepsake;
    if (kind && this.state === "play" && (this.dropT -= dt) <= 0) {
      this.dropT = DROP_EVERY;
      const x = this.her.x + rand(-4, 4);
      this.keepsakes.push({ kind, x, y: this.her.y + 14 });
    }
    const p = this.player;
    for (const k of this.keepsakes) {
      k.y += sc;
      const near = Math.abs(k.x - p.x) < 12 && Math.abs(k.y - (p.y + 10)) < 12;
      if (near && this.state === "play") {
        k.taken = true;
        this.timeLeft += KEEPSAKE_TIME;
        this.popup("+2 S", k.x, k.y - 8, { color: UMBRELLA_COLORS.love.light });
        this.sound("keepsake");
      }
    }
    this.keepsakes = this.keepsakes.filter((k) => !k.taken && k.y < PF_H + 10);
  }

  checkNpcs() {
    const p = this.player;
    for (const n of this.npcs) {
      if (n.touched || n.shooed) continue;
      const gap = overlapRatio(p, n, this.d.hitScale);
      n.minGap = Math.min(n.minGap ?? Infinity, gap);
      if (gap < 1 && p.invT <= 0 && p.shieldT <= 0) {
        this.bump(n);
      } else if (!n.scored && n.y > p.y + 6) {
        n.scored = true;
        if (n.minGap < NEAR_MISS && p.invT <= 0) this.closeCall(n);
      }
    }
  }

  // A bump costs time, not a life.
  bump(n) {
    const p = this.player;
    const dir = Math.sign(n.x - p.x) || 1;
    n.touched = true;
    n.knockV = dir * 70;
    n.wob = 1;
    n.flashT = 0.12;
    p.vx -= dir * 80;
    p.hitT = 0.55;
    p.invT = this.d.invuln;
    p.flashT = 0.12;
    this.timeLeft -= HIT_COST;
    this.popup(`-${HIT_COST} S`, p.x, p.y - 30, { color: "#ff8a8a", scale: 2 });
    this.sound("hit");
    this.freeze = 0.08;
    this.hitFlash = 0.15;
    this.shakeFor(0.25);
    this.world.addRipple(p.x, p.y + 10, 18, 3, 1.1);
  }

  // A near miss still sparkles and charges the field.
  closeCall(n) {
    const p = this.player;
    const mx = (n.x + p.x) / 2;
    const my = (n.y + p.y) / 2 - 10;
    this.world.burst(mx, my, 8, UMBRELLA_COLORS[p.color].accent, 50);
    this.popup("CLOSE!", mx, my - 6, { color: UMBRELLA_COLORS[p.color].light });
    this.field.bonus(2);
    this.closes++;
    this.sound("close");
  }

  drawGround(ctx) {
    for (const k of this.keepsakes) drawKeepsake(ctx, k, this.world.sy);
    if (this.ribbon !== null) drawRibbon(ctx, Math.round(this.ribbon));
  }

  draw(ctx, L) {
    super.draw(ctx, L);
    if (this.photo || this.paused) return;
    inPlayfield(ctx, L, () => {
      // Mirages are only half there.
      for (const m of this.mirages) {
        ctx.globalAlpha = m.alpha;
        drawUmbrella(ctx, m);
      }
      ctx.globalAlpha = 1;
      if (this.state === "arrive" && this.endT > 0.6) this.drawClear(ctx);
      if (this.state === "timeup") this.drawTimeUp(ctx);
    });
  }

  drawClear(ctx) {
    const c = PF_W / 2;
    const opt = { shadow: PAL.textShadow, align: "center" };
    ctx.fillStyle = PAL.overlay;
    ctx.fillRect(0, 60, PF_W, 112);
    const last = this.index === CHAPTERS.length - 1;
    drawText(ctx, last ? "THERE SHE IS" : "SO CLOSE...", c, 72, PAL.text, {
      ...opt,
      scale: 2,
    });
    // Hearts for stars.
    for (let i = 0; i < 3; i++) {
      const on = i < this.stars;
      const color = on ? UMBRELLA_COLORS.love.base : PAL.textDim;
      drawText(ctx, "*", c - 18 + i * 18, 96, color, { ...opt, scale: 3 });
    }
    drawText(ctx, `${this.timeLeft.toFixed(1)} S TO SPARE`, c, 128, PAL.text, opt);
    if (Math.floor(this.endT * 2.5) % 2 === 0)
      drawText(ctx, "SPACE OR TAP TO GO ON", c, 152, PAL.text, opt);
  }

  drawTimeUp(ctx) {
    ctx.globalAlpha = Math.min(1, this.endT * 3);
    const c = PF_W / 2;
    const opt = { shadow: PAL.textShadow, align: "center" };
    ctx.fillStyle = PAL.overlay;
    ctx.fillRect(0, 0, PF_W, PF_H);
    drawText(ctx, "SHE'S GONE", c, 76, PAL.text, { ...opt, scale: 2 });
    drawText(ctx, "OUT OF TIME", c, 98, PAL.textDim, opt);
    if (this.endT > 0.8) {
      const from = this.checkpoint ? "FROM THE RIBBON" : "FROM THE START";
      if (Math.floor(this.endT * 2.5) % 2 === 0)
        drawText(ctx, "SPACE OR TAP: TRY AGAIN", c, 140, PAL.text, opt);
      drawText(ctx, from, c, 150, PAL.textDim, opt);
      drawText(ctx, "ESC FOR CHAPTERS", c, 170, PAL.textDim, opt);
    }
    ctx.globalAlpha = 1;
  }
}
