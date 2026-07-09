insert into public.processes (name, description)
values
  ('Process', 'Atelier process principal'),
  ('Fabrication PP', 'Atelier fabrication pate pressee'),
  ('Fabrication camembert', 'Atelier fabrication camembert'),
  ('Produit frais', 'Atelier produits frais'),
  ('Fromage blanc', 'Atelier fromage blanc'),
  ('Fromage bleu', 'Atelier fromage bleu')
on conflict (name) do update
set description = excluded.description,
    is_active = true,
    updated_at = now();

with equipment_seed (process_name, equipment_name) as (
  values
    ('Process', 'Pasteurisateur 5T'),
    ('Process', 'Citernes reception B8'),
    ('Process', 'Citernes reception B9'),
    ('Process', 'Citernes reception B7'),
    ('Process', 'Citernes reception B13'),
    ('Process', 'Citernes reception A3'),
    ('Fabrication PP', 'APV 1'),
    ('Fabrication PP', 'APV 2'),
    ('Fabrication PP', 'APV 3'),
    ('Fabrication PP', 'Bac de drainage'),
    ('Fabrication PP', 'Ligne lactoserum'),
    ('Fabrication PP', 'Ligne pate presses'),
    ('Fabrication camembert', 'Ligne camembert'),
    ('Fabrication camembert', 'Citerne 1'),
    ('Fabrication camembert', 'Citerne 2'),
    ('Produit frais', 'B1'),
    ('Produit frais', 'B2'),
    ('Produit frais', 'F1'),
    ('Produit frais', 'F3'),
    ('Produit frais', 'Pree pack'),
    ('Produit frais', 'Ligne mixte'),
    ('Fromage blanc', 'F5'),
    ('Fromage blanc', 'F9'),
    ('Fromage blanc', 'Ligne sortie fromage'),
    ('Fromage bleu', 'Ligne Fromage bleu')
)
insert into public.equipments (process_id, name, status)
select p.id, es.equipment_name, 'available'::public.equipment_status
from equipment_seed es
join public.processes p on p.name = es.process_name
on conflict (process_id, name) do update
set is_active = true,
    updated_at = now();

insert into public.equipment_reference_limits (process_id, parameter, min_value, max_value, unit)
select p.id, v.parameter::public.parameter_type, v.min_value, v.max_value, v.unit
from public.processes p
cross join (
  values
    ('temperature', 60.0, 90.0, 'degC'),
    ('duration', 15.0, 120.0, 'min'),
    ('water_consumed', 0.0, 5000.0, 'L'),
    ('conductivity', null, null, 'mS/cm'),
    ('concentration', null, null, '%'),
    ('flow_rate', null, null, 'L/min'),
    ('pressure', null, null, 'bar'),
    ('soda_quantity', 0.0, null, 'L'),
    ('acid_quantity', 0.0, null, 'L')
) as v(parameter, min_value, max_value, unit)
on conflict (process_id, parameter)
where process_id is not null and equipment_id is null and is_active
do update
set min_value = excluded.min_value,
    max_value = excluded.max_value,
    unit = excluded.unit,
    updated_at = now();

insert into public.cip_instructions (process_id, title, content, version)
select
  p.id,
  'Instruction CIP - ' || p.name,
  'Verifier la disponibilite de l''equipement, valider la checklist de securite, demarrer le cycle CIP, enregistrer les parametres de nettoyage, puis cloturer le cycle avec le resultat conforme ou non conforme.',
  1
from public.processes p
where not exists (
  select 1
  from public.cip_instructions existing
  where existing.process_id = p.id
    and existing.title = 'Instruction CIP - ' || p.name
);
