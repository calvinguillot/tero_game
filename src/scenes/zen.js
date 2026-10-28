import { DIFFICULTY } from "../game/difficulty.js";
import { overlapRatio } from "../game/collision.js";
import { LOCATIONS, LOCATION_ORDER } from "../world/locations.js";
import { rand } from "../core/math.js";
import { PAL } from "../render/palette.js";
import { drawText } from "../render/font.js";
import { Player } from "../game/player.js";
import { PF_W, PF_H, GROUND_L, GROUND_R } from "../config.js";
import { inPlayfield } from "./street.js";
import { PlayScene } from "./play.js";
import { MenuScene } from "./menu.js";

// The crowd keeps Easy's pace and manners, and never speeds up.
const ZEN = { ...DIFFICULTY.easy, name: "ZEN" };
// Everyone but the hurriers; kids still turn up now and then.
const CROWD = { commuter: 5, wanderer: 3, elder: 1.5, pair: 1.5, kid: 1 };
const DAY_LENGTH = 480; // twice the arcade day
const WEATHER_PACE = 2; // weather changes twice as slowly as in arcade
const PLACE_EVERY = 2700; // pixels walked per place (about 90 seconds)
const METERS_PER_PX = 0.05; // so the walk comes out at a stroll
const INTRO_TIME = 6;

// Zen: the same street with nothing to win or lose. No score, lives, timer,
// force field or game over; bumping someone is just a wobble. The weather
// does everything it does in arcade, only slower. You walk until you want to
// stop, and then you're told how far you went (it isn't saved anywhere).
export class ZenScene extends PlayScene {
  constructor(game) {
    super(game);
    this.zen = true;
    this.walked = 0; // pixels of street
    this.places = 1;
    this.introT = 0;
    this.noteT = 0;
    this.summaryT = 0;
    // Walk Together (unlocked by finishing the story): she walks with you.
    // You take WASD (or the stick); she takes the arrow keys, and when nobody
    // steers her she keeps you company on her own.
    const { together } = game.data.settings;
    this.partner = together && game.data.story.done ? new Player("love", "classic") : null;
    this.herIdle = Infinity;
    this.wasd = { axis: () => game.input.axisOf("wasd") };
    if (this.partner) {
      this.player.x = 72;
      this.partner.x = 108;
    }
  }

  get together() {
    return !!this.partner;
  }

  get walkers() {
    return this.partner ? [this.player, this.partner] : [this.player];
  }

  controls() {
    return this.partner ? this.wasd : this.game.input;
  }

  tuning() {
    return {
      diffKey: "zen",
      d: ZEN,
      dayLength: DAY_LENGTH,
      weatherPace: WEATHER_PACE,
      weathers: ["rainy", "drizzle", "hazy", "stormy"],
    };
  }

  get pauseItems() {
    return ["RESUME", "PHOTO", "MAIN MENU"];
  }

  // Nothing for the HUD to count towards.
  get nextAt() {
    return null;
  }
  get level() {
    return null;
  }

  crowdWeights() {
    return CROWD;
  }

  fireField() {}

  // Leaving shows how far you walked before going back to the menu.
  leave() {
    this.paused = false;
    this.state = "summary";
    this.summaryT = 0;
  }

  update(dt) {
    const before = this.world.scrollY;
    super.update(dt);
    if (this.photo || this.paused) return;
    if (this.partner) this.updatePartner(dt);
    if (this.state === "summary") return this.updateSummary(dt);
    this.introT += dt;
    this.walked += this.world.scrollY - before;

    // A new place every so often, in order around the loop.
    const step = Math.floor(this.walked / PLACE_EVERY);
    const loc =
      LOCATION_ORDER[(this.startLoc + step) % LOCATION_ORDER.length];
    if (this.world.setLocation(loc)) {
      this.places++;
      this.toasts.push({ text: LOCATIONS[loc].name, t: 0 });
      this.sound("newPlace");
    }

    // Drops on your umbrella ring quiet notes, a few a second at most.
    this.noteT -= dt;
    if (this.world.takePlayerDrops() > 0 && this.noteT <= 0) {
      this.noteT = rand(0.18, 0.45);
      this.sound("rainNote", this.world.sky.night > 0.5);
    }
  }

