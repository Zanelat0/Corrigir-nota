import { parsePkcs12Locally, CertificateModuleError } from "./index";

process.once("message", (input: { pfx: Buffer; password: string }) => {
  let der: Buffer | undefined;
  try {
    const parsed = parsePkcs12Locally(input.pfx, input.password);
    der = parsed.material.privateKey.export({ format: "der", type: "pkcs8" });
    process.send?.({ ok: true, material: { ...parsed.material, certificate: parsed.material.certificate.toString(), privateKey: der }, warnings: parsed.warnings }, () => { der?.fill(0); process.disconnect(); });
  } catch (error) {
    process.send?.({ ok: false, code: error instanceof CertificateModuleError ? error.code : "INVALID_PKCS12" }, () => process.disconnect());
  } finally { input.pfx.fill(0); input.password = ""; }
});
