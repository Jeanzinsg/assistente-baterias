-- ============================================================
-- 0001 — a RPC passa a devolver TODAS as observações
-- ------------------------------------------------------------
-- PROBLEMA
--   As três tabelas guardam observações, mas a RPC devolvia só
--   `compatibilidade.observacao`. Como essa coluna está vazia em todas as
--   linhas, a regra 6 do system prompt ("se 'observacao' vier preenchida,
--   repasse o aviso ao cliente") nunca disparava — enquanto os avisos escritos
--   em `baterias.observacoes` e `veiculos.observacoes` jamais chegavam ao
--   balconista.
--
-- CORREÇÃO
--   Reunir as três num único campo `observacao`. `concat_ws` ignora nulls e
--   `nullif` devolve null quando as três estão vazias, então o assistente
--   continua recebendo null (e não uma string em branco) quando não há aviso.
--
-- COMPATIBILIDADE
--   A assinatura e as 20 colunas do RETURNS TABLE não mudam, então
--   `create or replace` basta — não é preciso derrubar a função — e nada muda
--   em lib/types.ts nem na UI.
--
-- COMO APLICAR
--   Cole este arquivo inteiro no SQL Editor do Supabase e rode.
-- ============================================================

create or replace function public.buscar_bateria(
  p_modelo text,
  p_ano    integer default null,
  p_motor  text    default null,
  p_marca  text    default 'Volkswagen'
)
returns table (
  cod             text,
  marca           text,
  modelo          text,
  versao          text,
  ano_inicio      integer,
  ano_fim         integer,
  motorizacao     text,
  combustivel     text,
  start_stop      boolean,
  sku             text,
  fabricante      text,
  capacidade_ah   integer,
  cca             integer,
  polaridade      text,
  tecnologia      text,
  peso_kg         numeric,
  comprimento_mm  integer,
  largura_mm      integer,
  altura_mm       integer,
  observacao      text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    v.cod, v.marca, v.modelo, v.versao,
    v.ano_inicio, v.ano_fim, v.motorizacao, v.combustivel, v.start_stop,
    b.sku, b.fabricante, b.capacidade_ah, b.cca, b.polaridade, b.tecnologia,
    b.peso_kg, b.comprimento_mm, b.largura_mm, b.altura_mm,
    nullif(concat_ws(' ', c.observacao, b.observacoes, v.observacoes), '') as observacao
  from public.veiculos v
  join public.compatibilidade c on c.cod = v.cod
  join public.baterias b        on b.sku = c.sku
  where v.modelo ilike '%' || p_modelo || '%'
    and v.marca  ilike '%' || p_marca  || '%'
    and (p_ano   is null or p_ano between v.ano_inicio and coalesce(v.ano_fim, 9999))
    and (p_motor is null or v.motorizacao ilike '%' || p_motor || '%')
  order by v.marca, v.modelo, v.ano_inicio
  limit 25;
$$;

-- Conferência: deve listar as linhas cujo aviso agora chega ao cliente.
--
--   select v.cod, v.modelo, b.sku,
--          nullif(concat_ws(' ', c.observacao, b.observacoes, v.observacoes), '') as observacao
--   from public.veiculos v
--   join public.compatibilidade c on c.cod = v.cod
--   join public.baterias b        on b.sku = c.sku
--   where coalesce(c.observacao, b.observacoes, v.observacoes) is not null;
