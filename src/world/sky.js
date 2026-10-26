import { rand, pick, lerp, clamp } from '../core/math.js';
import { PixBuf } from '../render/pixels.js';
import { PF_W, PF_H } from '../config.js';

// Time of day and weather. Both run continuously and independently; the scene
// is lit by multiplying the finished street with the current tint.

// Keyframes over one day (0..1). Tints are multiplied over the street.
const DAY = [
  { t: 0.0, name: 'SUNRISE', tint: [255, 212, 196] },
  { t: 0.1, name: 'MORNING', tint: [255, 250, 240] },
  { t: 0.3, name: 'AFTERNOON', tint: [255, 255, 255] },
  { t: 0.5, name: 'SUNSET', tint: [255, 182, 140] },
  { t: 0.6, name: 'DUSK', tint: [160, 150, 210] },
  { t: 0.7, name: 'NIGHT', tint: [98, 112, 175] },
  { t: 0.9, name: 'NIGHT', tint: [98, 112, 175] },
  { t: 1.0, name: 'SUNRISE', tint: [255, 212, 196] },
];
const AFTERNOON = 0.3;

// rain: drop rate multiplier, wind: gust strength, fog: haze density,
// clouds: extra gloom, lightning: strikes on/off, open: whether passers-by
// keep umbrellas up, wet: puddle size, slick: puddles make you slide.
export const WEATHER = {
  rainy: { name: 'RAINY', rain: 1, wind: 0, fog: 0, clouds: 0.15, lightning: 0, open: 1, wet: 1, slick: 0 },
  sunny: { name: 'SUNNY', rain: 0, wind: 0, fog: 0, clouds: 0, lightning: 0, open: 0, wet: 0.45, slick: 1 },
  hazy: { name: 'HAZY', rain: 0.35, wind: 0, fog: 1, clouds: 0.25, lightning: 0, open: 1, wet: 0.85, slick: 0 },
  stormy: { name: 'STORMY', rain: 2.2, wind: 1, fog: 0, clouds: 0.55, lightning: 1, open: 1, wet: 1.15, slick: 0 },
};
const PARAMS = ['rain', 'wind', 'fog', 'clouds', 'lightning', 'open', 'wet', 'slick'];
const TRANSITION = 6; // seconds to blend between weathers
const WEIGHTS = { rainy: 4, sunny: 2, hazy: 2, stormy: 2 };

const GUST_WARN = 1; // seconds of warning before a gust
const GUST_LEN = 2;
const GUST_SPEED = 55; // px/s

export class Sky {
  // cycle: seconds per full day; autoWeather: change weather by itself;
  // stormAfter: seconds before storms may appear.
  constructor({ time = 0.15, cycle = 240, dayNight = true, weather = 'rainy', autoWeather = false, stormAfter = 60 } = {}) {
    this.time = dayNight ? time : AFTERNOON;
    this.cycle = cycle;
    this.dayNight = dayNight;
    this.autoWeather = autoWeather;
    this.stormAfter = stormAfter;
    this.age = 0;
    this.weatherKey = weather;
    this.from = { ...WEATHER[weather] };
    this.to = WEATHER[weather];
    this.blend = 1;
    this.p = { ...WEATHER[weather] };
    this.nextWeatherT = rand(45, 60);
    this.wind = 0;
    this.gustT = rand(3, 6);
    this.gustDir = 0;
    this.warn = 0; // direction of an incoming gust while warning, else 0
    this.gusting = 0;
    this.flash = 0;
    this.strikeT = rand(5, 10);
    this.events = []; // 'weather', 'thunder', 'gust' — read and cleared by the scene
  }

  get weather() {
    return WEATHER[this.weatherKey];
  }

  setDayNight(on) {
    if (on === this.dayNight) return;
    this.dayNight = on;
    if (!on) this.time = AFTERNOON;
  }

  setWeather(key) {
    if (key === this.weatherKey) return;
    this.from = { ...this.p };
    this.to = WEATHER[key];
    this.weatherKey = key;
    this.blend = 0;
    this.events.push('weather');
  }

