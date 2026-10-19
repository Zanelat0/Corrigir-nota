# Revisão de segurança — 2026-10-18

## Revisão pessoal/local vigente

- Ferramenta pessoal, sem login/contas/banco/infra distribuída. Launcher dev/start vincula 127.0.0.1 e força guard local/sem proxy. Exceção HTTP só nesse modo; Host/Origin/porta/Fetch Metadata bloqueiam sites externos/rebinding. Não protege contra processo malicioso no mesmo computador. Remoto não implantado/aprovado; exige HTTPS e acesso apropriado futuramente.
- Headers nosniff/frame DENY/no-referrer/Permissions-Policy restritiva adicionados. Smoke usa launcher real e testa Origin externo, sem falsificar HTTPS via proxy.
- GHSA-86w9-cpqp-85rv revisto: <=1.4.0 afetado, nenhuma versão corrigida; npm view continua 1.4.0. Mantido parsing PKCS#12/MAC isolado sem verificador RSA forge. TLS nativo e PKI.js reavaliados, mas sem corpus A1 real não há migração segura comprovada. Nenhuma dependência instalada/removida/substituída; audit de produção segue high, não corrigido.
- REQUIRE_CERTIFICATE_REVOCATION=true falha fechado (503/configuração indisponível); false declara ausência de CRL/OCSP. Âncoras continuam exigidas pela configuração operacional; não relaxar confiança por ser localhost.
- Política XSD explícita por modelo/UF/ambiente/data seleciona 009n ou 010c com hashes fixos, sem fallback. Calendário real não qualificado; exemplo só sintético.
- Segundo XML é descartado ao trocar original por drag/drop; remoção do A1 limpa operação. UI exibe CNPJ/trust/avisos. Testes HTTP verificam dispose em sucesso e falha inesperada, sem vazamento de erro.
- Riscos mantidos: memória nativa/WASM sem cota SO rígida, strings sem apagamento físico garantido, PKIX/revogação completos e renovação de signatário não suportados, A1/SEFAZ reais não validados. Requisitos de ingress/autenticação/distribuição abaixo são históricos do escopo remoto anterior, não requisitos atuais de localhost.

## Dependências e substituição do PKCS#12

`node-forge@1.4.0` continua com o advisory high [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), sem versão corrigida no registry consultado. O defeito documentado é na verificação RSA PKCS#1 v1.5. A inspeção de código confirmou que o produto usa forge para PKCS#12/MAC/bags, sem chamar `pki.rsa.verify`, verificação de certificados ou XML por forge; ligações de certificados usam `node:crypto`, e XMLDSig usa xml-crypto/Node. A ausência do caminho vulnerável nas chamadas observadas é uma avaliação de alcance, não prova de ausência de outras falhas.

