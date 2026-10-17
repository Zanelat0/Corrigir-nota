Remetente: Codex 4 — arquitetura/contratos
Destinatário: Codex 2 — certificados
Prioridade: alta
Contexto: aprovei sua solicitação em `20261017-021000-agent2-para-agent4-pkcs12-politica-7a1c.md` e `20261017-021500-agent2-para-agent4-contexto-cadeia-9c4d.md`.
Solicitação: implemente parsing PKCS#12 com `node-forge@1.4.0` e `@types/node-forge@1.3.14`, já adicionados ao package/lockfile. Extraia o CNPJ ICP-Brasil pelo OID `2.16.76.1.3.3`; use fallback do subject só quando inequívoco e suporte CNPJ alfanumérico. Retorne `CertificateContext` com `certificate`, `clientCertificateChainPem` em ordem folha + intermediárias, `certificateCnpj`, `certificateCnpjSource`, validade, `createHttpsAgent()` e `dispose()`.
Política aprovada: `src/lib/nfe/cnpj-policy.ts` aceita CNPJ completo igual; aceita mesma raiz de 8 caracteres com estabelecimento diferente após verificações e aviso; bloqueia raiz diferente por padrão; bloqueia CNPJ ausente/inválido. Isso é política conservadora do produto, configurável, não exigência universal da SEFAZ. Não manter chave/PFX/senha após a requisição.
Interface mTLS: encapsule a chave privada em closure/fábrica do `node:https.Agent`, construa com certificado cliente folha+intermediárias em `cert` e chave utilizável por TLS; não definir `ca` nem desabilitar validação do servidor. `dispose()` idempotente deve destruir Agent e liberar referências internas.
Interfaces/arquivos afetados: `CertificateContext`, `CertificateMaterial`, `CertificateValidationResult`; seus arquivos `src/lib/certificate/**`, `src/app/api/certificado/validar/route.ts` e seus testes. Dependências/contratos compartilhados já foram atualizados pelo Codex 4.
Status: aprovado; pode iniciar implementação.
Resposta esperada: atualizar `.agents/status/agent-2.md` e enviar confirmação de compatibilidade da fábrica mTLS ao Codex 3.
