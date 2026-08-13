import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Rajdhani } from "next/font/google";

import "./globals.css";

// As três famílias que a UI realmente usa. `next/font` baixa os arquivos em
// build e os serve do próprio domínio: sem requisição ao Google em runtime
// (nada de vazar IP do visitante), sem layout shift e compatível com a CSP
// `font-src 'self'` definida em next.config.ts.
//
// Antes disso, as fontes vinham de um `@import url(fonts.googleapis.com)`
// dentro de uma string CSS injetada por JS — o pior caso possível: o navegador
// só descobria as três famílias depois de baixar e executar o bundle.

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Assistente de Baterias",
  description:
    "Consulta de bateria automotiva por veículo: specs, dimensões e alerta de start-stop, sempre a partir do catálogo — nunca inventadas.",
  // O app é uma ferramenta interna de balcão; não faz sentido indexá-lo.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#090b0c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${rajdhani.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
