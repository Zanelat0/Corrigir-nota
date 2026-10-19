import type { Metadata } from "next";
import { headers } from "next/headers";
import { localDemoAvailable } from "../lib/demo/availability";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corrigir Nota | Recuperação segura de XML fiscal",
  description:
    "Consulte a situação fiscal e recupere XML autorizado de NF-e e NFC-e com segurança.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Production build cannot enable the demo, even if ENABLE_LOCAL_DEMO=true at build or runtime.
  if (process.env.NODE_ENV === "development" && localDemoAvailable((await headers()).get("host"))) {
    const { DemoModeShell } = await import("../components/demo-mode-shell");
    return <html lang="pt-BR"><body><DemoModeShell>{children}</DemoModeShell></body></html>;
  }
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
