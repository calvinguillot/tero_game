const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'action',
  ShiftLeft: 'action',
  ShiftRight: 'action',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Escape: 'pause',
  KeyP: 'pause',
  KeyC: 'photo',
};

const STICK_RANGE = 14; // buffer pixels of drag for full deflection
const DEADZONE = 0.15;

// Tracks held actions (`down`) and one-shot presses (`hits`) that scenes
// consume. Pointers (mouse or touch) drive an on-screen stick, the force
// field button and the pause button, located by `zoneAt(x, y)` in buffer pixels.
export class Input {
  constructor(canvas, display) {
    this.canvas = canvas;
    this.display = display;
    this.zoneAt = () => null;
    this.down = new Set();
    this.hits = new Set();
    this.stick = null; // { id, ox, oy, vx, vy, dir }
    this.buttonId = null;
    this.tap = null;

    addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault();
      if (!e.repeat) {
        this.hits.add(a);
        if (a === 'action') this.hits.add('confirm');
      }
      this.down.add(a);
    });
    addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.down.delete(a);
    });
    addEventListener('blur', () => {
      this.down.clear();
      this.stick = null;
      this.buttonId = null;
    });
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  toBuffer(e) {
    const r = this.canvas.getBoundingClientRect();
    const L = this.display.layout;
    return { x: ((e.clientX - r.left) * L.w) / r.width, y: ((e.clientY - r.top) * L.h) / r.height };
  }

  onDown(e) {
    const p = this.toBuffer(e);
    const zone = this.zoneAt(p.x, p.y);
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already gone; nothing to capture.
    }
    if (zone === 'pause') {
      this.hits.add('pause');
    } else if (zone === 'button') {
      this.buttonId = e.pointerId;
      this.down.add('action');
      this.hits.add('action');
      this.hits.add('confirm');
    } else if (zone === 'stick') {
      this.stick = { id: e.pointerId, ox: p.x, oy: p.y, vx: 0, vy: 0, dir: null };
    } else {
      this.hits.add('confirm');
      this.tap = p;
    }
  }

  // Where the last plain tap/click landed (buffer pixels), once.
  takeTap() {
    const t = this.tap;
    this.tap = null;
    return t;
  }

  onMove(e) {
    const s = this.stick;
    if (!s || s.id !== e.pointerId) return;
    const p = this.toBuffer(e);
    let dx = (p.x - s.ox) / STICK_RANGE;
    let dy = (p.y - s.oy) / STICK_RANGE;
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    s.vx = dx;
    s.vy = dy;
    // Flicking the stick also works as a menu press.
    const dir = m < 0.6 ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    if (dir && dir !== s.dir) this.hits.add(dir);
    s.dir = dir;
  }

  onUp(e) {
    if (this.stick?.id === e.pointerId) this.stick = null;
    if (this.buttonId === e.pointerId) {
      this.buttonId = null;
      this.down.delete('action');
    }
  }

  axis() {
    const s = this.stick;
    if (s && Math.hypot(s.vx, s.vy) > DEADZONE) return { x: s.vx, y: s.vy };
    let x = (this.down.has('right') ? 1 : 0) - (this.down.has('left') ? 1 : 0);
    let y = (this.down.has('down') ? 1 : 0) - (this.down.has('up') ? 1 : 0);
    if (x && y) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  hit(action) {
    return this.hits.delete(action);
  }

  endFrame() {
    this.hits.clear();
    this.tap = null;
  }
}
