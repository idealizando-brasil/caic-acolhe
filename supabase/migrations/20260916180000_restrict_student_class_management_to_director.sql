-- Regra institucional: somente a Direção pode cadastrar, editar ou excluir
-- alunos e turmas. Os demais perfis mantêm apenas as permissões de leitura
-- já definidas nas políticas específicas.

-- ALUNOS
drop policy if exists staff_manage_students on public.students;

create policy director_manage_students
on public.students
for all
to authenticated
using (
  private.has_school_role(
    school_id,
    array['director']::public.app_role[]
  )
)
with check (
  private.has_school_role(
    school_id,
    array['director']::public.app_role[]
  )
);

-- TURMAS
drop policy if exists classes_insert on public.classes;
drop policy if exists classes_update on public.classes;
drop policy if exists classes_delete on public.classes;

create policy classes_insert
on public.classes
for insert
to authenticated
with check (
  private.has_school_role(
    school_id,
    array['director']::public.app_role[]
  )
);

create policy classes_update
on public.classes
for update
to authenticated
using (
  private.has_school_role(
    school_id,
    array['director']::public.app_role[]
  )
)
with check (
  private.has_school_role(
    school_id,
    array['director']::public.app_role[]
  )
);

create policy classes_delete
on public.classes
for delete
to authenticated
using (
  private.has_school_role(
    school_id,
    array['director']::public.app_role[]
  )
);
