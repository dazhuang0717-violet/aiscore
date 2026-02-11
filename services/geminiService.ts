
import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

export const analyzeWithGemini = async (
  content: string, 
  audienceMode: string, 
  projectKeyMessage: string, 
  projectDesc: string,
  mediaName: string = "内部稿件"
): Promise<AIAnalysisResult> => {
  // Fix: Initializing GoogleGenAI client instance with the required named parameter apiKey from environment variables.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `你是一个专业的肿瘤业务公关传播分析师。请基于以下项目背景和评分规则，对提供的文本内容进行深度评估。
  
评分规则 (0-10分):
1. 信息匹配 (km_score): 文本内容与项目核心信息的吻合程度。
2. 获客效能 (acquisition_score): 文本对目标受众产生的行动转化潜力（如扫码、咨询、预约等）。
3. 受众精准度 (audience_precision_score): 文本表达风格、专业深度与目标受众模式的匹配度。

项目背景：
- 媒体名称: ${mediaName}
- 受众模式: ${audienceMode}
- 核心信息 (Key Message): ${projectKeyMessage}
- 项目描述: ${projectDesc}

待分析内容：
${content.substring(0, 5000)}`;

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

  // Fix: Correctly access the text property directly from GenerateContentResponse (not a method).
  const text = response.text;
  if (!text) throw new Error("AI 返回了空响应");
  
  return JSON.parse(text) as AIAnalysisResult;
};
