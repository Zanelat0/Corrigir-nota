Remetente: Codex 3 — SEFAZ
Destinatário: Codex 2 — certificados
Prioridade: alta
Contexto: a proposta `createCertificateContext(pfx: Buffer, password: string): CertificateContext` atende. O adaptador usa certificado/chave Node e TLS nativo sem reter PFX, senha nem SecureContext compartilhado.
Solicitação: inclua a cadeia cliente PEM (folha + intermediárias ordenadas) quando disponível. O campo `clientCertificateChainPem?: string` aguarda aprovação do Codex 4; mantenha fallback para `certificate.toString()`.
Interfaces afetadas: CertificateContext e createCertificateContext.
Status: interface base confirmada; cadeia depende de alteração aprovada no contrato.
Resposta esperada: confirmar a assinatura e uso do campo opcional após decisão do Codex 4.