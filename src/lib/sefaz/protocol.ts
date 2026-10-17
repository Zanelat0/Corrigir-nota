import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type {
  ConsultationEvidence,
  FiscalEnvironment,
  ProtocolData,
  ProtocolInfProt,
  SefazConsultationRequest,
  SefazConsultationResult,
  SefazTechnicalError,
} from "@/types/contracts";
import { authorityFor, resolveProtocolEndpoint } from "./endpoints";
import { httpsSoapTransport, TransportFailure, type SefazTransport } from "./transport";
import { assertXmlLimits } from "../nfe/xml";

const CONTRACT_VERSION = "1" as const;
const SERVICE = "NFeConsultaProtocolo";
const NFE_NS = "http://www.portalfiscal.inf.br/nfe";
const WSDL_NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4";
const SOAP_NS = "http://www.w3.org/2003/05/soap-envelope";
const RESPONSE_LIMIT = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const EMPTY_FIELDS = new Set([
  "tpAmb", "verAplic", "chNFe", "dhRecbto", "nProt", "digVal", "cStat", "xMotivo", "cMsg", "xMsg", "nRec",
]);

type XmlValue = string | number | boolean | null | XmlNode | XmlValue[];
interface XmlNode { [key: string]: XmlValue }
type Attrs = Record<string, string>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  removeNSPrefix: false,
  allowBooleanAttributes: false,
  htmlEntities: false,
});

