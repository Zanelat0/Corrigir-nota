import { generateKeyPairSync, X509Certificate } from "node:crypto";
import { describe, expect, it } from "vitest";
import forge from "node-forge";
import { POST as validateRoute } from "../../app/api/certificado/validar/route";
import {
  createCertificateContext,
  evaluateCertificateCnpjForIssuer,
  validateCertificate,
} from "./index";

const TEST_PASSWORD = "fixture-password";
const TEST_CNPJ = "11222333000181";

const generated = generateKeyPairSync("rsa", { modulusLength: 2048 });
const forgePrivateKey = forge.pki.privateKeyFromPem(
  generated.privateKey.export({ format: "pem", type: "pkcs1" }).toString(),
);
const forgePublicKey = forge.pki.publicKeyFromPem(
  generated.publicKey.export({ format: "pem", type: "spki" }).toString(),
);
const generatedIntermediate = generateKeyPairSync("rsa", { modulusLength: 2048 });
const intermediatePrivateKey = forge.pki.privateKeyFromPem(
  generatedIntermediate.privateKey.export({ format: "pem", type: "pkcs1" }).toString(),
);
const intermediatePublicKey = forge.pki.publicKeyFromPem(
  generatedIntermediate.publicKey.export({ format: "pem", type: "spki" }).toString(),
);
const generatedRoot = generateKeyPairSync("rsa", { modulusLength: 2048 });
const rootPrivateKey = forge.pki.privateKeyFromPem(
  generatedRoot.privateKey.export({ format: "pem", type: "pkcs1" }).toString(),
);
const rootPublicKey = forge.pki.publicKeyFromPem(
  generatedRoot.publicKey.export({ format: "pem", type: "spki" }).toString(),
);

function makeCertificate(options: { expired?: boolean; cnpj?: string; oidCnpj?: string; usage?: "client" | "signing" } = {}): forge.pki.Certificate {
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = forgePublicKey;
  certificate.serialNumber = "01";
  const subject = [
    { name: "commonName", value: "Certificado sintético de teste" },
    ...(options.cnpj ? [{ name: "serialNumber", value: `CNPJ: ${options.cnpj}` }] : []),
  ];
  certificate.setSubject(subject);
  certificate.setIssuer(subject);
  certificate.validity.notBefore = options.expired ? new Date("2020-01-01T00:00:00Z") : new Date(Date.now() - 60_000);
  certificate.validity.notAfter = options.expired ? new Date("2021-01-01T00:00:00Z") : new Date(Date.now() + 86_400_000);
  const icpCnpjAltName = options.oidCnpj
    ? forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, forge.asn1.oidToDer("2.16.76.1.3.3").getBytes()),
      forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTF8, false, options.oidCnpj),
      ]),
    ])
    : undefined;
  const san = icpCnpjAltName
    ? forge.asn1.toDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [icpCnpjAltName])).getBytes()
    : undefined;
  certificate.setExtensions([
    { name: "basicConstraints", cA: false },
    { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
    ...(options.usage === "signing" ? [{ name: "extKeyUsage", emailProtection: true }] : [{ name: "extKeyUsage", clientAuth: true }]),
    ...(san ? [{ id: "2.5.29.17", value: san }] : []),
  ]);
  certificate.sign(forgePrivateKey, forge.md.sha256.create());
  return certificate;
}

function makePfx(options: { expired?: boolean; cnpj?: string; oidCnpj?: string; usage?: "client" | "signing"; includePrivateKey?: boolean } = {}): Buffer {
  const certificate = makeCertificate(options);
  const pfx = forge.pkcs12.toPkcs12Asn1(
    options.includePrivateKey === false ? null : forgePrivateKey,
    certificate,
    TEST_PASSWORD,
    { algorithm: "aes256", count: 1000, useMac: true },
  );
  return Buffer.from(forge.asn1.toDer(pfx).getBytes(), "latin1");
}

