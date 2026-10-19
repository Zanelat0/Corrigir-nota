import {
  createPrivateKey,
  createPublicKey,
  timingSafeEqual,
  X509Certificate,
  type KeyObject,
} from "node:crypto";
import { Agent } from "node:https";
import { fork } from "node:child_process";
import { resolve } from "node:path";
import { configuredCertificateTrust } from "./trust";
import forge from "node-forge";
import type {
  CertificateContext,
  CertificateMaterial,
  CertificateValidationResult,
  RecoveryWarning,
} from "@/types/contracts";
import { evaluateCnpjRelationship, isValidCnpj, type CnpjPolicyResult } from "../nfe/cnpj-policy";

export const MAX_CERTIFICATE_BYTES = 2 * 1024 * 1024;
export const MAX_CERTIFICATE_PASSWORD_LENGTH = 256;
export const CNPJ_ICP_BRASIL_OID = "2.16.76.1.3.3";

type CertificateFailureCode =
  | "INVALID_PKCS12"
  | "INVALID_PASSWORD"
  | "MISSING_PRIVATE_KEY"
  | "CERTIFICATE_KEY_MISMATCH"
  | "CERTIFICATE_EXPIRED"
  | "CERTIFICATE_NOT_YET_VALID"
  | "CERTIFICATE_USAGE_NOT_ALLOWED"
  | "CERTIFICATE_CNPJ_AMBIGUOUS"
  | "CERTIFICATE_CNPJ_INVALID"
  | "CERTIFICATE_PROCESSING_LIMIT"
  | "CERTIFICATE_TRUST_CONFIGURATION"
  | "CERTIFICATE_CHAIN_UNTRUSTED";

export class CertificateModuleError extends Error {
  constructor(readonly code: CertificateFailureCode) {
    super("Não foi possível validar o certificado informado.");
    this.name = "CertificateModuleError";
  }
}

interface ParsedMaterial {
  material: CertificateMaterial;
  warnings: RecoveryWarning[];
}

interface ForgeCertificateLike {
  certificate: forge.pki.Certificate;
  pem: string;
  x509: X509Certificate;
}

const BAG_KEY = forge.pki.oids.keyBag;
const BAG_SHROUDED_KEY = forge.pki.oids.pkcs8ShroudedKeyBag;
const BAG_CERT = forge.pki.oids.certBag;
const CNPJ_RE = /(?:^|[^A-Z0-9])([A-Z0-9]{12}\d{2})(?=$|[^A-Z0-9])/g;

function fail(code: CertificateFailureCode): never {
  throw new CertificateModuleError(code);
}

function bufferToForgeBytes(input: Buffer): string {
  return input.toString("latin1");
}

function rawCnpjCandidates(value: string): string[] {
  const normalized = value.toUpperCase();
  const matches = [...normalized.matchAll(CNPJ_RE)].map((match) => match[1]);
  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z0-9]{12}\d{2}$/.test(compact)) matches.push(compact);
  return [...new Set(matches)].filter(isValidCnpj);
}

function nodeStringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("utf8");
  return undefined;
}

function collectStrings(node: unknown, output: string[], depth = 0): void {
  if (depth > 12 || !node || typeof node !== "object") return;
  const candidate = node as { type?: number; value?: unknown };
  const value = nodeStringValue(candidate.value);
  if (value && [forge.asn1.Type.UTF8, forge.asn1.Type.PRINTABLESTRING, forge.asn1.Type.IA5STRING, 20, forge.asn1.Type.BMPSTRING].includes(candidate.type ?? -1)) {
    output.push(candidate.type === forge.asn1.Type.BMPSTRING ? decodeBmpString(value) : value);
    return;
  }
  if (Array.isArray(candidate.value)) {
    for (const child of candidate.value) collectStrings(child, output, depth + 1);
  }
}

function decodeBmpString(value: string): string {
  const bytes = Buffer.from(value, "latin1");
  let result = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    result += String.fromCharCode(bytes.readUInt16BE(index));
  }
  return result;
}