export interface SefazClientOptions {
  /** Only for deterministic tests; production export uses the fixed HTTPS transport. */
  transport?: SefazTransport;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export function createSefazConsultationClient(options: SefazClientOptions = {}) {
  const transport = options.transport ?? httpsSoapTransport;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? RESPONSE_LIMIT;

  return async function consult(input: SefazConsultationRequest): Promise<SefazConsultationResult> {
    const consultedAt = new Date().toISOString();
    const base = {
      contractVersion: CONTRACT_VERSION,
      queriedAccessKey: input.accessKey,
      service: SERVICE,
      authority: input.authority,
      environment: input.environment,
      model: input.model,
      consultedAt,
      evidence: [] as ConsultationEvidence[],
    };

    const endpoint = resolveProtocolEndpoint(input);
    if (!endpoint || authorityFor(input.model, input.uf) !== input.authority) {
      return failure(base, "UNSUPPORTED_AUTHORITY", "Não há endpoint oficial configurado para esta combinação de UF, modelo, autorizador e ambiente.", false);
    }

    const keyProblem = validateRequestKey(input.accessKey, input.model, input.uf, input.cUF);
    if (keyProblem) {
      return failure(base, "CONFIGURATION_ERROR", keyProblem, false);
    }

    let agent;
    try {
      agent = input.certificateContext.createHttpsAgent();
    } catch {
      return failure(base, "TLS_ERROR", "Não foi possível preparar o contexto mTLS do certificado para a consulta.", false);
    }

    try {
      const soap = buildSoapRequest(input.accessKey, input.environment);
      const response = await transport({
        url: endpoint.serviceUrl,
        body: soap,
        agent,
        timeoutMs,
        maxResponseBytes,
      });

      const raw = decodeResponse(response.body);
      const digest = createHash("sha256").update(response.body).digest("hex");
      const responseEvidence: ConsultationEvidence = {
        type: "response",
        code: "SOAP_RESPONSE_RECEIVED",
        message: "Resposta SOAP recebida e analisada em memória.",
        observedAt: new Date().toISOString(),
        httpStatus: response.statusCode,
        sha256: digest,
      };
      let parsed: { result?: ParsedConsultation; soapFault: boolean };
      try {
        parsed = parseSoapResponse(raw);
      } catch (error) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const message = `O serviço SEFAZ retornou HTTP ${response.statusCode} com corpo não SOAP válido.`;
          return {
            ...base,
            success: false,
            technicalError: technical("HTTP_ERROR", response.statusCode >= 500, message),
            errorCode: "HTTP_ERROR",
            evidence: [responseEvidence, evidence("transport", "HTTP_ERROR", message, { httpStatus: response.statusCode })],
          };
        }
        throw error;
      }
      if (parsed.soapFault) {
        return {
          ...base,
          success: false,
          technicalError: technical("SOAP_FAULT", false, "O serviço SEFAZ retornou uma falha SOAP."),
          errorCode: "SOAP_FAULT",
          evidence: [responseEvidence, evidence("service", "SOAP_FAULT", "Falha SOAP retornada pelo serviço.")],
        };
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return {
          ...base,
          success: false,
          technicalError: technical("HTTP_ERROR", response.statusCode >= 500, `O serviço SEFAZ retornou HTTP ${response.statusCode}.`),
          errorCode: "HTTP_ERROR",
          evidence: [responseEvidence, evidence("transport", "HTTP_ERROR", `Resposta HTTP ${response.statusCode}.`, { httpStatus: response.statusCode })],
        };
      }

      if (!parsed.result) {
        return {
          ...base,
          success: false,
          technicalError: technical("INVALID_RESPONSE", false, "A resposta SOAP não contém um retorno NFeConsultaProtocolo válido."),
          errorCode: "INVALID_RESPONSE",
          evidence: [responseEvidence, evidence("response", "CONSULTATION_RESULT_MISSING", "Elemento retConsSitNFe ausente ou ambíguo.")],
        };
      }

      const result = parsed.result;
      if (
        !result.cStat || !/^\d{3}$/.test(result.cStat) || !result.xMotivo ||
        !result.chNFe || !result.tpAmb || !result.cUF || !result.verAplic || !result.dhRecbto
      ) {
        return {
          ...base,
          success: false,
          cStat: result.cStat,
          xMotivo: result.xMotivo,
          chNFe: result.chNFe,
          tpAmb: result.tpAmb,
          cUF: result.cUF,
          verAplic: result.verAplic,
          dhRecbto: result.dhRecbto,
          technicalError: technical("INVALID_RESPONSE", false, "A resposta SEFAZ não contém cStat e xMotivo válidos."),
          errorCode: "INVALID_RESPONSE",
          evidence: [responseEvidence, evidence("response", "CONSULTATION_STATUS_INVALID", "Campos obrigatórios da resposta de consulta ausentes ou inválidos.")],
        };
      }

      if ((result.tpAmb && result.tpAmb !== environmentCode(input.environment)) || (result.chNFe && result.chNFe !== input.accessKey)) {
        return {
          ...base,
          success: false,
          cStat: result.cStat,
          xMotivo: result.xMotivo,
          chNFe: result.chNFe,
          tpAmb: result.tpAmb,
          cUF: result.cUF,
          verAplic: result.verAplic,
          dhRecbto: result.dhRecbto,
          technicalError: technical("INVALID_RESPONSE", false, "A resposta oficial não corresponde à chave consultada ou ao ambiente solicitado."),
          errorCode: "INVALID_RESPONSE",
          evidence: [responseEvidence, evidence("response", "RESPONSE_IDENTITY_MISMATCH", "Chave consultada ou ambiente não corresponde à solicitação.")],
        };
      }

      let protocol = result.protocol;
      if (protocol?.accessKey && protocol.accessKey !== input.accessKey) {
        protocol = undefined;
      }
      const outputEvidence = [
        responseEvidence,
        evidence("service", "CONSULTATION_STATUS", "Status fiscal retornado pela consulta de protocolo.", { cStat: result.cStat }),
      ];
      if (protocol) outputEvidence.push(evidence("protocol", "PROTOCOL_RECEIVED", "protNFe preservado para validação de identidade pelo motor."));

      const alternativeAccessKey = result.cStat === "613"
        ? extractCompatibleAlternativeKey(input.accessKey, result.xMotivo, outputEvidence)
        : undefined;

      return {
        ...base,
        success: true,
        cStat: result.cStat,
        xMotivo: result.xMotivo,
        chNFe: result.chNFe,
        tpAmb: result.tpAmb,
        cUF: result.cUF,
        verAplic: result.verAplic,
        dhRecbto: result.dhRecbto,
        protocol,
        alternativeAccessKey,
        evidence: outputEvidence,
      };
    } catch (error) {
      const classified = classifyError(error);
      return {
        ...base,
        success: false,
        technicalError: classified,
        errorCode: classified.code,
        evidence: [evidence("transport", classified.code, classified.message)],
      };
    } finally {
      agent.destroy();
    }
  };
}

/** Production client. Tests should use createSefazConsultationClient with simulated responses. */
export const consultProtocol = createSefazConsultationClient();

export function buildSoapRequest(accessKey: string, environment: FiscalEnvironment): string {
  const tpAmb = environmentCode(environment);
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap12:Envelope xmlns:soap12="${SOAP_NS}">` +
    `<soap12:Body><nfeDadosMsg xmlns="${WSDL_NS}">` +
    `<consSitNFe xmlns="${NFE_NS}" versao="4.00">` +
    `<tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${accessKey}</chNFe>` +
    `</consSitNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}

