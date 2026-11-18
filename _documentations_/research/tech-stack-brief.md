# Tech-Stack Research Brief — Asesor Kompetensi (LSP / BNSP, OHSE-first, general certification)

- **Date:** 2026-11-17
- **Scope:** research brief only — not the full PRD / SDD. Feeds the system-design doc.
- **Context:** multi-assessor, multi-participant batches; messy public Google Drive folders (hundreds of PDFs / images / DOCX / XLSX); OCR + extraction; LLM gap analysis, 13-question bank (FR.IA.04B), written-test grading vs master key (FR.IA.06B vs FR.IA.06C), cross-participant similarity/plagiarism; PDF/DOCX export of BNSP forms (incl. FR.AK.05); Bahasa Indonesia; solo/small team; free-tier-first budget.
- **Inputs checked:** the two attached prompts (`prompt_wawancara_k3.md`, 6.3 KB RCTFA prompt — gap analysis + 13 questions + readiness verdict; `prompt_test_tulis.md`, 1.3 KB — FR.IA.06B vs 06C grading + plagiarism scan, report in Bahasa Indonesia) and `https://github.com/danste-kun/asesorkompetensi` — **the repo is EMPTY as of 2026-11-17** (GitHub page: "This repository is empty"). No existing code to reuse; greenfield.
- **Method:** web search + direct fetch of official pricing/limits pages on 2026-11-17. Prices/limits change fast — re-verify on the vendor page before signing or budgeting.

---

## 0. Recommendation (TL;DR)

| Decision | Recommendation |
|---|---|
| **Framework** | **Next.js (App Router) + TypeScript** — safest default for a solo/small team in 2026 |
| **Backend / DB / Auth / Storage** | **Supabase** (Postgres + Auth + Storage + pgvector + Edge Functions as orchestrator only) |
| **AI layer** | **Vercel AI SDK** (`generateObject` + Zod) with **GPT-4o-mini as primary model**, Gemini as fallback — provider-swappable, never hardcode one model |
| **Heavy work (Drive scan, OCR, PDF/DOCX export)** | **Async job queue, never a single HTTP request.** Chunked jobs with per-file status + resume. Do not run this in Vercel serverless or Supabase Edge Functions alone |
| **Hosting (prototype)** | Vercel Hobby + Supabase Free — **demo/dev only** |
| **Hosting (first live batch)** | **Supabase Pro ($25/mo) + Vercel Pro ($20/seat/mo) OR Cloudflare Workers Paid ($5/mo) via OpenNext, OR a ~$5/mo VPS** running Next.js standalone + a worker. Budget ≈ **$30–50 per batch-month** (see §6) |
| **What would change this** | §1.6 |

Why this shape: the hard problems in this app are **not** the UI — they are long-running Drive ingestion, OCR quality on scans, deterministic grading, and auditability of LLM verdicts. The stack must therefore optimise for (a) the largest ecosystem for Supabase + LLM + PDF/DOCX in one language, (b) a real background-job story, and (c) cheap exit from the free tier. Next.js + Supabase wins on all three; SvelteKit wins on bundle size only; Laravel wins on queues/PDF in PHP but pays an AI-integration tax.

---

## 1. SvelteKit vs Next.js (App Router) vs Laravel

### 1.1 Comparison

