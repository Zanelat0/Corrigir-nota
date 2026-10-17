import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import type { CertificateTrustAssessment } from "../../types/contracts";

/** Partial path validation. Does not claim complete RFC 5280 policies/pathLen/CRL/OCSP checks. */
export function assessCertificateChain(leaf: X509Certificate, chainPem: string, roots: X509Certificate[], now = Date.now()): CertificateTrustAssessment {
  const base = { scope: "signatures_dates_ca_flags_anchor" as const, revocationChecked: false as const };
  if (!roots.length) return { ...base, status: "not_configured" };
  const valid = (cert: X509Certificate) => now >= Date.parse(cert.validFrom) && now <= Date.parse(cert.validTo);
  const chain = [...chainPem.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)].map((m) => new X509Certificate(m[0]));
  if (chain.length > 12 || roots.length > 64) return { ...base, status: "untrusted" };
  const trusted = new Set(roots.map((c) => c.fingerprint256));
  let visits = 0;
  const visit = (current: X509Certificate, seen: Set<string>): X509Certificate | undefined => {
    if (++visits > 128 || !valid(current) || seen.size > 8 || seen.has(current.fingerprint256)) return;
    if (trusted.has(current.fingerprint256) && current.ca && current.verify(current.publicKey)) return current;
    const next = new Set([...seen, current.fingerprint256]);
    for (const issuer of [...roots, ...chain]) {
      if (issuer.ca && valid(issuer) && current.checkIssued(issuer) && current.verify(issuer.publicKey)) {
        const anchor = visit(issuer, next); if (anchor) return anchor;
      }
    }
  };
  const anchor = visit(leaf, new Set());
  return { ...base, status: anchor ? "anchored" : "untrusted", ...(anchor ? { anchorFingerprint256: anchor.fingerprint256 } : {}) };
}
export function configuredCertificateTrust(leaf: X509Certificate, chainPem: string): CertificateTrustAssessment {
  const path = process.env.ICP_BRASIL_TRUST_ROOTS_FILE;
  const pem = path ? readFileSync(path, "utf8") : "";
  if (Buffer.byteLength(pem) > 256 * 1024) throw new Error("Invalid trust configuration");
  const roots = [...pem.matchAll(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)].map((m) => new X509Certificate(m[0]));
  if (path && !roots.length) throw new Error("Empty trust configuration");
  return assessCertificateChain(leaf, chainPem, roots);
}
