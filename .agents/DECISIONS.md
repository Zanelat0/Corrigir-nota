# Registro de decisões

## D-022 — demonstração visual offline e não fiscal (2026-10-18)

- Flag ENABLE_LOCAL_DEMO=false por padrão. Layout servidor só importa o shell em NODE_ENV=development, modo loopback explícito, Host local e sem proxy. Build produção compila o branch desabilitado; teste de build/start com flag true e query demo=true não mostra demo. Nenhum parâmetro de cliente contorna A1 nas rotas reais, que não foram alteradas.
- Shell monta exclusivamente workspace fiscal OU demo; troca desmonta/limpa operação anterior. Sete cenários de apresentação sem fetch/rede, motor fiscal, certificados ou uploads reais; manual usa fixture interna. Não há XML sintético/download, assinatura ficticiamente validada ou procedência fiscal. DTO demo é separado, marca simulation:true e sempre downloadAvailable:false; guard fiscal rejeita marcador simulation. Painel compartilhado identifica SIMULAÇÃO em título, descrição, cStat e aviso de bloqueio.
- Reutilizada identidade sintética (CNPJ/chave/número) das fixtures automatizadas em helper puro, sem levar Node/forge/chaves privadas ao browser. Testes criptográficos anteriores preservados; demo não é homologação fiscal.
- next dev tentou adicionar bloco automático ao AGENTS.md; removido apenas o bloco gerado nesta sessão, preservando as regras do usuário. agentRules=false (configuração suportada localmente) impede reescrita automática futura. Build regenera next-env.d.ts normalmente.
- Conferência Chrome: cenário 100 e manual (indisponível → fixture correspondente → sucesso fictício); sem A1/formulário real ou download. Avisos vieram de extensão: atributos bis_* no DOM e erro M_ID em chrome-extension. Não desabilitamos extensão nem mascaramos warning.

## D-018 — escopo pessoal e loopback (2026-10-18)

- Decisão atual substitui SaaS: uma página, sem login/banco/histórico/cobrança/infra distribuída. Preservados módulos entregues, sem reescrita.
- dev/start usam launcher fixando 127.0.0.1 e modo local/sem proxy. HTTP só nesse modo; URL/Host/porta/Origin/Fetch Metadata conferidos. HTTPS e acesso apropriado continuam requisitos de eventual remoto, não implementado.
- Headers defensivos e smoke pelo launcher com bloqueio de Origin externo. Ownership/caixas/locks/Git conferidos; sem alteração concorrente; especialistas comunicados e mudanças cruzadas autorizadas. Contratos v1 mantidos.

## D-019 — seleção XSD explícita (2026-10-18)

- NFE_SCHEMA_POLICY_JSON: configuração pública até 64 regras/32 KiB, regra única modelo/UF/ambiente/faixa de emissão/referência. Perfis oficiais 009n histórico ou composição 010c anterior, hashes próprios/sem fallback.
- Sem regra/data/configuração válida ou ambiguidade: SCHEMA_POLICY_UNAVAILABLE, sem download. Não é rejeição fiscal SEFAZ. Pode bloquear arquivo antes aceito pelo perfil genérico, deliberadamente.
- Não inventar datas de corte por nome de pacote ou versão 4.00. Portal Nacional referenciado falhou na pesquisa; SVRS consultada. Calendário real NT/UF/ambiente/data exige qualificação do operador; exemplo/testes só sintéticos.

## D-020 — forge e revogação (2026-10-18)

- Advisory oficial/registry revistos: node-forge 1.4.0 afetado, sem patch. TLS nativo aceita PFX, mas não extrai toda identidade/KeyObject/cadeia por API pública; PKI.js candidato sem corpus A1 real/legado comprovado. Nenhuma dependência instalada/removida/atualizada; lockfile preservado.
- Parsing/MAC isolado sem verificador RSA forge mantido; audit high não corrigido. Localhost reduz exposição, não elimina risco.
- REQUIRE_CERTIFICATE_REVOCATION=true falha fechado com configuração indisponível/503 porque CRL/OCSP ainda inexiste; false não atesta revogação. PKIX parcial/âncoras e limitação de signatário histórico documentadas.

## D-021 — operação e evidências locais (2026-10-18)

- DTO A1 ganha certificateCnpj opcional; UI mostra CNPJ/trust/avisos, remove contato comercial fictício e permite remover A1/limpar operação. Drag/drop de original limpa segundo XML; finally antigo abortado não altera loading de chamada nova.
- Testes verificam dispose em sucesso/falha e nenhum segredo no erro; falhas XSD de worker/timeout/configuração/política não liberam arquivo.
- Baseline reexecutada 84/11, typecheck/lint limpos. Nova rodada 103 testes/12 arquivos; build/smoke aprovados. Erros introduzidos/corrigidos: tipagem de headers de teste; guard estrito com alias localhost/127.0.0.1 normalizado pelo Next; tracing amplo corrigido por caminhos estáticos.
- Nenhum A1/SEFAZ real, transmissão/emissão ou publicação. Demonstração local sintética e preparação de homologação autorizada, não operação fiscal validada.

