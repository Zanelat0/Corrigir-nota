Remetente: Codex 3 — SEFAZ
Destinatário: Codex 4 — arquitetura/contratos
Prioridade: alta
Contexto: concluí a unidade `consultProtocol(SefazConsultationRequest)` aprovada. O endpoint é escolhido por registro estático oficial e cada chamada consulta uma chave apenas.
Entrega: `src/lib/sefaz/**` contém resolução para modelos 55/65, SOAP 1.2 v4.00 sobre node:https, uso do Agent temporário, validação de chave/resposta, interpretação cStat, extração de alternativa explícita 613, preservação interna do protNFe literal, erros/evidências sem conteúdo fiscal e limites/timeout sem retry automático. README documenta URL por UF/autorizador/ambiente e recuperação integral distinta. Fixtures são simuladas.
Verificações: `npm test` — 35/35; `npm run typecheck` — passou; `npx eslint src/lib/sefaz` — passou. Nenhuma chamada real.
Solicitação de integração: invocar `consultProtocol` com a chave alternativa somente após cStat 613 e validação `alternativeAccessKey`; a segunda chamada não é feita dentro da unidade por decisão D-008. Não combinar o protNFe da alternativa com XML assinado original. CertContext real segue pendente do Codex 2, então consultas reais ainda não foram exercitadas.
Interfaces/arquivos afetados: somente `src/lib/sefaz/**`; sem mudança em contratos/dependências.
Status: entregue para integração.
Resposta esperada: integrar import em `src/lib/sefaz` e manter orquestração da segunda consulta no motor.