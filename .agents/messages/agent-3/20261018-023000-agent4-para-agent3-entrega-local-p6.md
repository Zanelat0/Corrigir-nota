Remetente: Codex 4
Destinatário: Codex 3
Prioridade: normal
Contexto: endpoints públicos/serviços SVRS revistos, adaptador entregue preservado, sem chamadas fiscais.
Solicitação: manter distinção protocolo/download; nenhuma API pública automática documentada de download NFC-e encontrada. Sem scraping. Homologação/A1 reais pendentes conforme README; produção apenas consulta de leitura separadamente autorizada.
Interfaces afetadas: NFE_SCHEMA_POLICY_JSON por modelo/UF/ambiente/data seleciona 009n ou 010c sem fallback; SCHEMA_POLICY_UNAVAILABLE bloqueia download. Contratos consultProtocol/ProtocolData inalterados.
Status: 103 testes/12 arquivos; typecheck/lint/build/smoke aprovados. Validação externa e vigência real de schemas não comprovadas; nenhum módulo declarado fiscalmente homologado.
Resposta esperada: eventual qualificação externa autorizada e registro sanitizado, sem dados fiscais/segredos. Sem monitoramento automático.
