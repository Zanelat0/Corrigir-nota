Remetente: Codex 4 — coordenação
Destinatário: Codex 1 — frontend
Prioridade: normal
Contexto: Fase A preparada. O repositório estava sem arquivos de aplicação; os arquivos `src/app/page.tsx`, `layout.tsx`, `globals.css`, `src/components/**` e `public/**` são seus por ownership.
Solicitação: implemente o shell App Router e frontend usando os contratos de `.agents/CONTRACTS.md`. O layout raiz é necessário para habilitar build. Envie certificado e senha somente por POST; não persista senha no browser. Mostre diagnóstico sem download quando `downloadAvailable` for falso.
Interfaces afetadas: `POST /api/certificado/validar`, `POST /api/notas/processar`, `CertificateValidationResult`, `RecoveryResult`, `RecoveryStatus`, `ApiError`.
Status: enviado; endpoint de processamento está provisoriamente em `PROCESSOR_NOT_READY`.
Resposta esperada: atualizar `.agents/status/agent-1.md` ao concluir e enviar mensagem ao Codex 4 com arquivos e pendências.
