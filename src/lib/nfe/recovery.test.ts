import { describe, expect, it, vi } from "vitest";
import type { CertificateContext, ProtocolData, SefazConsultationResult } from "@/types/contracts";
import { recoverNfe } from "./recovery";
import { parseNfeXml, validateAccessKey } from "./xml";

// Simulated fixture only. It is not a fiscal document or an official SEFAZ response.
const sameKey = "42260901867724000108650010000257439594944564";
const alternativeKey = "42260901867724000108650010000257431536139497";
const issuerCnpj = "01867724000108";
const fixtureDigest = "RklYVFVSRS1ESUdFU1Q=";
const originalNfe = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${sameKey}" versao="4.00"><ide><cUF>42</cUF><mod>65</mod><serie>1</serie><nNF>25743</nNF><tpAmb>1</tpAmb><tpEmis>9</tpEmis></ide><emit><CNPJ>${issuerCnpj}</CNPJ><xNome>FIXTURE TESTE</xNome></emit></infNFe><Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><Reference URI="#NFe${sameKey}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><DigestValue>${fixtureDigest}</DigestValue></Reference></SignedInfo><SignatureValue>TESTE</SignatureValue></Signature></NFe>`;

function protocol(key: string): ProtocolData {
  const xml = `<protNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><infProt><tpAmb>1</tpAmb><verAplic>FIXTURE</verAplic><chNFe>${key}</chNFe><dhRecbto>2026-10-17T00:00:00-03:00</dhRecbto><nProt>242261498431821</nProt><digVal>${fixtureDigest}</digVal><cStat>100</cStat><xMotivo>Autorizado para uso</xMotivo></infProt></protNFe>`;
  return {
    protocolId: undefined,
    protocolVersion: "4.00",
    attributes: { versao: "4.00" },
    namespaceDeclarations: { xmlns: "http://www.portalfiscal.inf.br/nfe" },
    infProt: {
      attributes: {}, namespaceDeclarations: {}, chNFe: key, tpAmb: "1", verAplic: "FIXTURE",
      dhRecbto: "2026-10-17T00:00:00-03:00", nProt: "242261498431821", digVal: fixtureDigest, cStat: "100",
      xMotivo: "Autorizado para uso", additionalFields: {},
    },
    originalProtNFeXml: xml,
    accessKey: key,
    protocolNumber: "242261498431821",
    cStat: "100",
    xMotivo: "Autorizado para uso",
    receivedAt: "2026-10-17T00:00:00-03:00",
    environment: "production",
    digest: fixtureDigest,
  };
}

function consultation(key: string, status: string, protocolData?: ProtocolData, alternative?: string): SefazConsultationResult {
  return {
    contractVersion: "1", queriedAccessKey: key, service: "FIXTURE_NFeConsultaProtocolo", authority: "42",
    environment: "production", model: "65", consultedAt: "2026-10-17T00:00:00.000Z", success: true,
    cStat: status, xMotivo: status === "613" ? `Rejeição: ${alternative}` : "Autorizado para uso",
    chNFe: key, tpAmb: "1", cUF: "42", verAplic: "FIXTURE", dhRecbto: "2026-10-17T00:00:00-03:00",
    ...(protocolData ? { protocol: protocolData } : {}), ...(alternative ? { alternativeAccessKey: alternative } : {}), evidence: [],
  };
}

const certificateContext = {
  certificateCnpj: issuerCnpj,
  certificate: { publicKey: {} } as CertificateContext["certificate"],
  createHttpsAgent: vi.fn(), dispose: vi.fn(),
  validFrom: "2020-01-01", validTo: "2030-01-01",
} as unknown as CertificateContext;

describe("NF-e recovery orchestration (simulated fixtures only)", () => {
  it("validates the key and extracts invoice identity without treating parsing as authorization", () => {
    expect(validateAccessKey(sameKey)).toBe(true);
    const parsed = parseNfeXml(originalNfe);
    expect(parsed.accessKey).toBe(sameKey);
    expect(parsed.ide.tpEmis).toBe("9");
    expect(parsed.signature.present).toBe(true);
    expect(parsed.xmlWellFormed).toBe(true);
  });

  it("does not release an incomplete same-key XML even when the simulated signature gate passes", async () => {
    const prot = protocol(sameKey);
    const result = await recoverNfe({ xml: originalNfe, certificateContext }, {
      consult: vi.fn().mockResolvedValue(consultation(sameKey, "100", prot)),
      signatureVerifier: vi.fn().mockReturnValue(true),
      now: () => new Date("2026-10-17T03:00:00.000Z"),
    });
    expect(result.status).toBe("service_unavailable");
    expect(result).not.toHaveProperty("authorizedXml");
    expect(result.diagnostics.some((d) => d.code === "SCHEMA_POLICY_UNAVAILABLE")).toBe(true);
    expect(result.protocol).not.toHaveProperty("originalProtNFeXml");
  });

  it("follows 613 to the alternative 100 but never attaches that protocol to the original key", async () => {
    const first = consultation(sameKey, "613", undefined, alternativeKey);
    const second = consultation(alternativeKey, "100", protocol(alternativeKey));
    const consult = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const result = await recoverNfe({ xml: originalNfe, certificateContext }, {
      consult,
      signatureVerifier: vi.fn().mockReturnValue(true),
    });
    expect(consult).toHaveBeenCalledTimes(2);
    expect(result.status).toBe("authorized_xml_unavailable");
    expect(result).toMatchObject({ downloadAvailable: false, authorizedKey: alternativeKey });
    expect(result).not.toHaveProperty("authorizedXml");
    expect(result.diagnostics.some((item) => item.code === "XML_AUTORIZADO_INDISPONIVEL")).toBe(true);
  });

  it("does not enable download when signature verification fails", async () => {
    const result = await recoverNfe({ xml: originalNfe, certificateContext }, {
      consult: vi.fn().mockResolvedValue(consultation(sameKey, "100", protocol(sameKey))),
      signatureVerifier: vi.fn().mockReturnValue(false),
    });
    expect(result.status).toBe("rejected");
    expect(result.downloadAvailable).toBe(false);
    expect(result).not.toHaveProperty("authorizedXml");
  });

  it("rejects external entity declarations before parsing", () => {
    expect(() => parseNfeXml(`<!DOCTYPE x [<!ENTITY e SYSTEM "file:///secret">]>${originalNfe}`)).toThrow();
  });
});
