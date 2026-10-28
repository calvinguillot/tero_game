import { Player } from "../game/player.js";
import { ForceField } from "../game/forcefield.js";
import { overlapRatio } from "../game/collision.js";
import { LOCATIONS, LOCATION_ORDER } from "../world/locations.js";
import { PAL, UMBRELLA_COLORS } from "../render/palette.js";
import { drawText } from "../render/font.js";
import { PF_W, PF_H } from "../config.js";
import { inPlayfield } from "./street.js";
import { PlayScene } from "./play.js";
import { MenuScene } from "./menu.js";

const LIVES = 3;
const NEAR_MISS = 2.0; // as in solo arcade
const POINTS_PER_LOCATION = 25; // walkers passed per place, as in solo arcade
const FIRE = {
  p1: ["Space", "ShiftLeft"],
  p2: ["Enter", "NumpadEnter", "ShiftRight"],
};

// Two-player arcade (unlocked with Walk Together): the same street, crowd,
// obstacles and SUN RUSH, but what counts is CLOSE!. Each player has three
// lives and a force field; the one with more near misses when you're both
// out wins. Both players' CLOSE! fill one shared SUN RUSH meter. Nothing is
// saved: solo arcade keeps the high scores.
//
// P1: WASD (or the stick) and Space / left Shift.
// P2: the arrow keys and Enter / right Shift.
export class DuoScene extends PlayScene {
  constructor(game) {
    super(game);
    this.duo = true;
    const p1 = this.player;
    const p2 = new Player("love", "classic");
    p1.x = 66;
    p2.x = 114;
    for (const [p, tag] of [[p1, "P1"], [p2, "P2"]]) {
      p.tag = tag;
      p.lives = LIVES;
      p.closes = 0;
      p.lifeLostT = 0;
    }
    this.p2 = p2;
    p2.field = new ForceField(this.d.recharge);
    this.passes = 0; // walkers past either player: moves the places along
    this.resultT = 0;
    const { input } = game;
    this.p1Keys = { axis: () => input.axisOf("wasd") };
    this.p2Keys = { axis: () => input.axisOf("arrows") };
  }

  get walkers() {
    return [this.player, this.p2];
  }

  get players() {
    return this.walkers.filter((p) => !p.dead);
  }

  get fields() {
    return [
      { field: this.field, owner: this.player },
      { field: this.p2.field, owner: this.p2 },
    ];
  }

  get pauseItems() {
    return ["RESUME", "RESTART", "PHOTO", "MAIN MENU"];
  }

  restart() {
    this.game.go(new DuoScene(this.game));
  }

  controls() {
    return this.p1Keys;
  }

  // Each player fires their own field (see update).
  fireField(p, field) {
    if (p) super.fireField(p, field);
  }

  // HUD fields.
  get duoInfo() {
    const side = (p, field) => ({
      tag: p.tag,
      closes: p.closes,
      lives: p.lives,
      maxLives: LIVES,
      lifeLostT: p.lifeLostT,
      lifeGainT: 0,
      color: p.color,
      style: p.style,
      charge: field.charge,
      ready: field.ready,
    });
    return {
      p1: side(this.player, this.field),
      p2: side(this.p2, this.p2.field),
    };
  }

  update(dt) {
    const { input } = this.game;
    super.update(dt);
    if (this.photo || this.paused) return;
    for (const p of this.walkers) p.lifeLostT = Math.max(0, p.lifeLostT - dt);
    if (this.state === "results") return this.updateResults(dt);
    const playing = this.state === "play";
    if (this.freeze <= 0) {
      const p2 = this.p2;
      p2.update(dt, playing && !p2.dead ? this.p2Keys : null, this.world);
      // Two umbrellas can't quite share the same spot.
      const p1 = this.player;
      const dx = p2.x - p1.x;
      if (!p1.dead && !p2.dead && Math.abs(dx) < 22 && Math.abs(p2.y - p1.y) < 12) {
        const push = (dx >= 0 ? 1 : -1) * 40 * dt;
        p2.x += push;
        p1.x -= push;
      }
      if (playing && !this.player.dead && input.hitKey(...FIRE.p1))
        this.fireField(this.player, this.field);
      if (playing && !p2.dead && input.hitKey(...FIRE.p2))
        this.fireField(p2, p2.field);
    }
    if (this.state === "dying" && this.walkers.every((p) => p.deadT > 1.3)) {
      this.state = "results";
      this.resultT = 0;
      this.sound("gameOver");
    }
  }

  updateResults(dt) {
    const { input } = this.game;
    this.resultT += dt;
    if (this.resultT < 0.8) return;
    if (input.hit("confirm") || input.hit("action")) this.restart();
    else if (input.hit("pause")) this.game.go(new MenuScene(this.game));
  }