function findCnpjValuesForOid(node: unknown, output: string[], depth = 0): void {
  if (depth > 12 || !node || typeof node !== "object") return;
  const current = node as { type?: number; value?: unknown };
  if (current.type === forge.asn1.Type.SEQUENCE && Array.isArray(current.value)) {
    const children = current.value as unknown[];
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index] as { type?: number; value?: unknown } | undefined;
      if (child?.type !== forge.asn1.Type.OID || typeof child.value !== "string") continue;
      try {
        if (forge.asn1.derToOid(child.value) !== CNPJ_ICP_BRASIL_OID) continue;
      } catch {
        continue;
      }
      const values: string[] = [];
      for (const sibling of children.slice(index + 1)) collectStrings(sibling, values);
      for (const text of values) output.push(...rawCnpjCandidates(text));
    }
  }
  if (Array.isArray(current.value)) {
    for (const child of current.value) findCnpjValuesForOid(child, output, depth + 1);
  }
}

function extractCnpjFromSan(certificate: forge.pki.Certificate): { present: boolean; cnpj?: string } {
  const extension = certificate.getExtension("subjectAltName") as { altNames?: unknown[] } | undefined;
  const values: string[] = [];
  let oidFound = false;
  for (const altName of extension?.altNames ?? []) {
    const name = altName as { type?: number; value?: unknown };
    if (name.type !== 0) continue;
    const root = Array.isArray(name.value)
      ? { type: forge.asn1.Type.SEQUENCE, value: name.value }
      : name.value;
    const before = values.length;
    findCnpjValuesForOid(root, values);
    if (values.length > before) oidFound = true;
    else if (containsOid(root, CNPJ_ICP_BRASIL_OID)) oidFound = true;
  }
  const unique = [...new Set(values)];
  if (unique.length > 1) fail("CERTIFICATE_CNPJ_AMBIGUOUS");
  if (unique.length === 1) return { present: true, cnpj: unique[0] };
  return { present: oidFound };
}

function containsOid(node: unknown, target: string, depth = 0): boolean {
  if (depth > 12 || !node || typeof node !== "object") return false;
  const current = node as { type?: number; value?: unknown };
  if (current.type === forge.asn1.Type.OID && typeof current.value === "string") {
    try {
      if (forge.asn1.derToOid(current.value) === target) return true;
    } catch {
      return false;
    }
  }
  return Array.isArray(current.value) && current.value.some((child) => containsOid(child, target, depth + 1));
}

function extractCnpjFromSubject(certificate: forge.pki.Certificate): string | undefined {
  const candidates: string[] = [];
  for (const field of certificate.subject.attributes) {
    const value = String(field.value ?? "");
    const explicitlyMarked = [...value.toUpperCase().matchAll(/CNPJ\s*[:=]\s*([A-Z0-9./\- ]{14,})/g)]
      .flatMap((match) => rawCnpjCandidates(match[1]));
    candidates.push(...explicitlyMarked);
    if (["serialNumber", "2.5.4.5"].includes(field.type ?? "") || field.shortName?.toUpperCase() === "SERIALNUMBER") {
      candidates.push(...rawCnpjCandidates(value));
    }
  }
  const unique = [...new Set(candidates)];
  if (unique.length > 1) fail("CERTIFICATE_CNPJ_AMBIGUOUS");
  return unique[0];
}

function extractCertificateCnpj(certificate: forge.pki.Certificate): {
  cnpj?: string;
  source: NonNullable<CertificateMaterial["certificateCnpjSource"]>;
} {
  const san = extractCnpjFromSan(certificate);
  if (san.cnpj) return { cnpj: san.cnpj, source: "icp-brasil-oid-2.16.76.1.3.3" };
  if (san.present) fail("CERTIFICATE_CNPJ_INVALID");
  const subjectCnpj = extractCnpjFromSubject(certificate);
  if (subjectCnpj) return { cnpj: subjectCnpj, source: "subject" };
  return { source: "unavailable" };
}

