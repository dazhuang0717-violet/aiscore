import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

export const analyzeWithGemini = async (
  content: string, 
  audienceMode: string, 
  projectKeyMessage: string, 
  projectDesc: string,
  mediaName: string = "内部稿件"
): Promise<AIAnalysisResult> => {
  // 从环境变量获取 Key
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("API_KEY 缺失！请确保已在 Netlify 环境变量中设置 API_KEY 并且已在 Site configuration 中禁用 Sensitive variable detection。");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `你是一个专业的肿瘤业务公关传播分析师。请基于以下项目背景和极其严格的评估维度，对提供的文本内容进行评分。

评分规则 (0-10分):
1. 信息匹配 (km_score): 【唯一依据】是评估文本正文内容与[核心信息 (Key Message)]的吻合程度。正文是否准确、完整地传达了核心信息？
2. 获客效能 (acquisition_score): 【唯一依据】是评估文本正文如何转化[项目描述]中定义的获客或业务目标。正文是否具备引导受众采取项目描述中行动的能力？
3. 受众精准度 (audience_precision_score): 【唯一依据】是评估当前[媒体名称]是否能精准触达选定的[受众模式]。该媒体在所选受众群体中的渗透力和调性匹配度如何？

项目背景：
- 媒体名称: ${mediaName}
- 受众模式: ${audienceMode}
- 核心信息 (Key Message): ${projectKeyMessage}
- 项目描述 (获客逻辑): ${projectDesc}

待分析内容：
${content.substring(0, 5000)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            km_score: {
              type: Type.NUMBER,
              description: "信息匹配得分 (0-10)",
            },
            acquisition_score: {
              type: Type.NUMBER,
              description: "获客效能得分 (0-10)",
            },
            audience_precision_score: {
              type: Type.NUMBER,
              description: "受众精准度得分 (0-10)",
            },
            comment: {
              type: Type.STRING,
              description: "专业且简短的评分意见，指出优缺点",
            },
          },
          required: ["km_score", "acquisition_score", "audience_precision_score", "comment"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("AI 返回了空响应");
    
    return JSON.parse(text) as AIAnalysisResult;
  } catch (e: any) {
    console.error("Gemini API Error:", e);
    throw new Error(`分析失败: ${e.message || "未知错误"}`);
  }
};