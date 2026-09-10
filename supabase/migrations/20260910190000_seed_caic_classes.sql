insert into public.classes (school_id, name, school_year)
select school.id, class_name.name, 2026
from public.schools as school
cross join (values
  ('1º Ano A'), ('1º Ano B'), ('1º Ano C'),
  ('2º Ano A'), ('2º Ano B'),
  ('3º Ano A'), ('3º Ano B'), ('3º Ano C'),
  ('4º Ano A'), ('4º Ano B'), ('4º Ano C'),
  ('5º Ano A'), ('5º Ano B'), ('5º Ano C')
) as class_name(name)
where school.slug = 'caic'
on conflict (school_id, name, school_year) do nothing;
