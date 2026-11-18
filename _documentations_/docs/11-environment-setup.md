# 11 — Environment Setup

**Project:** AsesorKompetensi — LSP/BNSP assessor web app (OHSE-first, general certification)
**Version:** v1.4 — 18 November 2026 · **Status:** Draft for review
**Changelog v1.4:** provider-agnostic BYOK (D18 — no provider key in env files, keys user-supplied at runtime via Provider Settings; §1, §3, §6, §7); scheme manifest seed keys + provider config keys (§5.2); no hardcoded values (D21 — config-based throughout); dashboard needs framer-motion + lucide-react (§2). **Changelog v1.3:** two 06B copies documented (encrypted SKEMA blank vs plain working key) + PASSWORD xlsx handling (§7, §2.1, §10); no new secrets, no new dependencies. **Changelog v1.2:** `signatures` Storage bucket + signature config keys (§5.3, §5.2); KTP OCR uses the existing worker Tesseract — no new install (§7); troubleshooting rows for signature upload, signature preview expiry, OCR garbage, jury redaction (§10). No new secrets.
**Changelog v1.1:** queue decision — pg-boss is the default (see §7); PPTX extraction + encrypted-06B dependencies (§2, §7); prompt-registry seeding from `research/prompts/` with SHA-256 hashes (§5.5); repo-privacy rule for developers (§2.1 — the repo now contains assessee personal data and is public); MFA wording fixed — no finance roles in this system (§5.4).
**Stack (canonical):** Next.js App Router + TypeScript · Supabase (Postgres / Auth / Storage / pgvector) · Vercel AI SDK · **provider-agnostic BYOK (v1.4, D18 — no primary model)** · async job queue/worker. **Config-based throughout (v1.4, D21):** no hardcoded values at all — every scheme/org/deployment value comes from config, never from code literals; even a fallback is a config value, not a code constant.
**Repo:** https://github.com/danste-kun/asesorkompetensi — no longer empty: it now holds the scheme blank forms (SKEMA/), completed-batch records (ASESMEN (DONE)/), and the Nov 2026 batch data (DATA ASESI/). This guide takes the repo from its current state to a running local dev environment; it does not ask you to download the assessee data (§2.1).

> **Secrets rule:** never commit a real secret.
> **Terminology:** DIT = Daftar Instruksi **Terstruktur** (FR.IA.04A); FR.AK.05 is per-assessor, per-batch; decision is binary K / BK only. All values below are placeholders (`<…>`). Real keys live in `.env.local` (git-ignored) locally and in the hosting provider's secret store in staging/production. Never paste a real key into chat, a doc, or a screenshot.

## 1. Prerequisites

| Requirement | Version / note |
|---|---|
| Node.js | 20 LTS or newer (`node -v`) |
| pnpm | 9+ (`corepack enable pnpm`); npm works but pnpm is the documented path |
| Git | Any recent version |
| Supabase CLI | Latest (`supabase --version`); install via `brew install supabase/tap/supabase` (macOS) or the standalone binary (Linux/Windows) — see Supabase docs |
| Google Cloud account | For the Drive API key (§4). Any Google account; no billing card needed while under the Drive API daily threshold (400,000,000 units/day — see Tech-Stack Brief §3.1) |
| LLM provider account of your choice | For the LLM key (§6). **v1.4 (D18):** Anthropic, OpenAI-compatible, Gemini, OpenRouter / OmniRouter / 9Router, Nvidia NIM, or another provider — bring your own key (BYOK), free tiers usable. There is no primary provider and no provider key in env files: the key is supplied at runtime via Provider Settings. |
| Tesseract (worker only) | Tesseract 5 with `ind` + `eng` language data — needed only if you run OCR locally; the deployed worker installs it via its Dockerfile / buildpack |
| Docker (optional) | Only if you run Supabase locally via the CLI (recommended) |

Check: `node -v && pnpm -v && git --version && supabase --version`.

## 2. Repo setup (empty repo → Next.js + Supabase)

