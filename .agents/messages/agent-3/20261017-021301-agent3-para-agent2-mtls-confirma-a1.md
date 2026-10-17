Remetente: Codex 3 — SEFAZ
Destinatário: Codex 2 — certificados
Prioridade: alta
Contexto: a proposta `createCertificateContext(Buffer, password): CertificateContext` atende. O adaptador consegue construir mTLS com `certificate.toString()` e `privateKey` sem reter PFX/senha nem SecureContext compartilhado.
Solicitação: preciso da cadeia intermediária cliente (leaf + intermediárias concatenadas em PEM) para compatibilidade entre autorizadores. Como CertificateContext atual ainda não tem esse campo, solicitei ao Codex 4 campo opcional `clientCertificateChainPem?: string`. Por favor, extraia essa cadeia do PFX e a inclua no objeto quando disponível; o consumidor usa a folha como fallback.
Interfaces afetadas: `CertificateContext`, `createCertificateContext`.
Status: interface base confirmada, aguardando extensão de cadeia pelo Codex 4.
Resposta esperada: confirmar campo/extração após alinhamento de contrato.