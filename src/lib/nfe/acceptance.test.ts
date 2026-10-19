import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SYNTHETIC_SCHEMA_POLICY } from "./testing/schema-policy";
import { syntheticContext, syntheticNfe } from "./testing/synthetic";
import { validateFiscalXml } from "./schema";
import { recoverNfe } from "./recovery";
beforeEach(() => vi.stubEnv("NFE_SCHEMA_POLICY_JSON", SYNTHETIC_SCHEMA_POLICY));
afterEach(() => vi.unstubAllEnvs());

describe("Fiscal acceptance with synthetic XML/signatures and simulated consultation only", () => {
  it("validates the complete model 65 document against the official XSD", async () => {
    expect(await validateFiscalXml(syntheticNfe().nfeProc)).toMatchObject({ valid: true });
  });
  it("rejects a well-formed but incomplete fiscal XML against XSD", async () => {
    expect(await validateFiscalXml(syntheticNfe().nfeProc.replace(/<total>[\s\S]*?<\/total>/, ""))).toMatchObject({ valid: false, code: "XSD_VALIDATION_FAILED" });
  });
  it("A: recovers the same key with actual signature and XSD checks", async () => {
    const doc = syntheticNfe();
    const result = await recoverNfe({ xml: doc.xml, certificateContext: syntheticContext() }, { consult: vi.fn().mockResolvedValue(doc.consultation) });
    expect(result.status).toBe("recovered");
    expect(result.provenance?.schemaValidated).toBe(true);
  });
  it("B/C: 613 then 100 without the matching XML produces no file", async () => {
    const original = syntheticNfe("9"); const authorized = syntheticNfe("1");
    const consult = vi.fn().mockResolvedValueOnce({ ...original.consultation, cStat: "613", protocol: undefined, alternativeAccessKey: authorized.key }).mockResolvedValueOnce(authorized.consultation);
    const result = await recoverNfe({ xml: original.xml, certificateContext: syntheticContext() }, { consult });
    expect(consult).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("authorized_xml_unavailable");
    expect(result).not.toHaveProperty("authorizedXml");
  });
  it("D: validates manual matching signed XML and preserves it", async () => {
    const original = syntheticNfe("9"); const authorized = syntheticNfe("1");
    const consult = vi.fn().mockResolvedValueOnce({ ...original.consultation, cStat: "613", protocol: undefined, alternativeAccessKey: authorized.key }).mockResolvedValueOnce(authorized.consultation);
    const result = await recoverNfe({ xml: original.xml, authorizedXml: authorized.xml, certificateContext: syntheticContext() }, { consult });
    expect(result.status).toBe("recovered");
    expect(result.authorizedXml).toContain(authorized.xml);
    expect(result.originalKey).toBe(original.key);
    expect(result.authorizedKey).toBe(authorized.key);
    expect(result.provenance?.source).toBe("manual_upload");
  });
  it("also validates model 55 with the official XSD", async () => {
    const doc = syntheticNfe("1", "55");
    expect(await validateFiscalXml(doc.nfeProc)).toMatchObject({ valid: true });
  });
  it("E: blocks an altered signed document", async () => {
    const doc = syntheticNfe();
    const result = await recoverNfe({ xml: doc.xml.replace("PRODUTO SINTETICO", "PRODUTO ALTERADO"), certificateContext: syntheticContext() }, { consult: vi.fn().mockResolvedValue(doc.consultation) });
    expect(result.diagnostics[0].code).toBe("XML_SIGNATURE_INVALID");
    expect(result).not.toHaveProperty("authorizedXml");
  });
  it("E: checks the original protocol XML rather than trusting typed aliases alone", async () => {
    const doc = syntheticNfe();
    doc.protocol.originalProtNFeXml = doc.protocol.originalProtNFeXml.replace(doc.key, syntheticNfe("9").key);
    const result = await recoverNfe({ xml: doc.xml, certificateContext: syntheticContext() }, { consult: vi.fn().mockResolvedValue(doc.consultation) });
    expect(result.status).toBe("rejected");
    expect(result).not.toHaveProperty("authorizedXml");
  });
  it("E: blocks a protocol digest incompatible with the signed infNFe", async () => {
    const doc = syntheticNfe(); const old = doc.protocol.infProt.digVal!;
    doc.protocol.infProt.digVal = "AAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    doc.protocol.originalProtNFeXml = doc.protocol.originalProtNFeXml.replace(old, doc.protocol.infProt.digVal);
    const result = await recoverNfe({ xml: doc.xml, certificateContext: syntheticContext() }, { consult: vi.fn().mockResolvedValue(doc.consultation) });
    expect(result.diagnostics[0].code).toBe("PROTOCOL_DIGEST_MISMATCH");
  });
  it("D/E: rejects an arbitrary second XML rather than substituting the original", async () => {
    const original = syntheticNfe("9"); const authorized = syntheticNfe();
    const consult = vi.fn().mockResolvedValueOnce({ ...original.consultation, cStat: "613", protocol: undefined, alternativeAccessKey: authorized.key }).mockResolvedValueOnce(authorized.consultation);
    const result = await recoverNfe({ xml: original.xml, authorizedXml: syntheticNfe("1", "55").xml, certificateContext: syntheticContext() }, { consult });
    expect(result.diagnostics[0].code).toBe("AUTHORIZED_XML_IDENTITY_MISMATCH");
    expect(result.downloadAvailable).toBe(false);
  });
  it.each(["TIMEOUT", "DNS_ERROR", "TLS_ERROR", "HTTP_ERROR"] as const)("F/H: reports a simulated %s without enabling download", async (code) => {
    const doc = syntheticNfe();
    const result = await recoverNfe({ xml: doc.xml, certificateContext: syntheticContext() }, { consult: vi.fn().mockResolvedValue({ ...doc.consultation, success: false, cStat: undefined, protocol: undefined, technicalError: { code, retryable: true, message: "Simulated network failure" } }) });
    expect(result.status).toBe("service_unavailable"); expect(result).not.toHaveProperty("authorizedXml");
  });
  it("G: blocks a disallowed CNPJ before any consultation", async () => {
    const doc = syntheticNfe(); const consult = vi.fn();
    const result = await recoverNfe({ xml: doc.xml, certificateContext: { ...syntheticContext(), certificateCnpj: "11444777000161" } }, { consult });
    expect(result.status).toBe("certificate_invalid"); expect(consult).not.toHaveBeenCalled();
  });
  it("G: blocks an expired context before any consultation", async () => {
    const consult = vi.fn(); const doc = syntheticNfe();
    const result = await recoverNfe({ xml: doc.xml, certificateContext: { ...syntheticContext(), validTo: "2001-01-01" } }, { consult });
    expect(result.status).toBe("certificate_invalid"); expect(consult).not.toHaveBeenCalled();
  });
  it("E: rejects an incompatible protocol already present in the submitted document", async () => {
    const doc = syntheticNfe();
    const input = doc.nfeProc.replace("<nProt>242260000000001</nProt>", "<nProt>242260000000002</nProt>");
    const result = await recoverNfe({ xml: input, certificateContext: syntheticContext() }, { consult: vi.fn().mockResolvedValue(doc.consultation) });
    expect(result.diagnostics[0].code).toBe("SUBMITTED_PROTOCOL_MISMATCH"); expect(result).not.toHaveProperty("authorizedXml");
  });
  it("sets a 15 minute result lifetime without retaining a server session", async () => {
    const doc = syntheticNfe();
    const result = await recoverNfe({ xml: doc.xml, certificateContext: syntheticContext() }, { now: () => new Date("2026-10-17T12:00:00Z"), consult: vi.fn().mockResolvedValue(doc.consultation) });
    expect(result.expiresAt).toBe("2026-10-17T12:15:00.000Z");
  });
  it.each(["SCHEMA_CONFIGURATION_ERROR", "SCHEMA_WORKER_EXIT", "XSD_TIMEOUT", "SCHEMA_POLICY_UNAVAILABLE"])("reports schema failure %s as unavailable rather than fiscal rejection", async (code) => {
    const doc = syntheticNfe();
    const result = await recoverNfe({ xml: doc.xml, certificateContext: syntheticContext() }, { consult: vi.fn().mockResolvedValue(doc.consultation), schemaValidator: async () => ({ valid: false, profile: "SIMULATED_UNAVAILABLE", code }) });
    expect(result.status).toBe("service_unavailable"); expect(result).not.toHaveProperty("authorizedXml");
  });
});
