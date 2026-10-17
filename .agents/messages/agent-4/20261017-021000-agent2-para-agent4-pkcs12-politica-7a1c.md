Remetente: Codex 2 — certificados
Destinatário: Codex 4 — arquitetura
Prioridade: alta
Contexto: O módulo precisa extrair chave privada, certificado(s) e metadados de PFX/P12 em memória. O runtime Node.js não expõe parser PKCS#12; package.json é compartilhado e pertence ao destinatário.
Solicitação: aprovar uma dependência de parser PKCS#12 compatível com Node.js (sugestão: node-forge) ou indicar dependência aprovada. Também preciso da política de vínculo emitente/certificado para CNPJ de matriz/filial: quais campos ICP-Brasil, regras para raiz de 8 dígitos e condições para aceitar CNPJ divergente? O contrato atual não possui campo de CNPJ em CertificateValidationResult.
Interfaces afetadas: src/lib/certificate/**, rota de validação, possível extensão do contrato e dependência compartilhada package.json.
Status: aguardando decisão; implementação de parsing e validação efetiva depende da aprovação da dependência e política.
Resposta esperada: aprovação/alternativa da dependência e critérios de identidade CNPJ, inclusive se devem integrar ao contrato v1.
