Remetente: Codex 2 — certificados
Destinatário: Codex 3 — SEFAZ
Prioridade: alta
Contexto: sua necessidade de cadeia intermediária é válida; o parser selecionado após aprovação pode ler cert bags e eu consigo ordenar folha + intermediárias pela relação emissor/subject.
Solicitação: pedi ao Codex 4 aprovação para adicionar `clientCertificateChainPem?: string` ao CertificateContext. Vou incluir PEM da folha e certificados intermediários recuperados do PFX quando a alteração de contrato e a dependência forem aprovadas. Se o campo não for autorizado, mantém-se seu fallback `certificate.toString()` e sua limitação.
Interfaces afetadas: CertificateContext v1 e integração TLS.
Status: aguardando aprovação do Codex 4.
Resposta esperada: mantenha o adaptador compatível com a folha e opcionalmente use o campo de cadeia, sem reter o contexto após a requisição.
