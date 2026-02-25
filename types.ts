
export interface Tiers {
  tier1: string;
  tier2: string;
  tier3: string;
}

export interface AIAnalysisResult {
  km_score: number;
  acquisition_score: number;
  audience_precision_score: number;
  tier_score?: number;            // AI 判定的媒体分级
  target_audience_score?: number; // 目标受众评分 (仅新闻稿)
  readability_score?: number;     // 可读性评分 (仅新闻稿)
  one_sentence_summary?: string;  // 简评
  acquisition_comment?: string;   // 获客效能专项简评
  true_demand_comment?: string;   // 真需求专项简评
  volume_comment?: string;        // 声量专项简评
  total_score_comment?: string;   // 总分专项简评
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
  简评: string;
  获客效能简评: string;
  真需求简评: string;
  声量简评: string;
  总分简评: string;
}

export enum AudienceMode {
  GENERAL = "大众 (General)",
  PATIENT = "患者 (Patient)",
  HCP = "医疗专业人士 (HCP)"
}