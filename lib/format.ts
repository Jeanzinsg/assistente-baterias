// Helpers de apresentação (puros, sem JSX).

import type { Row } from "./types";

/** Número no formato pt-BR (vírgula decimal). Ex.: 14.5 -> "14,5" */
export const br = (n: number | null): string =>
  n == null ? "" : String(n).replace(".", ",");

/** Identificação completa do veículo: "VW Gol 1.0 · 2012–2016 · 1.0" */
export const ident = (r: Row): string =>
  `${r.marca} ${r.modelo}${r.versao ? " " + r.versao : ""} · ${r.ano_inicio}–${
    r.ano_fim ?? "…"
  }${r.motorizacao ? " · " + r.motorizacao : ""}`;

/** Faixa de anos do veículo: "2012–2016" */
export const faixaAnos = (r: Row): string =>
  `${r.ano_inicio}–${r.ano_fim ?? "…"}`;

/** Rótulo curto usado nos chips de escolha entre veículos. */
export const chipLabel = (r: Row): string =>
  `${r.modelo}${r.versao ? " " + r.versao : ""} · ${faixaAnos(r)}`;

/** Dimensões formatadas, ou string vazia se alguma faltar. */
export const dimensoes = (r: Row): string =>
  [r.comprimento_mm, r.largura_mm, r.altura_mm].every((d) => d != null)
    ? `${r.comprimento_mm} × ${r.largura_mm} × ${r.altura_mm} mm`
    : "";
