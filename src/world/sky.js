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
// keep umbrellas up, wet: puddle size, sun: warm sunlight.
// Sunny is not part of the normal cycle: it only comes out for a SUN RUSH.
export const WEATHER = {
  rainy: { name: 'RAINY', rain: 1, wind: 0, fog: 0, clouds: 0.15, lightning: 0, open: 1, wet: 1, sun: 0 },
  drizzle: { name: 'DRIZZLE', rain: 0.4, wind: 0, fog: 0, clouds: 0.08, lightning: 0, open: 1, wet: 0.8, sun: 0 },
  hazy: { name: 'HAZY', rain: 0.35, wind: 0, fog: 1, clouds: 0.25, lightning: 0, open: 1, wet: 0.85, sun: 0 },
  stormy: { name: 'STORMY', rain: 2.2, wind: 1, fog: 0, clouds: 0.55, lightning: 1, open: 1, wet: 1.15, sun: 0 },
  sunny: { name: 'SUNNY', rain: 0, wind: 0, fog: 0, clouds: 0, lightning: 0, open: 0, wet: 0.45, sun: 1 },
};
const SNOW_NAMES = { rainy: 'SNOWY', drizzle: 'FLURRIES', stormy: 'BLIZZARD' };
const PARAMS = ['rain', 'wind', 'fog', 'clouds', 'lightning', 'open', 'wet', 'sun'];
const TRANSITION = 6; // seconds to blend between weathers
const WEIGHTS = { rainy: 3, drizzle: 2, hazy: 2, stormy: 3 };
const CHANGE_EVERY = [30, 45]; // seconds between weather changes

const GUST_WARN = 1; // seconds of warning before a gust
const GUST_LEN = 2;
const GUST_SPEED = 55; // px/s

export class Sky {
  // cycle: seconds per full day; autoWeather: change weather by itself;
  // stormAfter: seconds before storms may appear; pace: multiplies the time
  // between weather changes (Zen: 2, twice as slow).
  constructor({ time = 0.15, cycle = 240, dayNight = true, weather = 'rainy', autoWeather = false, stormAfter = 60, pace = 1 } = {}) {
    this.time = dayNight ? time : AFTERNOON;
    this.cycle = cycle;
    this.dayNight = dayNight;
    this.autoWeather = autoWeather;
    this.stormAfter = stormAfter;
    this.pace = pace;
    this.age = 0;
    this.weatherKey = weather;
    this.from = { ...WEATHER[weather] };
    this.to = WEATHER[weather];
    this.blend = 1;
    this.blendTime = TRANSITION;
    this.p = { ...WEATHER[weather] };
    this.nextWeatherT = rand(...CHANGE_EVERY) * pace;
    this.hold = false; // pauses automatic changes (during a SUN RUSH)
    this.wind = 0;
    this.gustT = rand(3, 6);
    this.gustDir = 0;
    this.warn = 0; // direction of an incoming gust while warning, else 0
    this.gusting = 0;
    this.flash = 0;
    this.strikeT = rand(2, 5);
    this.bolt = null; // pixels of the last lightning bolt
    this.forceDay = false;
    this.dayBlend = 0;
    this.events = []; // 'weather', 'thunder', 'gust' — read and cleared by the scene
  }

  get weather() {
    return WEATHER[this.weatherKey];
  }

  // The weather's name, as it falls where you are: rain is snow in the snowy
  // village.
  label(snowy) {
    return (snowy && SNOW_NAMES[this.weatherKey]) || this.weather.name;
  }

  setDayNight(on) {
    if (on === this.dayNight) return;
    this.dayNight = on;
    if (!on) this.time = AFTERNOON;
  }

  // Blend to a weather over `seconds`. Returns whether anything changed.
  setWeather(key, seconds = TRANSITION) {
    if (key === this.weatherKey) return false;
    this.from = { ...this.p };
    this.to = WEATHER[key];
    this.weatherKey = key;
    this.blend = 0;
    this.blendTime = seconds;
    this.events.push('weather');
    return true;
  }

  update(dt) {
    this.age += dt;
    if (this.dayNight) this.time = (this.time + dt / this.cycle) % 1;

    if (this.autoWeather && !this.hold && (this.nextWeatherT -= dt) <= 0) {
      this.nextWeatherT = rand(...CHANGE_EVERY) * this.pace;
      const w = { ...WEIGHTS, [this.weatherKey]: 0 };
      if (this.age < this.stormAfter) w.stormy = 0;
      this.setWeather(pick(w));
    }
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / this.blendTime);
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

    // Lightning: a bolt into the street and a double flash, every few seconds in storms.
    this.flash = Math.max(0, this.flash - dt * 2.5);
    if (this.p.lightning > 0.5 && (this.strikeT -= dt) <= 0) {
      this.strikeT = rand(4, 8);
      this.flash = 1;
      this.bolt = makeBolt(rand(30, PF_W - 30), rand(40, 130));
      this.events.push('thunder');
    }

    // A SUN RUSH brings out the daylight whatever the hour, then lets it go.
    this.dayBlend = clamp(this.dayBlend + (this.forceDay ? dt / 0.6 : -dt / 2), 0, 1);
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
    // Clouds grey the light, a little less in the blue; a rush pulls it to full day.
    return a.tint.map((c, j) => {
      const hour = lerp(lerp(c, b.tint[j], k), 255, this.dayBlend);
      return Math.round(hour * (1 - this.p.clouds * (j === 2 ? 0.28 : 0.4)));
    });
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
    const sun = this.p.sun * (1 - this.night);
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
    // The bolt shows for the first moment, with a glow along it.
    if (this.flash > 0.6 && this.bolt) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = soft ? '#3a4a66' : '#5a6e9a';
      for (const [x, y] of this.bolt) ctx.fillRect(x - 1, y, 3, 1);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffffff';
      for (const [x, y] of this.bolt) ctx.fillRect(x, y, 1, 1);
    }
    // Two pulses of light over the whole street.
    const on = this.flash > 0.8 || (this.flash > 0.45 && this.flash < 0.62);
    if (!on) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(220, 230, 255, ${soft ? 0.18 : 0.6})`;
    ctx.fillRect(0, 0, PF_W, PF_H);
    ctx.globalCompositeOperation = 'source-over';
  }
}

// A jagged bolt from the top of the screen down to (x, y), as a list of
// pixels, with a short fork part-way down.
function makeBolt(x, y) {
  const px = [];
  let cx = x + rand(-30, 30);
  const line = (x0, y0, x1, y1) => {
    const n = Math.max(1, Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) px.push([Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n))]);
  };
  const steps = 6;
  let cy = -4;
  for (let i = 1; i <= steps; i++) {
    const ny = lerp(-4, y, i / steps);
    const nx = i === steps ? x : lerp(cx, x, i / steps) + rand(-10, 10);
    line(cx, cy, nx, ny);
    if (i === 3) line(nx, ny, nx + rand(-18, 18), ny + rand(12, 24));
    cx = nx;
    cy = ny;
  }
  return px;
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
