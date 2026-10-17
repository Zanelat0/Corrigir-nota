import { createHash } from "node:crypto";
import type {
  CertificateContext,
  ConsultationEvidence,
  FiscalEnvironment,
  ProtocolData,
  PublicProtocolData,
  PublicSefazConsultationResult,
  RecoveryDiagnostic,
  RecoveryResult,
  RecoveryWarning,
  SefazConsultationRequest,
  SefazConsultationResult,
} from "@/types/contracts";
import { authorityFor, consultProtocol } from "../sefaz";
import { evaluateCertificateCnpjForIssuer } from "../certificate";
import { accessKeyParts, extractRawElement, parseNfeXml, protocolMatchesXml, signedNfeDigestValue, uploadedProtocolMatches, verifyNfeSignature, type NfeXmlError } from "./xml";
import { validateFiscalXml, type SchemaValidationResult } from "./schema";

const VERSION = "1" as const;
const nfeNamespace = "http://www.portalfiscal.inf.br/nfe";

export interface RecoveryInput {
  xml: string;
  authorizedXml?: string;
  certificateContext: CertificateContext;
  environment?: FiscalEnvironment;
}

export interface RecoveryDependencies {
  consult: (request: SefazConsultationRequest) => Promise<SefazConsultationResult>;
  signatureVerifier: typeof verifyNfeSignature;
  now: () => Date;
  schemaValidator: (xml: string) => Promise<SchemaValidationResult>;
}

const defaultDependencies: RecoveryDependencies = { consult: consultProtocol, signatureVerifier: verifyNfeSignature, schemaValidator: validateFiscalXml, now: () => new Date() };

function publicProtocol(protocol: ProtocolData | undefined): PublicProtocolData | undefined {
  if (!protocol) return undefined;
  return Object.fromEntries(Object.entries(protocol).filter(([key]) => key !== "originalProtNFeXml")) as PublicProtocolData;
}

function publicConsultation(result: SefazConsultationResult): PublicSefazConsultationResult {
  const { protocol, ...safe } = result;
  return { ...safe, ...(protocol ? { protocol: publicProtocol(protocol) } : {}) };
}

function resultBase(parsed: ReturnType<typeof parseNfeXml>, status: RecoveryResult["status"], diagnosis: string, diagnostics: RecoveryDiagnostic[], warnings: RecoveryWarning[], consultation?: SefazConsultationResult, protocol?: ProtocolData): RecoveryResult {
  const authorizedKey = consultation?.cStat === "100" && consultation.chNFe === protocol?.accessKey &&
    protocol?.cStat === "100" && protocol.accessKey === protocol.infProt.chNFe
    ? protocol.accessKey
    : undefined;
  return {
    contractVersion: VERSION,
    status: status as Exclude<RecoveryResult["status"], "recovered">,
    downloadAvailable: false,
    noteNumber: parsed.noteNumber,
    model: parsed.model,
    series: parsed.series,
    originalKey: parsed.accessKey,
    ...(authorizedKey ? { authorizedKey } : {}),
    ...(authorizedKey && protocol?.protocolNumber ? { protocolNumber: protocol.protocolNumber } : {}),
    cStat: consultation?.cStat,
    originalAccessKey: parsed.accessKey,
    ...(authorizedKey ? { authorizedAccessKey: authorizedKey } : {}),
    ...(consultation ? { consultation: publicConsultation(consultation) } : {}),
    ...(protocol ? { protocol: publicProtocol(protocol) } : {}),
    diagnosis,
    diagnostics,
    warnings,
  };
}

function diagnostic(code: string, message: string, severity: RecoveryDiagnostic["severity"] = "blocking", evidence?: ConsultationEvidence[]): RecoveryDiagnostic {
  return { code, message, severity, ...(evidence ? { evidence } : {}) };
}

function warning(code: string, message: string): RecoveryWarning {
  return { code, message, severity: "warning" };
}

function cnpjMatchesKey(issuerCnpj: string | undefined, keyIssuer: string): boolean {
  return Boolean(issuerCnpj && issuerCnpj.toUpperCase().replace(/[^A-Z0-9]/g, "") === keyIssuer);
}

function derivedEnvironment(tpAmb: string | undefined): FiscalEnvironment | undefined {
  if (tpAmb === "1") return "production";
  if (tpAmb === "2") return "homologation";
  return undefined;
}

