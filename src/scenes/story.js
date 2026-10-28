import { CHAPTERS, STORY, speedAt, starsFor } from "../game/chapters.js";
import { overlapRatio } from "../game/collision.js";
import { loveUmbrella, drawMarker } from "../game/love.js";
import { Decor } from "../world/decor.js";
import { saveData } from "../core/storage.js";
import { rand, clamp } from "../core/math.js";
import { PAL, UMBRELLA_COLORS } from "../render/palette.js";
import { drawText } from "../render/font.js";
import { drawUmbrella } from "../render/umbrella.js";
import { ellipseSprite } from "../render/pixels.js";
import { PF_W, PF_H, GROUND_L, GROUND_R } from "../config.js";
import { inPlayfield } from "./street.js";
import { PlayScene } from "./play.js";
import { StoryMenuScene } from "./storymenu.js";
import { VignetteScene } from "./vignette.js";
import { FinaleScene } from "./finale.js";

const RUN_OFF = 2.2; // seconds she takes to run off before the race starts
const HOME_Y = 190; // the finish line arrives here when the distance is done
const NEAR_MISS = 2.0;
const RED = UMBRELLA_COLORS.love;

// The chapter being built: tuning() runs inside PlayScene's constructor,
// before `this` holds anything of ours.
let building = null;

