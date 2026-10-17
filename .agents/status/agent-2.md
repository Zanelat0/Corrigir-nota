# Status — Codex 2

## Estado

Implementação do módulo A1 concluída conforme decisões D-005, D-006, D-007 e D-010. Entrega enviada para integração dos Codex 3 e 4.

## Arquivos próprios alterados

- `src/lib/certificate/index.ts`: parsing PKCS#12, validação local, extração CNPJ, comparação CNPJ com emitente e contexto mTLS efêmero.
- `src/lib/certificate/certificate.test.ts`: fixtures PFX sintéticas e testes exclusivos do módulo.
- `src/lib/certificate/README.md`: exports, API, dependências, fronteiras de confiança, risco e testes.
- `src/app/api/certificado/validar/route.ts`: endpoint Node.js com limites, validação do DTO, HTTPS de produção, resposta segura e limpeza do buffer.
- `.agents/status/agent-2.md`: este status.

## Contrato efetivo

- `createCertificateContext(pfx: Buffer, password: string): Promise<CertificateContext>` consome/limpa o PFX recebido. Expõe X509, cadeia PEM folha + intermediárias, CNPJ/origem, datas, `createHttpsAgent()` e `dispose()`; a `KeyObject` fica em closure.
- `validateCertificate(pfx, password): Promise<CertificateValidationResult>` devolve DTO mínimo, com aviso de que autenticação SEFAZ/confiança da cadeia não foram comprovadas.
- `evaluateCertificateCnpjForIssuer(certificateCnpj, issuerCnpj)` aplica a política compartilhada em `src/lib/nfe/cnpj-policy.ts` antes de consulta fiscal.
- API recebe JSON base64 conforme contrato v1; PFX até 2 MiB, JSON até 10 MiB, senha até 256 caracteres; respostas `no-store`, duração configurada de 15s e `runtime = "nodejs"`.

## Dependência e risco

- Usa `node-forge@1.4.0` apenas para abrir PKCS#12, validar MAC e extrair bags; nenhuma chamada `pki.rsa.verify` ou verificação de assinatura de certificado/XML via forge.
- Chave pública/certificado e ligações da cadeia são verificadas com `node:crypto`; TLS usa `node:https`, sem `ca` customizada ou desativação de verificação do servidor.
- `npm audit --omit=dev` reporta o alerta high GHSA-86w9-cpqp-85rv sem correção publicada. A restrição de uso reduz exposição ao caminho de assinatura afetado, mas não limpa a auditoria.
- Trust anchor ICP-Brasil, CRL/OCSP/revogação, credenciamento e autenticação efetiva dependem da cadeia confiável/SEFAZ e não são afirmados por esta validação local. Objetos do runtime podem manter cópias até GC; não há promessa de apagamento físico. PFX não-RSA não é suportado.

## Verificações

- `npm test`: passou — 4 arquivos, 37 testes.
- `npm run typecheck`: passou.
- `npm run lint`: passou sem erros ou warnings.
- `npm audit --omit=dev`: 1 vulnerabilidade high em `node-forge`, sem correção publicada.
- Fixtures só existem em memória; nenhuma chamada à SEFAZ nem certificado real utilizado.

## Pendências

- Integração do Codex 4 deve chamar `evaluateCertificateCnpjForIssuer` com o CNPJ do XML e descartar o contexto em `finally`.
- Codex 3 deve chamar `createHttpsAgent()` por chamada mTLS e `dispose()` no encerramento.
- Deploy de produção deve usar TLS e ingress confiável que sobrescreva `x-forwarded-proto`.
