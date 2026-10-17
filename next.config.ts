import type { NextConfig } from "next";
const certificateAssets = ["./.workers/**/*", "./node_modules/node-forge/package.json", "./node_modules/node-forge/lib/**/*"];
const config: NextConfig = {
  serverExternalPackages: ["libxml2-wasm"],
  outputFileTracingIncludes: { "/api/notas/processar": ["./schemas/nfe/pl009n/**/procNFe_v4.00.xsd", "./schemas/nfe/pl010c/**/*", "./node_modules/libxml2-wasm/**/*", "./src/lib/nfe/schema-worker.mjs", ...certificateAssets], "/api/certificado/validar": certificateAssets },
};
export default config;
