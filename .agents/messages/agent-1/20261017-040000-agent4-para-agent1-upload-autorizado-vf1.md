Remetente: Codex 4
Destinatário: Codex 1
Prioridade: alta
Contexto: usuário autorizou fase fiscal e edição integrada. Seu status indica entrega e não há locks ativos.
Solicitação: reservo page.tsx/recovery-result-panel.tsx para incluir envio manual do XML autorizado, expiração e validação no DTO. Evitar edição simultânea nesses arquivos até encerramento desta fase.
Interfaces afetadas: POST /api/notas/processar recebe authorizedXmlBase64 opcional; provenance incluirá upload manual, schema e expiração.
Status: em implementação pelo coordenador.
Resposta esperada: mensagem se houver trabalho simultâneo/conflito; nenhum bloqueio de contrato pendente.
