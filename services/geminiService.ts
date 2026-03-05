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

评分规则：
总分 (100%) = 50% × 真需求 + 30% × 声量 + 20% × 获客效能

（1）真需求：评估内容是否“说对了话”且“找对了人”。
- 核心信息匹配 (60%)：由AI评估文章内容与您设定的 [核心信息 (Key Message)] 的契合度。
- 受众精准度 (40%)：由AI根据 [媒体名称] 和 [受众模式]，判断内容是否精准触达目标人群（大众/患者/HCP）。

（2）声量：评估内容的“传播力”和“影响力”。
- 传播质量 (60%)：基于阅读量、点赞、转发、评论等真实数据计算出的质量分（此项由系统预计算，AI需参考整体内容质量给出评价）。
- 媒体分级 (40%)：根据 [媒体名称] 的影响力等级在 1-10 分之间打分：
    - 9-10分：优质社交媒体（如头部大V）、党央媒（如人民日报）、优质垂类媒体（如丁香园、医脉通肿瘤、乳腺癌互助）。
    - 7-8分：较好的门户网站（如腾讯、新浪新闻）和主流媒体。
    - 4-6分：广泛的大众媒体或区域性媒体。
    - 1-3分：影响力极低的小众媒体或非正规渠道。

已知媒体参考：
- 医脉通肿瘤、好医生：微信公众号或专业平台，主要针对医疗专业人士 (HCP)，属于 Tier 1 (10分)。
- 乳腺癌互助：微信公众号，主要针对患者 (Patient)，属于 Tier 1 (10分)。

（3）获客效能：由AI分析 [项目描述]，评估其获取每个单个客户而投入的总成本效率，即能否高效地吸引潜在客户并转化为付费消费者。请评估项目通过不同市场策略和渠道吸引潜在客户并将其转化为实际消费者的逻辑潜力。该分数应完全取决于项目本身的获客设计。`;

  if (isNewsRelease) {
    prompt += `
5. 目标受众 (target_audience_score): 评估稿件内容是否精准触达并吸引了 [受众模式] 所定义的群体。
6. 可读性 (readability_score): 评估稿件的文字表达是否清晰、专业且易于理解。

【特别注意】对于新闻稿分析，请专注于内容质量、信息传递和受众吸引力，不要评价其具体的获客执行。在返回的简评 (one_sentence_summary) 和详细评价 (comment) 中，请仅聚焦于新闻稿文档本身的内容表现，不要涉及或评价项目描述中的获客策略。`;
  }

  prompt += `

- 媒体类型判定逻辑：
    - 微信：仅指微信公众号文章。
    - 社交媒体：仅指微博、小红书、抖音、知乎等平台的个人或官方账号发布的内容。
    - 网站：传统媒体的官网（如南方网、人民网、环球网）、门户网站（如腾讯网）、新闻聚合平台网页版（如今日头条网页版、百度百家号网页版）。
    - APP：传统媒体或门户网站的官方客户端（如南方+、人民日报APP、今日头条APP、腾讯新闻客户端）。

【重要原则】
1. 严禁拼凑数据：如果某项指标（如阅读量、互动量）缺失，请保持客观评价，不要为了凑数而编造数据。
2. 类别真实性：如果没有社交媒体数据，不要强行归类到社交媒体。如果媒体类型不属于上述四类，请归类为“网站”或根据实际情况判定，不要为了填满分类而拼凑。

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
    tier_score: { type: Type.NUMBER, description: "媒体分级得分 (1-10)" },
    media_category: { type: Type.STRING, description: "媒体类型，必须从以下选项中选择：'网站', 'APP', '微信', '社交媒体'。注意：'社交媒体'仅指微博、小红书、抖音等平台账号；传统媒体官网、门户网站或新闻聚合平台（如今日头条、百家号）应归类为'网站'或'APP'。" },
    one_sentence_summary: { type: Type.STRING, description: "简评 (100字以内)，必须包含该内容的优点和缺点，不要使用'优点：'或'缺点：'字样，直接描述内容并用分号分隔。" },
    acquisition_comment: { type: Type.STRING, description: "针对获客效能设计的专项简评 (100字以内)，需包含优缺点，不使用'优点：'或'缺点：'字样，直接描述并用分号分隔。" },
    true_demand_comment: { type: Type.STRING, description: "针对真需求（信息匹配+受众精准）的专项简评 (100字以内)，需包含优缺点，不使用'优点：'或'缺点：'字样，直接描述并用分号分隔。" },
    volume_comment: { type: Type.STRING, description: "针对声量（传播质量+媒体分级）的专项简评 (100字以内)，需包含优缺点，不使用'优点：'或'缺点：'字样，直接描述并用分号分隔。" },
    total_score_comment: { type: Type.STRING, description: "针对项目总分的综合简评 (100字以内)，需包含优缺点，不使用'优点：'或'缺点：'字样，直接描述并用分号分隔。" },
    comment: { type: Type.STRING, description: "专业且详细的评分意见，必须包含该内容的优点和缺点，不要使用'优点：'或'缺点：'字样。" },
  };

  const required = [
    "km_score", 
    "acquisition_score", 
    "audience_precision_score", 
    "tier_score",
    "media_category",
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