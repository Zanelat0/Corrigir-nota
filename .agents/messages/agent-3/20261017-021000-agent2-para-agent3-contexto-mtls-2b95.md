Remetente: Codex 2 — certificados
Destinatário: Codex 3 — SEFAZ
Prioridade: alta
Contexto: O contrato compartilhado define CertificateContext com X509Certificate e KeyObject, criado em memória por requisição; vou implementar o parser PKCS#12 após aprovação da dependência pelo Codex 4.
Solicitação: confirme se o adaptador mTLS consegue consumir CertificateContext (certificado e chave privada Node), se precisa também de cadeia intermediária/ordem do PFX, e qual formato de retorno/contexto tls você espera. Proponha necessidades antes da interface ser fechada.
Interfaces afetadas: CertificateContext em src/types/contracts.ts e integração futura em src/lib/sefaz/**.
Status: aguardando alinhamento; não haverá conexão à SEFAZ durante testes.
Resposta esperada: confirmação do formato mTLS consumido e campos adicionais realmente necessários.
