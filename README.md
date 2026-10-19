# Corrigir Nota — uso pessoal local

Uma página para consultar NF-e/NFC-e com A1 temporário, diagnosticar divergência de chave e completar `nfeProc` somente quando documento assinado, protocolo e XSD correspondem. Sem conta, banco, histórico, cobrança ou armazenamento de certificado.

**Estado:** testes sintéticos aprovados; certificado A1 real, autenticação/consulta real e qualificação fiscal por NT ainda pendentes. Não aprovado para operação fiscal. Localhost reduz exposição, mas não comprova integridade fiscal nem elimina vulnerabilidades.

## Iniciar no Windows

Ambiente exercitado: Node.js 24.14.1, npm e PowerShell. Execute:

```powershell
Set-Location -LiteralPath 'C:\Users\blake\Documents\Corrigir nota'
npm ci
npm run build
npm start
```

Abra **http://127.0.0.1:3000** no próprio computador. Encerre com `Ctrl+C`. Para editar o código, use `npm run dev` em vez de build/start. Os dois comandos vinculam **somente 127.0.0.1**, forçam `TRUST_PROXY=false` e habilitam a exceção HTTP exclusivamente local. Não abra portas no firewall/roteador nem use túneis. Para outra porta: `$env:PORT='3001'; npm start`.

O primeiro acesso não precisa de configuração para abrir a interface. Para validar confiança do A1 e liberar arquivo fiscal, faça a configuração abaixo; não desative verificações para obter um resultado positivo.

## Configuração pública, sem segredos

Se `.env.local` não existir, copie `.env.example` para `.env.local`; se existir, edite preservando suas opções. **Nunca coloque PFX, senha, XML ou chave privada em `.env`**, argumentos de comandos ou arquivos de configuração.

