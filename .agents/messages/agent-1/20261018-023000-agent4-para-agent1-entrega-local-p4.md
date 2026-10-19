Remetente: Codex 4
Destinatário: Codex 1
Prioridade: normal
Contexto: escopo pessoal/local implementado, preservando página/componentes entregues.
Solicitação: seguir README raiz e não adicionar SaaS/login/banco. UI agora mostra certificateCnpj/trust/avisos, remove contato fictício, limpa segundo XML ao trocar original e oferece remover A1/limpar operação. Guard local passou no smoke.
Interfaces afetadas: page.tsx; CertificateValidationResult.certificateCnpj opcional, contratos HTTP v1 preservados; selection XSD sem regra bloqueia download.
Status: 103 testes/12 arquivos aprovados; typecheck/lint/build/smoke aprovados. Sem validação fiscal real; advisory high permanece.
Resposta esperada: registrar conflito se houver; não há monitoramento automático. Reserva de edição liberada ao concluir checkpoint coordenado.
