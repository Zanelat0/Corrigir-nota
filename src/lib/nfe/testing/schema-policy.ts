import { CURRENT_SCHEMA_PROFILE } from "../schema-policy";
// Artificial applicability solely for synthetic fixtures; never a real NT schedule.
export const SYNTHETIC_SCHEMA_POLICY = JSON.stringify(["55", "65"].map((model) => ({
  profile: CURRENT_SCHEMA_PROFILE, model, cUF: "42", tpAmb: "2", from: "2026-09-01", through: "2026-09-01", reference: "SYNTHETIC TEST ONLY, NOT FISCAL QUALIFICATION",
})));
