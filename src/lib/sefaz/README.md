# Consulta SEFAZ por protocolo

Implementação de `consultProtocol(input)` como consulta unitária, exclusivamente de leitura, ao Web Service `NFeConsultaProtocolo` leiaute 4.00. O motor do Codex 4 decide se uma resposta 613 justifica uma chamada separada à chave indicada; esta biblioteca não transmite NF-e nem compõe/edita XML fiscal.

## Endpoints no registro

O endpoint não vem do chamador. `resolveProtocolEndpoint` confere modelo, UF, `cUF`, autorizador e ambiente contra um registro estático de URLs HTTPS publicado nos portais oficiais. Há seleção distinta para NF-e modelo 55, NFC-e modelo 65, produção e homologação:

- NF-e 55: endpoints estaduais diretos para AM, BA, GO, MG, MS, MT, PE, PR, RS e SP; SVAN para MA; SVRS para AC, AL, AP, CE, DF, ES, PA, PB, PI, RJ, RN, RO, RR, SC, SE e TO.
- NFC-e 65: endpoints diretos listados para AM, GO, MS, MT, PR, RS e SP; SVRS para AC, AL, AP, BA, CE, DF, ES, MA, MG, PA, PB, PE, PI, RJ, RN, RO, RR, SC, SE e TO.
- UFs sem combinação documentada no registro ou `authority` incompatível falham com `UNSUPPORTED_AUTHORITY`; não há fallback por domínio construído nem URL arbitrária.

As URLs são as relações de Web Services/Consulta Protocolo v4.00 consultadas nos portais nacionais e da SVRS em 17/10/2026. Os portais atualizam essas relações; revise `endpoints.ts` contra os portais antes de cada mudança de ambiente ou implantação:

- Portal Nacional NF-e, [relação de Web Services](https://www.nfe.fazenda.gov.br/portal/webServices.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=1rS27BEDS6c%3D): tabela dos autorizadores, UF atendidas por SVAN/SVRS, endpoints de NF-e e homologação.
- SVRS, [serviços NF-e](https://dfe-portal.svrs.rs.gov.br/Nfe/Servicos) e [serviços NFC-e](https://dfe-portal.svrs.rs.gov.br/NFCE/Servicos): endpoints e versões 4.00 por ambiente, incluindo a tabela NFC-e.
- SEFAZ-SP, [URLs de Web Services](https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/URL-WEBSERVICES.aspx): endpoints NF-e estaduais de produção e homologação.
- MOC 7.0, [Visão Geral](https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais/moc7-visao-geral.pdf): contrato SOAP 1.2/TLS com autenticação mútua e leiaute `consSitNFe`/`retConsSitNFe` 4.00.

O registro não consulta endpoint de contingência SVC: uma chave NF-e já contém a UF/modelo/ambiente, mas não identifica que a autorização foi feita em serviço virtual de contingência. Para uma consulta de protocolo normal, a rota seleciona o autorizador listado para a UF/modelo; qualquer exigência operacional da SEFAZ deve ser confirmada pela área fiscal antes de ampliar o registro.

## Requisição e transporte

- SOAP 1.2, `nfeDadosMsg`, namespace WSDL `NFeConsultaProtocolo4` e mensagem `consSitNFe` v4.00 com `tpAmb`, `xServ=CONSULTAR` e a chave de 44 dígitos.
- `node:https`, Agent efêmero vindo de `CertificateContext.createHttpsAgent()`, TLS mínimo 1.2, validação normal do servidor e sem configurar CAs próprias. O Agent é destruído no `finally`; o ciclo de vida do contexto e seu `dispose()` continua pertencendo à requisição do motor.
- Timeout padrão 15 s, corpo de resposta limitado a 2 MiB, sem redirecionamentos e sem repetição automática. Isso evita retries que podem gerar consumo indevido. O chamador deve aplicar limites de frequência na API.
- Revisão fiscal: deadline total de 15 s foi adicionado ao timeout de inatividade para limitar DNS/conexão/resposta lenta; preflight limita profundidade/elementos antes do parser. API agora aplica admissão local e exige ingress distribuído para múltiplas réplicas. Download interativo NFC-e foi investigado separadamente em `.agents/SVRS_RECOVERY_RESEARCH.md`; não é tratado como Web Service.
- Erros TLS, DNS, timeout, HTTP, SOAP, XML inválido, configuração e autoridade não suportada retornam `technicalError`; detalhes de exceção, XML bruto, certificado, chave e senha nunca são incluídos em logs/evidências.

## Interpretação

- A resposta precisa estar bem formada, sem DTD/ENTITY, em UTF-8, dentro do limite, e conter um único `retConsSitNFe` no namespace NF-e. XML parser opera com entidades desativadas.
- `success` significa apenas que a consulta recebeu e interpretou uma resposta fiscal; cStat 100 não é, sozinho, declaração de autorização apta a liberar arquivo.
- Campos de resposta oficiais são mantidos como strings. Um protocolo só é retornado se a chave declarada em `infProt/chNFe` não contradiz a chave consultada.
- Com cStat 613, a biblioteca procura uma chave de 44 dígitos expressamente em `xMotivo`, valida dígito verificador e componentes comuns (UF, ano/mês, emitente, modelo, série e número). Diferenças em `tpEmis` e `cNF` são permitidas para a comparação, mas identificam documentos assinados diferentes; motor não deve juntar XML/protocolo entre essas chaves.
- A serialização literal de `protNFe` é preservada em `ProtocolData.originalProtNFeXml` somente no objeto interno. A projeção pública definida pelos contratos exclui esse campo.

## XML integral autorizado

`NFeConsultaProtocolo` devolve situação e, quando previsto, `protNFe`; não devolve o XML NF-e assinado completo. Para modelo 55, o mecanismo oficial candidato é `NFeDistribuicaoDFe`, condicionado à elegibilidade do ator/documento e às regras de manifestação; conhecer a chave não garante o download. Para NFC-e modelo 65, não há mecanismo geral de distribuição do XML integral confirmado neste projeto. O módulo não implementa download por consulta pública, scraping de DANFE ou fontes não verificadas.

## Fixtures e testes

Todos os arquivos `fixtures/simulated-*.xml` são fabricados para testes e não são documentos/respostas SEFAZ oficiais. Testes injetam um transporte simulado em `createSefazConsultationClient`; `consultProtocol` de produção usa somente HTTPS fixo e não possui URL/transporte escolhido pela API.
