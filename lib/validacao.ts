// Validação do corpo de POST /api/consultar.
//
// O corpo vem do navegador, então é entrada NÃO CONFIÁVEL — mesmo que a nossa
// própria UI seja bem comportada, qualquer um pode chamar o endpoint com curl.
// Como esse corpo vira `messages` numa chamada paga à Anthropic, o que se
// defende aqui é:
//
//   * CUSTO — sem limite de tamanho, um único request pode carregar centenas de
//     KB de texto e multiplicar o consumo de tokens.
//   * INTEGRIDADE DA CONVERSA — o cliente manda o histórico inteiro, incluindo
//     turnos `assistant`. Sem checagem, dá para forjar falas do assistente e
//     contornar as regras do system prompt (ex.: fazer o bot "confirmar" uma
//     bateria que o banco nunca devolveu). Não dá para eliminar o risco sem
//     guardar a conversa no servidor, mas limitar tamanho e formato reduz muito
//     a superfície.
//   * FORMATO — `content` só pode ser string. Aceitar blocos arbitrários
//     permitiria injetar `tool_use`/`tool_result` falsos no meio do histórico.

import type { HistoricoMsg } from "./types";

export const LIMITES = {
  PERGUNTA_MAX: 1_000,
  HISTORICO_MAX_TURNOS: 20,
  HISTORICO_MAX_CHARS_POR_TURNO: 2_000,
  HISTORICO_MAX_CHARS_TOTAL: 12_000,
  CORPO_MAX_BYTES: 32 * 1024,
} as const;

export type CorpoValido = { pergunta: string; historico: HistoricoMsg[] };

export type ResultadoValidacao =
  | { ok: true; valor: CorpoValido }
  | { ok: false; erro: string };

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Normaliza o histórico para o formato que a API da Anthropic aceita:
 * descarta o que não bate com o shape, corta pelos limites e garante que a
 * sequência comece em `user` e alterne — a API rejeita um histórico que abra
 * com `assistant` (é o caso da mensagem de boas-vindas da UI).
 */
function sanitizarHistorico(bruto: unknown): HistoricoMsg[] {
  if (!Array.isArray(bruto)) return [];

  // Só as trocas mais recentes importam para o contexto.
  const recentes = bruto.slice(-LIMITES.HISTORICO_MAX_TURNOS);

  const bemFormados: HistoricoMsg[] = [];
  for (const item of recentes) {
    if (!ehObjeto(item)) continue;
    const { role, content } = item;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const texto = content.trim().slice(0, LIMITES.HISTORICO_MAX_CHARS_POR_TURNO);
    if (!texto) continue;
    bemFormados.push({ role, content: texto });
  }

  // A conversa tem que abrir com o usuário.
  while (bemFormados.length && bemFormados[0]!.role === "assistant") {
    bemFormados.shift();
  }

  // Colapsa turnos consecutivos do mesmo papel, mantendo o último.
  const alternado: HistoricoMsg[] = [];
  for (const msg of bemFormados) {
    if (alternado.length && alternado[alternado.length - 1]!.role === msg.role) {
      alternado[alternado.length - 1] = msg;
    } else {
      alternado.push(msg);
    }
  }

  // O último turno do histórico precisa ser do assistente, porque o backend
  // ainda vai anexar a pergunta atual como turno `user`.
  if (alternado.length && alternado[alternado.length - 1]!.role === "user") {
    alternado.pop();
  }

  // Teto global de caracteres, descartando do turno mais antigo para o mais novo.
  let total = alternado.reduce((soma, m) => soma + m.content.length, 0);
  while (alternado.length && total > LIMITES.HISTORICO_MAX_CHARS_TOTAL) {
    total -= alternado.shift()!.content.length;
    // Remover o turno mais antigo pode deixar um `assistant` na frente.
    while (alternado.length && alternado[0]!.role === "assistant") {
      total -= alternado.shift()!.content.length;
    }
  }

  return alternado;
}

export function validarCorpo(bruto: unknown): ResultadoValidacao {
  if (!ehObjeto(bruto)) {
    return { ok: false, erro: "Corpo inválido. Envie um objeto JSON." };
  }

  const { pergunta } = bruto;
  if (typeof pergunta !== "string") {
    return { ok: false, erro: "Envie { pergunta: string }." };
  }

  const perguntaLimpa = pergunta.trim();
  if (!perguntaLimpa) {
    return { ok: false, erro: "A pergunta não pode ser vazia." };
  }
  if (perguntaLimpa.length > LIMITES.PERGUNTA_MAX) {
    return {
      ok: false,
      erro: `A pergunta excede ${LIMITES.PERGUNTA_MAX} caracteres.`,
    };
  }

  return {
    ok: true,
    valor: {
      pergunta: perguntaLimpa,
      historico: sanitizarHistorico(bruto.historico),
    },
  };
}
