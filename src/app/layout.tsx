import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corrigir Nota | Recuperação segura de XML fiscal",
  description:
    "Consulte a situação fiscal e recupere XML autorizado de NF-e e NFC-e com segurança.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
