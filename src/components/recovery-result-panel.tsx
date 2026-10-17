import type { RecoveryResult, RecoveredFileProvenance } from "../types/contracts";
import { Icon } from "./icon";

const recoveryStatuses = ["received", "parsing", "certificate_invalid", "consulting", "alternative_key_found", "authorized_xml_unavailable", "recovered", "rejected", "service_unavailable", "error"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStructuredList(value: unknown): value is Array<{ code: string; severity: "info" | "warning" | "blocking"; message: string }> {
  return Array.isArray(value) && value.every((item) => isRecord(item) &&
    typeof item.code === "string" &&
    (item.severity === "info" || item.severity === "warning" || item.severity === "blocking") &&
    typeof item.message === "string");
}

export function isRecoveryResult(value: unknown): value is RecoveryResult {
  if (!isRecord(value) || value.contractVersion !== "1" ||
    typeof value.status !== "string" || !recoveryStatuses.includes(value.status as typeof recoveryStatuses[number]) ||
    typeof value.diagnosis !== "string" ||
    (value.expiresAt !== undefined && (typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)))) ||
    !isStructuredList(value.warnings) || !Array.isArray(value.diagnostics) ||
    value.diagnostics.some((item) => !isRecord(item) || typeof item.code !== "string" || typeof item.message !== "string" ||
      (item.severity !== "info" && item.severity !== "warning" && item.severity !== "blocking") ||
      (item.evidence !== undefined && (!Array.isArray(item.evidence) || item.evidence.some((evidence) => !isRecord(evidence) ||
        typeof evidence.type !== "string" || typeof evidence.code !== "string" || typeof evidence.message !== "string" || typeof evidence.observedAt !== "string"))))) {
    return false;
  }

  if (value.status === "recovered") {
    const provenance = value.provenance;
    return value.downloadAvailable === true && typeof value.authorizedXml === "string" && value.authorizedXml.length > 0 &&
      isRecord(provenance) &&
      (provenance.source === "original_upload" || provenance.source === "manual_upload" || provenance.source === "sefaz_distribution" || provenance.source === "other_official_source") &&
      typeof provenance.retrievedAt === "string" && typeof provenance.accessKey === "string" &&
      typeof provenance.sha256 === "string" && typeof provenance.signatureValidated === "boolean" &&
      typeof provenance.schemaValidated === "boolean" && typeof provenance.protocolMatched === "boolean";
  }

  return value.downloadAvailable === false && value.authorizedXml === undefined && value.provenance === undefined;
}

export function canDownloadRecovered(result: RecoveryResult | null): result is Extract<RecoveryResult, { status: "recovered" }> {
  return result?.status === "recovered" &&
    result.downloadAvailable === true &&
    result.provenance?.signatureValidated === true && result.provenance?.schemaValidated === true && result.provenance?.protocolMatched === true &&
    (!result.expiresAt || Date.parse(result.expiresAt) > Date.now()) &&
    typeof result.authorizedXml === "string" &&
    result.authorizedXml.length > 0;
}

function sourceLabel(source: RecoveredFileProvenance["source"]) {
  switch (source) {
    case "original_upload": return "Arquivo original enviado";
    case "manual_upload": return "XML autorizado enviado pelo usuário";
    case "sefaz_distribution": return "Distribuição oficial da SEFAZ";
    case "other_official_source": return "Outra fonte oficial";
  }
}

function dateTime(value?: string) {
  if (!value) return "Não informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function booleanLabel(value: boolean) {
  return value ? "Validado" : "Não validado";
}