  updatePartner(dt) {
    const q = this.partner;
    const keys = this.game.input.axisOf("arrows");
    this.herIdle = keys.x || keys.y ? 0 : this.herIdle + dt;
    const steer = this.herIdle > 2.5 ? this.besideYou() : keys;
    const walking = this.state === "play" ? { axis: () => steer } : null;
    q.update(dt, walking, this.world);
    // Two umbrellas can't quite share the same spot.
    const p = this.player;
    const dx = q.x - p.x;
    if (Math.abs(dx) < 20 && Math.abs(q.y - p.y) < 10) {
      const push = (dx >= 0 ? 1 : -1) * 30 * dt;
      q.x += push;
      p.x -= push;
    }
  }

  // Left to herself she walks beside you, at your pace, on whichever side
  // has room.
  besideYou() {
    const p = this.player;
    const q = this.partner;
    let side = q.x >= p.x ? 1 : -1;
    if (p.x + side * 26 > GROUND_R - 14 || p.x + side * 26 < GROUND_L + 14) side = -side;
    const dx = p.x + side * 26 - q.x;
    const dy = p.y - q.y;
    const d = Math.hypot(dx, dy);
    if (d < 3) return { x: 0, y: 0 };
    const k = Math.min(1, d / 24);
    return { x: (dx / d) * k, y: (dy / d) * k };
  }

  updateSummary(dt) {
    const { input } = this.game;
    this.summaryT += dt;
    if (this.summaryT < 0.6) return;
    if (input.hit("confirm") || input.hit("action") || input.hit("pause"))
      this.game.go(new MenuScene(this.game));
  }

  // Brushing past someone: both umbrellas wobble apart and a ripple spreads.
  // Nothing is lost.
  checkNpcs() {
    for (const p of this.walkers) {
      for (const n of this.npcs) {
        if (n.touched || n.y < 0) continue;
        if (overlapRatio(p, n, this.d.hitScale) >= 1) continue;
        const dir = Math.sign(n.x - p.x) || 1;
        n.touched = true;
        n.knockV = dir * 50;
        n.wob = 1;
        p.vx -= dir * 60;
        this.world.addRipple(p.x, p.y + 10, 12, 2, 1);
        this.sound("bump");
      }
    }
  }

  get distance() {
    const m = this.walked * METERS_PER_PX;
    return m < 1000 ? `${Math.round(m)} M` : `${(m / 1000).toFixed(1)} KM`;
  }

  draw(ctx, L) {
    super.draw(ctx, L);
    if (this.photo || this.paused) return;
    if (this.state === "summary")
      inPlayfield(ctx, L, () => this.drawSummary(ctx));
    else if (this.introT < INTRO_TIME)
      inPlayfield(ctx, L, () => this.drawIntro(ctx));
  }

  // A clear way in: what this mode is, then it fades and leaves you to it.
  drawIntro(ctx) {
    const t = this.introT;
    ctx.globalAlpha = Math.max(0, Math.min(1, t / 0.8, (INTRO_TIME - t) / 1.2));
    const opt = { shadow: PAL.textShadow, align: "center" };
    drawText(ctx, "ZEN", PF_W / 2, 74, PAL.text, { ...opt, scale: 3 });
    drawText(ctx, "NOTHING TO WIN,", PF_W / 2, 102, PAL.text, opt);
    drawText(ctx, "NOTHING TO LOSE.", PF_W / 2, 111, PAL.text, opt);
    drawText(ctx, "JUST WALK.", PF_W / 2, 126, "#ffffff", opt);
    ctx.globalAlpha = 1;
  }

  drawSummary(ctx) {
    ctx.globalAlpha = Math.min(1, this.summaryT * 3);
    ctx.fillStyle = PAL.overlay;
    ctx.fillRect(0, 0, PF_W, PF_H);
    const c = PF_W / 2;
    const opt = { shadow: PAL.textShadow, align: "center" };
    drawText(ctx, "YOU WALKED", c, 78, PAL.textDim, opt);
    drawText(ctx, this.distance, c, 90, PAL.text, { ...opt, scale: 3 });
    const places = this.places === 1 ? "1 PLACE" : `${this.places} PLACES`;
    drawText(ctx, `THROUGH ${places}`, c, 118, PAL.text, opt);
    if (this.summaryT > 0.6 && Math.floor(this.summaryT * 2.5) % 2 === 0)
      drawText(ctx, "SPACE OR TAP FOR MENU", c, 172, PAL.text, opt);
    ctx.globalAlpha = 1;
  }
}
