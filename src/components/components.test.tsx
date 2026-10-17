import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RecoveryResult } from "../types/contracts";
import { ProcessErrorPanel } from "./process-error-panel";
import { canDownloadRecovered, isRecoveryResult, RecoveryResultPanel } from "./recovery-result-panel";
import { StepIndicator } from "./step-indicator";
import { AuthorizedXmlUpload, canOfferAuthorizedUpload } from "./authorized-xml-upload";

// Fixtures de apresentação para testes locais da UI; não representam respostas reais da SEFAZ.
const recoveredFixture: RecoveryResult = {
  contractVersion: "1",
  status: "recovered",
  downloadAvailable: true,
  authorizedXml: "<nfeProc>fixture</nfeProc>",
  noteNumber: "25743",
  model: "55",
  series: "1",
  originalKey: "42260901867724000108650010000257431536139497",
  authorizedKey: "42260901867724000108650010000257431536139497",
  protocolNumber: "242261498431821",
  cStat: "100",
  diagnosis: "Fixture de teste: documento recuperado e validado.",
  warnings: [{ code: "UI_FIXTURE_INFO", severity: "info", message: "Aviso ilustrativo de teste." }],
  diagnostics: [{
    code: "UI_FIXTURE_DIAG",
    severity: "info",
    message: "Detalhe ilustrativo para testar a expansão do diagnóstico.",
    evidence: [{ type: "recovery", code: "UI_FIXTURE_EVIDENCE", message: "Evidência ilustrativa.", observedAt: "2026-10-17T12:00:00.000Z" }],
  }],
  provenance: {
    source: "sefaz_distribution",
    service: "fixture-service",
    authority: "fixture-authority",
    retrievedAt: "2026-10-17T12:00:00.000Z",
    accessKey: "42260901867724000108650010000257431536139497",
    sha256: "fixture-sha256-not-a-real-document-hash",
    signatureValidated: true,
    schemaValidated: true,
    protocolMatched: true,
  },
};

const unavailableDivergenceFixture: RecoveryResult = {
  contractVersion: "1",
  status: "authorized_xml_unavailable",
  downloadAvailable: false,
  noteNumber: "25743",
  model: "55",
  series: "1",
  originalKey: "42260901867724000108650010000257439594944564",
  authorizedKey: "42260901867724000108650010000257431536139497",
  protocolNumber: "242261498431821",
  cStat: "100",
  diagnosis: "Fixture de teste: a chave indicada é divergente e o XML autorizado não está disponível.",
  warnings: [{ code: "XML_AUTORIZADO_INDISPONIVEL", severity: "blocking", message: "Fixture: XML assinado correspondente indisponível." }],
  diagnostics: [{ code: "CHAVE_DIVERGENTE_FIXTURE", severity: "warning", message: "Fixture: a chave alternativa representa outro documento." }],
};

describe("frontend components", () => {
  it("renders the four-step accessible flow", () => {
    const html = renderToStaticMarkup(createElement(StepIndicator, { current: 2 }));
    expect(html).toContain("aria-label=\"Etapas de recuperação\"");
    expect(html).toContain("aria-current=\"step\"");
    expect(html).toContain("Certificado");
    expect(html).toContain("Resultado");
  });

  it("renders structured result fields, warnings, diagnostics and provenance", () => {
    const html = renderToStaticMarkup(createElement(RecoveryResultPanel, { result: recoveredFixture, onDownload: () => undefined }));
    expect(html).toContain("Recuperação concluída e validada");
    expect(html).toContain("25743");
    expect(html).toContain("Modelo");
    expect(html).toContain("Série");
    expect(html).toContain("UI_FIXTURE_INFO");
    expect(html).toContain("Detalhes da análise");
    expect(html).toContain("Procedência do XML");
    expect(html).toContain("Baixar XML autorizado e validado");
  });

  it("distinguishes divergent keys and unavailable authorized XML without offering download", () => {
    const html = renderToStaticMarkup(createElement(RecoveryResultPanel, { result: unavailableDivergenceFixture, onDownload: () => undefined }));
    expect(html).toContain("XML autorizado indisponível");
    expect(html).toContain("Divergência de chave");
    expect(html).toContain("As chaves identificam documentos diferentes");
    expect(html).toContain("242261498431821");
    expect(html).not.toContain("Baixar XML autorizado e validado");
    expect(html).toContain("Download indisponível");
  });
});