export function RecoveryResultPanel({ result, onDownload }: { result: RecoveryResult; onDownload: () => void }) {
  const downloadable = canDownloadRecovered(result);
  const consultation = result.consultation;
  const originalKey = result.originalKey ?? result.originalAccessKey ?? consultation?.queriedAccessKey;
  const otherKey = result.authorizedKey ?? result.authorizedAccessKey ?? consultation?.alternativeAccessKey;
  const keyDivergence = Boolean(originalKey && otherKey && originalKey !== otherKey);
  const isUnavailable = result.status === "authorized_xml_unavailable";
  const isRecovered = result.status === "recovered" && downloadable;
  const statusTone = isRecovered ? "green" : isUnavailable ? "red" : keyDivergence ? "amber" : "blue";
  const statusTitle = isRecovered
    ? "Recuperação concluída e validada"
    : isUnavailable
      ? "XML autorizado indisponível"
      : keyDivergence
        ? "Divergência de chave"
        : result.status === "alternative_key_found"
          ? "Chave alternativa localizada"
          : "Diagnóstico da recuperação";
  const statusDescription = isRecovered
    ? "A identidade do documento, a assinatura e o protocolo foram conferidos."
    : isUnavailable
      ? "A consulta não forneceu o XML autorizado correspondente; o download permanece indisponível."
      : keyDivergence
        ? "A chave alternativa representa outro documento assinado e não será combinada ao XML original."
        : "Veja os dados e avisos recebidos para esta operação.";

  return (
    <div className="result-content">
      <div className={`status-banner tone-${statusTone}`}>
        <span className="status-icon"><Icon name={isRecovered ? "check" : isUnavailable || result.status === "rejected" ? "alert" : "info"} /></span>
        <span><strong>{statusTitle}</strong><small>{statusDescription}</small></span>
      </div>

      {keyDivergence && <div className="divergence-card" role="note">
        <span className="divergence-icon"><Icon name="alert" /></span>
        <div><span className="divergence-label">Divergência de chave</span><strong>As chaves identificam documentos diferentes</strong><p>O protocolo de uma chave nunca é associado ao XML assinado com a outra.</p></div>
      </div>}

      <div className="diagnosis-copy"><span className="section-kicker">DIAGNÓSTICO</span><p>{result.diagnosis}</p></div>

      <div className="data-list">
        <div className="data-row"><span>Chave original</span><strong className="mono-value">{originalKey ?? "—"}</strong></div>
        {otherKey && <div className="data-row"><span>{isRecovered ? "Chave autorizada" : "Chave alternativa indicada"}</span><strong className="mono-value">{otherKey}</strong></div>}
        <div className="data-row"><span>Número da nota</span><strong>{result.noteNumber ?? "—"}</strong></div>
        <div className="data-row"><span>Modelo</span><strong>{result.model ?? "—"}</strong></div>
        <div className="data-row"><span>Série</span><strong>{result.series ?? "—"}</strong></div>
        <div className="data-row"><span>cStat SEFAZ</span><strong>{result.cStat ?? consultation?.cStat ?? consultation?.protocol?.cStat ?? "—"}{consultation?.xMotivo ? <em>{consultation.xMotivo}</em> : null}</strong></div>
        <div className="data-row"><span>Protocolo</span><strong className="mono-value">{result.protocolNumber ?? result.protocol?.protocolNumber ?? consultation?.protocol?.protocolNumber ?? "—"}</strong></div>
        <div className="data-row"><span>Autoridade</span><strong>{consultation?.authority ?? "—"}</strong></div>
        <div className="data-row"><span>Ambiente</span><strong>{consultation?.environment === "production" ? "Produção" : consultation?.environment === "homologation" ? "Homologação" : "—"}</strong></div>
        <div className="data-row"><span>Consulta</span><strong>{dateTime(consultation?.consultedAt)}</strong></div>
        {consultation && <div className="data-row"><span>Serviço consultado</span><strong>{consultation.service || "—"}</strong></div>}
      </div>

      {result.warnings.length > 0 && <section className="structured-list warnings-list" aria-label="Avisos da análise">
        <h4>Avisos</h4>
        {result.warnings.map((warning, index) => <div className={`structured-item severity-${warning.severity}`} key={`${warning.code}-${index}`}>
          <span className="severity-label">{warning.severity === "blocking" ? "Bloqueante" : warning.severity === "warning" ? "Atenção" : "Informativo"}</span>
          <div><strong>{warning.code}</strong><p>{warning.message}</p></div>
        </div>)}
      </section>}

      {result.diagnostics.length > 0 && <section className="structured-list diagnostics-list" aria-label="Detalhes do diagnóstico">
        <h4>Detalhes da análise</h4>
        {result.diagnostics.map((diagnostic, index) => <details className={`diagnostic-item severity-${diagnostic.severity}`} key={`${diagnostic.code}-${index}`}>
          <summary><span className="severity-label">{diagnostic.severity === "blocking" ? "Bloqueante" : diagnostic.severity === "warning" ? "Atenção" : "Informativo"}</span><strong>{diagnostic.code}</strong></summary>
          <p>{diagnostic.message}</p>
          {diagnostic.evidence && diagnostic.evidence.length > 0 && <ul className="evidence-list">{diagnostic.evidence.map((evidence, evidenceIndex) => <li key={`${evidence.code}-${evidenceIndex}`}><strong>{evidence.type} · {evidence.code}</strong><span>{evidence.message}</span><small>{dateTime(evidence.observedAt)}</small></li>)}</ul>}
        </details>)}
      </section>}

      {result.provenance && <section className="provenance-card" aria-label="Procedência do XML recuperado">
        <div className="provenance-heading"><Icon name="shield" /><div><strong>Procedência do XML</strong><small>Informações da fonte e validações do arquivo recuperado</small></div></div>
        <div className="provenance-grid">
          <div><span>Fonte</span><strong>{sourceLabel(result.provenance.source)}</strong></div>
          <div><span>Obtido em</span><strong>{dateTime(result.provenance.retrievedAt)}</strong></div>
          <div><span>Serviço / autoridade</span><strong>{[result.provenance.service, result.provenance.authority].filter(Boolean).join(" · ") || "—"}</strong></div>
          <div><span>Chave do arquivo</span><strong className="mono-value">{result.provenance.accessKey}</strong></div>
          <div><span>Assinatura</span><strong>{booleanLabel(result.provenance.signatureValidated)}</strong></div>
          <div><span>Schema XML</span><strong>{booleanLabel(result.provenance.schemaValidated)}</strong></div>
          {result.provenance.schemaProfile && <div><span>Perfil XSD</span><strong>{result.provenance.schemaProfile}</strong></div>}
          {result.expiresAt && <div><span>Resultado disponível até</span><strong>{dateTime(result.expiresAt)}</strong></div>}
          <div><span>Protocolo correspondente</span><strong>{booleanLabel(result.provenance.protocolMatched)}</strong></div>
          <div className="hash-row"><span>SHA-256</span><strong className="mono-value">{result.provenance.sha256}</strong></div>
        </div>
      </section>}

      {consultation?.success === false && <div className="warning-box"><Icon name="alert" /><span>A consulta não confirmou autorização. {consultation.xMotivo ?? "Confira o status e tente novamente mais tarde."}</span></div>}
      {!downloadable
        ? <div className={`no-download${isUnavailable ? " unavailable-download" : ""}`}><Icon name="lock" /><span>{isUnavailable ? "Download indisponível: o XML autorizado correspondente não foi recuperado." : "Download indisponível. Só liberamos o arquivo quando ele corresponde à chave e ao protocolo validados."}</span></div>
        : <button className="button button-download" type="button" onClick={onDownload}><Icon name="download" /> Baixar XML autorizado e validado</button>}
      {!!consultation?.errorCode && <div className="diag-meta"><span>Falha de consulta</span><strong>{consultation.errorCode}</strong></div>}
    </div>
  );
}
