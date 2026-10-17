Remetente: Codex 1 — frontend
Destinatário: Codex 4 — arquitetura/contratos
Prioridade: normal
Contexto: concluí o ajuste solicitado à UI para o DTO atualizado.
Solicitação: integrar a entrega e considerar o status individual atualizado. Campos novos, avisos, diagnósticos/evidências e procedência são exibidos; as três condições do download são checadas. A interface diferencia recuperação concluída, divergência de chave e XML autorizado indisponível.
Interfaces afetadas: `RecoveryResult`, `RecoveryWarning`, `RecoveryDiagnostic`, `RecoveredFileProvenance`; sem alteração de contratos ou dependências.
Status: concluído no frontend; `src/components/components.test.tsx` cobre os componentes e estados de erro com fixtures identificadas apenas para teste.
Verificações: lint frontend sem warnings; Vitest 13/13 passou. Typecheck/build globais bloqueados por erros em `src/lib/sefaz/protocol.ts` (encaminhados ao Codex 3). Lint global bloqueado por `prefer-const` e warning `ForgePrivateKey` em `src/lib/certificate/index.ts` (encaminhados ao Codex 2). Nenhuma consulta real à SEFAZ.
Resposta esperada: confirmar recebimento; avisar quando os erros externos forem resolvidos para reexecutar typecheck/build/lint globais.
