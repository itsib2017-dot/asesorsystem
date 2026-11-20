# Skill Gap & Tooling Bootstrap Log

- **Date / Timestamp:** 2026-11-18 09:06:00 +07:00
- **Mode:** ENTERPRISE AUDIT MODE (§0.2)
- **Authority:** `ground_rules_v5.md` (§A.7 & Step 0)
- **Supabase Target:** `oiplhsmmfuqriaqrxjud` (remote linked project)

---

## 1. Skill & Tool Status Table

| Skill / Tool | Required Priority (§A.7) | Status | Execution / Emulation Protocol |
| :--- | :--- | :--- | :--- |
| **Context7 MCP** | P0 (Must have) | **Active** | Lazy-loaded MCP server (`resolve-library-id`, `query-docs`) available. Query before proposing any new API or library pattern. |
| **Supabase CLI** | P0 (Must have) | **Active** | `supabase v3.2.0` installed. Linked to remote project `oiplhsmmfuqriaqrxjud`. Used with `--remote` flags. |
| **Local Docker Engine** | Infrastructure | **Emulated / Bypassed** | Docker is not running on host. Local `supabase db reset` bypassed in favor of remote Supabase CLI commands (`supabase db push --remote`, remote migration checks). |
| **Vitest / Integration Testing** | P0 (Must have) | **Active (Local Node)** | Vitest runs via Node.js `v24.22.1` for unit and database integration RLS tests. |
| **Playwright (E2E)** | P0 (Must have) | **Active (Local Node)** | Runs headfully/headless against preview/local App Router endpoints. |
| **Document Skill / Markdown** | P0 (Must have) | **Active** | Native toolset (`read_file`, `write_file`, `edit_file`) for cross-referencing and maintaining spec docs. |
| **Caveman** | P2 (Nice to have) | **Active** | Located in `.agents/skills/caveman/SKILL.md` for structured reasoning. |
| **TDD & Code-Review** | P1 (Should have) | **Active** | Located in `.agents/skills/tdd` and `.agents/skills/code-review`. Mandatory self-review gate on every ticket. |
| **Graphify** | P2 (Nice to have) | **Active** | Located in `.agents/skills/graphify/SKILL.md`. |
| **Sentry** | P1 (Should have) | **Emulated** | Emulated via structured JSON logging with correlation IDs (§C.2) until client SDK integration. |
| **Vercel CLI / Vercel Logs** | P1 (Should have) | **Emulated** | Emulated via local bundle size checks (`next build`) and CI check commands. |
| **gitleaks** | P2 (Nice to have) | **Emulated** | Emulated via pre-commit regex scanner blocking committed keys, `.env` files, and PII paths (`DATA ASESI/`, `*.pdf`, `*.jpg`). |

---

## 2. Environment Architecture Adaptations

1. **Database Verification without Docker**:
   - Docker daemon is not active on this environment.
   - Migrations are verified and deployed directly against the linked remote project `oiplhsmmfuqriaqrxjud` using `supabase db push --remote` or remote migration listing.
   - Both `20261118000001_foundation.sql` and `20261118000002_hardening.sql` are confirmed applied on remote.
   - Any further schema fixes must be forward-only via `supabase/migrations/20261118000003_*.sql`.

2. **BYOK UI Architecture (User Mandate)**:
   - Dynamic configuration UI (`Provider Settings`) requested by user.
   - Supported providers: Anthropic (Claude), OpenAI-compatible, Gemini.
   - Fields: `API Key`, `Base URL (optional gateway)`, `ANTHROPIC_AUTH_TOKEN`, `Model`, `Temperature`, `Max tokens`, `Thinking budget`, `Google Drive API key`.
   - Security Boundary: Stored encrypted server-side per assessor or submitted per request. Never hardcoded in source code or committed to repository.

## 3. Part 3 — Kesenjangan P0 (Cacat 1–6), branch fix/p0-kesenjangan-cacat-1-6

- **Temuan 2.1/2.2/2.3 (Roster):** sudah lengkap di `c9349ee`; verifikasi live tertunda (Putaran 15b, kredensial pemilik).
- **Triage page regression (Bagian 1, Blocker P0) — DIPERBAIKI:**
  - Root cause (dari log Vercel production): Next.js 16 client-boundary enforces Server Action recognition. `page.tsx` defined local async wrapper functions (`handleAddAssessee`, `handleUpdateAssessee`, `handleDeleteAssessee`, `handleImportRoster`) passed as `form action` — not recognized as Server Actions because they were local, non-exported, in a non-`"use server"` file. Production error: "Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with 'use server'." and "Event handlers cannot be passed to Client Component props."
  - Fix: removed local wrappers; added void-returning wrapper form actions (`addAssesseeFormAction`, `updateAssesseeFormAction`, `deleteAssesseeFormAction`, `importRosterFormAction`) in `triage/actions.ts` (already `"use server"`); imported and used them in `page.tsx`.
  - Defensive hardening: `explainNameInference` now guards `drivePath` against null/undefined; `mapDrizzleDriveFileRow` coerces null `drivePath` to `""`; triage page guards `f.drivePath` before calling `explainNameInference`.
