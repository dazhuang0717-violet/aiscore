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
- 【特别注意】在没有“新闻稿”作为基准参考时，AI应根据 [待分析内容] 本身是否体现了核心信息的精髓进行判断。媒体报道往往会进行删减或改写，只要其传达了核心意图，就应给予合理的 [核心信息匹配] 分数，不要因为文字不完全一致而给出过低分数。

（2）声量：评估内容的“传播力”和“影响力”。
- 传播质量 (60%)：基于阅读量、点赞、转发、评论等真实数据计算出的质量分（此项由系统预计算，AI需参考整体内容质量给出评价）。
- 媒体分级 (40%)：根据 [媒体名称] 的影响力等级在 1-10 分之间打分：
    - 9-10分：官媒央媒（如人民日报、新华社、央视、人民网、经济日报、光明日报）、优质社交媒体（如头部大V）、优质垂类媒体（如丁香园、医脉通肿瘤、乳腺癌互助）。
    - 7-8分：较好的门户网站（如腾讯、新浪新闻）和主流媒体。
    - 4-6分：广泛的大众媒体或区域性媒体。
    - 1-3分：影响力极低的小众媒体或非正规渠道。

已知媒体参考：
- 医脉通肿瘤、好医生：微信公众号或专业平台，主要针对医疗专业人士 (HCP)，属于 Tier 1 (10分)。
- 乳腺癌互助：微信公众号，主要针对患者 (Patient)，属于 Tier 1 (10分)。

（3）获客效能：由AI分析 [项目描述]，评估其获取每个单个客户而投入的总成本效率。
- 成本考量：低成本、高影响力的创意公益活动（如：张贴海报、患者关爱、低成本社交媒体运营、Pitch 媒体）由于投入成本极低且对患者影响深远，在 [获客效能] 和 [真需求] 上具有绝对优势，应大胆给予极高分（9-10 分）。
- 转化潜力：评估项目通过不同市场策略和渠道吸引潜在客户并将其转化为实际消费者的逻辑潜力。该分数应完全取决于项目本身的获客设计。
- 【特别注意】纯粹购买媒体的项目（如：医保落地宣传、纯硬广投放、传统大型展会）：虽然声量巨大，但由于投入成本极高、受众泛化且单客获取成本极高，其 [获客效能] 得分必须保持在较低水平（通常 2-4 分），除非项目描述中明确展示了极其高效的数字转化闭环。

（4）受众精准度：对于媒体报道，受众精准度应主要依据 [媒体名称]（账号名称）进行判断。
- 社交媒体（如微博、小红书、抖音等）由于其算法推荐和圈层属性，受众精准度通常偏高。
- 垂类媒体（如丁香园、医脉通）针对专业人群，精准度极高。
- 大众门户网站精准度相对较低。

