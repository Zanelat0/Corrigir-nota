# Corrigir Nota — coordenação dos agentes

## Inicialização obrigatória

No começo de cada sessão, leia por inteiro, nesta ordem: `AGENTS.md`, `.agents/PROJECT_CONTEXT.md`, `.agents/ARCHITECTURE.md`, `.agents/CONTRACTS.md`, `.agents/DECISIONS.md` e `.agents/STATUS.md`. Confira também sua caixa em `.agents/messages/agent-N/` antes de começar, antes de mudanças relevantes e ao concluir uma etapa. Não existe monitoramento automático.

## Objetivo e contexto fiscal

Este SaaS recupera XML de NF-e/NFC-e usando certificado A1 temporário e consulta oficial à SEFAZ. O XML original informado contém a chave `42260901867724000108650010000257439594944564`; a consulta retornou cStat 613 e indicou a chave `42260901867724000108650010000257431536139497`. A consulta da segunda chave retornou cStat 100 e protocolo `242261498431821`. A primeira chave tem `tpEmis=9` (contingência) e a segunda `tpEmis=1`.

As chaves representam documentos assinados distintos. Nunca anexe o `protNFe` da segunda chave ao XML da primeira. Preserve XML e assinatura originais. Só disponibilize XML recuperado quando ele for o documento efetivamente autorizado e suas chaves, assinatura, documento e protocolo tiverem sido conferidos. XML bem formado ou sintaticamente válido não é prova de autorização. Se o XML autorizado correspondente não puder ser recuperado, informe essa impossibilidade e não produza XML corrigido. O sistema não autoriza, transmite nem altera notas.

## Papéis e ownership

- Codex 1 — frontend: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**`, `public/**`.
- Codex 2 — certificados: `src/lib/certificate/**`, `src/app/api/certificado/validar/route.ts`.
- Codex 3 — SEFAZ: `src/lib/sefaz/**`.
- Codex 4 — arquitetura, contratos e motor XML: `src/lib/nfe/**`, `src/app/api/notas/processar/route.ts`, `src/types/contracts.ts`, `package.json` e configuração compartilhada.

Cada agente edita somente os arquivos sob seu ownership. O Codex 4 mantém também os documentos compartilhados e `STATUS.md`. Mudanças em contratos, dependências ou configuração compartilhada são feitas apenas pelo Codex 4; os demais solicitam mudanças por mensagem e aguardam aprovação. Mudanças aprovadas são anotadas em `.agents/DECISIONS.md`. Arquivos de interface e backend pertencem aos respectivos agentes, inclusive quando ainda forem criados.

## Comunicação e concorrência

Cada agente mantém `.agents/status/agent-N.md` e sua caixa `.agents/messages/agent-N/`. Mensagens são arquivos únicos e não compartilhados, com nome `YYYYMMDD-HHMMSS-agentN-para-agentM-assunto-id.md`; inclua remetente, destinatário, prioridade, contexto, solicitação, interfaces afetadas, status e resposta esperada. Use identificador adicional para evitar colisões. Não deixe dois agentes editar o mesmo arquivo de mensagem.

`.agents/locks/` registra reservas de recursos compartilhados. Antes de editar, confirme ownership e procure reservas/conflitos; locks são informativos e não substituem coordenação. Se surgir conflito, interrompa a edição conflitante, registre mensagem na caixa pertinente e reporte o bloqueio. Não sobrescreva alterações inesperadas. Não faça commits concorrentes: coordene operações Git pelo Codex 4.

## Segurança e qualidade fiscal

- Certificado e senha são fornecidos a cada utilização e existem somente durante o processamento em memória. Não persista certificados ou senhas em arquivos, logs, banco, cookies ou `localStorage`.
- Segredos e operações criptográficas ficam no runtime Node.js; nunca no browser/Edge. Produção exige HTTPS.
- Limite tamanho e tipo de uploads. Faça parsing XML com proteção contra XXE e sem resolução de entidades externas.
- Testes automatizados não conectam à produção da SEFAZ. Fixtures/simulações devem ser claramente identificadas e nunca apresentadas como resposta oficial.
- Não registrar XML, certificado ou senha em logs. Respostas públicas devem minimizar dados pessoais.

## Interfaces para implementação

- Codex 1: consuma apenas os contratos/API descritos em `.agents/CONTRACTS.md`. Envie certificado e senha apenas no POST de validação; para processar, envie-os novamente no corpo do POST de processamento. Nunca guarde senha no estado persistente do browser.
- Codex 2: implemente validação A1 no runtime Node.js, resposta pública `CertificateValidationResult` e contexto interno efêmero `CertificateContext`. Não persista o PFX, a chave privada nem a senha.
- Codex 3: implemente adaptadores SEFAZ em `src/lib/sefaz/**`, com resultados tipados `SefazConsultationResult`; preserve resposta e código oficial, sem inventar sucesso. Sem endpoint/ambiente credenciado, reporte indisponibilidade tipada.
- Codex 4: mantém `src/lib/nfe/**`, rota de processamento, contratos e integração. O motor deve ler `infNFe/@Id`, ide, emit, assinatura e QR Code quando houver; interpretar cStat 613/chave alternativa e cStat 100; validar identidade do documento e protocolo; só retornar XML correspondente ao autorizado e validado.

## Protocolo de entrega

Ao terminar uma etapa, atualize seu status individual com arquivos alterados, interfaces e pendências. O Codex 4 verifica caixas e integra dependências somente após receber a conclusão. `STATUS.md` só é editado pelo Codex 4. Não declarar módulos de outros agentes concluídos sem evidência de entrega e integração.
