/* ------------------------------------------------------------------ */
/*  Dot-sphere globe with markers, discovery arcs, drag + focus        */
/* ------------------------------------------------------------------ */

import { rotateYP, type Vec3 } from './shapes3d';
import type { Loc } from '../data/content';

export class GlobeEngine {
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private w = 0; private h = 0; private dpr = 1;
  private dots: Vec3[] = [];
  private latRings: Vec3[][] = [];
  private yaw = -0.9; private pitch = 0.32;
  private tyaw = -0.9; private tpitch = 0.32;
  private vel = 0;
  private dragging = false; private lastX = 0; private lastY = 0;
  private idleTimer = 0;
  private auto = true;
  private t = 0; private raf = 0; private last = 0; private running = false;
  private selected: string | null = null;
  private locs: Loc[] = [];
  private onPick: (id: string | null) => void = () => {};
  private downX = 0; private downY = 0;

  init(canvas: HTMLCanvasElement, locs: Loc[], quality: 0 | 1) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.locs = locs;
    const n = quality ? 2200 : 1200;
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = ga * i;
      this.dots.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const ring: Vec3[] = [];
      const lr = (lat * Math.PI) / 180;
      for (let lon = 0; lon < 360; lon += 6) {
        const a = (lon * Math.PI) / 180;
        ring.push([Math.cos(lr) * Math.cos(a), Math.sin(lr), Math.cos(lr) * Math.sin(a)]);
      }
      this.latRings.push(ring);
    }
    this.resize();
    canvas.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    this.start();
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth; this.h = this.canvas.clientHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setAuto(v: boolean) { this.auto = v; }
  setSelected(id: string | null) { this.selected = id; }
  setOnPick(f: (id: string | null) => void) { this.onPick = f; }

  focus(loc: Loc) {
    const lon = (loc.lon * Math.PI) / 180;
    const lat = (loc.lat * Math.PI) / 180;
    let target = lon - Math.PI / 2;
    while (target < this.tyaw - Math.PI) target += Math.PI * 2;
    while (target > this.tyaw + Math.PI) target -= Math.PI * 2;
    this.tyaw = target;
    this.tpitch = Math.max(-1.15, Math.min(1.15, lat));
    this.vel = 0;
    this.idleTimer = 0;
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = true;
    this.lastX = e.clientX; this.lastY = e.clientY;
    this.downX = e.clientX; this.downY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX; this.lastY = e.clientY;
    this.tyaw += dx * 0.0052;
    this.tpitch = Math.max(-1.3, Math.min(1.3, this.tpitch + dy * 0.0045));
    this.vel = dx * 0.0022;
    this.idleTimer = 0;
  };

  private onUp = (e: PointerEvent) => {
    const wasDrag = Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 7;
    this.dragging = false;
    if (!wasDrag) {
      const rect = this.canvas.getBoundingClientRect();
      const id = this.pick(e.clientX - rect.left, e.clientY - rect.top);
      this.onPick(id);
    }
  };

  pick(mx: number, my: number): string | null {
    const R = this.radius();
    let best: string | null = null;
    let bestD = 16;
    for (const loc of this.locs) {
      const p = this.projectLoc(loc, R);
      if (p.z < 0.03) continue;
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < bestD) { bestD = d; best = loc.id; }
    }
    return best;
  }

  private radius() { return Math.min(this.w, this.h) * 0.42; }
  private cx() { return this.w / 2; }
  private cy() { return this.h / 2; }

  private projectLoc(loc: Loc, R: number) {
    const lon = (loc.lon * Math.PI) / 180;
    const lat = (loc.lat * Math.PI) / 180;
    const p: Vec3 = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
    const r = rotateYP(p, this.yaw, this.pitch);
    return { x: this.cx() + r[0] * R, y: this.cy() - r[1] * R, z: r[2] };
  }

  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      if (!this.dragging) {
        this.idleTimer += dt;
        if (this.auto && this.idleTimer > 2.5) this.tyaw += 0.05 * dt;
        this.tyaw += this.vel;
        this.vel *= 0.94;
      }
      this.yaw += (this.tyaw - this.yaw) * Math.min(1, dt * 4.5);
      this.pitch += (this.tpitch - this.pitch) * Math.min(1, dt * 4.5);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  staticRender() { this.t = 0.5; this.draw(); }

  private draw() {
    const ctx = this.ctx;
    if (!ctx || !this.w) return;
    const { w, h, t } = this;
    const R = this.radius();
    const cx = this.cx(), cy = this.cy();
    ctx.clearRect(0, 0, w, h);

    // atmosphere glow
    const g = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.28);
    g.addColorStop(0, 'rgba(181,154,255,0.075)');
    g.addColorStop(0.75, 'rgba(181,154,255,0.03)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // dots
    for (const p of this.dots) {
      const r = rotateYP(p, this.yaw, this.pitch);
      if (r[2] < -0.04) continue;
      const x = cx + r[0] * R;
      const y = cy - r[1] * R;
      const k = (r[2] + 0.04) / 1.04;
      ctx.globalAlpha = 0.1 + 0.4 * k;
      ctx.fillStyle = k > 0.75 ? '#F3EBDD' : '#8f8a7a';
      ctx.fillRect(x, y, 1.15, 1.15);
    }

    // latitude cage
    ctx.strokeStyle = '#F3EBDD';
    for (const ring of this.latRings) {
      ctx.globalAlpha = 0.05;
      ctx.lineWidth = 1;
      ctx.beginPath();
      let open = false;
      for (let i = 0; i <= ring.length; i++) {
        const p = rotateYP(ring[i % ring.length], this.yaw, this.pitch);
        if (p[2] > -0.05) {
          const x = cx + p[0] * R;
          const y = cy - p[1] * R;
          if (!open) { ctx.moveTo(x, y); open = true; } else ctx.lineTo(x, y);
        } else open = false;
      }
      ctx.stroke();
    }

    // rim
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#B59AFF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // discovery arcs from selected location
    if (this.selected) {
      const src = this.locs.find((l) => l.id === this.selected);
      if (src) {
        const others = this.locs.filter((l) => l.id !== src.id && l.cat === src.cat).slice(0, 3);
        if (others.length === 0) others.push(...this.locs.filter((l) => l.id !== src.id).slice(0, 2));
        for (const dst of others) {
          const a = this.locVec(src), b = this.locVec(dst);
          const dist = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
          const lift = 1 + Math.sin(Math.PI * 0.5) * dist * 0.32;
          ctx.lineWidth = 1.2;
          let prev: Vec3 | null = null;
          for (let i = 0; i <= 28; i++) {
            const u = i / 28;
            const v: Vec3 = [
              (a[0] + (b[0] - a[0]) * u) * lift,
              (a[1] + (b[1] - a[1]) * u) * lift,
              (a[2] + (b[2] - a[2]) * u) * lift,
            ];
            const l2 = Math.hypot(v[0], v[1], v[2]);
            v[0] /= l2; v[1] /= l2; v[2] /= l2;
            const r = rotateYP(v, this.yaw, this.pitch);
            if (prev) {
              const pa = rotateYP(prev, this.yaw, this.pitch);
              ctx.globalAlpha = 0.4 * Math.min(1, Math.max(0, r[2]) + 0.1) * (0.6 + 0.4 * Math.sin(t * 3 + i * 0.4));
              ctx.strokeStyle = '#D7FF45';
              ctx.beginPath();
              ctx.moveTo(cx + pa[0] * R, cy - pa[1] * R);
              ctx.lineTo(cx + r[0] * R, cy - r[1] * R);
              ctx.stroke();
            }
            prev = v;
          }
        }
      }
    }

    // markers
    for (const loc of this.locs) {
      const p = this.projectLoc(loc, R);
      if (p.z < 0.02) continue;
      const isSel = loc.id === this.selected;
      const pulse = (t * 1.4 + loc.lat * 0.1) % 1;
      ctx.globalAlpha = (1 - pulse) * 0.5 * Math.min(1, p.z * 2);
      ctx.strokeStyle = '#D7FF45';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 + pulse * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, p.z);
      ctx.fillStyle = isSel ? '#D7FF45' : '#FF704F';
      ctx.shadowColor = isSel ? '#D7FF45' : '#FF704F';
      ctx.shadowBlur = isSel ? 12 : 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isSel ? 5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (isSel) {
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#F3EBDD';
        ctx.font = '600 11px "Space Grotesk", sans-serif';
        ctx.fillText(loc.name, p.x + 10, p.y - 8);
      }
    }
    ctx.globalAlpha = 1;
  }

  private locVec(loc: Loc): Vec3 {
    const lon = (loc.lon * Math.PI) / 180;
    const lat = (loc.lat * Math.PI) / 180;
    return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
  }
}
