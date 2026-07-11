"use client";

import { useEffect, useRef } from "react";

type RGB = { r: number; g: number; b: number };

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

/** Éclaircit une couleur (mélange vers le blanc) pour le trait "sheen" du grain de bois. */
function lighten(c: RGB, amount: number): RGB {
  return {
    r: c.r + (255 - c.r) * amount,
    g: c.g + (255 - c.g) * amount,
    b: c.b + (255 - c.b) * amount,
  };
}

/** Lit les couleurs du thème (variables CSS) plutôt que des hex en dur, pour rester clair/sombre-safe. */
function readThemeStrokes(): RGB[] {
  const styles = getComputedStyle(document.documentElement);
  const tokens = ["--primary", "--brand-accent", "--foreground", "--muted-foreground"];
  return tokens.map((token) => {
    const value = styles.getPropertyValue(token).trim();
    return value.startsWith("#") ? hexToRgb(value) : { r: 138, g: 75, b: 46 };
  });
}

type Particle = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
};

/**
 * Fond animé "fils qui se connectent" : particules reliées par des traits qui
 * s'écartent au passage du curseur. Couleurs lues depuis les tokens du thème
 * (--primary/--brand-accent/--foreground/--muted-foreground), donc cohérent
 * en clair comme en sombre. Se fige sur une image statique si l'utilisateur
 * préfère les animations réduites.
 */
export function ParticleThreads({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const strokes = readThemeStrokes();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let animationFrameId = 0;
    const mouse = { x: null as number | null, y: null as number | null, radius: 220 };

    function resize() {
      const canvasEl = canvasRef.current;
      if (!canvasEl || !ctx) return;
      width = canvasEl.clientWidth;
      height = canvasEl.clientHeight;
      canvasEl.width = width * dpr;
      canvasEl.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(40, Math.floor((width * height) / 14000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        dx: Math.random() * 0.4 - 0.2,
        dy: Math.random() * 0.4 - 0.2,
        size: Math.random() * 1.6 + 1.2,
      }));
    }

    function step(p: Particle) {
      if (p.x > width || p.x < 0) p.dx = -p.dx;
      if (p.y > height || p.y < 0) p.dy = -p.dy;

      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius && dist > 0) {
          const force = (mouse.radius - dist) / mouse.radius;
          p.x -= (dx / dist) * force * 6;
          p.y -= (dy / dist) * force * 6;
        }
      }
      p.x += p.dx;
      p.y += p.dy;
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        const deep = strokes[2];
        ctx.fillStyle = `rgba(${deep.r},${deep.g},${deep.b},0.9)`;
        ctx.fill();
      }

      const maxDist = Math.min(width, height) / 6 + 60;
      for (let a = 0; a < particles.length; a++) {
        for (let b = a + 1; b < particles.length; b++) {
          const pa = particles[a];
          const pb = particles[b];
          const dx = pa.x - pb.x;
          const dy = pa.y - pb.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= maxDist) continue;

          const t = 1 - dist / maxDist;
          const opacity = Math.min(1, t * 0.9);
          let nearMouse = false;
          if (mouse.x !== null && mouse.y !== null) {
            const mdx = pa.x - mouse.x;
            const mdy = pa.y - mouse.y;
            nearMouse = Math.sqrt(mdx * mdx + mdy * mdy) < mouse.radius;
          }
          const stroke = nearMouse ? strokes[1] : strokes[a % strokes.length];
          const lineWidth = 1.5 + t * 2.4;

          ctx.strokeStyle = `rgba(${stroke.r},${stroke.g},${stroke.b},${opacity})`;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();

          // Reflet plus clair ("veine de bois") sur les connexions les plus proches.
          if (t > 0.55) {
            const sheen = lighten(strokes[1], 0.25);
            ctx.strokeStyle = `rgba(${sheen.r},${sheen.g},${sheen.b},${opacity * 0.5})`;
            ctx.lineWidth = Math.max(0.6, lineWidth * 0.35);
            ctx.beginPath();
            ctx.moveTo(pa.x + 0.4, pa.y + 0.4);
            ctx.lineTo(pb.x + 0.4, pb.y + 0.4);
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      for (const p of particles) step(p);
      draw();
      animationFrameId = requestAnimationFrame(animate);
    }

    function handlePointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }
    function handlePointerLeave() {
      mouse.x = null;
      mouse.y = null;
    }

    resize();
    window.addEventListener("resize", resize);

    if (reducedMotion) {
      draw();
    } else {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerleave", handlePointerLeave);
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={`block size-full ${className ?? ""}`} />;
}
