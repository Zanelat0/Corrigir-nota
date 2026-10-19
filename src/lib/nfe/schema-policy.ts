import type { ParsedNfe } from "../../types/contracts";

export const CURRENT_SCHEMA_PROFILE = "NFe-4.00-PL010c-NT2022.002-v1.30+proc009n";
export const HISTORICAL_SCHEMA_PROFILE = "NFe-4.00-PL009n-NT2023.004-v1.01+NT2019.001-v1.62";
export type SchemaProfile = typeof CURRENT_SCHEMA_PROFILE | typeof HISTORICAL_SCHEMA_PROFILE;
export interface SchemaRule {
  profile: SchemaProfile; model: "55" | "65"; cUF: string; tpAmb: "1" | "2";
  from: string; through: string; reference: string;
}
function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
/** Public operator configuration, never document-controlled. No guessed NT cutover dates. */
export function selectSchemaProfile(parsed: ParsedNfe, configuration: string | undefined): SchemaProfile {
  if (!configuration || configuration.length > 32_768) throw new Error("SCHEMA_POLICY_REQUIRED");
  const rules: unknown = JSON.parse(configuration);
  if (!Array.isArray(rules) || !rules.length || rules.length > 64) throw new Error("SCHEMA_POLICY_INVALID");
  for (const rule of rules) {
    if (!rule || typeof rule !== "object" || ![CURRENT_SCHEMA_PROFILE, HISTORICAL_SCHEMA_PROFILE].includes(rule.profile) ||
      !["55", "65"].includes(rule.model) || !/^\d{2}$/.test(rule.cUF) || !["1", "2"].includes(rule.tpAmb) ||
      !isDate(rule.from) || !isDate(rule.through) || rule.from > rule.through || typeof rule.reference !== "string" || !rule.reference.trim() || rule.reference.length > 1024) throw new Error("SCHEMA_POLICY_INVALID");
  }
  const date = (parsed.ide.dhEmi ?? parsed.ide.dEmi)?.slice(0, 10);
  if (!isDate(date)) throw new Error("SCHEMA_POLICY_DOCUMENT_DATE");
  const matching = (rules as SchemaRule[]).filter((rule) => rule.model === parsed.model && rule.cUF === parsed.ide.cUF && rule.tpAmb === parsed.ide.tpAmb && date >= rule.from && date <= rule.through);
  if (matching.length !== 1) throw new Error(matching.length ? "SCHEMA_POLICY_AMBIGUOUS" : "SCHEMA_POLICY_UNSUPPORTED");
  return matching[0].profile;
}
