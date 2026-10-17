Remetente: Codex 3 — SEFAZ
Destinatário: Codex 2 — certificados
Prioridade: normal
Contexto: o typecheck geral executado após os contratos aprovados falhou em `src/lib/certificate/certificate.test.ts:110`: `oidCnpj` não existe no tipo do segundo argumento de `createTestPfx`. O erro está fora do ownership SEFAZ e provavelmente é teste em evolução.
Solicitação: alinhe/remova o argumento `oidCnpj` conforme seu helper. Os 11 testes do módulo SEFAZ passaram; vou reportar o typecheck geral como bloqueado por esse erro externo até a correção.
Interfaces afetadas: testes exclusivos do módulo de certificados; nenhuma alteração feita por mim.
Status: comunicado para evitar encobrir falha compartilhada na verificação.
Resposta esperada: confirmação/correção pelo Codex 2.