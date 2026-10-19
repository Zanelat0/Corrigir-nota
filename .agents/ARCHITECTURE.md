# Arquitetura — revisão pessoal/local de 2026-10-18

## Revisão vigente (supera referências anteriores a deploy SaaS)

Escopo exclusivamente pessoal, sem login/banco/infraestrutura distribuída. `npm run dev`/`npm start` invocam scripts/local.mjs, que vincula 127.0.0.1 e força CORRIGIR_NOTA_LOCAL_ONLY=true/TRUST_PROXY=false. HTTP é permitido somente nesse modo, mesmo no build. Guard confere URL/Host/porta/Origin/Fetch Metadata; Next pode normalizar URL como localhost, mas Host continua loopback e Origin deve corresponder exatamente ao Host. Remoto fica fora do escopo e exigirá HTTPS/controle de acesso.

XSD agora tem política explícita NFE_SCHEMA_POLICY_JSON por modelo/UF/ambiente/data, regra única e referência de qualificação. Perfis oficiais 009n e 010c têm hashes próprios; não há fallback nem datas de vigência presumidas. Política ausente/ambígua/fora da faixa bloqueia download como SCHEMA_POLICY_UNAVAILABLE. Calendário real ainda não qualificado. REQUIRE_CERTIFICATE_REVOCATION=true bloqueia com erro técnico porque CRL/OCSP não está implementado. Cadeia permanece parcial.

Contratos v1 preservados; CertificateValidationResult ganhou certificateCnpj opcional. UI mostra trust/avisos e limpa segundo XML ao trocar original. Fluxos fiscais, limites, processos isolados e finally abaixo foram preservados. Ingress distribuído/autenticação comercial mencionados adiante pertencem ao escopo remoto anterior, não são requisitos de localhost. Guia atual: README.md.

Stack Next.js App Router/React/TypeScript estrito/Tailwind/Node. Sem banco ou sessão de credenciais. Ownership e comunicação permanecem em AGENTS.md; esta fase foi autorizada ao coordenador e comunicada aos especialistas antes de editar módulos entregues.

## Fluxo

1. UI envia PFX/senha para validação A1 e recebe metadados sem segredo.
2. Novo POST envia XML original + PFX/senha; opcionalmente inclui `authorizedXmlBase64` quando a pessoa recuperou por canal externo o XML assinado correto.
3. Guard compartilhado aplica HTTPS, rate limit/concorrência, limite e prazo do stream JSON. Headers de proxy somente com configuração explícita.
4. O módulo A1 abre o PFX num processo filho limitado, converte a chave para KeyObject e avalia o caminho até âncoras configuradas pelo operador. Cadeia cliente não substitui CAs usadas para validar o servidor HTTPS.
5. Parser XML faz preflight linear de recursos, bloqueia DTD/ENTITY e extrai infNFe/ide/emit/assinatura/QR. Política CNPJ e identidade assinada precedem a consulta.
6. Adaptador SEFAZ resolve endpoint fixo por UF/modelo/ambiente. Uma chamada consulta uma chave. Apenas 613 com alternativa válida e componentes comuns permite a segunda consulta. Não transmite ou autoriza notas.
7. Se chave autorizada diverge e não existe segundo XML, resultado `XML_AUTORIZADO_INDISPONIVEL`. O portal SVRS tem fluxo interativo certificado; nenhuma API oficial automática de download NFC-e foi localizada na documentação consultada. Não há scraping.
8. Segundo XML deve corresponder exatamente à chave autorizada e ao emitente/modelo/série/número/ambiente do caso. Arquivo não é usado como prova do protocolo: o servidor refaz a consulta. Protocolo incompatível já embutido é bloqueado.
9. Só compõe o wrapper nfeProc após conferir chave, assinatura vinculada ao mesmo A1 signatário/KeyInfo, digest e fragmento protNFe original. Não reserializa NFe ou protNFe. Engine XSD valida o documento completo com pacote oficial local/hashes; a assinatura também é conferida novamente após composição.
10. Somente `recovered` com os gates satisfeitos contém authorizedXml/provenance e download. A1/Agents e buffers são descartados em finally; não há resultado persistido. A UI expira a sessão/resultado em 15 min.

## Processos isolados e empacotamento

- PFX: `.workers/lib/certificate/worker.js`, gerado por `npm run build:workers` (TypeScript já existente) a partir de `src/lib/certificate/worker.ts`. Pré-dev/test/build compilam o worker. Heap V8 96 MiB; deadline 5 s; IPC sem senha em argumentos/arquivos.
- XSD: `src/lib/nfe/schema-worker.mjs`, usando libxml2-wasm 0.7.2. Heap V8 128 MiB; deadline 5 s; sem rede/resolver de filesystem para documentos. Inclui/importa apenas buffers allowlisted dos schemas locais.
- Processos filhos evitam que um parser síncrono bloqueie o loop do servidor e isolam falhas nativas. Cotas de memória nativa/WASM ainda requerem SO/container.
- Turbopack não deve reescrever os programas Node de filho. fork é invocado em runtime com paths fixos; `next.config.ts` inclui explicitamente worker, schemas e pacote WASM no trace. Smoke do build em loopback exercita a rota A1 e rejeição de XML sem chamar SEFAZ.

## Validação e limites

Perfil XSD executado e origem: `schemas/nfe/README.md`. Root 4.00 não identifica por si só qual NT aplica. Sem fallback de schema para forçar aceitação. XSD não reexecuta todo cálculo/negócio fiscal e não prova confiança PKIX/revogação.

Assinatura exige o mesmo certificado signatário no A1 apresentado e no KeyInfo. Renovação do certificado do emitente pode exigir outro fluxo de verificação histórica, ainda não implementado. Trust assessment verifica assinaturas/datas/CA/âncora; não é PKIX completo, CRL/OCSP ou prova de credenciamento. Produção exige âncora por padrão, mas permanece não aprovada.

Consulta possui deadlines total/inatividade de 15 s, corpo 2 MiB e nenhum retry. Corpo da API: 17 MiB processamento, 3 MiB validação A1, prazo 5 s; XMLs 5 MiB cada/PFX 2 MiB. Preflight limita profundidade/elementos/tags. Admissão por processo limita concorrência e frequência; ingress distribuído e autenticação do piloto são necessários fora da aplicação.

Documentos complementares: `.agents/CONTRACTS.md`, `SECURITY_REVIEW.md`, `SVRS_RECOVERY_RESEARCH.md`, `ACCEPTANCE.md` e `DECISIONS.md`. Não há certificado real nem consulta fiscal real validada nesta fase.
