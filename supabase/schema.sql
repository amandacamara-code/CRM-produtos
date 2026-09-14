-- =========================================================
--  CRM de Produtos da Firece — esquema, permissões e login
--
--  COMO USAR: abra o seu projeto no Supabase → SQL Editor →
--  New query → cole este arquivo INTEIRO → Run.
--  Pode rodar mais de uma vez sem quebrar nada.
-- =========================================================

-- ---------------------------------------------------------
-- 1. USUÁRIOS
--    Espelha o login do Supabase (auth.users) e guarda o
--    perfil de acesso de cada pessoa.
-- ---------------------------------------------------------
create table if not exists public.usuarios (
  id        uuid primary key references auth.users(id) on delete cascade,
  nome      text not null,
  email     text not null,
  cargo     text,
  perfil    text not null default 'consultor'
            check (perfil in ('admin', 'gestor', 'consultor', 'leitor')),
  ativo     boolean not null default false,
  criado_em timestamptz not null default now()
);

comment on table public.usuarios is
  'Perfil de acesso de cada pessoa. ativo=false bloqueia o acesso a tudo.';

-- ---------------------------------------------------------
-- 2. FUNÇÕES DE APOIO ÀS PERMISSÕES
--    security definer: leem a tabela usuarios por fora do RLS,
--    o que evita recursão infinita nas políticas.
-- ---------------------------------------------------------
create or replace function public.perfil_atual()
returns text language sql stable security definer set search_path = public as $$
  select perfil from public.usuarios where id = auth.uid() and ativo
$$;

create or replace function public.tem_acesso()
returns boolean language sql stable security definer set search_path = public as $$
  select public.perfil_atual() is not null
$$;

create or replace function public.e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.perfil_atual() = 'admin', false)
$$;

create or replace function public.e_gestor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.perfil_atual() in ('admin', 'gestor'), false)
$$;

-- leitor enxerga tudo, mas não grava
create or replace function public.ve_tudo()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.perfil_atual() in ('admin', 'gestor', 'leitor'), false)
$$;

create or replace function public.pode_editar()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.perfil_atual() in ('admin', 'gestor', 'consultor'), false)
$$;

