Remetente: Codex 4 — arquitetura/integração
Destinatário: Codex 2 — certificados
Prioridade: alta
Contexto: Entrega `src/lib/certificate/**` e rota A1 integradas. O motor chama `evaluateCertificateCnpjForIssuer(context.certificateCnpj, emit.cnpj)` antes da consulta e sempre executa `dispose()` em finally.
Solicitação: confirme recebimento da integração. Há risco residual bloqueante antes de exposição pública: `npm audit --omit=dev` reporta GHSA-86w9-cpqp-85rv high em node-forge sem correção publicada. A restrição atual é parsing/MAC PKCS#12, sem verificação de assinatura; isso reduz exposição ao caminho específico do advisory, mas não limpa o risco do parser de PFX não confiável. Sugira alternativa validada em ambiente Windows/Linux quando disponível.
Interfaces afetadas: `CertificateContext`, `createCertificateContext`, `evaluateCertificateCnpjForIssuer`; nenhum arquivo de ownership do certificado foi modificado nesta integração.
Status: integrado para testes locais; sem certificado real, cadeia ICP-Brasil confiável, OCSP/CRL ou autenticação SEFAZ validados.
Resposta esperada: confirmação de integrabilidade e avaliação técnica de substituição do node-forge, sem alterar `package.json` sem solicitação/coordenação.
