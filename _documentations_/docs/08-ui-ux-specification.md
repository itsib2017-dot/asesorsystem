# 08 — UI/UX Specification

**Project:** AsesorKompetensi — LSP/BNSP assessor web app (OHSE-first, general certification)
**Version:** v1.4 — 18 November 2026 · **Status:** Draft for review
**Changelog v1.4:** upload flow — scheme registered once, per-batch intake is pick scheme → paste Drive link(s) → Kelompok Asesi (D13, §2, §5); official 04B form with built-in questions per KP + DIT deck as evidence (D14, §3.4, §5); AI judges the roll-up, VATM-based (D16 — replaces the v1.3 assessor-judgement default; §3.4, §4, §10); multi-scheme manifest — question counts, rules, prerequisites, requirements per scheme (D17, §2); Provider Settings screen, BYOK (D18, §3.4, §4); numeric similarity thresholds + details (D19, §3.4); dashboard design language from the Dashboard V18 screenshot (D20, §3.6); **no hardcoded values at all — config-based throughout (D21, principle 17)**. **Changelog v1.3:** KTP-authoritative name rule (D6 — KTP card marked as the authority; jury proposal is always the KTP spelling) (§2, §3.4, §4); grading shape (D7 — per-question verdicts + Bahasa Indonesia explanations + Ringkasan Kesalahan, no overall % as a pass/fail; plagiarism as a separate qualitative report) (§3.4, §4, §10). **Changelog v1.2:** `NameJuryCard` + KTP OCR review state (§3.4, §4); `SignatureUpload` + sign-off modal with signature preview + missing-signature blocker (§3.4, §4, §5); export-format rule — buttons show only the allowed formats per artefact (§3.4, §5); new principles 11–13 (§2); acceptance checklist +3 items (§10). Changelog v1.1: triage screen spec (§3.4, §5); DIT similarity matrix view (§3.4, §5); AK.05 true export preview + sign-off (§3.4, §5); candidate profile summary block in DIT analysis (§3.4); model-answers display rules (§2, §3.4); encrypted-06B password prompt + blocker states (§3.4, §4); completeness-gate state (§4); prompt-editor decision — NO in-app prompt editor in v1.1 (§9); form-fidelity note updated — exports are now validated against the real blank forms extracted in `research/form-blanks-extracted.md` (§9).
**Companion docs:** PRD (02), Wireframes (13), Technical Design (06).
**Language:** UI and AI reports in Bahasa Indonesia. Docs in English; Indonesian form names preserved (FR.APL.01, FR.IA.04A, FR.AK.05, DIT = Daftar Instruksi Terstruktur).

## 1. Who uses this, and in what conditions

| User | Primary tasks | Context |
|---|---|---|
| **Asesor** (main user) | Ingest a Drive folder, triage completeness, confirm certificate names, review DIT analysis, confirm written-test grading, review similarity flags, draft + export FR.AK.05 | Laptop, office or home; sometimes mobile while travelling; intermittent / low-bandwidth connections; long sessions with 23+ assessees |
| **LSP admin / Ketua LSP** | Create batches, assign assessors, configure scheme + form mapping, review AK.05 drafts, pleno handoff | Laptop; needs the audit trail, not the per-question detail |
| **TUK admin** (read / upload) | Supply Drive links, check completeness status | Laptop; may be non-technical |
| **Asesi (candidate)** | *Not a user of this app in MVP.* No candidate login, no candidate-facing screens. | — |
| **Public visitor** | Sees aggregate-only information if a public page ever ships | Must never see per-assessee finance, names, status, or documents |

**Design consequence:** this is an **assessor back-office tool**, not a marketing site and not a candidate portal. Optimise for dense, scannable, trustworthy work surfaces — not for delight. Every screen must answer, within 5 seconds of landing: *what needs my decision next, and what is blocked?*

## 2. Design principles

