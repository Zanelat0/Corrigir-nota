# Certificados A1 efêmeros

Revisão local 2026-10-18: DTO público adiciona certificateCnpj opcional; UI exibe confiança parcial e avisos. REQUIRE_CERTIFICATE_REVOCATION=true retorna erro técnico/503 (não há CRL/OCSP implementado); false não é prova de revogação. Não desabilitar âncoras por ser localhost. Forge 1.4.0 continua com advisory high sem patch, reavaliado; nenhuma dependência substituída sem corpus A1 real. README raiz orienta configuração e teste autorizado, sem enviar senha/PFX pelo chat.

`createCertificateContext(pfx: Buffer, password: string): Promise<CertificateContext>` e `validateCertificate(pfx, password)` são APIs backend Node. O PFX é consumido e o Buffer zerado; nenhuma credencial é persistida. `dispose()` é idempotente e deve ser chamado em finally pela rota.

O parser PKCS#12 existente (`node-forge@1.4.0`, MAC obrigatório, chave RSA/certificado correspondente, datas/usos, CNPJ ICP-Brasil OID 2.16.76.1.3.3/fallback inequívoco) passou a rodar num processo filho. `parsePkcs12Locally` é somente entrada interna do worker. Compilar `.workers` com `npm run build:workers`; predev/pretest/prebuild fazem isso automaticamente. Deadline 5 s/heap V8 96 MiB, segredo por IPC e nunca em argumento/arquivo. O contexto retém KeyObject encapsulado e metadados; stdout/stderr do filho são ignorados. Não há promessa de apagamento físico de todas as cópias JS/OpenSSL antes de GC/encerramento.

`createHttpsAgent()` envia folha + intermediárias ordenadas, não configura `ca`, não desativa validação TLS e não adiciona a raiz do cliente ao trust store do servidor. A1 RSA até 8192 bits; outros formatos/algoritmos não suportados são rejeitados. Compatibilidade com certificados reais ainda precisa ser qualificada.

`evaluateCertificateCnpjForIssuer` aplica a política compartilhada: igualdade e mesma raiz válida permitida com aviso; raiz diferente e ausência/inconsistência bloqueiam por padrão. Isso é política conservadora do produto, não uma regra universal de todos serviços fiscais.

## Confiança

`trust.ts` implementa avaliação parcial de assinaturas, datas, CA flags e vínculo a âncoras públicas configuradas pelo operador (`ICP_BRASIL_TRUST_ROOTS_FILE`). Raiz incluída no upload não se torna confiável. O DTO informa status/escopo e `revocationChecked:false`. Limita caminho, número de certificados e visitas. Em produção exige vínculo à âncora por padrão; exceção `REQUIRE_TRUSTED_CLIENT_CERTIFICATE=false` é para testes sintéticos isolados.

Não implementa PKIX completo, políticas/pathLen/name constraints, CRL/OCSP ou validação histórica de revogação. Âncoras ICP-Brasil precisam ser obtidas/verificadas pelo operador com procedência/fingerprint; nenhuma raiz foi inventada ou baixada de uma requisição do usuário. A assinatura XML permanece vinculada ao mesmo A1 signatário informado; documento assinado antes de renovação pode requerer fluxo futuro.

## Segurança/risco

Advisory high [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) permanece sem patch. Forge é usado apenas em PKCS#12/MAC/bags; sua verificação RSA de assinatura não é chamada. Verificações de certificados usam node:crypto e de XML usam xml-crypto/Node. Isolamento não elimina o advisory. TLS nativo aceita PFX, mas não substitui sozinho o parser de identidade/cadeia; PKI.js foi investigado sem compatibilidade A1 real demonstrada. Nenhuma remoção incompatível foi feita.

`POST /api/certificado/validar`: JSON até 3 MiB, PFX 2 MiB, senha 256 caracteres; guarda compartilhada HTTPS/rate/concurrency e leitura do corpo em até 5 s. Respostas no-store sem segredo. HTTPS proxy somente com TRUST_PROXY=true e ingress confiável sobrescrevendo headers/bloqueando acesso direto.

Testes sintéticos cobrem carga, senha, expiração, ausência de chave, OID, cadeia, descarte, API e política de âncoras. Nenhuma autenticação SEFAZ real foi comprovada. Revisão completa em `.agents/SECURITY_REVIEW.md`.