```bash
# 1. Clone the repo
git clone https://github.com/danste-kun/asesorkompetensi.git
cd asesorkompetensi

# 2. Scaffold Next.js (App Router, TypeScript, ESLint, Tailwind, src/ dir, no Turbopack change needed)
pnpm create next-app@latest . --typescript --eslint --tailwind --src-dir --app --import-alias "@/*"

# 3. Install the product dependencies
pnpm add @supabase/supabase-js @supabase/ssr
pnpm add ai @ai-sdk/openai @ai-sdk/google @ai-sdk/anthropic zod   # provider SDKs — install the ones your configured provider needs; the app never hard-codes a provider (v1.4, D18)
pnpm add framer-motion lucide-react   # v1.4 (D20) — Dashboard V18 motion + icons (glass-card hover lift, StatsCard arrows)
pnpm add pdfjs-dist mammoth exceljs docx pdf-lib jszip
pnpm add pg-boss          # job queue — Postgres-backed, no extra service (see §7)
pnpm add googleapis          # Drive API v3 client
pnpm add -D vitest @playwright/test @types/node

# 4. Supabase local project
supabase init
supabase start                # starts local Postgres/Auth/Storage on Docker
supabase migration new init_schema
# ... write the first migration (see §5), then:
supabase db push

# 5. Playwright browsers (E2E, once)
pnpm exec playwright install chromium

# 6. Run
pnpm dev                      # app on http://localhost:3000
pnpm worker:dev               # job worker (separate terminal; see §7)
```

Expected first-run result: the home page renders, login works against local Supabase, and a "hello" job completes in the worker log. If `supabase start` fails, check Docker is running; the fallback is a hosted Supabase project (§5) with `supabase link`.

## 2.1 Repo-privacy rule for developers (v1.1 — read before cloning)

The repo now contains assessee personal data (DATA ASESI/ and ASESMEN (DONE)/ hold KTP scans, diplomas, CVs, and photos) and is **public**. That data is there for the assessor's work; it is not project material:

- **Do not pull assessee files into the codebase.** No assessee document, name, NIK, phone, or address goes into `src/`, `tests/fixtures/`, `docs/`, screenshots, or issues. Test fixtures use synthetic names only (see QA 10 §1).
- **Do not `git clone` the whole repo on a shared machine and leave it there** if you only need the code — use a sparse checkout of the code paths, or work from a fresh clone you delete when done.
- **Do not commit anything that touches assessee data** — no exports, no downloaded Drive files, no "test with the real batch" artefacts. The `.gitignore` must cover `*.pdf`, `*.docx`, `*.pptx`, `*.xlsx` outside `research/` and `docs/` until the repo is made private and the data is moved out (a decision for Moza, not for a developer to take silently).
- **The per-scheme PASSWORD Excel file for the 06B key is an assessor-supplied secret (v1.3, D12):** it is never committed to the repo, never pasted into a doc, chat, screenshot, or log, and the password value is never recorded anywhere. The assessor supplies it at runtime (key-upload step) only.
- **Provider API keys are user-supplied runtime secrets (v1.4, D18):** they are entered in Provider Settings (stored locally in the browser), never committed to the repo, never written into `.env.local` / `.env.example` / any migration / any fixture, never pasted into a doc, chat, screenshot, or log, and never echoed back by the app (not even by Test connection). A provider key in an env file is a defect — the env-file path exists only for the Supabase and Drive keys listed in §3.
- If you find a secret or a personal document committed by mistake, treat it as an incident: revoke/rotate the secret, tell the maintainer the same day, and do not copy the file elsewhere "to check".

## 3. Environment variables

Create `.env.local` in the repo root (git-ignored — verify with `git status` that it never appears). Copy from `.env.example` (committed, placeholders only).

