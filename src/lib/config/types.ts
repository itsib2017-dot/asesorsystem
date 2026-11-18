import type {
  SchemeBrandingConfig,
  SchemeKelompokSpec,
} from "@/repositories/schemes.repository";

export interface FormMapping06 {
  soal: string;
  kunci: string;
  jawaban: string;
}

export interface SimilarityThresholds {
  exact: number;
  near: number;
  partial: number;
  unconfirmed?: boolean;
}

export interface NameJuryThresholds {
  apl01Min: number;
  suratTugasMin: number;
  ijazahMin: number;
}

export interface SchemeManifest {
  code: string;
  name: string;
  fileSet: string[];
  questionBankCount: number;
  decisionRule: "VATM" | string;
  prerequisites: string[];
  requirements: string[];
  units?: Array<{ code: string; title: string }>;
  kelompokPekerjaan?: SchemeKelompokSpec[];
  docColumns?: string[];
  branding?: SchemeBrandingConfig;
}

export interface ConfigMap {
  "form_mapping.06": FormMapping06;
  "question_bank.count": number;
  "similarity.flag_thresholds": SimilarityThresholds;
  "name_jury.thresholds": NameJuryThresholds;
  "identity.ktp_ocr_min_confidence": number;
  "app.name": string;
  "scheme.manifest": SchemeManifest;
}

export type ConfigKey = keyof ConfigMap;

export interface GetConfigOptions {
  scope?: "global" | "lsp" | "scheme";
  lspId?: string;
  schemeId?: string;
}