// Story mode: one chapter of "Finding Love", a race down one street to a
// finish line before the clock runs out. The street starts at the same pace in
// every chapter and builds up to the chapter's top speed (see STORY in
// chapters.js). A bump costs time; what she leaves behind gives some back.
//
// She's the reason you're running, not something to catch: she runs off at
// the start, and after that you only glimpse her far up the street now and
// then, as clearly as the weather allows. Run out of time and the chapter
// starts over.
export class StoryScene extends PlayScene {
  constructor(game, index) {
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
    this.timeLeft = STORY.startTime;
    this.started = false; // the race begins once she's run off
    this.startAt = 0; // world scroll when it began
    this.finishAt = Infinity; // world scroll at which the finish line reaches HOME_Y
    this.elapsed = 0; // seconds since "GO!"
    const { style } = game.data.settings;
    this.her = loveUmbrella(90, 118, 14, style);
    this.sightT = rand(...STORY.sightEvery);
    this.sightLeft = 0;
    this.herTarget = 90;
    this.mirages =
      ch.special === "mirage"
        ? [loveUmbrella(50, -40, 14, style), loveUmbrella(130, -40, 14, style)]
        : [];
    this.keepsakes = [];
    this.trailT = 1;
    this.dropT = 0;
    this.endT = 0;
    this.stars = 0;
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
  // Street walked since "GO!".
  get walked() {
    return this.started ? this.world.scrollY - this.startAt : 0;
  }
  get progress() {
    return clamp(this.walked / this.ch.dist, 0, 1);
  }
  get chapterInfo() {
    return { left: Math.max(0, this.timeLeft), progress: this.progress, closes: this.closes };
  }

  // She's drawn with you when she can be seen (but not lit up at night: she's
  // far away, and the dark should hide her a little).
  get walkers() {
    return this.her.alpha > 0.5 ? [this.player, this.her] : [this.player];
  }

  crowdWeights() {
    return this.ch.crowd;
  }

  // Walkers are spaced by distance, so the street is as busy at top speed
  // as at the start (by time, a fast street would thin out).
  spawnDelay() {
    return this.ch.crowdGap / Math.max(1, this.world.speed);
  }

  // The crowd comes from "GO!" until you cross the line.
  spawn() {
    if (this.started) super.spawn();
  }

  streetSpeed() {
    return speedAt(this.ch, this.progress);
  }

  obstacleDensity() {
    return this.started && this.progress < 0.96 ? this.ch.obstacles : 0;
  }

  // The finish line is a fixed place on the street (finishAt, in world
  // scroll): its screen row comes from how far the street has scrolled, so it
  // keeps moving with the street after you've crossed it. It reaches HOME_Y
  // when the distance is done; you finish when it passes under you.
  get finishY() {
    return HOME_Y - (this.finishAt - this.world.scrollY);
  }

  update(dt) {
    const before = this.world.scrollY;
    super.update(dt);
    if (this.photo || this.paused) return;
    const sc = this.world.scrollY - before;
    if (this.state === "play" && this.freeze <= 0) this.updateRace(dt, sc);
    else if (this.state !== "play") this.updateEnd(dt);
    this.updateHer(dt);
    this.updateKeepsakes(dt, sc);
  }

  updateRace(dt, sc) {
    const ch = this.ch;
    if (!this.started) {
      if (this.t < RUN_OFF) return;
      this.started = true;
      this.startAt = this.world.scrollY;
      this.finishAt = this.startAt + ch.dist;
      this.toasts.push({ text: "GO!", t: 0 });
      this.sound("rushStart");
      return;
    }
    this.elapsed += dt;
    const was = this.timeLeft;
    this.timeLeft -= dt;
    // The last five seconds tick.
    if (this.timeLeft < 5 && Math.ceil(this.timeLeft) !== Math.ceil(was))
      this.sound("tick");
    if (this.finishY >= this.player.y) this.arrive();
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
    // Records: only finished runs count. Fastest time and most CLOSE! are
    // kept separately (they needn't come from the same run).
    const r = (s.records[i] ??= {});
    // The time the clock counted: real time, plus bumps, minus her markers.
    const time = Math.round((STORY.startTime - this.timeLeft) * 10) / 10;
    this.raceTime = time;
    this.newTime = !(r.time <= time);
    this.newCloses = this.closes > (r.closes ?? -1);
    if (this.newTime) r.time = time;
    if (this.newCloses) r.closes = this.closes;
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
    const last = this.index === CHAPTERS.length - 1;
    // After the last chapter the ending follows by itself.
    const auto = last && this.state === "arrive" && this.endT > 4;
    const go = input.hit("confirm") || input.hit("action") || auto;
    if (input.hit("pause")) return this.leave();
    if (!go) return;
    if (this.state === "timeup") this.restart();
    else if (this.index === CHAPTERS.length - 1)
      this.game.go(new FinaleScene(this.game));
    else this.game.go(new VignetteScene(this.game, this.index + 1));
  }

  // At the start she's right there; she looks back at you, then runs off up
  // the street and is gone. After that she shows only now and then, far up
  // the street, and slips away again (at once, if you come too close).
  updateHer(dt) {
    const h = this.her;
    const sky = this.world.sky;
    // On snow and sand she leaves prints too (faintly red), while she's there.
    if (h.y > -4 && h.y < PF_H && (this.herStepT = (this.herStepT ?? 0) - dt) <= 0) {
      this.herStepT = 0.22;
      this.herSide = -(this.herSide || 1);
      this.world.leavePrint(h.x + this.herSide * 2, h.y + 13, true);
    }
    if (!this.started) {
      const t = this.t;
      h.tilt = t < 0.9 ? -3 * Math.min(1, t * 3) : 0;
      if (t > 0.9) h.y -= (40 + (t - 0.9) * 260) * dt;
      h.bobY = t > 0.9 ? (Math.floor(t * 14) % 2 ? -1 : 0) : 0;
      h.alpha = 1;
      return;
    }
    // A glimpse every so often.
    if (this.sightLeft > 0) {
      this.sightLeft -= dt;
      if (this.player.y < 80) this.sightLeft = 0;
    } else if ((this.sightT -= dt) <= 0 && this.state === "play") {
      this.sightT = rand(...STORY.sightEvery);
      this.sightLeft = rand(...STORY.sightFor);
      this.herTarget = rand(GROUND_L + 22, GROUND_R - 22);
      h.x = this.herTarget;
    }
    const ty = this.sightLeft > 0 ? 14 : -40;
    h.y += clamp(ty - h.y, -90 * dt, 45 * dt);
    h.x += clamp(this.herTarget - h.x, -14 * dt, 14 * dt);
    h.tilt = Math.sin(this.t * 1.7) * 1.2;
    h.bobY = Math.round(Math.sin(this.t * 6) * 0.6);
    h.open += ((sky.p.open > 0.5 ? 1 : 0.35) - h.open) * Math.min(1, dt * 3);
    h.alpha = this.visibility();
    this.mirages.forEach((m, i) => {
      m.x = clamp(h.x + (i ? 44 : -44), GROUND_L + 14, GROUND_R - 14);
      m.y = h.y + Math.sin(this.t * 2 + i) * 2;
      m.tilt = Math.sin(this.t * 3 + i * 2) * 2;
      m.alpha = (0.25 + 0.3 * Math.abs(Math.sin(this.t * 1.3 + i * 1.7))) * h.alpha;
    });
  }

  // How clearly she can be seen: storms show her only in the lightning, fog
  // and the dark swallow her a little.
  visibility() {
    const sky = this.world.sky;
    if (this.ch.special === "lightning" || sky.p.lightning > 0.5)
      return Math.min(1, sky.flash * 3);
    return clamp(1 - sky.p.fog * 0.35 - sky.night * 0.25, 0.4, 1);
  }

  // Her trail: things she drops while in view, and more of them waiting up
  // the street between glimpses. Walk over them for time.
  updateKeepsakes(dt, sc) {
    const kind = "marker";
    if (this.started && this.state === "play") {
      const h = this.her;
      if (h.y > -6 && (this.dropT -= dt) <= 0) {
        this.dropT = STORY.dropEvery;
        this.keepsakes.push({ kind, x: h.x + rand(-4, 4), y: h.y + 14 });
      }
      if ((this.trailT -= dt) <= 0) {
        this.trailT = STORY.trailEvery;
        this.keepsakes.push({ kind, x: rand(GROUND_L + 16, GROUND_R - 16), y: -6 });
      }
    }
    const p = this.player;
    for (const k of this.keepsakes) {
      k.y += sc;
      const near = Math.abs(k.x - p.x) < 12 && Math.abs(k.y - (p.y + 10)) < 12;
      if (near && this.state === "play") {
        k.taken = true;
        this.timeLeft += STORY.keepsakeTime;
        this.popup(`+${STORY.keepsakeTime} S`, k.x, k.y - 8, { color: RED.light });
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

  hitObstacle(p, o) {
    if (p.invT > 0 || p.shieldT > 0) return;
    this.bump(null, o);
  }

  // A bump (a walker, or an obstacle when `n` is null) costs time, not a life.
  bump(n, from = n) {
    const p = this.player;
    const dir = Math.sign(from.x - p.x) || 1;
    if (n) {
      n.touched = true;
      n.knockV = dir * 70;
      n.wob = 1;
      n.flashT = 0.12;
    }
    p.vx -= dir * 80;
    p.hitT = 0.55;
    p.invT = this.d.invuln;
    p.flashT = 0.12;
    this.timeLeft -= STORY.hitCost;
    this.popup(`-${STORY.hitCost} S`, p.x, p.y - 30, { color: "#ff8a8a", scale: 2 });
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

  // Her trail on the street, and the finish: a band of pale paving with red
  // umbrellas painted on it.
  drawGround(ctx) {
    for (const k of this.keepsakes) drawMarker(ctx, k, this.world, this.t);
    if (!this.started) return;
    // Rounded through World.sy, so it steps with the pavement.
    const y = this.world.sy(this.finishY);
    if (y < -12 || y > PF_H + 12) return;
    ctx.fillStyle = "#d8e6ec";
    ctx.fillRect(GROUND_L, y - 5, GROUND_R - GROUND_L, 10);
    ctx.fillStyle = "#a8bcc6";
    ctx.fillRect(GROUND_L, y - 5, GROUND_R - GROUND_L, 1);
    ctx.fillRect(GROUND_L, y + 4, GROUND_R - GROUND_L, 1);
    for (let x = GROUND_L + 10; x < GROUND_R - 6; x += 20) {
      ctx.drawImage(ellipseSprite(3, 2, RED.base, true), x - 3, y - 3);
      ctx.fillStyle = RED.dark;
      ctx.fillRect(x, y - 1, 1, 3);
    }
  }

  // Overhead: a string of red paper lanterns across the street above the
  // finish, glowing at night.
  drawLanterns(ctx) {
    if (!this.started) return;
    const y0 = this.world.sy(this.finishY) - 30;
    if (y0 < -20 || y0 > PF_H) return;
    const night = this.world.sky.night;
    const sag = (x) => y0 + Math.round(Math.sin(((x - GROUND_L) / (GROUND_R - GROUND_L)) * Math.PI) * 6);
    ctx.fillStyle = "#2e3640";
    for (let x = 0; x < PF_W; x++) ctx.fillRect(x, sag(Math.max(GROUND_L, Math.min(GROUND_R, x))), 1, 1);
    for (let x = GROUND_L + 8; x < GROUND_R - 4; x += 16) {
      const y = sag(x) + 2;
      if (night > 0.05) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = night * 0.8;
        ctx.drawImage(ellipseSprite(6, 4, "#5a1a10", true), x - 6, y - 2);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = RED.outline;
      ctx.fillRect(x - 2, y - 1, 5, 6);
      ctx.fillStyle = RED.base;
      ctx.fillRect(x - 1, y, 3, 4);
      ctx.fillStyle = night > 0.3 ? "#ffd08a" : RED.light;
      ctx.fillRect(x, y + 1, 1, 2);
    }
  }

  draw(ctx, L) {
    super.draw(ctx, L);
    if (this.photo || this.paused) return;
    inPlayfield(ctx, L, () => {
      this.drawLanterns(ctx);
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
    const title = last ? "THE BEACH" : "MADE IT";
    drawText(ctx, title, c, 72, PAL.text, { ...opt, scale: 2 });
    // Hearts for stars.
    for (let i = 0; i < 3; i++) {
      const color = i < this.stars ? RED.base : PAL.textDim;
      drawText(ctx, "*", c - 18 + i * 18, 96, color, { ...opt, scale: 3 });
    }
    const run = `${this.raceTime.toFixed(1)} S   CLOSE! ${this.closes}`;
    drawText(ctx, run, c, 124, PAL.text, opt);
    const best = [this.newTime && "BEST TIME", this.newCloses && "MOST CLOSE!"];
    const news = best.filter(Boolean).join(" + ");
    if (news) drawText(ctx, `NEW ${news}`, c, 134, RED.light, opt);
    if (Math.floor(this.endT * 2.5) % 2 === 0)
      drawText(ctx, "SPACE OR TAP TO GO ON", c, 156, PAL.text, opt);
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
      if (Math.floor(this.endT * 2.5) % 2 === 0)
        drawText(ctx, "SPACE OR TAP: TRY AGAIN", c, 140, PAL.text, opt);
      drawText(ctx, "ESC FOR CHAPTERS", c, 160, PAL.textDim, opt);
    }
    ctx.globalAlpha = 1;
  }
}
