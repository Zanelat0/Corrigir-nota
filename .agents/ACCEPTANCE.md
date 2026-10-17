# Aceitação técnica — 2026-10-17

Dados de testes são sintéticos, certificados/chaves gerados em memória e consultas injetadas/simuladas. Não há certificado real nem consulta à SEFAZ de produção/homologação nesta evidência.

| Caso solicitado | Evidência reproduzível | Resultado |
| --- | --- | --- |
| A. Mesma chave XML/protocolo | acceptance.test.ts: assinatura real sintética, digVal, XSD completo modelo 65; modelo 55 validado também | aprovado |
| B. Original difere da autorizada | acceptance.test.ts/recovery.test.ts: diagnóstico, nenhum XML retornado | aprovado |
| C. 613 → alternativa → 100 | duas chamadas simuladas, componentes da alternativa e protocolo conferidos | aprovado |
| D. Segundo XML autorizado | acceptance.test.ts e process-route.test.ts: A1 sintético real, API JSON, assinatura/XSD/protocolo, fragmento original preservado | aprovado |
| E. Assinatura/protocolo incompatíveis | conteúdo alterado, KeyInfo substituído, ID errado, digVal errado, XML bruto divergente, protocolo embutido incompatível, XML manual de outro modelo | aprovado |
| F. Serviço indisponível | TIMEOUT/DNS/TLS/HTTP simulados, resultado tipado sem download; testes do adaptador SOAP/falhas | aprovado |
| G. Certificado/CNPJ | PFX expirado/sem chave/senha errada/usos, contexto expirado, raiz CNPJ divergente, cadeia/âncora ausente/inválida | aprovado |
| H. Concorrência/limites/rede | slots e liberação idempotente, janelas, buckets finitos, limite de corpo/base64, prazo/stream interrompido, proxy forjado, XML profundo/excessivo/DTD | aprovado |

Reprodução: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:smoke`, `npm audit --omit=dev`, todos a partir da raiz. Os scripts pretest/prebuild/predev compilam os filhos de certificado com TypeScript; não exigem OpenSSL CLI, Java ou toolchain C.

Rodada final: typecheck aprovado; lint aprovado sem warnings; 84 testes em 11 arquivos aprovados; build Next 16.4.2 aprovado; smoke aprovado; audit de produção retorna exit 1 com um high node-forge sem patch. O smoke sobe temporariamente o build em 127.0.0.1, usa A1 sintético, exercita validação e rejeita XML não fiscal antes da consulta. Nenhum PFX/senha/documento XML fiscal real ou chamada SEFAZ foi usado. Algumas fixtures legadas de regressão reutilizam as chaves fornecidas no briefing; seus conteúdos e retornos são fabricados para teste, sem recuperar o documento correspondente.

## Problemas encontrados nesta fase e resolução

- Preexistente: advisory high node-forge e avisos dev de braces; permanecem explícitos. Não há API pública oficial de recuperação integral NFC-e confirmada.
- Introduzido/descoberto na integração: libxml2-wasm em worker thread apresentou falha nativa no Node 24/Windows. Processo filho substituiu o thread e foi validado nos testes/build/smoke.
- Introduzido no build: Turbopack tentou resolver os programas de filho como paths /ROOT. fork em runtime e tracing explícito de assets/pacote corrigiram o empacotamento; smoke verifica rota compilada.
- Comportamento endurecido: fixture XML incompleta que antes passava apenas por gates simulados agora deve falhar XSD. Teste foi atualizado para exigir rejeição; fixtures completas com assinatura e schema reais sintéticos cobrem o caminho positivo.
- Diagnóstico corrigido: indisponibilidade do processo A1/configuração de âncoras retorna falha técnica 503; falha de infraestrutura XSD produz service_unavailable. Os dois casos possuem testes e não são apresentados como rejeição fiscal do arquivo ou certificado inválido.
- Não implementado/pendente: corpus A1 real, consultas reais autorizadas, download interativo real, validação PKIX/revogação completa, qualificação de todas NTs/UF/datas e limite distribuído/deploy. Não são chamados de falhas de teste já executado.

## Parecer de piloto

Apto a demonstração técnica local com dados sintéticos e preparação de homologação supervisionada. Não aprovado ainda para piloto fiscal operacional com clientes ou produção pública. Exige antes configurar ingress/acesso/âncoras, avaliar formalmente o advisory residual, qualificar o schema aplicável, testar A1 e consultas reais autorizadas e conferir um XML autorizado real com revisão técnica/fiscal. O upload manual está funcional nos testes de ponta a ponta, mas não substitui essa validação externa.
