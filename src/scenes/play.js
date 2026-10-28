import { World } from "../world/world.js";
import { Sky } from "../world/sky.js";
import { LOCATIONS, LOCATION_ORDER } from "../world/locations.js";
import { Player } from "../game/player.js";
import { Npc, separate } from "../game/npc.js";
import { ForceField, FIELD_RADIUS } from "../game/forcefield.js";
import { DIFFICULTY, intensity, spawnWeights } from "../game/difficulty.js";
import { overlapRatio } from "../game/collision.js";
import { Autopilot } from "../game/autopilot.js";
import {
  bestScore,
  submitScore,
  scoreRank,
  saveData,
} from "../core/storage.js";
import { lerp, rand, pick, choice } from "../core/math.js";
import { PAL, UMBRELLA_COLORS } from "../render/palette.js";
import { drawText } from "../render/font.js";
import { ellipseSprite } from "../render/pixels.js";
import { drawHud, drawPhotoHud } from "../ui/hud.js";
import { navigate, plate, menuItem } from "../ui/menu.js";
import { InitialsEntry } from "../ui/initials.js";
import { PF_W, PF_H, GROUND_L, GROUND_R } from "../config.js";
import { inPlayfield, drawStreet } from "./street.js";
import { MenuScene } from "./menu.js";
import { SplashScene } from "./splash.js";

const START_LIVES = 3;
const MAX_LIVES = 3; // a bonus life only refills one you've lost
const EXTRA_LIFE_EVERY = 100;
const POINTS_PER_LOCATION = 25;
const CLOSE_BONUS = 2; // seconds of field recharge for a near miss
const MILESTONE = 10; // celebrate every N points
const NEAR_MISS = 2.0; // squared hitbox distance below which a pass sparkles
const RUSH_TIME = 5; // seconds (how many CLOSE! start one is per difficulty)
const RUSH_SPEED = 1.7; // street speed multiplier while rushing
const PAUSE_ITEMS = ["RESUME", "RESTART", "PHOTO", "MAIN MENU"];
const DAY_LENGTH = 240; // seconds for a full day in arcade
const PHOTO_SCALE = 4; // saved photos are the playfield at 4x, still crisp
const TOAST_TIME = 2.6;
const DEMO_TIME = 30; // seconds of attract-mode play before going back to the title
const WEATHER_NEWS = {
  rainy: "RAIN AGAIN",
  drizzle: "JUST A DRIZZLE",
  hazy: "HAZE ROLLS IN",
  stormy: "STORM!",
};
const SNOW_NEWS = {
  rainy: "SNOW AGAIN",
  drizzle: "A FEW FLURRIES",
  stormy: "BLIZZARD!",
};

// Arcade mode: dodge the crowd, +1 for every umbrella that gets past you.
// With { demo: true } it plays itself (attract mode), silently and without
// touching the high scores.
export class PlayScene {
  constructor(game, { demo = false } = {}) {
    this.game = game;
    this.demo = demo;
    const { color, style, fx, flash, dayNight } = game.data.settings;
    const tune = this.tuning(game.data.settings);
    this.diffKey = tune.diffKey;
    this.d = tune.d;
    this.color = color;
    this.style = style;
    // Every run starts somewhere random: place, time of day and weather.
    // Everything moves on from there.
    this.startLoc = Math.floor(Math.random() * LOCATION_ORDER.length);
    const sky = new Sky({
      time: Math.random(),
      cycle: tune.dayLength,
      dayNight,
      weather: choice(tune.weathers),
      autoWeather: true,
      stormAfter: this.d.stormAfter,
      pace: tune.weatherPace,
    });
    this.world = new World({
      speed: this.d.speedStart,
      location: LOCATION_ORDER[this.startLoc],
      lowFx: !fx,
      sky,
    });
    this.world.softFlash = !flash;
    this.world.wetSlow = this.d.wetSlow;
    this.player = new Player(color, style);
    this.world.player = this.player;
    this.field = new ForceField(this.d.recharge);
    this.ai = demo ? new Autopilot(this) : null;
    this.npcs = [];
    this.popups = [];
    this.toasts = []; // banners shown one after another: { text, t }
    this.t = 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.maxLives = MAX_LIVES; // life slots shown in the HUD
    this.lifeGainT = 0;
    this.streak = 0; // points in a row without getting hit (raises the score blip)
    this.closeCount = 0; // CLOSE! near misses towards the next SUN RUSH
    this.closes = 0; // all CLOSE! near misses this run (shown in high scores)
    this.rushT = 0;
    this.rushWeather = null; // weather to go back to after the rush
    this.quietWeather = 0; // weather changes the rush makes itself: no banner
    this.prevBest = bestScore(game.data, "arcade", this.diffKey);
    this.best = this.prevBest; // shown in the HUD, climbs with the score
    this.spawnT = 0.8;
    this.freeze = 0;
    this.shake = 0;
    this.hitFlash = 0;
    this.bumpT = 0;
    this.lifeLostT = 0;
    this.state = "play"; // play | dying | initials | over
    this.overT = 0;
    this.rank = 0;
    this.entry = null;
    this.paused = false;
    this.pauseSel = 0;
    this.newBest = false;
    this.photo = false; // photo mode: everything holds still but the rain
    this.photoFlash = 0;
    this.savedT = 0;
  }