function parseSoapResponse(raw: string): { result?: ParsedConsultation; soapFault: boolean } {
  try { assertXmlLimits(raw, RESPONSE_LIMIT); } catch { throw new ParseFailure("XML complexity limit exceeded"); }
  const unsafeXml = /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(raw);
  if (unsafeXml) throw new ParseFailure("DTD/ENTITY is prohibited");
  const validation = XMLValidator.validate(raw, { allowBooleanAttributes: false });
  if (validation !== true) throw new ParseFailure("Malformed XML");

  let document: XmlNode;
  try {
    document = parser.parse(raw) as XmlNode;
  } catch {
    throw new ParseFailure("Malformed XML");
  }

  const soapFault = findNodes(document, "Fault").length > 0;
  if (soapFault) return { soapFault: true };
  const candidates = findNodes(document, "retConsSitNFe");
  const qualifiedCount = countQualifiedElements(raw, "retConsSitNFe", NFE_NS);
  if (candidates.length === 0) {
    const wrapped = findNodes(document, "nfeResultMsg").map(scalarText).find((text) => text.includes("retConsSitNFe"));
    if (wrapped) {
      const unescaped = decodeXmlEntities(wrapped);
      if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(unescaped)) throw new ParseFailure("DTD/ENTITY is prohibited");
      const secondValidation = XMLValidator.validate(unescaped, { allowBooleanAttributes: false });
      if (secondValidation !== true) throw new ParseFailure("Malformed embedded result XML");
      const embedded = parser.parse(unescaped) as XmlNode;
      return parseParsedDocument(embedded, unescaped);
    }
  }
  if (candidates.length !== 1 || qualifiedCount !== 1) return { soapFault: false };
  return { soapFault: false, result: readConsultation(candidates[0], raw) };
}

function parseParsedDocument(document: XmlNode, raw: string): { result?: ParsedConsultation; soapFault: boolean } {
  const candidates = findNodes(document, "retConsSitNFe");
  return candidates.length === 1 && countQualifiedElements(raw, "retConsSitNFe", NFE_NS) === 1
    ? { soapFault: false, result: readConsultation(candidates[0], raw) }
    : { soapFault: false };
}

interface ParsedConsultation {
  cStat?: string;
  xMotivo?: string;
  chNFe?: string;
  tpAmb?: string;
  cUF?: string;
  verAplic?: string;
  dhRecbto?: string;
  protocol?: ProtocolData;
}

function readConsultation(node: XmlValue, raw: string): ParsedConsultation {
  const source = asNode(node);
  const output: ParsedConsultation = {
    cStat: childText(source, "cStat"),
    xMotivo: childText(source, "xMotivo"),
    chNFe: childText(source, "chNFe"),
    tpAmb: childText(source, "tpAmb"),
    cUF: childText(source, "cUF"),
    verAplic: childText(source, "verAplic"),
    dhRecbto: childText(source, "dhRecbto"),
  };
  const protocolNode = child(source, "protNFe");
  if (protocolNode) {
    const originalProtNFeXml = extractProtocolXml(raw);
    if (originalProtNFeXml) output.protocol = readProtocol(protocolNode, originalProtNFeXml);
  }
  return output;
}

function readProtocol(value: XmlValue, originalProtNFeXml: string): ProtocolData {
  const node = asNode(value);
  const attributes = readAttributes(node);
  const infValue = child(node, "infProt");
  const inf = infValue ? readInfProt(infValue) : undefined;
  return {
    protocolId: attributes.Id,
    protocolVersion: attributes.versao,
    attributes,
    namespaceDeclarations: readNamespaces(node),
    infProt: inf ?? { attributes: {}, namespaceDeclarations: {}, additionalFields: {} },
    originalProtNFeXml,
    accessKey: inf?.chNFe,
    protocolNumber: inf?.nProt,
    cStat: inf?.cStat,
    xMotivo: inf?.xMotivo,
    receivedAt: inf?.dhRecbto,
    environment: inf?.tpAmb,
    digest: inf?.digVal,
  };
}

