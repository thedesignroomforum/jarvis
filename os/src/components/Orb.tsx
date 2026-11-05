"use client";

import { useEffect, useRef } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "warning" | "success";

interface OrbProps {
  size?: number;
  state?: OrbState;
  /** 0..1 audio level, used while speaking/listening */
  level?: number;
  className?: string;
  label?: string;
}

const TINTS: Partial<Record<OrbState, [number, number, number]>> = {
  warning: [233, 180, 76],
  success: [95, 208, 138],
};

/**
 * The JARVIS avatar: a rotating sphere of light points, inspired by a dot-projected face.
 * Pure canvas, no assets. States change rotation, lighting and displacement.
 */
export function Orb({ size = 160, state = "idle", level = 0, className, label }: OrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const levelRef = useRef(level);
  stateRef.current = state;
  levelRef.current = level;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Fibonacci sphere: evenly distributed points.
    const count = Math.round(Math.min(900, Math.max(140, size * 3.2)));
    const pts: { x: number; y: number; z: number; seed: number }[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = golden * i;
      pts.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r, seed: Math.random() * Math.PI * 2 });
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let base: [number, number, number] = [236, 238, 242];
    const readColor = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--orb-dot").trim();
      const parts = v.split(",").map((n) => Number(n.trim()));
      if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) base = parts as [number, number, number];
    };
    readColor();
    const observer = new MutationObserver(readColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    let raf = 0;
    let angle = 0;
    let last = performance.now();
    let smoothLevel = 0;
    const R = size * 0.42;
    const cx = size / 2;
    const cy = size / 2;
    const dotBase = Math.max(0.7, size / 120);

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      const t = now / 1000;
      smoothLevel += (levelRef.current - smoothLevel) * 0.25;

      const speed = s === "thinking" ? 0.9 : s === "speaking" ? 0.35 : s === "listening" ? 0.25 : 0.14;
      if (!reduced) angle += speed * dt;
      const tilt = -0.32;
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
      const breathe = reduced ? 1 : 1 + Math.sin(t * 1.4) * 0.012;
      const tint = TINTS[s];
      const [cr, cg, cb] = tint ?? base;

      ctx.clearRect(0, 0, size, size);

      // Listening: soft outer ring that pulses with the mic level.
      if (s === "listening") {
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.12 + smoothLevel * 0.12 + Math.sin(t * 3) * 0.015), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.18)`;
        ctx.lineWidth = Math.max(1, size / 140);
        ctx.stroke();
      }

      for (const p of pts) {
        // rotate around Y, then tilt around X
        let x = p.x * cosA + p.z * sinA;
        let z = -p.x * sinA + p.z * cosA;
        let y = p.y * cosT - z * sinT;
        z = p.y * sinT + z * cosT;

        let disp = 1;
        if (!reduced) {
          if (s === "speaking") disp += smoothLevel * 0.09 * Math.sin(p.seed + t * 9 + p.y * 4);
          if (s === "listening") disp += 0.02 * Math.sin(t * 4 - (1 - z) * 5);
        }
        x *= disp * breathe;
        y *= disp * breathe;

        if (z < -0.15) continue; // back hemisphere hidden, like a lit face
        // light from upper-left-front
        const light = Math.min(1, Math.max(0, x * -0.3 + y * -0.4 + z * 0.9) * 1.1);
        let alpha = 0.14 + Math.pow(light, 1.25) * 0.95;
        if (s === "thinking" && !reduced) {
          const scan = Math.sin(t * 2.2) * 1.1;
          alpha += Math.max(0, 0.5 - Math.abs(y - scan) * 2.2) * 0.8;
        }
        alpha *= Math.min(1, (z + 0.15) * 2.2);
        if (alpha < 0.03) continue;
        const r = dotBase * (0.55 + light * 0.9) * (z * 0.25 + 0.85);
        ctx.beginPath();
        ctx.arc(cx + x * R, cy + y * R, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(1, alpha)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label ?? `JARVIS is ${state}`}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
