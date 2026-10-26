import { clamp, rand } from '../core/math.js';
import { PAL } from '../render/palette.js';
import { GROUND_L, GROUND_R, PF_H } from '../config.js';

const MAX_SPEED = 90;
const ACCEL = 14; // higher = snappier; ~0.07s to reach full speed
const TWIRL = 0.6;

// A footstep: a small ring, or a proper splash when it lands in a puddle.
export function stepRipple(world, x, y, size) {
  if (world.inPuddle(x, y)) {
    world.addRipple(x, y, size + 5, 2, 0.9);
    world.splash(x, y, 3, PAL.rainTip, false, 35);
  } else {
    world.addRipple(x, y, size, 1, 0.6);
  }
}

export class Player {
  constructor(color, style) {
    this.x = 90;
    this.y = 190;
    this.r = 14;
    this.color = color;
    this.style = style;
    this.shieldT = 0; // brief collision immunity while the force field fires
    this.handle = 'j';
    this.open = 1;
    this.inv = false;
    this.tilt = 0;
    this.lean = 0;
    this.bobY = 0;
    this.vx = 0;
    this.vy = 0;
    this.hitT = 0;
    this.invT = 0;
    this.dead = false;
    this.deadT = 0;
    this.stepT = 0;
    this.stepSide = 1;
    this.t = 0;
    this.flashT = 0;
    this.idleT = 0;
    this.nextTwirl = rand(3, 5);
    this.twirlT = 0;
  }

  update(dt, input, world) {
    this.t += dt;

    if (this.dead) {
      // Close up and drift away with the street.
      this.deadT += dt;
      this.open = Math.max(0, 1 - this.deadT / 0.7);
      this.y += world.speed * dt * 0.8;
      this.lean *= Math.exp(-4 * dt);
      this.tilt = this.lean;
      this.inv = false;
      return;
    }

    const a = input ? input.axis() : { x: 0, y: 0 };
    let k = Math.min(1, dt * ACCEL);
    if (this.hitT > 0) {
      this.hitT -= dt;
      k *= 0.35;
    }
    // In the sun, wet puddles are slick: you keep sliding.
    this.slipping = world.sky.p.slick > 0.5 && world.inPuddle(this.x, this.y + 13);
    if (this.slipping) k *= 0.12;
    this.vx += (a.x * MAX_SPEED - this.vx) * k;
    this.vy += (a.y * MAX_SPEED - this.vy) * k;
    // Wind pushes the umbrella like a sail.
    this.x += (this.vx + world.sky.wind * 0.5) * dt;
    this.y += this.vy * dt;
    if (this.slipping && Math.hypot(this.vx, this.vy) > 20 && Math.random() < 0.3) {
      world.splash(this.x, this.y + 13, 1, PAL.rainTip, false, 30);
    }

    const lo = GROUND_L + this.r * 0.8;
    const hi = GROUND_R - this.r * 0.8;
    if (this.x < lo) [this.x, this.vx] = [lo, 0];
    if (this.x > hi) [this.x, this.vx] = [hi, 0];
    if (this.y < 34) [this.y, this.vy] = [34, 0];
    if (this.y > PF_H - 18) [this.y, this.vy] = [PF_H - 18, 0];

    this.invT = Math.max(0, this.invT - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.lean += (clamp(this.vx / 26 + world.sky.wind / 30, -3, 3) - this.lean) * Math.min(1, dt * 12);
    // Hit gag: flipped inside out, flapping, for the first part of the hit.
    this.inv = this.hitT > 0.25;
    this.tilt = this.inv ? (Math.floor(this.t * 20) % 2 ? 3 : -3) : this.lean;

    this.flashT = Math.max(0, this.flashT - dt);

    const moving = Math.hypot(this.vx, this.vy) > 15;
    this.bobY = moving ? (Math.floor(this.t * 8) % 2 ? -1 : 0) : Math.round(Math.sin(this.t * 2.5) * 0.7);
    if (moving) {
      this.idleT = 0;
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.2;
        this.stepSide *= -1;
        stepRipple(world, this.x + this.stepSide * 2, this.y + 13, 5);
      }
    } else if (this.hitT <= 0 && (this.idleT += dt) > this.nextTwirl) {
      this.idleT = 0;
      this.nextTwirl = rand(3.5, 6);
      this.twirlT = TWIRL;
    }

    // Standing still for a while: give the umbrella a twirl to shake the rain off.
    if (this.twirlT > 0) {
      this.twirlT -= dt;
      this.tilt = Math.sin(this.twirlT * 40) * 3 * (this.twirlT / TWIRL);
      if (Math.random() < 0.6) {
        const side = Math.random() < 0.5 ? -1 : 1;
        world.splash(this.x + side * this.r, this.y + this.bobY, 1, PAL.splash, true, 60);
      }
    }
  }

  die() {
    this.dead = true;
    this.deadT = 0;
    this.hitT = 0;
    this.invT = 0;
    this.inv = false;
  }

  // Blinks while invulnerable.
  get visible() {
    return this.invT <= 0 || this.hitT > 0 || Math.floor(this.invT * 14) % 2 === 0;
  }
}
