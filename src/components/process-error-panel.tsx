import { Icon } from "./icon";

export type ApiFailure = { code: string; message: string; retryable?: boolean; requestId?: string };

export function ProcessErrorPanel({ failure }: { failure: ApiFailure }) {
  const network = failure.code === "NETWORK_ERROR";
  const notReady = failure.code === "PROCESSOR_NOT_READY";
  return (
    <div className="diagnosis-card diagnosis-error" role="alert">
      <span className="diagnosis-icon"><Icon name={network ? "external" : "alert"} /></span>
      <span className="section-kicker">NÃO FOI POSSÍVEL CONCLUIR</span>
      <h4>{notReady ? "Processamento ainda não disponível" : network ? "Falha de conexão" : "Análise interrompida"}</h4>
      <p>{failure.message}</p>
      <div className="diag-meta"><span>Referência</span><strong>{failure.requestId ?? failure.code}</strong></div>
      {failure.retryable && <small className="retry-hint">Você pode tentar novamente após verificar os dados ou a conexão.</small>}
    </div>
  );
}
