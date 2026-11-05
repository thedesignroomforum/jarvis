import { handleTts } from "../server/ttsHandler.js";

export function POST(request: Request) {
  return handleTts(request);
}
