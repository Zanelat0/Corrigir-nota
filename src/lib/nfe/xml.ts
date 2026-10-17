import { XMLParser, XMLValidator } from "fast-xml-parser";
import { SignedXml } from "xml-crypto";
import { X509Certificate } from "node:crypto";
import type { CertificateContext, ParsedNfe, ProtocolData, RecoveryWarning } from "@/types/contracts";

const NFE_NS = "http://www.portalfiscal.inf.br/nfe";
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  removeNSPrefix: true,
  allowBooleanAttributes: false,
  htmlEntities: false,
});

export class NfeXmlError extends Error {
  constructor(readonly code: "INVALID_XML" | "UNSUPPORTED_XML" | "INVALID_ACCESS_KEY") {
    super("O XML informado não pôde ser validado.");
    this.name = "NfeXmlError";
  }
}

type XmlRecord = Record<string, unknown>;
const asRecord = (value: unknown): XmlRecord | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as XmlRecord : undefined;
const asArray = (value: unknown): unknown[] => value === undefined ? [] : Array.isArray(value) ? value : [value];
const text = (value: unknown): string | undefined => typeof value === "string" || typeof value === "number" ? String(value).trim() : undefined;
const child = (value: unknown, name: string): unknown => asRecord(value)?.[name];
const scalar = (value: unknown, name: string): string | undefined => text(child(value, name));

