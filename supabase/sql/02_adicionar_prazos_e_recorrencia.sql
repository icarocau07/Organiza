-- ORGANIZA: MIGRAÇÃO PARA TAREFAS COM PRAZO E RECORRÊNCIA
-- Execute uma vez em Supabase > SQL Editor > New query > Run.
-- Este SQL ALTERA a tabela existente. NÃO apaga suas tarefas, contas nem políticas RLS.

alter table public.tarefas
  add column if not exists data_limite date,
  add column if not exists recorrente boolean not null default false,
  add column if not exists frequencia_recorrencia text;

-- Segurança dos dados: uma tarefa recorrente precisa de data + frequência válida.
-- O bloco permite executar novamente sem duplicar a restrição.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organiza_recorrencia_valida'
      and conrelid = 'public.tarefas'::regclass
  ) then
    alter table public.tarefas
      add constraint organiza_recorrencia_valida
      check (
        (recorrente = false and frequencia_recorrencia is null)
        or
        (recorrente = true
          and data_limite is not null
          and frequencia_recorrencia in ('diaria', 'semanal', 'mensal'))
      );
  end if;
end $$;

-- Teste opcional após executar (não altera os dados):
-- select id, texto, data_limite, recorrente, frequencia_recorrencia
-- from public.tarefas limit 10;
