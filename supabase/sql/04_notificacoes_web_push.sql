-- NOVO: execute APENAS este arquivo no SQL Editor do projeto Supabase existente.
-- Não altera a tabela tarefas e não apaga registros antigos.
-- As assinaturas são geridas só pela função Netlify com service_role.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  timezone text not null,
  lead_minutes integer not null default 15 check (lead_minutes in (5,15,30,60)),
  last_test_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

create table if not exists public.push_delivery_log (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  task_id uuid not null references public.tarefas(id) on delete cascade,
  scheduled_for timestamptz not null,
  lead_minutes integer not null,
  created_at timestamptz not null default now(),
  unique (subscription_id, task_id, scheduled_for, lead_minutes)
);

create index if not exists push_delivery_log_created_idx
  on public.push_delivery_log(created_at);

alter table public.push_subscriptions enable row level security;
alter table public.push_delivery_log enable row level security;

-- Nenhuma policy de acesso direto pelo navegador. Apenas service_role pode operar.
revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.push_delivery_log from anon, authenticated;

grant select, insert, update, delete on public.push_subscriptions to service_role;
grant select, insert, update, delete on public.push_delivery_log to service_role;

-- Verificação opcional após executar:
-- select to_regclass('public.push_subscriptions'), to_regclass('public.push_delivery_log');
