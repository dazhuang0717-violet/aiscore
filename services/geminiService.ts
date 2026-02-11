import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeWithGemini = async (
  content: string, 
  audienceMode: string, 
  projectKeyMessage: string, 
  projectDesc: string,
  mediaName: string = "内部稿件"
): Promise<AIAnalysisResult> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API_KEY 缺失！请确保已在 Netlify 环境变量中设置 API_KEY。");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `你是一个专业的肿瘤业务公关传播分析师。请基于以下项目背景进行评分。

评分准则 (1-10分，严禁全部给出相同分数):
1. 信息匹配 (km_score): 评估正文内容与 [核心信息] 的吻合度。
2. 获客效能 (acquisition_score): 【核心要求】评估正文是否能够有效引导受众采取 [项目描述] 中提到的具体行动（如：咨询医生、参加义诊、关注公众号等）。
3. 受众精准度 (audience_precision_score): 【核心要求】主要基于 [媒体名称] 的行业地位和受众属性与 [受众模式] 的匹配度。例如：在 HCP 模式下，医学专业媒体应得高分，而大众生活类媒体应得低分。

项目背景：
- 媒体名称: ${mediaName}
- 受众模式: ${audienceMode}
- 核心信息 (Key Message): ${projectKeyMessage}
- 项目描述 (获客逻辑): ${projectDesc}

待分析内容：
${content.substring(0, 5000)}`;

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
            properties: {
              km_score: { type: Type.NUMBER, description: "信息匹配得分 (1-10)" },
              acquisition_score: { type: Type.NUMBER, description: "获客效能得分 (1-10)，依据项目描述评估" },
              audience_precision_score: { type: Type.NUMBER, description: "受众精准度得分 (1-10)，依据媒体名称评估" },
              comment: { type: Type.STRING, description: "专业且简短的评分意见" },
            },
            required: ["km_score", "acquisition_score", "audience_precision_score", "comment"],
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