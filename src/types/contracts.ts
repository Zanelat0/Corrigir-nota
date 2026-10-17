import type { Agent as HttpsAgent } from "node:https";
import type { KeyObject, X509Certificate } from "node:crypto";

export const CONTRACT_VERSION = "1" as const;

export type ContractVersion = typeof CONTRACT_VERSION;
export type FiscalModel = "55" | "65";
export type FiscalEnvironment = "production" | "homologation";

export interface RecoveryWarning {
  code: string;
  severity: "info" | "warning" | "blocking";
  message: string;
}

export interface CertificateValidationResult {
  contractVersion: ContractVersion;
  valid: boolean;
  subject?: string;
  issuer?: string;
  serialNumber?: string;
  validFrom?: string;
  validTo?: string;
  errors: string[];
  warnings?: RecoveryWarning[];
  trust?: CertificateTrustAssessment;
}

export interface CertificateTrustAssessment {
  status: "anchored" | "untrusted" | "not_configured";
  scope: "signatures_dates_ca_flags_anchor";
  revocationChecked: false;
  anchorFingerprint256?: string;
}

/**
 * Contexto por requisição, criado pelo módulo de certificados no runtime Node.
 * A chave privada permanece encapsulada no closure que cria o Agent; não deve
 * ser colocada em DTOs, logs ou respostas HTTP. dispose() destrói o Agent e
 * descarta as referências retidas pelo contexto ao final do processamento.
 */
export interface CertificateContext {
  readonly trust?: CertificateTrustAssessment;
  readonly certificate: X509Certificate;
  readonly clientCertificateChainPem?: string;
  readonly certificateCnpj?: string;
  readonly certificateCnpjSource?: "icp-brasil-oid-2.16.76.1.3.3" | "subject" | "unavailable";
  readonly validFrom: string;
  readonly validTo: string;
  /** Cria/reutiliza um Agent mTLS efêmero. Não altera as CAs confiáveis do servidor. */
  createHttpsAgent(): HttpsAgent;
  /** Destrói Agents mTLS e solta referências de chave/cadeia mantidas pelo contexto. */
  dispose(): void;
}

/** Dados internos usados pelo Codex 2 ao construir CertificateContext. */
export interface CertificateMaterial {
  certificate: X509Certificate;
  privateKey: KeyObject;
  clientCertificateChainPem?: string;
  certificateCnpj?: string;
  certificateCnpjSource?: CertificateContext["certificateCnpjSource"];
  validFrom: string;
  validTo: string;
}

export interface ParsedNfe {
  contractVersion: ContractVersion;
  accessKey: string;
  infNFeId: string;
  model: FiscalModel;
  series?: string;
  noteNumber?: string;
  issuerCnpj?: string;
  ide: {
    tpAmb?: string;
    tpEmis?: string;
    dhEmi?: string;
    dEmi?: string;
    mod?: string;
    serie?: string;
    nNF?: string;
    cUF?: string;
    cNF?: string;
    cDV?: string;
  };
  emit: {
    cnpj?: string;
    cpf?: string;
    name?: string;
  };
  signature: {
    present: boolean;
    valid?: boolean;
    algorithm?: string;
  };
  qrCode?: string;
  xmlWellFormed: boolean;
  warnings: RecoveryWarning[];
}

export type ProtocolInfProtFieldName =
  | "tpAmb"
  | "verAplic"
  | "chNFe"
  | "dhRecbto"
  | "nProt"
  | "digVal"
  | "cStat"
  | "xMotivo"
  | "cMsg"
  | "xMsg"
  | "nRec";

/** Leitura tipada de infProt; additionalFields preserva extensões de schema. */
export interface ProtocolInfProt {
  attributes: Record<string, string>;
  namespaceDeclarations: Record<string, string>;
  Id?: string;
  tpAmb?: string;
  verAplic?: string;
  chNFe?: string;
  dhRecbto?: string;
  nProt?: string;
  digVal?: string;
  cStat?: string;
  xMotivo?: string;
  cMsg?: string;
  xMsg?: string;
  nRec?: string;
  additionalFields: Record<string, string>;
}

/**
 * Representação interna. originalProtNFeXml é a serialização exata recebida
 * da SEFAZ e nunca pode ser exposta no DTO público nem recriada por aproximação.
 */
export interface ProtocolData {
  protocolId?: string;
  protocolVersion?: string;
  attributes: Record<string, string>;
  namespaceDeclarations: Record<string, string>;
  infProt: ProtocolInfProt;
  originalProtNFeXml: string;
  accessKey?: string;
  protocolNumber?: string;
  cStat?: string;
  xMotivo?: string;
  receivedAt?: string;
  environment?: string;
  digest?: string;
}

/** Projeção serializável de ProtocolData, sem o XML oficial bruto. */
export type PublicProtocolData = Omit<ProtocolData, "originalProtNFeXml">;

