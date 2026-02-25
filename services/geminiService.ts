import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeWithGemini = async (
  content: string, 
  audienceModes: string[], 
  projectKeyMessage: string, 
  projectDesc: string,
  mediaName: string = "",
  isNewsRelease: boolean = false
): Promise<AIAnalysisResult> => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("Gemini API Key 尚未配置。请确保环境中有 GEMINI_API_KEY。");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  let prompt = `你是一个专业的罗氏肿瘤领域公关传播分析师。请基于以下项目背景进行评分。

评分准则 (1-10分，严禁全部给出相同分数):
1. 信息匹配 (km_score): 评估正文内容与 [核心信息] 的吻合度。
2. 获客效能 (acquisition_score): 【核心要求】仅评估 [项目描述] 中定义的获客效能。获客效能是指为获取每个单个客户而投入的总成本效率，即能否高效地吸引潜在客户并转化为付费消费者。请评估项目通过不同市场策略和渠道吸引潜在客户并将其转化为实际消费者的逻辑潜力。该分数应完全取决于项目本身的获客设计，忽略 [待分析内容] 是否体现了该逻辑。
3. 受众精准度 (audience_precision_score): 【核心要求】主要基于 [媒体名称] 的行业地位和受众属性与 [受众模式] 的匹配度。例如：在 HCP 模式下，医学专业媒体应得高分，而大众生活类媒体应得低分。
4. 媒体分级 (tier_score): 根据 [媒体名称] 的影响力进行分级：
   - 10分：优质社交媒体（如头部大V）、党央媒（如人民日报）、优质垂类媒体（如丁香园）。
   - 8分：较好的门户网站（如腾讯、新浪新闻）和主流媒体。
   - 5分：广泛的大众媒体或区域性媒体。`;

  if (isNewsRelease) {
    prompt += `
5. 目标受众 (target_audience_score): 评估稿件内容是否精准触达并吸引了 [受众模式] 所定义的群体。
6. 可读性 (readability_score): 评估稿件的文字表达是否清晰、专业且易于理解。

【特别注意】对于新闻稿分析，请专注于内容质量、信息传递和受众吸引力，不要评价其具体的获客执行。在返回的简评 (one_sentence_summary) 和详细评价 (comment) 中，请仅聚焦于新闻稿文档本身的内容表现，不要涉及或评价项目描述中的获客策略。`;
  }

  prompt += `

项目背景：
- 媒体名称: ${mediaName || (isNewsRelease ? "待发布新闻稿" : "未知媒体")}
- 受众模式: ${audienceModes.join(", ")}
- 核心信息 (Key Message): ${projectKeyMessage}
- 项目描述 (获客效能): ${projectDesc}

待分析内容：
${content.substring(0, 5000)}`;

  const properties: any = {
    km_score: { type: Type.NUMBER, description: "信息匹配得分 (1-10)" },
    acquisition_score: { type: Type.NUMBER, description: "获客效能得分 (1-10)，评估获取单个客户的投入总成本效率及转化潜力" },
    audience_precision_score: { type: Type.NUMBER, description: "受众精准度得分 (1-10)，依据媒体名称评估" },
    tier_score: { type: Type.NUMBER, description: "媒体分级得分 (5, 8, 或 10)" },
    one_sentence_summary: { type: Type.STRING, description: "简评 (20字以内)" },
    acquisition_comment: { type: Type.STRING, description: "针对获客效能设计的专项简评 (30字以内)" },
    true_demand_comment: { type: Type.STRING, description: "针对真需求（信息匹配+受众精准）的专项简评 (30字以内)" },
    volume_comment: { type: Type.STRING, description: "针对声量（传播质量+媒体分级）的专项简评 (30字以内)" },
    total_score_comment: { type: Type.STRING, description: "针对项目总分的综合简评 (30字以内)" },
    comment: { type: Type.STRING, description: "专业且详细的评分意见" },
  };

  const required = [
    "km_score", 
    "acquisition_score", 
    "audience_precision_score", 
    "tier_score",
    "one_sentence_summary", 
    "acquisition_comment", 
    "true_demand_comment",
    "volume_comment",
    "total_score_comment",
    "comment"
  ];

  if (isNewsRelease) {
    properties.target_audience_score = { type: Type.NUMBER, description: "目标受众得分 (1-10)" };
    properties.readability_score = { type: Type.NUMBER, description: "可读性得分 (1-10)" };
    required.push("target_audience_score", "readability_score");
  }

  let retries = 3;
  let backoffMs = 2000;

  while (retries >= 0) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties,
            required,
          },
        },
      });

      const text = response.text;
      if (!text) throw new Error("AI 返回了空响应");
      return JSON.parse(text) as AIAnalysisResult;
    } catch (e: any) {
      const errorMsg = e.message || "";
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED");
      if (isRateLimit && retries > 0) {
        await delay(backoffMs);
        retries--;
        backoffMs *= 2;
        continue;
      }
      throw e;
    }
  }
  throw new Error("重试耗尽");
};