1. Obtenha/verifique as raízes pelo [repositório oficial do ITI](https://www.gov.br/iti/pt-br/assuntos/repositorio/repositorio-ac-raiz) e configure `ICP_BRASIL_TRUST_ROOTS_FILE` com um PEM público confiável, correspondente à cadeia e finalidade. Não inclua raízes expiradas/revogadas nem use uma raiz enviada no PFX como âncora automática. Mantenha `REQUIRE_TRUSTED_CLIENT_CERTIFICATE=true`. Não instalamos raízes nem alteramos o trust do Windows nesta etapa.
2. Qualifique o pacote XSD consultando NT, vigência e UF/ambiente do documento. Configure `NFE_SCHEMA_POLICY_JSON` com regras públicas. Cada regra contém `profile`, `model` (55/65), `cUF`, `tpAmb` (1/2), `from` e `through` (datas inclusivas ISO), `reference` (referência oficial e critério de vigência). Exatamente uma regra deve corresponder ao documento. Perfis instalados:
   - `NFe-4.00-PL009n-NT2023.004-v1.01+NT2019.001-v1.62` — pacote histórico completo;
   - `NFe-4.00-PL010c-NT2022.002-v1.30+proc009n` — leiaute/tipos 010c e entrada procNFe oficial 009n.
3. Exemplo de **formato apenas**, não calendário fiscal: `NFE_SCHEMA_POLICY_JSON='[{"profile":"NFe-4.00-PL010c-NT2022.002-v1.30+proc009n","model":"65","cUF":"42","tpAmb":"2","from":"2026-09-01","through":"2026-09-01","reference":"TESTE SINTETICO, SEM QUALIFICACAO FISCAL"}]'`. Não reutilize essas datas em documentos reais sem qualificação. Configuração vazia, desconhecida, sobreposta ou fora da faixa gera `SCHEMA_POLICY_UNAVAILABLE`, sem download. Não há fallback nem atualização silenciosa.
4. `REQUIRE_CERTIFICATE_REVOCATION=false` declara que CRL/OCSP **não** está sendo comprovado. Se sua política exigir revogação, `true` bloqueia o módulo com erro técnico, pois esse verificador não está implementado. Não confundir vínculo parcial à âncora com PKIX completo/revogação.

Reinicie após alterar configuração. Não há faixa de vigência real pré-aprovada: qualificar os esquemas ainda é requisito para uso fiscal. Detalhes e hashes em [schemas](schemas/nfe/README.md).

## Utilizar

1. Selecione o A1 `.pfx`/`.p12` (até 2 MiB), informe a senha e valide. Veja validade, CNPJ e avisos. Isso não confirma autenticação SEFAZ.
2. Selecione XML UTF-8 (até 5 MiB) e processe. Modelo, UF e ambiente são extraídos do próprio XML. **tpAmb=1 fará consulta de leitura em produção quando você clicar**; use apenas documento próprio e autorização apropriada. Não existe emissão, transmissão de notas ou mudança artificial de ambiente/chave.
3. O resultado mostra identificação, situação, chave alternativa/protocolo e diagnóstico. Só há download após todas as verificações. Um retorno 100 sozinho não basta.
4. Em `XML_AUTORIZADO_INDISPONIVEL`, obtenha legitimamente o XML assinado correspondente no emissor/backup ou canal oficial. Use **Enviar XML autorizado correspondente**. Original, candidato e credencial são reenviados e as consultas refeitas; não é aceito XML arbitrário.
5. Use **Remover certificado e limpar operação** ou **Encerrar sessão e começar de novo**. Referências na página e resultado expiram em 15 minutos; servidor não mantém sessão de credenciais. Salve o download somente em pasta privada de sua escolha, nunca em `public/` ou no Git.

O A1 fornecido ainda precisa ser o mesmo certificado signatário do XML; renovação do certificado pode impedir recuperação de documento histórico. Não editamos nem substituímos a assinatura original para contornar isso.

## Teste manual autorizado, sem enviar credenciais pelo chat

1. Execute primeiro todos os testes abaixo. Configure âncoras e política de schemas; confirme relógio do Windows e acesso HTTPS de saída. Guarde somente backups próprios em local privado externo ao projeto.
2. Comece com um XML **já existente de homologação**, próprio e íntegro (`tpAmb=2`), e A1 autorizado. Não altere XML de produção para fazê-lo passar por homologação e não emita nota nova por esta ferramenta.
3. Valide A1 localmente. Execute uma consulta; confira separadamente TLS/mTLS, endpoint/modelo/UF/ambiente e resposta. Erro de senha/datas/cadeia não é indisponibilidade SEFAZ; falha TLS não deve ser contornada com `NODE_TLS_REJECT_UNAUTHORIZED=0`.
4. Compare o resultado com arquivo original autorizado conhecido, incluindo chave, assinatura, digest, número do protocolo e XSD aplicável. Para 613, confirme que a segunda chave é consultada e que nenhum arquivo é baixável sem o documento correspondente. Teste o envio manual desse documento obtido legitimamente.
5. Só depois, se você estiver especificamente autorizado, repita consulta **somente de leitura** de documento próprio em produção. O ambiente vem de `tpAmb`. Nenhuma consulta real foi executada por nós nesta sessão.
6. Registre manualmente apenas data, versão/commit, modelo, UF, ambiente, cStat, código técnico e aprovado/reprovado. Não registre senha, PFX, XML, CNPJ/chaves completas, respostas SOAP ou capturas contendo dados fiscais. Um relatório sanitizado não é histórico permanente no produto. Encerre/limpe a página.

Não envie certificado ou senha pelo chat. Não use DevTools/HAR, telemetria ou gravação de tela para capturar corpos sensíveis.

## Verificações reproduzíveis, offline fiscal

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:smoke
npm audit --omit=dev
```

Testes usam A1/XMLs sintéticos e respostas simuladas; smoke usa HTTP loopback sem chamada SEFAZ. `npm audit` acessa o registry, não serviços fiscais. O audit ainda reporta high de node-forge sem correção disponível; não execute `audit fix --force`.

## Limites e segurança residual

- Rate limit em memória por processo, duas operações simultâneas; JSON até 17 MiB no processamento, dois XMLs de 5 MiB/PFX 2 MiB; prazo de envio 5 s. Requisições excedentes recebem 429/413/408.
- XML sem DTD/ENTITY, profundidade/quantidade/tamanho limitados. PFX/XSD em filhos com deadline de 5 s e heap V8 limitado. Memória nativa/WASM não tem cota SO rígida; não há promessa de resistência a todo OOM.
- Verificação TLS do servidor SEFAZ permanece nativa; cadeia cliente não substitui suas CAs. Não há segredos em arquivos/logs/cache de respostas. `finally` descarta recursos; strings JS/cópias do runtime não têm garantia de apagamento físico imediato.
- node-forge 1.4.0 continua no parser PKCS#12 isolado; o verificador RSA vulnerável não é chamado. Substituição por TLS nativo/PKI.js exige corpus A1 real/legado, ainda indisponível; não tratamos o advisory como corrigido.
- Acesso por sites externos à API local é bloqueado por Host/Origin/Fetch Metadata, complementando a escuta loopback. Processos maliciosos no próprio computador continuam fora dessa proteção. Mantenha Windows/navegador atualizados e use computador confiável.
- Não há download automático NFC-e implementado. A documentação pública SVRS consultada oferece portal interativo, sem API pública automática de download localizada. Não fazemos scraping/CAPTCHA. Distribuição NF-e 55 não é tratada como distribuição NFC-e 65.
- Remoto está fora do escopo: não use `next start -H 0.0.0.0`, túnel ou proxy. Hospedagem futura exige revisão de segurança, HTTPS e controle de acesso. O exemplo antigo de ingress fica arquivado como referência, não é necessário em localhost.

Fontes oficiais revisadas: [NFC-e serviços](https://dfe-portal.svrs.rs.gov.br/Nfce/Servicos), [NF-e serviços](https://dfe-portal.svrs.rs.gov.br/Nfe/Servicos), [Documentos SVRS](https://dfe-portal.svrs.rs.gov.br/Nfe/Documentos), [advisory forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv). Ver também [.agents/SECURITY_REVIEW.md](.agents/SECURITY_REVIEW.md) e [.agents/SVRS_RECOVERY_RESEARCH.md](.agents/SVRS_RECOVERY_RESEARCH.md).
