// Production-build smoke on loopback only. Synthetic credentials; no SEFAZ request.
import { spawn } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import forge from 'node-forge';

const port = await new Promise((done) => { const socket = createServer(); socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => done(port)); }); });
const server = spawn(process.execPath, [resolve('scripts/local.mjs'), 'start'], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: { ...process.env, PORT: String(port), NODE_ENV: 'production', ENABLE_LOCAL_DEMO: 'true', REQUIRE_TRUSTED_CLIENT_CERTIFICATE: 'false', ICP_BRASIL_TRUST_ROOTS_FILE: '' } });
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { ready = (await fetch(base, { signal: AbortSignal.timeout(200) })).ok; } catch { /* starting */ } if (ready) break; await new Promise((r) => setTimeout(r, 100)); }
  assert.ok(ready, 'Local build did not start');
  const html = await (await fetch(`${base}/?demo=true`)).text();
  assert.ok(!html.includes('Modo de demonstração') && !html.includes('Executar demonstração'), 'Production build must ignore demo env flag and query parameter');
  for (const asset of await readdir('.next/static/chunks', { recursive: true })) {
    if (asset.endsWith('.js')) assert.ok(!(await readFile(resolve('.next/static/chunks', asset), 'utf8')).includes('SIMULACAO_SEM_VALIDADE_FISCAL'), 'Demo scenarios must not be bundled into production browser assets');
  }
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKey = forge.pki.privateKeyFromPem(pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
  const cert = forge.pki.createCertificate(); cert.publicKey = forge.pki.publicKeyFromPem(pair.publicKey.export({ type: 'spki', format: 'pem' }).toString()); cert.serialNumber = '91';
  cert.setSubject([{ name: 'commonName', value: 'SYNTHETIC LOCAL SMOKE' }, { name: 'serialNumber', value: 'CNPJ: 11222333000181' }]); cert.setIssuer(cert.subject.attributes);
  cert.validity.notBefore = new Date(Date.now() - 60_000); cert.validity.notAfter = new Date(Date.now() + 86_400_000); cert.sign(privateKey, forge.md.sha256.create());
  const pfx = Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(privateKey, [cert], 'synthetic-smoke-only', { algorithm: '3des', useMac: true })).getBytes(), 'latin1');
  const payload = { contractVersion: '1', certificatePfxBase64: pfx.toString('base64'), password: 'synthetic-smoke-only' }; pfx.fill(0);
  const headers = { 'content-type': 'application/json', origin: base };
  const foreign = await fetch(`${base}/api/certificado/validar`, { method: 'POST', headers: { ...headers, origin: 'https://untrusted.invalid' }, body: '{}' });
  assert.equal(foreign.status, 403, 'Foreign website must not invoke the local certificate API');
  const validation = await fetch(`${base}/api/certificado/validar`, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
  assert.equal(validation.status, 200, 'Synthetic certificate worker did not validate through compiled route'); assert.equal((await validation.json()).valid, true);
  const invalidXml = await fetch(`${base}/api/notas/processar`, { method: 'POST', headers, body: JSON.stringify({ ...payload, xmlBase64: Buffer.from('<not-a-fiscal-document/>').toString('base64') }), signal: AbortSignal.timeout(10000) });
  assert.equal(invalidXml.status, 422); assert.equal((await invalidXml.json()).error.code, 'INVALID_XML');
  const trace = JSON.parse(await readFile('.next/server/app/api/notas/processar/route.js.nft.json', 'utf8'));
  assert.ok(trace.files.some((p) => p.includes('libxml2-wasm/package.json')), 'Missing XSD package in production trace');
  assert.ok(trace.files.some((p) => p.includes('schema-worker.mjs')), 'Missing XSD child in production trace');
  assert.ok(trace.files.some((p) => p.includes('node-forge/lib/index.js')), 'Missing certificate child dependency in production trace');
  console.log('Smoke local aprovado: rotas compiladas e A1 sintético isolado; nenhuma consulta SEFAZ.');
} finally { if (server.connected) server.disconnect(); else server.kill(); }
