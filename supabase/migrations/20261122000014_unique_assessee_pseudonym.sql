-- T2: Prevent duplicate pseudonyms per batch (Observasi R16 #3)
-- 1. Safely renumber any existing colliding non-null pseudonyms within each batch
--    (never deletes rows or alters display_name / confirmed certificate names).
do $$
declare
  rec record;
  v_max_seq integer;
  v_next_pseudonym text;
begin
  for rec in (
    select id, batch_id
    from (
      select
        id,
        batch_id,
        pseudonym,
        row_number() over (partition by batch_id, pseudonym order by created_at asc, id asc) as rn
      from public.assessees
      where pseudonym is not null
    ) ranked
    where ranked.rn > 1
    order by batch_id, id
  ) loop
    select coalesce(
      max(
        case
          when pseudonym ~ '^ASESI-[0-9]+$' then substring(pseudonym from '^ASESI-([0-9]+)$')::integer
          else 0
        end
      ),
      0
    )
    into v_max_seq
    from public.assessees
    where batch_id = rec.batch_id;

    v_next_pseudonym := 'ASESI-' || lpad((v_max_seq + 1)::text, 3, '0');
    update public.assessees
      set pseudonym = v_next_pseudonym
      where id = rec.id;
  end loop;
end $$;

-- 2. Enforce uniqueness of non-null pseudonyms within each batch.
create unique index if not exists assessees_batch_pseudonym_uidx
  on public.assessees (batch_id, pseudonym)
  where pseudonym is not null;
