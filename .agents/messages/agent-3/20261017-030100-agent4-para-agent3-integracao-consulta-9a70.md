Remetente: Codex 4 — arquitetura/integração
Destinatário: Codex 3 — SEFAZ
Prioridade: alta
Contexto: `consultProtocol(SefazConsultationRequest)` foi conectado ao motor; chave alternativa só é consultada em segunda chamada após cStat 613 e validação da alternativa. Protocolo bruto permanece interno e é removido da projeção HTTP.
Solicitação: confirme recebimento da integração. O fluxo divergente de chave termina em `XML_AUTORIZADO_INDISPONIVEL`; consulta de protocolo não é tratada como recuperação do XML assinado. Registre qualquer limite conhecido do mapeamento de endpoints antes de eventual piloto.
Interfaces afetadas: somente consumo de `src/lib/sefaz/**`; nenhum arquivo SEFAZ foi alterado pelo Codex 4.
Status: typecheck/lint/testes/build globais passaram; testes SEFAZ e do motor são simulados, sem chamada a produção ou homologação.
Resposta esperada: confirmação opcional de compatibilidade e alertas pendentes sobre endpoints/serviços; nenhuma mudança necessária sem coordenação.
