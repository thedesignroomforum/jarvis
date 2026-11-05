"use client";

import type { Attachment } from "@/lib/jarvis/types";

const MAX_PDF_BYTES = 4 * 1024 * 1024; // keeps requests under Vercel's 4.5 MB body limit
const MAX_TEXT_CHARS = 400_000;
const MAX_IMAGE_EDGE = 1800;

function readAsDataURL(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function imageToJpeg(source: CanvasImageSource, w: number, h: number, quality = 0.88) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return dataUrl.split(",")[1];
}

/** Turn a picked/dropped/pasted file into an attachment JARVIS can read. */
export async function fileToAttachment(file: File): Promise<Attachment> {
  const name = file.name || "pasted-image";
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    const data = await imageToJpeg(bitmap, bitmap.width, bitmap.height);
    bitmap.close();
    return { kind: "image", name, mediaType: "image/jpeg", data };
  }
  if (file.type === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(`${name} is over 4 MB. Large books will be supported by the Knowledge Library (Phase 3); for now, split the PDF.`);
    }
    const dataUrl = await readAsDataURL(file);
    return { kind: "pdf", name, mediaType: "application/pdf", data: dataUrl.split(",")[1] };
  }
  if (name.toLowerCase().endsWith(".docx")) {
    throw new Error("DOCX isn't supported yet (Phase 3). Export it as PDF and attach that.");
  }
  if (file.type.startsWith("text/") || /\.(md|txt|markdown|csv)$/i.test(name)) {
    const text = await file.text();
    if (text.length > MAX_TEXT_CHARS) throw new Error(`${name} is too long for a single message.`);
    return { kind: "text", name, mediaType: "text/plain", data: text };
  }
  throw new Error(`${name}: unsupported file type. Use an image, PDF, TXT or Markdown file.`);
}

/**
 * Screen sharing, Phase 1 style: the user explicitly picks a screen/window/tab, we grab ONE
 * still frame, and stop sharing immediately. Nothing is recorded or kept running.
 */
export async function captureScreenFrame(): Promise<Attachment | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture isn't supported in this browser.");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch {
    return null; // user cancelled the picker
  }
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 250)); // let the first real frame arrive
    const data = await imageToJpeg(video, video.videoWidth, video.videoHeight, 0.9);
    return { kind: "image", name: `screen-${new Date().toLocaleTimeString()}.jpg`, mediaType: "image/jpeg", data };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}
