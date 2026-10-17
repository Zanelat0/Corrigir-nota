import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { ApiErrorCode, ApiErrorResponse } from "../../types/contracts";

export class RequestInputError extends Error {
  constructor(readonly status: number, readonly code: ApiErrorCode, message: string) { super(message); }
}
export function apiFailure(status: number, code: ApiErrorCode, message: string, retryable = false, retryAfter?: number): Response {
  const body: ApiErrorResponse = { error: { contractVersion: "1", code, message, retryable, requestId: randomUUID() } };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) } });
}
export function createAdmissionController(options = { maxConcurrent: 2, perClient: 10, global: 60, windowMs: 60_000, maxClients: 2048 }) {
  let active = 0; let globalCount = 0; let globalReset = 0;
  const clients = new Map<string, { count: number; reset: number }>();
  return (key: string, now = Date.now()) => {
    if (now >= globalReset) { globalCount = 0; globalReset = now + options.windowMs; }
    for (const [id, entry] of clients) if (entry.reset <= now) clients.delete(id);
    const entry = clients.get(key) ?? { count: 0, reset: now + options.windowMs };
    const retryAfter = Math.max(1, Math.ceil((entry.reset - now) / 1000));
    if (active >= options.maxConcurrent || globalCount >= options.global || entry.count >= options.perClient || (!clients.has(key) && clients.size >= options.maxClients)) return { admitted: false, release() {}, retryAfter };
    entry.count++; clients.set(key, entry); globalCount++; active++;
    let released = false;
    return { admitted: true, retryAfter: 0, release() { if (!released) { active--; released = true; } } };
  };
}
const processState = globalThis as typeof globalThis & { corrigirNotaAdmission?: ReturnType<typeof createAdmissionController>; corrigirNotaSalt?: string };
const acquire = processState.corrigirNotaAdmission ??= createAdmissionController();
const salt = processState.corrigirNotaSalt ??= randomUUID();
function clientKey(request: Request) {
  const address = process.env.TRUST_PROXY === "true" ? request.headers.get("x-real-ip")?.trim() : undefined;
  return createHash("sha256").update(`${salt}:${address && isIP(address) ? address : "shared"}`).digest("hex");
}
export async function protectSensitivePost(request: Request, handler: () => Promise<Response>): Promise<Response> {
  const forwarded = request.headers.get("x-forwarded-proto");
  const https = process.env.TRUST_PROXY === "true" ? forwarded === "https" : !forwarded && new URL(request.url).protocol === "https:";
  if (process.env.NODE_ENV === "production" && !https) return apiFailure(400, "INVALID_REQUEST", "Esta operação exige HTTPS.");
  const lease = acquire(clientKey(request));
  if (!lease.admitted) return apiFailure(429, "RATE_LIMITED", "Limite temporário de requisições ou processamento simultâneo.", true, lease.retryAfter);
  try { return await handler(); } catch (error) {
    if (error instanceof RequestInputError) return apiFailure(error.status, error.code, error.message);
    return apiFailure(500, "INTERNAL_ERROR", "Não foi possível concluir esta operação.");
  } finally { lease.release(); }
}
export async function readSensitiveJson(request: Request, limit: number): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new RequestInputError(415, "UNSUPPORTED_MEDIA_TYPE", "Envie o conteúdo como application/json.");
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new RequestInputError(413, "PAYLOAD_TOO_LARGE", "O corpo da requisição excede o limite.");
  if (!request.body) throw new RequestInputError(400, "INVALID_REQUEST", "Corpo obrigatório.");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new RequestInputError(408, "INVALID_REQUEST", "Tempo limite de envio excedido.")); void reader.cancel().catch(() => {}); }, 5000); });
  let bytes: Buffer | undefined;
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      length += value.byteLength;
      if (length > limit) { value.fill(0); await reader.cancel(); throw new RequestInputError(413, "PAYLOAD_TOO_LARGE", "O corpo da requisição excede o limite."); }
      chunks.push(value);
      if (chunks.length > 4096) { await reader.cancel(); throw new RequestInputError(413, "PAYLOAD_TOO_LARGE", "Fragmentação excessiva do corpo enviado."); }
    }
    bytes = Buffer.concat(chunks, length);
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid envelope");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RequestInputError) throw error;
    throw new RequestInputError(400, "INVALID_REQUEST", "O corpo deve conter um objeto JSON UTF-8 válido.");
  } finally { clearTimeout(timer); bytes?.fill(0); for (const chunk of chunks) chunk.fill(0); try { reader.releaseLock(); } catch { /* aborted stream */ } }
}
export function decodeLimitedBase64(value: unknown, maxBytes: number, label: string): Buffer {
  if (typeof value !== "string" || !value || value.length % 4) throw new RequestInputError(400, "INVALID_REQUEST", `${label} deve estar em base64 válido.`);
  if (value.length > Math.ceil(maxBytes / 3) * 4) throw new RequestInputError(413, "PAYLOAD_TOO_LARGE", `${label} excede o limite permitido.`);
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  if (/[^A-Za-z0-9+/]/.test(value.slice(0, value.length - padding))) throw new RequestInputError(400, "INVALID_REQUEST", `${label} deve estar em base64 válido.`);
  const size = value.length / 4 * 3 - padding;
  if (size > maxBytes) throw new RequestInputError(413, "PAYLOAD_TOO_LARGE", `${label} excede o limite permitido.`);
  const buffer = Buffer.from(value, "base64");
  if (buffer.toString("base64") !== value) { buffer.fill(0); throw new RequestInputError(400, "INVALID_REQUEST", `${label} deve estar em base64 canônico.`); }
  return buffer;
}