function certBags(pfx: forge.pkcs12.Pkcs12Pfx): forge.pkcs12.Bag[] {
  const bags = pfx.getBags({ bagType: BAG_CERT })[BAG_CERT] ?? [];
  return bags.filter((bag) => bag.cert);
}

function privateKeyBags(pfx: forge.pkcs12.Pkcs12Pfx): forge.pkcs12.Bag[] {
  const keys = [
    ...(pfx.getBags({ bagType: BAG_KEY })[BAG_KEY] ?? []),
    ...(pfx.getBags({ bagType: BAG_SHROUDED_KEY })[BAG_SHROUDED_KEY] ?? []),
  ];
  return keys.filter((bag) => bag.key);
}

function privateKeyObject(key: forge.pki.rsa.PrivateKey): KeyObject {
  const pkcs1 = forge.pki.privateKeyToAsn1(key);
  const pkcs8 = forge.pki.wrapRsaPrivateKey(pkcs1);
  const encoded = forge.asn1.toDer(pkcs8).getBytes();
  const der = Buffer.from(encoded, "latin1");
  try {
    return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  } finally {
    der.fill(0);
  }
}

function equalPublicKeys(left: KeyObject, right: KeyObject): boolean {
  const leftDer = createPublicKey(left).export({ format: "der", type: "spki" });
  const rightDer = right.export({ format: "der", type: "spki" });
  if (!Buffer.isBuffer(leftDer) || !Buffer.isBuffer(rightDer) || leftDer.length !== rightDer.length) return false;
  return timingSafeEqual(leftDer, rightDer);
}

function getCertificateChainPem(leaf: ForgeCertificateLike, others: ForgeCertificateLike[]): string {
  const chain = [leaf];
  const remaining = others.filter((item) => item.x509.fingerprint256 !== leaf.x509.fingerprint256);
  let current = leaf.x509;
  const visited = new Set([current.fingerprint256]);

  while (chain.length <= others.length + 1) {
    const issuer = remaining.find((candidate) =>
      !visited.has(candidate.x509.fingerprint256) &&
      current.checkIssued(candidate.x509) &&
      current.verify(candidate.x509.publicKey),
    );
    if (!issuer) break;
    const issuerFrom = Date.parse(issuer.x509.validFrom);
    const issuerTo = Date.parse(issuer.x509.validTo);
    const issuerUsage = issuer.certificate.getExtension("keyUsage") as { keyCertSign?: boolean } | undefined;
    const basicConstraints = issuer.certificate.getExtension("basicConstraints") as { cA?: boolean } | undefined;
    if (Date.now() < issuerFrom || Date.now() > issuerTo || basicConstraints?.cA !== true || (issuerUsage && issuerUsage.keyCertSign !== true)) break;
    if (issuer.x509.subject === issuer.x509.issuer && issuer.x509.verify(issuer.x509.publicKey)) break;
    chain.push(issuer);
    visited.add(issuer.x509.fingerprint256);
    current = issuer.x509;
  }

  return chain.map((item) => item.pem.trim()).join("\n") + "\n";
}

function assertCertificateUsage(certificate: forge.pki.Certificate): void {
  const keyUsage = certificate.getExtension("keyUsage") as { digitalSignature?: boolean } | undefined;
  if (keyUsage && keyUsage.digitalSignature !== true) fail("CERTIFICATE_USAGE_NOT_ALLOWED");

  const extended = certificate.getExtension("extKeyUsage") as Record<string, boolean> | undefined;
  if (extended && extended.clientAuth !== true && extended["1.3.6.1.5.5.7.3.2"] !== true) {
    fail("CERTIFICATE_USAGE_NOT_ALLOWED");
  }
}

