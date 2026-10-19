// Synthetic data only. No fiscal service is called and no certificate is persisted.
import { generateKeyPairSync, X509Certificate } from "node:crypto";
import { Agent } from "node:https";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import type { CertificateContext, ProtocolData, SefazConsultationResult } from "../../../types/contracts";
import { parseNfeXml, signedNfeDigestValue } from "../xml";

import { SYNTHETIC_CNPJ, syntheticAccessKey } from "./identity";
export { SYNTHETIC_CNPJ } from "./identity";
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privatePem = pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const cert = forge.pki.createCertificate();
cert.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ format: "pem", type: "spki" }).toString());
cert.serialNumber = "71";
cert.validity.notBefore = new Date("2020-01-01T00:00:00Z");
cert.validity.notAfter = new Date(Date.now() + 86_400_000);
cert.setSubject([{ name: "commonName", value: "SYNTHETIC ACCEPTANCE TEST" }, { name: "serialNumber", value: `CNPJ: ${SYNTHETIC_CNPJ}` }]);
cert.setIssuer(cert.subject.attributes);
cert.sign(forge.pki.privateKeyFromPem(privatePem), forge.md.sha256.create());
export const syntheticCertificatePem = forge.pki.certificateToPem(cert);
export const syntheticPfx = () => Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(forge.pki.privateKeyFromPem(privatePem), [cert], "synthetic-test-password", { algorithm: "3des", useMac: true })).getBytes(), "latin1");
export const syntheticContext = (): CertificateContext => ({
  certificate: new X509Certificate(syntheticCertificatePem), certificateCnpj: SYNTHETIC_CNPJ,
  validFrom: cert.validity.notBefore.toISOString(), validTo: cert.validity.notAfter.toISOString(),
  createHttpsAgent: () => new Agent(), dispose() {},
});

export function syntheticNfe(tpEmis = "1", model: "55" | "65" = "65") {
  const key = syntheticAccessKey(tpEmis, model);
  const unsigned = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${key}" versao="4.00"><ide><cUF>42</cUF><cNF>12345678</cNF><natOp>VENDA TESTE SINTETICO</natOp><mod>${model}</mod><serie>1</serie><nNF>42</nNF><dhEmi>2026-09-01T10:00:00-03:00</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>4205407</cMunFG><tpImp>${model === "65" ? "4" : "1"}</tpImp><tpEmis>${tpEmis}</tpEmis><cDV>${key.at(-1)}</cDV><tpAmb>2</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>TESTE-1</verProc></ide><emit><CNPJ>${SYNTHETIC_CNPJ}</CNPJ><xNome>EMITENTE SINTETICO SEM VALOR FISCAL</xNome><enderEmit><xLgr>RUA TESTE</xLgr><nro>1</nro><xBairro>TESTE</xBairro><cMun>4205407</cMun><xMun>FLORIANOPOLIS</xMun><UF>SC</UF><CEP>88000000</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderEmit><IE>123456789</IE><CRT>1</CRT></emit><det nItem="1"><prod><cProd>TESTE</cProd><cEAN>SEM GTIN</cEAN><xProd>PRODUTO SINTETICO</xProd><NCM>61091000</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>1.0000000000</vUnCom><vProd>1.00</vProd><cEANTrib>SEM GTIN</cEANTrib><uTrib>UN</uTrib><qTrib>1.0000</qTrib><vUnTrib>1.0000000000</vUnTrib><indTot>1</indTot></prod><imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS><PIS><PISNT><CST>07</CST></PISNT></PIS><COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS></imposto></det><total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>1.00</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>1.00</vNF></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag><detPag><tPag>01</tPag><vPag>1.00</vPag></detPag></pag></infNFe></NFe>`;
  const signer = new SignedXml({ privateKey: privatePem, publicCert: syntheticCertificatePem, signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1", canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315" });
  signer.addReference({ xpath: "//*[local-name(.)='infNFe']", transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"], digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1" });
  signer.computeSignature(unsigned, { location: { reference: "//*[local-name(.)='NFe']", action: "append" } });
  const xml = signer.getSignedXml();
  const digest = signedNfeDigestValue(xml, parseNfeXml(xml))!;
  const infProt = { attributes: {}, namespaceDeclarations: {}, tpAmb: "2", verAplic: "SIMULATED", chNFe: key, dhRecbto: "2026-09-01T10:01:00-03:00", nProt: "242260000000001", digVal: digest, cStat: "100", xMotivo: "Autorizado para uso da NF-e", additionalFields: {} };
  const rawProtocol = `<protNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><infProt><tpAmb>2</tpAmb><verAplic>SIMULATED</verAplic><chNFe>${key}</chNFe><dhRecbto>${infProt.dhRecbto}</dhRecbto><nProt>${infProt.nProt}</nProt><digVal>${digest}</digVal><cStat>100</cStat><xMotivo>${infProt.xMotivo}</xMotivo></infProt></protNFe>`;
  const protocol: ProtocolData = { attributes: { versao: "4.00" }, namespaceDeclarations: {}, infProt, originalProtNFeXml: rawProtocol, accessKey: key, protocolNumber: infProt.nProt, cStat: "100", digest };
  const consultation: SefazConsultationResult = { contractVersion: "1", queriedAccessKey: key, service: "SIMULATED_NFeConsultaProtocolo", authority: "SVRS_NFCE", environment: "homologation", model, consultedAt: new Date().toISOString(), success: true, cStat: "100", chNFe: key, tpAmb: "2", cUF: "42", protocol, evidence: [] };
  return { xml, key, protocol, consultation, nfeProc: `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">${xml}${rawProtocol}</nfeProc>` };
}
