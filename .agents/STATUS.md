# Status geral — revisão vigente de 2026-10-18

## Uso exclusivamente pessoal/local

Baseline 63d4678 conferida sem alterações e reexecutada: 84 testes/11 arquivos, typecheck/lint aprovados. Escopo atual substitui SaaS: uma página, sem login/banco/histórico/contas/cobrança; módulos funcionais preservados. Documentação histórica abaixo não exige ingress/infra distribuída para localhost.

Entregas: scripts dev/start fixam 127.0.0.1; guard local HTTP confere Host/Origin/porta/Fetch Metadata e proíbe proxy. Headers defensivos; smoke pelo launcher real, sem proxy HTTPS fictício. UI pessoal com remoção do A1, CNPJ/trust/avisos; drag/drop limpa segundo XML e chamadas abortadas antigas não alteram loading novo.

XSD: perfis oficiais 009n histórico e 010c com hashes; NFE_SCHEMA_POLICY_JSON exige regra única modelo/UF/ambiente/data/referência, sem fallback ou vigência inventada. Política ausente/ambígua/fora da faixa bloqueia download. Calendário real ainda não qualificado. Revogação obrigatória configurada bloqueia, pois CRL/OCSP ainda não está implementado. Trust parcial/mesmo A1 signatário mantidos.

Verificação atual: **103 testes em 12 arquivos**, typecheck/lint limpos; build sem warnings e smoke HTTP loopback aprovados. Audit de produção: um high node-forge sem patch, exit 1. Dependências preservadas, nenhuma instalada/substituída/atualizada; lockfile inalterado. Fonte oficial/advisory/registry revistos. Erros introduzidos de tipagem de teste, alias localhost e tracing amplo foram corrigidos e registrados em ACCEPTANCE.md.

SEFAZ: adaptador protocolar 55/65 preservado, endpoints públicos revistos, sem consulta real. 613/100, protocolo/assinatura/XSD/upload manual testados com dados sintéticos. Nenhuma API automática pública documentada de download NFC-e localizada; portal interativo não foi automatizado. Sem A1 real, CRL/OCSP/PKIX completos, calendário real XSD ou recuperação/download autenticados comprovados.

Estado operacional: demonstração local sintética disponível; **uso fiscal pessoal ainda não validado**. Falta configurar âncoras públicas, qualificar schema NT/UF/data/ambiente e executar checklist autorizado com A1 real/homologação; produção somente leitura em teste separado expressamente autorizado. Advisory permanece risco residual. Memória nativa/WASM não tem quota SO rígida. Guia exato em README.md.

Comunicação: ownership/locks/status/caixa agent-4 revisados, sem novas mensagens/conflitos; especialistas avisados em arquivos únicos. Não há monitoramento automático. Codex 4 coordena Git. As informações seguintes são histórico da fase fiscal anterior, não o escopo atual.

## Histórico — 2026-10-17

Estado: fase de recuperação manual/validação estrutural integrada e validada localmente; sem aprovação para produção ou piloto fiscal operacional.

## Entregas efetivas

- Base dos agentes 1/2/3 preservada e integrada; mudanças cruzadas desta fase foram comunicadas em mensagens e reservadas pelo coordenador.
- Pesquisa oficial SVRS concluída: link de Download XML interativo com certificado ICP-Brasil; não foi localizada API pública automática documentada. Caso SC/modelo 65 está no autorizador SVRS, mas elegibilidade/arquivo específicos continuam sem teste autenticado.
- UI oferece segundo upload após `XML_AUTORIZADO_INDISPONIVEL`. API recebe `authorizedXmlBase64` opcional e refaz consultas com certificado/senha reenviados; não guarda sessão de credenciais.
- Motor valida chave, identidade comum, ambiente, assinatura vinculada ao mesmo A1 signatário/X509 embutido, digest, protocolo bruto e XSD completo. Fragmentos NFe/protNFe não são reserializados. Segundo XML arbitrário/protocolo incompatível é bloqueado.
- XSD oficial local com perfil/hashes registrados; sem fallback antigo, schema do usuário ou consulta remota. Procedência distingue upload manual e não atesta canal externo.
- PFX e XSD em processos filhos limitados; XML com limites prévios, DTD/ENTITY bloqueados; rate limit/concorrência por processo, limite e prazo de uploads; HTTPS com proxy confiável explícito.
- Avaliação parcial de caminho até âncora configurada, obrigatória por padrão em produção. Não é PKIX completo, CRL/OCSP ou prova de credenciamento.
- Resultados/sessão da UI expiram em 15 min; novos envios refazem consultas. Servidor sem banco/cache de XML/PFX/senha/resultados.

## Verificação final

- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado, sem warnings.
- `npm test`: 84 testes / 11 arquivos aprovados, dados sintéticos e consultas simuladas.
- `npm run build`: aprovado, Next 16.4.2 e ambos endpoints compilados.
- `npm run test:smoke`: aprovado no build em loopback, A1 sintético/rota compilada/tracing; nenhuma consulta SEFAZ.
- `npm audit --omit=dev`: exit 1, um high node-forge GHSA-86w9-cpqp-85rv, sem patch. Dependência mantida para compatibilidade ainda não demonstrada por alternativa; restrita a PKCS#12 e isolada, sem verificador RSA vulnerável.
- Dependência nova desta fase: libxml2-wasm 0.7.2; lockfile atualizado. Dev ainda possui advisory braces transitivo da configuração lint.

## Pendências materiais

- Testar A1 real, confiança/interop e autenticação/consulta em ambiente especificamente autorizado; nenhuma chamada real foi feita nesta fase.
- Confirmar acesso/retorno do Download XML interativo com a chave autorizada real; lista exaustiva de papéis/regras por UF não confirmada no portal público.
- Qualificar o perfil XSD fixado para NT/UF/data do piloto; não inferir que layout 4.00 cubra todas as NTs posteriores. XML com campos fora do perfil falha fechado.
- Revogação, políticas/pathLen/name constraints PKIX completos e assinatura histórica com certificado renovado não implementados.
- Avaliar/substituir node-forge somente com compatibilidade comprovada, ou formalizar mitigação adequada. Audit continua não limpa.
- Ingress com autenticação de piloto, TLS real, limites distribuídos por réplica, logs seguros e cotas SO/container precisa ser aplicado/testado pelo operador. O exemplo não é deploy concluído.

## Continuidade por agente

- Codex 1: revisar o novo upload/expiração no uso supervisionado; contrato aditivo preserva campos anteriores e reforça gates de download.
- Codex 2: qualificar corpus A1 real consentido e alternativa mantida; expandir PKIX/revogação sem persistir credenciais e sem enfraquecer CAs do servidor.
- Codex 3: confirmar endpoints/credenciamento e interpretar consultas reais autorizadas; não converter portal interativo em API sem documentação oficial.
- Codex 4: liderar qualificação de schemas, testes externos autorizados e revisão fiscal antes de liberar piloto operacional.

Referências: CONTRACTS.md, ARCHITECTURE.md, DECISIONS.md (D-013 a D-017), ACCEPTANCE.md, SECURITY_REVIEW.md, SVRS_RECOVERY_RESEARCH.md e schemas/nfe/README.md. Caixas e locks foram revisados; não há monitoramento automático.