function readInfProt(value: XmlValue): ProtocolInfProt {
  const node = asNode(value);
  const attributes = readAttributes(node);
  const fields: ProtocolInfProt = {
    attributes,
    namespaceDeclarations: readNamespaces(node),
    additionalFields: {},
    Id: attributes.Id,
  };
  for (const field of EMPTY_FIELDS) {
    const text = childText(node, field);
    if (text !== undefined) fields[field as keyof Pick<ProtocolInfProt, "tpAmb" | "verAplic" | "chNFe" | "dhRecbto" | "nProt" | "digVal" | "cStat" | "xMotivo" | "cMsg" | "xMsg" | "nRec">] = text;
  }
  for (const [key, childValue] of Object.entries(node)) {
    if (key.startsWith("@_") || key === "#text" || EMPTY_FIELDS.has(localName(key))) continue;
    fields.additionalFields[localName(key)] = scalarText(childValue);
  }
  return fields;
}

function extractProtocolXml(raw: string): string | undefined {
  // The current lexical source is scanned to preserve the exact SEFAZ fragment,
  // including its original prefixes, namespace declarations, and whitespace.
  const tokens = tokenizeXml(raw);
  const stack: Array<{ qName: string; namespaces: Map<string, string>; start: number; ancestorResponse: boolean }> = [];
  for (const token of tokens) {
    if (token.kind === "start") {
      const namespaces = new Map(stack.at(-1)?.namespaces ?? [["xml", "http://www.w3.org/XML/1998/namespace"]]);
      for (const [key, value] of parseTagAttributes(token.text)) {
        if (key === "xmlns") namespaces.set("", value);
        else if (key.startsWith("xmlns:")) namespaces.set(key.slice(6), value);
      }
      const local = localName(token.qName);
      const ancestorResponse = local === "retConsSitNFe" || Boolean(stack.at(-1)?.ancestorResponse);
      const isProtocol = local === "protNFe" && namespaces.get(prefixName(token.qName)) === NFE_NS && ancestorResponse;
      if (token.selfClosing) {
        if (isProtocol) return raw.slice(token.start, token.end);
      } else {
        stack.push({ qName: token.qName, namespaces, start: token.start, ancestorResponse });
        if (isProtocol) stack.at(-1)!.ancestorResponse = true;
      }
    } else if (token.kind === "end") {
      const current = stack.pop();
      if (current && current.qName === token.qName) {
        const local = localName(current.qName);
        if (local === "protNFe" && current.namespaces.get(prefixName(current.qName)) === NFE_NS && current.ancestorResponse) {
          return raw.slice(current.start, token.end);
        }
      }
    }
  }
  return undefined;
}

function countQualifiedElements(xml: string, targetLocalName: string, targetNamespace: string): number {
  let count = 0;
  const stack: Array<{ qName: string; namespaces: Map<string, string> }> = [];
  for (const token of tokenizeXml(xml)) {
    if (token.kind === "start") {
      const namespaces = new Map(stack.at(-1)?.namespaces ?? [["xml", "http://www.w3.org/XML/1998/namespace"]]);
      for (const [key, value] of parseTagAttributes(token.text)) {
        if (key === "xmlns") namespaces.set("", value);
        else if (key.startsWith("xmlns:")) namespaces.set(key.slice(6), value);
      }
      if (localName(token.qName) === targetLocalName && namespaces.get(prefixName(token.qName)) === targetNamespace) count += 1;
      if (!token.selfClosing) stack.push({ qName: token.qName, namespaces });
    } else if (token.kind === "end") {
      const current = stack.pop();
      if (current?.qName !== token.qName) return 0;
    }
  }
  return stack.length === 0 ? count : 0;
}

function tokenizeXml(xml: string): Array<{ kind: "start" | "end"; qName: string; text: string; start: number; end: number; selfClosing: boolean }> {
  const tokens: Array<{ kind: "start" | "end"; qName: string; text: string; start: number; end: number; selfClosing: boolean }> = [];
  let cursor = 0;
  while (cursor < xml.length) {
    const opening = xml.indexOf("<", cursor);
    if (opening < 0) break;
    if (xml.startsWith("<!--", opening)) {
      const end = xml.indexOf("-->", opening + 4);
      cursor = end < 0 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", opening)) {
      const end = xml.indexOf("]]>", opening + 9);
      cursor = end < 0 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith("<?", opening) || xml.startsWith("<!", opening)) {
      const end = findMarkupEnd(xml, opening + 2);
      cursor = end < 0 ? xml.length : end + 1;
      continue;
    }
    const end = findMarkupEnd(xml, opening + 1);
    if (end < 0) break;
    const text = xml.slice(opening, end + 1);
    const closing = /^<\s*\//.test(text);
    const match = closing ? text.match(/^<\s*\/\s*([\w.-]+(?::[\w.-]+)?)\s*>$/) : text.match(/^<\s*([\w.-]+(?::[\w.-]+)?)(?=\s|\/|>)/);
    if (match) tokens.push({ kind: closing ? "end" : "start", qName: match[1], text, start: opening, end: end + 1, selfClosing: !closing && /\/\s*>$/.test(text) });
    cursor = end + 1;
  }
  return tokens;
}

