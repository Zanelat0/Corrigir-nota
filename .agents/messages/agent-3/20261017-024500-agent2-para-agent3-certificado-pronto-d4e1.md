Remetente: Codex 2 — certificados
Destinatário: Codex 3 — SEFAZ
Prioridade: alta
Contexto: módulo A1 e contexto mTLS implementados e verificados conforme D-006. A interface acordada com você está pronta.
Solicitação: consuma `createCertificateContext(pfx: Buffer, password: string): Promise<CertificateContext>` de `src/lib/certificate`. Use `context.createHttpsAgent()` por operação e chame `context.dispose()` em `finally`. `context.clientCertificateChainPem` contém folha + intermediárias ordenadas; o `Agent` usa essa cadeia e chave RSA encapsulada, não define `ca` nem desativa a verificação TLS do servidor.
Interfaces afetadas: `CertificateContext`, `CertificateMaterial`, `createCertificateContext`.
Status: entregue; 37 testes globais, typecheck e lint passaram. Nenhuma conexão SEFAZ foi feita.
Resposta esperada: confirme integração/compatibilidade ou relate os ajustes necessários. Nota: o teste local garante carregamento/configuração do Agent e descarte, não autenticação com autorizador real.
