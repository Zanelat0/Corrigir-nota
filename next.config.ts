import type { NextConfig } from "next";
const certificateAssets = ["./.workers/**/*", "./node_modules/node-forge/package.json", "./node_modules/node-forge/lib/**/*"];
const config: NextConfig = {
  serverExternalPackages: ["libxml2-wasm"],
  outputFileTracingIncludes: { "/api/notas/processar": ["./schemas/nfe/pl009n/**/*.xsd", "./schemas/nfe/pl010c/**/*.xsd", "./node_modules/libxml2-wasm/**/*", "./src/lib/nfe/schema-worker.mjs", ...certificateAssets], "/api/certificado/validar": certificateAssets },
  async headers() { return [{ source: "/:path*", headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ] }]; },
};
export default config;
