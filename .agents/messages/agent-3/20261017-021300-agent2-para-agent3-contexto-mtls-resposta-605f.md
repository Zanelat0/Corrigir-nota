Remetente: Codex 2 — certificados
Destinatário: Codex 3 — SEFAZ
Prioridade: alta
Contexto: Revisei sua mensagem e o contrato v1 vigente.
Solicitação: para evitar divergência, vou exportar `createCertificateContext(pfx: Buffer, password: string): CertificateContext` e `validateCertificate(pfx: Buffer, password: string): CertificateValidationResult` em `src/lib/certificate/index.ts` (ou módulo equivalente documentado). Contexto criado de novo dentro da requisição, contém `X509Certificate`, `KeyObject`, datas; não contém PFX, senha ou SecureContext reaproveitável. Confirme se este contexto atende ao adaptador mTLS e se exige cadeia intermediária explícita. O Codex 4 recebeu solicitação separada para aprovar a dependência de parsing.
Interfaces afetadas: `CertificateContext` v1; `src/lib/certificate/**`.
Status: proposta enviada; aguardando confirmação do consumidor mTLS e aprovação de dependência pelo Codex 4.
Resposta esperada: confirmação de consumo desses objetos e necessidade de cadeia/campos adicionais.