  // How this run is tuned. Zen mode overrides it.
  tuning({ difficulty }) {
    const weathers = ["rainy", "drizzle", "hazy", "stormy"];
    return {
      diffKey: difficulty,
      d: DIFFICULTY[difficulty],
      dayLength: DAY_LENGTH,
      weatherPace: 1,
      // No storm straight away on Easy.
      weathers: difficulty === "easy" ? weathers.slice(0, 3) : weathers,
    };
  }

  get pauseItems() {
    return PAUSE_ITEMS;
  }

  // Which walker (or pattern) comes next.
  crowdWeights() {
    return spawnWeights(this.score, this.d);
  }

  // How fast the street moves while playing. It speeds up while rushing,
  // easing in and out.
  streetSpeed(I) {
    const r =
      this.rushT > 0
        ? Math.min(1, this.rushT / 0.5, (RUSH_TIME - this.rushT) / 0.5)
        : 0;
    const base = lerp(this.d.speedStart, this.d.speedMax, I);
    return base * lerp(1, RUSH_SPEED, r);
  }

  // What steers the player: the keys, or the autopilot in the demo.
  controls() {
    return this.demo ? this.ai : this.game.input;
  }

  // Umbrellas the players walk under (Zen can add a second one).
  get walkers() {
    return [this.player];
  }

  // The umbrellas someone is steering.
  get players() {
    return [this.player];
  }

  // Each player's force field (two in two-player arcade).
  get fields() {
    return [{ field: this.field, owner: this.player }];
  }

  // RESTART from the pause menu.
  restart() {
    this.game.go(new PlayScene(this.game));
  }

  // Extra things on the street under the umbrellas (Story's keepsakes).
  drawGround() {}

  // MAIN MENU from the pause menu.
  leave() {
    this.game.go(new MenuScene(this.game));
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
    return (
      (Math.floor(this.score / POINTS_PER_LOCATION) + 1) * POINTS_PER_LOCATION
    );
  }
  get level() {
    return this.d.name;
  }
  get timeName() {
    return this.world.sky.timeName;
  }
  get weatherName() {
    if (this.rushT > 0) return "SUN RUSH";
    const snowy = this.world.locAt(this.player.y).precip === "snow";
    return this.world.sky.label(snowy);
  }
  get rush() {
    return {
      count: this.closeCount,
      every: this.d.rushEvery,
      left: this.rushT / RUSH_TIME,
    };
  }

  // Sound effects; the demo plays silently.
  sound(name, ...args) {
    if (!this.demo) this.game.audio[name](...args);
  }

  pause() {
    if (this.state === "play") {
      this.paused = true;
      this.pauseSel = 0;
    }
  }

