import { generateKeyPairSync, X509Certificate } from "node:crypto";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { describe, expect, it } from "vitest";
import type { ParsedNfe } from "@/types/contracts";
import { parseNfeXml, signedNfeDigestValue, verifyNfeSignature } from "./xml";

// Synthetic key/certificate/document generated only in memory for XMLDSig unit tests.
const key = "42260901867724000108650010000257439594944564";
const xmlUnsigned = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${key}" versao="4.00"><ide><cUF>42</cUF><mod>65</mod><serie>1</serie><nNF>25743</nNF><tpAmb>1</tpAmb><tpEmis>9</tpEmis></ide><emit><CNPJ>01867724000108</CNPJ><xNome>FIXTURE TESTE</xNome></emit></infNFe></NFe>`;

function signedFixture(): { xml: string; parsed: ParsedNfe; certificate: X509Certificate } {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privatePem = pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const publicPem = pair.publicKey.export({ format: "pem", type: "spki" }).toString();
  const forgePrivate = forge.pki.privateKeyFromPem(privatePem);
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = forge.pki.publicKeyFromPem(publicPem);
  certificate.serialNumber = "01";
  certificate.validity.notBefore = new Date(Date.now() - 60_000);
  certificate.validity.notAfter = new Date(Date.now() + 86_400_000);
  certificate.setSubject([{ name: "commonName", value: "Synthetic XMLDSig Test" }]);
  certificate.setIssuer(certificate.subject.attributes);
  certificate.sign(forgePrivate, forge.md.sha256.create());
  const certificatePem = forge.pki.certificateToPem(certificate);
  const signature = new SignedXml({
    privateKey: privatePem,
    publicCert: certificatePem,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  });
  signature.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    uri: `#${key}`,
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
  });
  signature.computeSignature(xmlUnsigned, { location: { reference: "//*[local-name(.)='NFe']", action: "append" } });
  const xml = signature.getSignedXml();
  return { xml, parsed: parseNfeXml(xml), certificate: new X509Certificate(certificatePem) };
}

describe("XMLDSig verification with synthetic fixtures", () => {
  it("validates a real in-memory signature bound to the expected infNFe ID and exposes its digest", () => {
    const fixture = signedFixture();
    expect(verifyNfeSignature(fixture.xml, fixture.parsed, fixture.certificate)).toBe(true);
    expect(signedNfeDigestValue(fixture.xml, fixture.parsed)).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("rejects content changed after signing", () => {
    const fixture = signedFixture();
    const tampered = fixture.xml.replace("FIXTURE TESTE", "ALTERADO");
    expect(verifyNfeSignature(tampered, fixture.parsed, fixture.certificate)).toBe(false);
  });

  it("rejects the same signature if the expected access-key ID is changed", () => {
    const fixture = signedFixture();
    const wrongDocument = { ...fixture.parsed, infNFeId: `NFe${"9".repeat(44)}` };
    expect(verifyNfeSignature(fixture.xml, wrongDocument, fixture.certificate)).toBe(false);
  });
  it("rejects an embedded certificate swapped outside SignedInfo", () => {
    const fixture = signedFixture(); const other = signedFixture();
    const swapped = fixture.xml.replace(fixture.certificate.raw.toString("base64"), other.certificate.raw.toString("base64"));
    expect(swapped).not.toBe(fixture.xml);
    expect(verifyNfeSignature(swapped, fixture.parsed, fixture.certificate)).toBe(false);
  });
});
