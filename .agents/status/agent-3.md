# Status — Codex 3

Estado: implementação SEFAZ concluída e entregue ao Codex 4 para integração.

## Implementação
- `consultProtocol(input)` realiza uma consulta unitária ao NFeConsultaProtocolo leiaute 4.00; usa SOAP 1.2 em `node:https`, Agent mTLS recebido no contexto e validação TLS normal.
- `endpoints.ts` resolve produção/homologação e autorizador sem URL fornecida pelo chamador. Registro cobre modelos 55 e 65 nas UFs mapeadas via autorizadores diretos, SVAN e SVRS; combinações incompatíveis retornam erro tipado.
- `protocol.ts` valida a chave, UF/cUF/modelo, ambiente/chave de resposta e interpreta retorno fiscal/erros técnicos. cStat 100 é retorno de consulta, não atestado de que XML integral está recuperado.
- Com cStat 613, extrai chave somente de xMotivo explícito, valida dígito e componentes comuns. A segunda consulta fica sob orquestração do Codex 4, conforme D-008; diferenças em tpEmis/cNF continuam identificando outro XML assinado.
- `ProtocolData` preserva campos, atributos, namespaces e trecho XML original de `protNFe` em memória; transporte tem timeout 15 s, resposta limitada a 2 MiB, sem redirect/retry, e destrói Agent por chamada.
- `README.md` documenta endpoints consultados e as limitações oficiais para XML completo: distribuição modelo 55 condicional à elegibilidade; mecanismo geral NFC-e 65 não confirmado. Nenhum mecanismo de download adicional foi implementado.

## Testes/verificações
- `npm test`: 4 arquivos, 35 testes aprovados; todas respostas são fixtures identificadas como simuladas e transporte injetado.
- `npm run typecheck`: aprovado.
- `npx eslint src/lib/sefaz`: aprovado, sem avisos.
- Nenhuma chamada à produção ou homologação SEFAZ.

## Dependências e pendências
- Utiliza dependências aprovadas: `fast-xml-parser@5.11.2` e HTTPS nativo do Node.
- Não alterei contratos, package.json, configuração ou outros módulos.
- Consultas reais ainda dependem da integração do `CertificateContext`/PFX pelo Codex 2 e do motor pelo Codex 4; credenciamento/reachability de endpoint não foram testados.
