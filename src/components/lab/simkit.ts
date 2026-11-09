import { useEffect, useRef, type RefObject } from 'react';

/**
 * rAF loop for lab simulations: DPR-aware, auto-pauses off-screen,
 * renders a single static frame when the user prefers reduced motion.
 */
export function useSimLoop(
  ref: RefObject<HTMLCanvasElement | null>,
  draw: (ctx: CanvasRenderingContext2D, dt: number, t: number) => void
) {
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let visible = true;
    let io: IntersectionObserver | null = null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduced) drawRef.current(ctx, 0, 1.5);
    };
    resize();
    window.addEventListener('resize', resize);

    if (!reduced) {
      io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) last = performance.now();
      });
      io.observe(canvas);
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (!visible) return;
        t += dt;
        drawRef.current(ctx, dt, t);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      io?.disconnect();
    };
  }, [ref]);
}

export function sizeOf(canvas: HTMLCanvasElement) {
  return { w: canvas.clientWidth, h: canvas.clientHeight };
}
