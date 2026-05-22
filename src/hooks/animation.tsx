import { useEffect, useRef, MutableRefObject } from "react";
import gsap from "gsap";

interface MouseState {
  x: number;
  y: number;
  radius: number;
}

interface SizeState {
  width: number;
  height: number;
  dpr: number;
}

class Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  density: number;
  offset: number;
  active: boolean;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.baseY = y;
    // increase base particle size ~10x
    this.size = Math.random() * 24 + 12;
    // increase density variance so particles react more strongly and disperse
    this.density = Math.random() * 12 + 8;
    this.offset = Math.random() * Math.PI * 2;
    this.active = false;
  }

  update(mouse: MouseState) {
    const dx = mouse.x - this.x;
    const dy = mouse.y - this.y;
    const dist = Math.hypot(dx, dy) || 0.0001;

    if (dist < mouse.radius) {
      const force = (mouse.radius - dist) / mouse.radius;
      this.x -= (dx / dist) * force * this.density;
      this.y -= (dy / dist) * force * this.density;
      this.active = true;
    } else {
      // much faster return to base so particles settle and disappear quicker
      this.x += (this.baseX - this.x) * 0.18;
      this.y += (this.baseY - this.y) * 0.18;
      // reduced jitter so particles don't linger due to noise
      this.x += (Math.random() - 0.5) * 0.12;
      this.y += (Math.random() - 0.5) * 0.12;
      // increase threshold so particles are considered inactive sooner (disappear faster)
      this.active =
        Math.abs(this.baseX - this.x) > 8 ||
        Math.abs(this.baseY - this.y) > 8;
    }
  }

  // draw now accepts pre-rendered texture and a multiplier for alpha/pulse
  draw(
    ctx: CanvasRenderingContext2D,
    time: number,
    texture: HTMLCanvasElement | undefined,
    dpr: number,
    pulseMultiplier = 1
  ) {
    if (!this.active || !texture) return;

    const pulse = Math.sin(time + this.offset) * 0.15;
    const alpha = Math.max(0.12, 0.45 + pulse);

    ctx.save();
    // lighter blending gives additive glow-like effect
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha * pulseMultiplier;

    const w = texture.width / dpr;
    const h = texture.height / dpr;

    ctx.drawImage(texture, this.x - w / 2, this.y - h / 2, w, h);

    ctx.restore();
  }
}

export const useAntigravity = (): MutableRefObject<HTMLCanvasElement | null> => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  // increase mouse influence radius so interaction disperses particles more broadly
  const mouseRef = useRef<MouseState>({ x: -1000, y: -1000, radius: 320 });
  const sizeRef = useRef<SizeState>({ width: 0, height: 0, dpr: 1 });
  const runningRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const texturesRef = useRef<Map<number, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let supportsFilter = false;
    // detect once
    try {
      supportsFilter = typeof (ctx as any).filter !== "undefined";
    } catch (e) {
      supportsFilter = false;
    }

    const createTexture = (radius: number, dpr: number) => {
      // texture diameter in CSS pixels
      const diameter = Math.max(2, Math.round(radius * 3));
      const tex = document.createElement("canvas");
      tex.width = Math.round(diameter * dpr);
      tex.height = Math.round(diameter * dpr);
      const tctx = tex.getContext("2d");
      if (!tctx) return tex;

      // scale for device pixels
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (supportsFilter) {
        (tctx as any).filter = "blur(6px)";
      }

      const grad = tctx.createRadialGradient(
        diameter / 2,
        diameter / 2,
        0,
        diameter / 2,
        diameter / 2,
        radius * 2.5
      );
      grad.addColorStop(0, "rgba(255,215,0,1)");
      grad.addColorStop(0.6, "rgba(255,215,0,0.45)");
      grad.addColorStop(1, "rgba(255,215,0,0)");

      tctx.beginPath();
      tctx.arc(diameter / 2, diameter / 2, radius * 1.1, 0, Math.PI * 2);
      tctx.fillStyle = grad;
      tctx.shadowBlur = 28;
      tctx.shadowColor = "rgba(255,215,0,0.4)";
      tctx.fill();

      if (supportsFilter) {
        try {
          (tctx as any).filter = "none";
        } catch (e) {
          // noop
        }
      }

      return tex;
    };

    const buildTextures = (dpr: number) => {
      texturesRef.current.clear();
      for (const p of particlesRef.current) {
        const key = Math.round(p.size);
        if (!texturesRef.current.has(key)) {
          const tex = createTexture(p.size, dpr);
          if (tex) texturesRef.current.set(key, tex);
        }
      }
    };

    let resizeScheduled = false;
    const resize = () => {
      if (resizeScheduled) return;
      resizeScheduled = true;
      requestAnimationFrame(() => {
        resizeScheduled = false;

        const width = window.innerWidth;
        const height = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        sizeRef.current = { width, height, dpr };

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const particles: Particle[] = [];
        // increase spacing to reduce total particle count (fewer, larger particles)
        const spacing = 130;

        for (let y = spacing / 2; y < height; y += spacing) {
          for (let x = spacing / 2; x < width; x += spacing) {
            particles.push(new Particle(x, y));
          }
        }

        particlesRef.current = particles;
        buildTextures(dpr);
      });
    };

    // pointer event handler will cover mouse + touch
    const onPointerMove = (e: PointerEvent) => {
      // use gsap to smooth pointer into mouseRef
      gsap.to(mouseRef.current, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.25,
        ease: "power2.out",
      });
    };

    // visibility handling to pause work
    const onVisibilityChange = () => {
      runningRef.current = document.visibilityState === "visible";
      if (!runningRef.current && rafRef.current) {
        if (typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else {
        // resume
        if (!rafRef.current) loop();
      }
    };

    // main loop using RAF for predictable scheduling
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      if (!runningRef.current) return;

      const { width, height, dpr } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);

      const time = performance.now() * 0.001;

      // small optimizations: alias locals
      const particles = particlesRef.current;
      const texMap = texturesRef.current;

      // set static ctx properties once per frame
      ctx.shadowColor = "rgba(255,215,0,0.4)";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.update(mouseRef.current);
        const key = Math.round(p.size);
        const tex = texMap.get(key);
        p.draw(ctx, time, tex, dpr);
      }
    };

    resize();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    // start loop
    if (!rafRef.current) loop();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (rafRef.current && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      gsap.killTweensOf(mouseRef.current);
      texturesRef.current.clear();
    };
  }, []);

  return canvasRef;
};