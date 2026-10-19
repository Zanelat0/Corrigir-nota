# Schemas oficiais NF-e/NFC-e 4.00 — snapshot local

## Seleção vigente — 2026-10-18

Não se aplica mais um pacote único a todos os documentos. `schema-policy.ts` exige NFE_SCHEMA_POLICY_JSON com regra única qualificada por modelo 55/65, cUF, tpAmb e data de emissão (from/through inclusivos), com referência de vigência. Ausência/sobreposição/fora da faixa: SCHEMA_POLICY_UNAVAILABLE, sem download. Versão 4.00 é exigida no parser.

Perfis: `NFe-4.00-PL009n-NT2023.004-v1.01+NT2019.001-v1.62` usa cinco arquivos originais 009n/hashes próprios; `NFe-4.00-PL010c-NT2022.002-v1.30+proc009n` preserva a composição anterior. Ambos passaram com documento sintético completo. Nunca se tenta o outro após falha. ZIPs oficiais abaixo permanecem inalterados.

O nome/data de uma NT não comprova vigência para uma emissão específica. Não há calendário fiscal real pré-aprovado: qualificar por ato oficial/UF/ambiente, inclusive convivência. Portal Nacional não respondeu à ferramenta de pesquisa nesta sessão; SVRS foi consultada como fonte oficial alternativa. Não se inferiu que 010c cubra todas NTs 2026. Exemplo no README raiz é exclusivamente sintético. Onde o histórico abaixo menciona perfil único, esta seção o supera.

Obtidos diretamente da página [Documentos NF-e da SVRS](https://dfe-portal.svrs.rs.gov.br/Nfe/Documentos) em 2026-10-17, sem certificado e sem enviar dados fiscais. Os arquivos oficiais não foram editados.

| Arquivo público | SHA-256 do ZIP | Uso |
| --- | --- | --- |
| PL_009n_NT2023_004_v101_e_NT2019_001_v162.zip | 8E269CD5D5D60532B709C8A88BF590323B94002EFD3A49935FB5FD2DB5957A62 | entrada `procNFe_v4.00.xsd`, inalterada, inclui `leiauteNFe_v4.00.xsd` |
| PL_010b_NT2025_002_v1.30.zip | 2DEAA8D430D0ACB47DEAE06B9B6D1202DBB436BAF3D2D3AA834A534A3D6FA1B8 | referência arquivada; não é fallback de aceitação |
| PL_010c_NT2022_002v1.30.zip | ACEB8DF3BA5235AEA4DCAC2502A68EF00C6CD34F1D26CB3F6EEBAE9D675CD0FC | leiaute, tipos básicos, RTC, XMLDSig e entrada NFe |

Downloads oficiais reproduzíveis:

- https://dfe-portal.svrs.rs.gov.br/NFE/DownloadArquivoEstatico/?sistema=NFE&tipoArquivo=2&nomeArquivo=PL_009n_NT2023_004_v101_e_NT2019_001_v162.zip
- https://dfe-portal.svrs.rs.gov.br/NFE/DownloadArquivoEstatico/?sistema=NFE&tipoArquivo=2&nomeArquivo=PL_010b_NT2025_002_v1.30.zip
- https://dfe-portal.svrs.rs.gov.br/NFE/DownloadArquivoEstatico/?sistema=NFE&tipoArquivo=2&nomeArquivo=PL_010c_NT2022_002v1.30.zip

Perfil executado: `NFe-4.00-PL010c-NT2022.002-v1.30+proc009n`. O loader lê os cinco XSDs do pacote 010c e a entrada procNFe do 009n, verifica seus hashes individuais fixados em `src/lib/nfe/schema.ts` e fornece somente esses buffers ao libxml2. As inclusões relativas resolvem para a versão 010c selecionada. Nenhum schema indicado pelo usuário ou localização remota é carregado. O documento completo `nfeProc`, incluindo assinatura e protocolo, deve passar; não se tenta um perfil antigo quando há erro.

A versão 4.00 do XML, sozinha, não identifica a NT. O snapshot 010c é o pacote de leiaute listado na página consultada; essa página também relaciona NTs posteriores (incluindo RTC 1.51 e CNPJ alfanumérico). Não se afirma que o snapshot incorpore todas as NTs futuras ou regras vigentes por data/UF. Documentos com campos novos ou formas não contempladas falham de forma fechada. A qualificação do perfil perante o autorizador/data de emissão é requisito do piloto; não baixar ou substituir schemas silenciosamente em runtime.

O XSD oficial desse snapshot fixa RSA-SHA1/SHA1 no leiaute XMLDSig. O verificador criptográfico suporta algoritmos adicionais, mas o gate XSD permanece oficial e pode rejeitá-los. Essa restrição não é removida para fazer um teste passar. Fixtures de aceitação usam SHA1 somente para reproduzir o leiaute oficial; certificados sintéticos são assinados com SHA256. Nenhum documento fiscal é assinado ou transmitido pelo produto.

XSD valida estrutura/tipos e restrições do schema. Não reexecuta todas as regras fiscais, cálculo de impostos, credenciamento, cadeia PKIX completa, revogação ou prova de disponibilidade do documento. Essas verificações não devem ser inferidas de `schemaValidated: true`.
