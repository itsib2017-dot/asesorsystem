export interface FormMapping06 {
  soal: string;
  kunci: string;
  jawaban: string;
}

export interface SimilarityThresholds {
  exact: number;
  near: number;
  partial: number;
}

export interface SchemeManifest {
  code: string;
  name: string;
  fileSet: string[];
  questionBankCount: number;
  decisionRule: "VATM" | string;
  prerequisites: string[];
  requirements: string[];
}

export interface ConfigMap {
  "form_mapping.06": FormMapping06;
  "question_bank.count": number;
  "similarity.flag_thresholds": SimilarityThresholds;
  "app.name": string;
  "scheme.manifest": SchemeManifest;
}

export type ConfigKey = keyof ConfigMap;

export interface GetConfigOptions {
  scope?: "global" | "lsp" | "scheme";
  lspId?: string;
  schemeId?: string;
}
