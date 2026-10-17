# Status — Codex 4, fase fiscal

Estado: implementação local e aceitação sintética concluídas. Produção e piloto fiscal operacional não aprovados.

Entregas: investigação do Download XML NFC-e SVRS; segundo XML no DTO/UI/API; orquestração com consultas refeitas; identidade/assinatura/X509/digest/protocolo bruto/XSD; snapshot oficial byte-exato com hashes; PFX e XSD em filhos limitados; rate/concurrency/limites/timeouts/TLS; trust parcial com âncoras obrigatórias por padrão em produção; expiração 15 min; documentação, mensagens e exemplo de ingress.

Arquivos próprios/compartilhados: src/lib/nfe/**, src/lib/security/**, src/types/contracts.ts, processar/route.ts, package/config/workers, schemas/nfe/**, deploy e .agents. Módulos entregues dos agentes foram preservados e ampliados com comunicação prévia: page.tsx/panel/upload/testes de UI, certificado/rota/worker/trust, SEFAZ deadlines/preflight. Não houve lock conflitante ou mensagem posterior de trabalho simultâneo.

Verificação: typecheck e lint limpos; npm test 84/84 em 11 arquivos; build e smoke de loopback aprovados; npm audit --omit=dev retorna um high node-forge sem patch. Todas as consultas dos testes são simuladas e certificados/XMLs sintéticos. Nenhuma chamada real à SEFAZ.

Pendências: A1/consulta real autorizados; elegibilidade/download autenticado real; qualificação da NT/UF/data de schema; PKIX/revogação completos; certificado signatário após renovação; revisão do advisory e alternativa compatível; ingress/autenticação/limites distribuídos/cotas de runtime reais. Acesso a portal não é uma API automática documentada.

Fontes/resultados detalhados: STATUS.md, ACCEPTANCE.md, SECURITY_REVIEW.md, SVRS_RECOVERY_RESEARCH.md, CONTRACTS.md, ARCHITECTURE.md e decisões D-013 a D-017. Reservas de edição liberadas após revisão final; operações Git centralizadas pelo coordenador.
