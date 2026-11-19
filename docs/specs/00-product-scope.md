# 00 — Product Scope & Threat Model (Section A)

- **System:** AsesorKompetensi
- **Version:** v1.4
- **Date:** 2026-11-18
- **Authority:** `ground_rules_v5.md` (§A.4) & `docs/00-grill-findings-and-phase0-plan.md`

---

## 1. Product Scope

AsesorKompetensi is a specialized web application for assessors at Lembaga Sertifikasi Profesi (LSP) operating under BNSP standards.

### Core Objectives:
1. **Multi-Tenant (Per-LSP)**: Every business entity is bound to an `lsp_id`.
2. **Provider-Agnostic BYOK**: Assessors configure their own AI provider (Anthropic, OpenAI-compatible gateway, Gemini) through a dedicated Provider Settings UI. Keys are encrypted server-side with AES-256-GCM.
3. **Evidence-Based Grading**:
   - DIT (Daftar Instruksi Terstruktur / FR.IA.04A) focus points.
   - 13-question personal question bank adapted to scheme manifests.
   - Written test grading (FR.IA.06B key vs 06C answers) with per-question Benar/Sebagian/Salah verdicts.
   - Binary decision: **Kompeten (K) / Belum Kompeten (BK)** based on VATM sufficiency. No "Kompeten Bersyarat".
4. **Certificate Name Authority**: The government ID (KTP) is the ultimate authority. Name discrepancies across surat tugas, APL.01, and ijazah resolve to the KTP spelling.
5. **Human-Confirmed AI**: AI outputs are strictly recommendations; assessors confirm or override every single verdict.

---

## 2. Threat Model & Boundaries

| Asset | Threat | Mitigation |
| :--- | :--- | :--- |
| **Assessee PII (KTP, NIK)** | Data breach / LLM leak | Local Tesseract OCR only. KTP images/NIK never sent to LLMs. NIK masked in logs. |
| **BYOK API Keys** | Key exposure / credential theft | Encrypted with AES-256-GCM using platform master secret (`BYOK_ENCRYPTION_SECRET`). Never returned in logs or client bundles. |
| **Multi-Tenant Data** | Cross-tenant data leakage | Enforced at DB level with Row-Level Security (RLS) on all tables; verified with 40 automated SQL scenarios (`tests/rls-multi-lsp.test.sql`). |
| **06B Answer Key Integrity** | Blanko or encrypted MUK templates activating as master key | Server-side `validateMasterKey06bContent` + `activateBatchMasterKey06bAction` reject blankos/06A/encrypted files and emit `batch.key_06b.activate.rejected` audit events. |
| **Audit Logs** | Tampering / log deletion | Implemented with append-only database triggers (`audit_immutable()`); UPDATE and DELETE statements are rejected. |
| **LLM Output Injection** | Prompt injection via candidate answers | Candidate text treated as untrusted data boundaries with strict Zod validation on model outputs. |
