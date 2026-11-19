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

## 2. Part 2 — Roster Asesi (Bagian 2 brief, 2026-11-19)

- **Temuan 2.1 (tambah/ubah/hapus/impor asesi dari UI):** kode sudah lengkap di `c9349ee` (`roster-actions.ts` + triage page forms + assessee dropdown terisi dari `assessees`). Gate 146/146 lolos. Sisa: verifikasi live oleh auditor (Putaran 15b), memerlukan kredensial pemilik.
- **Temuan 2.2 (deteksi nama asesi folder ber-akhiran status):** perbaikan sudah ada di `c9349ee` (`STATUS_SUFFIX_RE`/`cleanStatusSuffixes`, `isNonCandidateFolder` hanya menolak nama sepenuhnya struktural, `explainNameInference` per berkas). Sisa: verifikasi live + pindai ulang folder pemilik (hanya dengan persetujuan pemilik; mengubah data batch).
- **Temuan 2.3 (impor Sheet Kelompok Asesi):** worker sudah membaca `kelompokSheetUrl`, parse `parseKelompokAsesiCsv`, upsert via `upsertAssesseesForBatch`; tombol impor ada di triase. Kode lengkap. Sisa: verifikasi live dengan Sheet sungguhan.
- **Observasi kecil (dikerjakan, commit ini):**
  - Label hitungan: sudah pisah "berkas Drive + unggahan" di semua keadaan batch (tidak perlu perubahan kode).
  - Pesan matriks kelengkapan (`completeness-matrix.tsx`): kini membedakan (a) belum ada berkas, (b) pindai selesai tapi 0 asesi, (c) berkas ditemukan tapi pemindaian belum selesai — dengan aksi yang relevan.
  - Nama skema + LSP di header batch (`page.tsx` + `getLspById` di `auth.repository.ts`): menampilkan nama LSP; skema menampilkan "Belum ditetapkan" bila tidak ditemukan (penjelasan, bukan "-" samar). Pereta data (tetapkan skema AK3U ke batch `c61cf7c5` / backfill scheme_id) membutuhkan persetujuan pemilik — tidak dilakukan di sini.
- **Verifikasi:** `tsc --noEmit` clean; `eslint --max-warnings 0` clean; `vitest` 146/146 passed.

## 3. Environment Architecture Adaptations

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
