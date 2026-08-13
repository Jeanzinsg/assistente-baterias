// Leitura das variáveis de ambiente do servidor.
//
// Por que não `process.env.X!`: o `!` do TypeScript some em runtime. Sem a
// variável, o app quebrava com um stack trace opaco no primeiro request — ruim
// para quem clona o repo e ainda não configurou as chaves. Aqui a ausência vira
// um 503 com mensagem acionável (ver app/api/consultar/route.ts).
//
// NENHUMA destas variáveis pode ganhar o prefixo NEXT_PUBLIC_: isso as embutiria
// no bundle do navegador e vazaria as chaves para qualquer visitante.

const OBRIGATORIAS = [
  "ANTHROPIC_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type VarObrigatoria = (typeof OBRIGATORIAS)[number];

/** Variáveis obrigatórias que estão faltando (ou vazias). */
export function varsFaltando(): VarObrigatoria[] {
  return OBRIGATORIAS.filter((nome) => !process.env[nome]?.trim());
}

/** Lê uma variável obrigatória. Só chame depois de checar `varsFaltando()`. */
export function exigirVar(nome: VarObrigatoria): string {
  const valor = process.env[nome]?.trim();
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}
