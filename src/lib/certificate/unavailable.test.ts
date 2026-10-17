import { expect, it, vi } from "vitest";
vi.mock("./index", async (original) => {
  const actual = await original<typeof import("./index")>();
  return { ...actual, validateCertificate: async () => { throw new actual.CertificateModuleError("CERTIFICATE_PROCESSING_LIMIT"); } };
});
import { POST } from "../../app/api/certificado/validar/route";
it("reports an unavailable certificate child as technical failure, not invalid certificate", async () => {
  const response = await POST(new Request("https://local.test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contractVersion: "1", certificatePfxBase64: "AQ==", password: "synthetic-only" }) }));
  expect(response.status).toBe(503);
  expect((await response.json()).error).toMatchObject({ code: "INTERNAL_ERROR", retryable: true });
});