- **Cacat 4 Trigger UI (selesai, commit ini):**
  - `similarity_run`: tombol "Jalankan Analisis Kemiripan" di halaman similarity, enqueue job + feedback job id/status.
  - `ocr_ktp`: tombol "Jalankan OCR KTP" di kartu asesi (halaman detail asesi), OCR lokal via Tesseract.js.
  - `extract_file`: tombol "Ekstrak Teks" / "Ekstrak Ulang" per baris berkas di halaman triase, enqueue job extract_file.
- **Cacat 1 OCR KTP (implementasi selesai, verifikasi live tertunda):**
  - Dependensi `tesseract.js^7.0.0` terinstal (diminta eksplisit brief; butuh approval dependensi).
  - Server action `runOcrKtpAction`: unduh gambar KTP dari Drive → `Tesseract.recognize(buffer, "ind")` fallback `"eng"` → simpan `ktpNameOcr`+`ocrConfidence` → jalankan name jury berbasis teks OCR → tampil di NameJuryCard.
  - Gambar KTP **tidak pernah ke LLM** (UU PDP / privasi).
  - `Tesseract.recognize` tersedia sebagai fungsi pada namespace module; signature `(image, langs, options)` terima Buffer.
  - **Verifikasi live BELUM bisa dilakukan:** `vercel` CLI logged out (tidak bisa deploy ke Vercel untuk uji runtime); brief melarang menggunakan data asesi nyata / gambar KTP asli untuk uji. Memerlukan deploy ke Vercel + uji dengan gambar KTP demo.
- **Cacat 5 Model answers + 04A export (selesai):**
  - Jawaban model per soal sudah tampil di halaman DIT (sudah ada dari sebelumnya).
  - Ditambahkan `generateIa04aDocx` + `buildIa04aPayload` + rute export `form=ia04a` + tombol "Ekspor FR.IA.04A (.docx)" di halaman DIT.
- **Cacat 6 Kata sandi (selesai):**
  - min 12 karakter + kompleksitas (huruf besar/kecil, angka, karakter spesial) + blokir daftar kata sandi lemah secara lokal, di skema Zod dan formulir registrasi.
- **Ditangguhkan (butuh keputusan Anda):** Cacat 6 peran (daftar kanonik belum dikonfirmasi), Cacat 2 MFA (implementasi vs. keputusan penundaan), Cacat 3 invite-only + batasi `/register`.

## 4. Sesi 2026-11-20 — Bootstrap ulang & RCA triage R4

- **Caveman:** active (reasoning scaffold). **Graphify:** active; cache `graphify-out/graph.json` stale (built `e7fa16c9`, HEAD `3dabf1f`) — dipakai untuk orientasi saja, bukan bukti.
- **Ponytail:** sebelumnya tidak terpasang. 2026-11-20 dipasang via `npx skills add dietrichgebert/ponytail@ponytail -g -y` (sumber 136,8K installs; risk assessment Safe / 0 alerts / Low Risk) dan aktif. Playwright aktif via browser tools + Playwright 1.41.1 lokal (kredensial dibaca runtime).
- **Context7 MCP:** tersedia; dipakai hanya untuk keputusan API/versi baru (belum ada API baru di ticket triage).
- **Vercel CLI:** tidak ada di PATH; tersedia via `npx --no-install vercel` (login `itsib2017-7919`). Dipakai **khusus logs**, bukan deploy. Deploy otomatis via git push.
- **Playwright:** `1.41.1` (global Nodist), chromium `1208` dipakai lewat `executablePath`. Kredensial demo dibaca runtime dari file lokal, tidak pernah dicetak/committed.
- **RCA triage R4 (dari log Vercel Production, requestId `xs8kd-1795129388167-87b4dff83b9b`, 2026-11-19T23:03:11Z):**
  `Error: Event handlers cannot be passed to Client Component props. {action: ..., className: "inline", onSubmit: function onSubmit, children: ...}`
  Handler `onSubmit` inline ada di `triage/page.tsx` (Server Component) pada form Ubah/Hapus asesi. Render hanya terjadi bila batch punya asesi → R4 (23 asesi) gagal, `c61cf7c5` (0 asesi) tidak memicu cabang ini. Bukan null `drivePath`/`docType`.
- **Fix:** form Ubah/Hapus dipindah ke `triage/assessee-actions.tsx` (`"use client"`). Guard null `docType`/`fileName`/`drivePath` ditambahkan. Tes regresi source-scan ditambahkan.