function findMarkupEnd(xml: string, start: number): number {
  let quote: "'" | '"' | undefined;
  for (let i = start; i < xml.length; i += 1) {
    const character = xml[i];
    if (quote) {
      if (character === quote) quote = undefined;
    } else if (character === "'" || character === '"') quote = character;
    else if (character === ">") return i;
  }
  return -1;
}

function parseTagAttributes(tag: string): Array<[string, string]> {
  const content = tag.replace(/^<\s*[^\s/>]+/, "").replace(/\/\s*>$/, "").replace(/>$/, "");
  const attributes: Array<[string, string]> = [];
  const pattern = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of content.matchAll(pattern)) attributes.push([match[1], match[2] ?? match[3] ?? ""]);
  return attributes;
}

function validateRequestKey(key: string, model: string, uf: string, cUF: string): string | undefined {
  if (!/^\d{44}$/.test(key) || !isValidAccessKey(key)) return "A chave de acesso deve ter 44 dígitos e dígito verificador válido.";
  if (key.slice(0, 2) !== cUF || key.slice(0, 2) !== (authorityUfCode(uf) ?? "")) return "UF/cUF não corresponde à chave informada.";
  if (key.slice(20, 22) !== model) return "O modelo informado não corresponde à chave de acesso.";
  return undefined;
}

function authorityUfCode(uf: string): string | undefined {
  return {
    RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
    MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
    SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
    SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
  }[uf.toUpperCase()];
}

function isValidAccessKey(key: string): boolean {
  const body = key.slice(0, 43);
  let weight = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const check = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return Number(key[43]) === check;
}

function extractCompatibleAlternativeKey(original: string, reason: string, evidence: ConsultationEvidence[]): string | undefined {
  const candidates = [...new Set(reason.match(/(?<!\d)\d{44}(?!\d)/g) ?? [])];
  if (candidates.length !== 1) return undefined;
  const candidate = candidates[0];
  if (!isValidAccessKey(candidate)) {
    evidence.push(evidenceEntry("response", "ALTERNATIVE_KEY_INVALID", "A chave mencionada na rejeição 613 não passou na validação estrutural."));
    return undefined;
  }
  // Same UF, year/month, issuer, model, series and invoice number. tpEmis and cNF
  // may differ; that difference still identifies a distinct signed document.
  const sameDocumentReference = candidate.slice(0, 34) === original.slice(0, 34);
  if (!sameDocumentReference) {
    evidence.push(evidenceEntry("response", "ALTERNATIVE_KEY_COMPONENT_MISMATCH", "A chave citada em 613 não corresponde aos componentes de referência da chave consultada."));
    return undefined;
  }
  evidence.push(evidenceEntry("response", "ALTERNATIVE_KEY_EXPLICIT", "A rejeição 613 informou explicitamente uma chave alternativa estruturalmente válida."));
  return candidate;
}

function readAttributes(node: XmlNode): Attrs {
  const attributes: Attrs = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("@_")) attributes[key.slice(2)] = decodeXmlEntities(scalarText(value));
  }
  return attributes;
}

function readNamespaces(node: XmlNode): Attrs {
  const namespaces: Attrs = {};
  for (const [key, value] of Object.entries(readAttributes(node))) {
    if (key === "xmlns" || key.startsWith("xmlns:")) namespaces[key] = value;
  }
  return namespaces;
}

function child(node: XmlNode, name: string): XmlValue | undefined {
  const key = Object.keys(node).find((item) => !item.startsWith("@_") && item !== "#text" && localName(item) === name);
  if (!key) return undefined;
  const value = node[key];
  return Array.isArray(value) ? value[0] : value;
}

function childText(node: XmlNode, name: string): string | undefined {
  const value = child(node, name);
  return value === undefined ? undefined : decodeXmlEntities(scalarText(value)).trim();
}

function scalarText(value: XmlValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(scalarText).join("");
  if (typeof value === "object") {
    if (typeof value["#text"] === "string") return value["#text"];
    return Object.entries(value).filter(([key]) => !key.startsWith("@_")).map(([, item]) => scalarText(item)).join("");
  }
  return "";
}

