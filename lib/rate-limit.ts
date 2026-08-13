// Rate limit em memória, por IP, com janela fixa.
//
// LIMITAÇÕES (leia antes de confiar nisto em produção):
//   1. O contador vive no processo. Em serverless (Vercel, Lambda) cada
//      instância tem o seu, então o limite efetivo é MAX × nº de instâncias.
//   2. Um deploy/cold start zera tudo.
//   3. O IP vem de cabeçalhos que o cliente pode forjar se a app NÃO estiver
//      atrás de um proxy confiável que os sobrescreva.
//
// É suficiente para conter burst acidental e script ingênuo — que é o objetivo
// aqui, já que cada request custa tokens da Anthropic. Para um deploy sério,
// troque por um store compartilhado (ex.: @upstash/ratelimit sobre Redis)
// mantendo a mesma assinatura de `checarRateLimit`.

const JANELA_MS = 60_000; // 1 minuto
const MAX_POR_JANELA = 12; // requests por IP por janela
const MAX_CHAVES = 10_000; // teto de memória contra rotação de IPs

type Balde = { contagem: number; expiraEm: number };

const baldes = new Map<string, Balde>();

/** Remove entradas expiradas; se ainda estourar o teto, esvazia tudo. */
function limpar(agora: number): void {
  for (const [chave, balde] of baldes) {
    if (balde.expiraEm <= agora) baldes.delete(chave);
  }
  if (baldes.size > MAX_CHAVES) baldes.clear();
}

export type ResultadoRateLimit = {
  permitido: boolean;
  restantes: number;
  /** Segundos até a janela reabrir. Use no cabeçalho Retry-After. */
  reabreEm: number;
};

export function checarRateLimit(chave: string): ResultadoRateLimit {
  const agora = Date.now();
  limpar(agora);

  const balde = baldes.get(chave);
  if (!balde || balde.expiraEm <= agora) {
    baldes.set(chave, { contagem: 1, expiraEm: agora + JANELA_MS });
    return { permitido: true, restantes: MAX_POR_JANELA - 1, reabreEm: 0 };
  }

  balde.contagem += 1;
  const reabreEm = Math.ceil((balde.expiraEm - agora) / 1000);

  if (balde.contagem > MAX_POR_JANELA) {
    return { permitido: false, restantes: 0, reabreEm };
  }
  return {
    permitido: true,
    restantes: MAX_POR_JANELA - balde.contagem,
    reabreEm,
  };
}

/**
 * Identifica o cliente para fins de rate limit.
 * Só confie nestes cabeçalhos se houver um proxy confiável na frente.
 */
export function identificarCliente(req: Request): string {
  const encaminhado = req.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "desconhecido";
}

export const LIMITE = { JANELA_MS, MAX_POR_JANELA } as const;
