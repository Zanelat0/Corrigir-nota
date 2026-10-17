import https from "node:https";
import type { Agent } from "node:https";

export interface TransportRequest {
  url: string;
  body: string;
  agent: Agent;
  timeoutMs: number;
  maxResponseBytes: number;
}

export interface TransportResponse {
  statusCode: number;
  body: Buffer;
}

export type SefazTransport = (request: TransportRequest) => Promise<TransportResponse>;

export class TransportFailure extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "TransportFailure";
  }
}

/** HTTPS POST with bounded response, TLS verification enabled, and no redirects/retries. */
export const httpsSoapTransport: SefazTransport = ({ url, body, agent, timeoutMs, maxResponseBytes }) =>
  new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: "POST",
        agent,
        minVersion: "TLSv1.2",
        headers: {
          "content-type": `application/soap+xml; charset=utf-8; action="${SOAP_ACTION}"`,
          soapaction: `"${SOAP_ACTION}"`,
          accept: "application/soap+xml, text/xml",
          "content-length": Buffer.byteLength(body, "utf8"),
          connection: "close",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let received = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          received += buffer.length;
          if (received > maxResponseBytes) {
            request.destroy(new TransportFailure("SEFAZ response exceeded configured limit", "RESPONSE_TOO_LARGE"));
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          resolve({ statusCode: response.statusCode ?? 0, body: Buffer.concat(chunks) });
        });
        response.on("error", (error: NodeJS.ErrnoException) => reject(error));
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new TransportFailure("SEFAZ request timed out", "ETIMEDOUT"));
    });
    // Total deadline also bounds slow DNS/connect and a response that keeps trickling bytes.
    const deadline = setTimeout(() => request.destroy(new TransportFailure("SEFAZ total request deadline exceeded", "ETIMEDOUT")), timeoutMs);
    request.once("close", () => clearTimeout(deadline));
    request.on("error", reject);
    request.end(body, "utf8");
  });

const SOAP_ACTION = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF";
