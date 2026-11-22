-- T4 & ADR-0005: Refine AK3U 04a/04b classifier patterns and register optional ADR-0005 blanko slots
-- 1. Narrow overly broad 'dit' token on AK3U 04a so presentations classify as 04b rather than 04a.
update public.scheme_form_manifests
set file_patterns = array['04a', 'ia.04a', 'ia 04a', 'daftar instruksi terstruktur']
where form_key = '04a'
  and file_patterns = array['04a', 'ia.04a', 'ia 04a', 'dit']
  and exists (
    select 1 from public.schemes s
    where s.id = public.scheme_form_manifests.scheme_id
      and upper(trim(s.code)) = 'AK3U'
  );

update public.scheme_form_manifests
set file_patterns = array['04b', 'ia.04b', 'ia 04b', 'presentasi', 'paparan']
where form_key = '04b'
  and file_patterns = array['04b', 'ia.04b', 'ia 04b', 'presentasi']
  and exists (
    select 1 from public.schemes s
    where s.id = public.scheme_form_manifests.scheme_id
      and upper(trim(s.code)) = 'AK3U'
  );

-- 2. Register ADR-0005 optional blanko/lampiran entries on AK3U schemes (Cacat 7b & Cacat 8 FR.IA.07).
with adr0005_forms(form_key, form_name, file_patterns, required, instrument_role, sort_order) as (
  values
    ('mapa01', 'FR.MAPA.01 — Merencanakan Aktivitas dan Proses Asesmen', array['fr.mapa.01', 'mapa.01', 'mapa 01'], false, 'mapa', 12),
    ('mapa02', 'FR.MAPA.02 — Peta Instrumen Asesmen Hasil Pendekatan Asesmen', array['fr.mapa.02', 'mapa.02', 'mapa 02'], false, 'mapa', 13),
    ('fr_va', 'FR.VA — Memberikan Kontribusi dalam Validasi Asesmen', array['fr.va', 'validasi asesmen'], false, 'custom', 14),
    ('ia07', 'FR.IA.07 — Daftar Pertanyaan Lisan', array['fr.ia.07', 'ia.07', 'ia 07', 'pertanyaan lisan'], false, 'custom', 15),
    ('ia08', 'FR.IA.08 — Ceklis Verifikasi Portofolio', array['fr.ia.08', 'ia.08', 'ia 08'], false, 'portofolio', 16),
    ('ia10', 'FR.IA.10 — Klarifikasi Bukti Pihak Ketiga', array['fr.ia.10', 'ia.10', 'ia 10'], false, 'custom', 17),
    ('ak03', 'FR.AK.03 — Umpan Balik dan Catatan Asesmen', array['fr.ak.03', 'ak.03', 'ak 03'], false, 'administrasi', 18),
    ('ak04', 'FR.AK.04 — Banding Asesmen', array['fr.ak.04', 'ak.04', 'ak 04', 'banding asesmen'], false, 'administrasi', 19),
    ('ak06', 'FR.AK.06 — Meninjau Proses Asesmen', array['fr.ak.06', 'ak.06', 'ak 06'], false, 'administrasi', 20),
    ('ak07', 'FR.AK.07 — Ceklis Penyesuaian yang Wajar dan Beralasan', array['fr.ak.07', 'ak.07', 'ak 07'], false, 'administrasi', 21),
    ('berita_acara', 'Berita Acara & Daftar Hadir Asesmen', array['berita acara asesmen', 'daftar hadir asesmen'], false, 'administrasi', 22)
)
insert into public.scheme_form_manifests (
  lsp_id, scheme_id, form_key, form_name, file_patterns, required, instrument_role, sort_order
)
select
  s.lsp_id,
  s.id,
  f.form_key,
  f.form_name,
  f.file_patterns,
  f.required,
  f.instrument_role,
  f.sort_order
from public.schemes s
cross join adr0005_forms f
where upper(trim(s.code)) = 'AK3U'
on conflict (scheme_id, form_key) do nothing;
