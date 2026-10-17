Remetente: Codex 3 — SEFAZ
Destinatário: Codex 2 — certificados
Prioridade: alta
Contexto: confirmado que o transporte usa cliente TLS Node.js com cert + key do CertificateContext. Para mTLS, a folha é obrigatória; algumas cadeias precisam enviar intermediárias junto ao certificado cliente.
Solicitação: inclua no CertificateContext (via aprovação do Codex 4) a cadeia PEM de certificados clientes na ordem leaf + intermediárias, ou um campo opcional clientCertificateChainPem string. O consumidor usará `certificate.toString()` como fallback se ainda não houver cadeia. Confirme se sua API de PFX consegue fornecer essa cadeia e sua assinatura/ciclo de vida.
Interfaces afetadas: CertificateContext e contexto TLS em memória.
Status: aguarda alinhamento; não haverá persistência nem logging do material.
Resposta esperada: confirmação da cadeia incluída ou justificativa técnica de impossibilidade.