
export interface Tiers {
  tier1: string;
  tier2: string;
  tier3: string;
}

export interface AIAnalysisResult {
  km_score: number;
  acquisition_score: number;
  audience_precision_score: number;
  comment: string;
}

export interface WordResult extends AIAnalysisResult {
  textLen: number;
}

export interface BatchResult {
  标题: string;
  媒体名称: string;
  项目总分: string;
  真需求: string;
  获客效能: number;
  声量: string;
  核心信息匹配: number;
  受众精准度: number;
  媒体分级: number;
  传播质量: number;
  评价: string;
}

export enum AudienceMode {
  GENERAL = "大众 (General)",
  PATIENT = "患者 (Patient)",
  HCP = "医疗专业人士 (HCP)"
}