| Variable | Required | Example / placeholder | Where it comes from |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://<project-ref>.supabase.co` | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `eyJhbGciOi…` (anon/public key — safe to expose in the browser) | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server/worker only) | `<service-role-key>` | Same page — **never** prefix with `NEXT_PUBLIC_`, never ship to the browser |
| `SUPABASE_DB_URL` | Worker only | `postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres` | Supabase dashboard → Settings → Database |
| `GOOGLE_DRIVE_API_KEY` | Yes (ingest) | `<google-cloud-api-key>` | §4 — restricted: Drive API only, plus HTTP-referrer/IP restriction |
| `LLM_PROVIDER` | No (runtime config) | `anthropic` / `openai-compatible` / `gemini` / `openrouter` / … | **v1.4 (D18):** provider is runtime config supplied by the user in Provider Settings, not an env secret. An env var here is only a deployment default for staging/prod — never the key, never the only way to set it |
| `LLM_MODEL` | No (runtime config) | `<model-name>` | **v1.4 (D18):** model is runtime config from Provider Settings (the user types it, e.g. a gateway model name); never hard-coded in code or a prompt file. Do not assert a model name here — there is no primary model |
| `LLM_TEMPERATURE` | No | `0` | Grading/gap analysis + jury must be deterministic (temperature 0). The Provider Settings screen has its own Temperature field for the user's default; grading/jury ignore it and use 0 |
| `LLM_PROVIDER_API_KEY` | **No — never in env** | — | **v1.4 (D18): there is no env var for a provider API key.** The key is entered in Provider Settings at runtime (stored locally in the browser), sent per request, never logged, never committed. If you find a provider key in any `.env*` file, treat it as a leaked secret: revoke it and remove it the same day |
| `WORKER_CONCURRENCY` | No | `5` | Parallel Drive downloads per worker (5–10) |
| `WORKER_QUEUE` | No | `pg-boss` | Job queue backend — pg-boss is the v1.1 default (see §7); only change to `bullmq` if a Redis is provisioned on the worker host |
| `MSOFFCRYPTO_PYTHON` | Worker only | `python3` | Python interpreter used to run `msoffcrypto-tool` for encrypted 06B keys (§7). No password is ever set via env vars — the 06B password is supplied at runtime by the assessor, in memory only |
| `JOB_POLL_INTERVAL_MS` | No | `3000` | UI polling for job progress |
| `AK05_DOWNLOAD_EXPIRY_MINUTES` | No | `60` | Expiring AK.05 download links |
| `NEXT_PUBLIC_APP_NAME` | No | `AsesorKompetensi` | Display name |
| `SENTRY_DSN` | No | `<sentry-dsn>` | Optional error tracking (staging/prod) |

**Rotation:** if any key leaks (committed, screenshotted, shared), revoke it at the provider and replace it the same day; do not "wait and see".

## 4. Google Cloud project + Drive API key

The app reads **public ("Anyone with the link")** Drive folders. An API key is sufficient — no OAuth consent screen, no service account — for this use case.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project (e.g. `asesor-kompetensi`).
2. **APIs & Services → Library** → search **Google Drive API** → Enable.
3. **APIs & Services → Credentials → Create Credentials → API key.** Copy it into `GOOGLE_DRIVE_API_KEY`.
4. **Restrict the key** (same screen): *API restrictions* → restrict to **Google Drive API** only. *Application restrictions* → HTTP referrers (production domain) and/or IP addresses (worker egress IP). An unrestricted key is a security incident waiting to happen.
5. **Verify (terminal):**
   ```bash
   curl "https://www.googleapis.com/drive/v3/files?q=%271UrsbAjehLDuK3fHk2HItPgziWN8TOchy%27+in+parents+and+trashed%3Dfalse&key=<GOOGLE_DRIVE_API_KEY>&pageSize=5&fields=files(id%2Cname%2CmimeType)"
   ```
   A `200` with file names = working. A `403` on a file that lists fine = that file is not public (expected behaviour — the ingester marks it `failed`, see QA ING-05). A `403` on everything = the key or the API enablement is wrong.
6. **Quotas to know:** `files.list` 100 units/page (pageSize max 100), download/export 200 units/file, 1,000,000 units/min/project, 400,000,000 units/day (cannot be increased). A 500-file folder costs ~100,500 units — quota is not the bottleneck; timeouts are (hence the worker, §7).
7. **Do not** scrape `drive.google.com` HTML, and do not rely on the Drive `/batch` endpoint (deprecation UNCONFIRMED — design for individual calls + concurrency).

## 5. Supabase project setup + migrations + RLS

### 5.1 Create the project

