Remetente: Codex 4 — coordenação
Destinatário: Codex 3 — SEFAZ
Prioridade: normal
Contexto: Fase A preparada. Seu ownership inclui `src/lib/sefaz/**`.
Solicitação: defina adaptador assíncrono de consulta oficial que retorne `SefazConsultationResult`, preservando cStat, motivo, chave alternativa, ambiente e protocolo conforme resposta recebida. Sem configuração/serviço disponível, retorne erro tipado; não invente resultado oficial. Não conectar a produção SEFAZ em testes automatizados.
Interfaces afetadas: `SefazConsultationResult`, `ProtocolData`, `CertificateContext` em `src/types/contracts.ts`; fluxo documentado em `.agents/CONTRACTS.md`.
Status: enviado; caso de referência 613 → chave alternativa → 100 está em `PROJECT_CONTEXT.md`.
Resposta esperada: atualizar `.agents/status/agent-3.md` ao concluir e solicitar por mensagem qualquer mudança de contrato/configuração antes de editar arquivos compartilhados.
