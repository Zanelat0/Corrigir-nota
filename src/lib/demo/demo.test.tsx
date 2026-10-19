import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { localDemoAvailable } from "./availability";
import { demoScenarios, executeDemo } from "./scenarios";
import { DemoWorkspace, DemoModeShell } from "../../components/demo-mode-shell";
import { isRecoveryResult, RecoveryResultPanel, canDownloadRecovered } from "../../components/recovery-result-panel";
import type { RecoveryResult } from "../../types/contracts";
afterEach(() => vi.unstubAllEnvs());

describe("Demo gated to opt-in local development", () => {
  it.each(["production", "test", ""])("cannot be enabled in %s even with flags true", (environment) => {
    vi.stubEnv("NODE_ENV", environment); vi.stubEnv("ENABLE_LOCAL_DEMO", "true"); vi.stubEnv("CORRIGIR_NOTA_LOCAL_ONLY", "true");
    expect(localDemoAvailable("127.0.0.1:3000")).toBe(false);
  });
  it("requires opt-in, loopback mode/host and no proxy", () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("CORRIGIR_NOTA_LOCAL_ONLY", "true"); vi.stubEnv("ENABLE_LOCAL_DEMO", "false"); vi.stubEnv("TRUST_PROXY", "false");
    expect(localDemoAvailable("127.0.0.1:3000")).toBe(false);
    vi.stubEnv("ENABLE_LOCAL_DEMO", "true");
    expect(localDemoAvailable("127.0.0.1:3000")).toBe(true);
    expect(localDemoAvailable("localhost:3000")).toBe(true);
    for (const host of [null, "192.168.1.2:3000", "attacker.invalid", "localhost.attacker.invalid", "user@localhost:3000", "localhost:3000/path"]) expect(localDemoAvailable(host)).toBe(false);
    vi.stubEnv("TRUST_PROXY", "true"); expect(localDemoAvailable("localhost:3000")).toBe(false);
    vi.stubEnv("TRUST_PROXY", "false"); vi.stubEnv("CORRIGIR_NOTA_LOCAL_ONLY", "false"); expect(localDemoAvailable("localhost:3000")).toBe(false);
  });
});
describe("Offline fictitious presentation, not fiscal processing", () => {
  it.each(demoScenarios)("renders $id as SIMULAÇÃO without XML or download", ({ id }) => {
    const outcome = executeDemo(id);
    expect(outcome.kind).toBe("simulation"); expect(outcome.result.downloadAvailable).toBe(false);
    expect(outcome.result).not.toHaveProperty("authorizedXml"); expect(outcome.result).not.toHaveProperty("provenance");
    expect(isRecoveryResult(outcome.result)).toBe(false);
    expect(canDownloadRecovered(outcome.result as unknown as RecoveryResult)).toBe(false);
    const html = renderToStaticMarkup(createElement(RecoveryResultPanel, { result: outcome.result, onDownload: vi.fn() }));
    expect(html).toContain("SIMULAÇÃO"); expect(html).not.toContain("Baixar XML autorizado e validado");
    expect(outcome.result.noteNumber).toBe("42");
  });
  it("shows 613 followed by 100 without merging different keys", () => {
    const outcome = executeDemo("alternative");
    expect(outcome.steps[1]).toContain("613"); expect(outcome.steps[2]).toContain("100");
    expect(outcome.result.originalKey).not.toBe(outcome.result.authorizedKey);
    expect(outcome.result.status).toBe("authorized_xml_unavailable");
  });
  it("manual scenario transitions from unavailable to fictitious recovered, never downloadable", () => {
    expect(executeDemo("manual_xml").result.status).toBe("authorized_xml_unavailable");
    const result = executeDemo("manual_xml", true).result;
    expect(result.status).toBe("recovered"); expect(result.downloadAvailable).toBe(false); expect(result).not.toHaveProperty("authorizedXml");
  });
  it("does not call fetch or collect credentials/files", () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("NETWORK FORBIDDEN IN DEMO"));
    try {
      for (const scenario of demoScenarios) executeDemo(scenario.id);
      const html = renderToStaticMarkup(createElement(DemoWorkspace));
      expect(html).toContain("Executar demonstração"); expect(html).toContain("SEM VALIDADE FISCAL");
      expect(html).not.toContain('type="file"'); expect(html).not.toContain('type="password"');
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });
  it("starts with the normal workspace, never a simulation mixed into it", () => {
    const html = renderToStaticMarkup(<DemoModeShell><p>NORMAL_WORKSPACE</p></DemoModeShell>);
    expect(html).toContain("NORMAL_WORKSPACE"); expect(html).not.toContain("Resultado fictício");
  });
});