  update(dt) {
    this.age += dt;
    if (this.dayNight) this.time = (this.time + dt / this.cycle) % 1;

    if (this.autoWeather && (this.nextWeatherT -= dt) <= 0) {
      this.nextWeatherT = rand(45, 60);
      const w = { ...WEIGHTS, [this.weatherKey]: 0 };
      if (this.age < this.stormAfter) w.stormy = 0;
      this.setWeather(pick(w));
    }
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / TRANSITION);
      const e = this.blend * this.blend * (3 - 2 * this.blend);
      for (const k of PARAMS) this.p[k] = lerp(this.from[k], this.to[k], e);
    }

    // Wind: a gentle sway, plus gusts announced a second ahead.
    let target = Math.sin(this.age * 0.3) * 8 * this.p.wind;
    if (this.p.wind > 0.5) {
      this.gustT -= dt;
      if (this.gusting > 0) {
        this.gusting -= dt;
        target = this.gustDir * GUST_SPEED * this.p.wind;
        if (this.gusting <= 0) this.gustT = rand(4, 8);
      } else if (this.gustT <= GUST_WARN) {
        if (!this.warn) this.warn = Math.random() < 0.5 ? -1 : 1;
        if (this.gustT <= 0) {
          this.gustDir = this.warn;
          this.warn = 0;
          this.gusting = GUST_LEN;
          this.events.push('gust');
        }
      }
    } else {
      this.warn = 0;
      this.gusting = 0;
    }
    this.wind += (target - this.wind) * Math.min(1, dt * 2.5);

    // Lightning: a double flicker every so often during storms.
    this.flash = Math.max(0, this.flash - dt * 4);
    if (this.p.lightning > 0.5 && (this.strikeT -= dt) <= 0) {
      this.strikeT = rand(6, 12);
      this.flash = 1;
      this.events.push('thunder');
    }
  }

  takeEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  get timeName() {
    let name = DAY[0].name;
    for (const k of DAY) if (this.time >= k.t) name = k.name;
    return name;
  }

  // Light colour multiplied over the scene: time of day, darkened by clouds.
  get tint() {
    let i = 0;
    while (i < DAY.length - 2 && this.time >= DAY[i + 1].t) i++;
    const a = DAY[i];
    const b = DAY[i + 1];
    const k = (this.time - a.t) / (b.t - a.t);
    // Clouds grey the light, a little less in the blue.
    return a.tint.map((c, j) => Math.round(lerp(c, b.tint[j], k) * (1 - this.p.clouds * (j === 2 ? 0.28 : 0.4))));
  }

  // 0 in daylight, 1 in the dead of night.
  get night() {
    const [r, g, b] = this.tint;
    const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    return clamp((0.8 - lum) / 0.45, 0, 1);
  }

  // Multiply the light over the playfield, add a little warmth when sunny.
  drawTint(ctx) {
    const [r, g, b] = this.tint;
    if (r < 255 || g < 255 || b < 255) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, 0, PF_W, PF_H);
    }
    const sun = this.p.slick * (1 - this.night);
    if (sun > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255, 220, 150, ${0.08 * sun})`;
      ctx.fillRect(0, 0, PF_W, PF_H);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  drawFog(ctx) {
    if (this.p.fog < 0.05) return;
    const cv = fogLayer(Math.round(this.p.fog * 8) / 8);
    const off = Math.floor(this.age * 6) % 16;
    ctx.drawImage(cv, -off, 0);
  }

  drawFlash(ctx, soft) {
    if (this.flash <= 0) return;
    // Two quick pulses.
    const on = this.flash > 0.75 || (this.flash > 0.35 && this.flash < 0.55);
    if (!on) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(220, 230, 255, ${soft ? 0.15 : 0.45})`;
    ctx.fillRect(0, 0, PF_W, PF_H);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// Ordered-dither haze, densest at the top of the street (where walkers come from).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const fogCache = new Map();
function fogLayer(level) {
  let cv = fogCache.get(level);
  if (cv) return cv;
  const w = PF_W + 16;
  const b = new PixBuf(w, PF_H);
  for (let y = 0; y < PF_H; y++) {
    const density = level * clamp(0.85 - (y / PF_H) * 1.25, 0, 0.7);
    for (let x = 0; x < w; x++) if (BAYER[(x % 4) + (y % 4) * 4] / 16 < density) b.d[y * w + x] = 1;
  }
  cv = b.toCanvas([null, '#cfe0ea']);
  fogCache.set(level, cv);
  return cv;
}