function validateDocumentIdentity(parsed: ReturnType<typeof parseNfeXml>): boolean {
  const parts = accessKeyParts(parsed.accessKey);
  const ide = parsed.ide;
  return parsed.infNFeId === `NFe${parsed.accessKey}` &&
    ide.tpEmis === parts.tpEmis && (!ide.cNF || ide.cNF === parts.cNF) && (!ide.cDV || ide.cDV === parsed.accessKey.at(-1)) &&
    (!(ide.dhEmi ?? ide.dEmi) || (ide.dhEmi ?? ide.dEmi)!.slice(2, 7).replace("-", "") === parts.yearMonth) &&
    ide.mod === parts.model && (!ide.serie || String(Number(ide.serie)) === parts.series) &&
    (!ide.nNF || String(Number(ide.nNF)) === parts.noteNumber) &&
    (!ide.cUF || ide.cUF === parts.cUF) && cnpjMatchesKey(parsed.emit.cnpj, parts.issuerCnpj);
}

function validateProtocol(protocol: ProtocolData | undefined, key: string, environment: FiscalEnvironment): protocol is ProtocolData {
  return Boolean(protocol && protocol.accessKey === key && protocol.infProt.chNFe === key && protocol.cStat === "100" &&
    protocol.infProt.cStat === "100" && protocol.infProt.nProt && protocol.protocolNumber === protocol.infProt.nProt &&
    protocol.infProt.digVal &&
    protocol.infProt.tpAmb === (environment === "production" ? "1" : "2") &&
    protocol.originalProtNFeXml && protocolMatchesXml(protocol.originalProtNFeXml, protocol));
}

function protocolsCompatibleAlternative(originalKey: string, alternativeKey: string): boolean {
  if (originalKey === alternativeKey) return false;
  try {
    const original = accessKeyParts(originalKey);
    const alternative = accessKeyParts(alternativeKey);
    return original.cUF === alternative.cUF && original.yearMonth === alternative.yearMonth &&
      original.issuerCnpj === alternative.issuerCnpj && original.model === alternative.model &&
      original.series === alternative.series && original.noteNumber === alternative.noteNumber;
  } catch { return false; }
}

function requestFor(key: string, model: ReturnType<typeof parseNfeXml>["model"], context: CertificateContext, environment: FiscalEnvironment): SefazConsultationRequest {
  const parts = accessKeyParts(key);
  const ufByCode: Record<string, string> = { "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF" };
  const uf = ufByCode[parts.cUF];
  const authority = uf && authorityFor(model, uf);
  if (!uf || !authority) throw new Error("UNSUPPORTED_AUTHORITY");
  return { contractVersion: VERSION, accessKey: key, model, uf, cUF: parts.cUF, authority: authority as SefazConsultationRequest["authority"], environment, certificateContext: context };
}

function unavailableResult(parsed: ReturnType<typeof parseNfeXml>, consultation: SefazConsultationResult, warnings: RecoveryWarning[], reason: string): RecoveryResult {
  return resultBase(parsed, "authorized_xml_unavailable", reason, [diagnostic("XML_AUTORIZADO_INDISPONIVEL", reason, "blocking", consultation.evidence)], warnings, consultation, consultation.protocol);
}

/** Orchestrates protocol consultation and only composes nfeProc for the exact signed key. */
export async function recoverNfe(input: RecoveryInput, overrides: Partial<RecoveryDependencies> = {}): Promise<RecoveryResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const result = await recoverNfeInternal(input, dependencies);
  return { ...result, expiresAt: new Date(dependencies.now().getTime() + 15 * 60_000).toISOString() };
}

