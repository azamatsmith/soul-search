alter table public.sightings
  drop constraint sightings_claim_type_check,
  drop constraint sightings_check1;

alter table public.sightings
  add constraint sightings_claim_type_check
    check (claim_type in ('regular', 'special', 'challenge')),
  add constraint sightings_claim_categories_check
    check (
      (claim_type = 'regular' and cardinality(categories) = 0)
      or (claim_type = 'special' and cardinality(categories) > 0)
      or (claim_type = 'challenge' and cardinality(categories) = 1 and challenge_id is not null)
    );

update public.challenges
set rules = jsonb_build_object(
  'regular', rules -> 'regular',
  'false_call', rules -> 'false_call',
  'categories', coalesce(
    (
      select jsonb_agg(jsonb_build_object('name', bonus.key, 'points', bonus.value) order by bonus.key)
      from jsonb_each(coalesce(rules -> 'bonuses', '{}'::jsonb)) as bonus
    ),
    '[]'::jsonb
  )
)
where rules ? 'special' or rules ? 'bonuses';
