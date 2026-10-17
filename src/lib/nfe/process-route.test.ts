import { describe, expect, it, vi } from "vitest";
const { consult } = vi.hoisted(() => ({ consult: vi.fn() }));
vi.mock("../sefaz", async (original) => ({ ...await original<typeof import("../sefaz")>(), consultProtocol: consult }));
import { POST } from "../../app/api/notas/processar/route";
import { syntheticNfe, syntheticPfx } from "./testing/synthetic";

describe("Manual upload HTTP acceptance (synthetic A1, simulated consultation)", () => {
  it("processes the original and corresponding authorized file through the complete API", async () => {
    const original = syntheticNfe("9"); const authorized = syntheticNfe("1");
    consult.mockResolvedValueOnce({ ...original.consultation, cStat: "613", protocol: undefined, alternativeAccessKey: authorized.key }).mockResolvedValueOnce(authorized.consultation);
    const response = await POST(new Request("https://local.test/api/notas/processar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contractVersion: "1", xmlBase64: Buffer.from(original.xml).toString("base64"), authorizedXmlBase64: Buffer.from(authorized.xml).toString("base64"), certificatePfxBase64: syntheticPfx().toString("base64"), password: "synthetic-test-password" }) }));
    const body = await response.json();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("recovered"); expect(body.authorizedXml).toContain(authorized.xml); expect(body.provenance.schemaValidated).toBe(true);
    expect(JSON.stringify(body)).not.toContain("synthetic-test-password"); expect(body.protocol).not.toHaveProperty("originalProtNFeXml");
  });
  it("handles malformed envelopes with the stable API error", async () => {
    const response = await POST(new Request("https://local.test/api/notas/processar", { method: "POST", headers: { "content-type": "application/json" }, body: "null" }));
    expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });
});
