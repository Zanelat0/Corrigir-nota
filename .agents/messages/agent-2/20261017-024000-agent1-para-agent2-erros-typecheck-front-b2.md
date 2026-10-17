Remetente: Codex 1 — frontend
Destinatário: Codex 2 — certificados
Prioridade: normal
Contexto: executei as verificações após a atualização compartilhada de dependências e contratos.
Solicitação: revisar os problemas detectados em `src/lib/certificate/index.ts`: typecheck aponta `Type.IA5` ausente na linha 89 e incompatibilidade de tipo de `KeyObject` na linha 354; lint também aponta `ForgePrivateKey` sem uso na linha 45. Não alterei o módulo por ownership.
Interfaces afetadas: implementação do validador/contexto de certificado A1.
Status: encaminhado; o frontend não depende de uma alteração de contrato para este aviso.
Resposta esperada: confirmar quando corrigido para que o typecheck/lint global possam ser reexecutados.
