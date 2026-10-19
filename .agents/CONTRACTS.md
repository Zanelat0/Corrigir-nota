# Contratos e APIs — v1, revisão pessoal/local de 2026-10-18

## Alterações vigentes (superam descrições anteriores de modo remoto/perfil único)

- CertificateValidationResult: campo opcional aditivo `certificateCnpj`, sem material privado. UI mostra CNPJ e avisos/trust parcial. Nenhuma mudança nos payloads das duas APIs ou gates de download.
- Scripts pessoais vinculam somente 127.0.0.1 e forçam CORRIGIR_NOTA_LOCAL_ONLY=true/TRUST_PROXY=false. HTTP permitido exclusivamente nesse modo. Guard confere URL/Host loopback, mesma porta, Origin exato ao Host e Fetch Metadata. Violações: 403 INVALID_REQUEST/no-store antes de processar. Next pode normalizar URL como localhost sem impedir Host 127.0.0.1. Fora desse modo permanece exigência HTTPS do build. Eventual remoto exige controle de acesso apropriado e não foi preparado nesta etapa.
- NFE_SCHEMA_POLICY_JSON: configuração pública do operador, até 64 regras/32 KiB; campos `profile`, `model` (55/65), `cUF`, `tpAmb` (1/2), `from`, `through` (ISO inclusivas), `reference` (critério de qualificação). Exige uma única correspondência com versão 4.00/modelo/UF/ambiente/data do XML. Perfis: `NFe-4.00-PL009n-NT2023.004-v1.01+NT2019.001-v1.62` e `NFe-4.00-PL010c-NT2022.002-v1.30+proc009n`. Política ausente/inválida/ambígua/fora da faixa: SCHEMA_POLICY_UNAVAILABLE, service_unavailable, sem XML. Não é rejeição fiscal SEFAZ. Não há calendário real pré-aprovado nem fallback após falha; exemplo no README é sintético.
- REQUIRE_CERTIFICATE_REVOCATION=true bloqueia com 503 INTERNAL_ERROR retryable, pois CRL/OCSP não existe ainda. False não significa revogação aprovada. Confiança parcial/âncoras não foram enfraquecidas pelo uso local.
- Uma instância local mantém limiter em memória; não exige login/limiter distribuído. Exemplos antigos de ingress ficam apenas como referência não implantada para eventual remoto.

Origem: `src/types/contracts.ts`. Alterações desta revisão são aditivas, preservam `contractVersion: "1"` e os aliases usados pela UI. Certificado, chave, senha, PEM, Agent e XML SOAP bruto nunca são serializados na resposta HTTP. O XML final validado contém naturalmente os elementos públicos NFe/assinatura/protNFe.

## Operações HTTP

### POST `/api/certificado/validar`

JSON `application/json`:

```json
{ "contractVersion": "1", "certificatePfxBase64": "<PFX base64>", "password": "<senha>" }
```

200: `CertificateValidationResult`, com metadados, warnings e `trust?` sem material privado. `valid: true` representa leitura, chave correspondente, datas/usos locais e política de âncoras configurada; não é atestado completo de conformidade ICP-Brasil ou revogação.

Limites: JSON 3 MiB; PFX 2 MiB decodificado; senha 1–256 caracteres. Não mantém sessão de credenciais.

### POST `/api/notas/processar`

```json
{
  "contractVersion": "1",
  "xmlBase64": "<XML original UTF-8 base64>",
  "certificatePfxBase64": "<PFX base64>",
  "password": "<senha>",
  "authorizedXmlBase64": "<opcional: segundo XML assinado correspondente>"
}
```

O segundo campo XML é opcional. Em um novo envio, original, segundo XML, certificado e senha são reenviados; as consultas são refeitas. A aplicação não confia em chave/protocolo/resultado anterior fornecido pelo browser e não retém a credencial entre chamadas.

Limites: JSON total 17 MiB para comportar dois XMLs de 5 MiB e um PFX de 2 MiB em base64; cada XML é limitado separadamente a 5 MiB. Corpo recebido em até 5 s. Declaração Content-Length não substitui contagem real do stream. Modelo, chave, CNPJ/UF e ambiente (`ide/tpAmb`) são derivados no backend; nenhuma URL fiscal é aceita do cliente.