## D-001 — fronteiras de ownership

- Data: 2026-10-17
- Decisão: adotar os papéis e limites de arquivo definidos em `AGENTS.md`; Codex 4 é o único editor de contratos, configuração compartilhada e `STATUS.md`.
- Motivo: permitir trabalho independente sem sobrescritas concorrentes.
- Estado: vigente.

## D-002 — identidade documental é vinculante

- Data: 2026-10-17
- Decisão: nunca anexar protocolo de uma chave ao XML assinado de outra chave. Disponibilizar XML apenas se recuperado como documento efetivamente autorizado e validado.
- Motivo: chaves 42260901867724000108650010000257439594944564 (`tpEmis=9`) e 42260901867724000108650010000257431536139497 (`tpEmis=1`) são documentos assinados distintos; cStat 613 seguido de cStat 100 não transforma um no outro.
- Estado: vigente.

## D-003 — segredos efêmeros e sem banco

- Data: 2026-10-17
- Decisão: primeira versão sem banco; PFX e senha são recebidos por chamada HTTPS, processados somente em memória no runtime Node.js e não persistidos/logados.
- Estado: vigente.

## D-004 — limites iniciais de entrada

- Data: 2026-10-17
- Decisão: PFX até 2 MiB, XML até 5 MiB, JSON até 10 MiB, senha até 256 caracteres.
- Motivo: limites operacionais iniciais para evitar uploads sem limite; ajuste precisa ser explícito.
- Estado: vigente.

## D-005 — dependências fiscais e transporte SOAP

- Data: 2026-10-17
- Decisão: adicionar `node-forge@1.4.0` com `@types/node-forge@1.3.14` para leitura transitória de PKCS#12; `fast-xml-parser@5.11.2` para extração XML com `processEntities: false` e bloqueio prévio de DTD/DOCTYPE; `xml-crypto@6.4.0` para verificação XMLDSig. Preservar TypeScript, ESLint 9 + configuração Next 16, tipagens Node e Next/React/Tailwind compatíveis; atualizar Vitest para `4.1.12` por correção dos avisos críticos do Vitest 3. Registrar lockfile com versões reproduzíveis.
- Transporte SOAP: não adicionar pacote SOAP/cliente HTTP duplicado nesta etapa. Usar `node:https` e `https.Agent` por requisição com cert cliente folha + intermediárias e chave privada, sem configurar `ca`; manter validação normal da cadeia do servidor SEFAZ.
- Motivo: parser explícito e seguro, assinatura XMLDSig dedicada e TLS nativo reduzem caminhos de transporte/segredos e mantêm trust de servidor independente da cadeia mTLS cliente.
- Estado: vigente.

## D-010 — vulnerabilidades sem correção disponível

