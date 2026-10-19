# Contexto do projeto

## Produto

Ferramenta pessoal em português brasileiro para recuperação de XML de NF-e/NFC-e, em localhost/Windows por padrão. Não é SaaS comercial nesta fase; sem login, cadastro, cobrança, histórico, banco ou administração. A pessoa envia XML original e certificado A1 temporário com senha, o sistema consulta serviço oficial da SEFAZ e disponibiliza somente o XML efetivamente autorizado e validado.

Stack: Next.js App Router, React, Node.js, TypeScript estrito e Tailwind CSS. Não há banco de dados na primeira versão.

## Caso fiscal que orienta o desenho

- XML original: chave `42260901867724000108650010000257439594944564`, `tpEmis=9`.
- Consulta SEFAZ: cStat 613, chave alternativa informada `42260901867724000108650010000257431536139497`.
- Consulta à chave alternativa: cStat 100, protocolo `242261498431821`; chave alternativa tem `tpEmis=1`.
- A chave de contingência e a chave alternativa identificam documentos assinados distintos.

Não anexar o protocolo da chave alternativa ao documento de contingência. Preservar XML e assinatura recebidos. Recuperar o XML autorizado original correspondente à chave autorizada ou declarar indisponibilidade, sem gerar XML corrigido. Validade sintática não equivale a validade fiscal.

## Limites funcionais

O produto apenas consulta e recupera documentos. Não autoriza/transmite novas notas, não altera XML nem assinatura e não promete recuperação quando o mecanismo oficial disponível não fornece o XML autorizado. Nenhum teste automatizado deve chamar produção SEFAZ.

A fase fiscal adicionou o envio manual de um segundo XML assinado obtido externamente: original, candidato, A1 e senha são reenviados, e a consulta é refeita. Só libera arquivo se chave/identidade/assinatura/digest/protocolo bruto e XSD completo coincidirem. Há portal interativo SVRS com certificado; não foi localizada API pública automática de download NFC-e na documentação consultada. Ver SVRS_RECOVERY_RESEARCH.md para o caso SC e limites de elegibilidade.

Os perfis XSD oficiais 009n/010c e suas limitações constam em schemas/nfe/README.md. A política NFE_SCHEMA_POLICY_JSON seleciona um único perfil qualificado por modelo/UF/ambiente/data, sem fallback; ausente ou ambígua bloqueia download. XSD não substitui regras fiscais/PKIX/revogação. A1 real e consulta real continuam não validados; os testes são sintéticos, não consultas fiscais reais.

## Dados temporários

Certificado e senha são reenviados por operação e processados apenas em memória no servidor Node.js. Não há armazenamento persistente. Não registrar segredos nem conteúdo integral do XML em logs. Scripts vinculam 127.0.0.1 com Host/Origin conferidos e permitem HTTP só nesse modo; acesso remoto futuro exige HTTPS e controle de acesso. README.md orienta inicialização e testes manuais autorizados.