async function recoverNfeInternal(input: RecoveryInput, dependencies: RecoveryDependencies): Promise<RecoveryResult> {
  let parsed: ReturnType<typeof parseNfeXml>;
  try {
    parsed = parseNfeXml(input.xml);
  } catch (error) {
    const code = (error as NfeXmlError).code ?? "INVALID_XML";
    throw Object.assign(new Error("O XML não passou pela validação estrutural."), { code });
  }
  const warnings = [...parsed.warnings];
  if (!(dependencies.now().getTime() >= Date.parse(input.certificateContext.validFrom) && dependencies.now().getTime() <= Date.parse(input.certificateContext.validTo))) return resultBase(parsed, "certificate_invalid", "O certificado não está dentro do período de validade.", [diagnostic("CERTIFICATE_EXPIRED_OR_INVALID", "O certificado deve estar válido durante o processamento.")], warnings);
  if (input.certificateContext.trust?.status !== "anchored") warnings.push(warning("CERTIFICATE_CHAIN_NOT_ANCHORED", "A cadeia do A1 não foi vinculada a uma âncora configurada; use somente em testes controlados até concluir essa configuração."));
  if (!validateDocumentIdentity(parsed)) {
    return resultBase(parsed, "rejected", "Os campos assinados do XML não correspondem à chave de acesso.", [diagnostic("DOCUMENT_KEY_MISMATCH", "Identidade da nota divergente entre infNFe, emitente e chave.")], warnings);
  }
  const cnpj = evaluateCertificateCnpjForIssuer(input.certificateContext.certificateCnpj, parsed.emit.cnpj);
  if (!cnpj.accepted) {
    return resultBase(parsed, "certificate_invalid", "O CNPJ do certificado não atende à política de vínculo com o emitente.", [diagnostic(cnpj.warningCode ?? "CERTIFICATE_ISSUER_MISMATCH", "Certificado bloqueado pela política conservadora de vínculo de CNPJ.")], warnings);
  }
  if (cnpj.warningCode) warnings.push(warning(cnpj.warningCode, "O certificado e o emitente possuem estabelecimentos diferentes; a regra configurada permitiu continuar."));
  const environment = input.environment ?? derivedEnvironment(parsed.ide.tpAmb);
  if (!environment) return resultBase(parsed, "rejected", "O ambiente fiscal não pôde ser determinado pelo XML.", [diagnostic("FISCAL_ENVIRONMENT_UNAVAILABLE", "ide/tpAmb precisa identificar produção (1) ou homologação (2).")], warnings);

  let consultation: SefazConsultationResult;
  try {
    consultation = await dependencies.consult(requestFor(parsed.accessKey, parsed.model, input.certificateContext, environment));
  } catch (error) {
    const code = (error as Error).message === "UNSUPPORTED_AUTHORITY" ? "UNSUPPORTED_AUTHORITY" : "UNKNOWN_ERROR";
    return resultBase(parsed, "service_unavailable", "Não foi possível consultar um autorizador SEFAZ configurado para esta chave.", [diagnostic(code, "A consulta oficial não foi concluída.")], warnings);
  }
  if (!consultation.success) return resultBase(parsed, "service_unavailable", consultation.technicalError?.message ?? "A consulta SEFAZ não foi concluída.", [diagnostic(consultation.technicalError?.code ?? "SEFAZ_UNAVAILABLE", consultation.technicalError?.message ?? "Falha técnica na consulta.", "blocking", consultation.evidence)], warnings, consultation);
  if (consultation.cStat === "613") {
    const alternative = consultation.alternativeAccessKey;
    if (!alternative || !protocolsCompatibleAlternative(parsed.accessKey, alternative)) {
      return resultBase(parsed, "rejected", "A rejeição 613 não apresentou uma chave alternativa válida e compatível.", [diagnostic("ALTERNATIVE_KEY_INVALID", "A chave alternativa não corresponde aos componentes fiscais comuns exigidos para uma nova consulta.", "blocking", consultation.evidence)], warnings, consultation);
    }
    warnings.push(warning("ALTERNATIVE_DOCUMENT_KEY", "A SEFAZ indicou outra chave; ela identifica um documento assinado diferente."));
    let alternativeResult: SefazConsultationResult;
    try {
      alternativeResult = await dependencies.consult(requestFor(alternative, parsed.model, input.certificateContext, environment));
    } catch {
      return resultBase(parsed, "service_unavailable", "A consulta da chave alternativa não pôde ser concluída.", [diagnostic("ALTERNATIVE_CONSULTATION_UNAVAILABLE", "Não foi possível consultar a chave alternativa informada pela SEFAZ.", "blocking", consultation.evidence)], warnings, consultation);
    }
    if (!alternativeResult.success) return resultBase(parsed, "service_unavailable", alternativeResult.technicalError?.message ?? "A consulta da chave alternativa falhou.", [diagnostic(alternativeResult.technicalError?.code ?? "SEFAZ_UNAVAILABLE", alternativeResult.technicalError?.message ?? "Falha técnica na consulta alternativa.", "blocking", alternativeResult.evidence)], warnings, alternativeResult);
    if (alternativeResult.cStat !== "100" || alternativeResult.chNFe !== alternative || !validateProtocol(alternativeResult.protocol, alternative, environment)) {
      return resultBase(parsed, "rejected", "A chave alternativa não apresentou protocolo 100 íntegro e correspondente.", [diagnostic("ALTERNATIVE_PROTOCOL_MISMATCH", "cStat 100 isolado não comprova que o protocolo pertença à chave alternativa consultada.", "blocking", alternativeResult.evidence)], warnings, alternativeResult, alternativeResult.protocol);
    }
    if (!input.authorizedXml) return unavailableResult(parsed, alternativeResult, warnings, "A nota autorizada possui chave diferente. Recupere o XML assinado por um canal oficial e envie o arquivo correspondente para validação.");
    return completeRecovery(input, parsed, alternativeResult, warnings, dependencies);
  }

  if (consultation.cStat !== "100" || consultation.chNFe !== parsed.accessKey || !validateProtocol(consultation.protocol, parsed.accessKey, environment)) {
    return resultBase(parsed, "rejected", "A consulta não comprovou protocolo de autorização correspondente ao XML enviado.", [diagnostic("AUTHORIZED_PROTOCOL_MISMATCH", "A chave do protocolo deve ser idêntica à chave assinada e o cStat deve ser 100.", "blocking", consultation.evidence)], warnings, consultation, consultation.protocol);
  }
  return completeRecovery(input, parsed, consultation, warnings, dependencies);
}