function findNodes(root: XmlValue, name: string, output: XmlValue[] = []): XmlValue[] {
  if (Array.isArray(root)) {
    for (const item of root) findNodes(item, name, output);
    return output;
  }
  if (!root || typeof root !== "object") return output;
  for (const [key, value] of Object.entries(root)) {
    if (key.startsWith("@_") || key === "#text") continue;
    if (localName(key) === name) output.push(...(Array.isArray(value) ? value : [value]));
    else findNodes(value, name, output);
  }
  return output;
}

function asNode(value: XmlValue): XmlNode {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function localName(name: string): string {
  const index = name.lastIndexOf(":");
  return index < 0 ? name : name.slice(index + 1);
}

function prefixName(name: string): string {
  const index = name.indexOf(":");
  return index < 0 ? "" : name.slice(0, index);
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, name: string) => {
    if (name === "amp") return "&";
    if (name === "lt") return "<";
    if (name === "gt") return ">";
    if (name === "quot") return '"';
    if (name === "apos") return "'";
    const number = name.startsWith("#x") ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    if (!Number.isFinite(number) || number < 1 || number > 0x10ffff || (number >= 0xd800 && number <= 0xdfff)) return entity;
    try { return String.fromCodePoint(number); } catch { return entity; }
  });
}

function decodeResponse(body: Buffer): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    const declaration = text.slice(0, 160).match(/^\s*<\?xml[^>]*encoding=["']([^"']+)["']/i)?.[1];
    if (declaration && !/^utf-?8$/i.test(declaration)) throw new ParseFailure("SEFAZ response is not UTF-8");
    return text;
  } catch (error) {
    if (error instanceof ParseFailure) throw error;
    throw new ParseFailure("SEFAZ response is not valid UTF-8");
  }
}

class ParseFailure extends Error {
  constructor(message: string) { super(message); this.name = "ParseFailure"; }
}

function environmentCode(environment: FiscalEnvironment): "1" | "2" {
  return environment === "production" ? "1" : "2";
}

function evidence(
  type: ConsultationEvidence["type"],
  code: string,
  message: string,
  data?: ConsultationEvidence["data"],
): ConsultationEvidence {
  return { type, code, message, observedAt: new Date().toISOString(), ...(data ? { data } : {}) };
}

function evidenceEntry(type: ConsultationEvidence["type"], code: string, message: string): ConsultationEvidence {
  return evidence(type, code, message);
}

function technical(code: SefefTechnicalErrorCode, retryable: boolean, message: string): SefazTechnicalError {
  return { code, retryable, message };
}

type SefefTechnicalErrorCode = SefazTechnicalError["code"];

function failure(
  base: Pick<SefazConsultationResult, "contractVersion" | "queriedAccessKey" | "service" | "authority" | "environment" | "model" | "consultedAt" | "evidence">,
  code: SefazTechnicalError["code"],
  message: string,
  retryable: boolean,
): SefazConsultationResult {
  return {
    ...base,
    success: false,
    technicalError: technical(code, retryable, message),
    errorCode: code,
    evidence: [evidence("service", code, message)],
  };
}

function classifyError(error: unknown): SefazTechnicalError {
  if (error instanceof ParseFailure) return technical("MALFORMED_XML", false, "A resposta SEFAZ não é XML válido ou não está codificada em UTF-8.");
  const code = error instanceof TransportFailure ? error.code : (error as NodeJS.ErrnoException)?.code ?? "";
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") return technical("TIMEOUT", true, "A consulta excedeu o tempo limite.");
  if (code === "RESPONSE_TOO_LARGE") return technical("INVALID_RESPONSE", false, "A resposta excedeu o limite de tamanho configurado.");
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return technical("DNS_ERROR", true, "Não foi possível resolver o endereço oficial da SEFAZ.");
  if (/^(?:ERR_TLS|ERR_SSL|CERT_|EPROTO|UNABLE_TO_VERIFY|SELF_SIGNED)/.test(code)) return technical("TLS_ERROR", false, "A conexão TLS/mTLS com a SEFAZ falhou.");
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "EHOSTUNREACH" || code === "ENETUNREACH") return technical("HTTP_ERROR", true, "Não foi possível estabelecer conexão com a SEFAZ.");
  return technical("UNKNOWN_ERROR", false, "Falha técnica não classificada durante a consulta SEFAZ.");
}
