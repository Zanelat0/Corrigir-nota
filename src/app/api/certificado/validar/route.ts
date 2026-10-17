import { CertificateModuleError, MAX_CERTIFICATE_BYTES, MAX_CERTIFICATE_PASSWORD_LENGTH, validateCertificate } from "../../../../lib/certificate";
import { apiFailure, decodeLimitedBase64, protectSensitivePost, readSensitiveJson, RequestInputError } from "../../../../lib/security/requests";

export const runtime = "nodejs";
export const maxDuration = 15;
export async function POST(request: Request): Promise<Response> {
  return protectSensitivePost(request, async () => {
    const payload = await readSensitiveJson(request, 3 * 1024 * 1024);
    if (payload.contractVersion !== "1" || typeof payload.password !== "string" || !payload.password || payload.password.length > MAX_CERTIFICATE_PASSWORD_LENGTH) throw new RequestInputError(400, "INVALID_REQUEST", "Campos obrigatórios ausentes ou inválidos.");
    let pfx: Buffer | undefined;
    try {
      pfx = decodeLimitedBase64(payload.certificatePfxBase64, MAX_CERTIFICATE_BYTES, "Certificado");
      const result = await validateCertificate(pfx, payload.password);
      if (!result.valid) return apiFailure(422, "CERTIFICATE_INVALID", "Não foi possível carregar o certificado ou validar sua validade, uso e cadeia configurada.");
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof CertificateModuleError && ["CERTIFICATE_PROCESSING_LIMIT", "CERTIFICATE_TRUST_CONFIGURATION"].includes(error.code)) return apiFailure(503, "INTERNAL_ERROR", "O módulo de certificados está temporariamente indisponível.", true);
      throw error;
    } finally { pfx?.fill(0); payload.password = undefined; payload.certificatePfxBase64 = undefined; }
  });
}
