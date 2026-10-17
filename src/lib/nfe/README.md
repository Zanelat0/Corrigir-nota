# Motor NF-e/NFC-e

`recoverNfe({ xml, authorizedXml?, certificateContext }, overrides?)` orquestra parsing, identidade, consulta unitária, alternativa 613 e composição validada. Dependências injetáveis são usadas por testes; a rota pública não aceita verificador, protocolo ou transporte fornecidos pelo cliente.

- `xml.ts`: preflight de recursos antes do parser, chave/DV, infNFe/ide/emit/assinatura/QR; XMLDSig com referência local única ao Id, X509 embutido correspondente ao A1 e transforms restritas; leitura do digest e conferência do protocolo bruto. Fragmentos NFe/protNFe são extraídos sem reserializar.
- `cnpj-policy.ts`: política configurável conservadora de identidade, inclusive formato CNPJ alfanumérico. Formatos de chave/schema/serviço não suportados falham de forma fechada; não inferir suporte integral a NT posterior da validação do CNPJ isolada.
- `schema.ts`/`schema-worker.mjs`: XSD do nfeProc completo com libxml2-wasm 0.7.2, perfil/hashes locais; processo filho de 5 s/heap V8 128 MiB. Sem schemas/URLs do usuário ou fallback permissivo. Origem e aplicabilidade em `schemas/nfe/README.md`.
- `recovery.ts`: mesma chave requer assinatura, identidade, digest e protocolo 100 compatíveis, XSD final e nova verificação criptográfica depois de compor. Divergência sem XML exato retorna `XML_AUTORIZADO_INDISPONIVEL`; não combina contingência com protocolo da alternativa.
- Envio manual refaz as consultas e exige chave autorizada exata + CNPJ/modelo/série/número/ambiente correspondentes. Protocolo já contido no upload não pode ser incompatível/ambíguo. Provenance `manual_upload` não atesta canal de obtenção.
- Resposta inclui expiração 15 min; não existe cache/sessão de segredos no servidor. A rota sempre descarta o contexto em finally.

Download XML da NFC-e SVRS é disponibilizado como navegação humana externa; não foi encontrada API pública automática documentada. Ver `.agents/SVRS_RECOVERY_RESEARCH.md`. Distribuição de NF-e 55 não é presumida equivalente a NFC-e 65.

Escopo: mesma A1 signatária deve ser apresentada; assinatura histórica com outro certificado após renovação ainda não é suportada. XSD não reexecuta regras fiscais completas nem prova PKIX/revogação. Âncoras configuradas têm verificação parcial explícita. Node-forge permanece com advisory high no caminho PKCS#12 isolado; sem aprovação para produção.

Aceitação: `acceptance.test.ts` usa XML/assinaturas sintéticos completos com consultas simuladas; `process-route.test.ts` atravessa a rota com PFX sintético e upload manual. `xml.test.ts` testa criptografia/alteração/ID/KeyInfo; `recovery.test.ts` inclui XML incompleto rejeitado pelo XSD mesmo com gate criptográfico simulado. Nenhum teste chama SEFAZ.
