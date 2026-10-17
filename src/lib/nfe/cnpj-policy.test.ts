import { describe, expect, it } from "vitest";
import { evaluateCnpjRelationship, isValidCnpj } from "./cnpj-policy";

describe("CNPJ certificate-to-issuer policy", () => {
  it("accepts the same complete CNPJ", () => {
    expect(evaluateCnpjRelationship("11.222.333/0001-81", "11222333000181")).toMatchObject({
      accepted: true,
      relationship: "same_cnpj",
    });
  });

  it("accepts a different establishment under the same root and reports it", () => {
    expect(evaluateCnpjRelationship("11222333000181", "11222333000262")).toMatchObject({
      accepted: true,
      relationship: "same_root_different_establishment",
      warningCode: "CNPJ_ESTABLISHMENT_MISMATCH",
    });
  });

  it("blocks a different root by default and permits configuration to override it", () => {
    expect(evaluateCnpjRelationship("11222333000181", "11444777000161")).toMatchObject({
      accepted: false,
      relationship: "different_root",
    });
    expect(evaluateCnpjRelationship("11222333000181", "11444777000161", {
      allowSameRootDifferentEstablishment: true,
      allowDifferentRoot: true,
      allowMissingCertificateCnpj: false,
      allowMissingIssuerCnpj: false,
    }).accepted).toBe(true);
  });

  it("blocks missing CNPJ by default", () => {
    expect(evaluateCnpjRelationship(undefined, "11222333000181")).toMatchObject({
      accepted: false,
      relationship: "missing_certificate_cnpj",
    });
    expect(evaluateCnpjRelationship("11222333000181", undefined)).toMatchObject({
      accepted: false,
      relationship: "missing_issuer_cnpj",
    });
  });

  it("supports the official alphanumeric CNPJ shape and check digit", () => {
    expect(isValidCnpj("00.000.000/E08G-12")).toBe(true);
    expect(evaluateCnpjRelationship("00000000E08G12", "00000000E08G12").relationship).toBe("same_cnpj");
  });

  it("rejects repeated values and invalid check digits", () => {
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("11222333000180")).toBe(false);
  });
});
