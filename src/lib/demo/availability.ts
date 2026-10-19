/** Server-side gate. NODE_ENV is compiled as production by Next build. Never use NEXT_PUBLIC flags. */
export function localDemoAvailable(host: string | null): boolean {
  if (process.env.NODE_ENV !== "development" || process.env.ENABLE_LOCAL_DEMO !== "true" || process.env.CORRIGIR_NOTA_LOCAL_ONLY !== "true" || process.env.TRUST_PROXY === "true" || !host) return false;
  try { const url = new URL(`http://${host}`); return ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && url.host === host && url.pathname === "/"; }
  catch { return false; }
}
