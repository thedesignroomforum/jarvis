import { handleConfig } from "../server/ttsHandler.js";

export function GET() {
  return handleConfig();
}
