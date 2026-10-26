// Picks a low-res buffer layout for the window shape and scales it up by an
// integer factor so pixels stay square and crisp.
const LAYOUTS = {
  // Desktop: playfield in the middle, HUD panels on both sides (arcade bezel).
  landscape: { name: 'landscape', w: 320, h: 240, pfX: 70, pfY: 0 },
  // Phones: HUD strip on top, control strip at the bottom.
  portrait: { name: 'portrait', w: 180, h: 320, pfX: 0, pfY: 24 },
};

export class Display {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layout = null;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const L = innerWidth / innerHeight < 0.85 ? LAYOUTS.portrait : LAYOUTS.landscape;
    if (this.layout !== L) {
      this.canvas.width = L.w;
      this.canvas.height = L.h;
      this.layout = L;
    }
    const dpr = devicePixelRatio || 1;
    const fit = Math.min((innerWidth * dpr) / L.w, (innerHeight * dpr) / L.h);
    const s = fit >= 1 ? Math.floor(fit) : fit;
    this.canvas.style.width = `${(L.w * s) / dpr}px`;
    this.canvas.style.height = `${(L.h * s) / dpr}px`;
    this.ctx.imageSmoothingEnabled = false;
  }
}
