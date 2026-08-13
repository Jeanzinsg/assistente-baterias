// Tipos compartilhados entre o backend (RPC do Supabase) e a UI.
// Fonte da verdade: o retorno da função `buscar_bateria` (ver supabase/schema.sql).

/** Uma linha devolvida pela RPC `buscar_bateria`: um veículo + a bateria dele. */
export type Row = {
  // veículo
  cod: string;
  marca: string;
  modelo: string;
  versao: string | null;
  ano_inicio: number;
  ano_fim: number | null;
  motorizacao: string | null;
  combustivel: string | null;
  start_stop: boolean;
  // bateria
  sku: string;
  fabricante: string;
  capacidade_ah: number;
  cca: number | null;
  polaridade: string | null;
  tecnologia: string; // 'chumbo-acido' | 'EFB' | 'AGM'
  peso_kg: number | null;
  comprimento_mm: number | null;
  largura_mm: number | null;
  altura_mm: number | null;
  // vínculo
  observacao: string | null;
};

/** Um turno da conversa, no formato que a UI mantém em estado. */
export type Msg = { who: "user" | "bot"; text?: string; rows?: Row[] };

/** Turno enviado ao backend em `historico` (subconjunto do formato da Anthropic). */
export type HistoricoMsg = { role: "user" | "assistant"; content: string };

/** Resposta de sucesso de POST /api/consultar. */
export type ConsultaOk = { resposta: string; dados: Row[] };

/** Resposta de erro de POST /api/consultar. */
export type ConsultaErro = { erro: string };