1. [supabase.com](https://supabase.com) → New project. **Region: Singapore (`ap-southeast-1`)** — closest verified region; whether a Jakarta region exists for hosted projects is **UNCONFIRMED** — check at creation and record the choice in `docs/`.
2. Note the project ref, anon key, service-role key, and DB password into `.env.local` (§3).
3. **Plan:** start on **Free** for local/prototype work. **Before the first live batch, upgrade to Pro ($25/mo)** — Free pauses after 1 week of inactivity and caps storage at 1 GB / DB at 500 MB (the first wall at ~70–125 candidates if originals were stored in Supabase — they are not; originals stay in Drive). Keep the spend cap **on**.

### 5.2 Migrations

Migrations live in `supabase/migrations/` and are the only way schema changes ship — never edit the schema by hand in the dashboard and forget to record it.

```bash
supabase migration new init_schema
# edit supabase/migrations/<timestamp>_init_schema.sql, then:
supabase db push          # local
supabase link --project-ref <project-ref>
supabase db push          # staging/prod (after review)
```

**First migration must include:** `assessors`, `batches`, `assessees`, `documents`, `ingest_jobs`, `jobs`, `dit_analyses`, `written_gradings`, `similarity_reports`, `decisions` (AK.02), `ak05_drafts`, `app_config`, `audit_log`; the `pgvector` extension (`create extension vector;`); and the storage buckets (see §5.3). **v1.1 additions (see doc 04 v1.1):** `prompt_registry` (+ `prompt_versions`), triage/assignment tables, readiness-output columns on DIT analyses, `ak05_report_rows` + accept/return status, and the combined-report artefact. **v1.2 additions (see doc 04 v1.2):** `assessor_signatures` (versioned signature images — owner-only RLS), name-jury verdict + OCR result columns on the identity record, and signature-application audit fields. Seed `app_config` with the canonical keys (see Roadmap Phase 0): `form_mapping.06` (MUK 2023 default), `question_bank.count` = 13, `similarity.flag_thresholds` (**per scope in v1.1 — `similarity.flag_thresholds.dit` and `similarity.flag_thresholds.written`, not one shared value**), `scheme.ak3u.units` (13 units, SKKNI Kepmenaker 38/2019 — from config, never hard-coded in source), `llm.batch_budget_usd` (v1.1 — was missing from the v1.0 seed list). **v1.2 seed keys:** `signature.allowed_types` (PNG, JPG), `signature.max_bytes` (value set at deployment — **UNCONFIRMED**, no fixed number asserted here), `ocr.ktp_confidence_floor` (**UNCONFIRMED** — calibrated in Phase 2), `export.formats` (`ak05: [pdf, docx]`, every other document: `[docx]` — D8 decided, v1.2). **v1.4 seed keys (D17, D18, D19, D21):** `scheme.<id>.manifest` (per-scheme file set, question counts, rules reference, prerequisites, registration requirements — AK3U's values are AK3U's only; no other scheme's values are seeded as defaults), `llm.provider` + `llm.model` (runtime config from Provider Settings — no primary, no hard-coded model), `llm.temperature.grading=0` (deterministic grading/jury), `similarity.thresholds.dit` / `similarity.thresholds.written` (numeric per-scope thresholds — values **UNCONFIRMED**, calibration sets them).

### 5.3 Storage buckets + RLS

| Bucket | Public? | Contents | Access |
|---|---|---|---|
| `id-documents` | **No (private)** | KTP / ijazah scans | Assessor role only, per-batch RLS, signed URLs only, access audit-logged |
| `exports` | **No (private)** | AK.05 PDF/DOCX | Assessor who owns the batch; expiring signed URL (default 1 h) |
| `thumbnails` | **No (private)** | Low-res document thumbnails | Same as `id-documents` |
| `signatures` (v1.2) | **No (private)** | Assessor signature images (PNG/JPG, versioned) | Owner assessor only (RLS: `owner_id = auth.uid()`), plus `lsp_admin`/`auditor` via audit-logged access; signed URLs with short expiry; never served through MCP (doc 07 G13); no public URL exists |

**RLS checklist (test with two users before any real data):** assessor A cannot `SELECT` assessor B's batch rows, documents, analyses, or gradings — via the app *and* via a direct PostgREST call with A's JWT. RLS is the enforcement; the app's batch-scoping is defence in depth, not the control. See QA SEC-01/SEC-02. **v1.2:** the same two-user test covers signatures (A cannot read B's signature image — QA SEC-08).

### 5.4 Auth

Supabase Auth, email + password for assessors in MVP. Confirm the first assessor account from the Supabase dashboard (or `supabase auth` CLI). OTP / magic-link is a P1 item. MFA is required for assessor and admin roles (see doc 14 §5.3); there are no finance roles in this system, and no MFA rule from any other project applies here — the LSP's formal adoption decision is recorded as an open question (doc 14 OQ-A1).

### 5.5 Prompt-registry seeding (v1.1)

The two assessor prompts are seeded as versioned templates, not typed in by hand:

1. The verbatim sources live in the repo at `research/prompts/prompt_wawancara_k3.md` and `research/prompts/prompt_test_tulis.md`. Copy them unchanged into `src/ai/prompts/source/` (read-only reference files).
2. Verify the copies against the recorded hashes (SHA-256, computed 17 Nov 2026):
   - `prompt_wawancara_k3.md` — `65354886971cc660e6e44419fb28e8ab1fc34b90cf5b3bdc02cb6f70c01ebbc3`
   - `prompt_test_tulis.md` — `749304d386d626f52ea804a3dc4590f43d20c8b43ad0b3ec5affe1de8d11b452`
   If a hash does not match, stop — the source file was edited, and the adaptation in doc 15 §4.4 must be re-checked before seeding.
3. The adapted v1 templates (`dit-gap-analysis.v1.ts`, `written-test-grading.v1.ts`) are created from those sources per doc 15 §4.4 (Kompeten Bersyarat removed, bank labelled separately, model answers assessor-only, regulation list replaced by the config table). The adaptation notes are stored with the version in the registry.
4. Seed the `prompt_registry` rows in a migration (`<ts>_seed_prompts.sql`): prompt key, scheme (`ak3u` for v1), version `v1`, source file + hash, active flag. A new prompt version is a new migration + code change — never an edit to a used version.

## 6. LLM provider — BYOK, user-supplied at runtime (v1.4, D18)

There is no primary provider and no provider key in env files. The user brings their own key and configures it in the app (Provider Settings, doc 08 §3.4 v1.4):

1. **Pick a provider:** Anthropic (Claude), OpenAI-compatible, Gemini, OpenRouter / OmniRouter / 9Router, Nvidia NIM, or another provider — whichever the user already has or can use for free. Free tiers are usable; **no provider is claimed to be free** — check the provider's own pricing page before a live batch. Create the key at the provider's dashboard.
2. **Enter it in Provider Settings:** provider + API key (masked) + Base URL (optional gateway) + ANTHROPIC_AUTH_TOKEN (gateway bearer/passthrough, only when calling a gateway) + Model (free text + Suggest…) + Temperature + Max tokens + Thinking budget (0 = off) + Google Drive API key (optional, for public Drive folders — no OAuth). The key is stored locally in the browser, sent per request, never logged, never committed, never echoed back — not even by [Uji Koneksi].
3. **Set a spend cap at the provider** (a few dollars covers a whole batch at the small-model prices the reference apps use — estimate, re-verify on the provider's pricing page; do not budget on intro rates). The model is runtime config, never hard-coded in code or a prompt file; grading/jury calls use temperature 0 (deterministic) regardless of the screen's Temperature setting.
4. **Verify (in the app):** [Uji Koneksi] on the Provider Settings screen (sends a fixed prompt, asserts a Zod-valid structured response — the same check as the repo's smoke script `pnpm llm:smoke`). If it fails, check the key, the base URL/gateway, the model name, and the spend cap — in that order. The failure message never echoes the key.
5. **PDP note (UU 27/2022):** before the first real candidate is sent to any LLM, record the provider's data-retention / training-use terms in `docs/` (UNCONFIRMED in the research — verify in the provider's terms/DPA). The app redacts NIK, full address, phone, email, and KTP images before any LLM call regardless.

## 7. Worker setup (Drive scan / OCR / export)

Long work **never** runs in a serverless function or an Edge Function (150 s wall / 2 s CPU on Free). It runs in a persistent worker.

**Queue decision (v1.1): pg-boss is the default.** Postgres-backed, no extra service to operate — it fits the Supabase-only stack and the $0 prototype, and the job contract (job types, payloads, checkpoints, idempotency keys) is identical either way (doc 06 §8). BullMQ + Redis only if a Redis is already provisioned on the worker host; that is a deployment decision recorded in `WORKER_QUEUE`, not a code fork. The worker claims jobs with pg-boss's own polling (no `SELECT … FOR UPDATE SKIP LOCKED` hand-rolling — pg-boss owns the claim).

**Worker dependencies (v1.1):** in addition to Tesseract (`ind+eng`), the worker image installs **Python 3 + `msoffcrypto-tool`** (decrypts password-protected OOXML — the encrypted 06B key) and uses **`jszip`** (already in §2) to unzip `.pptx` files and parse slide / notes-slide / table XML in `src/services/extract-pptx.ts`. The 06B password is supplied at runtime by the assessor in the UI, passed to the worker job payload in memory only, used once for the `msoffcrypto-tool` call, and never written to the DB, a log, or an `llm_run`. **v1.3 (D12):** two 06B copies exist — the repo's SKEMA blank is OLE-encrypted (decrypt as above), while the AK3U working key is a plain OOXML docx that parses directly with no password prompt. The working key's answers are prose in one table (13 answers) — acceptable points are extracted from the prose — and its 8 embedded images are flagged by extraction, never dropped (QA KEY-01/KEY-02; structure only in `research/06b-key-structure-2026-11-18.md`). Each scheme's 06B ships with a PASSWORD Excel file; the password is assessor-supplied at runtime, never stored, never logged, never recorded. **v1.2 — KTP OCR needs no new dependency:** it runs on the same Tesseract (`ind+eng`) already installed for document OCR; the OCR job handler is `src/jobs/handlers/ocr-ktp.ts` (see doc 15 §5 v1.2). Signature handling needs no new dependency either: upload validation is file-type sniffing + the configured size limit, and the image is stored in the `signatures` bucket (§5.3).

**Local:**
```bash
pnpm worker:dev        # polls the jobs table, processes one job at a time per slot
```
The worker needs `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_DRIVE_API_KEY`, and Tesseract (`ind+eng`) on `PATH` for OCR. **v1.4 (D18):** the worker does **not** take a provider API key from env — it reads the provider key from the user's runtime Provider Settings (per request), like the app. Test it with the fixture folder in QA (`drive-messy/`), not with the live Drive link, the first time.

**Staging / production:** one always-on worker — Railway / Render / Fly.io worker, or the same ~$5/mo VPS that hosts the app. The worker is stateless: any number of replicas can run; jobs are claimed by pg-boss. Deploy the worker from the same repo/commit as the app.

## 8. Local dev workflow

```bash
pnpm dev                 # app — http://localhost:3000
pnpm worker:dev          # worker — separate terminal
pnpm test                # Vitest unit + integration
pnpm test:e2e            # Playwright (needs the app + local Supabase running)
pnpm lint && pnpm typecheck
```

**Branching:** `main` is deployable; feature branches `feat/<short-name>`; PRs need CI green + one review. **Commit rules:** no secrets, no real candidate data, no real names from the live batch in fixtures (synthetic names only).

## 9. Staging / production

| Environment | App | Supabase | Worker | Notes |
|---|---|---|---|---|
| Local | `localhost:3000` | Supabase CLI (Docker) | `pnpm worker:dev` | Mocked Drive/LLM in tests |
| Staging | Vercel preview / Pro | Supabase staging project (Free OK) | Railway/Render worker | Real Drive key on a test folder; real LLM key with spend cap |
| Production | Vercel Pro ($20/seat/mo) **or** VPS ~$5–10/mo | **Supabase Pro $25/mo** | Same VPS or ~$5/mo worker | Vercel Hobby is **non-commercial only** — prototype/demo only, never production. Spend cap on. Backups: daily (Pro, 7-day retention) — verify by restoring to a scratch project before the first live batch. |

**Deploy checklist (production):** env vars set in the provider (not in the repo) → migrations pushed → RLS smoke test with two users → worker healthy (claims a test job) → Drive key restricted → LLM spend cap set → backup restore rehearsed → go/no-go recorded.

## 10. Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| `supabase start` fails | Docker not running → start Docker; or port conflict → `supabase stop` then retry |
| Login works locally, fails on staging | Wrong `NEXT_PUBLIC_SUPABASE_URL` / anon key in the deploy env → compare with dashboard Settings → API |
| Drive scan returns 403 on everything | Drive API not enabled, or key unrestricted-but-wrong-project → §4 steps 2–5; test with the `curl` in §4.5 |
| Drive scan returns 403 on one file | File is not public → expected; marked `failed`, scan continues (QA ING-05) |
| Job stuck in `queued` | Worker not running, or worker can't reach Supabase → check `pnpm worker:dev` logs; check `SUPABASE_SERVICE_ROLE_KEY` |
| Job stuck in `running` after a deploy | Worker was killed mid-job → restart the worker; the job resumes from its checkpoint (or is re-queued after the stale timeout — see Technical Design 06) |
| OCR text is garbage | Phone-photo scan, low DPI, or wrong language data → check Tesseract `ind+eng` installed; file is flagged low-confidence for assessor review; do not silently trust it |
| KTP OCR returns garbage / no name | Same causes as above, or the image is not a KTP at all → the OCR job rejects non-KTP images (QA IDN-14); a low-confidence result returns `needs_human` with no proposed name (QA IDN-09); check `ocr.ktp_confidence_floor` in `app_config` — the floor is a config value, not a code constant |
| Jury payload contains a NIK marker in tests | Redaction failure — stop: the jury prompt builder must receive only the four name strings + OCR confidence (doc 15 §2.6 rule 30); fix `src/ai/redact.ts` and re-run QA IDN-15 / SEC-07 before any further jury run |
| Signature upload rejected | Wrong file type or over the size limit → the UI names the allowed types (PNG, JPG) and the configured limit; limits live in `app_config` (`signature.allowed_types`, `signature.max_bytes`), not in env vars; check the values were seeded (§5.2) |
| Signature preview shows an expired link | Signed URLs for signatures have a short expiry by design → re-open the preview to mint a fresh URL (QA SIG-06); the access is audit-logged |
| PPTX extraction returns no text | Deck uses image-only slides or an old binary `.ppt` (not `.pptx`) → image-only slides go through the OCR path and are flagged low-confidence; `.ppt` (binary) is not supported in v1.1 — mark the file `failed` with reason `unsupported_format` |
| 06B decryption fails with the assessor's password | Wrong password, or the file is not Agile-encrypted OOXML → check `msoffcrypto-tool` is installed in the worker image (`python3 -m msoffcrypto-tool --help`); never log the password; after three failures the grading run locks for `lsp_admin` review (QA GRD-19) |
| Plain 06B working key yields no answers | The working key's answers are prose in a single table — check the extractor reads table cells, not only paragraphs (QA KEY-01); if the file is the encrypted SKEMA blank instead of the working key, use the password flow above (QA GRD-19, KEY-02) |
| Prompt-seed hash mismatch (§5.5) | The verbatim source in `research/prompts/` was edited after seeding → stop, diff the file, and re-check the doc 15 §4.4 adaptation before re-seeding; never "fix" the hash to match |
| LLM returns 12 questions instead of 13 | Model drift → Zod count validation retries once, then `needs_manual_review` (QA GRD-08/GRD-11); check the configured model in Provider Settings — the count comes from the active scheme's manifest, never a hard-coded 13 (v1.4, D17/D21) |
| Provider Test connection fails | Wrong key, wrong base URL/gateway, unknown model, or no spend left → check Provider Settings fields in that order; the failure message never echoes the key. A key found in any `.env*` file is a leaked secret — revoke it and remove it (v1.4, D18) |
| Grading output is non-deterministic / varies run to run | Grading/jury calls must use temperature 0 — check `llm.temperature.grading` in config; the Provider Settings Temperature field is the user's default for other calls, not the grading temperature (v1.4, D18) |
| "Project paused" (Supabase Free) | 1 week inactivity → restore from the Supabase dashboard; upgrade to Pro before a live batch |
| `.env.local` shows in `git status` | It was force-added or `.gitignore` is missing the entry → `git rm --cached .env.local`, verify `.gitignore` contains `.env*.local`, rotate any key that was committed |
