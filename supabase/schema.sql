-- ============================================================
-- Assistente de Baterias — esquema do catálogo
-- ------------------------------------------------------------
-- Rode este arquivo inteiro no SQL Editor do Supabase.
--
-- Este esquema foi conferido contra o banco de produção: nomes de coluna,
-- tipos, nulabilidade e os valores aceitos nos CHECK refletem o que está lá.
--
-- MODELO — chave natural, 1 bateria por veículo (N:1):
--   veiculos.cod  ->  compatibilidade.cod
--   compatibilidade.sku  ->  baterias.sku
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tabelas
-- ------------------------------------------------------------

create table if not exists public.baterias (
  sku             text primary key,
  fabricante      text    not null,
  capacidade_ah   integer not null check (capacidade_ah > 0),
  cca             integer          check (cca is null or cca > 0),
  polaridade      text             check (polaridade in ('esquerda', 'direita')),
  tecnologia      text    not null check (tecnologia in ('chumbo-acido', 'EFB', 'AGM')),
  segmento        text,
  peso_kg         numeric(5, 2),
  comprimento_mm  integer,
  largura_mm      integer,
  altura_mm       integer,
  observacoes     text,
  created_at      timestamptz not null default now()
);

comment on column public.baterias.polaridade is
  'Lado do polo positivo, visto de frente com os terminais para cima.';
comment on column public.baterias.tecnologia is
  'Carro com start-stop exige EFB ou AGM; chumbo-ácido comum degrada em meses.';
comment on column public.baterias.observacoes is
  'ATENCAO: a RPC buscar_bateria NAO devolve esta coluna. Ver a nota na secao 2.';

create table if not exists public.veiculos (
  cod          text primary key,          -- ex.: 'vw01'
  marca        text    not null,
  modelo       text    not null,
  versao       text,
  ano_inicio   integer not null,
  ano_fim      integer,                   -- null = ainda em linha
  motorizacao  text,
  combustivel  text,
  start_stop   boolean not null default false,
  observacoes  text,
  created_at   timestamptz not null default now(),
  check (ano_fim is null or ano_fim >= ano_inicio)
);

comment on column public.veiculos.observacoes is
  'Mesma ressalva de baterias.observacoes: não é devolvida pela RPC.';

create table if not exists public.compatibilidade (
  -- PK só em `cod`: cada veículo tem exatamente UMA bateria indicada.
  cod        text primary key references public.veiculos (cod) on delete cascade,
  sku        text not null references public.baterias (sku) on delete restrict,
  observacao text  -- singular, ao contrário das outras duas tabelas
);

-- Índices para o padrão de busca da RPC (filtro por marca/modelo/ano).
create index if not exists veiculos_marca_modelo_idx
  on public.veiculos (lower(marca), lower(modelo));
create index if not exists veiculos_anos_idx
  on public.veiculos (ano_inicio, ano_fim);
create index if not exists compatibilidade_sku_idx
  on public.compatibilidade (sku);

-- ------------------------------------------------------------
-- 2. RPC buscar_bateria
-- ------------------------------------------------------------
-- Esta é a ÚNICA porta de entrada do modelo para os dados. O Claude não
-- escreve SQL: ele preenche os quatro parâmetros e recebe linhas do banco.
-- É o que garante que uma bateria nunca seja "gerada" — só consultada.
--
-- As 20 colunas do RETURNS TABLE são o contrato com `Row` em lib/types.ts:
-- mexer aqui exige mexer lá.
--
-- NOTA sobre observações: a RPC devolve `compatibilidade.observacao`, e é essa
-- que o assistente repassa ao cliente (regra 6 do system prompt). As colunas
-- `baterias.observacoes` e `veiculos.observacoes` NÃO são devolvidas — o que
-- estiver escrito nelas nunca chega ao cliente.
--
-- NOTA sobre p_marca: não há guarda de null. Chamar com `p_marca => null`
-- devolve zero linhas, porque `ilike null` é null. Na prática isso não ocorre:
-- route.ts sempre envia 'Volkswagen' quando o modelo não informa a marca.

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
-- SECURITY INVOKER (padrão): a função respeita as políticas de RLS de quem a
-- chama. Combinado com as políticas de leitura da seção 3, isso permite usar a
-- chave `anon` em vez da `service_role`.
security invoker
set search_path = public
as $$
  select
    v.cod, v.marca, v.modelo, v.versao,
    v.ano_inicio, v.ano_fim, v.motorizacao, v.combustivel, v.start_stop,
    b.sku, b.fabricante, b.capacidade_ah, b.cca, b.polaridade, b.tecnologia,
    b.peso_kg, b.comprimento_mm, b.largura_mm, b.altura_mm,
    c.observacao
  from public.veiculos v
  join public.compatibilidade c on c.cod = v.cod
  join public.baterias b        on b.sku = c.sku
  where v.modelo ilike '%' || p_modelo || '%'
    and v.marca  ilike '%' || p_marca  || '%'
    and (p_ano   is null or p_ano between v.ano_inicio and coalesce(v.ano_fim, 9999))
    and (p_motor is null or v.motorizacao ilike '%' || p_motor || '%')
  order by v.marca, v.modelo, v.ano_inicio
  limit 25;  -- teto de segurança: a UI não mostra mais que isso