async function completeRecovery(input: RecoveryInput, original: ReturnType<typeof parseNfeXml>, consultation: SefazConsultationResult, warnings: RecoveryWarning[], dependencies: RecoveryDependencies): Promise<RecoveryResult> {
  const candidateXml = input.authorizedXml ?? input.xml;
  let parsed: ReturnType<typeof parseNfeXml>;
  try { parsed = parseNfeXml(candidateXml); } catch {
    return resultBase(original, "rejected", "O XML autorizado enviado não passou pela análise estrutural.", [diagnostic("AUTHORIZED_XML_INVALID", "Envie o documento assinado integral correspondente à chave autorizada.")], warnings, consultation, consultation.protocol);
  }
  const sameIdentity = parsed.model === original.model && parsed.emit.cnpj === original.emit.cnpj &&
    String(Number(parsed.series)) === String(Number(original.series)) && String(Number(parsed.noteNumber)) === String(Number(original.noteNumber));
  if (!validateDocumentIdentity(parsed) || !sameIdentity || parsed.accessKey !== consultation.protocol?.accessKey || parsed.ide.tpAmb !== (consultation.environment === "production" ? "1" : "2")) {
    return resultBase(original, "rejected", "O segundo XML não corresponde à nota e à chave autorizada.", [diagnostic("AUTHORIZED_XML_IDENTITY_MISMATCH", "Chave, emitente, modelo, série, número e ambiente precisam corresponder à consulta oficial e à nota original.")], warnings, consultation, consultation.protocol);
  }
  const protocol = consultation.protocol!;
  if (!uploadedProtocolMatches(candidateXml, protocol)) return resultBase(original, "rejected", "O protocolo contido no arquivo enviado diverge da consulta oficial atual.", [diagnostic("SUBMITTED_PROTOCOL_MISMATCH", "Não é permitido substituir silenciosamente um protocolo incompatível ou ambíguo do arquivo recebido.")], warnings, consultation, protocol);
  const signatureValid = dependencies.signatureVerifier(candidateXml, parsed, input.certificateContext.certificate);
  if (!signatureValid) return resultBase(original, "rejected", "A assinatura XMLDSig não foi validada com o certificado informado.", [diagnostic("XML_SIGNATURE_INVALID", "A integridade criptográfica da assinatura não foi comprovada com o mesmo certificado signatário informado.")], warnings, consultation, consultation.protocol);
  const signedDigest = signedNfeDigestValue(candidateXml, parsed);
  const protocolDigest = protocol.infProt.digVal?.replace(/\s+/g, "");
  if (!signedDigest || signedDigest !== protocolDigest) {
    return resultBase(original, "rejected", "O digest do protocolo não corresponde ao infNFe assinado.", [diagnostic("PROTOCOL_DIGEST_MISMATCH", "infProt/digVal e o DigestValue da referência assinada precisam coincidir.")], warnings, consultation, consultation.protocol);
  }
  const nfeXml = extractRawElement(candidateXml, "NFe");
  const protocolXml = extractRawElement(protocol.originalProtNFeXml, "protNFe");
  if (!nfeXml || !protocolXml) return resultBase(original, "rejected", "Não foi possível preservar os elementos NFe e protNFe originais.", [diagnostic("XML_COMPOSITION_UNSAFE", "A composição foi interrompida para evitar serialização ou reconstrução dos elementos assinados.")], warnings, consultation, consultation.protocol);
  const authorizedXml = `<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="${nfeNamespace}" versao="4.00">${nfeXml}${protocolXml}</nfeProc>`;
  const schema = await dependencies.schemaValidator(authorizedXml);
  if (!schema.valid && ["SCHEMA_CONFIGURATION_ERROR", "SCHEMA_WORKER_EXIT", "XSD_TIMEOUT"].includes(schema.code ?? "")) return resultBase(original, "service_unavailable", "O serviço de validação estrutural está temporariamente indisponível. Nenhum XML foi liberado.", [diagnostic(schema.code!, "A validação XSD não pôde ser concluída por falha técnica.")], warnings, consultation, protocol);
  if (!schema.valid) return resultBase(original, "rejected", "O documento fiscal completo não passou pela validação XSD oficial.", [diagnostic(schema.code ?? "XSD_VALIDATION_FAILED", `Validação bloqueada no perfil ${schema.profile}. Nenhum XML foi liberado.`)], warnings, consultation, protocol);
  // Namespace inheritance in a new wrapper can affect inclusive C14N. Validate the final bytes too.
  if (!dependencies.signatureVerifier(authorizedXml, parsed, input.certificateContext.certificate)) return resultBase(original, "rejected", "A assinatura não permaneceu válida na composição final.", [diagnostic("COMPOSED_SIGNATURE_INVALID", "A composição foi bloqueada para preservar os dados assinados.")], warnings, consultation, protocol);
  const provenance = {
    source: input.authorizedXml ? "manual_upload" as const : "original_upload" as const,
    service: consultation.service,
    authority: String(consultation.authority),
    retrievedAt: dependencies.now().toISOString(),
    accessKey: parsed.accessKey,
    sha256: createHash("sha256").update(authorizedXml, "utf8").digest("hex"),
    signatureValidated: true,
    schemaValidated: true,
    schemaProfile: schema.profile,
    sourceChannelVerified: false,
    protocolMatched: true,
  };
  warnings.push(warning("FISCAL_RULES_AND_REVOCATION_SCOPE", "XSD, assinatura e protocolo foram conferidos. Regras fiscais de negócio e revogação ICP-Brasil não são integralmente reexecutadas por este produto."));
  if (input.authorizedXml) warnings.push(warning("MANUAL_SOURCE_DECLARED_BY_USER", "O segundo XML foi enviado pelo usuário; o canal de obtenção não é atestado pelo sistema."));
  return {
    contractVersion: VERSION,
    status: "recovered",
    downloadAvailable: true,
    authorizedXml,
    provenance,
    noteNumber: parsed.noteNumber,
    model: parsed.model,
    series: parsed.series,
    originalKey: original.accessKey,
    authorizedKey: parsed.accessKey,
    protocolNumber: consultation.protocol.protocolNumber,
    cStat: consultation.cStat,
    originalAccessKey: original.accessKey,
    authorizedAccessKey: parsed.accessKey,
    consultation: publicConsultation(consultation),
    protocol: publicProtocol(consultation.protocol),
    diagnosis: "O XML assinado correspondente e o protocolo autorizado passaram pela validação de identidade, assinatura, digest e XSD oficial registrado.",
    diagnostics: [diagnostic(input.authorizedXml ? "MANUAL_AUTHORIZED_XML_VALIDATED" : "SAME_KEY_RECOVERY_VALIDATED", "A assinatura foi validada com o certificado informado e o protocolo preservado corresponde à mesma chave do arquivo liberado.", "info", consultation.evidence)],
    warnings,
  };
}