-- ---------------------------------------------------------
-- 3. TABELAS DE DADOS
--    O registro inteiro vai em `dados` (jsonb), do jeito que o
--    sistema usa. Só o que as permissões precisam sai para
--    coluna própria. Assim o gestor pode criar campos, status e
--    categorias novos pela tela, sem migração de banco.
-- ---------------------------------------------------------
create table if not exists public.produtos (
  id             text primary key,
  responsavel_id uuid references public.usuarios(id) on delete set null,
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.clientes (
  id             text primary key,
  responsavel_id uuid references public.usuarios(id) on delete set null,
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.oportunidades (
  id             text primary key,
  responsavel_id uuid references public.usuarios(id) on delete set null,
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.vendas (
  id             text primary key,
  responsavel_id uuid references public.usuarios(id) on delete set null,
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.tarefas (
  id             text primary key,
  responsavel_id uuid references public.usuarios(id) on delete set null,
  dados          jsonb not null,
  atualizado_em  timestamptz not null default now()
);

-- configurações do sistema: uma única linha compartilhada
create table if not exists public.configuracoes (
  id            int primary key default 1 check (id = 1),
  dados         jsonb not null,
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_clientes_resp      on public.clientes (responsavel_id);
create index if not exists idx_oportunidades_resp on public.oportunidades (responsavel_id);
create index if not exists idx_vendas_resp        on public.vendas (responsavel_id);
create index if not exists idx_tarefas_resp       on public.tarefas (responsavel_id);

-- carimbo automático de atualização
create or replace function public.marcar_atualizacao()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['produtos','clientes','oportunidades','vendas','tarefas','configuracoes'] loop
    execute format('drop trigger if exists trg_atualizacao on public.%I', t);
    execute format('create trigger trg_atualizacao before update on public.%I
                    for each row execute function public.marcar_atualizacao()', t);
  end loop;
end $$;

-- ---------------------------------------------------------
-- 4. PERMISSÕES (RLS)
--    A partir daqui o bloqueio é do BANCO, não da tela: um
--    consultor não consegue ler os dados de outro nem chamando
--    a API diretamente.
-- ---------------------------------------------------------
alter table public.usuarios       enable row level security;
alter table public.produtos       enable row level security;
alter table public.clientes       enable row level security;
alter table public.oportunidades  enable row level security;
alter table public.vendas         enable row level security;
alter table public.tarefas        enable row level security;
alter table public.configuracoes  enable row level security;

-- --- usuários: todo mundo logado vê a equipe; só admin altera ---
drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select to authenticated
  using (public.tem_acesso() or id = auth.uid());

drop policy if exists usuarios_insert on public.usuarios;
create policy usuarios_insert on public.usuarios
  for insert to authenticated with check (public.e_admin());

drop policy if exists usuarios_update on public.usuarios;
create policy usuarios_update on public.usuarios
  for update to authenticated
  using (public.e_admin()) with check (public.e_admin());

drop policy if exists usuarios_delete on public.usuarios;
create policy usuarios_delete on public.usuarios
  for delete to authenticated using (public.e_admin() and id <> auth.uid());

-- --- produtos: catálogo compartilhado; só admin/gestor edita ---
drop policy if exists produtos_select on public.produtos;
create policy produtos_select on public.produtos
  for select to authenticated using (public.tem_acesso());

drop policy if exists produtos_write on public.produtos;
create policy produtos_write on public.produtos
  for all to authenticated
  using (public.e_gestor()) with check (public.e_gestor());

-- --- clientes, oportunidades, vendas e tarefas ---
--  admin/gestor/leitor: veem tudo
--  consultor: só os próprios registros
do $$
declare t text;
begin
  foreach t in array array['clientes','oportunidades','vendas','tarefas'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    -- tem_acesso() na frente: desativar alguém corta o acesso a TUDO,
    -- inclusive aos registros em que a pessoa é a responsável.
    execute format($f$
      create policy %I_select on public.%I for select to authenticated
      using (public.tem_acesso()
             and (public.ve_tudo() or responsavel_id = auth.uid()))
    $f$, t, t);

    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format($f$
      create policy %I_insert on public.%I for insert to authenticated
      with check (public.pode_editar()
                  and (public.e_gestor() or responsavel_id = auth.uid()))
    $f$, t, t);

    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format($f$
      create policy %I_update on public.%I for update to authenticated
      using (public.pode_editar()
             and (public.e_gestor() or responsavel_id = auth.uid()))
      with check (public.pode_editar()
                  and (public.e_gestor() or responsavel_id = auth.uid()))
    $f$, t, t);

    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format($f$
      create policy %I_delete on public.%I for delete to authenticated
      using (public.pode_editar()
             and (public.e_gestor() or responsavel_id = auth.uid()))
    $f$, t, t);
  end loop;
end $$;

-- --- configurações: todos leem, admin/gestor grava ---
drop policy if exists config_select on public.configuracoes;
create policy config_select on public.configuracoes
  for select to authenticated using (public.tem_acesso());

drop policy if exists config_write on public.configuracoes;
create policy config_write on public.configuracoes
  for all to authenticated
  using (public.e_gestor()) with check (public.e_gestor());

-- ---------------------------------------------------------
-- 5. CRIAÇÃO AUTOMÁTICA DO PERFIL NO PRIMEIRO LOGIN
--    A PRIMEIRA pessoa a se cadastrar vira administradora e já
--    entra liberada. As seguintes entram como consultor e
--    BLOQUEADAS, até que um administrador libere o acesso em
--    Configurações → Usuários. O perfil nunca vem do cadastro,
--    para ninguém conseguir se promover sozinho.
-- ---------------------------------------------------------
create or replace function public.criar_perfil_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  qtd int;
begin
  select count(*) into qtd from public.usuarios;
  insert into public.usuarios (id, nome, email, perfil, ativo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1)),
    new.email,
    case when qtd = 0 then 'admin' else 'consultor' end,
    qtd = 0
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_criar_perfil on auth.users;
create trigger trg_criar_perfil
  after insert on auth.users
  for each row execute function public.criar_perfil_usuario();

-- ---------------------------------------------------------
-- 6. TEMPO REAL
--    Faz a alteração de uma pessoa aparecer na tela das outras.
-- ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['usuarios','produtos','clientes','oportunidades','vendas','tarefas','configuracoes'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
