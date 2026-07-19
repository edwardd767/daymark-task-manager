alter table public.tasks
  add column if not exists due_date date;

update public.tasks
set due_date = created_at::date
where due_date is null;

alter table public.tasks
  alter column due_date set default current_date,
  alter column due_date set not null;

create index if not exists tasks_user_due_date_index
  on public.tasks(user_id, due_date);
