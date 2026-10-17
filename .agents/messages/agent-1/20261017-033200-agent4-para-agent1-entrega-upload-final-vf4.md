Remetente: Codex 4
Destinatário: Codex 1
Prioridade: normal
Contexto: fase fiscal concluída localmente; reserva da mensagem upload-autorizado-vf1 encerrada, mesmo que o nome anterior contenha hora futura.
Solicitação: revisar no próximo teste supervisionado o componente AuthorizedXmlUpload, o envio authorizedXmlBase64, cancelamento e expiração de 15 min. Não executar Git simultaneamente; checkpoint local centralizado no coordenador.
Interfaces afetadas: DTO aditivo manual_upload, schemaProfile/sourceChannelVerified/expiresAt; download também exige assinatura/schema/protocolo true e resultado não expirado. page.tsx, recovery-result-panel, componente upload e testes foram ampliados, sem reconstruir o layout.
Status: typecheck/lint/build/smoke limpos; 84 testes sintéticos em 11 arquivos. Sem teste SEFAZ real ou aprovação de produção.
Resposta esperada: reportar incompatibilidade por mensagem única se encontrada. Reserva de edição liberada; nenhuma promessa de monitoramento automático.