- Data: 2026-10-17
- Decisão: manter `node-forge@1.4.0` porque alternativas auditadas não atendem simultaneamente a compatibilidade com PFX A1 comum (incluindo algoritmos legados de exportação) e instalação Windows/Linux simples. O módulo de certificados deve usá-lo exclusivamente para abrir PKCS#12; não usar `pki.rsa.verify` nem delegar verificação XMLDSig a node-forge. XMLDSig permanece em `xml-crypto`; chaves operacionais seguem em `node:crypto`/TLS nativo. `npm audit` ainda reporta GHSA-86w9-cpqp-85rv sem versão corrigida publicada. A vulnerabilidade não é considerada eliminada; restrição de uso e alerta ficam registrados para revisão quando houver correção/alternativa compatível.
- Também permanece alerta high sem correção publicada para `braces` transitivo em `eslint-config-next`/`@next/eslint-plugin-next` (ferramenta de desenvolvimento). Não degradar a configuração Next 16 para versão antiga apenas para silenciar o audit; reavaliar quando a cadeia upstream publicar correção.
- Fonte: [advisory node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv), [advisory braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- Estado: aceito com mitigação e pendência de revisão; auditoria segue não limpa.

## D-006 — contexto mTLS efêmero

- Data: 2026-10-17
- Decisão: `CertificateContext` encapsula chave privada `KeyObject`, certificado X.509, cadeia PEM opcional ordenada (folha + intermediárias), CNPJ/origem e validade; expõe `createHttpsAgent()` e `dispose()`. Não contém PFX/senha, não é serializável nem mantido entre chamadas. O Codex 3 consome apenas a fábrica do Agent.
- Estado: aprovado para os agentes 2 e 3 implementarem.

## D-007 — política MVP de CNPJ

- Data: 2026-10-17
- Decisão: extrair CNPJ preferencialmente do OID ICP-Brasil `2.16.76.1.3.3`; igualdade total aceita; mesma raiz de oito caracteres com estabelecimento diferente aceita por padrão após verificações de identidade e gera aviso; raiz diferente bloqueia por padrão; CNPJ ausente/inválido bloqueia uso automático. Opções são configuráveis em `evaluateCnpjRelationship`.
- Motivo: política conservadora do produto, não regra universal de autorização fiscal. Normalização inclui CNPJ alfanumérico vigente.
- Estado: vigente.

## D-008 — consulta unitária e protocolo original

- Data: 2026-10-17
- Decisão: adaptador Codex 3 consulta uma chave por chamada e retorna cStat, motivo, chNFe, tpAmb, cUF, versão de aplicação, recebimento, erros/evidências e `ProtocolData` completo. Preserva XML bruto de `protNFe` apenas no objeto interno; DTO público o exclui. Motor do Codex 4 controla nova consulta após 613.
- Estado: vigente.

## D-009 — recuperação depende do modelo e elegibilidade

- Data: 2026-10-17
- Decisão: Fluxo A só compõe nfeProc para chave idêntica, preservando NFe assinado e protNFe original após validação. Fluxo B nunca combina chaves; sem XML exato autorizado retorna `XML_AUTORIZADO_INDISPONIVEL`. Distribuição NF-e modelo 55 é condicional à elegibilidade oficial do ator/documento; modelo 65 fica sem mecanismo geral confirmado e não usa NFeDistribuicaoDFe por suposição. cStat 100 isolado não libera download.
- Fontes consultadas: Portal Nacional NF-e / Web Services e NT de Distribuição; Receita Federal / CNPJ Alfanumérico e cálculo do DV.
- Estado: vigente; integração real SEFAZ ainda não implementada/testada.

## D-011 — motor de recuperação e fronteira de validação

- Data: 2026-10-17
- Decisão: integrar `recoverNfe` com os módulos de certificado e SEFAZ entregues. Uma consulta é feita por chave; cStat 613 permite consulta separada somente após validar a chave alternativa. Fluxo A compõe `nfeProc` apenas para chave idêntica, assinatura XMLDSig validada com o A1, digest `infProt/digVal` correspondente e `protNFe` oficial preservado. Fluxo B sem fonte oficial do XML integral retorna `XML_AUTORIZADO_INDISPONIVEL` sem `authorizedXml`.
- Motivo: preservar a identidade assinada, não inferir recuperação integral de uma consulta protocolar e bloquear downloads por cStat 100 isolado.
- Limites: XSD fiscal oficial não está validado; provenance expõe `schemaValidated: false`. Existe teste criptográfico XMLDSig com certificado sintético; testes de orquestração injetam consulta/verificador simulados. Nada disso comprova certificado fiscal real, confiança ICP-Brasil nem serviço SEFAZ.
- Estado: motor integrado para testes locais; produção não aprovada.

## D-012 — advisories antes de exposição pública

- Data: 2026-10-17
- Decisão: manter temporariamente `node-forge` apenas para parsing/MAC PKCS#12, sem verificação de assinatura RSA/XML; conservar `xml-crypto`/`node:crypto` para XMLDSig. Não usar `npm audit fix --force`, pois rebaixa ESLint Next para major incompatível. A implantação pública fica bloqueada até revisão/mitigação formal dos high advisories e atualização da cadeia afetada.
- Evidência desta execução: `npm audit --omit=dev` reporta um high [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) em node-forge sem correção; `npm audit` reporta seis ocorrências high no total, incluindo [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) em `braces` transitivo do lint. Advisories revisados em 2026-10-17; nenhum pacote fix disponível segundo o registry/advisory consultado.
- Risco residual: node-forge permanece em dependência de runtime e recebe PFX não confiável; a restrição de uso evita especificamente o caminho de verificação RSA reportado, mas não equivale a eliminar a vulnerabilidade. `braces` permanece transitivo em dependência de desenvolvimento.
- Medida: segredos processados apenas em memória, limites de upload, sem persistência/logs, testes offline; revisão obrigatória de advisories antes de publicar.
- Estado: audit não limpa; produção bloqueada.

## D-013 — portal oficial NFC-e e limite da automação

- Data: 2026-10-17.
- Decisão: reconhecer o Download XML interativo do portal SVRS, com certificado ICP-Brasil e verificação de vínculo, como caminho externo possível. A relação oficial de Web Services consultada não publica API de download NFC-e. Não implementar scraping/sessão autenticada/CAPTCHA.
- Caso SC/modelo 65: autorizador compatível com SVRS; disponibilidade do arquivo e elegibilidade concreta não testadas sem certificado real. Não presumir regras de NF-e ou abrangência de autoridades próprias.
- Evidência: `.agents/SVRS_RECOVERY_RESEARCH.md` contém fontes e separa observação pública de inferências e pontos não confirmados.

## D-014 — segundo XML validado e consultas renovadas

- Decisão: API aceita `authorizedXmlBase64` opcional, com original/PFX/senha reenviados. Motor refaz as consultas; não confia em protocolo/chave armazenados pelo browser. Segundo XML deve ter a chave autorizada exata e identidade comum com o original; assinatura, X509 embutido, digest, protocolo bruto e documento final precisam passar.
- A1 deve ser o mesmo certificado signatário do arquivo; verificação histórica com certificado renovado permanece fora do MVP. Protocolos incompatíveis/duplicados contidos no upload são rejeitados, sem substituição silenciosa. Preservar fragmentos assinados e validar assinatura também depois da composição.
- Procedência `manual_upload` não é prova do canal de obtenção. `sourceChannelVerified=false` e profile XSD explícito.
- Resultado/tela expiram em 15 min; servidor continua sem sessão/credenciais/resultados persistentes. Downloads já feitos não são revogáveis.

## D-015 — XSD oficial fixado e isolado

- Decisão: instalar `libxml2-wasm@0.7.2`, preservando demais versões. Usar snapshot oficial 010c/NT2022.002 v1.30 para leiaute/tipos/assinatura, com entrada procNFe 4.00 oficial do 009n. Origem, hashes e limites de aplicabilidade em `schemas/nfe/README.md`; arquivos oficiais byte-exatos, sem alterações para aceitar fixtures.
- Validação do nfeProc completo é obrigatória para `recovered`; schemas somente locais/allowlisted/hashes, sem fallback antigo ou schema do usuário. `schemaValidated=true` referencia esse perfil, não todas as regras fiscais/NTs possíveis.
- Falha nativa observada usando WASM em worker thread no Node 24/Windows levou à adoção de processo filho isolado. Deadline 5 s, heap V8 128 MiB, buffers sem providers de rede/OS; limites nativos adicionais cabem ao deploy.
- Turbopack tentou resolver programas de filho como assets /ROOT; corrigido com fork em runtime de paths fixos e trace explícito de workers/schemas/pacote. Build e smoke local verificam o empacotamento.

## D-016 — controles de entrada, confiança e recursos

- Decisão: compartilhar admissão por processo (2 operações simultâneas, 10/min por cliente, 60/min global, buckets finitos). Proxy headers só com `TRUST_PROXY=true` e ingress restrito. Múltiplas instâncias exigem limiter distribuído. Modelo de ingress TLS/acesso de piloto em `deploy/nginx.conf.example`, não implantado.
- Corpo total 17 MiB no processamento (dois XML 5 MiB + PFX 2 MiB em base64), 3 MiB na validação; prazo de leitura 5 s, base64 canônico, limite de chunks. XML antes do parser: 64 níveis/60 mil elementos/tag 64 KiB, sem DTD/ENTITY. SEFAZ com deadline total/inatividade 15 s e corpo 2 MiB.
- PFX em processo filho, 5 s/96 MiB heap V8; preservar o parser compatível anterior. Compilar por TypeScript em predev/pretest/prebuild. Nenhum segredo em arquivo, argumento de processo ou log; IPC é efêmero.
- Caminho de certificado verifica assinaturas/datas/CA/âncora configurada pelo operador; âncora obrigatória por padrão em produção. Escopo parcial explícito: não implementa todo PKIX, CRL/OCSP nem histórico de revogação. Cadeia cliente nunca substitui CAs de HTTPS servidor.

## D-017 — reavaliação do node-forge sem remoção incompatível

- Decisão: manter temporariamente node-forge 1.4.0 no caminho PKCS#12/MAC isolado; verificador RSA vulnerável não é invocado. Audit de produção continua com high sem patch. Isolamento reduz impacto de parser/CPU, mas não corrige o advisory de verificação RSA e não constitui aprovação de segurança pública.
- TLS nativo aceita PFX diretamente, mas não oferece parser público completo de identidade/cadeia; PKI.js é candidato mantido investigado, sem compatibilidade comprovada com A1 real/algoritmos legados. Não repetir como fato a generalização anterior de D-010 sobre alternativas auditadas: não há corpus de interoperabilidade real nesta sessão. Substituição aguarda demonstração de compatibilidade.
- Revisão e riscos: `.agents/SECURITY_REVIEW.md`. Sem novo advisory de produção reportado para libxml2-wasm pelo npm; audit npm não prova ausência de vulnerabilidades C/WASM.
- Estado: produção e piloto fiscal operacional não aprovados. Testes sintéticos e smoke de loopback são evidência técnica local, não validação SEFAZ real.
