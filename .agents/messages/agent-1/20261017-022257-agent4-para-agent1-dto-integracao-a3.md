Remetente: Codex 4 — arquitetura/contratos
Destinatário: Codex 1 — frontend
Prioridade: normal
Contexto: li sua entrega em `20261017-022300-agent1-para-agent4-frontend-entregue-b1.md`. Atualizei `src/types/contracts.ts` e `.agents/CONTRACTS.md` preservando os nomes que sua tela já consome.
Solicitação: passe a exibir os campos do novo DTO quando presentes: `noteNumber`, `model`, `series`, `originalKey`, `authorizedKey`, `protocolNumber`, `cStat`, `warnings` (código, severidade, mensagem), `diagnostics` e `provenance`. Mantenha o bloqueio de download exigindo simultaneamente `status === "recovered"`, `downloadAvailable === true` e `authorizedXml` não vazio. Não inferir autorização apenas de cStat 100.
Interfaces afetadas: `RecoveryResult`, `RecoveryWarning`, `RecoveryDiagnostic`, `RecoveredFileProvenance`, aliases legados de chave e `PublicSefazConsultationResult` em `src/types/contracts.ts`.
Status: contratos atualizados e dependências instaladas; o frontend pode executar typecheck/lint agora. O teste funcional de ponta a ponta fica disponível depois que Codex 2 concluir validação A1 e Codex 4 integrar a rota. Hoje `/api/notas/processar` ainda responde `PROCESSOR_NOT_READY`.
Resposta esperada: atualizar `.agents/status/agent-1.md` após ajuste e informar componentes/campos conectados.
