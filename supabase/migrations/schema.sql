-- Supabase schema for PAC system

create extension if not exists "pgcrypto";

create table if not exists diretorias (
  id uuid primary key default gen_random_uuid(),
  sigla text not null unique,
  nome text not null,
  descricao text,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists gerencias (
  id uuid primary key default gen_random_uuid(),
  diretoria_id uuid not null references diretorias(id) on delete cascade,
  sigla text not null,
  nome text,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (diretoria_id, sigla)
);

create table if not exists periodos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  inicio date not null,
  fim date not null,
  ativo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================
-- TABELAS DE CATÁLOGO E CONFIGURAÇÃO (MODELO ERP)
-- ============================================

create table if not exists categoria_item (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists centro_custo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  diretoria_id uuid not null references diretorias(id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists regra_categoria_centro_custo (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categoria_item(id) on delete cascade,
  centro_custo_id uuid not null references centro_custo(id) on delete cascade,
  vigencia_inicio date not null,
  vigencia_fim date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (categoria_id, centro_custo_id, vigencia_inicio)
);

create table if not exists categoria_diretoria_orcamentaria (
  id uuid primary key default gen_random_uuid(),
  categoria text not null unique,
  diretoria_orcamentaria_id uuid not null references diretorias(id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_orcamento_config (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('diretoria', 'gerencia')),
  referencia_id uuid not null,
  tipo text not null check (tipo in ('aquisicao', 'servicos')),
  valor numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (escopo, referencia_id, tipo)
);

create table if not exists admin_fluxo_config (
  id uuid primary key default gen_random_uuid(),
  gerencia_id uuid not null references gerencias(id) on delete cascade,
  destino_tipo text not null check (destino_tipo in ('diretoria', 'compras', 'admin')),
  destino_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gerencia_id)
);

create table if not exists fornecedor (
  id uuid primary key default gen_random_uuid(),
  cnpj text unique,
  razao_social text not null,
  nome_fantasia text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists itens_catalogo (
  id uuid primary key default gen_random_uuid(),
  codigo integer not null unique,
  descricao text not null,
  categoria_id uuid references categoria_item(id) on delete set null,
  categoria text,
  unidade_medida text not null,
  unidade text,
  valor_unitario numeric(14,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists solicitacoes (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references periodos(id) on delete restrict,
  diretoria_id uuid not null references diretorias(id) on delete restrict,
  gerencia_id uuid not null references gerencias(id) on delete restrict,
  item_id uuid references itens_catalogo(id) on delete set null,
  codigo integer,
  descricao text,
  categoria text,
  unidade text,
  qtd_estimada numeric(14,2) not null default 0,
  valor_unitario numeric(14,2) not null default 0,
  prioridade text not null default 'Media',
  observacao text,
  status text not null default 'rascunho',
  justificativa_rejeicao text,
  enviado_em timestamptz,
  aprovado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists servicos (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references periodos(id) on delete restrict,
  diretoria_id uuid not null references diretorias(id) on delete restrict,
  gerencia_id uuid not null references gerencias(id) on delete restrict,
  item integer not null,
  tipo_contratacao text not null,
  unidade_demandante text not null,
  objeto text not null,
  justificativa text,
  previsao_inicio date,
  estimativa_valor numeric(14,2) not null default 0,
  dotacao_orcamentaria numeric(14,2) not null default 0,
  grau_prioridade text not null default 'Médio',
  vinculacao text not null default 'Não',
  dependencia_descricao text,
  status text not null default 'rascunho',
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists solicitacao_historico (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references solicitacoes(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  acao text not null,
  autor_tipo text not null,
  autor_ref text,
  justificativa text,
  created_at timestamptz not null default now()
);

create table if not exists codigos_acesso (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  diretoria_id uuid references diretorias(id) on delete cascade,
  gerencia_id uuid references gerencias(id) on delete cascade,
  codigo_hash text not null,
  ativo boolean not null default true,
  expira_em timestamptz,
  created_at timestamptz not null default now(),
  unique (scope, diretoria_id, gerencia_id)
);

create table if not exists plano_anual (
  id uuid primary key default gen_random_uuid(),
  ano integer not null unique,
  status text not null default 'rascunho' check (status in ('rascunho', 'em_aprovacao', 'aprovado', 'encerrado')),
  descricao text,
  criado_por uuid,
  created_at timestamptz not null default now()
);

create table if not exists plano_diretoria (
  id uuid primary key default gen_random_uuid(),
  plano_anual_id uuid not null references plano_anual(id) on delete cascade,
  diretoria_id uuid not null references diretorias(id) on delete cascade,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aprovado', 'devolvido')),
  observacoes text,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (plano_anual_id, diretoria_id)
);

create table if not exists plano_item (
  id uuid primary key default gen_random_uuid(),
  plano_diretoria_id uuid not null references plano_diretoria(id) on delete cascade,
  item_catalogo_id uuid not null references itens_catalogo(id) on delete cascade,
  quantidade_prevista numeric(14,2) not null,
  valor_unit_previsto numeric(14,2),
  justificativa text,
  prioridade integer check (prioridade in (1, 2, 3)),
  centro_custo_id uuid not null references centro_custo(id) on delete restrict,
  meta_mes integer check (meta_mes between 1 and 12),
  created_at timestamptz not null default now()
);

create table if not exists orcamento_anual (
  id uuid primary key default gen_random_uuid(),
  ano integer not null,
  centro_custo_id uuid not null references centro_custo(id) on delete cascade,
  valor_aprovado numeric(14,2) not null default 0,
  valor_reservado numeric(14,2) not null default 0,
  valor_executado numeric(14,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (ano, centro_custo_id)
);

create table if not exists solicitacao_compra (
  id uuid primary key default gen_random_uuid(),
  diretoria_solicitante_id uuid not null references diretorias(id) on delete cascade,
  centro_custo_id uuid not null references centro_custo(id) on delete cascade,
  status text not null default 'aberta' check (status in ('aberta', 'aprovada', 'rejeitada', 'em_cotacao', 'comprada', 'cancelada')),
  descricao text not null,
  created_at timestamptz not null default now()
);

create table if not exists solicitacao_item (
  id uuid primary key default gen_random_uuid(),
  solicitacao_compra_id uuid not null references solicitacao_compra(id) on delete cascade,
  item_catalogo_id uuid not null references itens_catalogo(id) on delete cascade,
  quantidade numeric(14,2) not null,
  valor_unit_estimado numeric(14,2),
  valor_unit_final numeric(14,2),
  plano_item_id uuid references plano_item(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists aprovacao (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('plano_diretoria', 'solicitacao_compra')),
  referencia_id uuid not null,
  etapa integer not null,
  aprovado_por uuid,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  comentario text,
  created_at timestamptz not null default now()
);

create table if not exists log_orcamentario (
  id uuid primary key default gen_random_uuid(),
  ano integer not null,
  centro_custo_id uuid not null references centro_custo(id) on delete cascade,
  referencia_tipo text not null check (referencia_tipo in ('plano_item', 'solicitacao_compra', 'compra')),
  referencia_id uuid not null,
  acao text not null check (acao in ('reservar', 'estornar_reserva', 'executar', 'estornar_execucao')),
  valor numeric(14,2) not null,
  created_at timestamptz not null default now()
);

-- ============================================
-- ÍNDICES
-- ============================================

create index if not exists centro_custo_diretoria_idx on centro_custo(diretoria_id);
create index if not exists regra_categoria_idx on regra_categoria_centro_custo(categoria_id);
create index if not exists regra_centro_custo_idx on regra_categoria_centro_custo(centro_custo_id);
create index if not exists categoria_dir_orcamentaria_dir_idx on categoria_diretoria_orcamentaria(diretoria_orcamentaria_id);
create index if not exists admin_orcamento_config_ref_idx on admin_orcamento_config(escopo, referencia_id);
create index if not exists admin_fluxo_config_gerencia_idx on admin_fluxo_config(gerencia_id);

create index if not exists plano_diretoria_plano_idx on plano_diretoria(plano_anual_id);
create index if not exists plano_diretoria_dir_idx on plano_diretoria(diretoria_id);
create index if not exists plano_item_plano_dir_idx on plano_item(plano_diretoria_id);
create index if not exists plano_item_centro_idx on plano_item(centro_custo_id);
create index if not exists plano_item_item_idx on plano_item(item_catalogo_id);

create index if not exists orcamento_centro_idx on orcamento_anual(centro_custo_id);
create index if not exists orcamento_ano_idx on orcamento_anual(ano);

create index if not exists solicitacao_compra_diretoria_idx on solicitacao_compra(diretoria_solicitante_id);
create index if not exists solicitacao_compra_centro_idx on solicitacao_compra(centro_custo_id);
create index if not exists solicitacao_compra_status_idx on solicitacao_compra(status);

create index if not exists solicitacao_item_solicitacao_idx on solicitacao_item(solicitacao_compra_id);
create index if not exists solicitacao_item_item_idx on solicitacao_item(item_catalogo_id);
create index if not exists solicitacao_item_plano_idx on solicitacao_item(plano_item_id);

create index if not exists aprovacao_referencia_idx on aprovacao(tipo, referencia_id);
create index if not exists aprovacao_status_idx on aprovacao(status);

create index if not exists log_orcamentario_centro_idx on log_orcamentario(centro_custo_id);
create index if not exists log_orcamentario_referencia_idx on log_orcamentario(referencia_tipo, referencia_id);
create index if not exists log_orcamentario_ano_idx on log_orcamentario(ano);

create index if not exists solicitacoes_periodo_idx on solicitacoes(periodo_id);
create index if not exists solicitacoes_diretoria_idx on solicitacoes(diretoria_id);
create index if not exists solicitacoes_gerencia_idx on solicitacoes(gerencia_id);

create index if not exists servicos_periodo_idx on servicos(periodo_id);
create index if not exists servicos_diretoria_idx on servicos(diretoria_id);
create index if not exists servicos_gerencia_idx on servicos(gerencia_id);

-- RLS
alter table diretorias enable row level security;
alter table gerencias enable row level security;
alter table periodos enable row level security;
alter table itens_catalogo enable row level security;
alter table solicitacoes enable row level security;
alter table servicos enable row level security;
alter table solicitacao_historico enable row level security;
alter table codigos_acesso enable row level security;
alter table categoria_item enable row level security;
alter table centro_custo enable row level security;
alter table regra_categoria_centro_custo enable row level security;
alter table categoria_diretoria_orcamentaria enable row level security;
alter table admin_orcamento_config enable row level security;
alter table admin_fluxo_config enable row level security;
alter table fornecedor enable row level security;
alter table plano_anual enable row level security;
alter table plano_diretoria enable row level security;
alter table plano_item enable row level security;
alter table orcamento_anual enable row level security;
alter table solicitacao_compra enable row level security;
alter table solicitacao_item enable row level security;
alter table aprovacao enable row level security;
alter table log_orcamentario enable row level security;

-- Drop existing policies (avoid conflicts on re-run)
drop policy if exists "diretorias_read" on diretorias;
drop policy if exists "gerencias_read" on gerencias;
drop policy if exists "diretorias_admin_write" on diretorias;
drop policy if exists "gerencias_admin_write" on gerencias;
drop policy if exists "periodos_read" on periodos;
drop policy if exists "periodos_admin_write" on periodos;
drop policy if exists "itens_catalogo_read" on itens_catalogo;
drop policy if exists "itens_catalogo_admin_write" on itens_catalogo;
drop policy if exists "solicitacoes_read" on solicitacoes;
drop policy if exists "solicitacoes_insert" on solicitacoes;
drop policy if exists "solicitacoes_update" on solicitacoes;
drop policy if exists "servicos_read" on servicos;
drop policy if exists "servicos_insert" on servicos;
drop policy if exists "servicos_update" on servicos;
drop policy if exists "historico_read" on solicitacao_historico;
drop policy if exists "historico_insert" on solicitacao_historico;
drop policy if exists "codigos_admin_read" on codigos_acesso;
drop policy if exists "codigos_admin_write" on codigos_acesso;
drop policy if exists "categoria_item_read" on categoria_item;
drop policy if exists "categoria_item_admin_write" on categoria_item;
drop policy if exists "categoria_dir_orcamentaria_read" on categoria_diretoria_orcamentaria;
drop policy if exists "categoria_dir_orcamentaria_admin_write" on categoria_diretoria_orcamentaria;
drop policy if exists "admin_orcamento_config_read" on admin_orcamento_config;
drop policy if exists "admin_orcamento_config_admin_write" on admin_orcamento_config;
drop policy if exists "admin_fluxo_config_read" on admin_fluxo_config;
drop policy if exists "admin_fluxo_config_admin_write" on admin_fluxo_config;
drop policy if exists "centro_custo_read" on centro_custo;
drop policy if exists "centro_custo_admin_write" on centro_custo;
drop policy if exists "regra_categoria_read" on regra_categoria_centro_custo;
drop policy if exists "regra_categoria_admin_write" on regra_categoria_centro_custo;
drop policy if exists "fornecedor_read" on fornecedor;
drop policy if exists "fornecedor_admin_write" on fornecedor;
drop policy if exists "plano_anual_read" on plano_anual;
drop policy if exists "plano_anual_write" on plano_anual;
drop policy if exists "plano_diretoria_read" on plano_diretoria;
drop policy if exists "plano_diretoria_write" on plano_diretoria;
drop policy if exists "plano_item_read" on plano_item;
drop policy if exists "plano_item_write" on plano_item;
drop policy if exists "orcamento_anual_read" on orcamento_anual;
drop policy if exists "orcamento_anual_write" on orcamento_anual;
drop policy if exists "solicitacao_compra_read" on solicitacao_compra;
drop policy if exists "solicitacao_compra_write" on solicitacao_compra;
drop policy if exists "solicitacao_item_read" on solicitacao_item;
drop policy if exists "solicitacao_item_write" on solicitacao_item;
drop policy if exists "aprovacao_read" on aprovacao;
drop policy if exists "aprovacao_write" on aprovacao;
drop policy if exists "log_orcamentario_read" on log_orcamentario;

-- Helper claims:
-- auth.jwt() ->> 'app_role' in ('admin','diretoria','gerencia','compras')
-- auth.jwt() ->> 'diretoria_id' as uuid string
-- auth.jwt() ->> 'gerencia_id' as uuid string

-- diretorias/gerencias
create policy "diretorias_read" on diretorias
  for select using (auth.role() in ('authenticated','anon'));

create policy "gerencias_read" on gerencias
  for select using (auth.role() in ('authenticated','anon'));

create policy "diretorias_admin_write" on diretorias
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

create policy "gerencias_admin_write" on gerencias
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

-- periodos
create policy "periodos_read" on periodos
  for select using (auth.role() in ('authenticated','anon'));

create policy "periodos_admin_write" on periodos
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

-- itens_catalogo
create policy "itens_catalogo_read" on itens_catalogo
  for select using (auth.role() in ('authenticated','anon'));

create policy "itens_catalogo_admin_write" on itens_catalogo
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

-- solicitacoes
create policy "solicitacoes_read" on solicitacoes
  for select using (auth.role() IN ('authenticated', 'anon'));

create policy "solicitacoes_insert" on solicitacoes
  for insert with check (auth.role() IN ('authenticated', 'anon'));

create policy "solicitacoes_update" on solicitacoes
  for update using (auth.role() IN ('authenticated', 'anon'))
  with check (auth.role() IN ('authenticated', 'anon'));

create policy "servicos_read" on servicos
  for select using (auth.role() IN ('authenticated', 'anon'));

create policy "servicos_insert" on servicos
  for insert with check (auth.role() IN ('authenticated', 'anon'));

create policy "servicos_update" on servicos
  for update using (auth.role() IN ('authenticated', 'anon'))
  with check (auth.role() IN ('authenticated', 'anon'));

-- historico
create policy "historico_read" on solicitacao_historico
  for select using (
    (auth.jwt() ->> 'app_role') in ('admin','compras')
    or ((auth.jwt() ->> 'app_role') = 'diretoria')
    or ((auth.jwt() ->> 'app_role') = 'gerencia')
  );

create policy "historico_insert" on solicitacao_historico
  for insert with check (auth.role() = 'authenticated');

-- codigos (apenas admin)
create policy "codigos_admin_read" on codigos_acesso
  for select using ((auth.jwt() ->> 'app_role') = 'admin');

create policy "codigos_admin_write" on codigos_acesso
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

-- ============================================
-- POLÍTICAS RLS - TABELAS ERP
-- ============================================

-- categoria_item (leitura pública, escrita admin)
create policy "categoria_item_read" on categoria_item
  for select using (auth.role() in ('authenticated','anon'));

create policy "categoria_item_admin_write" on categoria_item
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

-- categoria_diretoria_orcamentaria (leitura pública, escrita admin)
create policy "categoria_dir_orcamentaria_read" on categoria_diretoria_orcamentaria
  for select using (auth.role() in ('authenticated','anon'));

create policy "categoria_dir_orcamentaria_admin_write" on categoria_diretoria_orcamentaria
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

-- admin_orcamento_config (leitura pública, escrita admin)
create policy "admin_orcamento_config_read" on admin_orcamento_config
  for select using (auth.role() in ('authenticated','anon'));

create policy "admin_orcamento_config_admin_write" on admin_orcamento_config
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

-- admin_fluxo_config (leitura pública, escrita admin)
create policy "admin_fluxo_config_read" on admin_fluxo_config
  for select using (auth.role() in ('authenticated','anon'));

create policy "admin_fluxo_config_admin_write" on admin_fluxo_config
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

-- centro_custo (leitura pública, escrita admin)
create policy "centro_custo_read" on centro_custo
  for select using (auth.role() in ('authenticated','anon'));

create policy "centro_custo_admin_write" on centro_custo
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

-- regra_categoria_centro_custo (leitura pública, escrita admin)
create policy "regra_categoria_read" on regra_categoria_centro_custo
  for select using (auth.role() in ('authenticated','anon'));

create policy "regra_categoria_admin_write" on regra_categoria_centro_custo
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

-- fornecedor (leitura pública, escrita admin)
create policy "fornecedor_read" on fornecedor
  for select using (auth.role() in ('authenticated','anon'));

create policy "fornecedor_admin_write" on fornecedor
  for all using ((auth.jwt() ->> 'app_role') = 'admin')
  with check ((auth.jwt() ->> 'app_role') = 'admin');

-- plano_anual (leitura - autenticado, escrita - admin/gerencia)
create policy "plano_anual_read" on plano_anual
  for select using (auth.role() = 'authenticated');

create policy "plano_anual_write" on plano_anual
  for all using ((auth.jwt() ->> 'app_role') in ('admin','gerencia'))
  with check ((auth.jwt() ->> 'app_role') in ('admin','gerencia'));

-- plano_diretoria (política específica por diretoria)
create policy "plano_diretoria_read" on plano_diretoria
  for select using (
    (auth.jwt() ->> 'app_role') = 'admin'
    or diretoria_id = (auth.jwt() ->> 'diretoria_id')::uuid
    or (auth.jwt() ->> 'app_role') in ('gerencia','compras')
  );

create policy "plano_diretoria_write" on plano_diretoria
  for all using (
    (auth.jwt() ->> 'app_role') = 'admin'
    or diretoria_id = (auth.jwt() ->> 'diretoria_id')::uuid
  )
  with check (
    (auth.jwt() ->> 'app_role') = 'admin'
    or diretoria_id = (auth.jwt() ->> 'diretoria_id')::uuid
  );

-- plano_item (acesso baseado na diretoria do plano)
create policy "plano_item_read" on plano_item
  for select using (
    (auth.jwt() ->> 'app_role') = 'admin'
    or exists (
      select 1 from plano_diretoria
      where plano_diretoria.id = plano_item.plano_diretoria_id
      and plano_diretoria.diretoria_id = (auth.jwt() ->> 'diretoria_id')::uuid
    )
    or (auth.jwt() ->> 'app_role') in ('gerencia','compras')
  );

create policy "plano_item_write" on plano_item
  for all using (
    (auth.jwt() ->> 'app_role') = 'admin'
    or exists (
      select 1 from plano_diretoria
      where plano_diretoria.id = plano_item.plano_diretoria_id
      and plano_diretoria.diretoria_id = (auth.jwt() ->> 'diretoria_id')::uuid
    )
  )
  with check (
    (auth.jwt() ->> 'app_role') = 'admin'
    or exists (
      select 1 from plano_diretoria
      where plano_diretoria.id = plano_item.plano_diretoria_id
      and plano_diretoria.diretoria_id = (auth.jwt() ->> 'diretoria_id')::uuid
    )
  );

-- orcamento_anual (leitura - admin/compras/gerencia por centro; escrita - admin)
create policy "orcamento_anual_read" on orcamento_anual
  for select using (
    (auth.jwt() ->> 'app_role') in ('admin','compras')
    or exists (
      select 1 from centro_custo
      where centro_custo.id = orcamento_anual.centro_custo_id
      and centro_custo.diretoria_id = (auth.jwt() ->> 'diretoria_id')::uuid
    )
  );

-- orcamento_anual write: allow admins and gerências to mutate budgets
create policy "orcamento_anual_write" on orcamento_anual
  for all using ((auth.jwt() ->> 'app_role') in ('admin','gerencia'))
  with check ((auth.jwt() ->> 'app_role') in ('admin','gerencia'));

-- solicitacao_compra (baseado em diretoria e centro)
create policy "solicitacao_compra_read" on solicitacao_compra
  for select using (
    (auth.jwt() ->> 'app_role') = 'admin'
    or diretoria_solicitante_id = (auth.jwt() ->> 'diretoria_id')::uuid
    or (auth.jwt() ->> 'app_role') in ('gerencia','compras')
  );

create policy "solicitacao_compra_write" on solicitacao_compra
  for all using (
    (auth.jwt() ->> 'app_role') = 'admin'
    or diretoria_solicitante_id = (auth.jwt() ->> 'diretoria_id')::uuid
  )
  with check (
    (auth.jwt() ->> 'app_role') = 'admin'
    or diretoria_solicitante_id = (auth.jwt() ->> 'diretoria_id')::uuid
  );

-- solicitacao_item (acesso baseado na solicitação)
create policy "solicitacao_item_read" on solicitacao_item
  for select using (
    (auth.jwt() ->> 'app_role') = 'admin'
    or exists (
      select 1 from solicitacao_compra
      where solicitacao_compra.id = solicitacao_item.solicitacao_compra_id
      and (
        solicitacao_compra.diretoria_solicitante_id = (auth.jwt() ->> 'diretoria_id')::uuid
        or (auth.jwt() ->> 'app_role') in ('gerencia','compras')
      )
    )
  );

create policy "solicitacao_item_write" on solicitacao_item
  for all using (
    (auth.jwt() ->> 'app_role') = 'admin'
    or exists (
      select 1 from solicitacao_compra
      where solicitacao_compra.id = solicitacao_item.solicitacao_compra_id
      and solicitacao_compra.diretoria_solicitante_id = (auth.jwt() ->> 'diretoria_id')::uuid
    )
  )
  with check (
    (auth.jwt() ->> 'app_role') = 'admin'
    or exists (
      select 1 from solicitacao_compra
      where solicitacao_compra.id = solicitacao_item.solicitacao_compra_id
      and solicitacao_compra.diretoria_solicitante_id = (auth.jwt() ->> 'diretoria_id')::uuid
    )
  );

-- aprovacao (acesso baseado em role)
create policy "aprovacao_read" on aprovacao
  for select using (
    (auth.jwt() ->> 'app_role') in ('admin','compras','gerencia','diretoria')
  );

create policy "aprovacao_write" on aprovacao
  for all using (
    (auth.jwt() ->> 'app_role') in ('admin','compras')
  )
  with check (
    (auth.jwt() ->> 'app_role') in ('admin','compras')
  );

-- log_orcamentario (leitura - admin/compras; escrita - sistema)
create policy "log_orcamentario_read" on log_orcamentario
  for select using (
    (auth.jwt() ->> 'app_role') in ('admin','compras')
    or exists (
      select 1 from centro_custo
      where centro_custo.id = log_orcamentario.centro_custo_id
      and centro_custo.diretoria_id = (auth.jwt() ->> 'diretoria_id')::uuid
    )
  );

-- ============================================
-- FUNCTIONS E TRIGGERS - ORÇAMENTO
-- ============================================

-- Function: atualizar orçamento quando há log
create or replace function atualizar_orcamento_por_log()
returns trigger as $$
begin
  if new.acao = 'reservar' then
    update orcamento_anual
    set valor_reservado = valor_reservado + new.valor
    where ano = new.ano and centro_custo_id = new.centro_custo_id;
  elsif new.acao = 'estornar_reserva' then
    update orcamento_anual
    set valor_reservado = valor_reservado - new.valor
    where ano = new.ano and centro_custo_id = new.centro_custo_id;
  elsif new.acao = 'executar' then
    update orcamento_anual
    set valor_executado = valor_executado + new.valor
    where ano = new.ano and centro_custo_id = new.centro_custo_id;
  elsif new.acao = 'estornar_execucao' then
    update orcamento_anual
    set valor_executado = valor_executado - new.valor
    where ano = new.ano and centro_custo_id = new.centro_custo_id;
  end if;
  return new;
end;
$$ language plpgsql;

-- Trigger: atualizar orcamento ao criar log
drop trigger if exists trigger_atualizar_orcamento on log_orcamentario;
create trigger trigger_atualizar_orcamento
after insert on log_orcamentario
for each row
execute function atualizar_orcamento_por_log();

-- Function: obter centro de custo padrão para uma categoria
create or replace function obter_centro_custo_categor(
  p_categoria_id uuid,
  p_data date default current_date
)
returns uuid as $$
declare
  v_centro_custo_id uuid;
begin
  select centro_custo_id into v_centro_custo_id
  from regra_categoria_centro_custo
  where categoria_id = p_categoria_id
    and vigencia_inicio <= p_data
    and (vigencia_fim is null or vigencia_fim >= p_data)
    and ativo = true
  order by vigencia_inicio desc
  limit 1;
  
  return v_centro_custo_id;
end;
$$ language plpgsql;

-- Function: calcular disponível no orçamento
create or replace function calcular_disponivel_orcamento(
  p_centro_custo_id uuid,
  p_ano integer
)
returns numeric as $$
declare
  v_disponivel numeric;
begin
  select (valor_aprovado - valor_reservado - valor_executado)
  into v_disponivel
  from orcamento_anual
  where centro_custo_id = p_centro_custo_id
    and ano = p_ano;
  
  return coalesce(v_disponivel, 0);
end;
$$ language plpgsql;