  shakeFor(seconds) {
    if (this.game.data.settings.shake)
      this.shake = Math.max(this.shake, seconds);
  }

  updatePause() {
    const { input } = this.game;
    if (input.hit("pause")) {
      this.paused = false;
      return;
    }
    if (input.hit("photo")) return this.startPhoto();
    const items = this.pauseItems;
    const rects = items.map((_, i) => ({
      x: 20,
      y: 102 + i * 20 - 4,
      w: 140,
      h: 20,
    }));
    const { sel, act } = navigate(this.game, this.pauseSel, rects);
    this.pauseSel = sel;
    if (!act) return;
    input.hit("action");
    const item = items[sel];
    if (item === "RESUME") this.paused = false;
    else if (item === "RESTART") this.restart();
    else if (item === "PHOTO") this.startPhoto();
    else this.leave();
  }

  // Photo mode, from the pause menu: the street holds still (only the rain
  // keeps falling), the HUD makes way, and Space or a tap saves a PNG.
  startPhoto() {
    this.photo = true;
    this.savedT = 0;
  }

  updatePhoto(dt) {
    const { input } = this.game;
    this.photoFlash = Math.max(0, this.photoFlash - dt);
    this.savedT = Math.max(0, this.savedT - dt);
    this.world.stepWater(dt, 0);
    if (input.hit("pause") || input.hit("photo")) {
      this.photo = false;
      return;
    }
    if (input.hit("action") || input.hit("confirm")) this.savePhoto();
    input.takeTap();
  }

