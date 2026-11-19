import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  numeric,
  jsonb,
  timestamp,
  date,
  inet,
  primaryKey,
} from "drizzle-orm/pg-core";

export const lspRoleEnum = pgEnum("lsp_role", [
  "assessor",
  "lsp_admin",
  "tuk_admin",
]);

export const lsps = pgTable("lsps", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assessors = pgTable("assessors", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  regNoMet: text("reg_no_met"),
  activeSignaturePath: text("active_signature_path"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const lspMemberships = pgTable(
  "lsp_memberships",
  {
    lspId: uuid("lsp_id").notNull(),
    assessorId: uuid("assessor_id").notNull(),
    role: lspRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.lspId, t.assessorId] })],
);

export const schemes = pgTable("schemes", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  manifest: jsonb("manifest").notNull().default({}),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schemeFormManifests = pgTable("scheme_form_manifests", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  schemeId: uuid("scheme_id").notNull(),
  formKey: text("form_key").notNull(),
  filePatterns: text("file_patterns").array().notNull().default([]),
  required: boolean("required").notNull().default(true),
  instrumentRole: text("instrument_role").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  schemeId: uuid("scheme_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  tukName: text("tuk_name"),
  tukType: text("tuk_type"),
  assessmentDate: date("assessment_date"),
  driveFolderUrl: text("drive_folder_url"),
  kelompokSheetUrl: text("kelompok_sheet_url"),
  createdBy: uuid("created_by").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const batchAssessors = pgTable(
  "batch_assessors",
  {
    batchId: uuid("batch_id").notNull(),
    lspId: uuid("lsp_id").notNull(),
    assessorId: uuid("assessor_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.batchId, t.assessorId] })],
);

export const assessees = pgTable("assessees", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  batchId: uuid("batch_id").notNull(),
  assignedAssessorId: uuid("assigned_assessor_id"),
  displayName: text("display_name").notNull(),
  pseudonym: text("pseudonym"),
  nikMasked: text("nik_masked"),
  ktpNameOcr: text("ktp_name_ocr"),
  apl01Name: text("apl01_name"),
  suratTugasName: text("surat_tugas_name"),
  ijazahName: text("ijazah_name"),
  certificateNameConfirmed: text("certificate_name_confirmed"),
  certificateNameConfirmedBy: uuid("certificate_name_confirmed_by"),
  certificateNameConfirmedAt: timestamp("certificate_name_confirmed_at", { withTimezone: true }),
  completenessStatus: text("completeness_status").notNull().default("pending"),
  status: text("status").notNull().default("new"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appConfig = pgTable("app_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: text("scope").notNull(),
  lspId: uuid("lsp_id"),
  schemeId: uuid("scheme_id"),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  lspId: uuid("lsp_id"),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  beforeSummary: jsonb("before_summary"),
  afterSummary: jsonb("after_summary"),
  breakGlassReason: text("break_glass_reason"),
  correlationId: text("correlation_id").notNull(),
  ip: inet("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdBy: uuid("created_by"),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  payload: jsonb("payload").notNull().default({}),
  progress: integer("progress").notNull().default(0),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assessorLlmConfig = pgTable("assessor_llm_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessorId: uuid("assessor_id").notNull(),
  provider: text("provider").notNull(),
  baseUrl: text("base_url"),
  model: text("model").notNull(),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  encryptedGatewayToken: text("encrypted_gateway_token"),
  temperature: numeric("temperature", { precision: 3, scale: 2 }).notNull().default("0.90"),
  maxTokens: integer("max_tokens").notNull().default(51200),
  thinkingBudget: integer("thinking_budget").notNull().default(0),
  googleDriveApiKeyEncrypted: text("google_drive_api_key_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signatures = pgTable("signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  assessorId: uuid("assessor_id").notNull(),
  storagePath: text("storage_path").notNull(),
  sha256: text("sha256").notNull(),
  mimeType: text("mime_type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  supersededBy: uuid("superseded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const driveFiles = pgTable("drive_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  batchId: uuid("batch_id").notNull(),
  assesseeId: uuid("assessee_id"),
  driveFileId: text("drive_file_id").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  drivePath: text("drive_path").notNull().default(""),
  docType: text("doc_type").notNull().default("unknown"),
  classificationConfidence: numeric("classification_confidence", { precision: 5, scale: 4 }).notNull().default("0"),
  triageStatus: text("triage_status").notNull().default("unmatched"),
  triageReason: text("triage_reason"),
  extractedText: text("extracted_text"),
  extractionMethod: text("extraction_method"),
  ocrConfidence: numeric("ocr_confidence", { precision: 5, scale: 4 }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nameJuryVerdicts = pgTable("name_jury_verdicts", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  assesseeId: uuid("assessee_id").notNull(),
  verdict: text("verdict").notNull(),
  proposedCertificateName: text("proposed_certificate_name"),
  reasoning: text("reasoning").notNull(),
  evidence: jsonb("evidence").notNull().default([]),
  ocrConfidence: numeric("ocr_confidence", { precision: 5, scale: 4 }).notNull().default("0"),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  confirmedBy: uuid("confirmed_by"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  overrideReason: text("override_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  batchId: uuid("batch_id").notNull(),
  assesseeId: uuid("assessee_id").notNull(),
  unitCode: text("unit_code").notNull(),
  unitTitle: text("unit_title").notNull(),
  aiRecommendation: text("ai_recommendation"),
  vatmReasoning: text("vatm_reasoning"),
  decision: text("decision"),
  assessorNote: text("assessor_note"),
  decidedBy: uuid("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ditAnalyses = pgTable("dit_analyses", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  batchId: uuid("batch_id").notNull(),
  assesseeId: uuid("assessee_id").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  coverageMatrix: jsonb("coverage_matrix").notNull().default([]),
  gapQuestions: jsonb("gap_questions").notNull().default([]),
  questionBank: jsonb("question_bank").notNull().default([]),
  modelAnswers: jsonb("model_answers").notNull().default([]),
  readiness: jsonb("readiness").notNull().default({}),
  official04b: jsonb("official_04b").notNull().default({}),
  status: text("status").notNull().default("done"),
  rawOutput: jsonb("raw_output"),
  createdBy: uuid("created_by"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const writtenGradings = pgTable("written_gradings", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  batchId: uuid("batch_id").notNull(),
  assesseeId: uuid("assessee_id").notNull(),
  formMapping: jsonb("form_mapping").notNull().default({}),
  itemVerdicts: jsonb("item_verdicts").notNull().default([]),
  errorSummary: jsonb("error_summary").notNull().default([]),
  vatmUnitRecommendations: jsonb("vatm_unit_recommendations").notNull().default([]),
  plagiarismReport: jsonb("plagiarism_report").notNull().default({}),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  confirmedBy: uuid("confirmed_by"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const similarityPairs = pgTable("similarity_pairs", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  batchId: uuid("batch_id").notNull(),
  scope: text("scope").notNull(),
  assesseeAId: uuid("assessee_a_id").notNull(),
  assesseeBId: uuid("assessee_b_id").notNull(),
  jaccardScore: numeric("jaccard_score", { precision: 5, scale: 4 }).notNull().default("0"),
  tfidfCosine: numeric("tfidf_cosine", { precision: 5, scale: 4 }).notNull().default("0"),
  sharedSpans: jsonb("shared_spans").notNull().default([]),
  sharedUniqueErrors: jsonb("shared_unique_errors").notNull().default([]),
  verdict: text("verdict").notNull().default("perlu_ditinjau"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ak05Reports = pgTable("ak05_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  batchId: uuid("batch_id").notNull(),
  assessorId: uuid("assessor_id").notNull(),
  assessorRegNo: text("assessor_reg_no"),
  tukType: text("tuk_type").notNull().default("sewaktu"),
  status: text("status").notNull().default("draft"),
  rows: jsonb("rows").notNull().default([]),
  notesPositiveNegative: text("notes_positive_negative").notNull().default(""),
  notesRejection: text("notes_rejection").notNull().default(""),
  notesImprovement: text("notes_improvement").notNull().default(""),
  signatureId: uuid("signature_id"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  returnedReason: text("returned_reason"),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const interviewAssessments = pgTable("interview_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  batchId: uuid("batch_id").notNull(),
  assesseeId: uuid("assessee_id").notNull(),
  sourceFileId: uuid("source_file_id"),
  questions: jsonb("questions").notNull().default([]),
  overallRecommendation: text("overall_recommendation").notNull(),
  vatmUnitRecommendations: jsonb("vatm_unit_recommendations").notNull().default([]),
  assessorNotes: text("assessor_notes").notNull().default(""),
  assessedBy: uuid("assessed_by"),
  assessedAt: timestamp("assessed_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assesseeDecisionOverrides = pgTable("assessee_decision_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  lspId: uuid("lsp_id").notNull(),
  batchId: uuid("batch_id").notNull(),
  assesseeId: uuid("assessee_id").notNull(),
  overrideDecision: text("override_decision"),
  overrideReason: text("override_reason").notNull().default(""),
  overriddenBy: uuid("overridden_by"),
  overriddenAt: timestamp("overridden_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
