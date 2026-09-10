create policy schools_manage on public.schools for update to authenticated
using (private.has_school_role(id,array['matrix_admin','school_admin','director']::public.app_role[]))
with check (private.has_school_role(id,array['matrix_admin','school_admin','director']::public.app_role[]));

create policy classes_insert on public.classes for insert to authenticated
with check (private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator']::public.app_role[]));

create policy classes_update on public.classes for update to authenticated
using (private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator']::public.app_role[]))
with check (private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator']::public.app_role[]));

create policy classes_delete on public.classes for delete to authenticated
using (private.has_school_role(school_id,array['matrix_admin','school_admin','director','coordinator']::public.app_role[]));