function makeChainPfx(): Buffer {
  const root = forge.pki.createCertificate();
  root.publicKey = rootPublicKey;
  root.serialNumber = "10";
  root.setSubject([{ name: "commonName", value: "Synthetic Test Root" }]);
  root.setIssuer(root.subject.attributes);
  root.validity.notBefore = new Date(Date.now() - 86_400_000);
  root.validity.notAfter = new Date(Date.now() + 86_400_000);
  root.setExtensions([
    { name: "basicConstraints", cA: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true },
  ]);
  root.sign(rootPrivateKey, forge.md.sha256.create());

  const intermediate = forge.pki.createCertificate();
  intermediate.publicKey = intermediatePublicKey;
  intermediate.serialNumber = "11";
  intermediate.setSubject([{ name: "commonName", value: "Synthetic Test Intermediate" }]);
  intermediate.setIssuer(root.subject.attributes);
  intermediate.validity.notBefore = new Date(Date.now() - 86_400_000);
  intermediate.validity.notAfter = new Date(Date.now() + 86_400_000);
  intermediate.setExtensions([
    { name: "basicConstraints", cA: true, pathLenConstraint: 0 },
    { name: "keyUsage", keyCertSign: true, cRLSign: true },
  ]);
  intermediate.sign(rootPrivateKey, forge.md.sha256.create());

  const leaf = makeCertificate({ cnpj: TEST_CNPJ });
  leaf.setIssuer(intermediate.subject.attributes);
  leaf.sign(intermediatePrivateKey, forge.md.sha256.create());
  const pfx = forge.pkcs12.toPkcs12Asn1(forgePrivateKey, [leaf, root, intermediate], TEST_PASSWORD, {
    algorithm: "aes256",
    count: 1000,
    useMac: true,
  });
  return Buffer.from(forge.asn1.toDer(pfx).getBytes(), "latin1");
}

