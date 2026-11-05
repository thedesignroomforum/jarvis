import { useEffect, useRef, useState } from "react";
import { audioLevel, gesture, getAssistantState, timeInState, type AssistantState } from "../../state/assistantState";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./avatarShader";
import "./Avatar.css";

const IMAGE_SRC = "/jarvis-face.png";

interface Params {
  bright: number;
  motion: number;
  think: number;
  glitch: number;
  zoom: number;
  field: number;
}

/** Visual targets for each state. The loop eases toward these every frame. */
function targetsFor(state: AssistantState, offline: boolean, t: number): Params {
  switch (state) {
    case "sleeping":
      return { bright: offline ? 0.13 : 0.22, motion: 0.35, think: 0, glitch: 0, zoom: 0, field: 0 };
    case "ready":
      return { bright: 0.62, motion: 0.7, think: 0, glitch: 0, zoom: 0.004, field: 0 };
    case "waking": {
      // 0–1.2 s: brighten, lean forward, a brief controlled glitch, then settle.
      const k = Math.min(1, t / 1200);
      const glitch = t < 120 ? t / 120 : Math.max(0, 1 - (t - 120) / 520);
      const zoom = 0.03 * Math.sin(Math.min(1, t / 900) * Math.PI * 0.5) - 0.014 * Math.max(0, (t - 900) / 300);
      return { bright: 0.4 + 0.65 * k, motion: 1, think: 0, glitch: glitch * 0.9, zoom: Math.max(0.012, zoom), field: 0.3 * k };
    }
    case "listening":
      return { bright: 0.95, motion: 1, think: 0, glitch: 0, zoom: 0.012, field: 0.65 };
    case "thinking":
      return { bright: 0.85, motion: 0.8, think: 1, glitch: 0, zoom: 0.01, field: 0.25 };
    case "speaking":
      return { bright: 1, motion: 0.9, think: 0, glitch: 0, zoom: 0.012, field: 0.5 };
  }
}

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || "shader error");
  return sh;
}

export interface AvatarProps {
  /** True before the microphone is enabled: the face is at its darkest. */
  offline: boolean;
  /** Light theme: the same dots, drawn dark on a white background. */
  light?: boolean;
}

/**
 * JARVIS's face. The supplied reference image is the base layer, animated by a WebGL
 * shader (60 fps, no React re-renders). Falls back to a CSS-animated <img> without WebGL.
 */
