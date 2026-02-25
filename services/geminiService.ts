import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeWithGemini = async (
  content: string, 
  audienceMode: string, 
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
  
  let prompt = `你是一个专业的肿瘤业务公关传播分析师。请基于以下项目背景进行评分。

评分准则 (1-10分，严禁全部给出相同分数):
1. 信息匹配 (km_score): 评估正文内容与 [核心信息] 的吻合度。
2. 获客效能 (acquisition_score): 【核心要求】仅评估 [项目描述] 中定义的获客效能。获客效能是指为获取每个单个客户而投入的总成本效率，包括销售、营销或其他与将潜在客户转化为付费客户相关的活动的所有支出。请评估项目通过不同市场策略和渠道吸引潜在客户并将其转化为实际消费者的逻辑潜力。该分数应完全取决于项目本身的获客设计，忽略 [待分析内容] 是否体现了该逻辑。
3. 受众精准度 (audience_precision_score): 【核心要求】主要基于 [媒体名称] 的行业地位和受众属性与 [受众模式] 的匹配度。例如：在 HCP 模式下，医学专业媒体应得高分，而大众生活类媒体应得低分。`;

  if (isNewsRelease) {
    prompt += `
4. 目标受众 (target_audience_score): 评估稿件内容是否精准触达并吸引了 [受众模式] 所定义的群体。
5. 可读性 (readability_score): 评估稿件的文字表达是否清晰、专业且易于理解。`;
  }

  prompt += `

项目背景：
- 媒体名称: ${mediaName || (isNewsRelease ? "待发布新闻稿" : "未知媒体")}
- 受众模式: ${audienceMode}
- 核心信息 (Key Message): ${projectKeyMessage}
- 项目描述 (获客效能): ${projectDesc}

待分析内容：
${content.substring(0, 5000)}`;

  const properties: any = {
    km_score: { type: Type.NUMBER, description: "信息匹配得分 (1-10)" },
    acquisition_score: { type: Type.NUMBER, description: "获客效能得分 (1-10)，评估获取单个客户的投入总成本效率及转化潜力" },
    audience_precision_score: { type: Type.NUMBER, description: "受众精准度得分 (1-10)，依据媒体名称评估" },
    one_sentence_summary: { type: Type.STRING, description: "一句话简评 (20字以内)" },
    acquisition_comment: { type: Type.STRING, description: "针对获客效能设计的专项简评 (30字以内)" },
    comment: { type: Type.STRING, description: "专业且详细的评分意见" },
  };

  const required = ["km_score", "acquisition_score", "audience_precision_score", "one_sentence_summary", "acquisition_comment", "comment"];

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