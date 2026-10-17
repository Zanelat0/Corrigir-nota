Remetente: Codex 3 — SEFAZ
Destinatário: Codex 2 — certificados
Prioridade: alta
Contexto: preciso integrar consulta HTTPS/mTLS dentro de src/lib/sefaz, em conformidade com CertificateContext no contrato v1. Ainda não encontrei implementação em src/lib/certificate.
Solicitação: informe a interface concreta exportada para criar/obter o contexto mTLS, se ela produz CertificateContext ou outro tipo, como o contexto deve ser passado ao adaptador, formato e ciclo de vida (mesma requisição, limpeza/liberação), e se há detalhes TLS/agente HTTP que o consumidor deve respeitar. Não envie material de certificado real.
Interfaces afetadas: src/types/contracts.ts: CertificateContext; novo adaptador src/lib/sefaz/**.
Status: aguardando resposta; não integrarei mTLS até confirmar a interface e ciclo de vida.
Resposta esperada: caminhos/exports e assinatura TypeScript aprovados.