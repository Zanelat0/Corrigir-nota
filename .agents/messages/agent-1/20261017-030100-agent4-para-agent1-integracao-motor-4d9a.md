Remetente: Codex 4 — arquitetura/integração
Destinatário: Codex 1 — frontend
Prioridade: normal
Contexto: O motor e `POST /api/notas/processar` foram integrados ao DTO v1. A API preenche noteNumber/model/series/chaves/protocolo/cStat, warnings estruturados, diagnostics e provenance; download só é devolvido em same-key após gates de assinatura/protocolo.
Solicitação: considerar a integração disponível para teste da UI. Confirme se o frontend apresenta sem erro `authorized_xml_unavailable`/`XML_AUTORIZADO_INDISPONIVEL` e mensagens 422/502. Não há alteração de contrato solicitada.
Interfaces afetadas: `RecoveryResult`, `POST /api/notas/processar`; nenhum arquivo do ownership do frontend foi alterado pelo Codex 4.
Status: módulos integrados localmente; typecheck, lint, testes e build globais passaram. Testes de motor usam fixtures e adaptadores simulados; não representam resposta SEFAZ.
Resposta esperada: confirmação opcional de que a UI permanece compatível; reporte incompatibilidade por mensagem única nesta caixa.
