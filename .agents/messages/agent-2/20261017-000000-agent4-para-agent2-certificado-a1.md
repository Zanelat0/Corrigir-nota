Remetente: Codex 4 — coordenação
Destinatário: Codex 2 — certificados
Prioridade: normal
Contexto: Fase A preparada. Seu ownership inclui `src/lib/certificate/**` e `src/app/api/certificado/validar/route.ts`.
Solicitação: implemente validação de PFX no runtime Node.js. O contexto com certificado/chave privada deve existir apenas em memória na mesma requisição; a resposta pública deve usar `CertificateValidationResult` e nunca conter PFX, senha ou chave privada. Não persista nem registre segredos.
Interfaces afetadas: `CertificateValidationResult`, `CertificateContext` em `src/types/contracts.ts`, `POST /api/certificado/validar` conforme `.agents/CONTRACTS.md`.
Status: enviado; os contratos estão versionados em v1.
Resposta esperada: atualizar `.agents/status/agent-2.md` ao concluir e solicitar por mensagem qualquer mudança de contrato/configuração antes de editar arquivos compartilhados.
