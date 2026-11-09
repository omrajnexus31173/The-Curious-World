/* ------------------------------------------------------------------ */
/*  Multi-cursor ecosystem: dot + eased ring + coordinated swarm       */
/* ------------------------------------------------------------------ */

const COLORS = ['#D7FF45', '#FF704F', '#B59AFF', '#F3EBDD'];

interface Agent { x: number; y: number; vx: number; vy: number; ang: number; spd: number; rad: number; size: number; color: string; phase: number; }
interface Ripple { x: number; y: number; r: number; a: number; color: string; }

export class CursorSystem {
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private w = 0; private h = 0; private dpr = 1;
  private tx = -999; private ty = -999;
  private dotX = -999; private dotY = -999;
  private ringX = -999; private ringY = -999;
  private ringR = 26;
  private agents: Agent[] = [];
  private ripples: Ripple[] = [];
  private raf = 0; private last = 0; private running = false;
  private lastMove = 0;
  private formation: [number, number][] = [];
  private formKind = 0;
  private down = false;
  private hover = false;
  private label = '';
  private labelColor = '#D7FF45';
  private inWindow = false;
  private onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { this.label = ''; } };

  init(canvas: HTMLCanvasElement, mobile = false) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    document.documentElement.classList.add('has-custom-cursor');
    this.resize();
    const count = mobile ? 7 : 14;
    for (let i = 0; i < count; i++) {
      this.agents.push({
        x: -100, y: -100, vx: 0, vy: 0,
        ang: Math.random() * Math.PI * 2,
        spd: 0.6 + Math.random() * 1.4,
        rad: 14 + Math.random() * 34,
        size: 1 + Math.random() * 2.2,
        color: COLORS[i % COLORS.length],
        phase: Math.random() * Math.PI * 2,
      });
    }
    window.addEventListener('resize', this.resize);
    window.addEventListener('mousemove', this.onMove, { passive: true });
    window.addEventListener('mousedown', this.onDown);
    window.addEventListener('mouseup', this.onUp);
    window.addEventListener('mouseover', this.onOver, true);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('keydown', this.onKey);
    if (mobile) {
      window.addEventListener('touchstart', this.onTouch, { passive: true });
      window.addEventListener('touchmove', this.onTouch, { passive: true });
    }
    this.start();
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.documentElement.classList.remove('has-custom-cursor');
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mousedown', this.onDown);
    window.removeEventListener('mouseup', this.onUp);
    window.removeEventListener('mouseover', this.onOver, true);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('keydown', this.onKey);
    window.removeEventListener('touchstart', this.onTouch as EventListener);
    window.removeEventListener('touchmove', this.onTouch as EventListener);
  }

  private resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  private onMove = (e: MouseEvent) => {
    this.tx = e.clientX; this.ty = e.clientY;
    this.inWindow = true;
    this.lastMove = performance.now();
  };
  private onDown = () => {
    this.down = true;
    this.spawnRipple(this.tx, this.ty, '#D7FF45');
    for (const a of this.agents) {
      const dx = a.x - this.tx, dy = a.y - this.ty;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 160) { a.vx += (dx / d) * 9; a.vy += (dy / d) * 9; }
    }
  };
  private onUp = () => { this.down = false; };
  private onBlur = () => { this.inWindow = false; this.tx = -999; this.ty = -999; };

  private onOver = (e: MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    const el = t.closest('[data-cursor], a, button, [role="button"]') as HTMLElement | null;
    if (el) {
      this.hover = true;
      const mode = el.getAttribute('data-cursor') || '';
      this.label = mode === 'view' ? 'VIEW' : mode === 'drag' ? 'DRAG' : mode === 'add' ? 'ENTER' : mode === 'play' ? 'PLAY' : mode === 'pick' ? 'PICK' : 'EXPLORE';
      const accent = el.getAttribute('data-accent');
      this.labelColor = accent || (mode === 'drag' ? '#FF704F' : '#D7FF45');
    } else {
      this.hover = false;
      this.label = '';
    }
  };

  private onTouch = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    this.tx = t.clientX; this.ty = t.clientY;
    this.inWindow = true;
    this.lastMove = performance.now();
    if (e.type === 'touchstart' || Math.random() < 0.25) this.spawnRipple(t.clientX, t.clientY, COLORS[Math.floor(Math.random() * 3)]);
  };

  private spawnRipple(x: number, y: number, color: string) {
    if (x < 0) return;
    this.ripples.push({ x, y, r: 6, a: 0.5, color });
    if (this.ripples.length > 8) this.ripples.shift();
  }

  private start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private setFormation() {
    this.formKind = (this.formKind + 1) % 3;
    const f: [number, number][] = [];
    const n = this.agents.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (this.formKind === 0) f.push([Math.cos(a) * 24, Math.sin(a) * 24]);
      else if (this.formKind === 1) {
        const r = 8 + (i % 4) * 8;
        const q = Math.floor(i / 4) % 4;
        f.push([Math.cos((q * Math.PI) / 2) * r, Math.sin((q * Math.PI) / 2) * r]);
      } else f.push([Math.cos(a) * (14 + (i % 2) * 14), Math.sin(a) * (14 + (i % 2) * 14)]);
    }
    this.formation = f;
  }

  private update(dt: number) {
    const now = performance.now();
    const idle = this.inWindow && now - this.lastMove > 2600;
    if (idle && this.formation.length === 0) this.setFormation();
    if (!idle && this.formation.length > 0) this.formation = [];

    // dot: fast snap
    this.dotX += (this.tx - this.dotX) * Math.min(1, dt * 26);
    this.dotY += (this.ty - this.dotY) * Math.min(1, dt * 26);
    // ring: slow ease
    const ringTarget = this.hover ? 40 : this.down ? 18 : 26;
    this.ringR += (ringTarget - this.ringR) * Math.min(1, dt * 8);
    this.ringX += (this.tx - this.ringX) * Math.min(1, dt * 9);
    this.ringY += (this.ty - this.ringY) * Math.min(1, dt * 9);

    const t = now / 1000;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      let tx2: number, ty2: number;
      if (this.formation.length) {
        tx2 = this.dotX + this.formation[i][0];
        ty2 = this.dotY + this.formation[i][1];
      } else {
        a.ang += a.spd * dt;
        const breathe = 0.65 + 0.35 * Math.sin(t * 0.6 + a.phase);
        const r = a.rad * breathe;
        tx2 = this.dotX + Math.cos(a.ang) * r;
        ty2 = this.dotY + Math.sin(a.ang * 0.9 + a.phase) * r;
        if (this.hover) { // repel around hotspots
          const dx = tx2 - this.ringX, dy = ty2 - this.ringY;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 60) { tx2 += (dx / d) * (60 - d); ty2 += (dy / d) * (60 - d); }
        }
      }
      a.vx += ((tx2 - a.x) * 14 - a.vx * 5) * dt;
      a.vy += ((ty2 - a.y) * 14 - a.vy * 5) * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
    }

    for (const r of this.ripples) { r.r += dt * 160; r.a -= dt * 0.9; }
    this.ripples = this.ripples.filter((r) => r.a > 0);
  }

  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.w, this.h);
    // trailing fade for organic trails
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.globalCompositeOperation = 'source-over';

    for (const r of this.ripples) {
      ctx.globalAlpha = r.a;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // swarm agents
    for (const a of this.agents) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = a.color;
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    if (!this.inWindow) { ctx.globalAlpha = 1; return; }

    // ring
    const ringColor = this.hover ? this.labelColor : '#F3EBDD';
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = this.hover ? 1.6 : 1.1;
    ctx.beginPath();
    ctx.arc(this.ringX, this.ringY, this.ringR, 0, Math.PI * 2);
    ctx.stroke();
    if (this.hover) {
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(this.ringX, this.ringY, this.ringR + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // core dot
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.hover ? this.labelColor : '#D7FF45';
    ctx.beginPath();
    ctx.arc(this.dotX, this.dotY, this.down ? 2 : 3, 0, Math.PI * 2);
    ctx.fill();

    // label pill
    if (this.label && this.hover) {
      const lx = this.ringX + this.ringR * 0.78 + 14;
      const ly = this.ringY - this.ringR * 0.78 - 10;
      ctx.font = '600 9px "Space Grotesk", sans-serif';
      const tw = ctx.measureText(this.label).width;
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = 'rgba(23,23,19,0.9)';
      ctx.strokeStyle = this.labelColor;
      ctx.lineWidth = 1;
      const w = tw + 18, h = 18;
      const r = 4, x0 = lx, y0 = ly - h + 4;
      ctx.beginPath();
      ctx.moveTo(x0 + r, y0);
      ctx.lineTo(x0 + w - r, y0);
      ctx.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
      ctx.lineTo(x0 + w, y0 + h - r);
      ctx.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
      ctx.lineTo(x0 + r, y0 + h);
      ctx.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
      ctx.lineTo(x0, y0 + r);
      ctx.quadraticCurveTo(x0, y0, x0 + r, y0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = this.labelColor;
      ctx.fillText(this.label, lx + 9, ly - 2);
    }
    ctx.globalAlpha = 1;
  }
}