export type SefazAuthorityId = string & { readonly __brand: "SefazAuthorityId" };

/** Uma única consulta por chave; nenhuma URL é aceita do chamador. */
export interface SefazConsultationRequest {
  contractVersion: ContractVersion;
  accessKey: string;
  model: FiscalModel;
  uf: string;
  cUF: string;
  authority: SefazAuthorityId;
  environment: FiscalEnvironment;
  certificateContext: CertificateContext;
}

export type SefazTechnicalErrorCode =
  | "DNS_ERROR"
  | "TLS_ERROR"
  | "TIMEOUT"
  | "HTTP_ERROR"
  | "SOAP_FAULT"
  | "MALFORMED_XML"
  | "INVALID_RESPONSE"
  | "UNSUPPORTED_AUTHORITY"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN_ERROR";

export interface SefazTechnicalError {
  code: SefazTechnicalErrorCode;
  retryable: boolean;
  message: string;
}

export interface ConsultationEvidence {
  type: "transport" | "service" | "response" | "protocol" | "recovery";
  code: string;
  message: string;
  observedAt: string;
  sha256?: string;
  httpStatus?: number;
  data?: Record<string, string | number | boolean>;
}

/** Resultado interno do adaptador. Uma chamada consulta uma chave. */
export interface SefazConsultationResult {
  contractVersion: ContractVersion;
  queriedAccessKey: string;
  service: string;
  authority: SefazAuthorityId | string;
  environment: FiscalEnvironment;
  model: FiscalModel;
  consultedAt: string;
  success: boolean;
  cStat?: string;
  xMotivo?: string;
  chNFe?: string;
  tpAmb?: string;
  cUF?: string;
  verAplic?: string;
  dhRecbto?: string;
  protocol?: ProtocolData;
  alternativeAccessKey?: string;
  technicalError?: SefazTechnicalError;
  /** Alias temporário para compatibilidade com a UI v1. */
  errorCode?: SefazTechnicalErrorCode;
  evidence: ConsultationEvidence[];
}

/** Projeção pública segura de SefazConsultationResult para RecoveryResult. */
export type PublicSefazConsultationResult = Omit<SefazConsultationResult, "protocol"> & {
  protocol?: PublicProtocolData;
};

export interface RecoveryDiagnostic {
  code: string;
  severity: "info" | "warning" | "blocking";
  message: string;
  evidence?: ConsultationEvidence[];
}

export interface RecoveredFileProvenance {
  source: "original_upload" | "manual_upload" | "sefaz_distribution" | "other_official_source";
  service?: string;
  authority?: string;
  retrievedAt: string;
  accessKey: string;
  sha256: string;
  signatureValidated: boolean;
  schemaValidated: boolean;
  schemaProfile?: string;
  /** Upload manual não comprova por si só o canal de origem. */
  sourceChannelVerified?: boolean;
  protocolMatched: boolean;
}

export type RecoveryStatus =
  | "received"
  | "parsing"
  | "certificate_invalid"
  | "consulting"
  | "alternative_key_found"
  | "authorized_xml_unavailable"
  | "recovered"
  | "rejected"
  | "service_unavailable"
  | "error";

export interface RecoveryResultBase {
  contractVersion: ContractVersion;
  expiresAt?: string;
  noteNumber?: string;
  model?: FiscalModel;
  series?: string;
  originalKey?: string;
  authorizedKey?: string;
  protocolNumber?: string;
  cStat?: string;
  /** Aliases mantidos para compatibilidade com a interface já implementada. */
  originalAccessKey?: string;
  authorizedAccessKey?: string;
  consultation?: PublicSefazConsultationResult;
  protocol?: PublicProtocolData;
  diagnosis: string;
  diagnostics: RecoveryDiagnostic[];
  warnings: RecoveryWarning[];
}

/**
 * A união torna impossível, no contrato TypeScript, indicar download para
 * qualquer estado que não seja recovered e validado com procedência registrada.
 */
export type RecoveryResult = RecoveryResultBase & (
  | {
      status: "recovered";
      downloadAvailable: true;
      authorizedXml: string;
      provenance: RecoveredFileProvenance;
    }
  | {
      status: Exclude<RecoveryStatus, "recovered">;
      downloadAvailable: false;
      authorizedXml?: never;
      provenance?: never;
    }
);

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "CERTIFICATE_INVALID"
  | "INVALID_XML"
  | "RATE_LIMITED"
  | "SEFAZ_UNAVAILABLE"
  | "PROCESSOR_NOT_READY"
  | "INTERNAL_ERROR";

export interface ApiError {
  contractVersion: ContractVersion;
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
  requestId: string;
  details?: Record<string, string | number | boolean>;
}

export interface ApiErrorResponse {
  error: ApiError;
}