200: `RecoveryResult` para diagnóstico fiscal, indisponibilidade técnica tipada, rejeição ou recuperação. Uma falha técnica SEFAZ normalmente produz `status: "service_unavailable"`, sem XML. Falha inesperada de integração retorna 500 genérico; nenhuma exceção do parser, TLS ou certificado é devolvida.

Erros comuns, com `{ error: ApiError }`: 400 `INVALID_REQUEST`, 408 `INVALID_REQUEST` (tempo de envio), 413 `PAYLOAD_TOO_LARGE`, 415 `UNSUPPORTED_MEDIA_TYPE`, 422 `CERTIFICATE_INVALID`/`INVALID_XML`, 429 `RATE_LIMITED` com `Retry-After`, 500/503 `INTERNAL_ERROR` (503 com retryable quando processo A1/configuração está indisponível). Infraestrutura XSD indisponível gera `service_unavailable`, sem atribuir rejeição fiscal ao arquivo. `SEFAZ_UNAVAILABLE` e `PROCESSOR_NOT_READY` permanecem no union por compatibilidade; não representam sucesso nem recuperação.

Todas as respostas são `Cache-Control: no-store`. HTTPS é obrigatório em produção. `x-forwarded-proto` e `x-real-ip` só são utilizados com `TRUST_PROXY=true`; o ingress deve sobrescrevê-los e impedir acesso direto ao backend.

## Contexto A1 e confiança

- `createCertificateContext(pfx, password)` consome/limpa o Buffer recebido. O parsing PKCS#12 ocorre em processo filho com deadline 5 s, heap V8 96 MiB e IPC em memória. A chave é convertida para `node:crypto.KeyObject`, fica encapsulada no contexto e é descartada em `dispose()` idempotente no `finally` da rota.
- `CertificateContext`: `certificate: X509Certificate`, cadeia cliente opcional folha + intermediárias, CNPJ/origem, validade, `trust?`, `createHttpsAgent()` e `dispose()`.
- CNPJ: OID ICP-Brasil `2.16.76.1.3.3`, com fallback subject inequívoco; CNPJs ambíguos/inválidos são rejeitados. A política conservadora aceita igualdade e mesma raiz após identidade válida (com aviso); raiz diferente ou CNPJ não identificável bloqueiam por padrão. Configuração/testes em `cnpj-policy.ts`.
- O Agent mTLS envia folha/intermediárias + chave e mantém as autoridades confiáveis padrão do servidor HTTPS. Nunca usa cadeia do cliente como `ca`, nunca desabilita verificação TLS e não segue redirects.
- `CertificateTrustAssessment.status`: `anchored`, `untrusted` ou `not_configured`; escopo explícito `signatures_dates_ca_flags_anchor`; `revocationChecked: false`. Âncoras vêm de `ICP_BRASIL_TRUST_ROOTS_FILE`, configuração pública confiável do operador, nunca do upload. Em produção esse vínculo é obrigatório por padrão; `REQUIRE_TRUSTED_CLIENT_CERTIFICATE=false` é exceção destinada exclusivamente a testes isolados.
- Não há validação RFC 5280 completa (políticas, pathLen/name constraints etc.), CRL/OCSP nem validação histórica de revogação. `anchored` não é sinônimo de PKIX completo. As ligações usam `node:crypto`, não o verificador RSA vulnerável do forge.
- O MVP verifica a assinatura XML com o mesmo certificado A1 signatário apresentado e exige correspondência do X509 embutido. Renovação/troca de certificado do signatário exige evolução específica; não substituir o certificado embutido nem assumir validade de um arquivo apenas por possuir outro A1 da empresa.

## Consulta protocolar

`consultProtocol(SefazConsultationRequest)` recebe uma chave, modelo 55/65, UF/cUF, autorizador configurado, ambiente e contexto mTLS. Uma chamada consulta uma chave. URLs são resolvidas em registro interno.

Retorna `SefazConsultationResult`: cStat, xMotivo, chNFe, tpAmb, cUF, verAplic, dhRecbto, alternativa explícita em 613, evidências e erros técnicos DNS/TLS/TIMEOUT/HTTP/SOAP/XML/configuração. `success` significa resposta fiscal interpretada, não XML integral recuperado. Deadline total/inatividade 15 s, corpo SOAP até 2 MiB, sem repetição automática.

