import { GoogleGenAI, Type } from "@google/genai";
import { AIAnalysisResult } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const analyzeWithGemini = async (
  content: string, 
  audienceModes: string[], 
  projectDesc: string,
  mediaName: string = "",
  isNewsRelease: boolean = false,
  supplementaryMaterials: string = "",
  selectedProducts: string[] = []
): Promise<AIAnalysisResult> => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("Gemini API Key 尚未配置。请确保环境中有 GEMINI_API_KEY。");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const productNeeds: Record<string, string[]> = {
    "Phesgo": ["治愈与新生", "去病患标签", "时间与陪伴"],
    "Itovebi": ["耐受与保障", "生存与底线"],
    "Alecensa": ["治愈与新生", "去病患标签", "耐受与保障", "生存与底线"],
    "Polivy": ["治愈与新生", "生存与底线"],
    "Glofitamab": ["耐受与保障", "生存与底线"],
    "Gazyva": ["耐受与保障", "生存与底线"],
    "T+A": ["耐受与保障", "生存与底线"]
  };

  let productContext = "";
  if (selectedProducts.length > 0) {
    productContext = `本次分析的核心产品为：${selectedProducts.join(", ")}。\n`;
    productContext += `对于这些产品，请**仅关注**以下对应的患者真需求维度，忽略其他维度：\n`;
    selectedProducts.forEach(p => {
      if (productNeeds[p]) {
        productContext += `- ${p}: ${productNeeds[p].join(", ")}\n`;
      }
    });
  }

  let prompt = `你是一个专业的罗氏肿瘤领域公关传播分析师。请基于以下项目背景进行评分。
你的目标是评估项目的“信息匹配”（Information Matching）。

${productContext}

评分维度定义：
1. 真需求 (50%)：评估内容是否“说对了话”且“找对了人”。
   - 信息匹配 (60%)：项目传递信息能否使目标受众共鸣并感到明确获益。
     * 重点参考“患者真需求”框架（请根据上述核心产品要求进行客制化理解）：
       - 治愈与新生 (自我实现): 实现治愈，重启人生规划与希望。
       - 去病患标签 (尊重需求): 隐形治疗，重塑社会身份与尊严。
       - 时间与陪伴 (爱与归属): 时空释放，把时间还给家庭和生活。
       - 耐受与保障 (安全需求): 毒副管理与可支付性，消除身心失控感。
       - 生存与底线 (生理需求): 遏制进展与复发，打破耐药绝境。
     * 评分参考：Run for Her、医保落地等项目应得极高分（9.5-10分）；信息点过于分散或泛化的项目（如某些乳腺癌进博会报道）应得低分。得分需拉开差距。对于 Run for Her，其真需求分数必须在 9.8 以上。
   - 受众精准 (40%)：
     * 场景触达：日间诊室张贴海报（100%触达） > 药房。
     * 平台机制：小红书推流机制对目标患者的触达通常比线下活动更精准。
     * 垂类媒体（丁香园、医脉通）对HCP精准度极高。

2. 声量 (30%)：评估内容的“传播力”和“影响力”。
   - 传播质量 (60%)：基于真实数据或内容质量。
   - 媒体分级 (40%)：官媒央媒/优质大V/优质垂类为 Tier 1 (9-10分)。

3. 获客效能 (20%)：计算获取每个新客户需投入的成本，得出项目能否高效吸引并转化潜在客户。
   - 低成本高影响力项目（海报、患者关爱、低成本社媒、Pitch媒体、Run for Her、年轮项目等）应给极高分（9-10分）。
   - 特别注意：年轮项目是利用已有展会而非自行举办，海报发放进入医院场景且成本极低，均属于极高获客效能。
   - 纯买量或高成本项目（硬广、传统大型展会如进博会/CIIE、医保落地等）应给低分（2-4分），除非有高效转化闭环。进博会和医保落地这种高成本、低精准触达的项目，获客效能应在 3.5 分以下。
   - 注意：针对新闻稿评分，此维度不计入最终考量，但仍需返回一个占位分数。

4. 可读性 (额外维度)：评估内容的易读性、逻辑性及吸引力。
   - 针对新闻稿，评估其是否通俗易懂，逻辑是否清晰，是否能吸引目标受众阅读。
   - 对于 Run for Her 相关稿件，其真需求分数应显著高于其他常规项目。

【评价要求】
- 整体评价：${isNewsRelease ? "关注新闻稿件内容本身，评估其信息传递的准确性、吸引力和对受众的价值，不要评价整体项目。" : "从项目整体去评价，不要聚焦到某一个媒体，不要提到具体报纸或媒体的名字。"}
- 社交媒体认定：H5 互动形式（如年轮项目）本身属于社交媒体传播范畴，应被归类为'社交媒体'，并认可其在社交平台上的互动价值。
- Run for Her 专项：该项目具有极强的社交属性，核心形式为小红书短视频发布及短视频颁奖典礼。在评估声量时，必须认可其社交互动价值和短视频传播的爆发力，声量简评应体现其社交属性。
- 合规建议：严禁提出“导流”或任何违反医药合规的建议。请代之以“加强患者教育”、“提升学术深度”、“优化渠道选择”等专业建议。
- 真实可信：不要使用“分数定位到中等区间”等表述。评价应专业、犀利、有洞察力。
- 核心信息归纳：请通过阅读新闻稿，归纳出一句核心信息（15-30字）。
- 简评格式要求：简评（one_sentence_summary）以及各维度的简评（如获客效能简评、真需求简评、总分简评等）均必须包含该传播项的“优点”、“缺点”及“改进建议”，字数控制在150字左右。

项目背景：
- 媒体名称: ${mediaName || (isNewsRelease ? "待发布新闻稿" : "未知媒体")}
- 受众模式: ${audienceModes.join(", ")}
- 项目描述: ${projectDesc}
- 补充材料 (发言稿/采访提纲等): ${supplementaryMaterials || "无"}

待分析内容：
${content.substring(0, 5000)}`;

  const properties: any = {
    km_score: { type: Type.NUMBER, description: "信息匹配得分" },
    acquisition_score: { type: Type.NUMBER, description: "获客效能得分" },
    audience_precision_score: { type: Type.NUMBER, description: "受众精准得分" },
    readability_score: { type: Type.NUMBER, description: "可读性得分" },
    tier_score: { type: Type.NUMBER, description: "媒体分级得分" },
    media_category: { type: Type.STRING, description: "媒体类型 ('网站', 'APP', '微信', '社交媒体')" },
    extracted_core_info: { type: Type.STRING, description: "从稿件中归纳出的核心信息 (一句)" },
    one_sentence_summary: { type: Type.STRING, description: "简评 (150字左右)，必须包含优点、缺点及建议，不提具体媒体名，不提导流" },
    acquisition_comment: { type: Type.STRING, description: "获客效能简评" },
    true_demand_comment: { type: Type.STRING, description: "真需求简评" },
    volume_comment: { type: Type.STRING, description: "声量简评" },
    total_score_comment: { type: Type.STRING, description: "总分简评，必须包含优点、缺点及建议" },
    comment: { type: Type.STRING, description: "详细评价 (200字以上)" },
  };

  const required = [
    "km_score", "acquisition_score", "audience_precision_score", "readability_score", "tier_score",
    "media_category", "extracted_core_info", "one_sentence_summary", 
    "acquisition_comment", "true_demand_comment", "volume_comment",
    "total_score_comment", "comment"
  ];

  if (isNewsRelease) {
    // 新闻稿评分去掉目标受众和可读性
  }

  let retries = 5;
  let backoffMs = 3000;

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
        backoffMs *= 2;
        continue;
      }
      
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
  projectDesc: string,
  supplementaryMaterials: string = "",
  selectedProducts: string[] = []
): Promise<AIAnalysisResult[]> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("Gemini API Key 尚未配置。");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const productNeeds: Record<string, string[]> = {
    "Phesgo": ["治愈与新生", "去病患标签", "时间与陪伴"],
    "Itovebi": ["耐受与保障", "生存与底线"],
    "Alecensa": ["治愈与新生", "去病患标签", "耐受与保障", "生存与底线"],
    "Polivy": ["治愈与新生", "生存与底线"],
    "Glofitamab": ["耐受与保障", "生存与底线"],
    "Gazyva": ["耐受与保障", "生存与底线"],
    "T+A": ["耐受与保障", "生存与底线"]
  };

  let productContext = "";
  if (selectedProducts.length > 0) {
    productContext = `本次分析的核心产品为：${selectedProducts.join(", ")}。\n`;
    productContext += `对于这些产品，请**仅关注**以下对应的患者真需求维度，忽略其他维度：\n`;
    selectedProducts.forEach(p => {
      if (productNeeds[p]) {
        productContext += `- ${p}: ${productNeeds[p].join(", ")}\n`;
      }
    });
  }

  const itemsPrompt = items.map((item, index) => `
--- 待分析项 #${index + 1} ---
媒体名称: ${item.mediaName}
内容: ${item.content.substring(0, 2000)}
`).join("\n");

  const prompt = `你是一个专业的罗氏肿瘤领域公关传播分析师。
请对以下 ${items.length} 个传播项进行批量评分。
你的目标是评估项目的“信息匹配”（Information Matching）。

${productContext}

项目背景：
- 受众模式: ${audienceModes.join(", ")}
- 项目描述: ${projectDesc}
- 补充材料 (发言稿/采访提纲等): ${supplementaryMaterials || "无"}

评分维度定义：
1. 真需求 (50%)：评估内容是否“说对了话”且“找对了人”。
   - 信息匹配 (60%)：评估内容是否触达患者的核心痛点及马斯洛需求层次。
     * 重点参考“患者真需求”框架（请根据上述核心产品要求进行客制化理解）：
       - 治愈与新生 (自我实现): 实现治愈，重启人生规划与希望。
       - 去病患标签 (尊重需求): 隐形治疗，重塑社会身份与尊严。
       - 时间与陪伴 (爱与归属): 时空释放，把时间还给家庭和生活。
       - 耐受与保障 (安全需求): 毒副管理与可支付性，消除身心失控感。
       - 生存与底线 (生理需求): 遏制进展与复发，打破耐药绝境。
     * 评分标准：
       - 10分：精准匹配上述产品核心主张，且深度触达对应的患者心声（如“想回家陪家人”、“不想被当作废人”等）。对于 Run for Her，其真需求分数必须在 9.8 以上。
       - 7-8分：触达了患者需求，但主张不够鲜明或仅停留在生存层面。
       - 4-6分：仅提及疗效，未触达情感或更高层次需求。
       - 1-3分：信息错位，或完全未体现患者获益。
   - 受众精准 (40%)：
     * 场景触达：日间诊室张贴海报（100%触达） > 药房。
     * 平台机制：小红书推流机制对目标患者的触达通常比线下活动更精准。

2. 声量 (30%)：评估内容的“传播力”和“影响力”。
   - 传播质量 (60%)：基于内容质量。
   - 媒体分级 (40%)：官媒央媒/优质大V/优质垂类为 Tier 1 (9-10分)。

3. 获客效能 (20%)：计算获取每个新客户需投入的成本，得出项目能否高效吸引并转化潜在客户。
   - 低成本高影响力项目（如 Run for Her、年轮项目、海报宣教等）应给极高分（9-10分）。
   - 特别注意：年轮项目是利用已有展会而非自行举办，海报发放进入医院场景且成本极低，均属于极高获客效能。
   - 纯买量或高成本项目（如进博会、CIIE、硬广、医保落地等）应给低分（2-4分）。进博会和医保落地这种高成本项目，获客效能应在 3.5 分以下。

【评价要求】
- 整体评价：从项目整体去评价，不要聚焦到某一个媒体，不要提到具体报纸或媒体的名字。
- 社交媒体认定：H5 互动形式（如年轮项目）本身属于社交媒体传播范畴，应被归类为'社交媒体'，并认可其在社交平台上的互动价值。
- Run for Her 专项：该项目具有极强的社交属性，核心形式为小红书短视频发布及短视频颁奖典礼。在评估声量时，必须认可其社交互动价值和短视频传播的爆发力，声量简评应体现其社交属性。
- 合规建议：严禁提出“导流”或任何违反医药合规的建议。请代之以“加强患者教育”、“提升学术深度”、“优化渠道选择”等专业建议。
- 真实可信：不要使用“分数定位到中等区间”等表述。评价应专业、犀利、有洞察力。
- 核心信息归纳：请通过阅读新闻稿，归纳出一句核心信息（15-30字）。
- 简评格式要求：每个传播项的简评（one_sentence_summary）以及各维度的简评（如获客效能简评、真需求简评、总分简评等）均必须包含“优点”、“缺点”及“改进建议”，字数控制在150字左右。

${itemsPrompt}

评分规则与输出要求：
请为每个待分析项返回一个 JSON 对象，结果必须是一个包含 ${items.length} 个对象的数组。
每个对象必须包含以下字段：
1. km_score: 信息匹配得分
2. acquisition_score: 获客效能得分
3. audience_precision_score: 受众精准得分
4. tier_score: 媒体分级得分
5. media_category: '网站', 'APP', '微信', '社交媒体' 之一
6. extracted_core_info: 从稿件中归纳出的核心信息 (一句)
7. one_sentence_summary: 简评 (150字左右，必须包含优点、缺点及建议，不提具体媒体名，不提导流)
8. acquisition_comment: 获客效能简评
9. true_demand_comment: 真需求简评
10. volume_comment: 声量简评
11. total_score_comment: 总分简评 (150字左右，必须包含优点、缺点及建议)
12. comment: 详细评价 (200字以上)`;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        km_score: { type: Type.NUMBER, description: "信息匹配得分" },
        acquisition_score: { type: Type.NUMBER, description: "获客效能得分" },
        audience_precision_score: { type: Type.NUMBER, description: "受众精准得分" },
        tier_score: { type: Type.NUMBER, description: "媒体分级得分" },
        media_category: { type: Type.STRING, description: "媒体类型" },
        extracted_core_info: { type: Type.STRING, description: "归纳出的核心信息" },
        one_sentence_summary: { type: Type.STRING, description: "简评 (150字左右)，必须包含优点、缺点及建议" },
        acquisition_comment: { type: Type.STRING, description: "获客效能简评 (150字左右)" },
        true_demand_comment: { type: Type.STRING, description: "真需求简评 (150字左右)" },
        volume_comment: { type: Type.STRING, description: "声量简评 (150字左右)" },
        total_score_comment: { type: Type.STRING, description: "总分简评 (150字左右)，必须包含优点、缺点及建议" },
        comment: { type: Type.STRING, description: "详细评价 (200字以上)" }
      },
      required: [
        "km_score", "acquisition_score", "audience_precision_score", "tier_score",
        "media_category", "extracted_core_info", "one_sentence_summary", "acquisition_comment",
        "true_demand_comment", "volume_comment", "total_score_comment", "comment"
      ]
    }
  };

  let retries = 5;
  let backoffMs = 3000;

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
      
      return results.map((r: any) => ({
        ...r,
        acquisition_comment: r.acquisition_comment || r.one_sentence_summary || "待评估",
        true_demand_comment: r.true_demand_comment || r.one_sentence_summary || "待评估",
        volume_comment: r.volume_comment || r.one_sentence_summary || "待评估",
        total_score_comment: r.total_score_comment || r.one_sentence_summary || "待评估",
      }));
    } catch (e: any) {
      const errorMsg = e.message || "";
      const isRateLimit = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Quota exceeded");
      
      if (isRateLimit && retries > 0) {
        console.log(`批量分析命中频率限制，正在进行第 ${6 - retries} 次重试，等待 ${backoffMs}ms...`);
        await delay(backoffMs);
        retries--;
        backoffMs *= 2;
        continue;
      }

      if (retries > 0 && (errorMsg.includes("500") || errorMsg.includes("503"))) {
        await delay(1000);
        retries--;
        continue;
      }

      throw e;
    }
  }
  throw new Error("批量分析重试耗尽");
};