| Dimension | Next.js (App Router) | SvelteKit | Laravel (12, PHP 8.2/8.3) |
|---|---|---|---|
| **Learning curve (solo dev)** | Medium. React + RSC / Server Actions / caching pitfalls are real, but tutorials are everywhere. | Low–medium. Less boilerplate, simpler mental model, no virtual DOM. Fastest to write simple CRUD. | Low if you know PHP; high if you don't. Blade/Livewire/Inertia each add a second mental model. |
| **Adoption / hiring (2026)** | Largest. Stack Overflow Survey 2025: React 44.7%, Next.js 20.8% of respondents. Biggest tutorial/template pool. | Small. Svelte 7.8% in the same survey — but highest "admired" score (59.4% in the 2026 survey roundup). Hardest to hire/replace in Indonesia. | Large in Indonesia specifically. Laravel 7.6% globally; PHP-heavy LSP/BNSP ecosystem (the kabarwarga reference app is Laravel 13). Easiest local hiring. |
| **Ecosystem: PDF / DOCX / XLSX** | Excellent, pure JS: `docx` (de-facto standard, 2M+ downloads/mo, works Node + browser, zero runtime deps), `pdfkit` / `pdf-lib`, `exceljs`, `xlsx`. Puppeteer for HTML→PDF only where a server allows Chrome. | Same JS ecosystem as Next.js — libraries are framework-agnostic. No disadvantage here. | Excellent, mature: Dompdf / TCPDF, PhpSpreadsheet, Laravel Excel 3.1 (chunked queued import/export, `WithChunkReading`/`WithBatchInserts`). Best story for **pixel-faithful official forms** built as Blade templates. |
| **Background jobs / long Drive scans** | Weak out of the box on serverless. Needs an external queue/worker (e.g. Supabase Edge Function as dispatcher + a persistent worker on Railway/Fly/VPS, or a queue service). No built-in Horizon equivalent. | Same as Next.js — framework gives you nothing here; same external worker needed. Adapter-flexible (Node/Vercel/Cloudflare). | **Strongest.** Queues + Horizon (Redis) are first-party: supervisors with per-queue timeouts (e.g. 120–600 s), retries, dashboard, `queue:work --timeout=300`. Chunked Excel jobs are a solved pattern. Needs an always-on worker (Redis + supervisor), i.e. a VPS, not free serverless. |
| **AI SDK support** | **Best.** Vercel AI SDK is React/Next-first: `generateText / streamText / generateObject / streamObject`, `useChat` / `useObject` hooks, Zod structured output, provider packages for OpenAI/Anthropic/Gemini. AI SDK v7 (June 2026) is the current major line. | Good, not first-class. AI SDK Core is framework-agnostic and works in SvelteKit; UI hooks exist for Svelte, but examples, templates and new features land React-first. | Weakest. No first-party JS AI SDK. Call LLM REST APIs via HTTP client, or a PHP package (e.g. Prism — maturity **UNCONFIRMED**, not verified for this brief). Structured-output / streaming ergonomics are DIY. A common workaround is a small Node/Python sidecar just for AI — i.e. two stacks to maintain. |
| **Supabase integration** | Best. Supabase's own docs/examples are JS/Next-first (SSR auth helpers, RLS patterns). | Good — same JS client, SSR adapter exists. Fewer copy-paste examples. | Works via REST/PostgREST or direct Postgres, but Auth (GoTrue JWT) + RLS + Realtime integration is DIY compared with the JS client. |
| **Bundle / runtime perf** | Heaviest. React runtime + RSC payload; fine for an admin tool, not the differentiator here. | Lightest. Compiler-first, no virtual DOM, smallest JS shipped — best on low-end phones / slow connections (assessors in the field). | Server-rendered Blade/Livewire is light on JS; Inertia adds a Vue/React SPA. Fine. |
| **Hosting cost (free-first)** | Vercel Hobby $0 but **non-commercial only** (see §1.4) — this LSP tool is professional/commercial use, so Hobby is not a legal long-term home. Pro $20/seat/mo. | Same hosts as Next.js (Vercel/Cloudflare/Node adapter). Cloudflare Pages free tier allows commercial use and has no static-bandwidth cap — attractive for SvelteKit. | No free serverless home. Needs VPS (~$5–10/mo) + Redis. Cheapest honest production cost, but you pay in ops time. |
| **Team-size fit** | Best for 1–3 devs who may grow / hand over: most replaceable skill set. | Best for 1 dev who values speed and small bundles and will stay solo. | Best for 1–3 devs who already know PHP/Laravel and want queues + forms without learning React. |

Sources: framework adoption — Stack Overflow Developer Survey 2025 via GuideFlow roundups, Nov 2026 (React 44.7%, Next.js 20.8%, Svelte 7.8%) [guideflow.com/blog/web-frameworks; guideflow.com/blog/web-development-frameworks]; Laravel queues/Horizon + Laravel Excel chunking [docs.commstate.app/api/pdf/deployment/queues; dev.to/faizan050/export-large-data-with-chunk-in-laravel-excel-fix-4pka; copyprogramming.com — Laravel Excel 3.1.67, Aug 2025]; AI SDK v7 + Svelte support [fp8.co/articles/vercel-ai-sdk-vs-langchain-js; guvi.in/blog/vercel-ai-sdk]; `docx` library [socket.dev/npm/package/docx; npm-compare.com].

### 1.2 Recommendation: Next.js (App Router) + TypeScript

1. **One language for everything that matters:** UI + API routes + AI calls + DOCX/PDF generation all in TypeScript. The LLM, similarity and export code is the product — keeping it in the best-supported AI ecosystem matters more than bundle size for an assessor back-office tool.
2. **Vercel AI SDK + Supabase are both Next-first.** Every pattern this app needs (SSR auth with RLS, `generateObject` with Zod for the FR.IA.04A matrix / 13-question bank / grading verdicts, streaming progress for long jobs) has a documented Next.js example.
3. **Largest escape hatch:** if the solo dev leaves, a Next.js + Supabase codebase is the easiest to hand to another Indonesian dev or agency.
4. **PDF/DOCX is a tie** between Next.js and Laravel in library quality — so it does not outweigh the AI gap.

### 1.3 Where SvelteKit would be the better pick

If the priority were a public-facing, mobile-heavy, low-bandwidth experience (e.g. candidates themselves using cheap Android phones) and the team will stay solo, SvelteKit's smaller bundles and simpler code would win — and its Supabase + AI SDK Core support is genuinely good enough. It loses here mainly on ecosystem depth for AI/admin templates and on hiring.

### 1.4 Where Laravel would be the better pick

If the builder is already fluent in PHP/Laravel and not in React, **pick Laravel** — the queue/Horizon story is the best fit for the Drive-scan workload, Blade + Dompdf is the most proven path to exact BNSP form layouts, and local hiring is easiest. Accept the cost: AI calls become hand-rolled HTTP + JSON-schema validation, and Supabase Auth/RLS integration is DIY (or skip Supabase Auth and use Laravel + Postgres directly — but then the "free Supabase" premise changes).

### 1.5 Hosting warning that affects the framework choice

- **Vercel Hobby is non-commercial only.** Multiple 2026 sources agree Vercel's fair-use terms restrict Hobby to non-commercial personal use (ads, payments, pitching services to clients all count as commercial); Pro is $20/user/mo. An LSP assessor tool used for paid certification work is commercial use — **do not plan production on Hobby**. Use Hobby for prototype/demo only.
- **Cloudflare Pages/Workers free tier** allows commercial use, unlimited static bandwidth, 500 builds/mo, but Workers Free is 100,000 req/day with **10 ms CPU per invocation** and 128 MB — enough for an API that mostly waits on the LLM/DB, not for OCR or PDF rendering. Workers Paid ($5/mo) raises CPU to 30 s default. Next.js on Cloudflare via OpenNext carries a 3 MiB (free) / 10 MiB (paid) compressed bundle limit — **UNCONFIRMED** as a blocker for this app; verify before choosing Cloudflare for Next.js.
- **Timeouts are the real constraint, not the framework:** see §3.3.

