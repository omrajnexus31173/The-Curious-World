/* ------------------------------------------------------------------ */
/*  Opening universe: deep starfield, orbital rings, wireframe bodies  */
/* ------------------------------------------------------------------ */

import { icosahedron, octahedron, torus, renderShape, type Shape } from './shapes3d';

interface Star { x: number; y: number; z: number; tw: number; c: string; }
interface Comet { x: number; y: number; vx: number; vy: number; life: number; }
interface Ring { rx: number; tilt: number; speed: number; angle: number; sat: string; }

export class HeroScene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private w = 0; private h = 0; private dpr = 1;
  private stars: Star[] = [];
  private comets: Comet[] = [];
  private cometTimer = 3;
  private t = 0; private raf = 0; private last = 0; private running = false;
  private mx = 0; private my = 0; private emx = 0; private emy = 0;
  private shapes: { shape: Shape; ox: number; oy: number; scale: number; sx: number; sy: number; color: string; alpha: number; lw: number }[] = [];
  private rings: Ring[] = [
    { rx: 0.46, tilt: 0.16, speed: 0.12, angle: 0.8, sat: '#D7FF45' },
    { rx: 0.6, tilt: -0.1, speed: -0.07, angle: 2.6, sat: '#FF704F' },
    { rx: 0.74, tilt: 0.05, speed: 0.045, angle: 4.4, sat: '#B59AFF' },
  ];

  constructor(canvas: HTMLCanvasElement, quality: 0 | 1) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const count = quality ? 480 : 240;
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      this.stars.push({
        x: Math.random(), y: Math.random(), z: 0.06 + Math.random() * 0.94,
        tw: 0.5 + Math.random() * 2.4,
        c: roll < 0.72 ? '#F3EBDD' : roll < 0.87 ? '#B59AFF' : '#FF704F',
      });
    }
    this.shapes = [
      { shape: icosahedron(1), ox: 0.62, oy: 0.5, scale: 0.19, sx: 0.16, sy: 0.05, color: '#F3EBDD', alpha: 0.55, lw: 1 },
      { shape: octahedron(1), ox: 0.16, oy: 0.3, scale: 0.042, sx: 0.5, sy: 0.34, color: '#D7FF45', alpha: 0.6, lw: 1 },
      { shape: torus(1.2, 0.4, 26, 8), ox: 0.85, oy: 0.78, scale: 0.055, sx: 0.3, sy: 0.42, color: '#B59AFF', alpha: 0.5, lw: 1 },
      { shape: octahedron(1), ox: 0.3, oy: 0.76, scale: 0.026, sx: -0.6, sy: 0.2, color: '#FF704F', alpha: 0.5, lw: 1 },
    ];
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth; this.h = this.canvas.clientHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setMouse(x: number, y: number) { this.mx = x; this.my = y; }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  staticRender() { this.t = 1.2; this.draw(); }

  private draw() {
    const ctx = this.ctx;
    if (!ctx || !this.w) return;
    this.emx += (this.mx - this.emx) * 0.04;
    this.emy += (this.my - this.emy) * 0.04;
    const { w, h, t } = this;

    ctx.clearRect(0, 0, w, h);

    // smoky nebulae
    let g = ctx.createRadialGradient(w * 0.74, h * 0.26, 0, w * 0.74, h * 0.26, w * 0.42);
    g.addColorStop(0, 'rgba(255,112,79,0.055)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    g = ctx.createRadialGradient(w * 0.16, h * 0.72, 0, w * 0.16, h * 0.72, w * 0.48);
    g.addColorStop(0, 'rgba(181,154,255,0.065)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    g = ctx.createRadialGradient(w * 0.62, h * 0.5, 0, w * 0.62, h * 0.5, w * 0.2);
    g.addColorStop(0, 'rgba(215,255,69,0.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // starfield with depth drift
    for (const s of this.stars) {
      s.x -= 0.028 * s.z * 0.016;
      if (s.x < -0.02) s.x = 1.02;
      const tw = 0.55 + 0.45 * Math.sin(t * s.tw + s.x * 40);
      const px = s.x * w + this.emx * 26 * s.z;
      const py = s.y * h + this.emy * 18 * s.z;
      const r = 0.4 + s.z * 1.5;
      ctx.globalAlpha = (0.12 + 0.6 * s.z) * tw;
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // orbital rings + satellites
    const cx = w * 0.5 + this.emx * 14;
    const cy = h * 0.52 + this.emy * 10;
    for (const ring of this.rings) {
      const rx = ring.rx * Math.min(w, h * 1.25);
      const ry = rx * 0.3;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ring.tilt);
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = '#F3EBDD';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ring.angle += ring.speed * 0.016;
      const sx = Math.cos(ring.angle) * rx;
      const sy = Math.sin(ring.angle) * ry;
      const behind = Math.sin(ring.angle) < 0;
      ctx.globalAlpha = behind ? 0.25 : 0.9;
      ctx.fillStyle = ring.sat;
      ctx.shadowColor = ring.sat;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sx, sy, behind ? 1.8 : 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // satellite trail
      for (let k = 1; k <= 4; k++) {
        const aa = ring.angle - Math.sign(ring.speed) * k * 0.07;
        ctx.globalAlpha = 0.3 - k * 0.06;
        ctx.beginPath();
        ctx.arc(Math.cos(aa) * rx, Math.sin(aa) * ry, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // comets
    this.cometTimer -= 0.016;
    if (this.cometTimer <= 0) {
      this.cometTimer = 4 + Math.random() * 5;
      const fromLeft = Math.random() < 0.5;
      this.comets.push({
        x: fromLeft ? -50 : w + 50, y: Math.random() * h * 0.5,
        vx: (fromLeft ? 1 : -1) * (0.4 + Math.random() * 0.3), vy: 0.12 + Math.random() * 0.1,
        life: 1,
      });
    }
    for (const c of this.comets) {
      c.x += c.vx * 260; c.y += c.vy * 260; c.life -= 0.012;
      const grad = ctx.createLinearGradient(c.x, c.y, c.x - c.vx * 160, c.y - c.vy * 160);
      grad.addColorStop(0, `rgba(243,235,221,${0.7 * c.life})`);
      grad.addColorStop(1, 'rgba(243,235,221,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x - c.vx * 160, c.y - c.vy * 160);
      ctx.stroke();
    }
    this.comets = this.comets.filter((c) => c.life > 0 && c.x > -120 && c.x < w + 120);

    // wireframe bodies
    const m = Math.min(w, h);
    for (const s of this.shapes) {
      renderShape(ctx, s.shape, {
        cx: s.ox * w + this.emx * 30,
        cy: s.oy * h + this.emy * 22,
        scale: m * s.scale,
        rotY: t * s.sx * 4,
        rotX: 0.35 + Math.sin(t * 0.2 + s.ox * 9) * 0.3 + t * s.sy * 2,
        color: s.color, alpha: s.alpha, lineWidth: s.lw, fillGlow: s.scale > 0.1,
      });
    }
  }
}
