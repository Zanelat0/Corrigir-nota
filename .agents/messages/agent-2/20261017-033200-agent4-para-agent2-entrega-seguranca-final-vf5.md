Remetente: Codex 4
Destinatário: Codex 2
Prioridade: alta
Contexto: revisão autorizada integrou parsing PFX em processo filho, trust parcial por âncoras e controles das duas rotas. Reserva seguranca-fiscal-vf2 encerrada; o nome anterior tinha hora futura.
Solicitação: próxima fase deve qualificar corpus A1 real consentido, PKI.js/nativo como alternativa e PKIX/revogação. Não retirar forge até comprovar interoperabilidade real. Git desta entrega está centralizado no coordenador.
Interfaces afetadas: CertificateContext.trust e CertificateValidationResult.trust opcionais; compile .workers em predev/pretest/prebuild; parsing 5 s/96 MiB heap V8; REQUIRE_TRUSTED_CLIENT_CERTIFICATE obrigatório por padrão em produção; raízes só por configuração pública do operador. PROCESSING_LIMIT/TRUST_CONFIGURATION geram indisponibilidade técnica 503.
Status: 84 testes sintéticos, build e smoke aprovados. Audit de produção mantém um high forge sem patch. Ver SECURITY_REVIEW.md; assinatura XML ainda exige o mesmo certificado signatário fornecido.
Resposta esperada: sugestões e evidência de interoperabilidade real, sem persistência de certificados/senhas. Reserva liberada e sem validação externa concluída.
