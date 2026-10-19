import { afterEach, expect, it, vi } from "vitest";
import { CURRENT_SCHEMA_PROFILE, HISTORICAL_SCHEMA_PROFILE, selectSchemaProfile } from "./schema-policy";
import { parseNfeXml } from "./xml";
import { syntheticNfe } from "./testing/synthetic";
import { SYNTHETIC_SCHEMA_POLICY } from "./testing/schema-policy";
import { validateFiscalXml } from "./schema";
afterEach(() => vi.unstubAllEnvs());
it("selects only one explicitly qualified model/UF/environment/date rule", () => {
  const parsed = parseNfeXml(syntheticNfe().xml);
  expect(selectSchemaProfile(parsed, SYNTHETIC_SCHEMA_POLICY)).toBe(CURRENT_SCHEMA_PROFILE);
  for (const change of [{ cUF: "35" }, { tpAmb: "1" }, { dhEmi: "2020-09-01T00:00:00-03:00" }]) expect(() => selectSchemaProfile({ ...parsed, ide: { ...parsed.ide, ...change } }, SYNTHETIC_SCHEMA_POLICY)).toThrow();
});
it("never silently selects the newest package or retries ambiguous profiles", () => {
  const parsed = parseNfeXml(syntheticNfe().xml);
  expect(() => selectSchemaProfile(parsed, undefined)).toThrow();
  const rules = JSON.parse(SYNTHETIC_SCHEMA_POLICY);
  expect(() => selectSchemaProfile(parsed, JSON.stringify([...rules, ...rules]))).toThrow("AMBIGUOUS");
  rules[0].profile = "remote-user-schema";
  expect(() => selectSchemaProfile(parsed, JSON.stringify(rules))).toThrow();
});
it("rejects impossible dates and configurations larger than the bounded policy", () => {
  const parsed = parseNfeXml(syntheticNfe().xml); const rules = JSON.parse(SYNTHETIC_SCHEMA_POLICY);
  rules[0].from = "2026-02-30";
  expect(() => selectSchemaProfile(parsed, JSON.stringify(rules))).toThrow();
  expect(() => selectSchemaProfile(parsed, "x".repeat(32769))).toThrow();
});
it("validates a synthetic historical shape with the explicitly selected 009n package", async () => {
  vi.stubEnv("NFE_SCHEMA_POLICY_JSON", SYNTHETIC_SCHEMA_POLICY.replaceAll(CURRENT_SCHEMA_PROFILE, HISTORICAL_SCHEMA_PROFILE));
  expect(await validateFiscalXml(syntheticNfe().nfeProc)).toMatchObject({ valid: true, profile: HISTORICAL_SCHEMA_PROFILE });
});
it("fails closed without a qualified XSD policy", async () => {
  vi.stubEnv("NFE_SCHEMA_POLICY_JSON", "");
  expect(await validateFiscalXml(syntheticNfe().nfeProc)).toMatchObject({ valid: false, code: "SCHEMA_POLICY_UNAVAILABLE" });
});