/** Internal worker entry; public API uses a bounded child process. */
export function parsePkcs12Locally(pfxBytes: Buffer, password: string): ParsedMaterial {
  if (!Buffer.isBuffer(pfxBytes) || pfxBytes.length === 0 || pfxBytes.length > MAX_CERTIFICATE_BYTES) {
    fail("INVALID_PKCS12");
  }
  if (typeof password !== "string" || password.length === 0 || password.length > MAX_CERTIFICATE_PASSWORD_LENGTH) {
    fail("INVALID_PASSWORD");
  }

  let asn1Object: forge.asn1.Asn1;
  let pfx: forge.pkcs12.Pkcs12Pfx;
  try {
    asn1Object = forge.asn1.fromDer(bufferToForgeBytes(pfxBytes), true);
    if (asn1Object.type !== forge.asn1.Type.SEQUENCE || !Array.isArray(asn1Object.value) || asn1Object.value.length < 3) {
      fail("INVALID_PKCS12");
    }
    // forge is approved only as a PKCS#12 decoder. Its RSA signature verifier is not used here.
    // Requiring MacData makes password/integrity verification mandatory for uploaded PFX files.
    pfx = forge.pkcs12.pkcs12FromAsn1(asn1Object, true, password);
  } catch (error) {
    if (error instanceof CertificateModuleError) throw error;
    fail("INVALID_PASSWORD");
  }

  const keyBags = privateKeyBags(pfx);
  if (keyBags.length === 0) fail("MISSING_PRIVATE_KEY");
  if (keyBags.length !== 1) fail("INVALID_PKCS12");

  let key: KeyObject;
  try {
    key = privateKeyObject(keyBags[0].key as forge.pki.rsa.PrivateKey);
  } catch {
    fail("INVALID_PKCS12");
  }
  if (key.asymmetricKeyType !== "rsa") fail("INVALID_PKCS12");
  if ((key.asymmetricKeyDetails?.modulusLength ?? 0) > 8192) fail("INVALID_PKCS12");

  const parsedCertificates = certBags(pfx).map((bag) => {
    const certificate = bag.cert!;
    const pem = forge.pki.certificateToPem(certificate);
    return { certificate, pem, x509: new X509Certificate(pem) };
  });
  const matching = parsedCertificates.filter((item) => equalPublicKeys(key, item.x509.publicKey));
  if (matching.length === 0) fail("MISSING_PRIVATE_KEY");
  if (matching.length > 1) fail("INVALID_PKCS12");
  const leaf = matching[0];

  const now = Date.now();
  const validFrom = Date.parse(leaf.x509.validFrom);
  const validTo = Date.parse(leaf.x509.validTo);
  if (!Number.isFinite(validFrom) || !Number.isFinite(validTo)) fail("INVALID_PKCS12");
  if (now < validFrom) fail("CERTIFICATE_NOT_YET_VALID");
  if (now > validTo) fail("CERTIFICATE_EXPIRED");
  const basicConstraints = leaf.certificate.getExtension("basicConstraints") as { cA?: boolean } | undefined;
  if (basicConstraints?.cA === true) fail("CERTIFICATE_USAGE_NOT_ALLOWED");
  assertCertificateUsage(leaf.certificate);

  const identity = extractCertificateCnpj(leaf.certificate);
  const warnings: RecoveryWarning[] = [{
    code: "SEFAZ_AUTHENTICATION_NOT_TESTED",
    severity: "info",
    message: "O certificado foi carregado localmente; esta validação não comprova confiança da cadeia nem autenticação com a SEFAZ.",
  }];
  if (!identity.cnpj) {
    warnings.push({
      code: "CERTIFICATE_CNPJ_UNAVAILABLE",
      severity: "warning",
      message: "O CNPJ do certificado não foi encontrado; a compatibilidade com o emitente não pode ser confirmada.",
    });
  }

  const chainPem = getCertificateChainPem(leaf, parsedCertificates.filter((item) => item !== leaf));
  const material: CertificateMaterial = {
    certificate: leaf.x509,
    privateKey: key,
    clientCertificateChainPem: chainPem,
    ...(identity.cnpj ? { certificateCnpj: identity.cnpj } : {}),
    certificateCnpjSource: identity.source,
    validFrom: leaf.x509.validFrom,
    validTo: leaf.x509.validTo,
  };
  return { material, warnings };
}