describe("A1 certificate module (synthetic fixtures only)", () => {
  it("loads a valid PFX with private key and appropriate client certificate", async () => {
    const pfx = makePfx({ cnpj: TEST_CNPJ });
    const result = await validateCertificate(pfx, TEST_PASSWORD);
    expect(result).toMatchObject({ contractVersion: "1", valid: true, errors: [] });
    expect(result.subject).toContain("CNPJ: 11222333000181");
    expect(JSON.stringify(result)).not.toMatch(/privateKey|PRIVATE KEY|password|PFX/i);
    pfx.fill(0);
  });

  it("reports a wrong password as an invalid certificate without technical details", async () => {
    const pfx = makePfx({ cnpj: TEST_CNPJ });
    const result = await validateCertificate(pfx, "wrong-password");
    expect(result.valid).toBe(false);
    expect(JSON.stringify(result)).not.toContain("wrong-password");
    pfx.fill(0);
  });

  it("rejects malformed PKCS#12 bytes", async () => {
    const result = await validateCertificate(Buffer.from("not a PFX"), TEST_PASSWORD);
    expect(result.valid).toBe(false);
  });

  it("rejects an expired certificate", async () => {
    const pfx = makePfx({ expired: true, cnpj: TEST_CNPJ });
    expect((await validateCertificate(pfx, TEST_PASSWORD)).valid).toBe(false);
    pfx.fill(0);
  });

  it("rejects a PFX without a private key", async () => {
    const pfx = makePfx({ cnpj: TEST_CNPJ, includePrivateKey: false });
    expect((await validateCertificate(pfx, TEST_PASSWORD)).valid).toBe(false);
    pfx.fill(0);
  });

  it("warns when the certificate CNPJ is unavailable", async () => {
    const pfx = makePfx();
    const result = await validateCertificate(pfx, TEST_PASSWORD);
    expect(result.valid).toBe(true);
    expect(result.warnings?.map((warning) => warning.code)).toContain("CERTIFICATE_CNPJ_UNAVAILABLE");
    expect(result.warnings?.map((warning) => warning.code)).toContain("SEFAZ_AUTHENTICATION_NOT_TESTED");
    pfx.fill(0);
  });

  it("extracts the ICP-Brasil CNPJ from the subjectAltName otherName OID", async () => {
    const pfx = makePfx({ oidCnpj: TEST_CNPJ });
    const context = await createCertificateContext(pfx, TEST_PASSWORD);
    expect(context.certificateCnpj).toBe(TEST_CNPJ);
    expect(context.certificateCnpjSource).toBe("icp-brasil-oid-2.16.76.1.3.3");
    context.dispose();
    pfx.fill(0);
  });

  it("accepts the current alphanumeric CNPJ format in the ICP-Brasil extension", async () => {
    const pfx = makePfx({ oidCnpj: "00000000E08G12" });
    const context = await createCertificateContext(pfx, TEST_PASSWORD);
    expect(context.certificateCnpj).toBe("00000000E08G12");
    expect(context.certificateCnpjSource).toBe("icp-brasil-oid-2.16.76.1.3.3");
    context.dispose();
  });

  it("rejects a certificate restricted to non-client authentication use", async () => {
    const pfx = makePfx({ cnpj: TEST_CNPJ, usage: "signing" });
    expect((await validateCertificate(pfx, TEST_PASSWORD)).valid).toBe(false);
    pfx.fill(0);
  });

  it("blocks an issuer CNPJ under a different root and allows the approved branch policy", () => {
    expect(evaluateCertificateCnpjForIssuer(TEST_CNPJ, "11444777000161")).toMatchObject({
      accepted: false,
      relationship: "different_root",
      warningCode: "CNPJ_ROOT_MISMATCH",
    });
    expect(evaluateCertificateCnpjForIssuer(TEST_CNPJ, "11222333000262")).toMatchObject({
      accepted: true,
      relationship: "same_root_different_establishment",
      warningCode: "CNPJ_ESTABLISHMENT_MISMATCH",
    });
  });

  it("creates and disposes an ephemeral mTLS Agent idempotently", async () => {
    const pfx = makePfx({ cnpj: TEST_CNPJ });
    const context = await createCertificateContext(pfx, TEST_PASSWORD);
    const agent = context.createHttpsAgent();
    const agentOptions = (agent as typeof agent & { options: Record<string, unknown> }).options;
    expect(agentOptions.ca).toBeUndefined();
    expect(Buffer.isBuffer(agentOptions.key)).toBe(true);
    expect(typeof agentOptions.cert).toBe("string");
    context.dispose();
    context.dispose();
    expect(agentOptions.key).toBeUndefined();
    expect(context.clientCertificateChainPem).toBeUndefined();
    expect(() => context.certificate).toThrow();
    expect(() => context.createHttpsAgent()).toThrow();
    pfx.fill(0);
  });

  it("orders the client chain leaf-first, includes intermediates, and omits the root", async () => {
    const pfx = makeChainPfx();
    const context = await createCertificateContext(pfx, TEST_PASSWORD);
    const chain = context.clientCertificateChainPem ?? "";
    const certificates = [...chain.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)].map((match) => new X509Certificate(match[0]));
    expect(certificates).toHaveLength(2);
    expect(context.certificate.subject).toContain("Certificado sintético de teste");
    expect(certificates[0].subject).toContain("Certificado sintético de teste");
    expect(certificates[1].subject).toContain("Synthetic Test Intermediate");
    context.dispose();
  });

  it("validates a JSON upload and rejects an oversized certificate before parsing", async () => {
    const pfx = makePfx({ cnpj: TEST_CNPJ });
    const successRequest = new Request("http://localhost/api/certificado/validar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contractVersion: "1", certificatePfxBase64: pfx.toString("base64"), password: TEST_PASSWORD }),
    });
    const success = await validateRoute(successRequest);
    expect(success.status).toBe(200);
    expect(success.headers.get("cache-control")).toBe("no-store");
    const oversizedRequest = new Request("http://localhost/api/certificado/validar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contractVersion: "1", certificatePfxBase64: Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64"), password: TEST_PASSWORD }),
    });
    expect((await validateRoute(oversizedRequest)).status).toBe(413);
    pfx.fill(0);
  });
});
