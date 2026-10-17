import type { FiscalEnvironment, FiscalModel, SefazAuthorityId } from "@/types/contracts";

export interface ProtocolEndpoint {
  readonly authority: string;
  readonly serviceUrl: string;
  readonly model: FiscalModel;
  readonly environment: FiscalEnvironment;
  readonly uf: string;
}

const CUF_BY_UF: Readonly<Record<string, string>> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27",
  SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41",
  SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

type Provider = { production: string; homologation: string };

const NF_E_UF_ENDPOINTS: Readonly<Record<string, Provider>> = {
  AM: { production: "https://nfe.sefaz.am.gov.br/services2/services/NfeConsulta4", homologation: "https://homnfe.sefaz.am.gov.br/services2/services/NfeConsulta4" },
  BA: { production: "https://nfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx", homologation: "https://hnfe.sefaz.ba.gov.br/webservices/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx" },
  GO: { production: "https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4", homologation: "https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4" },
  MG: { production: "https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4", homologation: "https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4" },
  MS: { production: "https://nfe.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4", homologation: "https://hom.nfe.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4" },
  MT: { production: "https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4", homologation: "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeConsulta4" },
  PE: { production: "https://nfe.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4", homologation: "https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/NFeConsultaProtocolo4" },
  PR: { production: "https://nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4", homologation: "https://homologacao.nfe.sefa.pr.gov.br/nfe/NFeConsultaProtocolo4" },
  RS: { production: "https://nfe.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx", homologation: "https://nfe-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx" },
  SP: { production: "https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx", homologation: "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx" },
};

const NFCE_UF_ENDPOINTS: Readonly<Record<string, Provider>> = {
  AM: { production: "https://nfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta4", homologation: "https://homnfce.sefaz.am.gov.br/nfce-services/services/NfeConsulta4" },
  GO: { production: "https://nfe.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4", homologation: "https://homolog.sefaz.go.gov.br/nfe/services/NFeConsultaProtocolo4" },
  MS: { production: "https://nfce.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4", homologation: "https://hom.nfce.sefaz.ms.gov.br/ws/NFeConsultaProtocolo4" },
  MT: { production: "https://nfce.sefaz.mt.gov.br/nfcews/services/NfeConsulta4", homologation: "https://homologacao.sefaz.mt.gov.br/nfcews/services/NfeConsulta4" },
  PR: { production: "https://nfce.sefa.pr.gov.br/nfce/NFeConsultaProtocolo4", homologation: "https://homologacao.nfce.sefa.pr.gov.br/nfce/NFeConsultaProtocolo4" },
  RS: { production: "https://nfce.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx", homologation: "https://nfce-homologacao.sefazrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx" },
  SP: { production: "https://nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx", homologation: "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeConsultaProtocolo4.asmx" },
};

const VIRTUAL_PROVIDERS: Readonly<Record<string, Provider>> = {
  SVAN: {
    production: "https://www.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx",
    homologation: "https://hom.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx",
  },
  SVRS: {
    production: "https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
    homologation: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
  },
  SVRS_NFCE: {
    production: "https://nfce.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
    homologation: "https://nfce-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx",
  },
};

const NF_E_SVRS_UFS = new Set(["AC", "AL", "AP", "CE", "DF", "ES", "PA", "PB", "PI", "RJ", "RN", "RO", "RR", "SC", "SE", "TO"]);
const NFCE_SVRS_UFS = new Set(["AC", "AL", "AP", "BA", "CE", "DF", "ES", "MA", "MG", "PA", "PB", "PE", "PI", "RJ", "RN", "RO", "RR", "SC", "SE", "TO"]);

function providerFor(model: FiscalModel, uf: string): { id: string; provider: Provider } | undefined {
  const upperUf = uf.toUpperCase();
  if (model === "55") {
    const direct = NF_E_UF_ENDPOINTS[upperUf];
    if (direct) return { id: upperUf, provider: direct };
    if (upperUf === "MA") return { id: "SVAN", provider: VIRTUAL_PROVIDERS.SVAN };
    if (NF_E_SVRS_UFS.has(upperUf)) return { id: "SVRS", provider: VIRTUAL_PROVIDERS.SVRS };
    return undefined;
  }

  const direct = NFCE_UF_ENDPOINTS[upperUf];
  if (direct) return { id: upperUf, provider: direct };
  if (NFCE_SVRS_UFS.has(upperUf)) return { id: "SVRS_NFCE", provider: VIRTUAL_PROVIDERS.SVRS_NFCE };
  return undefined;
}

export function resolveProtocolEndpoint(input: {
  model: FiscalModel;
  uf: string;
  cUF: string;
  authority: SefazAuthorityId | string;
  environment: FiscalEnvironment;
}): ProtocolEndpoint | undefined {
  const uf = input.uf.toUpperCase();
  if (CUF_BY_UF[uf] !== input.cUF) return undefined;
  const resolved = providerFor(input.model, uf);
  if (!resolved || resolved.id !== input.authority) return undefined;
  return {
    authority: resolved.id,
    serviceUrl: resolved.provider[input.environment],
    model: input.model,
    environment: input.environment,
    uf,
  };
}

/** Resolve the officially listed provider for a UF/model without exposing a URL parameter. */
export function authorityFor(model: FiscalModel, uf: string): string | undefined {
  const upperUf = uf.toUpperCase();
  if (!CUF_BY_UF[upperUf]) return undefined;
  return providerFor(model, upperUf)?.id;
}

export const CUF_BY_UF_READONLY = CUF_BY_UF;