async function parsePkcs12(pfx: Buffer, password: string): Promise<ParsedMaterial> {
  if (!Buffer.isBuffer(pfx) || !pfx.length || pfx.length > MAX_CERTIFICATE_BYTES || !password || password.length > MAX_CERTIFICATE_PASSWORD_LENGTH) fail("INVALID_PKCS12");
  return new Promise((resolveParsed, reject) => {
    // Keep this Node child outside Turbopack's worker bundling. Assets are explicitly traced.
    const worker: ReturnType<typeof fork> = Reflect.apply(fork, undefined, [resolve(process.cwd(), ".workers/lib/certificate/worker.js"), [], { serialization: "advanced", stdio: ["ignore", "ignore", "ignore", "ipc"], execArgv: ["--max-old-space-size=96"] }]);
    let settled = false;
    const finish = (result?: ParsedMaterial, code: CertificateFailureCode = "CERTIFICATE_PROCESSING_LIMIT") => { if (settled) return; settled = true; clearTimeout(timer); worker.kill(); if (result) resolveParsed(result); else reject(new CertificateModuleError(code)); };
    const timer = setTimeout(() => finish(), 5000);
    worker.once("message", (data: { ok: boolean; code?: CertificateFailureCode; material?: Omit<CertificateMaterial, "privateKey" | "certificate"> & { privateKey: Buffer; certificate: string }; warnings?: RecoveryWarning[] }) => {
      if (!data.ok || !data.material) return finish(undefined, data.code ?? "INVALID_PKCS12");
      const keyBytes = data.material.privateKey;
      try {
        finish({ material: { ...data.material, certificate: new X509Certificate(data.material.certificate), privateKey: createPrivateKey({ key: keyBytes, format: "der", type: "pkcs8" }) }, warnings: data.warnings ?? [] });
      } catch { finish(undefined, "INVALID_PKCS12"); } finally { keyBytes.fill(0); }
    });
    worker.once("error", () => finish()); worker.once("exit", () => finish());
    worker.send({ pfx, password }, (error) => { if (error) finish(); });
  });
}

function assessTrust(material: CertificateMaterial, warnings: RecoveryWarning[]) {
  // No online revocation checker exists yet: never silently bypass a stricter policy.
  if (process.env.REQUIRE_CERTIFICATE_REVOCATION === "true") fail("CERTIFICATE_TRUST_CONFIGURATION");
  let trust: ReturnType<typeof configuredCertificateTrust>;
  try { trust = configuredCertificateTrust(material.certificate, material.clientCertificateChainPem ?? material.certificate.toString()); }
  catch { fail("CERTIFICATE_TRUST_CONFIGURATION"); }
  const required = process.env.REQUIRE_TRUSTED_CLIENT_CERTIFICATE === "true" || (process.env.NODE_ENV === "production" && process.env.REQUIRE_TRUSTED_CLIENT_CERTIFICATE !== "false");
  if (required && trust.status !== "anchored") fail("CERTIFICATE_CHAIN_UNTRUSTED");
  warnings.push({ code: trust.status === "anchored" ? "CERTIFICATE_REVOCATION_NOT_CHECKED" : "CERTIFICATE_TRUST_NOT_ESTABLISHED", severity: "warning", message: trust.status === "anchored" ? "Assinaturas, datas e vínculo com âncora configurada passaram; políticas PKIX completas e revogação não foram verificadas." : "A cadeia do certificado não foi vinculada a âncora confiável configurada. Uso restrito a testes controlados." });
  return trust;
}

/**
 * Cria o contexto mTLS temporário de uma chamada. O parser PKCS#12 não
 * estabelece confiança na AC emissora; a checagem de cadeia aqui apenas
 * ordena/valida assinaturas de intermediárias com node:crypto. Confiança,
 * revogação e política de autorização dependem de outras verificações.
 */
