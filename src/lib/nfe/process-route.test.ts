import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYNTHETIC_SCHEMA_POLICY } from "./testing/schema-policy";
beforeEach(() => vi.stubEnv("NFE_SCHEMA_POLICY_JSON", SYNTHETIC_SCHEMA_POLICY));
afterEach(() => vi.unstubAllEnvs());
const { consult, disposed } = vi.hoisted(() => ({ consult: vi.fn(), disposed: vi.fn() }));
vi.mock("../sefaz", async (original) => ({ ...await original<typeof import("../sefaz")>(), consultProtocol: consult }));
vi.mock("../certificate", async (original) => {
  const actual = await original<typeof import("../certificate")>();
  return { ...actual, createCertificateContext: async (...args: Parameters<typeof actual.createCertificateContext>) => {
    const context = await actual.createCertificateContext(...args);
    const dispose = context.dispose.bind(context);
    return { ...context, dispose() { disposed(); dispose(); } };
  } };
});
import { POST } from "../../app/api/notas/processar/route";
import { syntheticNfe, syntheticPfx } from "./testing/synthetic";

describe("Manual upload HTTP acceptance (synthetic A1, simulated consultation)", () => {
  it("blocks production before decoding the certificate in homologation-only mode", async () => {
    vi.stubEnv("CORRIGIR_NOTA_HOMOLOGATION_ONLY", "true");
    const productionXml = syntheticNfe().xml.replace("<tpAmb>2</tpAmb>", "<tpAmb>1</tpAmb>");
    const response = await POST(new Request("https://local.test/api/notas/processar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contractVersion: "1", xmlBase64: Buffer.from(productionXml).toString("base64"), certificatePfxBase64: "!!!never-decoded!!!", password: "synthetic-test-password" }) }));
    expect(response.status).toBe(422); expect((await response.json()).error.message).toContain("somente XML de homologação");
    expect(disposed).not.toHaveBeenCalled();
  });

  it("processes the original and corresponding authorized file through the complete API", async () => {
    disposed.mockClear(); consult.mockReset();
    const original = syntheticNfe("9"); const authorized = syntheticNfe("1");
    consult.mockResolvedValueOnce({ ...original.consultation, cStat: "613", protocol: undefined, alternativeAccessKey: authorized.key }).mockResolvedValueOnce(authorized.consultation);
    const response = await POST(new Request("https://local.test/api/notas/processar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contractVersion: "1", xmlBase64: Buffer.from(original.xml).toString("base64"), authorizedXmlBase64: Buffer.from(authorized.xml).toString("base64"), certificatePfxBase64: syntheticPfx().toString("base64"), password: "synthetic-test-password" }) }));
    const body = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("recovered"); expect(body.authorizedXml).toContain(authorized.xml); expect(body.provenance.schemaValidated).toBe(true);
    expect(JSON.stringify(body)).not.toContain("synthetic-test-password"); expect(body.protocol).not.toHaveProperty("originalProtNFeXml");
    expect(disposed).toHaveBeenCalledTimes(1);
  });
  it("disposes the actual temporary context even after an unexpected integration failure", async () => {
    disposed.mockClear(); consult.mockReset(); consult.mockRejectedValueOnce(new Error("SYNTHETIC SECRET MUST NOT LEAK"));
    const response = await POST(new Request("https://local.test/api/notas/processar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contractVersion: "1", xmlBase64: Buffer.from(syntheticNfe().xml).toString("base64"), certificatePfxBase64: syntheticPfx().toString("base64"), password: "synthetic-test-password" }) }));
    expect(disposed).toHaveBeenCalledTimes(1);
    const body = await response.text();
    expect(body).not.toContain("SYNTHETIC SECRET"); expect(body).not.toContain("authorizedXml");
  });
  it("handles malformed envelopes with the stable API error", async () => {
    const response = await POST(new Request("https://local.test/api/notas/processar", { method: "POST", headers: { "content-type": "application/json" }, body: "null" }));
    expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });
});
