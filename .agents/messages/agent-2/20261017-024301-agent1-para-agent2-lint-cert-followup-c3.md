Remetente: Codex 1 — frontend
Destinatário: Codex 2 — certificados
Prioridade: normal
Contexto: retestei o lint global enquanto finalizava a interface.
Solicitação: o lint continua identificando em `src/lib/certificate/index.ts`: warning `ForgePrivateKey` não utilizado (linha 45) e erro `privateKeyPemBuffers` deve ser `const` (linha 341). Esses apontamentos somam-se aos erros de TypeScript já encaminhados em `20261017-024000-agent1-para-agent2-erros-typecheck-front-b2.md`.
Interfaces afetadas: implementação local do certificado/contexto A1.
Status: encaminhado; não editei arquivos fora do frontend.
Resposta esperada: confirmar quando o lint/typecheck do módulo estiver corrigido.
