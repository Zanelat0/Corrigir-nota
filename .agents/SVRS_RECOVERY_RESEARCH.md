# Recuperação NFC-e na SVRS — verificação de 2026-10-17

## Evidência e conclusão técnica

O [portal oficial NFC-e](https://dfe-portal.svrs.rs.gov.br/NFCe) publica um serviço interativo de [Download XML](https://dfe-portal.svrs.rs.gov.br/NFCESSL/DownloadXMLDFe). O GET público dessa entrada, feito sem credenciais, retornou a página que exige certificado emitido por AC credenciada na ICP-Brasil, com orientação para disponibilidade do certificado A3. Não foram fornecidos certificado/senha, criada sessão autenticada nem tentado acesso a documento fiscal.

A [relação oficial de Web Services](https://dfe-portal.svrs.rs.gov.br/Nfce/Servicos) descreve autorização, retorno, inutilização, consulta de protocolo, status, cadastro e eventos; não publica operação/WSDL de download integral da NFC-e. Não foi localizada API automática oficialmente documentada para o botão do portal. Isso é uma conclusão sobre a documentação encontrada, não prova de que nenhum serviço privado possa existir. A integração automática permanece indisponível neste produto até existir contrato oficial específico.

O [aviso oficial sobre acesso ao portal](https://dfe-portal.svrs.rs.gov.br/Nfce/Avisos) diferencia serviços com gov.br, certificado e proteções contra acessos massivos. Não inferir que login gov.br substitua o certificado no Download XML; a entrada observada continua exigindo certificado. Não há implementação de scraping, reutilização de sessão, CAPTCHA ou contorno de autenticação. A aplicação fornece apenas um link para navegação humana no navegador.

## Empresas/documentos elegíveis

Conhecer uma chave não autoriza obter seu conteúdo. O acesso completo depende do vínculo do consulente com a operação e da autenticação aceita pelo portal. A documentação pública observada não enumera de forma suficiente todos os papéis, regras de matriz/filial, procuração, autorizados XML, datas de retenção ou abrangência para cada UF da funcionalidade NFC-e. Não importar automaticamente as regras de destinatário/transportador de NF-e modelo 55 para NFC-e 65.

O emitente identificado na nota é o candidato natural ao acesso com seu próprio certificado, mas o produto não declara elegibilidade definitiva sem confirmação autenticada da SVRS. Ter a mesma raiz de CNPJ, aceito pela política local do MVP, não garante que o portal aceite a mesma relação. Retenção, situação e disponibilidade efetiva também devem ser confirmadas no serviço.

## Aplicação ao caso informado

As duas chaves são de modelo 65, cUF 42 (SC), emitente 01867724000108, série 1 e número 25743. A diferença em tpEmis/cNF identifica documentos assinados distintos. Deve-se procurar no portal a chave autorizada `42260901867724000108650010000257431536139497`, nunca anexar seu protocolo à contingência `42260901867724000108650010000257439594944564`.

A [SEF/SC](https://www.sef.sc.gov.br/saiba-mais/nfc-e-nota-fiscal-de-consumidor-eletronica) aponta a consulta NFC-e na SVRS e publica as [URLs oficiais do autorizador](https://www.sef.sc.gov.br/api-portal/Documento/ver/1398). Assim, o caso está no escopo de autorizador correto para uma tentativa interativa. Sem o A1 real e a autorização do portal, não foi possível confirmar que esse documento específico esteja disponível nem que o titular apresentado seja elegível. Não há extensão dessa conclusão a documentos autorizados em SP, PR, MT ou outras autoridades próprias; consulte o serviço oficial da UF/autorizadora.

## Alternativa implementada

Após `XML_AUTORIZADO_INDISPONIVEL`, a pessoa pode obter o XML pelo canal oficial ou sistema emissor e enviá-lo à aplicação. O backend refaz as consultas, verifica o vínculo com o original, a chave autorizada exata, emitente/modelo/série/número/ambiente, assinatura, digest, protocolo original e XSD do documento final. A procedência é `manual_upload`, com `sourceChannelVerified: false`: o sistema comprova as verificações implementadas, não o canal pelo qual a pessoa obteve o arquivo.