  savePhoto() {
    const shot = document.createElement("canvas");
    shot.width = PF_W;
    shot.height = PF_H;
    const umbrellas = this.npcs.concat(this.walkers);
    drawStreet(shot.getContext("2d"), this.world, umbrellas, {
      glow: this.walkers,
      ground: () => this.drawGround(shot.getContext("2d")),
    });
    const big = document.createElement("canvas");
    big.width = PF_W * PHOTO_SCALE;
    big.height = PF_H * PHOTO_SCALE;
    const ctx = big.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(shot, 0, 0, big.width, big.height);
    // Local time as YYYYMMDD-HHMMSS (the Swedish locale writes ISO-style).
    const stamp = new Date()
      .toLocaleString("sv-SE")
      .replace(/[-:]/g, "")
      .replace(" ", "-");
    big.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `a-rainy-day-${stamp}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    this.photoFlash = 0.25;
    this.savedT = 1.6;
    this.game.audio.shutter();
  }

  // Attract mode: any press goes to the menu; it ends by itself after a while.
  updateDemo(dt) {
    const { input } = this.game;
    if (input.hit("confirm") || input.hit("action") || input.hit("pause")) {
      this.game.go(new MenuScene(this.game));
      return true;
    }
    if (this.t > DEMO_TIME || this.state === "over") {
      this.game.go(new SplashScene(this.game));
      return true;
    }
    this.ai.update(dt);
    return false;
  }

  update(dt) {
    const { input } = this.game;
    this.t += dt;

    if (this.demo && this.updateDemo(dt)) return;
    if (this.photo) return this.updatePhoto(dt);
    if (this.paused) return this.updatePause();
    if (this.state === "play" && !this.demo && input.hit("pause"))
      return this.pause();
    if (this.state === "initials") {
      this.entry.update(dt, this.game);
      if (this.entry.done) this.finishInitials();
    } else if (this.state === "over") {
      this.overT += dt;
      if (this.overT > 0.6) {
        if (input.hit("confirm")) return this.game.go(new PlayScene(this.game));
        if (input.hit("pause")) return this.game.go(new MenuScene(this.game));
      }
    }

    this.bumpT = Math.max(0, this.bumpT - dt);
    this.lifeLostT = Math.max(0, this.lifeLostT - dt);
    this.lifeGainT = Math.max(0, this.lifeGainT - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.toasts.length && (this.toasts[0].t += dt) > TOAST_TIME)
      this.toasts.shift();
    // Hit-stop: freeze the action for a few frames on impact.
    if (this.freeze > 0) {
      this.freeze -= dt;
      return;
    }

    const playing = this.state === "play";
    if (playing && (this.demo ? this.ai.takeBurst() : input.hit("action")))
      this.fireField();
    if (this.rushT > 0 && (this.rushT -= dt) <= 0) this.endRush();
    // While rushing, the umbrella flashes white now and then.
    if (this.rushT > 0 && Math.floor(this.rushT * 2.5) !== Math.floor((this.rushT + dt) * 2.5)) {
      this.player.flashT = 0.06;
    }

    const I = intensity(this.score);
    if (playing) this.world.speed = this.streetSpeed(I);
    else this.world.speed = lerp(this.world.speed, 12, dt * 2);
    this.world.umbrellas = this.npcs.concat(this.walkers);
    this.world.obstacles.density = playing ? this.obstacleDensity(I) : 0;
    this.world.update(dt);
    this.handleSky();
    for (const { field } of this.fields) {
      field.update(dt, this.world.speed * dt);
      for (const e of field.takeEvents())
        this.sound(e === "ready" ? "fieldReady" : "fieldFade");
    }
    this.player.update(dt, playing ? this.controls() : null, this.world);
    if (this.player.splashed) this.sound("puddle");

    if (playing) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT =
          lerp(this.d.spawnStart, this.d.spawnMin, I) *
          rand(0.75, 1.25) *
          (this.rushT > 0 ? 0.5 : 1);
        this.spawn();
      }
    }

    for (const n of this.npcs) n.update(dt, this.world, this.player);
    this.world.obstacles.steer(this.npcs, dt);
    separate(this.npcs, dt);
    this.applyField();
    this.npcs = this.npcs.filter((n) => n.y < PF_H + 30 && n.y > -80);

    if (playing) this.checkNpcs();
    if (playing) this.checkObstacles();

    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.life);

    if (this.state === "dying" && this.player.deadT > 1.3) this.gameOver();
  }

  gameOver() {
    this.newBest = this.score > this.prevBest;
    this.rank = this.demo
      ? 0
      : scoreRank(this.game.data, "arcade", this.diffKey, this.score);
    if (this.rank) {
      // Made the table: sign it, arcade style.
      this.state = "initials";
      this.entry = new InitialsEntry(this.game.data.settings.initials);
      this.sound("lifeUp");
    } else {
      this.state = "over";
      this.sound("gameOver");
    }
  }

  finishInitials() {
    const { data } = this.game;
    data.settings.initials = this.entry.name;
    submitScore(data, "arcade", this.diffKey, this.score, this.entry.name, {
      closes: this.closes,
    });
    saveData(data);
    this.state = "over";
    this.overT = 0;
  }

  checkNpcs() {
    const p = this.player;
    const rushing = this.rushT > 0;
    for (const n of this.npcs) {
      if (n.touched || (n.shooed && !rushing)) continue;
      const gap = overlapRatio(p, n, this.d.hitScale);
      n.minGap = Math.min(n.minGap ?? Infinity, gap);
      if (gap < 1 && rushing && !n.scored) {
        this.rushBump(n);
      } else if (gap < 1 && !rushing && p.invT <= 0 && p.shieldT <= 0) {
        this.hit(n);
        if (this.state !== "play") return;
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
    const pal = UMBRELLA_COLORS[p.color];
    this.score++;
    this.streak++;
    this.best = Math.max(this.best, this.score);
    this.bumpT = 0.15;
    if (n.minGap < NEAR_MISS && p.invT <= 0 && this.rushT <= 0) {
      // Squeezed past: sparkle in the gap, charge the field, count towards a rush.
      const mx = (n.x + p.x) / 2;
      const my = (n.y + p.y) / 2 - 10;
      this.world.burst(mx, my, 8, pal.accent, 50);
      this.popup("CLOSE!", mx, my - 6, { color: pal.light });
      this.field.bonus(CLOSE_BONUS);
      this.sound("close");
      this.closes++;
      if (++this.closeCount >= this.d.rushEvery) this.startRush();
    } else {
      this.popup("+1", n.x, n.y - n.r);
      this.sound("score", this.streak);
    }
    if (this.score % EXTRA_LIFE_EVERY === 0 && this.lives < MAX_LIVES) {
      this.lives++;
      this.lifeGainT = 0.8;
      this.popup("+1 LIFE", p.x, p.y - 44, {
        scale: 2,
        color: pal.light,
        life: 1.4,
      });
      this.sound("lifeUp");
    } else if (this.score % MILESTONE === 0) {
      this.sound("milestone");
    }
    if (this.score % MILESTONE === 0) {
      this.bumpT = 0.6;
      this.popup(`${this.score}!`, p.x, p.y - 30, {
        scale: 2,
        color: pal.light,
        life: 1.1,
      });
      this.world.burst(p.x, p.y - 8, 18, pal.light, 90);
    }
    const loc =
      LOCATION_ORDER[
        (this.startLoc + Math.floor(this.score / POINTS_PER_LOCATION)) %
          LOCATION_ORDER.length
      ];
    if (this.world.setLocation(loc)) {
      this.toasts.push({ text: LOCATIONS[loc].name, t: 0 });
      this.sound("newPlace");
    }
  }

  // SUN RUSH: the sun breaks through, everyone shuts their umbrella, and you
  // run. Nothing can hurt you, and every umbrella you pass or bump scores.
  startRush() {
    const sky = this.world.sky;
    this.closeCount = 0;
    this.rushT = RUSH_TIME;
    this.rushWeather = sky.weatherKey;
    sky.hold = true;
    sky.forceDay = true; // the sun comes out even at night
    if (sky.setWeather("sunny", 0.6)) this.quietWeather++;
    this.player.rush = true;
    this.toasts.unshift({ text: "SUN RUSH!", t: 0 });
    this.world.burst(this.player.x, this.player.y - 10, 24, "#ffe9a0", 110);
    this.sound("rushStart");
  }

  endRush() {
    const sky = this.world.sky;
    this.rushT = 0;
    this.player.rush = false;
    this.player.invT = Math.max(this.player.invT, 1); // a moment to find your feet
    sky.hold = false;
    sky.forceDay = false;
    sky.nextWeatherT = rand(20, 35);
    if (sky.setWeather(this.rushWeather, 2)) this.quietWeather++;
    this.sound("rushEnd");
  }

  rushBump(n) {
    const p = this.player;
    const dir = Math.sign(n.x - p.x) || 1;
    n.touched = true;
    n.scored = true;
    n.knockV = dir * 180;
    n.knockVY = -70;
    n.wob = 1;
    n.flashT = 0.1;
    this.world.splash(n.x, n.y - 6, 6, PAL.splash, true, 60);
    this.addPoint(n);
  }

  handleSky() {
    for (const e of this.world.sky.takeEvents()) {
      if (e === "weather") {
        const key = this.world.sky.weatherKey;
        const snowy = this.world.locAt(this.player.y).precip === "snow";
        const text = (snowy && SNOW_NEWS[key]) || WEATHER_NEWS[key];
        if (this.quietWeather > 0) this.quietWeather--;
        else this.toasts.push({ text, t: 0 });
      } else if (e === "gust") {
        // Umbrellas get caught and turn inside out (about half of them, and
        // always at least one), staying flipped while the gust blows.
        const open = this.npcs.filter(
          (n) => !n.shooed && n.open > 0.6 && n.y > 0 && n.y < PF_H - 20,
        );
        open.forEach((n, i) => {
          if (i === 0 || Math.random() < 0.45) {
            n.flipT = rand(1.4, 2.2);
            n.wob = 1;
          }
        });
        this.sound("gust");
      } else if (e === "thunder") {
        // The strike splashes the street where the bolt lands.
        const bolt = this.world.sky.bolt;
        const [bx, by] = bolt[bolt.length - 1];
        this.world.addRipple(bx, by, 22, 3, 1.3);
        this.world.splash(bx, by, 14, PAL.splash, false, 80);
        this.shakeFor(0.3);
        this.sound("thunder", this.world.softFlash);
      }
    }
  }

  // How busy the street is with obstacles (0..1): more as the crowd picks up.
  obstacleDensity(I) {
    return 0.25 + 0.75 * I;
  }

  // Obstacles follow the same rule as walkers: in arcade, a life. While you
  // can't be hurt (after a hit, behind the force field, in a SUN RUSH) you
  // pass through.
  checkObstacles() {
    for (const p of this.players) {
      if (p.dead) continue;
      const o = this.world.obstacles.touching(p);
      if (o) this.hitObstacle(p, o);
    }
  }

  hitObstacle(p, o) {
    if (p.invT > 0 || p.shieldT > 0 || this.rushT > 0) return;
    this.hit(null, o);
  }

  // The lane (x) farthest from walkers near the top, for a walker of half-width `half`.
  freeLane(half) {
    let bestX = GROUND_L + half;
    let bestGap = -1;
    for (let i = 0; i < 8; i++) {
      const x = rand(GROUND_L + half, GROUND_R - half);
      let gap = Infinity;
      for (const n of this.npcs)
        if (n.y < 40) gap = Math.min(gap, Math.abs(n.x - x));
      gap = Math.min(gap, this.world.obstacles.roomAt(x));
      if (gap > bestGap) [bestGap, bestX] = [gap, x];
    }
    return bestX;
  }

  spawn() {
    const kind = pick(this.crowdWeights());
    if (kind === "pair") {
      // Two commuters walking side by side, in step.
      const x = this.freeLane(32);
      const a = new Npc("commuter", x - 15, -20, this.d);
      const b = new Npc("commuter", x + 15, -21, this.d);
      b.syncWith(a);
      this.npcs.push(a, b);
    } else {
      this.npcs.push(new Npc(kind, this.freeLane(16), -20, this.d));
    }
    // Arrive with the umbrella already up or down for the weather.
    for (const n of this.npcs.slice(-2))
      if (n.y < 0) n.open = Math.max(0.15, this.world.sky.p.open);
  }

  // Burst: the field's front sweeps outward over the next few frames (applyField).
  fireField(p = this.player, field = this.field) {
    if (!field.fire(p.x, p.y)) return;
    p.shieldT = 0.5;
    this.world.displace(p.x, p.y, 20);
    this.world.addRipple(p.x, p.y + 10, 26, 3, 1.2);
    this.world.animals.startle(p.x, p.y, FIELD_RADIUS * 1.2);
    this.freeze = 0.05;
    this.shakeFor(0.18);
    this.sound("fieldFire");
  }

  // Every umbrella the expanding front reaches is shoved away and closes up
  // (harmless, no point); the water inside is pushed out with it, and rain
  // bounces off the dome until it fades.
  applyField() {
    const domes = [];
    const waves = this.fields.flatMap(({ field }) =>
      field.waves.map((w) => [field, w]),
    );
    for (const [field, w] of waves) {
      const rf = field.front(w);
      domes.push({ x: w.x, y: w.y, r: rf });
      if (!field.expanding(w)) continue;
      for (const n of this.npcs) {
        if (n.shooed) continue;
        const dx = n.x - w.x;
        const dy = (n.y - w.y) * 2;
        const d = Math.hypot(dx, dy) || 1;
        if (d > rf + n.r * 0.6) continue;
        n.shoo(dx / d, dy / d);
        this.sound("shut");
        this.world.splash(n.x, n.y - n.r * 0.6, 6, PAL.splash, true, 50);
      }
      this.world.pushWater(w.x, w.y, rf);
    }
    this.world.domes = domes;
  }

  // Bumping into a walker (or an obstacle: `npc` is then null) costs a life.
  hit(npc, from = npc) {
    const p = this.player;
    const dir = Math.sign(from.x - p.x) || 1;
    if (npc) {
      npc.touched = true;
      npc.knockV = dir * 70;
      npc.wob = 1;
      npc.flashT = 0.12;
    }
    p.vx -= dir * 80;
    p.hitT = 0.55;
    p.invT = this.d.invuln;
    p.flashT = 0.12;
    this.lives--;
    this.streak = 0;
    this.sound("hit");
    this.lifeLostT = 0.6;
    this.freeze = 0.08;
    this.hitFlash = 0.15;
    this.shakeFor(0.25);
    this.world.addRipple(p.x, p.y + 10, 18, 3, 1.1);
    this.world.splash(p.x, p.y - 6, 12, PAL.splash, true, 70);
    if (this.lives <= 0) {
      this.state = "dying";
      p.die();
    }
  }

  draw(ctx, L) {
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, L.w, L.h);
    if (this.photo) return this.drawPhoto(ctx, L);
    drawHud(ctx, L, this, this.game.input);

    const p = this.player;
    const umbrellas = this.npcs.concat(this.walkers);
    inPlayfield(
      ctx,
      L,
      () =>
        drawStreet(ctx, this.world, umbrellas, {
          hidden: p.visible ? null : p,
          glow: this.walkers,
          ground: () => this.drawGround(ctx),
          overlay: () => {
            if (this.rushT > 0) this.drawRushGlow(ctx);
            for (const { field, owner } of this.fields)
              field.draw(ctx, owner);
            // "!" over walkers about to make a move.
            for (const n of this.npcs) {
              if (n.alert && Math.floor(this.t * 10) % 2 === 0) {
                const y = this.world.sy(n.y - n.r * 1.4 - 8);
                drawText(ctx, "!", n.x, y, "#ffffff", {
                  align: "center",
                  shadow: PAL.textShadow,
                });
              }
            }
            this.drawPopups(ctx);
            this.drawWindWarning(ctx);
            this.drawToast(ctx);
            if (this.demo) this.drawDemo(ctx);
          },
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
    if (this.state === "initials") {
      inPlayfield(ctx, L, () => {
        ctx.fillStyle = PAL.overlay;
        ctx.fillRect(0, 0, PF_W, PF_H);
        this.entry.draw(ctx, this.rank, this.score);
      });
    }
    if (this.state === "over" && !this.demo)
      inPlayfield(ctx, L, () => this.drawGameOver(ctx));
  }

  // Just the street, as the photo will be, with a white flash when it's taken.
  drawPhoto(ctx, L) {
    drawPhotoHud(ctx, L, this.savedT > 0, this.color);
    inPlayfield(ctx, L, () => {
      drawStreet(ctx, this.world, this.npcs.concat(this.walkers), {
        glow: this.walkers,
        ground: () => this.drawGround(ctx),
      });
      if (this.photoFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.photoFlash / 0.25})`;
        ctx.fillRect(0, 0, PF_W, PF_H);
      }
    });
  }

  // Running in the sun: a pulsing golden aura and ring around the closed umbrella.
  drawRushGlow(ctx) {
    const p = this.player;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 14);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.5 + pulse * 0.4;
    ctx.drawImage(ellipseSprite(17, 10, "#5a4410", true), x - 17, y - 16);
    ctx.drawImage(ellipseSprite(10, 6, "#6a5418", true), x - 10, y - 12);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const rx = 14 + Math.round(pulse * 3);
    const ry = Math.round(rx * 0.55);
    ctx.drawImage(ellipseSprite(rx, ry, "#ffe9a0", false), x - rx, y - 6 - ry);
  }

  drawDemo(ctx) {
    if (Math.floor(this.t * 2) % 2) return;
    drawText(ctx, "DEMO PLAY", 90, 70, "#ffffff", {
      scale: 2,
      shadow: PAL.textShadow,
      align: "center",
    });
    drawText(ctx, "PRESS SPACE OR TAP", 90, 88, PAL.text, {
      shadow: PAL.textShadow,
      align: "center",
    });
  }

  drawPopups(ctx) {
    for (const p of this.popups) {
      const k = p.t / p.life;
      // Pop up fast, then drift; blink out at the end.
      const rise = (1 - (1 - Math.min(1, k * 2.5)) ** 2) * 14 + k * 6;
      if (k > 0.75 && Math.floor(p.t * 20) % 2) continue;
      drawText(ctx, p.text, p.x, p.y - rise, p.color, {
        align: "center",
        shadow: PAL.textShadow,
        scale: p.scale,
      });
    }
  }

  // Banners (new place, weather news, SUN RUSH) slide in from the top, one at a time.
  drawToast(ctx) {
    const toast = this.toasts[0];
    if (!toast) return;
    const t = toast.t;
    const out = TOAST_TIME - 0.3;
    const y = Math.round(
      t < 0.3
        ? -10 + (t / 0.3) * 30
        : t > out
          ? 20 - ((t - out) / 0.3) * 30
          : 20,
    );
    const color = toast.text === "SUN RUSH!" ? "#ffe9a0" : PAL.text;
    drawText(ctx, `- ${toast.text} -`, PF_W / 2, y, color, {
      scale: 2,
      shadow: PAL.textShadow,
      align: "center",
    });
  }

  // A gust is announced a second ahead with blinking arrows on its side.
  drawWindWarning(ctx) {
    const sky = this.world.sky;
    const dir = sky.warn || (sky.gusting > 0 ? sky.gustDir : 0);
    if (!dir || Math.floor(this.t * 8) % 2) return;
    const text = dir > 0 ? "WIND >>>" : "<<< WIND";
    drawText(ctx, text, dir > 0 ? PF_W - 18 : 18, 44, "#ffffff", {
      align: dir > 0 ? "right" : "left",
      shadow: PAL.textShadow,
      scale: sky.warn ? 2 : 1,
    });
  }

  drawPaused(ctx) {
    ctx.fillStyle = PAL.overlay;
    ctx.fillRect(0, 0, PF_W, PF_H);
    drawText(ctx, "PAUSED", 90, 66, PAL.text, {
      scale: 2,
      shadow: PAL.textShadow,
      align: "center",
    });
    const items = this.pauseItems;
    plate(ctx, 14, 92, 152, items.length * 20 + 8);
    items.forEach((label, i) =>
      menuItem(ctx, label, 90, 102 + i * 20, i === this.pauseSel, this.t),
    );
    const hintY = 112 + items.length * 20;
    drawText(ctx, "ESC TO RESUME", 90, hintY, PAL.textDim, {
      align: "center",
      shadow: PAL.textShadow,
    });
  }

  drawGameOver(ctx) {
    ctx.globalAlpha = Math.min(1, this.overT * 3);
    ctx.fillStyle = PAL.overlay;
    ctx.fillRect(0, 0, PF_W, PF_H);
    const c = PF_W / 2;
    const blink = Math.floor(this.overT * 2.5) % 2 === 0;
    drawText(ctx, "GAME OVER", c, 70, PAL.text, {
      scale: 2,
      shadow: PAL.textShadow,
      align: "center",
    });
    drawText(ctx, "SCORE", c, 98, PAL.textDim, { align: "center" });
    drawText(ctx, this.score, c, 108, PAL.text, {
      scale: 3,
      shadow: PAL.textShadow,
      align: "center",
    });
    if (this.newBest) {
      if (blink)
        drawText(ctx, "* NEW BEST *", c, 132, PAL.rippleHi, {
          align: "center",
          shadow: PAL.textShadow,
        });
    } else if (this.rank) {
      drawText(ctx, `RANK ${this.rank}`, c, 132, PAL.text, {
        align: "center",
        shadow: PAL.textShadow,
      });
    } else {
      drawText(ctx, `BEST ${this.prevBest}`, c, 132, PAL.textDim, {
        align: "center",
      });
    }
    if (this.overT > 0.6) {
      if (blink)
        drawText(ctx, "SPACE OR TAP TO RETRY", c, 172, PAL.text, {
          align: "center",
          shadow: PAL.textShadow,
        });
      drawText(ctx, "ESC FOR MENU", c, 184, PAL.textDim, { align: "center" });
    }
    ctx.globalAlpha = 1;
  }
}
