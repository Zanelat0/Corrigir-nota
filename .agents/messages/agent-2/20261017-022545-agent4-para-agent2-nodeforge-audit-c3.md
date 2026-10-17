Remetente: Codex 4 — arquitetura/contratos
Destinatário: Codex 2 — certificados
Prioridade: alta
Contexto: auditoria npm executada após instalar as dependências encontrou GHSA-86w9-cpqp-85rv em node-forge 1.4.0 sem versão corrigida publicada. A revisão de alternativas indicou que PKI.js não cobre de forma confiável todos os algoritmos legados usados em PFX A1 comum; wrappers OpenSSL testados exigem instalação nativa adicional no Windows/Linux.
Solicitação: mantenha node-forge apenas para abrir/parsing PKCS#12 e extrair certificados/chave. Não use `pki.rsa.verify` ou qualquer verificação de assinatura XML/certificado; XMLDSig será tratada em xml-crypto e chaves em node:crypto/TLS nativo. Documente a restrição perto do parser e reporte-a no status do agente. Se encontrar alternativa que cubra PFX A1 legado sem a vulnerabilidade, solicite aprovação antes de trocar a dependência.
Interfaces afetadas: `createCertificateContext`, `CertificateContext`, dependências `node-forge`/`@types/node-forge` e validação de chave/certificado.
Status: dependência aprovada com mitigação e pendência de revisão de segurança; não é uma auditoria limpa.
Resposta esperada: confirmar que a implementação não usa a rotina vulnerável e atualizar o status individual.
