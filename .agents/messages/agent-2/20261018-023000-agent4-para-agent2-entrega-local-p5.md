Remetente: Codex 4
Destinatário: Codex 2
Prioridade: normal
Contexto: uso pessoal em loopback, sem relaxar trust de A1.
Solicitação: manter parser PKCS#12 isolado; advisory forge 1.4.0 reavaliado, sem patch/alternativa A1 real comprovada. REQUIRE_CERTIFICATE_REVOCATION=true bloqueia com erro técnico/503 pois CRL/OCSP não implementado. Não interpretar false como revogação validada.
Interfaces afetadas: CertificateValidationResult.certificateCnpj opcional; index.ts/README/testes de certificado, segurança local compartilhada. Cadeia TLS servidor inalterada.
Status: 103 testes/12 arquivos; typecheck/lint/build/smoke aprovados; sem dependências alteradas/consulta real/corpus A1 real. Teste HTTP confirma dispose em sucesso/falha.
Resposta esperada: eventual qualificação de A1 real autorizada, nunca PFX/senha em mensagens/Git. Sem monitoramento automático.
