import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { fork } from "node:child_process";
import { assertXmlLimits, parseNfeXml } from "./xml";
import { CURRENT_SCHEMA_PROFILE, HISTORICAL_SCHEMA_PROFILE, selectSchemaProfile, type SchemaProfile } from "./schema-policy";

export const SCHEMA_PROFILE = CURRENT_SCHEMA_PROFILE;
export interface SchemaValidationResult { valid: boolean; profile: string; code?: string; issueCount?: number; lines?: number[] }
const packageDirectory = "schemas/nfe/pl010c/PL_010c_NT2022_002v1.30";
const expectedHashes: Record<string, string> = {
  "DFeTiposBasicos_v1.00.xsd": "C1C1F700DE03DA50C82F3FBF23DB7E98929B5D1EE1BDEDB4D546E33EFA498EE6",
  "leiauteNFe_v4.00.xsd": "7D8AF488538FE78809088F9C494CB7521AE856982210FD13A25496CCF429C8C1",
  "nfe_v4.00.xsd": "66A117AAA78687FDB1355FC32A380EC859F3A98E850D7C4DE5A07935EB1A6030",
  "tiposBasico_v4.00.xsd": "63D393D69FB63568E39277D9794348FBE107E1C15D2DBCE32FB63B6E41472C6D",
  "xmldsig-core-schema_v1.01.xsd": "F56744A5F51C03F027DE13F39F869307091781A9EF1D91B1EBE14719CE28E1AC",
  "procNFe_v4.00.xsd": "D61D15303F8CCF77E6E5D77A8153255A6906E0D00385DC5000DB19ED3BFA96E0",
};
const historicalHashes: Record<string, string> = {
  "leiauteNFe_v4.00.xsd": "A2A39A43BBD01184BAA03849BAD5328DA9CDE746EC247BA334DAF3DAE2B5F435",
  "nfe_v4.00.xsd": "0AC9D4C146B6DB779F4B6A531045899B919D42E1BB87EB96D6F692BB14B8B646",
  "tiposBasico_v4.00.xsd": "1AB4A4EBB9580A7EFB45C9D545A9D3B7316CC965213345F667C86A5C7E56E33F",
  "xmldsig-core-schema_v1.01.xsd": expectedHashes["xmldsig-core-schema_v1.01.xsd"],
  "procNFe_v4.00.xsd": expectedHashes["procNFe_v4.00.xsd"],
};
const schemaFiles = new Map<SchemaProfile, Promise<Record<string, Uint8Array>>>();

async function loadSchemas(profile: SchemaProfile): Promise<Record<string, Uint8Array>> {
  // Fixed local paths; the caller cannot supply a schema, URI or filesystem path.
  const historicalDirectory = "schemas/nfe/pl009n/PL_009n_NT2023_004_v101_e_NT2019_001_v162";
  const historical = profile === HISTORICAL_SCHEMA_PROFILE;
  const names = ["nfe_v4.00.xsd", "leiauteNFe_v4.00.xsd", "tiposBasico_v4.00.xsd", "xmldsig-core-schema_v1.01.xsd", ...(historical ? [] : ["DFeTiposBasicos_v1.00.xsd"])];
  const entries = await Promise.all(names.map(async (name) => [`/nfe/${name}`, historical
    ? await readFile(resolve(process.cwd(), historicalDirectory, name))
    : await readFile(resolve(process.cwd(), packageDirectory, name))] as const));
  entries.push(["/nfe/procNFe_v4.00.xsd", await readFile(resolve(process.cwd(), "schemas/nfe/pl009n/PL_009n_NT2023_004_v101_e_NT2019_001_v162/procNFe_v4.00.xsd"))]);
  for (const [path, bytes] of entries) if (createHash("sha256").update(bytes).digest("hex").toUpperCase() !== (historical ? historicalHashes : expectedHashes)[path.split("/").at(-1)!]) throw new Error("Schema integrity mismatch");
  return Object.fromEntries(entries);
}

export async function validateFiscalXml(xml: string): Promise<SchemaValidationResult> {
  try { assertXmlLimits(xml, 6 * 1024 * 1024); } catch { return { valid: false, profile: SCHEMA_PROFILE, code: "XML_LIMIT_OR_DTD" }; }
  let profile: SchemaProfile;
  try { profile = selectSchemaProfile(parseNfeXml(xml), process.env.NFE_SCHEMA_POLICY_JSON); }
  catch { return { valid: false, profile: "unselected", code: "SCHEMA_POLICY_UNAVAILABLE" }; }
  let schemas: Record<string, Uint8Array>;
  try {
    if (!schemaFiles.has(profile)) schemaFiles.set(profile, loadSchemas(profile));
    schemas = await schemaFiles.get(profile)!;
  } catch { schemaFiles.delete(profile); return { valid: false, profile, code: "SCHEMA_CONFIGURATION_ERROR" }; }
  return new Promise((done) => {
    // Resolve the fixed asset at runtime; do not let the web bundler rewrite the child program.
    const worker: ReturnType<typeof fork> = Reflect.apply(fork, undefined, [resolve(process.cwd(), "src/lib/nfe/schema-worker.mjs"), [], { serialization: "advanced", stdio: ["ignore", "ignore", "ignore", "ipc"], execArgv: ["--max-old-space-size=128"] }]);
    let settled = false;
    const finish = (result: SchemaValidationResult) => { if (settled) return; settled = true; clearTimeout(timer); worker.kill(); done(result); };
    const timer = setTimeout(() => finish({ valid: false, profile, code: "XSD_TIMEOUT" }), 5000);
    worker.once("message", (result: Omit<SchemaValidationResult, "profile">) => finish({ ...result, profile }));
    worker.once("error", () => finish({ valid: false, profile, code: "SCHEMA_CONFIGURATION_ERROR" }));
    worker.once("exit", () => { if (!settled) finish({ valid: false, profile, code: "SCHEMA_WORKER_EXIT" }); });
    worker.send({ xml, schemas }, (error) => { if (error) finish({ valid: false, profile, code: "SCHEMA_WORKER_EXIT" }); });
  });
}

export const schemaSetFingerprint = async (profile: SchemaProfile = SCHEMA_PROFILE) => createHash("sha256").update(Object.values(await loadSchemas(profile)).map((bytes) => createHash("sha256").update(bytes).digest("hex")).join("|")).digest("hex");