export async function createCertificateContext(pfx: Buffer, password: string): Promise<CertificateContext> {
  let parsed: ParsedMaterial;
  try {
    parsed = await parsePkcs12(pfx, password);
  } finally {
    pfx.fill(0);
  }
  const { material } = parsed;
  const trust = assessTrust(material, parsed.warnings);
  let privateKey: KeyObject | undefined = material.privateKey;
  let certificate: X509Certificate | undefined = material.certificate;
  let chainPem: string | undefined = material.clientCertificateChainPem;
  const privateKeyPemBuffers = new Map<Agent, Buffer>();
  let disposed = false;
  const agents = new Set<Agent>();
  const certificateCnpj = material.certificateCnpj;
  const certificateCnpjSource = material.certificateCnpjSource;
  const validFrom = material.validFrom;
  const validTo = material.validTo;
  // Do not retain a second reference to the key via the parsed material object.
  material.privateKey = undefined as unknown as KeyObject;

  const context: CertificateContext = {
    trust,
    get certificate(): X509Certificate {
      if (disposed || !certificate) throw new Error("Certificate context has been disposed.");
      return certificate;
    },
    get clientCertificateChainPem(): string | undefined {
      return disposed ? undefined : chainPem;
    },
    certificateCnpj,
    certificateCnpjSource,
    validFrom,
    validTo,
    createHttpsAgent(): Agent {
      const clientCertificate = certificate;
      if (disposed || !privateKey || !clientCertificate) throw new Error("Certificate context has been disposed.");
      const keyPem = Buffer.from(privateKey.export({ format: "pem", type: "pkcs8" }) as string, "utf8");
      const agent = new Agent({
        cert: chainPem ?? clientCertificate.toString(),
        key: keyPem,
        keepAlive: false,
        maxSockets: 1,
      });
      agents.add(agent);
      privateKeyPemBuffers.set(agent, keyPem);
      return agent;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const agent of agents) {
        agent.destroy();
        const keyPem = privateKeyPemBuffers.get(agent);
        keyPem?.fill(0);
        const options = (agent as Agent & { options?: Record<string, unknown> }).options;
        if (options) {
          options.key = undefined;
          options.cert = undefined;
        }
      }
      agents.clear();
      privateKeyPemBuffers.clear();
      privateKey = undefined;
      certificate = undefined;
      chainPem = undefined;
    },
  };
  return context;
}

/** Retorna um DTO seguro; falhas nunca incluem texto técnico do parser. */
export async function validateCertificate(pfx: Buffer, password: string): Promise<CertificateValidationResult> {
  try {
    const { material, warnings } = await parsePkcs12(pfx, password);
    const trust = assessTrust(material, warnings);
    return {
      contractVersion: "1",
      valid: true,
      subject: material.certificate.subject,
      issuer: material.certificate.issuer,
      serialNumber: material.certificate.serialNumber,
      validFrom: material.validFrom,
      validTo: material.validTo,
      certificateCnpj: material.certificateCnpj,
      errors: [],
      trust,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (error) {
    if (error instanceof CertificateModuleError && ["CERTIFICATE_PROCESSING_LIMIT", "CERTIFICATE_TRUST_CONFIGURATION"].includes(error.code)) throw error;
    return {
      contractVersion: "1",
      valid: false,
      errors: ["O certificado é inválido, expirado ou não pôde ser carregado com a senha informada."],
    };
  } finally {
    pfx.fill(0);
  }
}

/** Aplica a política compartilhada ao emitente durante o processamento fiscal. */
export function evaluateCertificateCnpjForIssuer(
  certificateCnpj: string | undefined,
  issuerCnpj: string | undefined,
): CnpjPolicyResult {
  return evaluateCnpjRelationship(certificateCnpj, issuerCnpj);
}

/**
 * Libera o Agent e referências de chave mantidas pelo contexto. Não promete
 * apagamento físico dos objetos criptográficos já criados pelo runtime.
 */
export function disposeCertificateContext(context: CertificateContext): void {
  context.dispose();
}
