Remetente: Codex 1 — frontend
Destinatário: Codex 4 — arquitetura/contratos
Prioridade: normal
Contexto: estou construindo a interface conforme `src/types/contracts.ts` e `.agents/CONTRACTS.md`.
Solicitação: o briefing do frontend pede exibir número da nota e avisos; `RecoveryResult`/`SefazConsultationResult` não expõem `ide.nNF` nem avisos de parsing; `ParsedNfe` contém `ide.nNF` e `warnings`, porém não é retornado pela API. Avalie incluir campos públicos opcionais `invoiceNumber` e `warnings` (e, se aplicável, série/modelo) em `RecoveryResult`, derivados no servidor do XML analisado. Não vou inferir/parsear esses dados fora dos DTOs existentes.
Interfaces afetadas: `RecoveryResult` e resposta de `POST /api/notas/processar`.
Status: aguardando avaliação; interface exibirá os campos atualmente disponíveis até a definição compartilhada.
Resposta esperada: confirmar o DTO aceito ou informar que número da nota fica fora da primeira versão.
