import { Agent } from "node:https";
import type { CertificateContext, SefazConsultationRequest } from "@/types/contracts";
import { describe, expect, it, vi } from "vitest";
import { authorityFor, resolveProtocolEndpoint } from "./endpoints";
import { buildSoapRequest, createSefazConsultationClient } from "./protocol";
import type { SefazTransport, TransportRequest } from "./transport";

const originalKey = "42260901867724000108650010000257439594944564";
const alternativeKey = "42260901867724000108650010000257431536139497";
const simulated100 = await readFixture("simulated-100-response.xml");
const simulated613 = await readFixture("simulated-613-response.xml");
const simulated217 = await readFixture("simulated-217-response.xml");
const simulatedRejection = await readFixture("simulated-rejection-response.xml");
const simulatedSoapFault = await readFixture("simulated-soap-fault.xml");
const simulatedMalformed = await readFixture("simulated-malformed-response.xml");

describe("SEFAZ protocol consultation (simulated fixtures only)", () => {
  it("resolves different official providers by model, UF, and environment", () => {
    expect(authorityFor("55", "RS")).toBe("RS");
    expect(authorityFor("55", "MA")).toBe("SVAN");
    expect(authorityFor("55", "CE")).toBe("SVRS");
    expect(authorityFor("65", "RS")).toBe("RS");
    expect(authorityFor("65", "CE")).toBe("SVRS_NFCE");
    expect(resolveProtocolEndpoint({ model: "55", uf: "SP", cUF: "35", authority: "SP", environment: "homologation" })?.serviceUrl)
      .toBe("https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx");
    expect(resolveProtocolEndpoint({ model: "65", uf: "RS", cUF: "43", authority: "RS", environment: "production" })?.serviceUrl)
      .toBe("https://nfce.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx");
    expect(resolveProtocolEndpoint({ model: "55", uf: "RS", cUF: "43", authority: "SVRS", environment: "production" })).toBeUndefined();
  });

  it("builds the v4.00 SOAP consultation request using only the access key", () => {
    const xml = buildSoapRequest(originalKey, "homologation");
    expect(xml).toContain('xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"');
    expect(xml).toContain('xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4"');
    expect(xml).toContain('<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">');
    expect(xml).toContain("<tpAmb>2</tpAmb><xServ>CONSULTAR</xServ>");
    expect(xml).toContain(`<chNFe>${originalKey}</chNFe>`);
    expect(xml).not.toContain("<NFe>");
  });

  it("returns cStat 613 and a validated alternative key only when explicitly present", async () => {
    const transport = simulatedTransport(simulated613);
    const result = await createSefazConsultationClient({ transport })(request(originalKey));
    expect(result.success).toBe(true);
    expect(result.cStat).toBe("613");
    expect(result.xMotivo).toContain("Chave de Acesso difere");
    expect(result.chNFe).toBe(originalKey);
    expect(result.alternativeAccessKey).toBe(alternativeKey);
    expect(result.protocol).toBeUndefined();
  });

  it("extracts all protocol fields and preserves the exact original protNFe fragment", async () => {
    const result = await createSefazConsultationClient({ transport: simulatedTransport(simulated100) })(request(alternativeKey));
    expect(result.success).toBe(true);
    expect(result.cStat).toBe("100");
    expect(result.xMotivo).toContain("& protocolo disponível");
    expect(result.protocol?.protocolNumber).toBe("242261498431821");
    expect(result.protocol?.infProt.Id).toBe("ID242261498431821");
    expect(result.protocol?.infProt.nProt).toBe("242261498431821");
    expect(result.protocol?.infProt.cMsg).toBe("0");
    expect(result.protocol?.infProt.xMsg).toBe("Mensagem auxiliar simulada");
    expect(result.protocol?.infProt.attributes.versao).toBe("4.00");
    expect(result.protocol?.attributes.versao).toBe("4.00");
    expect(result.protocol?.namespaceDeclarations.xmlns).toBe("http://www.portalfiscal.inf.br/nfe");
    expect(result.protocol?.originalProtNFeXml).toMatch(/^<protNFe /);
    expect(result.protocol?.originalProtNFeXml).toContain("<infProt Id=\"ID242261498431821\" versao=\"4.00\">");
    expect(result.protocol?.originalProtNFeXml).toContain("\n          <infProt");
    expect(result.alternativeAccessKey).toBeUndefined();
  });

  it("treats cStat 217 and other fiscal rejections as consultation responses, not transport failures", async () => {
    const notFound = await createSefazConsultationClient({ transport: simulatedTransport(simulated217) })(request(alternativeKey));
    expect(notFound.success).toBe(true);
    expect(notFound.cStat).toBe("217");
    expect(notFound.technicalError).toBeUndefined();

    const rejected = await createSefazConsultationClient({ transport: simulatedTransport(simulatedRejection) })(request(alternativeKey));
    expect(rejected.success).toBe(true);
    expect(rejected.cStat).toBe("539");
    expect(rejected.alternativeAccessKey).toBeUndefined();
    expect(rejected.protocol).toBeUndefined();
  });

  it("rejects keys with a different check digit and prevents outbound calls", async () => {
    const transport = vi.fn<SefazTransport>();
    const result = await createSefazConsultationClient({ transport })(request(`${originalKey.slice(0, 43)}0`));
    expect(result.success).toBe(false);
    expect(result.technicalError?.code).toBe("CONFIGURATION_ERROR");
    expect(transport).not.toHaveBeenCalled();
  });

  it("returns typed errors for SOAP faults and malformed XML", async () => {
    const fault = await createSefazConsultationClient({ transport: simulatedTransport(simulatedSoapFault) })(request(originalKey));
    expect(fault.success).toBe(false);
    expect(fault.technicalError?.code).toBe("SOAP_FAULT");

    const malformed = await createSefazConsultationClient({ transport: simulatedTransport(simulatedMalformed) })(request(originalKey));
    expect(malformed.success).toBe(false);
    expect(malformed.technicalError?.code).toBe("MALFORMED_XML");
  });

  it("classifies network, timeout, and invalid-certificate failures without exposing error details", async () => {
    const network = await createSefazConsultationClient({ transport: async () => { throw Object.assign(new Error("private host detail"), { code: "EAI_AGAIN" }); } })(request(originalKey));
    expect(network.technicalError?.code).toBe("DNS_ERROR");
    expect(network.technicalError?.message).not.toContain("private host detail");

    const timeout = await createSefazConsultationClient({ transport: async () => { throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }); } })(request(originalKey));
    expect(timeout.technicalError?.code).toBe("TIMEOUT");

    const badCert = request(originalKey, {
      createHttpsAgent: () => { throw Object.assign(new Error("simulated invalid client certificate"), { code: "ERR_TLS_CERT_ALTNAME_INVALID" }); },
    });
    const invalidCertificate = await createSefazConsultationClient({ transport: simulatedTransport(simulated100) })(badCert);
    expect(invalidCertificate.technicalError?.code).toBe("TLS_ERROR");
  });

  it("validates official response key and ambiente before returning a protocol", async () => {
    const wrongKey = simulated100.replace(alternativeKey, originalKey);
    const result = await createSefazConsultationClient({ transport: simulatedTransport(wrongKey) })(request(alternativeKey));
    expect(result.success).toBe(false);
    expect(result.technicalError?.code).toBe("INVALID_RESPONSE");
    expect(result.protocol).toBeUndefined();
  });

  it("sends exactly one request, with timeout and response limits, and always destroys its Agent", async () => {
    let captured: TransportRequest | undefined;
    const agent = new Agent();
    const destroy = vi.spyOn(agent, "destroy");
    const cert = request(originalKey, { createHttpsAgent: () => agent });
    const transport: SefazTransport = async (input) => {
      captured = input;
      return { statusCode: 200, body: Buffer.from(simulated613) };
    };
    await createSefazConsultationClient({ transport, timeoutMs: 1000, maxResponseBytes: 2048 })(cert);
    expect(captured?.url).toMatch(/^https:\/\//);
    expect(captured?.timeoutMs).toBe(1000);
    expect(captured?.maxResponseBytes).toBe(2048);
    expect(captured?.body).toContain(`<chNFe>${originalKey}</chNFe>`);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("does not call any endpoint for an unconfigured authority/model pair", async () => {
    const transport = vi.fn<SefazTransport>();
    const input = request(originalKey);
    const result = await createSefazConsultationClient({ transport })({ ...input, authority: "UNKNOWN" as SefazConsultationRequest["authority"] });
    expect(result.success).toBe(false);
    expect(result.technicalError?.code).toBe("UNSUPPORTED_AUTHORITY");
    expect(transport).not.toHaveBeenCalled();
  });
});

function request(
  accessKey: string,
  contextOverrides: Partial<CertificateContext> = {},
): SefazConsultationRequest {
  const context = {
    certificate: {} as CertificateContext["certificate"],
    validFrom: "2026-01-01T00:00:00Z",
    validTo: "2027-01-01T00:00:00Z",
    createHttpsAgent: () => new Agent(),
    dispose: () => undefined,
    ...contextOverrides,
  } as CertificateContext;
  return {
    contractVersion: "1",
    accessKey,
    model: "65",
    uf: "SC",
    cUF: "42",
    authority: "SVRS_NFCE" as SefazConsultationRequest["authority"],
    environment: "production",
    certificateContext: context,
  };
}

function simulatedTransport(xml: string): SefazTransport {
  return async () => ({ statusCode: 200, body: Buffer.from(xml, "utf8") });
}

async function readFixture(name: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}
