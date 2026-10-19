"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type {
  ApiErrorResponse,
  CertificateValidationResult,
  RecoveryResult,
  RecoveryStatus,
} from "@/types/contracts";
import { Icon } from "@/components/icon";
import { StepIndicator } from "@/components/step-indicator";
import { canDownloadRecovered, isRecoveryResult, RecoveryResultPanel } from "@/components/recovery-result-panel";
import { ProcessErrorPanel, type ApiFailure } from "@/components/process-error-panel";
import { AuthorizedXmlUpload, canOfferAuthorizedUpload } from "@/components/authorized-xml-upload";

function isApiError(value: unknown): value is ApiErrorResponse {
  return typeof value === "object" && value !== null && "error" in value &&
    typeof (value as ApiErrorResponse).error?.message === "string";
}

function safeErrorMessage(message: string, password: string) {
  return password ? message.split(password).join("[oculto]") : message;
}

async function fileAsBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  const encoded = btoa(binary); bytes.fill(0); binary = ""; return encoded;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const statusCopy: Record<RecoveryStatus, { label: string; tone: string }> = {
  received: { label: "Arquivo recebido", tone: "blue" },
  parsing: { label: "Lendo o XML", tone: "blue" },
  certificate_invalid: { label: "Certificado inválido", tone: "red" },
  consulting: { label: "Consultando SEFAZ", tone: "blue" },
  alternative_key_found: { label: "Chave alternativa localizada", tone: "amber" },
  authorized_xml_unavailable: { label: "XML autorizado indisponível", tone: "amber" },
  recovered: { label: "Documento recuperado e validado", tone: "green" },
  rejected: { label: "Documento rejeitado", tone: "red" },
  service_unavailable: { label: "Serviço indisponível", tone: "amber" },
  error: { label: "Não foi possível concluir", tone: "red" },
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

export default function Home() {
  const certificateInput = useRef<HTMLInputElement>(null);
  const xmlInput = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const [certificate, setCertificate] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [certificateResult, setCertificateResult] = useState<CertificateValidationResult | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [certificateError, setCertificateError] = useState<ApiFailure | null>(null);
  const [xml, setXml] = useState<File | null>(null);
  const [authorizedXml, setAuthorizedXml] = useState<File | null>(null);
  const [recovery, setRecovery] = useState<RecoveryResult | null>(null);
  const [processError, setProcessError] = useState<ApiFailure | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processLabel, setProcessLabel] = useState("");
  const [notice, setNotice] = useState("");

  const validCertificate = certificateResult?.valid === true;
  const canProcess = validCertificate && Boolean(xml) && Boolean(certificate) && Boolean(password) && !processing;
  const currentStep = recovery || processError ? 4 : processing || xml ? 3 : validCertificate ? 2 : 1;

  useEffect(() => {
    if (!validCertificate) return;
    const timeout = window.setTimeout(() => {
      activeRequest.current?.abort(); setCertificate(null); setPassword(""); setCertificateResult(null); setXml(null); setAuthorizedXml(null); setRecovery(null); setProcessing(false); setCertificateLoading(false);
      if (certificateInput.current) certificateInput.current.value = "";
      if (xmlInput.current) xmlInput.current.value = "";
      setNotice("Sessão expirada após 15 minutos. Envie os arquivos e o certificado novamente.");
    }, 15 * 60_000);
    return () => window.clearTimeout(timeout);
  }, [validCertificate]);
  useEffect(() => {
    if (!recovery?.expiresAt) return;
    const timeout = window.setTimeout(() => { setRecovery(null); setAuthorizedXml(null); setNotice("O resultado expirou. Consulte novamente para obter um diagnóstico atual."); }, Math.max(0, Date.parse(recovery.expiresAt) - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [recovery?.expiresAt]);
  useEffect(() => () => activeRequest.current?.abort(), []);

  function selectCertificate(event: ChangeEvent<HTMLInputElement>) {
    activeRequest.current?.abort(); setProcessing(false); setCertificateLoading(false); setPassword("");
    const file = event.target.files?.[0] ?? null;
    setCertificate(file);
    setCertificateResult(null);
    setCertificateError(null);
    setRecovery(null);
    setProcessError(null);
    setXml(null);
    setAuthorizedXml(null);
    setNotice("");
    if (xmlInput.current) xmlInput.current.value = "";
  }

  function selectXml(event: ChangeEvent<HTMLInputElement>) {
    activeRequest.current?.abort(); setProcessing(false);
    const file = event.target.files?.[0] ?? null;
    setXml(file);
    setAuthorizedXml(null);
    setRecovery(null);
    setProcessError(null);
    setNotice("");
  }

  async function validateCertificate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!certificate || !password || certificateLoading) return;
    setCertificateLoading(true);
    setCertificateError(null);
    setCertificateResult(null);
    setRecovery(null);
    setProcessError(null);
    const controller = new AbortController(); activeRequest.current?.abort(); activeRequest.current = controller;
    try {
      if (certificate.size > 2 * 1024 * 1024) {
        setCertificateError({ code: "PAYLOAD_TOO_LARGE", message: "O certificado excede o limite de 2 MiB." });
        return;
      }
      if (!/\.(pfx|p12)$/i.test(certificate.name)) {
        setCertificateError({ code: "UNSUPPORTED_FILE_TYPE", message: "Selecione um certificado com extensão .pfx ou .p12." });
        return;
      }
      const certificatePfxBase64 = await fileAsBase64(certificate);
      const response = await fetch("/api/certificado/validar", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractVersion: "1", certificatePfxBase64, password }),
      });
      const data = await readJson(response);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const failure = isApiError(data) ? data.error : null;
        setCertificateError({
          code: failure?.code ?? `HTTP_${response.status}`,
          message: safeErrorMessage(failure?.message ?? "Não foi possível validar o certificado. Tente novamente.", password),
          retryable: failure?.retryable,
          requestId: failure?.requestId,
        });
        return;
      }
      if (!data || typeof data !== "object" || !("valid" in data) || typeof data.valid !== "boolean" || !("errors" in data) || !Array.isArray(data.errors)) {
        setCertificateError({ code: "INVALID_RESPONSE", message: "A resposta de validação não corresponde ao contrato esperado." });
        return;
      }
      const result = data as CertificateValidationResult;
      setCertificateResult({ ...result, errors: result.errors.map((error) => safeErrorMessage(error, password)) });
    } catch {
      if (controller.signal.aborted) return;
      setCertificateError({ code: "NETWORK_ERROR", message: "Falha de conexão ao validar. Verifique sua rede e tente novamente.", retryable: true });
    } finally {
      if (activeRequest.current === controller) setCertificateLoading(false);
    }
  }

  async function processDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canProcess || !xml || !certificate) return;
    setProcessing(true);
    setProcessLabel("Preparando os arquivos para envio…");
    setProcessError(null);
    setRecovery(null);
    const controller = new AbortController(); activeRequest.current?.abort(); activeRequest.current = controller;
    try {
      if (xml.size > 5 * 1024 * 1024) {
        setProcessError({ code: "PAYLOAD_TOO_LARGE", message: "O XML excede o limite de 5 MiB." });
        return;
      }
      if (!/\.xml$/i.test(xml.name)) {
        setProcessError({ code: "UNSUPPORTED_FILE_TYPE", message: "Selecione o arquivo XML original com extensão .xml." });
        return;
      }
      if (authorizedXml && (authorizedXml.size > 5 * 1024 * 1024 || !/\.xml$/i.test(authorizedXml.name))) {
        setProcessError({ code: "INVALID_REQUEST", message: "O XML autorizado deve ter extensão .xml e no máximo 5 MiB." }); return;
      }
      const [xmlBase64, certificatePfxBase64, authorizedXmlBase64] = await Promise.all([fileAsBase64(xml), fileAsBase64(certificate), authorizedXml ? fileAsBase64(authorizedXml) : undefined]);
      setProcessLabel("Aguardando análise no servidor…");
      const response = await fetch("/api/notas/processar", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractVersion: "1", xmlBase64, certificatePfxBase64, password, ...(authorizedXmlBase64 ? { authorizedXmlBase64 } : {}) }),
      });
      const data = await readJson(response);
      if (controller.signal.aborted) return;
      if (!response.ok) {
        const failure = isApiError(data) ? data.error : null;
        setProcessError({
          code: failure?.code ?? `HTTP_${response.status}`,
          message: safeErrorMessage(failure?.message ?? "Não foi possível analisar o documento. Tente novamente.", password),
          retryable: failure?.retryable,
          requestId: failure?.requestId,
        });
        return;
      }
      if (!isRecoveryResult(data) || !Object.hasOwn(statusCopy, data.status)) {
        setProcessError({ code: "INVALID_RESPONSE", message: "A resposta da análise não corresponde ao contrato esperado." });
        return;
      }
      setRecovery({ ...data, diagnosis: safeErrorMessage(data.diagnosis, password) });
    } catch {
      if (controller.signal.aborted) return;
      setProcessError({ code: "NETWORK_ERROR", message: "Falha de conexão durante a análise. Seus arquivos continuam apenas nesta página; tente novamente.", retryable: true });
    } finally {
      if (activeRequest.current === controller) { setProcessing(false); setProcessLabel(""); }
    }
  }

  function downloadAuthorizedXml() {
    if (!canDownloadRecovered(recovery)) return;
    const blob = new Blob([recovery.authorizedXml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${recovery.authorizedKey ?? recovery.authorizedAccessKey ?? "documento-autorizado"}.xml`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function restart() {
    activeRequest.current?.abort();
    setCertificate(null);
    setPassword("");
    setCertificateResult(null);
    setCertificateError(null);
    setXml(null);
    setAuthorizedXml(null);
    setRecovery(null);
    setProcessError(null);
    setProcessing(false);
    setNotice("Sessão encerrada. Envie os arquivos e o certificado novamente para uma nova consulta.");
    if (certificateInput.current) certificateInput.current.value = "";
    if (xmlInput.current) xmlInput.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Corrigir Nota, início">
          <span className="brand-mark"><Icon name="shield" /></span>
          <span className="brand-name">corrigir<span>nota</span><i>.</i></span>
        </a>
        <div className="topbar-right">
          <span className="secure-label"><Icon name="lock" /> Uso pessoal · Localhost</span>
          <span className="topbar-divider" />
          <span className="topbar-help"><a href="#como-funciona">Como utilizar</a></span>
        </div>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> RECUPERAÇÃO FISCAL SEGURA</span>
          <h1>Seu documento fiscal,<br /><span>de volta ao seu controle.</span></h1>
          <p>Consulte a situação da sua NF-e ou NFC-e e recupere o XML autorizado, com a segurança que seus dados fiscais merecem.</p>
          <div className="hero-trust"><span><Icon name="shield" /> Validação em cada etapa</span><span><Icon name="lock" /> Dados temporários</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orb orb-one" /><div className="orb orb-two" />
          <div className="art-card art-card-back"><span className="art-lines" /><span className="art-lines short" /><span className="art-lines" /></div>
          <div className="art-card art-card-front"><span className="art-file"><Icon name="file" /></span><span className="art-tag">XML FISCAL</span><span className="art-lines" /><span className="art-lines short" /><span className="art-check"><Icon name="check" /></span></div>
          <div className="art-badge"><Icon name="shield" /><span>Identidade<br />preservada</span></div>
          <div className="art-dots" />
        </div>
      </section>

      <section className="workspace" aria-labelledby="workspace-title">
        <div className="workspace-heading">
          <div><span className="section-kicker">ÁREA DE TRABALHO</span><h2 id="workspace-title">Recuperar documento</h2></div>
          <span className="privacy-pill"><Icon name="lock" /> Seus dados ficam só nesta operação</span>
        </div>

        <StepIndicator current={currentStep} complete={Boolean(recovery || processError)} />

        {notice && <div className="notice notice-info" role="status"><Icon name="info" /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fechar aviso"><Icon name="close" /></button></div>}

        <div className="work-grid">
          <div className="form-column">
            <section className={`panel certificate-panel${validCertificate ? " panel-complete" : ""}`} aria-labelledby="certificate-heading">
              <div className="panel-heading">
                <span className="panel-icon"><Icon name="key" /></span>
                <div><div className="panel-title-row"><h3 id="certificate-heading">Certificado digital</h3>{validCertificate && <span className="mini-state success"><Icon name="check" /> Válido</span>}</div><p>Use seu certificado A1 para consultar a SEFAZ.</p></div>
              </div>
              <form onSubmit={validateCertificate}>
                <label className="field-label" htmlFor="certificate">Arquivo do certificado <span>Obrigatório</span></label>
                <input ref={certificateInput} id="certificate" className="visually-hidden" type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={selectCertificate} />
                <button className={`file-picker${certificate ? " has-file" : ""}`} type="button" onClick={() => certificateInput.current?.click()} aria-describedby="certificate-hint">
                  <span className="picker-icon"><Icon name={certificate ? "file" : "upload"} /></span>
                  <span className="picker-text"><strong>{certificate?.name ?? "Selecionar arquivo .PFX ou .P12"}</strong><small>{certificate ? `${(certificate.size / 1024).toFixed(0)} KB · A1` : "Clique para buscar no seu dispositivo"}</small></span>
                  <span className="picker-action">Buscar</span>
                </button>
                <span className="field-hint" id="certificate-hint">Até 2 MiB. O arquivo não é armazenado.</span>
                {certificate && <button className="restart-button" type="button" onClick={restart}>Remover certificado e limpar operação</button>}
                <label className="field-label password-label" htmlFor="password">Senha do certificado <span>Obrigatório</span></label>
                <input id="password" className="text-input" type="password" autoComplete="new-password" maxLength={256} value={password} onChange={(event) => { activeRequest.current?.abort(); setProcessing(false); setCertificateLoading(false); setPassword(event.target.value); setCertificateResult(null); setCertificateError(null); setRecovery(null); setAuthorizedXml(null); }} placeholder="Digite a senha do certificado" />
                <button className="button button-primary validate-button" type="submit" disabled={!certificate || !password || certificateLoading}>
                  {certificateLoading ? <><span className="spinner" /> Validando…</> : <>Validar certificado <Icon name="arrow" /></>}
                </button>
              </form>

              {certificateLoading && <div className="inline-loading" role="status"><span className="spinner spinner-small" /> Validando localmente o certificado A1…</div>}
              {certificateError && <div className="inline-alert error-alert" role="alert"><Icon name="alert" /><div><strong>{certificateError.code}</strong><p>{certificateError.message}</p>{certificateError.requestId && <small>Referência: {certificateError.requestId}</small>}</div></div>}
              {certificateResult && <div className={`certificate-result${certificateResult.valid ? " result-valid" : " result-invalid"}`} role="status">
                <div className="result-title"><span className="result-indicator"><Icon name={certificateResult.valid ? "check" : "alert"} /></span><div><strong>{certificateResult.valid ? "Certificado validado" : "Não foi possível validar o certificado"}</strong><small>{certificateResult.valid ? "Validade e leitura local confirmadas." : "Confira o arquivo, a senha e as mensagens abaixo."}</small></div></div>
                {certificateResult.valid && <div className="cert-meta"><div><span>Titular</span><strong>{certificateResult.subject || "Não informado"}</strong></div><div><span>Válido até</span><strong>{formatDate(certificateResult.validTo)}</strong></div><div><span>CNPJ</span><strong>{certificateResult.certificateCnpj || "Não identificado"}</strong></div><div><span>Cadeia</span><strong>{certificateResult.trust?.status === "anchored" ? "Vinculada à âncora configurada (verificação parcial)" : "Confiança não comprovada"}</strong></div></div>}
                {certificateResult.warnings?.map((warning) => <p className="local-only-note" key={warning.code}><Icon name="info" /> {warning.message}</p>)}
                {certificateResult.errors.length > 0 && <ul className="error-list">{certificateResult.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>}
                {certificateResult.valid && <p className="local-only-note"><Icon name="info" /> Esta etapa confirma a validade local do A1. A comunicação e autenticação perante a SEFAZ ainda não foram confirmadas.</p>}
              </div>}
            </section>

            <section className={`panel xml-panel${!validCertificate ? " panel-locked" : ""}`} aria-labelledby="xml-heading">
              <div className="panel-heading">
                <span className="panel-icon"><Icon name="file" /></span>
                <div><div className="panel-title-row"><h3 id="xml-heading">XML original</h3>{xml && <span className="mini-state"><Icon name="check" /> Selecionado</span>}</div><p>Envie o XML original que precisa consultar.</p></div>
                {!validCertificate && <span className="lock-corner" title="Valide o certificado primeiro"><Icon name="lock" /></span>}
              </div>
              <input ref={xmlInput} id="xml-file" className="visually-hidden" type="file" accept=".xml,text/xml,application/xml" disabled={!validCertificate} onChange={selectXml} />
              <button className={`dropzone${xml ? " dropzone-ready" : ""}`} type="button" disabled={!validCertificate || processing} onClick={() => xmlInput.current?.click()} onDragOver={(event) => { if (validCertificate) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); if (validCertificate && !processing) { const file = event.dataTransfer.files?.[0]; if (file) { activeRequest.current?.abort(); setXml(file); setAuthorizedXml(null); setRecovery(null); setProcessError(null); setNotice(""); } } }}>
                <span className="dropzone-icon"><Icon name={xml ? "file" : "upload"} /></span>
                <strong>{xml?.name ?? "Arraste seu XML para cá"}</strong>
                <span>{xml ? `${(xml.size / 1024).toFixed(0)} KB · XML original` : "ou clique para selecionar um arquivo"}</span>
                {!xml && <span className="dropzone-button">Selecionar XML</span>}
              </button>
              <div className="xml-footnote"><Icon name="info" /> {validCertificate ? "Até 5 MiB. O XML original será preservado." : "Valide o certificado para liberar o envio do XML."}</div>
            </section>

            {validCertificate && <form onSubmit={processDocument} className="submit-row">
              {processError && <div className="inline-alert error-alert process-error" role="alert"><Icon name="alert" /><div><strong>{processError.code}</strong><p>{processError.message}</p>{processError.requestId && <small>Referência: {processError.requestId}</small>}</div></div>}
              {processing && <div className="processing-banner" role="status"><span className="spinner" /><span><strong>Análise em andamento</strong><small>{processLabel}</small></span></div>}
              <button className="button button-dark" type="submit" disabled={!canProcess}>
                {processing ? "Analisando documento…" : <>Consultar e analisar <Icon name="arrow" /></>}
              </button>
              <p><Icon name="lock" /> Senha e certificado são enviados somente nesta operação.</p>
            </form>}
          </div>

          <aside className="side-column">
            <section className={`panel result-panel${recovery ? " has-result" : ""}`} aria-labelledby="result-heading" aria-live="polite">
              <div className="result-panel-header"><div><span className="section-kicker">ACOMPANHAMENTO</span><h3 id="result-heading">Análise do documento</h3></div><span className={`live-indicator${processing ? " is-running" : ""}`}><i /> {processing ? "Em análise" : recovery || processError ? "Concluída" : "Aguardando"}</span></div>
              {!recovery && !processError && !processing && <div className="empty-result"><div className="empty-illustration"><span><Icon name="file" /></span><i className="empty-spark"><Icon name="spark" /></i></div><strong>Seu resultado aparecerá aqui</strong><p>Valide o certificado, envie seu XML original e acompanhe a consulta por aqui.</p><div className="empty-checklist"><span><Icon name="check" /> Conferência de identidade do documento</span><span><Icon name="check" /> Consulta de protocolo fiscal</span><span><Icon name="check" /> Diagnóstico claro, sem alterar o XML</span></div></div>}
              {processing && <div className="analysis-progress"><div className="progress-heading"><span className="spinner" /><div><strong>{processLabel || "Analisando documento"}</strong><small>O resultado será exibido assim que a consulta terminar.</small></div></div><div className="progress-track" aria-label="Processamento em andamento"><span /></div><div className="progress-labels"><span>Envio iniciado</span><span>Aguardando servidor</span><span>Resposta</span></div><div className="analysis-note"><Icon name="shield" /> O documento original e sua assinatura são preservados durante a análise.</div></div>}
              {processError && <ProcessErrorPanel failure={processError} />}
              {recovery && <RecoveryResultPanel result={recovery} onDownload={downloadAuthorizedXml} />}
            </section>
            {!processing && (canOfferAuthorizedUpload(recovery) || authorizedXml) && <AuthorizedXmlUpload result={recovery} file={authorizedXml} disabled={!canProcess} onSelect={setAuthorizedXml} onSubmit={processDocument} />}

            {(recovery || processError) && <button className="restart-button" onClick={restart}><Icon name="refresh" /> Encerrar sessão e começar de novo</button>}
            <div className="security-card"><span className="security-card-icon"><Icon name="shield" /></span><div><strong>Integridade fiscal em primeiro lugar</strong><p>Um protocolo só pode acompanhar o documento com a mesma chave e identidade. XMLs diferentes nunca são combinados.</p><a href="#como-funciona">Entenda como protegemos seu documento <Icon name="arrow" /></a></div></div>
            <div className="help-card"><span className="help-icon"><Icon name="info" /></span><div><strong>Por que precisamos do A1?</strong><p>O certificado permite a consulta segura do documento junto à SEFAZ.</p></div></div>
          </aside>
        </div>
      </section>

      <section className="how-section" id="como-funciona"><div className="how-inner"><span className="section-kicker">CLAREZA EM CADA PASSO</span><h2>Como funciona a recuperação</h2><div className="how-grid"><article><span className="how-number">01</span><Icon name="key" /><h3>Valide seu certificado</h3><p>Confirmamos a leitura e a validade do A1. A consulta à SEFAZ acontece na etapa seguinte.</p></article><article><span className="how-number">02</span><Icon name="file" /><h3>Envie o XML original</h3><p>O documento é analisado sem alterações na assinatura ou nos dados originais.</p></article><article><span className="how-number">03</span><Icon name="shield" /><h3>Receba um diagnóstico</h3><p>Só oferecemos download quando o XML autorizado corresponde ao documento validado.</p></article></div></div></section>

      <footer className="footer"><a className="brand footer-brand" href="#inicio"><span className="brand-mark"><Icon name="shield" /></span><span className="brand-name">corrigir<span>nota</span><i>.</i></span></a><span>© 2026 Corrigir Nota · Recuperação segura de documentos fiscais</span><span className="footer-secure"><Icon name="lock" /> Seus dados são temporários</span></footer>
    </main>
  );
}
