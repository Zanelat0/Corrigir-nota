// Entrypoint for personal use. Never bind to LAN, even when PORT is configured.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const [mode, ...args] = process.argv.slice(2);
if (!['dev', 'start'].includes(mode) || args.length) {
  console.error('Use npm run dev ou npm start; configure PORT para trocar a porta.');
  process.exit(1);
}
const port = process.env.PORT ?? '3000';
if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  console.error('PORT deve ser um número entre 1 e 65535.'); process.exit(1);
}
const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), mode, '-H', '127.0.0.1', '-p', port], {
  windowsHide: true, stdio: 'inherit',
  env: { ...process.env, CORRIGIR_NOTA_LOCAL_ONLY: 'true', TRUST_PROXY: 'false', CORRIGIR_NOTA_HOMOLOGATION_ONLY: 'true' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
// Used by the smoke harness to avoid leaving an orphan Next process on Windows.
process.once('disconnect', () => child.kill());
child.once('error', () => { console.error('Não foi possível iniciar o servidor local.'); process.exitCode = 1; });
child.once('exit', (code) => { process.exitCode = code ?? 1; });