`ProtocolData` preserva `originalProtNFeXml` exato, versão/atributos/namespaces e todos os campos/atributos `infProt`, incluindo Id, chave, protocolo, status, data e digest, mais extensões. A projeção `PublicProtocolData` exclui o XML bruto. O motor compara os campos tipados ao fragmento preservado para evitar divergência entre representação e XML.

## Recuperação e envio manual

- Fluxo A: chave assinada idêntica ao protocolo 100. Exige identidade da nota, ambiente, assinatura XMLDSig/referência única, certificado embutido, digest oficial e XSD final. Compõe apenas o wrapper `nfeProc`, mantendo os fragmentos NFe/protNFe sem reserializar; valida a assinatura novamente no documento composto.
- Fluxo B: 613 só permite consultar outra chave após verificar dígito e componentes comuns (UF/AAMM/CNPJ/modelo/série/número). A chave alternativa é outro documento. Sem o XML exato: `authorized_xml_unavailable`, diagnóstico `XML_AUTORIZADO_INDISPONIVEL`, download falso e sem `authorizedXml`.
- Envio manual: o segundo XML deve ter a chave autorizada exata e coincidir com original em emitente/modelo/série/número, bem como ambiente. Passa pelos mesmos gates criptográficos, digest, protocolo bruto e XSD. Protocolo incompatível ou duplicado já presente no arquivo é rejeitado. Dados assinados não são substituídos.
- `RecoveryResult`: campos noteNumber/model/series/originalKey/authorizedKey/protocolNumber/cStat; aliases originalAccessKey/authorizedAccessKey; diagnostics/warnings; consulta pública; `expiresAt?` ISO 8601 (backend novo fornece 15 min).
- `status: "recovered"` exige download verdadeiro, XML não vazio e provenance com assinatura/schema/protocolo conferidos. Outros estados proíbem XML final. cStat 100 isolado nunca habilita download.
- `provenance.source` agora inclui `manual_upload`; `sourceChannelVerified: false` informa que a aplicação não atesta o canal pelo qual o usuário obteve o arquivo. `schemaProfile` registra o pacote exato. A UI exige os três gates verdadeiros e bloqueia resultado expirado.

## XSD, recursos e expiração

Perfil oficial fixado: `NFe-4.00-PL010c-NT2022.002-v1.30+proc009n`, com hashes verificados em runtime. Origem, ZIPs e limitações em `schemas/nfe/README.md`. libxml2-wasm 0.7.2 valida o nfeProc completo em processo filho, heap V8 128 MiB, deadline 5 s, sem providers de rede/OS e somente XSDs locais allowlisted. Documento com campos não contemplados falha; não há fallback para esquema antigo nem atualização dinâmica.

Antes de parsing recursivo: DTD/ENTITY proibidos, UTF-8 obrigatório, até 64 níveis, 60.000 elementos e tag de 64 KiB. XMLDSig restringe algoritmos, URI local, ID único e duas transformações permitidas. XSD registra estrutura; não substitui regras fiscais ou confiança/revogação.

Admissão em memória compartilhada por processo: no máximo 2 operações sensíveis simultâneas, 10 requisições/min por cliente e 60/min no processo, até 2048 buckets. Sem proxy confiável, clientes compartilham bucket seguro. Múltiplas instâncias exigem limite distribuído no ingress; exemplo em `deploy/nginx.conf.example`. Esses controles não são autenticação de conta SaaS.

Não há resultados/segredos armazenados no servidor. A UI expira resultados e referências de arquivos/senha em até 15 min da validação; um novo envio refaz a consulta. Arquivos já baixados não podem ser revogados pela aplicação. Limpeza de buffers/referências não promete apagamento físico de strings JS, cópias do runtime ou `KeyObject` antes do GC.

## Recuperação oficial NFC-e

Há portal interativo SVRS com certificado, mas não foi localizado contrato de API de download NFC-e na documentação pública consultada. Não automatizar a sessão. Caso SC/modelo 65 está no autorizador SVRS; a elegibilidade concreta depende do vínculo/certificado/serviço e não foi testada. Pesquisa detalhada: `.agents/SVRS_RECOVERY_RESEARCH.md`. NFeDistribuicaoDFe modelo 55 não é assumido aplicável a NFC-e.