export function Avatar({ offline, light = false }: AvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offlineRef = useRef(offline);
  offlineRef.current = offline;
  const lightRef = useRef(light);
  lightRef.current = light;
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, powerPreference: "high-performance" });
    if (!gl) {
      setFallback(true);
      return;
    }

    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link error");
    } catch (e) {
      console.error("[avatar]", e);
      setFallback(true);
      return;
    }
    gl.useProgram(program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const U = {
      res: u("uRes"), img: u("uImg"), fit: u("uFit"), time: u("uTime"), bright: u("uBright"), motion: u("uMotion"),
      level: u("uLevel"), think: u("uThink"), glitch: u("uGlitch"), zoom: u("uZoom"), field: u("uField"), parallax: u("uParallax"), mouth: u("uMouth"), light: u("uLight"), head: u("uHead"),
    };

    const tex = gl.createTexture();
    let imgW = 736, imgH = 1046, ready = false;
    const img = new Image();
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      imgW = img.naturalWidth;
      imgH = img.naturalHeight;
      ready = true;
    };
    img.onerror = () => setFallback(true);
    img.src = IMAGE_SRC;

    // Size the canvas to its box at device resolution (capped for performance).
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // Subtle pointer parallax.
    const pointer = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cur: Params = { bright: 0, motion: 0.3, think: 0, glitch: 0, zoom: 0, field: 0 };
    let level = 0;
    let mouth = 0;
    const head = { x: 0, y: 0, r: 0 };
    let talk = 0; // smoothed "is talking" amount for head movement
    let lightMix = lightRef.current ? 1 : 0;
    const par = { x: 0, y: 0 };
    let last = performance.now();
    let raf = 0;
    let visible = true;
    const onVis = () => (visible = document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || !ready) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const state = getAssistantState();
      const target = targetsFor(state, offlineRef.current, timeInState());

      // Ease toward targets. Going dark is slower than waking up.
      const ease = (k: number) => 1 - Math.exp(-k * dt);
      const brightK = target.bright < cur.bright ? 0.9 : state === "waking" ? 6 : 3;
      cur.bright += (target.bright - cur.bright) * ease(brightK);
      cur.motion += (target.motion - cur.motion) * ease(2);
      cur.think += (target.think - cur.think) * ease(2.5);
      cur.field += (target.field - cur.field) * ease(2);
      cur.zoom += (target.zoom - cur.zoom) * ease(state === "waking" ? 10 : 2);
      cur.glitch = state === "waking" ? target.glitch : cur.glitch * (1 - ease(12));

      // Audio level: fast attack, slower release, so the face "breathes" with the voice.
      const raw = state === "listening" || state === "speaking" ? audioLevel.current : 0;
      level += (raw - level) * ease(raw > level ? 18 : 6);

      // Mouth follows the voice much faster than the glow, so it opens and closes per syllable.
      const speech = state === "speaking" ? Math.min(1, Math.pow(audioLevel.current, 0.8) * 1.15) : 0;
      mouth += (speech - mouth) * ease(speech > mouth ? 30 : 16);

      // Head pose. Base posture per state, plus speech movement and one-shot gestures.
      const tState = timeInState();
      let hx = 0, hy = 0, hr = 0;
      if (state === "sleeping") {
        // Head dropped forward and to one side, rising and falling slowly with sleepy breath.
        hy = 0.016 + Math.sin(t * 0.5) * 0.0025;
        hr = 0.045;
      } else if (state === "waking") {
        // Lifts the head, then a small acknowledging nod (handled by the gesture below).
        hy = -0.004 * Math.min(1, tState / 500);
      } else if (state === "listening") {
        hr = -0.028; // attentive head tilt
        hy = -0.002;
      } else if (state === "thinking") {
        hr = 0.018 + Math.sin(t * 0.8) * 0.006;
        hx = Math.sin(t * 0.6) * 0.003;
        hy = -0.004; // looks up a touch while thinking
      }
      talk += ((state === "speaking" ? 1 : 0) - talk) * ease(3);
      // While talking: emphasis bobs with the voice, and the head drifts and turns gently.
      hy += talk * (level * 0.007 + Math.sin(t * 2.1) * 0.0015);
      hx += talk * (Math.sin(t * 0.73) * 0.006 + Math.sin(t * 1.9) * 0.002);
      hr += talk * (Math.sin(t * 0.61 + 1) * 0.03 + level * 0.008);

      if (gesture.kind) {
        const gt = (now - gesture.at) / 1000;
        if (gesture.kind === "nod" && gt < 0.95) {
          const k = gt / 0.95;
          hy += Math.sin(k * Math.PI * 4) * 0.011 * (1 - k) + Math.sin(k * Math.PI) * 0.004;
        } else if (gesture.kind === "shake" && gt < 1.1) {
          const k = gt / 1.1;
          hx += Math.sin(k * Math.PI * 5) * 0.014 * (1 - k * 0.8);
        } else gesture.kind = null;
      }
      const hk = state === "sleeping" ? 1.2 : 7;
      head.x += (hx - head.x) * ease(hk + (gesture.kind ? 30 : 0));
      head.y += (hy - head.y) * ease(hk + (gesture.kind ? 30 : 0));
      head.r += (hr - head.r) * ease(state === "sleeping" ? 1 : 4);

      const drift = reduced ? 0 : 1;
      par.x += ((pointer.x * 7 + Math.sin(t * 0.07) * 3) * drift - par.x) * ease(1.5);
      par.y += ((pointer.y * 5 + Math.cos(t * 0.05) * 2) * drift - par.y) * ease(1.5);

      const dpr = canvas.width / Math.max(1, canvas.clientWidth);
      const portrait = canvas.height > canvas.width;
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform2f(U.img, imgW, imgH);
      gl.uniform1f(U.fit, portrait ? 1.05 : 1.28);
      gl.uniform1f(U.time, reduced ? 0 : t);
      gl.uniform1f(U.bright, cur.bright);
      gl.uniform1f(U.motion, reduced ? 0 : cur.motion);
      gl.uniform1f(U.level, reduced ? level * 0.3 : level);
      gl.uniform1f(U.think, cur.think);
      gl.uniform1f(U.glitch, reduced ? 0 : cur.glitch);
      gl.uniform1f(U.zoom, cur.zoom);
      gl.uniform1f(U.field, cur.field);
      gl.uniform2f(U.parallax, par.x * dpr, par.y * dpr);
      gl.uniform1f(U.mouth, reduced ? mouth * 0.5 : mouth);
      const hm = reduced ? 0.3 : 1;
      gl.uniform3f(U.head, head.x * hm, head.y * hm, head.r * hm);
      lightMix += ((lightRef.current ? 1 : 0) - lightMix) * ease(6);
      gl.uniform1f(U.light, lightMix);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      img.onload = img.onerror = null;
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(program);
    };
  }, []);

  if (fallback) {
    return (
      <div className="avatar avatar--fallback" data-offline={offline} data-light={light}>
        <img src={IMAGE_SRC} alt="" />
      </div>
    );
  }
  return <canvas ref={canvasRef} className="avatar" role="img" aria-label="JARVIS" />;
}
