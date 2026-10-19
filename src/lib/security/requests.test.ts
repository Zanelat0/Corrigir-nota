import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdmissionController, decodeLimitedBase64, protectSensitivePost, readSensitiveJson } from "./requests";
import { assertXmlLimits } from "../nfe/xml";
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("H: request and XML resource limits", () => {
  it("allows HTTP production build only in explicit loopback mode and releases the slot after failure", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("CORRIGIR_NOTA_LOCAL_ONLY", "true"); vi.stubEnv("TRUST_PROXY", "false");
    const request = () => new Request("http://127.0.0.1:3000/api/test", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "sec-fetch-site": "same-origin" } });
    expect((await protectSensitivePost(request(), async () => { throw new Error("secret"); })).status).toBe(500);
    const response = await protectSensitivePost(request(), async () => Response.json({ ok: true }));
    expect(response.status).toBe(200);
  });
  it.each([
    { host: "attacker.invalid:3000" }, { origin: "https://attacker.invalid" },
    { origin: "null" }, { origin: "http://127.0.0.1:4000" }, { "sec-fetch-site": "cross-site" },
    { "sec-fetch-site": "same-site" },
  ])("blocks DNS rebinding and cross-origin local API calls: %j", async (headers) => {
    vi.stubEnv("CORRIGIR_NOTA_LOCAL_ONLY", "true"); vi.stubEnv("TRUST_PROXY", "false");
    const handler = vi.fn();
    const requestHeaders = new Headers();
    for (const [name, value] of Object.entries(headers)) if (value) requestHeaders.set(name, value);
    const response = await protectSensitivePost(new Request("http://127.0.0.1:3000/api/test", { headers: requestHeaders }), handler);
    expect(response.status).toBe(403); expect(handler).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects LAN addresses and proxy mode in local-only mode", async () => {
    vi.stubEnv("CORRIGIR_NOTA_LOCAL_ONLY", "true"); vi.stubEnv("TRUST_PROXY", "false");
    const handler = vi.fn();
    expect((await protectSensitivePost(new Request("http://192.168.1.2:3000"), handler)).status).toBe(403);
    vi.stubEnv("TRUST_PROXY", "true");
    expect((await protectSensitivePost(new Request("http://localhost:3000"), handler)).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it("accepts Next's localhost normalization only for a loopback Host and its exact origin/port", async () => {
    vi.stubEnv("CORRIGIR_NOTA_LOCAL_ONLY", "true"); vi.stubEnv("TRUST_PROXY", "false");
    const headers = { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" };
    expect((await protectSensitivePost(new Request("http://localhost:3000/api/test", { headers }), async () => Response.json({ ok: true }))).status).toBe(200);
    expect((await protectSensitivePost(new Request("http://localhost:3000/api/test", { headers: { ...headers, host: "127.0.0.1:4000" } }), async () => Response.json({ ok: true }))).status).toBe(403);
  });
  it("bounds simultaneous work and releases each slot only once", () => {
    const acquire = createAdmissionController();
    const first = acquire("a", 0); const second = acquire("b", 0);
    expect(first.admitted && second.admitted).toBe(true); expect(acquire("c", 0).admitted).toBe(false);
    first.release(); first.release();
    const third = acquire("c", 0); expect(third.admitted).toBe(true); expect(acquire("d", 0).admitted).toBe(false);
    second.release(); third.release();
  });
  it("enforces client windows and expiration", () => {
    const acquire = createAdmissionController({ maxConcurrent: 2, perClient: 1, global: 3, windowMs: 1000, maxClients: 2 });
    acquire("a", 0).release(); expect(acquire("a", 100).admitted).toBe(false);
    expect(acquire("a", 1001).admitted).toBe(true);
  });
  it("limits the number of retained client entries", () => {
    const acquire = createAdmissionController({ maxConcurrent: 2, perClient: 2, global: 10, windowMs: 1000, maxClients: 1 });
    acquire("a", 0).release(); expect(acquire("b", 0).admitted).toBe(false);
  });
  it("rejects declared and streamed body sizes before parsing", async () => {
    const request = new Request("https://local.test", { method: "POST", headers: { "content-type": "application/json", "content-length": "1000" }, body: "{}" });
    await expect(readSensitiveJson(request, 10)).rejects.toMatchObject({ status: 413 });
    const streamed = new Request("https://local.test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ large: "a".repeat(100) }) });
    await expect(readSensitiveJson(streamed, 10)).rejects.toMatchObject({ status: 413 });
  });
  it("rejects null/array JSON envelopes and invalid base64", async () => {
    for (const body of ["null", "[]"]) await expect(readSensitiveJson(new Request("https://local.test", { method: "POST", body, headers: { "content-type": "application/json" } }), 1024)).rejects.toMatchObject({ status: 400 });
    expect(() => decodeLimitedBase64("not-base64", 1024, "XML")).toThrow();
    expect(() => decodeLimitedBase64(Buffer.alloc(20).toString("base64"), 10, "XML")).toThrow();
  });
  it("bounds body upload duration", async () => {
    vi.useFakeTimers();
    const request = new Request("https://local.test", { method: "POST", headers: { "content-type": "application/json" }, body: new ReadableStream(), duplex: "half" } as RequestInit);
    const pending = expect(readSensitiveJson(request, 1024)).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(5001); await pending;
  });
  it("reports a broken upload stream without exposing its error text", async () => {
    const request = new Request("https://local.test", { method: "POST", headers: { "content-type": "application/json" }, body: new ReadableStream({ start(c) { c.error(new Error("SECRET FISCAL CONTENT")); } }), duplex: "half" } as RequestInit);
    await expect(readSensitiveJson(request, 1024)).rejects.toMatchObject({ message: "O corpo deve conter um objeto JSON UTF-8 válido." });
  });
  it("ignores forged HTTPS proxy headers unless proxy trust is explicitly configured", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("TRUST_PROXY", "false");
    const handler = vi.fn(); const response = await protectSensitivePost(new Request("http://local.test", { headers: { "x-forwarded-proto": "https" } }), handler);
    expect(response.status).toBe(400); expect(handler).not.toHaveBeenCalled();
  });
  it("rejects deep XML, excessive elements and DTD/entity expansion before recursive parsing", () => {
    expect(() => assertXmlLimits("<a>".repeat(65) + "</a>".repeat(65))).toThrow();
    expect(() => assertXmlLimits("<a>" + "<x/>".repeat(60_001) + "</a>")).toThrow();
    expect(() => assertXmlLimits('<!DOCTYPE a [<!ENTITY x SYSTEM "https://invalid.test/">]><a>&x;</a>')).toThrow();
  });
});
