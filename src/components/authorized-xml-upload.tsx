import type { FormEvent } from "react";
import type { RecoveryResult } from "../types/contracts";

export function canOfferAuthorizedUpload(result: RecoveryResult | null): boolean {
  return result?.status === "authorized_xml_unavailable" && result.diagnostics.some((d) => d.code === "XML_AUTORIZADO_INDISPONIVEL");
}
export function AuthorizedXmlUpload({ result, file, disabled, onSelect, onSubmit }: { result: RecoveryResult | null; file: File | null; disabled: boolean; onSelect: (file: File | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const svrs = result?.model === "65" && ["SVRS_NFCE", "RS"].includes(String(result.consultation?.authority));
  return <form className="panel" onSubmit={onSubmit} aria-label="Envio do XML autorizado">
    <h3>Enviar XML autorizado correspondente</h3>
    <p>Obtenha o XML assinado por um canal oficial ou pelo sistema emissor e envie o arquivo integral. Chave, emitente, modelo, série, número, assinatura e protocolo serão conferidos novamente.</p>
    {result?.authorizedKey && <p className="mono-value">Chave esperada: {result.authorizedKey}</p>}
    {svrs && <p><a href="https://dfe-portal.svrs.rs.gov.br/NFCESSL/DownloadXMLDFe" target="_blank" rel="noopener noreferrer">Abrir Download XML da SVRS</a> · O portal exige certificado digital e verifica sua permissão de acesso.</p>}
    <label className="field-label" htmlFor="authorized-xml-file">XML autorizado (até 5 MiB)</label>
    <input id="authorized-xml-file" type="file" accept=".xml,text/xml,application/xml" disabled={disabled} onChange={(event) => onSelect(event.target.files?.[0] ?? null)} />
    {file && <p>{file.name} · <button type="button" onClick={() => onSelect(null)} disabled={disabled}>Remover arquivo</button></p>}
    <button className="button button-primary" type="submit" disabled={disabled || !file}>Validar XML autorizado correspondente</button>
  </form>;
}
