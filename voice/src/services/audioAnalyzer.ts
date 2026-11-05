/**
 * Web Audio helpers. One shared AudioContext for the whole app.
 */
let ctx: AudioContext | null = null;

export function getAudioContext() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export async function resumeAudio() {
  const c = getAudioContext();
  if (c.state === "suspended") await c.resume();
  return c;
}

export function createAnalyser(source: AudioNode) {
  const analyser = getAudioContext().createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);
  return analyser;
}

const buffers = new WeakMap<AnalyserNode, Float32Array<ArrayBuffer>>();

/**
 * Returns a perceptual loudness 0..1 from an AnalyserNode (RMS of the waveform,
 * gently compressed so normal speech sits around 0.3–0.6 and emphasis peaks higher).
 */
export function analyzeAudio(analyser: AnalyserNode): number {
  let buf = buffers.get(analyser);
  if (!buf) {
    buf = new Float32Array(analyser.fftSize);
    buffers.set(analyser, buf);
  }
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  const rms = Math.sqrt(sum / buf.length);
  return Math.min(1, Math.pow(rms * 6, 0.7));
}