  // Passing walkers: a near miss is a CLOSE! for whoever squeezed past.
  checkNpcs() {
    const rushing = this.rushT > 0;
    for (const n of this.npcs) {
      if (n.touched || (n.shooed && !rushing)) continue;
      for (const p of this.players) {
        const gap = overlapRatio(p, n, this.d.hitScale);
        n.gaps ??= new Map();
        n.gaps.set(p, Math.min(n.gaps.get(p) ?? Infinity, gap));
        if (gap < 1 && !rushing && p.invT <= 0 && p.shieldT <= 0) {
          this.hitPlayer(p, n);
          break;
        }
      }
      if (n.touched || n.scored) continue;
      const p = this.players.find((q) => n.y > q.y + 6 && n.gaps?.has(q));
      if (!p) continue;
      n.scored = true;
      this.passed();
      if (n.gaps.get(p) < NEAR_MISS && p.invT <= 0 && !rushing) this.close(p, n);
    }
  }

  close(p, n) {
    const pal = UMBRELLA_COLORS[p.color];
    const mx = (n.x + p.x) / 2;
    const my = (n.y + p.y) / 2 - 10;
    p.closes++;
    this.closes++;
    this.world.burst(mx, my, 8, pal.accent, 50);
    this.popup("CLOSE!", mx, my - 6, { color: pal.light });
    (p === this.p2 ? this.p2.field : this.field).bonus(2);
    this.sound("close");
    if (++this.closeCount >= this.d.rushEvery) this.startRush();
  }

  // Every walker that gets past moves the crowd and the places along, as the
  // score does in solo arcade.
  passed() {
    this.score++;
    const step = Math.floor(this.score / POINTS_PER_LOCATION);
    const loc = LOCATION_ORDER[(this.startLoc + step) % LOCATION_ORDER.length];
    if (this.world.setLocation(loc)) {
      this.toasts.push({ text: LOCATIONS[loc].name, t: 0 });
      this.sound("newPlace");
    }
  }

  startRush() {
    super.startRush();
    this.p2.rush = true;
  }

  endRush() {
    super.endRush();
    this.p2.rush = false;
    this.p2.invT = Math.max(this.p2.invT, 1);
  }

  hitObstacle(p, o) {
    if (p.invT > 0 || p.shieldT > 0 || this.rushT > 0) return;
    this.hitPlayer(p, null, o);
  }

  // A bump costs that player a life; out of lives, they drift away and the
  // other plays on.
  hitPlayer(p, n, from = n) {
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
    p.lives--;
    p.lifeLostT = 0.6;
    this.sound("hit");
    this.freeze = 0.08;
    this.hitFlash = 0.15;
    this.shakeFor(0.25);
    this.world.addRipple(p.x, p.y + 10, 18, 3, 1.1);
    if (p.lives <= 0) {
      p.die();
      this.popup(`${p.tag} OUT`, p.x, p.y - 30, { scale: 2 });
      if (this.walkers.every((q) => q.dead)) this.state = "dying";
    }
  }

  // Nothing is saved in two-player.
  gameOver() {}

  draw(ctx, L) {
    super.draw(ctx, L);
    if (this.state === "results")
      inPlayfield(ctx, L, () => this.drawResults(ctx));
  }

  drawResults(ctx) {
    ctx.globalAlpha = Math.min(1, this.resultT * 3);
    ctx.fillStyle = PAL.overlay;
    ctx.fillRect(0, 0, PF_W, PF_H);
    const c = PF_W / 2;
    const opt = { shadow: PAL.textShadow, align: "center" };
    const [a, b] = [this.player, this.p2];
    const winner = a.closes === b.closes ? null : a.closes > b.closes ? a : b;
    drawText(ctx, "CLOSE!", c, 52, PAL.textDim, opt);
    for (const [p, x] of [[a, c - 38], [b, c + 38]]) {
      const pal = UMBRELLA_COLORS[p.color];
      drawText(ctx, p.tag, x, 70, pal.light, opt);
      drawText(ctx, p.closes, x, 82, PAL.text, { ...opt, scale: 3 });
    }
    const verdict = winner ? `${winner.tag} WINS!` : "A TIE!";
    const color = winner ? UMBRELLA_COLORS[winner.color].light : PAL.text;
    drawText(ctx, verdict, c, 120, color, { ...opt, scale: 2 });
    if (this.resultT > 0.8) {
      if (Math.floor(this.resultT * 2.5) % 2 === 0)
        drawText(ctx, "SPACE OR TAP: AGAIN", c, 160, PAL.text, opt);
      drawText(ctx, "ESC FOR MENU", c, 172, PAL.textDim, opt);
    }
    ctx.globalAlpha = 1;
  }
}