（5）项目类型评分参考（必须拉开差距，严禁平庸化）：
- 旗舰级创意公益项目（如：Run for Her、海报张贴活动）：这是标杆项目，[真需求]、[声量]、[获客效能] 全都应给极高分（9.5-10分）。其传播质量和获客效能应被视为行业顶尖水平。
- 创意/公益宣教类项目（如：从容生活、患者关爱）：[真需求] 和 [获客效能] 应给极高分（9-10分），[声量] 给予合理的高分（7-8分）。
- 纯媒体购买/政策落地类（如：高罗华医保落地、进博会 CIIE）：[声量] 和 [媒体分级] 给高分（8-10分），但 [获客效能] 必须严格控制在低分（2-4分），因为其投入产出比（ROI）在获客层面通常较低。
- 【核心原则】请在评分时极其果断且慷慨。低成本、高影响力的项目必须给 9.5-10 分，高投入、纯买量项目必须在获客效能上给低分。
`;

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
    one_sentence_summary: { type: Type.STRING, description: "简评 (150字左右)，包含优点、缺点及建议，用分号分隔，不使用'优点：'等字样。" },
    acquisition_comment: { type: Type.STRING, description: "获客效能简评 (150字左右)，包含优点、缺点及建议，用分号分隔。" },
    true_demand_comment: { type: Type.STRING, description: "真需求简评 (150字左右)，包含优点、缺点及建议，用分号分隔。" },
    volume_comment: { type: Type.STRING, description: "声量简评 (150字左右)，包含优点、缺点及建议，用分号分隔。" },
    total_score_comment: { type: Type.STRING, description: "总分简评 (150字左右)，包含优点、缺点及建议，用分号分隔。" },
    comment: { type: Type.STRING, description: "详细评价 (200字以上)，包含优点、缺点及建议。" },
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

  let retries = 5; // 增加重试次数
  let backoffMs = 3000; // 增加初始等待时间

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
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Quota exceeded");
      
      if (isRateLimit && retries > 0) {
        console.log(`命中频率限制，正在进行第 ${6 - retries} 次重试，等待 ${backoffMs}ms...`);
        await delay(backoffMs);
        retries--;
        backoffMs *= 2; // 指数退避
        continue;
      }
      
      // 如果是其他错误（如 500），也尝试重试一次
      if (retries > 0 && (errorMsg.includes("500") || errorMsg.includes("503"))) {
        await delay(1000);
        retries--;
        continue;
      }

      throw e;
    }
  }
  throw new Error("重试耗尽");
};

export interface BatchAnalysisInput {
  content: string;
  mediaName: string;
}

export const analyzeBatchWithGemini = async (
  items: BatchAnalysisInput[],
  audienceModes: string[],
  projectKeyMessage: string, 
  projectDesc: string
): Promise<AIAnalysisResult[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("Gemini API Key 尚未配置。");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const itemsPrompt = items.map((item, index) => `
--- 待分析项 #${index + 1} ---
媒体名称: ${item.mediaName}
内容: ${item.content.substring(0, 2000)}
`).join("\n");

  const prompt = `你是一个专业的罗氏肿瘤领域公关传播分析师。
请对以下 ${items.length} 个传播项进行批量评分。

项目背景：
- 受众模式: ${audienceModes.join(", ")}
- 核心信息 (Key Message): ${projectKeyMessage}
- 项目描述 (获客效能): ${projectDesc}

评分规则：
总分 (100%) = 50% × 真需求 + 30% × 声量 + 20% × 获客效能

（1）真需求：评估内容是否“说对了话”且“找对了人”。
- 核心信息匹配 (60%)：由AI评估文章内容与您设定的 [核心信息 (Key Message)] 的契合度。
- 受众精准度 (40%)：由AI根据 [媒体名称] 和 [受众模式]，判断内容是否精准触达目标人群（大众/患者/HCP）。
- 【特别注意】媒体报道往往会进行删减或改写，只要其传达了核心意图，就应给予合理的 [核心信息匹配] 分数，不要因为文字不完全一致而给出过低分数。

（2）声量：评估内容的“传播力”和“影响力”。
- 传播质量 (60%)：基于内容质量给出评价。
- 媒体分级 (40%)：根据 [媒体名称] 的影响力等级在 1-10 分之间打分：
    - 9-10分：官媒央媒、优质社交媒体、优质垂类媒体。
    - 7-8分：较好的门户网站和主流媒体。
    - 4-6分：广泛的大众媒体或区域性媒体。
    - 1-3分：影响力极低的小众媒体或非正规渠道。

（3）获客效能：由AI分析 [项目描述]，评估其获取每个单个客户而投入的总成本效率。
- 成本考量：创意公益项目、低成本社交媒体运营、Pitch 媒体由于投入成本极低，在获客效能上具有绝对优势（应大胆给予 8-10 分）。
- 场景与行为改变：评估项目是否成功进入医药场景，是否能有效引导目标患者和医生专家发生行为和观念的改变。
- 【特别注意】传统大型展会（如进博会 CIIE）其“获客效能”得分必须保持在极低水平（通常 2-4 分），除非有明确的高效转化闭环。

