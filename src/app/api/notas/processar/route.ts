import { CertificateModuleError, createCertificateContext } from "../../../../lib/certificate";
import { recoverNfe } from "../../../../lib/nfe/recovery";
import { apiFailure, decodeLimitedBase64, protectSensitivePost, readSensitiveJson, RequestInputError } from "../../../../lib/security/requests";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: Request): Promise<Response> {
  return protectSensitivePost(request, async () => {
    const payload = await readSensitiveJson(request, 17 * 1024 * 1024);
    if (payload.contractVersion !== "1" || typeof payload.password !== "string" || !payload.password || payload.password.length > 256) throw new RequestInputError(400, "INVALID_REQUEST", "Campos obrigatórios ausentes ou inválidos.");
    let xml: Buffer | undefined; let authorized: Buffer | undefined; let pfx: Buffer | undefined;
    let context: Awaited<ReturnType<typeof createCertificateContext>> | undefined;
    try {
      xml = decodeLimitedBase64(payload.xmlBase64, 5 * 1024 * 1024, "XML original");
      if (payload.authorizedXmlBase64 !== undefined) authorized = decodeLimitedBase64(payload.authorizedXmlBase64, 5 * 1024 * 1024, "XML autorizado");
      pfx = decodeLimitedBase64(payload.certificatePfxBase64, 2 * 1024 * 1024, "Certificado");
      let xmlText: string; let authorizedText: string | undefined;
      try {
        const decoder = new TextDecoder("utf-8", { fatal: true }); xmlText = decoder.decode(xml); authorizedText = authorized ? decoder.decode(authorized) : undefined;
      } catch { return apiFailure(422, "INVALID_XML", "Os XMLs precisam ser UTF-8 válidos."); }
      context = await createCertificateContext(pfx, payload.password);
      const result = await recoverNfe({ xml: xmlText, authorizedXml: authorizedText, certificateContext: context });
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof RequestInputError) throw error;
      if (error instanceof CertificateModuleError) {
        if (["CERTIFICATE_PROCESSING_LIMIT", "CERTIFICATE_TRUST_CONFIGURATION"].includes(error.code)) return apiFailure(503, "INTERNAL_ERROR", "O módulo de certificados está temporariamente indisponível.", true);
        return apiFailure(422, "CERTIFICATE_INVALID", "O certificado é inválido ou não pôde ser preparado para processamento.");
      }
      if (error && typeof error === "object" && "code" in error && ["INVALID_XML", "UNSUPPORTED_XML", "INVALID_ACCESS_KEY"].includes(String(error.code))) return apiFailure(422, "INVALID_XML", "O arquivo não contém NF-e/NFC-e válida para análise.");
      return apiFailure(500, "INTERNAL_ERROR", "O processamento foi interrompido sem liberar um XML.");
    } finally {
      context?.dispose(); xml?.fill(0); authorized?.fill(0); pfx?.fill(0);
      payload.password = undefined; payload.certificatePfxBase64 = undefined; payload.xmlBase64 = undefined; payload.authorizedXmlBase64 = undefined;
    }
  });
}
