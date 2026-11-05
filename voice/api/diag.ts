import { handleDiag } from "../server/diagHandler.js";

export function GET(request: Request) {
  return handleDiag(request);
}
