export type CnpjRelationship =
  | "same_cnpj"
  | "same_root_different_establishment"
  | "different_root"
  | "missing_certificate_cnpj"
  | "missing_issuer_cnpj"
  | "invalid_cnpj";

export interface CnpjPolicyOptions {
  allowSameRootDifferentEstablishment: boolean;
  allowDifferentRoot: boolean;
  allowMissingCertificateCnpj: boolean;
  allowMissingIssuerCnpj: boolean;
}

export interface CnpjPolicyResult {
  accepted: boolean;
  relationship: CnpjRelationship;
  certificateCnpj?: string;
  issuerCnpj?: string;
  warningCode?: string;
}

export const DEFAULT_CNPJ_POLICY: Readonly<CnpjPolicyOptions> = Object.freeze({
  allowSameRootDifferentEstablishment: true,
  allowDifferentRoot: false,
  allowMissingCertificateCnpj: false,
  allowMissingIssuerCnpj: false,
});

const CNPJ_BODY_LENGTH = 12;
const FIRST_DIGIT_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const SECOND_DIGIT_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

function normalizeCnpj(value: string): string | null {
  const normalized = value.toUpperCase().replace(/[.\-/\s]/g, "");
  return /^[A-Z0-9]{14}$/.test(normalized) ? normalized : null;
}

function cnpjCharacterValue(character: string): number {
  // Regra de CNPJ alfanumérico: valor ASCII do caractere menos 48.
  return character.charCodeAt(0) - 48;
}

function calculateDigit(base: string, weights: readonly number[]): number {
  const sum = [...base].reduce((total, character, index) => total + cnpjCharacterValue(character) * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeCnpj(value);
  if (!cnpj || /^(.)\1{13}$/.test(cnpj)) return false;

  const firstDigit = calculateDigit(cnpj.slice(0, CNPJ_BODY_LENGTH), FIRST_DIGIT_WEIGHTS);
  const secondDigit = calculateDigit(cnpj.slice(0, CNPJ_BODY_LENGTH + 1), SECOND_DIGIT_WEIGHTS);
  return cnpj.slice(CNPJ_BODY_LENGTH) === `${firstDigit}${secondDigit}`;
}

export function evaluateCnpjRelationship(
  certificateCnpj: string | undefined,
  issuerCnpj: string | undefined,
  options: CnpjPolicyOptions = DEFAULT_CNPJ_POLICY,
): CnpjPolicyResult {
  if (!certificateCnpj) {
    return {
      accepted: options.allowMissingCertificateCnpj,
      relationship: "missing_certificate_cnpj",
      issuerCnpj,
      warningCode: "CERTIFICATE_CNPJ_UNAVAILABLE",
    };
  }
  if (!issuerCnpj) {
    return {
      accepted: options.allowMissingIssuerCnpj,
      relationship: "missing_issuer_cnpj",
      certificateCnpj,
      warningCode: "ISSUER_CNPJ_UNAVAILABLE",
    };
  }

  const normalizedCertificate = normalizeCnpj(certificateCnpj);
  const normalizedIssuer = normalizeCnpj(issuerCnpj);
  if (!normalizedCertificate || !normalizedIssuer || !isValidCnpj(normalizedCertificate) || !isValidCnpj(normalizedIssuer)) {
    return {
      accepted: false,
      relationship: "invalid_cnpj",
      certificateCnpj: normalizedCertificate ?? certificateCnpj,
      issuerCnpj: normalizedIssuer ?? issuerCnpj,
      warningCode: "CNPJ_FORMAT_OR_CHECK_DIGIT_INVALID",
    };
  }

  if (normalizedCertificate === normalizedIssuer) {
    return {
      accepted: true,
      relationship: "same_cnpj",
      certificateCnpj: normalizedCertificate,
      issuerCnpj: normalizedIssuer,
    };
  }

  if (normalizedCertificate.slice(0, 8) === normalizedIssuer.slice(0, 8)) {
    return {
      accepted: options.allowSameRootDifferentEstablishment,
      relationship: "same_root_different_establishment",
      certificateCnpj: normalizedCertificate,
      issuerCnpj: normalizedIssuer,
      warningCode: "CNPJ_ESTABLISHMENT_MISMATCH",
    };
  }

  return {
    accepted: options.allowDifferentRoot,
    relationship: "different_root",
    certificateCnpj: normalizedCertificate,
    issuerCnpj: normalizedIssuer,
    warningCode: "CNPJ_ROOT_MISMATCH",
  };
}
