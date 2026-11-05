/**
 * The avatar is the supplied image itself, drawn as a WebGL texture. The shader never
 * redraws the face: it only moves, brightens and very slightly displaces the existing
 * pixels, so the identity of the reference image is preserved exactly.
 */
export const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uImage;
uniform vec2  uRes;        // canvas size in px
uniform vec2  uImg;        // image size in px
uniform float uFit;        // image height as a fraction of the canvas height
uniform float uTime;
uniform float uBright;     // overall exposure: dormant ~0.2, awake ~1
uniform float uMotion;     // breathing / dot-field drift amount
uniform float uLevel;      // audio level 0..1 (mic or voice)
uniform float uThink;      // processing distortion 0..1
uniform float uGlitch;     // wake-up glitch 0..1
uniform float uZoom;       // forward movement (0 = rest)
uniform float uField;      // energy field around the face 0..1
uniform vec2  uParallax;   // px offset from pointer / slow drift
uniform float uLight;      // 0 = white dots on black, 1 = dark dots on white
uniform float uMouth;      // jaw opening 0..1, driven by the voice while speaking

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float sampleLum(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  vec3 c = texture2D(uImage, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // The photo's "black" sits at ~0.03; pull it to true black so the image edge never shows.
  l = max(l - 0.045, 0.0) / 0.955;
  // Feather the image borders into the black background.
  vec2 e = smoothstep(vec2(0.0), vec2(0.05), uv) * smoothstep(vec2(0.0), vec2(0.05), 1.0 - uv);
  return l * e.x * e.y;
}

void main() {
  vec2 frag = vec2(vUv.x, 1.0 - vUv.y) * uRes;          // top-left origin, px
  float scale = (uRes.y * uFit) / uImg.y;
  scale = min(scale, (uRes.x * 0.98) / uImg.x);            // never crop the face horizontally
  vec2 size = uImg * scale;
  vec2 center = vec2(uRes.x * 0.5, uRes.y * 0.5 + uRes.y * (1.0 - uFit) * 0.15) + uParallax;

  // Breathing + voice-driven scale + forward movement on wake.
  float breath = 1.0 + sin(uTime * 0.55) * 0.0045 * uMotion;
  float s = breath + uLevel * 0.015 + uZoom;
  // Scale around the face (upper part of the image), not the shoulders.
  vec2 pivot = center + vec2(0.0, -size.y * 0.12);
  vec2 p = (frag - pivot) / s + pivot;
  vec2 uv = (p - (center - size * 0.5)) / size;

  // Mouth: the existing dots below the lip line slide down (jaw opens), the upper lip lifts a
  // touch, and the gap between them stays dark, so the lips part with each syllable.
  vec2 MC = vec2(0.552, 0.657);                         // where the lips meet, in image UV
  float side = 1.0 - smoothstep(0.07, 0.19, abs(uv.x - MC.x));
  float open = uMouth * 0.026;
  float mouthDark = 0.0;
  if (uv.y > MC.y) {
    float below = 1.0 - smoothstep(0.09, 0.20, uv.y - MC.y);
    float src = uv.y - open * side * below;
    if (src < MC.y) mouthDark = 1.0; else uv.y = src;
  } else {
    float above = 1.0 - smoothstep(0.0, 0.035, MC.y - uv.y);
    uv.y += open * 0.3 * side * above;
  }

  // Dot-field drift: a very low-amplitude flow so individual dots shimmer and shift.
  float t = uTime;
  vec2 flow = vec2(noise(uv * 7.0 + vec2(t * 0.11, 0.0)), noise(uv * 7.0 + vec2(13.7, -t * 0.09))) - 0.5;
  uv += flow * (0.0011 * uMotion + 0.0035 * uLevel + 0.0012 * uThink);

  // Thinking: a slow horizontal distortion travelling down the face.
  uv.x += sin(uv.y * 34.0 - t * 1.7) * 0.0016 * uThink;

  // Wake glitch: a few horizontal slices briefly offset, then gone.
  float tick = floor(t * 22.0);
  float band = floor(uv.y * 64.0);
  float g = hash(vec2(band, tick));
  float slice = step(1.0 - 0.22 * uGlitch, g) * (hash(vec2(band + 9.1, tick)) - 0.5) * 0.05 * uGlitch;
  uv.x += slice;

  float lum = sampleLum(uv) * (1.0 - mouthDark);
  // A faint monochrome "ghost" during the glitch (offset copy), keeps it cinematic, not colourful.
  lum = max(lum, sampleLum(uv + vec2(0.006 * uGlitch, 0.0)) * 0.35 * uGlitch);

  // Exposure: when dormant only the brightest dots survive, so the face emerges from darkness.
  float gamma = mix(2.2, 1.0, clamp(uBright, 0.0, 1.0));
  lum = pow(lum, gamma) * (0.25 + 0.95 * uBright);

  // Processing scan: a soft band of light sweeping across the dots.
  float scanY = fract(t * 0.11) * 1.4 - 0.2;
  lum *= 1.0 + exp(-pow((uv.y - scanY) * 9.0, 2.0)) * 0.55 * uThink;

  // Voice / mic: the lit dots respond to amplitude (no mouth animation, the whole field breathes).
  lum *= 1.0 + uLevel * 0.45;

  // Energy field: sparse particles in a soft ellipse around the head while listening/speaking.
  vec2 fc = (frag - (center + vec2(0.0, -size.y * 0.16))) / vec2(size.x * 0.62, size.y * 0.44);
  float r = length(fc);
  float ring = exp(-pow((r - (1.0 + uLevel * 0.06 + sin(t * 1.3) * 0.01)) * 7.0, 2.0));
  vec2 cell = floor(frag / 5.0);
  float star = step(0.965, hash(cell + floor(t * 0.7)));
  vec2 inCell = fract(frag / 5.0) - 0.5;
  float dotMask = smoothstep(0.32, 0.1, length(inCell));
  float particles = ring * star * dotMask * uField * (0.25 + uLevel * 0.9);
  float halo = exp(-pow((r - 1.0) * 3.0, 2.0)) * 0.03 * uField * (0.4 + uLevel);

  // Vignette keeps the edges black.
  vec2 vq = vUv - 0.5;
  vq.x *= uRes.x / uRes.y;
  float vig = smoothstep(1.05, 0.25, length(vq));

  // Hairline grain so the black never looks flat (very low).
  float grain = (hash(frag + t) - 0.5) * 0.012 * uBright;

  float outL = lum * mix(0.55, 1.0, vig) + particles + halo + grain;
  float L = clamp(outL, 0.0, 1.0);
  // Light mode inverts the exposure: the same dots, ink on paper.
  // Boost the dots strongly (and lift the faint ones) so the head reads clearly on white.
  float Lk = clamp((lum * mix(0.8, 1.0, vig) + particles + halo) * 2.2, 0.0, 1.0);
  float ink = 1.0 - pow(Lk, 0.6) * 0.97;
  gl_FragColor = vec4(vec3(mix(L, ink, uLight)), 1.0);
}`;
