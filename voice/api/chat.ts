import { handleChat } from "../server/chatHandler.js";

export function POST(request: Request) {
  return handleChat(request);
}
