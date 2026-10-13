-- APENAS PARA UM PROJETO SUPABASE NOVO.
-- Se você já executou o SQL da Etapa 3, NÃO execute novamente.
-- Este arquivo fica aqui como documentação da estrutura que o Organiza utiliza.

create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 1 and 120),
  categoria text not null default 'pessoal'
    check (categoria in ('pessoal', 'trabalho', 'estudos')),
  prioridade text not null default 'media'
    check (prioridade in ('baixa', 'media', 'alta')),
  concluida boolean not null default false,
  criada_em timestamptz not null default now()
);

create index tarefas_usuario_idx on public.tarefas(user_id, criada_em desc);

alter table public.tarefas enable row level security;
revoke all on public.tarefas from anon;
grant select, insert, update, delete on public.tarefas to authenticated;

create policy "Visualizar proprias tarefas" on public.tarefas
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Criar proprias tarefas" on public.tarefas
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Editar proprias tarefas" on public.tarefas
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Excluir proprias tarefas" on public.tarefas
  for delete to authenticated using ((select auth.uid()) = user_id);