A [API TLS nativa](https://nodejs.org/api/tls.html) aceita `pfx`/`passphrase` diretamente para autenticação TLS; isso não fornece um parser público de PKCS#12 que devolva todos os metadados/chaves/cadeia/CNPJ exigidos pelo módulo. Métodos privados do OpenSSL no Node não foram usados. [PKI.js](https://github.com/PeculiarVentures/PKI.js) é candidato mantido para formatos PKI/PFX sobre WebCrypto; sua compatibilidade com os PFX A1 reais do público, algoritmos legados, bags, OIDs e cadeias não foi comprovada nesta execução. Nenhuma dependência foi removida por suposição de compatibilidade. A substituição exige corpus consentido de certificados reais representativos e testes de interoperabilidade; não persistir esse corpus no projeto.

Mitigação implementada: parsing PFX em processo Node filho, com heap V8 96 MiB, deadline 5 s, IPC em memória, stdout/stderr ignorados e senha fora de argumentos/arquivos. O processo é encerrado após sucesso/falha; referências/buffers conhecidos são descartados. Suporte RSA foi preservado; limite de 8192 bits limita consumo extremo. Há testes sintéticos de PFX moderno/legado já suportado pelo módulo, senha errada, ausência de chave, uso e datas, extração ICP-Brasil, cadeia e descarte. Não se afirma compatibilidade com A1 real ainda.

Foi adicionado apenas `libxml2-wasm@0.7.2` (Node >=18) como dependência runtime. A auditoria npm de produção continua com 1 high em forge; não reportou advisory adicional nessa biblioteca. npm audit não cobre integralmente vulnerabilidades da engine C/WASM. A auditoria completa continua com as ocorrências transitivas high de `braces` na ferramenta de lint; não foi aplicado downgrade incompatível via `--force`.

## Confiança e autenticação

- TLS servidor SEFAZ continua com verificação padrão do Node, TLS >=1.2 e sem `ca` derivada de upload, `rejectUnauthorized: false`, redirects ou retries.
- `ICP_BRASIL_TRUST_ROOTS_FILE` é configuração do operador contendo apenas raízes públicas verificadas e com origem/fingerprint auditáveis. Raiz apresentada no PFX não vira autoridade confiável.
- Caminho local verifica assinaturas, datas, CA flags, vínculo a âncora, ciclos e limites (8 níveis, 12 certificados de cadeia, 64 raízes, 128 visitas). Escopo é parcial e explícito no DTO; não implementa políticas/pathLen/name constraints completos, CRL/OCSP ou histórico de revogação. Em produção, vínculo à âncora é obrigatório por padrão.
- XMLDSig é preso ao mesmo A1 signatário recebido e ao X509 embutido. Não suporta ainda verificar documento histórico com outro certificado signatário após renovação do A1. Essa limitação bloqueia a recuperação automática nesses casos; não altera KeyInfo.

## Entradas e disponibilidade

- API de processamento: corpo 17 MiB, dois XMLs de até 5 MiB e PFX 2 MiB; validação A1: JSON 3 MiB. Base64 estrito e UTF-8 fatal. Leitura do corpo tem prazo total de 5 s e contagem real, sem depender de Content-Length.
- XML: rejeita DTD/ENTITY, limita 64 níveis, 60 mil elementos e tag de 64 KiB antes de parsing recursivo. Assinatura aceita uma referência local, ID único, certificado embutido correspondente, duas transforms restritas e algoritmos permitidos. Digest do protocolo deve corresponder ao assinado.
- XSD: snapshot local/hashes, nenhum schema do usuário; engine em processo filho, heap V8 128 MiB e prazo 5 s. O uso inicial em worker thread causou falha nativa no Node 24/Windows; foi substituído por processo isolado. Esses heaps não são cotas de memória nativa/WASM: deploy deve aplicar também limites de memória/CPU do SO/container.
- SEFAZ: 15 s de prazo total e inatividade, 2 MiB, classificação DNS/TLS/HTTP/SOAP/XML, Agent destruído, sem retry automático. Desconexão do cliente não equivale a cancelamento instantâneo de toda operação, mas os estágios permanecem limitados.
- Rate limit local compartilhado entre rotas: 2 simultâneas, 10/min por cliente e 60/min no processo; buckets finitos e expirados. Sem proxy confiável há bucket comum; com `TRUST_PROXY=true`, o ingress deve sobrescrever IP/protocolo e bloquear acesso direto. Não é proteção distribuída entre réplicas.

## Dados, resultados e deploy

Não há banco, cache de resultado, cookie de credencial ou localStorage. Senha/PFX/XML não são logados; falhas têm mensagens públicas genéricas. Buffers conhecidos são zerados, mas JS strings/GC/OpenSSL podem manter cópias transitórias. Processos filhos recebem dados via IPC e não criam arquivos de segredos.

Resultados e sessão da UI expiram em 15 min. Novo upload refaz as consultas; não há reutilização de protocolo confiada ao browser. Expiração da tela não apaga arquivo já baixado nem impede cópia local pelo usuário. URLs de Blob são revogadas após uso. Respostas sensíveis usam `no-store`.

O exemplo `deploy/nginx.conf.example` inclui TLS 1.2/1.3, HSTS, proxy/IP sobrescritos, limites, autenticação restrita de piloto e streaming sem buffers temporários de corpo/resposta em disco. É um modelo não implantado; o operador deve testar certificados de servidor, credenciais de acesso, topologia, logs e restrição do backend. O SaaS ainda não implementa gestão de contas multiempresa.

## Decisão de exposição

Não aprovado para produção ou piloto fiscal operacional neste estado. Piloto supervisionado requer configurar/qualificar âncoras/ingress/acesso, avaliar o advisory residual, confirmar schemas aplicáveis à UF/data, testar A1 real e autenticação/consulta em ambiente autorizado, conferir a recuperação interativa e obter revisão fiscal. O teste local de build usa credenciais sintéticas e exceção de confiança somente num processo ligado a 127.0.0.1; não é um modelo de deploy.