describe("download guard", () => {
  it("blocks expired results and missing validation gates", () => {
    expect(canDownloadRecovered({ ...recoveredFixture, expiresAt: "2000-01-01T00:00:00Z" })).toBe(false);
    expect(canDownloadRecovered({ ...recoveredFixture, provenance: { ...recoveredFixture.provenance!, schemaValidated: false } } as RecoveryResult)).toBe(false);
  });
  it("only allows a recovered result with a non-empty XML payload", () => {
    expect(canDownloadRecovered(recoveredFixture)).toBe(true);
    expect(canDownloadRecovered(unavailableDivergenceFixture)).toBe(false);
    expect(canDownloadRecovered(null)).toBe(false);

    const emptyXml = { ...recoveredFixture, authorizedXml: "" } as unknown as RecoveryResult;
    const missingFlag = { ...recoveredFixture, downloadAvailable: false } as unknown as RecoveryResult;
    const wrongStatus = { ...recoveredFixture, status: "rejected" } as unknown as RecoveryResult;
    expect(canDownloadRecovered(emptyXml)).toBe(false);
    expect(canDownloadRecovered(missingFlag)).toBe(false);
    expect(canDownloadRecovered(wrongStatus)).toBe(false);
  });

  it("rejects API payloads that violate the recovery result union", () => {
    expect(isRecoveryResult(recoveredFixture)).toBe(true);
    expect(isRecoveryResult(unavailableDivergenceFixture)).toBe(true);
    expect(isRecoveryResult({ ...unavailableDivergenceFixture, downloadAvailable: true })).toBe(false);
    expect(isRecoveryResult({ ...recoveredFixture, provenance: undefined })).toBe(false);
    expect(isRecoveryResult({ ...unavailableDivergenceFixture, warnings: [{ code: "X", severity: "unknown", message: "x" }] })).toBe(false);
  });
});

describe("manual authorized XML upload UI", () => {
  it("offers a separate file only for the unavailable authorized XML diagnosis", () => {
    const result = { ...unavailableDivergenceFixture, diagnostics: [{ code: "XML_AUTORIZADO_INDISPONIVEL", message: "Synthetic", severity: "blocking" as const }] };
    expect(canOfferAuthorizedUpload(result)).toBe(true); expect(canOfferAuthorizedUpload(recoveredFixture)).toBe(false);
    const html = renderToStaticMarkup(createElement(AuthorizedXmlUpload, { result, file: null, disabled: false, onSelect() {}, onSubmit() {} }));
    expect(html).toContain("Enviar XML autorizado correspondente"); expect(html).toContain('type="file"'); expect(html).toContain('type="submit" disabled');
  });
  it("accepts the explicit manual provenance without claiming an official transport source", () => {
    const manual = { ...recoveredFixture, provenance: { ...recoveredFixture.provenance!, source: "manual_upload" as const, sourceChannelVerified: false } };
    expect(isRecoveryResult(manual)).toBe(true);
    expect(renderToStaticMarkup(createElement(RecoveryResultPanel, { result: manual, onDownload() {} }))).toContain("XML autorizado enviado pelo usuário");
  });
});

describe("API error presentation", () => {
  it("renders network errors and retry guidance", () => {
    const html = renderToStaticMarkup(createElement(ProcessErrorPanel, { failure: { code: "NETWORK_ERROR", message: "Falha de conexão de teste.", retryable: true } }));
    expect(html).toContain("Falha de conexão");
    expect(html).toContain("Falha de conexão de teste.");
    expect(html).toContain("Você pode tentar novamente");
  });

  it("renders the processor-not-ready state without implying a fiscal result", () => {
    const html = renderToStaticMarkup(createElement(ProcessErrorPanel, { failure: { code: "PROCESSOR_NOT_READY", message: "Fixture de teste: motor ainda não integrado.", requestId: "fixture-request" } }));
    expect(html).toContain("Processamento ainda não disponível");
    expect(html).toContain("fixture-request");
    expect(html).not.toContain("autorizado e validado");
  });
});
