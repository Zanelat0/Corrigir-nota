// Pure presentation fixtures: no network, fiscal engine, certificate or private material.
import type { RecoveryResult } from "../../types/contracts";
import { syntheticAccessKey } from "../nfe/testing/identity";

export const demoScenarios = [
  { id: "authorized", label: "Nota autorizada — cStat 100" },
  { id: "alternative", label: "Rejeição 613 seguida de autorização 100" },
  { id: "unavailable_xml", label: "XML autorizado indisponível" },
  { id: "manual_xml", label: "XML autorizado correspondente fornecido manualmente" },
  { id: "invalid_signature", label: "Assinatura digital inválida" },
  { id: "invalid_certificate", label: "Certificado inválido" },
  { id: "unavailable_sefaz", label: "SEFAZ indisponível" },
] as const;
export type DemoScenario = typeof demoScenarios[number]["id"];
// Not a fiscal RecoveryResult: no XML/provenance and download is always false, even for a simulated success.
export type DemoRecoveryResult = Omit<RecoveryResult, "status" | "downloadAvailable" | "authorizedXml" | "provenance"> & {
  simulation: true; status: RecoveryResult["status"]; downloadAvailable: false;
  authorizedXml?: never; provenance?: never;
};
export interface DemoOutcome { kind: "simulation"; result: DemoRecoveryResult; steps: string[] }

export function executeDemo(scenario: DemoScenario, manualProvided = false): DemoOutcome {
  const original = syntheticAccessKey("9", "65"); const authorized = syntheticAccessKey("1", "65");
  const divergent = ["alternative", "unavailable_xml", "manual_xml"].includes(scenario);
  const success = scenario === "authorized" || (scenario === "manual_xml" && manualProvided);
  const certificateInvalid = scenario === "invalid_certificate";
  const serviceUnavailable = scenario === "unavailable_sefaz";
  const signatureInvalid = scenario === "invalid_signature";
  const code = success ? "SIMULACAO_RECUPERACAO" : certificateInvalid ? "CERTIFICATE_INVALID" : serviceUnavailable ? "SEFAZ_UNAVAILABLE" : signatureInvalid ? "XML_SIGNATURE_INVALID" : "XML_AUTORIZADO_INDISPONIVEL";
  const message = success ? "Recuperação fictícia concluída. Nenhum documento fiscal foi validado ou emitido; download desabilitado." : certificateInvalid ? "Certificado fictício inválido. Nenhum A1 real foi solicitado ou lido." : serviceUnavailable ? "Indisponibilidade fictícia da SEFAZ. Nenhuma conexão de rede foi realizada." : signatureInvalid ? "Assinatura fictícia inválida: o documento não seria liberado." : "A chave autorizada fictícia difere do XML original. É necessário o XML assinado correspondente; nunca combinar chaves diferentes.";
  const steps = certificateInvalid ? ["Validação fictícia do certificado: falha."] : ["Certificado sintético: etapa simulada, sem A1 real.", ...(divergent ? ["Consulta fictícia da chave original: cStat 613.", "Consulta fictícia da chave alternativa: cStat 100."] : [serviceUnavailable ? "Consulta fictícia: serviço indisponível." : "Consulta fictícia: cStat 100."]), ...(scenario === "manual_xml" ? [manualProvided ? "Segundo XML de teste correspondente fornecido; verificações apenas simuladas." : "Aguardando o segundo XML fictício correspondente."] : [])];
  return { kind: "simulation", steps: steps.map((step) => `SIMULAÇÃO — ${step}`), result: {
    simulation: true, contractVersion: "1", status: success ? "recovered" : certificateInvalid ? "certificate_invalid" : serviceUnavailable ? "service_unavailable" : signatureInvalid ? "rejected" : "authorized_xml_unavailable",
    downloadAvailable: false, noteNumber: "42", series: "1", model: "65", originalKey: divergent ? original : authorized,
    ...(!certificateInvalid && !serviceUnavailable ? { authorizedKey: authorized, protocolNumber: "242260000000001", cStat: "100" } : {}),
    diagnosis: `SIMULAÇÃO — ${message}`, diagnostics: [{ code, severity: success ? "info" : "blocking", message: `SIMULAÇÃO — ${message}` }],
    warnings: [{ code: "SIMULACAO_SEM_VALIDADE_FISCAL", severity: "warning", message: "SIMULAÇÃO: número, chaves, protocolo, etapas e resultados são fictícios. Nenhuma verificação fiscal ou consulta SEFAZ foi executada." }],
  } };
}
