import { generateKeyPairSync, X509Certificate } from "node:crypto";
import forge from "node-forge";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assessCertificateChain } from "./trust";
import { createCertificateContext } from "./index";
import { syntheticPfx } from "../nfe/testing/synthetic";

const key = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKey = forge.pki.privateKeyFromPem(key.privateKey.export({ format: "pem", type: "pkcs8" }).toString());
const publicKey = forge.pki.publicKeyFromPem(key.publicKey.export({ format: "pem", type: "spki" }).toString());
function fixture(name: string, issuer: string, ca: boolean, expired = false) {
  const cert = forge.pki.createCertificate(); cert.publicKey = publicKey; cert.serialNumber = ca ? "81" : "82";
  cert.setSubject([{ name: "commonName", value: name }]); cert.setIssuer([{ name: "commonName", value: issuer }]);
  cert.validity.notBefore = new Date("2020-01-01"); cert.validity.notAfter = new Date(expired ? "2021-01-01" : "2030-01-01");
  cert.setExtensions([{ name: "basicConstraints", cA: ca }, { name: "keyUsage", keyCertSign: ca, digitalSignature: true }]);
  cert.sign(privateKey, forge.md.sha256.create()); return new X509Certificate(forge.pki.certificateToPem(cert));
}
afterEach(() => vi.unstubAllEnvs());
describe("Explicit anchor validation (synthetic certificates; no complete PKIX/revocation claim)", () => {
  it("checks dates, CA flag, signatures and explicit anchor", () => {
    const root = fixture("Synthetic Root", "Synthetic Root", true); const leaf = fixture("Synthetic Leaf", "Synthetic Root", false);
    expect(assessCertificateChain(leaf, leaf.toString(), [root])).toMatchObject({ status: "anchored", revocationChecked: false, anchorFingerprint256: root.fingerprint256 });
  });
  it("never trusts a root just because the client included it", () => {
    const root = fixture("Synthetic Root", "Synthetic Root", true); const leaf = fixture("Synthetic Leaf", "Synthetic Root", false);
    expect(assessCertificateChain(leaf, leaf.toString() + root.toString(), [])).toMatchObject({ status: "not_configured" });
  });
  it("rejects expired and non-CA anchors", () => {
    const leaf = fixture("Synthetic Leaf", "Synthetic Root", false);
    expect(assessCertificateChain(leaf, "", [fixture("Synthetic Root", "Synthetic Root", true, true)]).status).toBe("untrusted");
    expect(assessCertificateChain(leaf, "", [fixture("Synthetic Root", "Synthetic Root", false)]).status).toBe("untrusted");
  });
  it("blocks automatic use when trust is required but roots were not configured", async () => {
    vi.stubEnv("REQUIRE_TRUSTED_CLIENT_CERTIFICATE", "true"); vi.stubEnv("ICP_BRASIL_TRUST_ROOTS_FILE", "");
    await expect(createCertificateContext(syntheticPfx(), "synthetic-test-password")).rejects.toMatchObject({ code: "CERTIFICATE_CHAIN_UNTRUSTED" });
  });
});
