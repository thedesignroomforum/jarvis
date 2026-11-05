/**
 * Microphone access + live input level. The mic is only opened after the user grants
 * permission through the browser prompt, and is fully released by release().
 */
import { analyzeAudio, createAnalyser, getAudioContext, resumeAudio } from "./audioAnalyzer";

export type MicPermission = "unknown" | "granted" | "denied" | "unsupported";

export async function queryMicPermission(): Promise<MicPermission> {
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state === "granted" ? "granted" : status.state === "denied" ? "denied" : "unknown";
  } catch {
    return "unknown"; // Safari/Firefox may not support querying
  }
}

export class MicService {
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;

  async open(): Promise<MicPermission> {
    if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
    if (this.stream) return "granted";
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      await resumeAudio();
      this.source = getAudioContext().createMediaStreamSource(this.stream);
      this.analyser = createAnalyser(this.source);
      return "granted";
    } catch (e) {
      const name = (e as DOMException).name;
      return name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unsupported";
    }
  }

  level(): number {
    return this.analyser ? analyzeAudio(this.analyser) : 0;
  }

  get isOpen() {
    return !!this.stream;
  }

  release() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.source?.disconnect();
    this.stream = null;
    this.analyser = null;
    this.source = null;
  }
}