$$;

-- ------------------------------------------------------------
-- 3. RLS — catálogo é informação pública, só de leitura
-- ------------------------------------------------------------
-- Sem RLS habilitado, a chave `anon` do Supabase leria (e, com as políticas
-- erradas, escreveria) tudo. Aqui as três tabelas ficam com RLS ligado e uma
-- única política de SELECT. Nenhuma política de insert/update/delete é criada,
-- então escrita fica bloqueada para anon e authenticated — só a `service_role`
-- (que ignora RLS) consegue popular o catálogo.

alter table public.baterias        enable row level security;
alter table public.veiculos        enable row level security;
alter table public.compatibilidade enable row level security;

drop policy if exists "leitura publica do catalogo" on public.baterias;
create policy "leitura publica do catalogo"
  on public.baterias for select to anon, authenticated using (true);

drop policy if exists "leitura publica do catalogo" on public.veiculos;
create policy "leitura publica do catalogo"
  on public.veiculos for select to anon, authenticated using (true);

drop policy if exists "leitura publica do catalogo" on public.compatibilidade;
create policy "leitura publica do catalogo"
  on public.compatibilidade for select to anon, authenticated using (true);

grant execute on function public.buscar_bateria(text, integer, text, text)
  to anon, authenticated;

-- ------------------------------------------------------------
-- 4. Dados de exemplo (FICTÍCIOS)  —  NÃO RODE EM UM BANCO QUE JÁ TEM CATÁLOGO
-- ------------------------------------------------------------
-- Esta seção existe só para o projeto funcionar depois de um `git clone`. Se
-- você já tem catálogo carregado, PARE AQUI: as seções 1 a 3 são idempotentes,
-- esta insere linhas. Specs e SKUs abaixo são ilustrativos e NÃO servem como
-- referência de compra.
--
-- Os códigos usam o prefixo 'vwx' justamente para não colidir com uma
-- numeração real do tipo 'vw01', 'vw02'…

insert into public.baterias
  (sku, fabricante, capacidade_ah, cca, polaridade, tecnologia, segmento,
   peso_kg, comprimento_mm, largura_mm, altura_mm, observacoes)
values
  ('EX-50D', 'ExemploBat', 50, 400, 'direita',  'chumbo-acido', 'automotiva', 12.50, 242, 175, 190, null),
  ('EX-60E', 'ExemploBat', 60, 520, 'esquerda', 'chumbo-acido', 'automotiva', 14.80, 242, 175, 190, null),
  ('EX-60F', 'ExemploBat', 60, 560, 'direita',  'EFB',          'automotiva', 16.20, 242, 175, 190, null),
  ('EX-70A', 'ExemploBat', 70, 680, 'direita',  'AGM',          'automotiva', 19.40, 278, 175, 190, null)
on conflict (sku) do nothing;

insert into public.veiculos
  (cod, marca, modelo, versao, ano_inicio, ano_fim, motorizacao, combustivel,
   start_stop, observacoes)
values
  ('vwx1', 'Volkswagen', 'Gol',     'G6',      2013, 2016, '1.0',     null, false, null),
  ('vwx2', 'Volkswagen', 'Gol',     'G7',      2017, 2022, '1.0',     null, false, null),
  ('vwx3', 'Volkswagen', 'Polo',    'MQB',     2018, 2026, '1.0 TSI', null, true,  null),
  ('vwx4', 'Volkswagen', 'T-Cross', 'Comfort', 2019, 2026, '1.0 TSI', null, true,  null),
  ('vwx5', 'Volkswagen', 'Amarok',  'V6',      2018, 2026, '3.0 V6',  null, false, null)
on conflict (cod) do nothing;

insert into public.compatibilidade (cod, sku, observacao)
values
  ('vwx1', 'EX-50D', null),
  ('vwx2', 'EX-60E', null),
  ('vwx3', 'EX-60F', 'Após a troca, resete o BMS pelo scanner ou o start-stop não reativa.'),
  ('vwx4', 'EX-60F', null),
  ('vwx5', 'EX-70A', 'Motor diesel: confira o CCA mínimo exigido no manual.')
on conflict (cod) do nothing;