### 1.6 What would change the recommendation

- Builder already ships in Laravel/PHP and has no React time → Laravel.
- Requirement becomes "must run entirely on Cloudflare free tier" → SvelteKit (smaller adapter output, better Workers fit).
- A Python-heavy OCR/embedding requirement dominates (e.g. PaddleOCR + IndoBERT local models) → keep Next.js for the app but add a small Python (FastAPI) worker service; do not switch the whole app to Python.
- LSP mandates on-premise / single-server deployment with no US cloud → Laravel on a VPS, or self-hosted Supabase (Docker) + Next.js standalone.

---

## 2. Supabase free tier (2026) — limits, what breaks first, when to pay

Verified against the official pricing page, fetched 2026-11-17 (`supabase.com/pricing`), cross-checked with Supabase docs on Edge Function limits (updated 2026-10-29).

### 2.1 Free tier (official, 2026-11-17)

| Resource | Free | Pro ($25/mo per org) |
|---|---|---|
| Database size | **500 MB** per project (read-only above this) | 8 GB incl., then $0.125/GB |
| File storage | **1 GB** | 100 GB incl., then $0.0213/GB |
| Egress | 5 GB + 5 GB cached egress | 250 GB + 250 GB cached, then $0.09/GB (uncached) |
| Auth MAU | 50,000 | 100,000, then $0.00325/MAU |
| Total users | Unlimited (MAU is the meter) | Unlimited |
| Edge Function invocations | 500,000/mo | 2,000,000/mo, then $2 per 1M |
| Realtime | 200 concurrent connections; 2M msgs/mo; 256 KB max msg | Higher (verify on pricing page) |
| Max file upload | 50 MB | 500 GB (per pricing-page table; verify) |
| Projects | 2 active | First project incl.; additional from $10/mo |
| Backups / PITR | None automatic; no PITR | Daily backups, 7-day retention; PITR is a paid add-on (from $100/mo per pricing page — **UNCONFIRMED** for this project's needs, verify) |
| Log retention | 1 day | 7 days |
| Compute | Shared CPU, 500 MB RAM | $10/mo compute credit incl. (covers one Micro instance) |
| **Inactivity** | **Project pauses after 1 week of inactivity — must be manually restored** | No pausing |

Edge Functions limits (Supabase docs, 2026-10-29): **Free: 150 s max wall-clock duration; Paid: 400 s. Max CPU time: 2 s per request** (actual CPU, not I/O wait). Request idle timeout 150 s. Deno runtime; libraries needing multithreading (e.g. `sharp`/`libvips`) are not supported. pgvector ships pre-installed (HNSW/IVFFlat) — useful for §4.

### 2.2 What breaks first at ~100–500 participants

Assumptions (state them in the design doc; they are estimates, not measurements): ~10 files per candidate (APL.01, APL.02, CV, ijazah, KTP, assignment letter, DIT FR.IA.04A/09, presentation/transcript, FR.IA.06C, misc), average scanned PDF **0.8–1.5 MB**. Extracted text ~20–40 KB/candidate; embeddings ~20 chunks × ~6 KB (1536-dim float32) ≈ 120 KB/candidate; LLM outputs + audit rows small.

| Order | Resource | Math | Breaks at |
|---|---|---|---|
| **1st — Storage (1 GB)** | 10 files × 1 MB = ~10 MB/candidate | 100 candidates ≈ 0.8–1.5 GB | **~70–125 candidates.** This is the first hard wall. Mitigation: store originals in Drive (don't re-upload to Supabase at all) and keep only extracted text + thumbnails in Supabase; or store originals in a cheaper object store; or go Pro (100 GB) immediately. |
| **2nd — Egress (5 GB/mo)** | Assessors viewing/downloading PDFs from Supabase Storage | 500 candidates × 10 MB viewed once ≈ 5 GB | **~300–500 candidates if originals live in Supabase and are viewed once each.** Not an issue if originals stay in Drive and Supabase serves only text/JSON. |
| **3rd — Database (500 MB)** | Text + embeddings + LLM outputs + audit log | 500 candidates ≈ 50–150 MB (text + embeddings) + form/audit rows | Fits 500 candidates **if** originals and large blobs are not in Postgres. Breaks sooner if full OCR text of every page + per-question LLM traces are all stored without pruning, or if many batches accumulate. |
| Never (at this scale) | Auth MAU (50k), Edge invocations (500k), Realtime (200 conn.) | Assessors number in the tens; jobs in the thousands | Not a constraint. Do not design around these. |
| **Operational, not quota — Pausing** | 1 week of inactivity → paused project | LSP batches are sporadic (a batch, then weeks idle) | **This is the most likely production incident on Free.** A paused project needs manual restore from the dashboard before an assessment session. Mitigation: a keep-alive ping (cheap, but fragile and arguably against the spirit of the limit — treat as dev-only), or Pro. |

### 2.3 When to pay, and what

- **Prototype / first pilot (≤ ~50 candidates, originals stay in Drive):** Free is fine.
- **First real batch (≥ ~100 candidates, or any batch where a paused project would disrupt a live assessment):** **Supabase Pro, $25/mo per org** (includes $10 compute credit). That buys 8 GB DB + 100 GB storage + no pausing + daily backups — i.e. removes the first three walls at once. This is the single most important paid decision in the project.
- **Do not buy Team ($599/mo) or PITR** at this scale. Revisit only if the LSP requires SOC 2 / SSO / point-in-time recovery for certificate records.
- **Spend-cap note:** Pro has a spend cap on by default; overage billing (storage $0.0213/GB, egress $0.09/GB) only applies if the cap is switched off. Keep the cap on and treat hitting it as a signal to review, not as an automatic bill.

---

## 3. Google Drive public-folder ingestion

Verified against the official Drive API limits page, fetched 2026-11-17 (`developers.google.com/drive/api/guides/limits`).

### 3.1 API v3 — the only supported path

| Method | Quota cost (official) | Notes |
|---|---|---|
| `files.get` (metadata, no `alt=media`) | 5 units | |
| `files.list` | 100 units per page | `pageSize` max **100**; follow `nextPageToken` until absent |
| `files.get ?alt=media` / `files.download` / `files.export` | 200 units | Download/export of one file |
| Edit methods | 50 units | Not needed for ingestion (read-only) |
| **Per-minute per project** | **1,000,000 units** | |
| **Per-minute per user per project** | **325,000 units** | Service-account calls count as one "user" — see §3.2 |
| **Per-day per project (billing threshold)** | **400,000,000 units — cannot be increased** | Under this threshold no charge; Google says charges for exceeding it are planned "later in 2026" with ≥90 days' notice — **timing/price UNCONFIRMED** |
| Per-day egress | 1 TB | |

Worked example: a folder with 500 files needs ~5 `files.list` pages (500 units) + 500 downloads (100,000 units) ≈ **100,500 units — 0.03% of the daily threshold, ~31% of one minute's per-user budget if done in a single minute**. Quota is not the bottleneck at this scale; **timeouts and download bandwidth are**. (Quota model changed 2026-05-01 for Cloud projects created after that date; projects active Nov 2025–Apr 2026 keep old quotas — secondary source, verify in Cloud Console for the actual project.)

### 3.2 Auth: API key vs service account vs OAuth

| Method | Works for "Anyone with the link" public folders? | Notes |
|---|---|---|
| **API key** | **Yes — recommended for this use case.** | Read-only, public files only; 403 on anything not public. No OAuth consent screen, no token refresh, no user account. Create a Google Cloud project, enable Drive API, restrict the key (HTTP referrer / IP + API restriction). This is the simplest correct choice for LSP/TUK public links. |
| **Service account** | Yes for public files, but it is a separate identity — for any file that is *not* public it must be explicitly shared with the service-account email. | Needed only if you later need to write back to Drive or read non-public folders. All service-account calls count as a single "user" for the 325k/min/user quota. Keep the key in a secret manager, never in the repo. |
| **OAuth (user token)** | Yes, but unnecessary complexity here. | Only if an assessor must ingest *their own* private Drive. Adds consent screen, refresh tokens, per-user quota. Defer. |
| **Scraping `drive.google.com` HTML** | **Do not do this.** | The folder UI is JS-rendered, paginated lazily, behind anti-bot/CAPTCHA defences, with no stable DOM contract. It breaks silently, cannot reliably enumerate hundreds of files, and cannot export Google Docs/Sheets. There is no supported HTML contract to scrape. Use the API. |

### 3.3 How to avoid timeouts — the ingestion design

This is the highest-risk engineering area. A single "scan this Drive folder" request **will** time out on every free host:

- **Vercel serverless:** secondary sources disagree on the Hobby limit (10 s vs 15 s vs 60 s vs 300 s reported in different 2026 roundups) — **exact Hobby/Pro max duration UNCONFIRMED from official docs in this brief; verify on `vercel.com/docs` before committing.** Even the most generous figure is far below a 500-file scan + OCR.
- **Supabase Edge Functions:** 150 s wall / **2 s CPU** (Free) — an OCR/embedding step will blow the CPU budget even if the wall clock fits. Use Edge Functions only as a dispatcher/trigger, not as the worker.
- **Cloudflare Workers Free:** 10 ms CPU/invocation — unsuitable as the worker.

**Required pattern (put this in the SDD):**

1. **Enqueue, don't execute:** `POST /ingest` validates the Drive URL, extracts the folder ID, creates an `ingest_jobs` row (`status=queued`), returns immediately. UI polls/subscribes to job status.
2. **Crawl in pages:** recursive `files.list` with `q='<folderId>' in parents and trashed=false`, `pageSize=100`, `fields=files(id,name,mimeType,size,modifiedTime,parents),nextPageToken`, `supportsAllDrives=true`, `includeItemsFromAllDrives=true`. Persist the raw tree (folder path, file ID, MIME, size) before downloading anything — so a failed run resumes from the tree, not from zero.
3. **Download + process in small chunks:** one queue job per file (or per batch of 10–20 small files). Each job: download (streaming, not buffered whole-file in memory where possible) → detect type → extract text (§4) → store text + metadata → mark `file_status=done/failed` with error + retry count. Concurrency 5–10 parallel downloads; exponential backoff (1 s, 2 s, 4 s … max 64 s, with jitter) on 403 `userRateLimitExceeded` / 429, per Google's own guidance.
4. **Google Workspace files need `files.export`, not `alt=media`:** Docs/Sheets/Slides return `403 fileNotDownloadable` on `alt=media`. Export to `application/pdf` or `text/plain` / `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` as appropriate. Binary files (PDF, JPG, DOCX, XLSX) use `alt=media`.
5. **Idempotency + resume:** key every file row by Drive `fileId` + `modifiedTime`; re-running a job skips `done` files. Store `nextPageToken` checkpoints so a crashed crawl resumes mid-folder.
6. **Where the worker runs:** a persistent process — Railway/Render/Fly.io worker, a cheap VPS, or Laravel Horizon if Laravel is chosen. Not Vercel serverless, not an Edge Function. Budget one always-on worker (~$5/mo) in the production cost model.
7. **Messy-folder handling (the real product requirement):** never assume a fixed layout. Classify by (MIME type + filename heuristics + parent-folder name + content sniffing), keep an `unmatched/` review queue for the assessor to map manually, and fuzzy-match candidate names (normalise case/spacing, handle titles/clan names — see name-matching note in §5.3). Log every mapping decision for audit.

---

## 4. Document extraction + similarity / plagiarism

### 4.1 Extraction pipeline (recommended order)

| Step | Tool | Notes |
|---|---|---|
| PDF with text layer | `pdfjs-dist` / `pdf-parse` (Node) or PyMuPDF (Python worker) | Try first — free, fast, exact. Most APL/DIT forms exported from Word/Google Docs have a text layer. |
| Scanned PDF / image (JPG/PNG) | **Tesseract 5** (`ind+eng`), free, Apache 2.0, offline | Needs preprocessing (deskew, 300 DPI, thresholding). Weak on handwriting and noisy phone photos. One 2026 Indonesian study (61 statutory PDFs) measured Tesseract at **78% text accuracy** vs PyMuPDF 90% vs Gemini API **97%** (3% WER) — `ejournal.pnc.ac.id` (Infotekmesin, July 2026). Treat those numbers as indicative for clean print, not a guarantee for phone scans. |
| DOCX | `mammoth` (text) / `docx` parsing | Free. Tables in FR forms need cell-level extraction — test against real FR.IA.04A/06 files early. |
| XLSX (Kelompok Asesi sheet, etc.) | `exceljs` / `SheetJS` | The provided Kelompok Asesi link is a Google Sheet — use `files.export` to XLSX, then parse. |
| Fallback for bad scans / handwriting | Multimodal LLM (GPT-4o-mini or Gemini with image/PDF input) on **flagged pages only** | Most accurate, but $ and sends images to the provider (privacy, §5.3). Use as exception path, with assessor review — never as the silent default. |
| Cloud OCR (Google Document AI / Vision, Azure AI Document Intelligence) | Higher accuracy + layout/table extraction | **Pricing not verified for this brief — UNCONFIRMED.** Evaluate only if Tesseract quality on real TUK scans is unacceptable; get a priced quote for ~500 candidates before committing. |

**Design rule:** store the extracted text + per-page confidence + extraction method per file. The assessor must be able to see "this DIT was OCR'd at low confidence — verify" rather than silently trusting it.

### 4.2 Similarity / plagiarism (cross-participant)

Use **layered, deterministic methods first; LLM last.** Similarity is a flag for the assessor, never an automated plagiarism verdict.

| Method | Cost | What it catches | Limits |
|---|---|---|---|
| **Normalised exact / near-exact match** (lowercase, strip whitespace/punctuation, shingle n-grams, Jaccard) | $0 | Verbatim copy-paste of DIT / test answers | Misses paraphrase |
| **TF-IDF + cosine similarity** (per-question and per-document, pairwise within a batch) | $0, runs in Postgres/Node/Python | Shared phrasing, identical errors, template reuse; well-studied for Indonesian text (e.g. IOP 2019 thesis-plagiarism study using VSM + cosine on Indonesian theses; 20% similarity threshold used in one Indonesian journal-article study — thresholds are conventions, not law) | Lexical only — misses paraphrase / translation; needs Indonesian stopword list + stemming (Sastrawi for Indonesian — verify library maintenance) |
| **Winnowing / fingerprinting** | $0 | Near-duplicates with small edits | Same limits as above |
| **Embeddings + cosine** (multilingual sentence embeddings, e.g. SBERT paraphrase-multilingual; or OpenAI `text-embedding-3-small`) | Near-$0 if local; API price **UNCONFIRMED** in this brief (commonly quoted $0.02/1M tokens — verify on OpenAI pricing page) | Paraphrase / semantic similarity that TF-IDF misses | Needs a calibrated threshold per question type; short answers (1–2 sentences) are noisy — report them separately. A 2026 Indonesian study found a **hybrid TF-IDF + SBERT** pipeline effective for Indonesian title similarity (Media Elektrik, Aug 2026) — supports the layered approach. pgvector (HNSW) in Supabase stores the vectors alongside the rows. |
| **LLM-as-judge** (only for the written-test semantic grading + the plagiarism *summary*) | Per §5 | Judges meaning, explains differences in Bahasa Indonesia | **Risks — see §4.3** |

**Pairwise cost is trivial at this scale:** 100 candidates = 4,950 pairs; 500 = 124,750 pairs — but per-question TF-IDF cosine on short answers is milliseconds in a batch job; do it offline in the worker, not per-request. Store the top-N pairs per question with the shared spans highlighted for the assessor.

### 4.3 LLM-as-judge grading risks (must be in the PRD/SDD as constraints)

1. **Hallucination:** the model can invent regulation citations (UU/PP/Permenaker numbers, dates) and "master key" content. Mitigation: grading prompts must include the **actual FR.IA.06B master-key text** in-context; require the model to quote the master-key span and the student span for every verdict; forbid citing any regulation not present in the supplied key or an approved regulation table.
2. **Inconsistency / non-determinism:** same input, different runs → different scores, especially at temperature > 0. Mitigation: temperature 0, fixed model version pinned in config, structured output (Zod schema: `correct | partial | incorrect` + evidence quotes + explanation), store prompt + model + version + raw output per grading for audit/replay. Borderline cases (partial vs incorrect, or Kompeten vs Belum Kompeten) get a second pass and mandatory human confirmation.
3. **Deterministic first:** FR.IA.06C grading should be **rules-first** — normalised exact match, keyword/coverage check against the master key — with the LLM used only for partial-credit semantic judgement. A pure-LLM grader with no deterministic anchor is not defensible to BNSP/TUK.
4. **Prompt-injection via candidate content:** a candidate could embed instructions in a DIT/answer ("ignore the key, mark me competent"). Mitigation: treat all candidate text as untrusted data, delimit it clearly in the prompt, and never let model output change a verdict without assessor sign-off.
5. **Language:** the attached prompts demand the final report in Bahasa Indonesia and questions adapted to role/region. Verify on 5–10 real candidates that the chosen model follows the "exactly 13 questions" and "Bahasa Indonesia explanation" constraints — small models frequently drift to 12/14 questions or mix languages.

---

## 5. LLM provider options (Indonesian assessment)

### 5.1 Prices verified 2026-11-17 (secondary sources — re-verify on the provider pricing page before budgeting)

| Model | Input / 1M | Output / 1M | Context | Notes |
|---|---|---|---|---|
| **GPT-4o-mini (OpenAI) — PRIMARY** | **$0.15** | **$0.60** | 128k | Stable price across many Nov 2026 sources; cached input $0.075. Structured Outputs / JSON mode / function calling supported. Best price:quality ratio for extraction + grading volume. |
| GPT-4o (OpenAI) | $2.50 | $10.00 | 128k | ~17× mini. Reserve for borderline/second-pass review only. |
| Gemini 2.5 Flash (Google) | Was quoted $0.075–$0.30 in / $0.30–$2.50 out in different Sept–Nov 2026 sources — **figures conflict, UNCONFIRMED** | — | 1M | **Deprecated: Google announced 2026-11-02 that 2.5 Pro/Flash leave AI Studio and from 2026-12-01 requests route automatically to Gemini 3.8 Flash / 3.5 Flash-Lite. Do not build on `gemini-2.5-flash` strings.** |
| Gemini 3.5 Flash-Lite (Google) | $0.30 | $2.50 | 1M | Routing target for 2.5 Flash. Per KissAPI, 2026-11-09, from Google's pricing page. |
| Gemini 3.8 Flash (Google) | $0.75 thru 2026-12-31 → **$1.50 from 2027-01-01** | $3.75 → **$7.50 from 2027-01-01** | 1M | Intro pricing doubles on 2027-01-01 — **do not anchor a 2027 budget on the intro rate.** Supports structured output, PDF input. |
| Claude Haiku (Anthropic) | ~$0.80 (secondary source) | — | — | **UNCONFIRMED** — not verified against Anthropic's pricing page for this brief. Capable for structured extraction; ~5× GPT-4o-mini input price. |

No verified benchmark exists for **Indonesian OHSE competency assessment** quality across these models — **UNCONFIRMED which model is "best" for this task.** Run a blind comparison on 5–10 real candidates (same DIT + transcript, score against a human assessor's verdict) before locking the default model. Keep the model ID in config, not in code.

### 5.2 Cost per candidate (estimate — label as estimate in the design doc)

Per candidate, using GPT-4o-mini and the attached prompts:

| Call | Rough tokens (est.) | Cost (est.) |
|---|---|---|
| Gap analysis (RCTFA prompt ~1,600 tokens + DIT ~3–8k + transcript/profile ~5–15k in; matrix + questions + verdict ~2–4k out) | ~15k in / ~3k out | ~$0.004 |
| Written-test grading (master key + student answers ~5k in; per-question verdicts ~2k out) | ~5k in / ~2k out | ~$0.002 |
| Similarity summary / second pass (optional, borderline only) | ~5k in / ~1k out | ~$0.001 |
| Embeddings (TF-IDF is free; API embeddings if used, ~10k tokens/candidate) | — | ~$0.0002 (at $0.02/1M — **UNCONFIRMED** price) |
| **Total per candidate** | | **≈ $0.01–0.03 incl. retries** |
| **100 candidates** | | **≈ $1–3 LLM** |
| **500 candidates** | | **≈ $5–15 LLM** |

LLM cost is **negligible** next to hosting ($25–45/mo). The budget risk is not tokens — it is (a) re-running whole batches because a prompt changed, and (b) Gemini/OpenAI intro-price rises. Mitigate with prompt versioning + caching of extracted text (never re-send a DIT you already extracted).

### 5.3 Structured output, Indonesian, and privacy

- **Structured output:** OpenAI Structured Outputs (strict JSON schema), Gemini `responseSchema`, and the Vercel AI SDK `generateObject({ schema: z.object(...) })` all work — use the SDK so the provider can be swapped without rewriting prompts. Validate every LLM response against the Zod schema server-side; on failure, retry once, then mark the candidate `needs_manual_review` — never store malformed output as a verdict.
- **Indonesian:** all frontier models handle Bahasa Indonesia fluently for this task; the risk is not fluency but **constraint-following** (exactly 13 questions, Bahasa Indonesia only, quote-evidence discipline). Test this explicitly.
- **Privacy — UU PDP (UU No. 27/2022), fully in force since 2024-10-17.** Key points for the design doc (engineering summary, **not legal advice**):
  - NIK/KTP number, address, phone, photos are personal data; NIK is in the "specific" category. Cross-border transfer (Art. 56) needs adequacy, appropriate safeguards (e.g. a DPA with the provider), or explicit consent; breach notification is 3×24 hours (Art. 46). Sources: Anoman/AxonFlow UU PDP guidance, Nov 2026.
  - **Design rule:** strip/redact NIK, full address, phone, email, KTP photos and signatures **before** any text or image reaches an LLM. Send only a pseudonymous candidate ID + the DIT/transcript/answers the assessment actually needs. The name-matching step (assignment letter vs KTP) is a **human-confirmed** step — OCR/LLM may *suggest* a match, but the assessor confirms the certificate name; the KTP image itself never goes to the LLM.
  - Store KTP/ID originals only in a private Supabase Storage bucket with RLS (assessor role only, audit-logged access), with a retention + deletion policy agreed with the LSP. Never put LLM API keys or provider logs in the same bucket. Check the chosen LLM provider's data-retention / training-use terms (whether API data is used for training, and zero-retention options) — **UNCONFIRMED for the providers above in this brief; verify in each provider's terms/DPA before sending candidate data.**
  - Supabase region: pick the closest region (Singapore, `ap-southeast-1`) — **UNCONFIRMED** whether a Jakarta region is available for Supabase hosted projects; verify at project creation. This does not by itself satisfy UU PDP cross-border rules for the LLM leg.

---

## 6. Indicative monthly cost (first live batch)

| Item | Prototype | First live batch |
|---|---|---|
| Supabase | Free ($0) | **Pro $25/mo** |
| Hosting (app) | Vercel Hobby $0 (demo only) | Vercel Pro $20/seat **or** Cloudflare Workers Paid $5/mo **or** VPS ~$5–10/mo |
| Worker (Drive scan / OCR / export) | — (run locally) | ~$5/mo (Railway/Render/Fly worker or same VPS) — may be $0 if it shares the VPS |
| Google Drive API | $0 (under quota threshold) | $0 |
| LLM (GPT-4o-mini) | ~$0 | ~$1–15 per 100–500 candidates |
| **Total** | **$0** | **≈ $30–50/mo during an active batch; $25/mo idle (Supabase Pro only)** |

Cheapest honest production floor is ~$25/mo (Supabase Pro alone, app + worker on a $5 VPS, LLM pay-as-you-go). There is no $0 production configuration that is also reliable (pausing), commercial-use-compliant (Vercel Hobby), and backed up.

---

## 7. Risks / open questions for the design doc

1. **Vercel function timeout (official figure) — UNCONFIRMED.** Secondary sources conflict (10 s / 15 s / 60 s / 300 s). Verify on `vercel.com/docs` before writing the SDD's hosting section. Does not change the async-job conclusion.
2. **Gemini pricing — volatile.** 2.5 Flash deprecation (2026-12-01) and 3.8 Flash price doubling (2027-01-01) are both dated events in the sources above. Re-check `ai.google.dev/pricing` at build time; prefer GPT-4o-mini as the budgeted default.
3. **OpenAI embedding price ($0.02/1M) and Claude Haiku price — UNCONFIRMED** in this brief. Verify on the provider pages if the design uses them.
4. **Cloud OCR pricing (Document AI / Vision / Azure) — UNCONFIRMED.** Only evaluate after measuring Tesseract on real TUK scans.
5. **Drive API `/batch` endpoint** — one secondary source claims it halves calls; Google has been deprecating the JSON-RPC batch endpoint — **do not rely on it; UNCONFIRMED.** Design for individual calls + concurrency instead.
6. **Supabase Jakarta region availability — UNCONFIRMED.** Verify at project creation.
7. **LLM data-retention / training-use terms per provider — UNCONFIRMED.** Verify + record the DPA position before first candidate data is sent.
8. **FR form fidelity:** no sample FR.IA.04A/04B/06B/06C/09/AK.05 files were available in this research — export layout (exact BNSP form reproduction) must be validated against real forms in the design phase, and may push the PDF choice toward HTML→PDF (Puppeteer/WeasyPrint-style) rather than `pdfkit` drawing commands.
9. **Name matching (assignment letter vs KTP):** OCR + fuzzy match can suggest, but certificate-name correctness is a human sign-off — build it as a review screen, not an auto-fill.

---

## Sources (accessed 2026-11-17 unless noted)

- Supabase pricing (official) — `https://supabase.com/pricing` — fetched 2026-11-17: Free 500 MB DB, 1 GB storage, 50k MAU, 5 GB + 5 GB cached egress, 500k Edge invocations, 200 Realtime conns, 2M msgs, 50 MB max upload, pause after 1 week, 2 projects; Pro $25/mo, 8 GB DB, 100 GB storage, 250 GB egress, 100k MAU, 2M invocations, daily backups 7 d.
- Supabase Edge Functions limits (official docs, updated 2026-10-29) — `https://supabase.com/docs/guides/functions/limits`: Free 150 s wall / Paid 400 s; CPU 2 s/request; idle timeout 150 s.
- Google Drive API usage limits (official) — `https://developers.google.com/drive/api/guides/limits` — fetched 2026-11-17: 1,000,000 units/min/project; 325,000/min/user; 400,000,000/day billing threshold (cannot increase); files.get 5, files.list 100, download/export 200; exponential backoff guidance; 1 TB/day egress.
- Google Drive API v3 reference notes — `https://github.com/anthropics/claude-tag-plugins/blob/HEAD/google-drive/skills/google-drive-api/SKILL.md` (pageSize max 100, `supportsAllDrives`, `files.export` vs `alt=media`, 403 fileNotDownloadable); `https://github.com/james2256/omnidrive/blob/HEAD/docs/google-drive-api.md` (quota model change 2026-05-01).
- Framework adoption — `https://www.guideflow.com/blog/web-frameworks`, `https://www.guideflow.com/blog/web-development-frameworks` (Stack Overflow Survey 2025: React 44.7%, Next.js 20.8%, Svelte 7.8%).
- Vercel AI SDK — `https://fp8.co/articles/vercel-ai-sdk-vs-langchain-js` (AI SDK v7, June 2026; `generateObject`, Svelte/Vue/Angular UI support); `https://www.guvi.in/blog/vercel-ai-sdk/`.
- Vercel Hobby commercial-use + timeouts — `https://www.techplained.com/best-free-hosting` (checked 2026-10-19; Hobby 100 GB transfer, 1M invocations, 4 CPU-hours, 300 s — conflicts with other roundups); `https://www.theodorehq.com/docket/blog/posts/netlify-vercel-cloudflare-pages` (Hobby non-commercial, checked 2026-08-22); `https://stackcapybara.com/en/global/web/dev-platforms/vercel-hosting-platform/` (Hobby 10 s, Pro 60 s). **These disagree — see Risk #1.**
- Cloudflare free tier — `https://www.techplained.com/best-free-hosting`; `https://quantslant.com/cloudflare-pages-vs-vercel-ai-websites/` (Oct 2026): Workers Free 100k req/day, 10 ms CPU; Paid $5/mo.
- Laravel queues / Excel — `https://docs.commstate.app/api/pdf/deployment/queues` (Horizon supervisors, 120–600 s timeouts); `https://dev.to/faizan050/export-large-data-with-chunk-in-laravel-excel-fix-4pka` (Laravel Excel 3.1 chunked/queued export).
- `docx` / PDF libs — `https://socket.dev/npm/package/docx` (docx v9, Node + browser); `https://npm-compare.com/docx,exceljs,html-pdf,officegen,pdfkit,puppeteer,xlsx`.
- GPT-4o-mini pricing — `https://www.howmanytokens.io/gpt-4o-mini/` (pricing as of 2026-11-07: $0.15/$0.60 per 1M, 128k ctx); `https://www.promptunit.ai/ai-api-pricing/gpt-4o-mini` (checked 2026-11-17); `https://dashboard.paritylayer.com/blog/reduce-openai-api-costs` (GPT-4o $2.50/$10.00).
- Gemini pricing/deprecation — `https://www.kissapi.ai/blog/gemini-2-5-pro-deprecation-december-1-2026.html` (published 2026-11-09; 2.5 Pro/Flash deprecated 2026-11-02, auto-routing 2026-12-01; 3.8 Flash $0.75/$3.75 thru 2026-12-31 → $1.50/$7.50 from 2027-01-01; 3.5 Flash-Lite $0.30/$2.50); `https://techjacksolutions.com/ai-tools/google-gemini/gemini-3-8-flash/`.
- OCR — `https://tesseractocr.org/` (Tesseract 5.5.3, Apache 2.0, 100+ languages incl. Indonesian); `https://ejournal.pnc.ac.id/index.php/infotekmesin/article/download/3381/1168` (Infotekmesin, July 2026: Gemini 97% / PyMuPDF 90% / Tesseract 78% on 61 Indonesian statutory PDFs); `https://receiptocr.ai/blog/open-source-ocr` (Tesseract vs PaddleOCR vs EasyOCR vs Surya).
- Similarity (Indonesian) — `https://iopscience.iop.org/article/10.1088/1757-899X/662/2/022111/pdf` (VSM + TF-IDF + cosine, Indonesian theses, 2019); `https://journal.unm.ac.id/index.php/mediaelektrik/article/download/14414/8821/54338` (hybrid TF-IDF–SBERT, Media Elektrik, Aug 2026); `https://jurnal.polibatam.ac.id/index.php/JAIC/article/download/13773/3893` (Siamese BiLSTM vs IndoBERT, JAIC, Aug 2026).
- UU PDP — `https://www.anoman.io/blog/ai-compliance-indonesia-uu-pdp` (UU 27/2022 in force Oct 2024; Art. 56 cross-border, purpose limitation, data minimisation); `https://docs.getaxonflow.com/docs/compliance/uu-pdp/` (Art. 46 breach 3×24 h; Art. 56 tiers; DPA not yet constituted, Kominfo holds notification role).
- Supabase free-tier roundups (cross-checks) — `https://stacksfree.com/blog/2026-11-14-supabase-only-free-stack-2026/`; `https://www.cloudzero.com/blog/supabase-pricing/` (updated 2026-11-12); `https://selfhost.dev/blog/supabase-pricing-explained/` (verified Nov 2026).
- Attached prompts — `~/workspace/user/files/prompt_wawancara_k3.md` (6,331 bytes), `~/workspace/user/files/prompt_test_tulis.md` (1,327 bytes).
- GitHub — `https://github.com/danste-kun/asesorkompetensi` — empty repository, checked 2026-11-17.
