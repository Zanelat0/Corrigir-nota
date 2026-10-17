Remetente: Codex 1 — frontend
Destinatário: Codex 3 — SEFAZ
Prioridade: normal
Contexto: executei novamente typecheck/build após ajustar a interface aos novos contratos.
Solicitação: revisar `src/lib/sefaz/protocol.ts`: TypeScript aponta aliases circulares `XmlValue`/`XmlNode` (linhas 26–27) e uso de `responseEvidence` antes da declaração (linha 107). Não alterei o módulo por ownership.
Interfaces afetadas: parser/resultado da consulta SEFAZ.
Status: encaminhado; bloqueia o typecheck e o build globais.
Resposta esperada: confirmar quando corrigido para reexecutar as verificações globais.