（4）项目类型评分参考（必须拉开差距，严禁平庸化）：
- 旗舰级创意公益项目（如：Run for Her、低成本海报活动）：标杆项目，[真需求]、[声量]、[获客效能] 全都应给极高分（9.5-10分）。
- 创意/公益宣教类项目（如：从容生活、患者关爱）：[真需求] 和 [获客效能] 应给极高分（9.2-10分），[声量] 给予 7-8 分。
- 纯媒体购买/政策落地类（如：高罗华医保落地、进博会 CIIE）：[声量] 高（8-10分），但 [获客效能] 必须给低分（2-4分）。
- 【重要】请在评分时极其果断且慷慨。低成本高影响力的项目必须给 9.5-10 分，高投入纯买量项目在获客效能上给低分。

${itemsPrompt}

评分规则与输出要求：
请为每个待分析项返回一个 JSON 对象，结果必须是一个包含 ${items.length} 个对象的数组。
每个对象必须包含以下字段：
1. km_score (1-10): 信息匹配得分
2. acquisition_score (1-10): 获客效能得分
3. audience_precision_score (1-10): 受众精准度得分
4. tier_score (1-10): 媒体分级得分
5. media_category: '网站', 'APP', '微信', '社交媒体' 之一
6. one_sentence_summary: 简评 (150字左右，含优缺点及建议)
7. acquisition_comment: 获客效能简评 (150字左右)
8. true_demand_comment: 真需求简评 (150字左右)
9. volume_comment: 声量简评 (150字左右)
10. total_score_comment: 总分简评 (150字左右)
11. comment: 详细评价 (200字以上)`;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        km_score: { type: Type.NUMBER, description: "信息匹配得分 (1-10)" },
        acquisition_score: { type: Type.NUMBER, description: "获客效能得分 (1-10)" },
        audience_precision_score: { type: Type.NUMBER, description: "受众精准度得分 (1-10)" },
        tier_score: { type: Type.NUMBER, description: "媒体分级得分 (1-10)" },
        media_category: { type: Type.STRING, description: "媒体类型" },
        one_sentence_summary: { type: Type.STRING, description: "简评 (150字左右)" },
        acquisition_comment: { type: Type.STRING, description: "获客效能简评 (150字左右)" },
        true_demand_comment: { type: Type.STRING, description: "真需求简评 (150字左右)" },
        volume_comment: { type: Type.STRING, description: "声量简评 (150字左右)" },
        total_score_comment: { type: Type.STRING, description: "总分简评 (150字左右)" },
        comment: { type: Type.STRING, description: "详细评价 (200字以上)" }
      },
      required: [
        "km_score", "acquisition_score", "audience_precision_score", "tier_score",
        "media_category", "one_sentence_summary", "acquisition_comment",
        "true_demand_comment", "volume_comment", "total_score_comment", "comment"
      ]
    }
  };

  let retries = 3;
  let backoffMs = 2000;

  while (retries >= 0) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema
        }
      });

      const text = response.text;
      if (!text) throw new Error("AI 返回了空响应");
      const results = JSON.parse(text);
      
      // 补全可能缺失的字段
      return results.map((r: any) => ({
        ...r,
        acquisition_comment: r.acquisition_comment || r.one_sentence_summary || "待评估",
        true_demand_comment: r.true_demand_comment || r.one_sentence_summary || "待评估",
        volume_comment: r.volume_comment || r.one_sentence_summary || "待评估",
        total_score_comment: r.total_score_comment || r.one_sentence_summary || "待评估",
      }));
    } catch (e: any) {
      if (retries > 0) {
        await delay(backoffMs);
        retries--;
        backoffMs *= 2;
        continue;
      }
      throw e;
    }
  }
  throw new Error("批量分析重试耗尽");
};