1. **Decision-first.** Every list is sorted by "needs a human decision" first (missing documents, identity mismatch, unconfirmed grading, similarity flag), then by name. Never alphabetical-by-default when work is pending.
2. **Evidence beside verdict.** An AI recommendation is never shown without the evidence it rests on (quoted span, source document, page/line where available) and the model + prompt version that produced it.
3. **Nothing silent.** Long jobs (Drive scan, OCR, grading, export) always show progress, counts, and failures. A job that fails shows *which* files failed and why, and offers retry — never a generic error.
4. **Human confirms; AI recommends.** Buttons say "Konfirmasi", "Setuju", "Tolak", "Minta Tinjauan Ulang" — never "AI memutuskan". The decision value is binary K / BK only (no "Kompeten Bersyarat" as a decision).
5. **Low-bandwidth tolerant.** No hero images, no autoplay, no heavy JS on first paint. Lists paginate (25 rows). Document previews are on-demand, not preloaded. Works on a 3G-class connection; degrades gracefully offline by showing the last synced state with a "data mungkin kedaluwarsa" banner.
6. **Bahasa Indonesia, plain words.** Labels use the words assessors actually use: "Lapor", "Periksa", "Konfirmasi Nama", "Tandai K / BK". Avoid English jargon in the UI; where a term has no good Indonesian equivalent (e.g. "embeddings"), do not surface it to assessors at all.
7. **Elderly- / low-literacy-friendly where candidate-facing surfaces ever appear.** Not required in MVP (no candidate UI), but any future candidate-facing screen must use ≥ 16 px body text, one primary action per screen, and no time-pressure UI. Keep this principle in the design system now so it is not retrofitted later.
8. **Privacy by default.** Names and document thumbnails appear only inside an authenticated, batch-scoped session. No personal data in URLs (use UUIDs), no personal data in page titles, no KTP image rendered next to an LLM output.
9. **Model answers are assessor-only (v1.1).** Where the system shows a model/expected answer (for the assessor to judge a candidate's answer against), it is labelled "Jawaban model — hanya untuk asesor", shown only to `assessor` / `ketua_tim` / `lsp_admin`, and never rendered in any candidate-facing view or in any export handed to a candidate. The system never drafts a candidate's answers.
10. **Never analyse incomplete inputs (v1.1).** If a DIT analysis cannot run because FR.IA.04A, the presentation/transcript, or the candidate profile is missing, the screen lists exactly what is missing and offers the single action to supply it — it never runs a partial analysis and never invents coverage.
11. **The name jury recommends; the assessor confirms (v1.2, D10).** The AI jury reads the KTP by local OCR and compares the four name sources, but its verdict is a recommendation with reasoning, evidence spans, and OCR confidence. The certificate name becomes final only when the assessor confirms it (or overrides it with a typed name). A jury verdict is never applied silently, and a low-confidence OCR never produces a proposed name. **v1.3 (D6 decided):** The KTP (government ID) is the authority: the certificate name is the KTP name, verbatim. Surat tugas, APL.01, and ijazah are compared against the KTP, and any discrepancy resolves to the KTP spelling — surat tugas "Declan Rice P." vs KTP "Declan Rice Pangabean" → "Declan Rice Pangabean".
12. **Export buttons show only the formats the LSP accepts (v1.2, D8).** AK.05 offers PDF + DOCX; every other generated document offers DOCX only. A format that is not offered is never reachable from the UI — there is no hidden "export as PDF" for a non-AK.05 document.
13. **A signature belongs to one assessor and is applied only at sign-off (v1.2, D11).** An assessor's uploaded signature is applied to a document only when that assessor signs off / finalises it, never to a draft, and never to another assessor's document. If the assessor has no active signature, sign-off is blocked with the blocker named — the document is never signed with a placeholder, a typed name in place of the image, or someone else's signature.
14. **Multi-scheme by default — the scheme manifest (v1.4, D17).** AK3U is one manifest, not the product. Each scheme registers its own manifest: its file set, its question counts (04B built-in count, 06A essay count, question-bank default count), its decision/assessment rules reference, its prerequisites, and its registration requirements. No screen assumes 13 questions, AK3U's file names, or AK3U's entry requirements unless the active scheme is AK3U.
15. **The AI provider is the user's choice, free-first (v1.4, D18).** Provider + base URL/gateway + model + key are runtime settings the user supplies (Provider Settings screen, §3.4) — Anthropic, OpenAI-compatible, Gemini, OpenRouter / OmniRouter / 9Router, Nvidia NIM, and others; free tiers usable. Keys are stored locally in the browser, sent per request, never logged, never committed. No provider or model is hard-coded anywhere in the UI.
16. **One short intake per batch (v1.4, D13).** A scheme and its scheme-level forms are registered once; starting a batch is three steps — pick the registered scheme, paste the Drive link(s), supply the Kelompok Asesi (Drive link or .xlsx) — and go. Filled 04A/04B/09 copies arrive inside the Drive folder; direct upload is the fallback, never the default path.
17. **No hardcoded values at all — config-based throughout (v1.4, D21, top-level canonical rule).** Every value that varies by scheme, org, or deployment comes from config — scheme names and file manifests, question counts (never a literal 13 in the UI; 13 is only the AK3U manifest's value), decision/assessment rules, thresholds, prerequisites, requirements, roles, export formats, providers, models, temperatures, and UI labels that vary by scheme/org. No screen presents an AK3U value as the system default; even a fallback is a config value, never a code constant.

## 3. Design system

A calm, professional palette for a certification back-office. **Deliberately distinct from any other project** — no borrowed brand system. Neutrals do the work; one accent carries meaning; colour is never the only signal (icons + text always accompany it).

### 3.1 Colour

| Token | Value | Use |
|---|---|---|
| `--ink` | `#1C2B33` | Primary text |
| `--ink-soft` | `#4A5A63` | Secondary text, metadata |
| `--paper` | `#F7F5F0` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | Cards, tables, modals |
| `--line` | `#DCE1E4` | Borders, dividers |
| `--teal` (primary) | `#0F766E` | Primary actions, links, active nav |
| `--teal-dark` | `#0B5A54` | Primary hover / pressed |
| `--amber` | `#B45309` | Warning / needs decision / partial |
| `--amber-bg` | `#FEF3C7` | Warning background |
| `--green` | `#15803D` | Kompeten (K) / complete / success |
| `--green-bg` | `#DCFCE7` | Success background |
| `--red` | `#B91C1C` | Belum Kompeten (BK) / error / mismatch |
| `--red-bg` | `#FEE2E2` | Error background |
| `--slate` | `#64748B` | Muted badges, disabled |

Rules: K = green + "K — Kompeten" text; BK = red + "BK — Belum Kompeten" text; never colour alone. AI-recommended values carry a dotted underline + "Rekomendasi AI" tag until confirmed; confirmed values lose the tag. Similarity flags are amber ("Perlu Ditinjau"), never red — a flag is not a verdict.

### 3.2 Typography

- **UI font:** Inter (system fallback: `system-ui, -apple-system, "Segoe UI", sans-serif`). **Headings:** same family, weight 600–700. **Monospace (IDs, codes, file paths):** `ui-monospace, "SF Mono", Menlo, monospace`.
- **Scale:** Display/page title 24 px / 600; section title 18 px / 600; card title 16 px / 600; body 15 px / 400 (line-height 1.6); small/meta 13 px; table cell 14 px. Minimum body size 14 px anywhere; 13 px only for metadata.
- **Bahasa Indonesia copy rules:** sentence case for headings; form codes in caps exactly as issued (`FR.IA.04A`, `FR.AK.05`); "DIT" always expanded on first use per screen ("DIT — Daftar Instruksi Terstruktur").

### 3.3 Spacing, layout, and density

- Base unit 4 px; card padding 16–20 px; section gap 24 px; page max-width 1,200 px, centred, 16 px side padding on mobile.
- Desktop: left sidebar navigation (240 px) + content. Mobile (< 768 px): top bar + bottom-tab-style nav for the 4 primary destinations (Dashboard, Batch, Tugas Saya, Pengaturan).
- Tables: sticky header, zebra rows off (use row hover + 1 px dividers), row height 44 px, text left-aligned except numbers right-aligned. Lists longer than 25 rows paginate; no infinite scroll for work lists (assessors need a stable position to return to).
- Density toggle (Nyaman / Padat) on list screens — stored per user. Default Nyaman.

### 3.6 Dashboard design language — Dashboard V18 (v1.4, D20)

The dashboard follows the **Dashboard V18 — Modern & Minimal UI** reference Moza supplied (screenshot, 2026-11-18 01:25): modern and minimal, elegant analytics cards, smooth charts, modern layouts, a clean white-and-blue theme, premium, responsive. The visual language is grounded in that screenshot — it is an adaptation for an assessor dashboard (batches, completeness, decisions), not a copy of a bookmarks board.

Concrete elements taken from the screenshot:

- **Glassmorphism cards** — `glass-card` surfaces, `rounded-2xl` (large radius), padding `p-6`; cards carry the content, the page background stays light.
- **Hover lift** — cards lift on hover (`whileHover={{ y: -5 }}`, framer-motion); motion is subtle and respects `prefers-reduced-motion` (§6).
- **Gradient accents** — a `gradient` prop per card supplies the accent (icon chip / value tint); gradients are restrained — one accent per card, never a rainbow page.
- **Dark icon sidebar + light content area** — a near-black vertical icon sidebar on the left; the content area is light grey/white. The sidebar carries icons only (labels on hover / expanded state); the existing sidebar destinations (Dashboard, Batch, Asesi, Penilaian, Kemiripan, Laporan, Pengaturan) keep their order and names.
- **Right-hand panel column** — the reference has a "Collections" panel on the right (list + counts + a total); the assessor dashboard uses the same right column for "Perlu keputusan Anda" — pending decisions with counts and a total — instead of a bookmarks collection.
- **StatsCard** — title (small, semibold), value (large, bold, `text-2xl`), and a change indicator with a lucide arrow icon (`ArrowUpRight`, emerald for a positive change). Assessor stats are completeness %, names confirmed, decisions recorded, flags reviewed — each a big value with a change arrow, never a bare number.
- **Card grid** — a 3-column grid of cards on desktop (collapsing to 1 column on mobile, §7); each card has a thumbnail/visual area, a title, and a source line. Filter tabs sit top-right of the grid (in the reference: Videos / Docs / Links; in the dashboard: All / Needs decision / Done — or the batch filter).
- **White-and-blue theme** — the dashboard's base is white/light with the blue accent; the existing teal primary (`--teal`, §3.1) stays for actions and links, and the dashboard adds the blue accent only for the stats/gradient treatment. Colour is still never the only signal (§2, §3.1).

Implementation note: the reference code is React + framer-motion + lucide-react + Tailwind. The Next.js app already uses React + Tailwind; framer-motion and lucide-react are the two additions for the dashboard (no other new UI dependency is implied). No chart type beyond "analytics cards + charts" is specified here — the charts are the completeness/decision trend charts the dashboard already needs, rendered in the same glass-card language.

### 3.4 Components (inventory)

| Component | Notes |
|---|---|
| `TopBar` | App name "AsesorKompetensi", batch switcher, user menu, job bell (active jobs with progress) |
| `SideNav` | Dashboard, Batch, Asesi, Penilaian, Kemiripan, Laporan (AK.05), Pengaturan |
| `BatchCard` | Scheme, TUK, date, counts (23 asesi · 2 asesor), completeness bar, status chip |
| `CompletenessMatrix` | Per-assessee × doc-type grid (APL.01, APL.02, KTP, Ijazah, Pas Foto, CV, Sertifikat Pelatihan, Portofolio); cell = ✓ / — / ⚠ (unsigned scan, poor photo) |
| `IdentityCheckCard` | Three names side by side (KTP / APL.01 / Surat Tugas) — the KTP card is marked as the authority source and the other names are compared against it (v1.3, D6 decided) — + diff highlight + "Nama tercetak di sertifikat" field + Konfirmasi button. **v1.2:** the card now shows the jury verdict from `NameJuryCard` (below) — the three-name view is the evidence, the jury card is the recommendation. |
| `NameJuryCard` (v1.2) | The name-jury review card on Candidate Detail (doc 13 §6 v1.2): the four compared names (KTP via OCR / APL.01 / surat tugas / ijazah) with the differing spans highlighted, the OCR text + confidence badge, the jury verdict (`Cocok` / `Beda — diusulkan` / `Perlu manusia`) with Bahasa Indonesia reasoning and one evidence span per compared name, and the proposed certificate name (only when the verdict is `mismatch_resolved`) — the proposed name is always the KTP spelling (v1.3, D6 decided: the KTP is the authority; any discrepancy resolves to the KTP spelling). Actions: [Konfirmasi Nama Ini] (applies the proposed name), [Ubah / Ketik Sendiri] (assessor types the name — an override, audit-logged), [Tandai Perlu Manusia] (keeps the name unconfirmed with a reason). When the verdict is `needs_human`, the card shows no proposed name at all — only the reasoning and the four sources. The KTP image itself is shown in a separate, view-only pane (private bucket, signed URL, audit-logged); it is never rendered next to, or inside, an LLM output. |
| `SignatureUpload` (v1.2) | Assessor signature capture on Pengaturan → Profil (doc 13 §13 v1.2): upload a scan/photo (PNG or JPG) or draw on a canvas. Shows a live preview, the active version + upload date, and the previous versions (read-only history). Replacing a signature creates a new version — past documents keep the signature they were signed with. The component validates type + size in the browser and again on the server; an invalid file is rejected with a Bahasa Indonesia message, never stored. |
| `CoverageMatrix` | FR.IA.04A focus points × Terpenuhi / Sebagian / Belum Dibahas, with evidence quotes |
| `QuestionBankList` | Numbered 1–N, where N is the active scheme's manifest count (13 for AK3U, never hard-coded — v1.4, D17), each with dimension tag (TS/TMS/CMS/JRES/TrS) and linked focus point |
| `GradingRow` | Per-question: master span vs student span, verdict `Benar / Sebagian Benar / Salah` with a Bahasa Indonesia explanation, Konfirmasi per item. **v1.3 (D7):** the grading screen shows a per-student error summary (Ringkasan Kesalahan — the question numbers answered wrong) and never an overall percentage as a pass/fail. **v1.4 (D16 — replaces the v1.3 roll-up default):** the AI judges VATM sufficiency per unit (evidence meeting VATM → "Kompeten", otherwise "Belum Kompeten"; no numeric pass mark) and recommends K/BK; the assessor confirms or overrides the recommendation per unit. |
| `SimilarityPairCard` | Two assessees, per-question overlap bars, shared spans highlighted, shared-error callout, verdict selector (Kebetulan / Perlu Ditinjau / Indikasi Menyalin — flag only). **v1.3 (D7):** the plagiarism analysis is a separate qualitative report — per-student status Bersih / Waspada + reasoning, never a numeric plagiarism verdict; it is separate from the grading tables. **v1.4 (D19):** each pair also shows its **numeric flag** (the per-scope numeric threshold comparison) **with the evidence details** (spans, shared unique errors) — the numbers are the flag, the qualitative status is the human-facing summary. Threshold values are config and UNCONFIRMED (calibration) — no number is asserted in the UI copy. |
| `SimilarityMatrix` (v1.1) | Assessee × assessee grid for one batch and one scope (DIT or written). Cell = combined score (number + shade); empty diagonal; click a cell → the pair card for that pair. Scores are flags, never verdicts; the grid shows at most the top-N flagged pairs in full detail and collapses the rest. For 23 assessees the grid is 23 × 23 (253 pairs); for larger batches it paginates by assessee group. |
| `TriageQueue` (v1.1) | Two lists for one batch: unassigned files (drive path, suggested assessee + confidence, suggested doc type) and assessees without an assessor (with the suggested assessor + reason). Each row: accept suggestion / pick a different assessee or assessor / mark "not needed" with a reason. Bulk-assign for rows sharing one suggestion. Only `ketua_tim` / `lsp_admin` see the assign controls; an assessor sees only items routed to them. |
| `ProfileSummary` (v1.1) | Candidate profile summary block at the top of the DIT analysis screen: education, work-experience summary, current/target role level, region, industry sector. Read-only; sourced from CV/profile extraction. It is the same block the RCTFA prompt requires as its "Candidate Profile Summary" — shown so the assessor can check the personalisation inputs before trusting the questions. |
| `ModelAnswerBox` (v1.1) | Collapsed-by-default box on a grading row: the model/expected answer for that question, with the key points it covers. Labelled "Jawaban model — hanya untuk asesor" with a lock icon; never rendered for `tuk_viewer` / `auditor` roles and never included in candidate-facing exports. |
| `ProviderSettings` (v1.4, D18) | The Provider Settings screen (Pengaturan → Penyedia AI, doc 13 §15): provider selector (Anthropic (Claude) / OpenAI-compatible / Gemini), API Key (masked, never echoed back), Base URL (optional gateway), ANTHROPIC_AUTH_TOKEN (gateway bearer / passthrough token, shown only when calling the gateway), Model (free text + Suggest…), Temperature, Max tokens, Thinking budget (0 = off), Google Drive API key (optional — required to read public Drive folders; no OAuth, public folders only), [Simpan] + [Uji Koneksi] buttons. The Test connection result says only "terhubung / gagal" with the failure reason — it never echoes the key. Keys are stored locally in the browser, sent per request, never logged, never committed. Grading/jury calls use temperature 0 (deterministic) regardless of the screen's Temperature setting — the setting is the user's default for other calls (Moza's Test Grader app uses 0.9 as its own default; that is his app's setting, not the grading default). |
| `SchemeRegistration` (v1.4, D17) | The scheme-registration screen (Pengaturan → Skema, doc 13 §16): the admin defines a scheme's manifest — scheme name + scheme document reference, its file set (which forms exist for this scheme, required vs optional, and their names/suffixes), its question counts (04B built-in count, 06A essay count, question-bank default count), its decision/assessment rules reference (which scheme document states the rule — for AK3U: VATM per scheme §9.3.3–9.3.4; another scheme references its own scheme document, never a global hard-code), its prerequisites (entry education/experience combinations), and its registration requirements (evidence list). AK3U's values (13 questions, SLTA+3yr / D3-D4-S1+2yr / S2-S3+1yr, the AK3U evidence list) are AK3U's manifest values only — the screen never pre-fills another scheme with them. |
| `Official04BForm` (v1.4, D14) | The official FR.IA.04B section on the DIT screen (doc 13 §7): the form's built-in questions per Kelompok Pekerjaan (4 KP, 13 built-in questions for AK3U — one per unit, from the active scheme's manifest), each with its Kesesuaian (unit/elemen/KUK) column and a Ya / Tidak control, plus the DIT deck (presentation) shown as the evidence beside the questions. The 13-question bank stays a separate, labelled artefact below it — never merged with the form. |
| `KeyPasswordPrompt` (v1.1) | Modal shown when the 06B key file is encrypted: password field (masked, never logged), "Buka Kunci untuk Penilaian Ini" button, and a note that the password is used once for decryption and never stored. Wrong password → inline error "Kata sandi salah — coba lagi" (no hint about the key); after three failures the grading run locks and the screen names the `lsp_admin` review step. |
| `PromptVersionBadge` (v1.1) | Read-only badge on every AI output: prompt key + version + model + source hash (short). Links to Pengaturan → Prompt, which shows the registry entry (adapted text + adaptation notes). There is no edit control on the badge — prompts are versioned in code (see §9). |
| `Ak05Preview` (v1.1) | True preview of the exported AK.05: renders the exact blank-form layout (header, 12-row table with K/BK columns, BK footnote, three notes sections, signature block) filled with the draft data, in a print-faithful frame. The preview is what gets exported — if the preview and the export ever differ, that is a defect (QA EXP-01). **v1.2:** the signature block in the preview renders the signing assessor's uploaded signature image (with name + No. Reg + date); if the assessor has no active signature, the block shows an empty signature space + the blocker "Tanda tangan belum diunggah" — never a placeholder signature. |
| `JobProgress` | Progress bar + `done / total / failed`, per-file list, Retry failed, Cancel |
| `DecisionToggle` | Segmented K / BK control; requires a note when BK; disabled until required evidence is confirmed |
| `AuditTrail` | Chronological actor + action + timestamp list; filterable by assessee |
| `EmptyState` / `ErrorState` / `Skeleton` | See §4 |

### 3.5 Motion and feedback

- No decorative animation. Transitions ≤ 150 ms, opacity/transform only. Toasts for completed actions (3 s, dismissible). Long jobs use a persistent progress indicator, not a toast. Confirmations for destructive actions (delete, revoke token, finalise AK.05) use a modal with the consequence written in plain language.

## 4. States — loading, empty, error (mandatory per screen)

| State | Pattern |
|---|---|
| **Loading (fast, < 1 s)** | Skeleton rows matching the layout; no spinner-only screens. |
| **Loading (long job)** | `JobProgress`: determinate bar when total is known ("127 / 214 file"), indeterminate + elapsed time when not; "Anda bisa meninggalkan halaman ini — pekerjaan berlanjut di latar belakang." Polling every 3 s, or Supabase Realtime subscription where available. |
| **Empty — no data yet** | Illustration-free empty state: one-line explanation + the single next action ("Mulai Pindai Drive", "Unggah FR.IA.06B"). Never an empty table with no guidance. |
| **Empty — all done** | Positive empty state ("Semua 23 asesi sudah lengkap.") with a link to the next step. |
| **Error — job/file failure** | List of failed items with reason + Retry per item / Retry all. Partial success is shown as partial success, never as total failure. |
| **Error — network** | Inline banner + Retry; previously loaded data stays visible, marked "terakhir diperbarui HH:MM". |
| **Permission denied** | "Anda tidak memiliki akses ke batch ini." + link to Dashboard. No detail about what exists. |
| **OCR low confidence** | Amber badge on the document ("Hasil OCR kurang yakin — periksa") + link to the source file; extracted text shown with the low-confidence spans marked. |
| **Completeness gate (v1.1)** | The DIT analysis screen, when inputs are missing, shows a gate panel instead of the analysis: "Analisis ditunda — bahan belum lengkap" + a checklist of exactly which inputs are missing (FR.IA.04A / transkrip presentasi / profil kandidat) + one action per missing item ("Unggah", "Lihat di Drive"). The "Jalankan Analisis" button is disabled with the blocker named. No partial matrix, no partial question bank is ever shown. |
| **Encrypted key (v1.1)** | The grading screen, when the 06B key is encrypted, shows a locked state: "Kunci jawaban (FR.IA.06B) terproteksi kata sandi" + [Masukkan Kata Sandi] opening `KeyPasswordPrompt`. Grading controls stay disabled until the key is unlocked for that run. The password is never shown, logged, or stored. |
| **AK.05 sign-off (v1.1)** | The AK.05 screen has two distinct states: draft (editable, export allowed) and submitted (read-only, with "Diserahkan ke TUK/LSP pada …" + who submitted). Sign-off is a confirmation modal: it lists the row count, the K/BK split, and the blockers checked (names confirmed, decisions recorded), and requires typing nothing — one "Tandai Diserahkan" button plus an explicit "Batal" — but the modal states plainly that submission hands the recommendation to TUK/LSP and that a submitted report can only come back via a TUK/LSP return (doc 05 v1.1). |
| **KTP OCR / name jury (v1.2)** | Candidate Detail shows the OCR state per KTP: running ("Membaca KTP…"), done with a confidence badge ("OCR yakin 92%"), or low confidence ("Hasil OCR kurang yakin — periksa", amber). The jury card shows `Cocok` (green), `Beda — diusulkan` (amber, proposed name shown), or `Perlu manusia` (amber, no proposed name, reasoning only). Until the assessor confirms or overrides, the certificate-name field stays in its "belum dikonfirmasi" state and AK.05 stays blocked. The KTP image pane is view-only; OCR text is editable only by re-running OCR or by the assessor typing the name as an override — the assessor never edits the OCR text in place and calls it a verdict. The KTP card is marked as the authority source (v1.3, D6): the proposed name is always the KTP spelling. |
| **Grading verdicts (v1.4)** | Each question shows its verdict (Benar / Sebagian Benar / Salah) + a Bahasa Indonesia explanation quoting master + student spans. The screen's summary is the per-student error list (Ringkasan Kesalahan — the question numbers answered wrong), not a percentage. No overall % is shown as a pass/fail. **v1.4 (D16 — OQ-04 answered, replaces the v1.3 default):** the AI judges VATM sufficiency per unit and recommends K/BK per unit ("Kompeten" when the evidence meets VATM, "Belum Kompeten" otherwise — scheme §9.3.3–9.3.4, no numeric pass mark); the assessor confirms or overrides the recommendation. The plagiarism analysis is a separate qualitative view (Bersih / Waspada + reasoning), never a numeric verdict. |
| **Provider settings (v1.4)** | The Provider Settings screen shows masked keys (never the value), the selected provider + model, and the last Test connection result ("Terhubung" / "Gagal — [alasan]"). A failed test names the cause (wrong key, unreachable gateway, unknown model) without echoing any key. Changing provider or model never re-grades past runs — past runs keep the provider + model recorded on them. |
| **Signature missing (v1.2)** | Any sign-off / finalise action with no active signature for the signing assessor is blocked: the button is disabled with the blocker "Tanda tangan belum diunggah" + a link [Unggah Tanda Tangan] to Pengaturan → Profil. The sign-off modal, when the signature exists, shows a thumbnail preview of the signature image that will be applied, with the assessor's name + No. Reg beneath it — the assessor sees exactly what will be stamped before confirming. |
| **Export format (v1.2)** | Export buttons offer only the formats the export rule allows: AK.05 shows [Ekspor PDF] [Ekspor DOCX]; every other document screen shows [Ekspor DOCX] only. Tabular data extracts (audit log, completeness matrix) show [Unduh XLSX] labelled as data. There is no PDF button on a non-AK.05 document screen. |

## 5. Key flows (summary — full flows in PRD 02; wireframes in 13)

1. **Buat batch (v1.4, D13 — short intake): pick a registered scheme → paste the Drive link(s) → supply the Kelompok Asesi (Drive link or .xlsx) → [Buat Batch] → pindai** (job) → **triage: petakan file & asesi tanpa asesor** (Triage screen, v1.1 — one flat shared folder is split here, before any analysis) → **triage ketidaklengkapan** → **konfirmasi nama — KTP dibaca OCR, juri nama memberi putusan, asesor mengonfirmasi** (v1.2) → **analisis DIT** (gated: bahan belum lengkap → analisis ditunda, §4; the official 04B form shows its built-in questions per Kelompok Pekerjaan with the DIT deck as evidence, v1.4 D14) → **penilaian tertulis** (kunci terenkripsi → minta kata sandi sekali, §4; v1.3: a plain (unencrypted) working key needs no password prompt) → **tinjau kemiripan** (matrix + pair cards; numeric flag + evidence details, v1.4 D19) → **keputusan K/BK per asesi (AK.02 — AI recommends K/BK per unit by VATM judgement, assessor confirms or overrides, v1.4 D16)** → **draf AK.05 → pratinjau persis ekspor (dengan tanda tangan) → ekspor (PDF + DOCX) → tandai diserahkan ke TUK/LSP** (sign-off modal with signature preview, §4). The assessor uploads their signature once, at onboarding / in Pengaturan → Profil — sign-off is blocked without it. Scheme + scheme-level forms are registered once per scheme (Pengaturan → Skema, §3.4 `SchemeRegistration`) — they are never re-uploaded per batch; filled 04A/04B/09 copies arrive inside the Drive folder, direct upload is the fallback only.
2. Every step shows its blocker explicitly ("AK.05 terkunci: 2 nama belum dikonfirmasi") — the user never has to guess why a button is disabled; the disabled button carries a tooltip + a link to the blocking item.

## 6. Accessibility (WCAG 2.2 AA target)

- Contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI components. All status conveyed by text + icon, never colour alone.
- Full keyboard operability: visible focus ring (2 px `--teal`, offset 2 px), logical tab order, modals trap focus and close on Esc.
- Screen-reader: tables use `<th scope>`, status changes announced via `aria-live="polite"`, job progress uses `role="progressbar"` with `aria-valuenow`.
- No information conveyed by images alone; every document thumbnail has alt text naming the doc type, not the person.
- Reduced motion: honour `prefers-reduced-motion` (disable transitions).
- Touch targets ≥ 44 px on mobile; the K/BK toggle is ≥ 48 px high.

## 7. Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| ≥ 1024 px | Sidebar + multi-column detail (evidence left, verdict right on grading screens). |
| 768–1023 px | Sidebar collapses to icons; detail stacks to one column; tables scroll horizontally with sticky first column (assessee name). |
| < 768 px | Top bar + bottom nav; tables become card lists; K/BK toggle full-width; Drive job progress is a sticky bottom sheet. |

No screen may require horizontal scrolling of the whole page. Print styles: AK.05 and grading reports print cleanly (black on white, no nav, page breaks between assessees).

## 8. Content and microcopy (Bahasa Indonesia)

- Buttons: verbs first — "Mulai Pindai", "Konfirmasi Nama", "Tandai K", "Ekspor AK.05".
- AI labels: "Rekomendasi AI — perlu konfirmasi asesor" (never "Hasil AI" as if final).
- Similarity: "Kemiripan terdeteksi — perlu ditinjau asesor" (never "Plagiarisme terbukti").
- Errors: what happened + what to do — "Gagal mengunduh 3 file (akses ditolak). Periksa apakah tautan Drive masih publik, lalu Coba Lagi."
- Dates: `12 Nov 2026, 09.00 WIB` format. Numbers: Indonesian grouping (`1.000`, decimal `,`).

## 9. What this spec does NOT cover

- Candidate-facing screens (no candidate login in MVP) — principles in §2.7 are reserved for a later phase.
- Public aggregate pages — out of MVP scope; when built, they show aggregates only.
- **In-app prompt editor — explicitly NOT in v1.1.** Prompts are versioned code templates (doc 15 §4.4); assessors see the prompt version + adaptation notes read-only (via `PromptVersionBadge` → Pengaturan → Prompt). Rationale: a prompt edit is a change to the assessment instrument — it needs review, a version bump, and a replay test, not a text box in the UI. If the LSP later asks for in-app prompt editing, that is a new feature with its own approval workflow (P2 at the earliest), not a settings field.
- Exact BNSP form pixel fidelity — export templates are validated against the real blank forms extracted in `research/form-blanks-extracted.md` (AK3U: FR.AK.05 with its 12-row table, BK footnote, three notes sections, and signature block; FR.AK.02 with its 13-unit evidence grid; FR.IA.04B with per-Kelompok-Pekerjaan Ya/Tdk rows; Berita Acara with its 13-unit K/BK grid split 7 + 6). This spec governs the app UI, not the printed form layout — but the AK.05 preview component (§3.4, `Ak05Preview`) must render that exact layout, so the UI and the export cannot drift apart.

## 10. Acceptance checklist for any UI change

- [ ] Decision-first ordering preserved (pending decisions on top).
- [ ] Every AI value shows evidence + model + prompt version + "Rekomendasi AI" tag.
- [ ] Every long job shows progress, counts, failures, retry.
- [ ] Every disabled action explains its blocker.
- [ ] Colour is never the only signal; contrast checked.
- [ ] Keyboard + screen-reader pass on the changed screen.
- [ ] Mobile (< 768 px) layout checked; no page-level horizontal scroll.
- [ ] No NIK / KTP image / personal data in URLs, titles, or logs.
- [ ] **v1.1:** model answers (if shown) carry the "hanya untuk asesor" label and are invisible to `tuk_viewer` / `auditor` roles.
- [ ] **v1.1:** the DIT analysis screen shows the completeness-gate panel (not a partial analysis) when inputs are missing.
- [ ] **v1.1:** the AK.05 preview renders the exact blank-form layout; preview and export are byte-identical in content.
- [ ] **v1.2:** the name-jury card shows the verdict, reasoning, evidence spans, and OCR confidence, with Confirm / Override / Needs-human actions — and shows no proposed name when the verdict is `needs_human`.
- [ ] **v1.2:** the sign-off modal shows a preview of the signature image that will be applied; sign-off is blocked with a named blocker when the assessor has no active signature.
- [ ] **v1.2:** export buttons offer only the formats the export rule allows (AK.05: PDF + DOCX; everything else: DOCX only).
- [ ] **v1.3:** the name-jury card proposes the KTP spelling only — the KTP card is marked as the authority source, and a KTP that cannot be read yields `needs_human` with no proposed name.
- [ ] **v1.3:** the grading screen shows per-question verdicts + Bahasa Indonesia explanations + Ringkasan Kesalahan, with no overall % as a pass/fail; the plagiarism analysis is a separate qualitative view (Bersih / Waspada), never a numeric verdict.
- [ ] **v1.4:** the per-unit K/BK is the AI's VATM recommendation, confirmed or overridden by the assessor — no "assessor's judgement per KUK" default remains anywhere (D16).
- [ ] **v1.4:** the official 04B form shows its built-in questions per Kelompok Pekerjaan with the DIT deck as evidence, separate from the 13-question bank (D14).
- [ ] **v1.4:** the similarity screen shows the numeric flag + evidence details alongside the qualitative Bersih / Waspada status; no threshold number is asserted in UI copy (D19).
- [ ] **v1.4:** Provider Settings never echoes a key, and changing provider/model never re-grades past runs (D18).
- [ ] **v1.4:** no screen assumes 13 questions, AK3U's file names, or AK3U's entry requirements unless the active scheme is AK3U (D17).