export function validateAccessKey(value: string): boolean {
  if (!/^\d{6}[0-9A-Z]{12}\d{26}$/.test(value)) return false;
  let sum = 0;
  let weight = 2;
  for (let index = 42; index >= 0; index -= 1) {
    sum += (value.charCodeAt(index) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;
  return checkDigit === Number(value[43]);
}

export function accessKeyParts(key: string) {
  if (!validateAccessKey(key)) throw new NfeXmlError("INVALID_ACCESS_KEY");
  return {
    cUF: key.slice(0, 2),
    yearMonth: key.slice(2, 6),
    issuerCnpj: key.slice(6, 20),
    model: key.slice(20, 22),
    series: String(Number(key.slice(22, 25))),
    noteNumber: String(Number(key.slice(25, 34))),
    tpEmis: key.slice(34, 35),
    cNF: key.slice(35, 43),
  };
}

function safeParse(xml: string): XmlRecord {
  assertXmlLimits(xml);
  const declaredEncoding = xml.match(/^\s*<\?xml\s+[^?]*encoding\s*=\s*["']([^"']+)["']/i)?.[1];
  if (Buffer.byteLength(xml, "utf8") > 5 * 1024 * 1024 || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml) || (declaredEncoding && !/^utf-?8$/i.test(declaredEncoding))) throw new NfeXmlError("INVALID_XML");
  if (XMLValidator.validate(xml, { allowBooleanAttributes: false }) !== true) throw new NfeXmlError("INVALID_XML");
  try {
    return parser.parse(xml) as XmlRecord;
  } catch {
    throw new NfeXmlError("INVALID_XML");
  }
}

/** Linear lexical preflight before any recursive XML parser or XMLDSig work. */
export function assertXmlLimits(xml: string, maxBytes = 5 * 1024 * 1024): void {
  if (Buffer.byteLength(xml) > maxBytes || /<!\s*(DOCTYPE|ENTITY)\b/i.test(xml)) throw new NfeXmlError("INVALID_XML");
  let cursor = 0; let depth = 0; let elements = 0;
  while (cursor < xml.length) {
    const open = xml.indexOf("<", cursor); if (open < 0) break;
    const skip = xml.startsWith("<!--", open) ? ["-->", 4] as const : xml.startsWith("<![CDATA[", open) ? ["]]>", 9] as const : xml.startsWith("<?", open) ? ["?>", 2] as const : undefined;
    if (skip) { const end = xml.indexOf(skip[0], open + skip[1]); if (end < 0) throw new NfeXmlError("INVALID_XML"); cursor = end + skip[0].length; continue; }
    let end = open + 1; let quote = "";
    for (; end < xml.length; end++) { const c = xml[end]; if (quote) { if (c === quote) quote = ""; } else if (c === "'" || c === '"') quote = c; else if (c === ">") break; }
    if (end === xml.length || quote || end - open > 64 * 1024) throw new NfeXmlError("INVALID_XML");
    const raw = xml.slice(open, end + 1); cursor = end + 1;
    if (raw.startsWith("</")) depth--; else if (!raw.startsWith("<!")) { elements++; if (!/\/\s*>$/.test(raw)) depth++; }
    if (depth < 0 || depth > 64 || elements > 60_000) throw new NfeXmlError("INVALID_XML");
  }
  if (depth !== 0) throw new NfeXmlError("INVALID_XML");
}

export function protocolMatchesXml(raw: string, expected: ProtocolData): boolean {
  try {
    const document = safeParse(raw);
    const inf = one(one(document, "protNFe"), "infProt");
    return Boolean(inf && (["chNFe", "nProt", "tpAmb", "cStat", "digVal"] as const).every((field) => scalar(inf, field)?.replace(/\s/g, "") === expected.infProt[field]?.replace(/\s/g, "")));
  } catch { return false; }
}

export function uploadedProtocolMatches(xml: string, expected: ProtocolData): boolean {
  try {
    const wrapper = child(safeParse(xml), "nfeProc");
    const protocols = asArray(child(wrapper, "protNFe"));
    if (!protocols.length) return true;
    if (protocols.length !== 1) return false;
    const raw = extractRawElement(xml, "protNFe");
    return Boolean(raw && protocolMatchesXml(raw, expected));
  } catch { return false; }
}

/** Finds one exact XML element slice without parsing/re-serializing signed content. */
export function extractRawElement(xml: string, localName: string): string | undefined {
  let start = -1;
  let depth = 0;
  let found: string | undefined;
  let cursor = 0;
  while (cursor < xml.length) {
    const open = xml.indexOf("<", cursor);
    if (open < 0) break;
    if (xml.startsWith("<!--", open)) {
      const endComment = xml.indexOf("-->", open + 4);
      if (endComment < 0) return undefined;
      cursor = endComment + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", open)) {
      const endCdata = xml.indexOf("]]>", open + 9);
      if (endCdata < 0) return undefined;
      cursor = endCdata + 3;
      continue;
    }
    if (xml.startsWith("<?", open)) {
      const endInstruction = xml.indexOf("?>", open + 2);
      if (endInstruction < 0) return undefined;
      cursor = endInstruction + 2;
      continue;
    }
    let end = open + 1;
    let quote = "";
    while (end < xml.length) {
      const character = xml[end];
      if (quote) {
        if (character === quote) quote = "";
      } else if (character === "\"" || character === "'") {
        quote = character;
      } else if (character === ">") {
        break;
      }
      end += 1;
    }
    if (end >= xml.length || quote) return undefined;
    const raw = xml.slice(open, end + 1);
    cursor = end + 1;
    if (/^<!/.test(raw)) continue;
    const name = raw.match(/^<\/?([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)/)?.[1];
    if (!name || name.split(":").at(-1) !== localName) continue;
    if (raw.startsWith("</")) {
      if (start >= 0 && --depth === 0) {
        if (found) return undefined;
        found = xml.slice(start, end + 1);
        start = -1;
      }
    } else if (start < 0) {
      if (raw.endsWith("/>")) {
        if (found) return undefined;
        found = raw;
      } else {
        start = open;
        depth = 1;
      }
    } else if (!raw.endsWith("/>")) {
      depth += 1;
    }
  }
  return start < 0 ? found : undefined;
}

function one(value: unknown, key: string): unknown {
  const values = asArray(child(value, key));
  return values.length === 1 ? values[0] : undefined;
}

export function parseNfeXml(xml: string): ParsedNfe {
  const document = safeParse(xml);
  const nfeProc = child(document, "nfeProc");
  const nfe = child(document, "NFe") ?? child(nfeProc, "NFe");
  const infNFe = one(nfe, "infNFe");
  if (!infNFe) throw new NfeXmlError("UNSUPPORTED_XML");
  const id = scalar(infNFe, "@_Id") ?? "";
  const key = id.startsWith("NFe") ? id.slice(3) : "";
  if (!validateAccessKey(key)) throw new NfeXmlError("INVALID_ACCESS_KEY");
  const parts = accessKeyParts(key);
  const ide = child(infNFe, "ide");
  const emit = child(infNFe, "emit");
  const cnpj = scalar(emit, "CNPJ");
  const cpf = scalar(emit, "CPF");
  const modelText = scalar(ide, "mod");
  const model = modelText === "55" || modelText === "65" ? modelText : undefined;
  if (!model || model !== parts.model) throw new NfeXmlError("UNSUPPORTED_XML");
  assertNfeNamespace(xml);
  const warnings: RecoveryWarning[] = [];
  if (parts.tpEmis !== "1") warnings.push({ code: "CONTINGENCY_OR_SPECIAL_EMISSION", severity: "warning", message: "O XML indica modalidade de emissão diferente da emissão normal; a identidade da chave será preservada." });
  if (!cnpj && !cpf) warnings.push({ code: "ISSUER_ID_UNAVAILABLE", severity: "blocking", message: "Não foi possível identificar CNPJ/CPF do emitente no XML." });
  const signature = one(nfe, "Signature");
  if (!scalar(ide, "cUF") || !scalar(ide, "serie") || !scalar(ide, "nNF") || !scalar(ide, "tpAmb") || !cnpj || scalar(infNFe, "@_versao") !== "4.00" || !signature) {
    throw new NfeXmlError("UNSUPPORTED_XML");
  }
  const qr = child(child(nfe, "infNFeSupl") ?? child(document, "infNFeSupl") ?? child(nfeProc, "infNFeSupl"), "qrCode");
  const qrCode = text(qr);
  const extracted = extractRawElement(xml, "NFe");
  if (!extracted) throw new NfeXmlError("UNSUPPORTED_XML");
  return {
    contractVersion: "1",
    accessKey: key,
    infNFeId: id,
    model,
    series: scalar(ide, "serie") ?? parts.series,
    noteNumber: scalar(ide, "nNF") ?? parts.noteNumber,
    issuerCnpj: cnpj ?? parts.issuerCnpj,
    ide: {
      tpAmb: scalar(ide, "tpAmb"), tpEmis: scalar(ide, "tpEmis"), dhEmi: scalar(ide, "dhEmi"), dEmi: scalar(ide, "dEmi"),
      mod: modelText, serie: scalar(ide, "serie"), nNF: scalar(ide, "nNF"), cUF: scalar(ide, "cUF"),
      cNF: scalar(ide, "cNF"), cDV: scalar(ide, "cDV"),
    },
    emit: { cnpj, cpf, name: scalar(emit, "xNome") },
    signature: { present: Boolean(signature) },
    ...(qrCode ? { qrCode } : {}),
    xmlWellFormed: true,
    warnings,
  };
}

/** XMLDSig verification is pinned to the A1 public key and a single infNFe reference. */
export function verifyNfeSignature(xml: string, parsed: ParsedNfe, certificate: CertificateContext["certificate"]): boolean {
  const rawSignature = extractRawElement(xml, "Signature");
  if (!rawSignature) return false;
  const signatureTag = rawSignature.match(/^<([\w.-]+:)?Signature\b/)?.[1];
  const dsigNamespace = "http://www.w3.org/2000/09/xmldsig#";
  const namespaceBound = signatureTag
    ? new RegExp(`xmlns:${signatureTag.slice(0, -1)}=["']${dsigNamespace}["']`).test(xml)
    : new RegExp(`xmlns=["']${dsigNamespace}["']`).test(rawSignature);
  if (!namespaceBound) return false;
  const idAttribute = new RegExp(`\\bId\\s*=\\s*(["'])${parsed.infNFeId}\\1`, "g");
  if ([...xml.matchAll(idAttribute)].length !== 1) return false;
  try {
    const embedded = extractRawElement(rawSignature, "X509Certificate")?.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, "").replace(/\s/g, "");
    if (!embedded || !/^[A-Za-z0-9+/]+=*$/.test(embedded) || embedded.length > 32_768) return false;
    if (new X509Certificate(Buffer.from(embedded, "base64")).fingerprint256 !== certificate.fingerprint256) return false;
    const signature = new SignedXml({ publicCert: certificate.publicKey, getCertFromKeyInfo: () => null });
    signature.idAttributes = ["Id"];
    signature.loadSignature(rawSignature);
    const references = signature.getReferences();
    if (references.length !== 1 || references[0].uri !== `#${parsed.infNFeId}`) return false;
    if (!["http://www.w3.org/2000/09/xmldsig#rsa-sha1", "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"].includes(signature.signatureAlgorithm ?? "")) return false;
    const algorithm = references[0].digestAlgorithm;
    if (!new Set([
      "http://www.w3.org/2000/09/xmldsig#sha1",
      "http://www.w3.org/2001/04/xmlenc#sha256",
      "http://www.w3.org/2001/04/xmldsig-more#sha384",
      "http://www.w3.org/2001/04/xmlenc#sha512",
    ]).has(algorithm)) return false;
    const allowedTransforms = new Set([
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ]);
    if (references[0].transforms.length !== 2 || new Set(references[0].transforms).size !== 2 || references[0].transforms.some((transform) => !allowedTransforms.has(transform))) return false;
    return signature.checkSignature(xml);
  } catch {
    return false;
  }
}

/** Returns the signed infNFe digest after enforcing a single expected reference. */
export function signedNfeDigestValue(xml: string, parsed: ParsedNfe): string | undefined {
  const rawSignature = extractRawElement(xml, "Signature");
  if (!rawSignature) return undefined;
  try {
    const signature = new SignedXml({ getCertFromKeyInfo: () => null });
    signature.idAttributes = ["Id"];
    signature.loadSignature(rawSignature);
    const references = signature.getReferences();
    if (references.length !== 1 || references[0].uri !== `#${parsed.infNFeId}`) return undefined;
    const digest = references[0].digestValue;
    const normalized = typeof digest === "string" ? digest.replace(/\s+/g, "") : "";
    return /^[A-Za-z0-9+/]+={0,2}$/.test(normalized) ? normalized : undefined;
  } catch {
    return undefined;
  }
}

export function assertNfeNamespace(xml: string): void {
  const nfeRaw = extractRawElement(xml, "NFe");
  const wrapperRaw = extractRawElement(xml, "nfeProc");
  const namespaceDeclaration = new RegExp(`xmlns=["']${NFE_NS}["']`);
  const openingTag = (raw: string | undefined) => raw?.match(/^<[^>]+>/)?.[0];
  if (!nfeRaw || (!namespaceDeclaration.test(openingTag(nfeRaw) ?? "") && !(wrapperRaw && namespaceDeclaration.test(openingTag(wrapperRaw) ?? "")))) throw new NfeXmlError("UNSUPPORTED_XML");
}
