-- Organiza: adicionar horário às tarefas existentes (sem apagar registros).
-- Requisito: ter executado anteriormente ATUALIZAR_BANCO.sql,
-- que criou a coluna data_limite e a estrutura da recorrência.
-- Execute somente este arquivo ao atualizar da versão anterior.

alter table public.tarefas
  add column if not exists hora_limite time without time zone;

-- Horário só faz sentido se a tarefa também tiver uma data.
-- Permite reexecutar este SQL sem criar restrições duplicadas.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organiza_horario_requer_data'
      and conrelid = 'public.tarefas'::regclass
  ) then
    alter table public.tarefas
      add constraint organiza_horario_requer_data
      check (hora_limite is null or data_limite is not null);
  end if;
end $$;

-- Teste de leitura (opcional):
-- select texto, data_limite, hora_limite from public.tarefas limit 10;
