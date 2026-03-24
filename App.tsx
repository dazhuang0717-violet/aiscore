import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { analyzeWithGemini, analyzeBatchWithGemini, BatchAnalysisInput } from './services/geminiService';
import { Tiers, WordResult, BatchResult, AudienceMode, AIAnalysisResult } from './types';

declare global {
  interface Window {
    mammoth: any;
    XLSX: any;
    Plotly: any;
    html2pdf: any;
  }
}

type SortConfig = {
  key: keyof BatchResult;
  direction: 'asc' | 'desc';
} | null;

const PatientDemandFramework = () => {
  const products = [
    { name: "Phesgo (无线人生)", slogan: "更少时间做病人，更多时间做自己", levels: ["治愈与新生", "去病患标签", "时间与陪伴"], color: "bg-orange-50 border-orange-200 text-orange-800" },
    { name: "Itovebi (无限人生)", slogan: "抗击复发耐药的焦虑感", levels: ["耐受与保障", "生存与底线"], color: "bg-green-50 border-green-200 text-green-800" },
    { name: "Alecensa (从从容容)", slogan: "活得久，活得好；从从容容", levels: ["治愈与新生", "去病患标签", "耐受与保障", "生存与底线"], color: "bg-red-50 border-red-200 text-red-800" },
    { name: "Polivy (一线即治愈)", slogan: "一线即治愈，治疗少走弯路", levels: ["治愈与新生", "生存与底线"], color: "bg-blue-50 border-blue-200 text-blue-800" },
    { name: "Glofitamab (超越治愈)", slogan: "即诊即用，重获新生", levels: ["耐受与保障", "生存与底线"], color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
    { name: "Gazyva (超长无进展)", slogan: "超长无进展生存期，缓解复发焦虑", levels: ["耐受与保障", "生存与底线"], color: "bg-red-50 border-red-200 text-red-800" },
    { name: "T+A (无癌生存)", slogan: "重建生存安全感", levels: ["耐受与保障", "生存与底线"], color: "bg-purple-50 border-purple-200 text-purple-800" },
  ];

  const maslow = [
    { level: "治愈与新生", desc: "实现治愈\n重启人生规划与希望", color: "bg-[#FF6D00]" },
    { level: "去病患标签", desc: "隐形治疗\n重塑社会身份与尊严", color: "bg-[#2E7D32]" },
    { level: "时间与陪伴", desc: "时空释放\n把时间还给家庭和生活", color: "bg-[#0277BD]" },
    { level: "耐受与保障", desc: "毒副管理与可支付性\n消除身心失控感", color: "bg-[#8E24AA]" },
    { level: "生存与底线", desc: "遏制进展与复发\n打破耐药绝境", color: "bg-[#43A047]" },
  ];

  return (
    <div className="mt-12 border-t pt-10">
      <h4 className="text-center font-bold text-lg mb-8 flex items-center justify-center gap-2">
        <span className="text-2xl">🎯</span> 患者真需求分析框架
      </h4>
      <div className="flex flex-col xl:flex-row gap-10 items-stretch">
        {/* Maslow Pyramid */}
        <div className="w-full xl:w-7/12 flex flex-col items-center space-y-2">
          <p className="text-[10px] font-bold text-gray-400 mb-4 uppercase tracking-widest text-center w-full">患者真需求映射</p>
          {maslow.map((m, i) => (
            <div 
              key={i} 
              className={`${m.color} text-white p-4 rounded-xl shadow-sm flex items-center gap-6 transform transition-all hover:scale-[1.02] hover:shadow-md`} 
              style={{ 
                width: `${50 + i * 12.5}%`,
                minHeight: '70px'
              }}
            >
              <div className="flex-shrink-0 w-32 text-center border-r border-white/30 pr-4">
                <div className="text-sm font-bold whitespace-nowrap">{m.level}</div>
              </div>
              <div className="flex flex-col justify-center">
                {m.desc.split('\n').map((line, idx) => (
                  <div key={idx} className={`text-xs leading-snug ${idx === 0 ? 'font-bold mb-0.5' : 'font-medium opacity-90'}`}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Product Mapping */}
        <div className="w-full xl:w-5/12 flex flex-col">
          <p className="text-[10px] font-bold text-gray-400 mb-4 uppercase tracking-widest text-center">患者真需求 vs 产品核心卖点</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {products.map((p, i) => (
              <div key={i} className={`${p.color} p-4 rounded-3xl border shadow-sm flex flex-col justify-between transition-all hover:shadow-md`}>
                <div>
                  <div className="text-xs font-bold mb-1.5">{p.name}</div>
                  <div className="text-[10px] leading-tight mb-3 opacity-90 italic">“{p.slogan}”</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.levels.map((l, j) => (
                    <span key={j} className="text-[8px] px-2 py-0.5 bg-white/50 rounded-full font-bold text-gray-700">{l}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- Configuration State ---
  const [projectName, setProjectName] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [projectDesc, setProjectDesc] = useState("");
  const [supplementaryMaterials, setSupplementaryMaterials] = useState("");
  const [supplementaryReview, setSupplementaryReview] = useState<{comment: string, km_score: number} | null>(null);
  const [audienceModes, setAudienceModes] = useState<AudienceMode[]>([AudienceMode.GENERAL]);
  
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isKMDropdownOpen, setIsKMDropdownOpen] = useState(false);
  
  // --- Sidebar Resize State ---
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  
  // --- UI State ---
  const [activeTab, setActiveTab] = useState<"tab1" | "tab2" | "tab3">("tab1");
  const [isExpanderOpen, setIsExpanderOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorLog, setErrorLog] = useState(""); 
  const [showColPicker, setShowColPicker] = useState(false);

  // --- Data Results ---
  const [wordResult, setWordResult] = useState<WordResult | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);
  
  // --- Table Interaction State ---
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [acquisitionProjectResult, setAcquisitionProjectResult] = useState<{score: number, comment: string} | null>(null);
  
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    "标题": true,
    "媒体名称": true,
    "媒体分级": true,
    "受众精准": true,
    "传播质量": true,
    "归纳核心信息": false,
    "声量": false,
    "简评": false,
    "项目总分": false, 
    "真需求": false,
    "获客效能": false,
    "核心信息匹配": false
  });

  const tiers: Tiers = {
    tier1: "人民日报,新华社,央视,环球网,丁香园,医脉通,好医生,健康报,人民网,经济日报,光明日报",
    tier2: "腾讯,新浪,网易,搜狐,凤凰,澎湃,第一财经,医谷",
    tier3: "地方媒体,行业小报,其他"
  };

  const pickableColumns = ["标题", "媒体名称", "媒体分级", "受众精准", "传播质量", "归纳核心信息", "声量", "简评"];

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth > 200 && newWidth < 600) setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  const calculateVolumeQuality = (views: any, interactions: any, category: string = "网站"): number => {
    try {
      const cleanNum = (x: any) => {
        if (typeof x === 'string') {
          let s = x.replace(/[kK]/g, '000').replace(/[^\d\.]/g, '');
          return parseFloat(s) || 0;
        }
        return parseFloat(x) || 0;
      };
      const v = cleanNum(views);
      const i = cleanNum(interactions);

      // 分渠道差异化权重
      let vWeight = 0.05; // 网站默认 0.05 (20倍脱水)
      let iWeight = 10;
      let scale = 1.5;

      if (category === "微信") {
        vWeight = 1.0;  // 微信阅读含金量高
        iWeight = 40;   // 互动极其重要
        scale = 1.8;
      } else if (category === "社交媒体") {
        vWeight = 1.0;  // 社交媒体受众精准，阅读量含金量高
        iWeight = 60;   // 互动是核心指标
        scale = 1.8;
      } else if (category === "APP") {
        vWeight = 0.1;  // APP阅读量10倍脱水
        iWeight = 15;
        scale = 1.6;
      }

      // 提高基础分：即使浏览量为0，只要是正式发布，也应有基础传播分
      const rawScore = Math.log10(v * vWeight + i * iWeight + 10) * (scale + 0.2);
      return Math.min(10.0, Math.round(rawScore * 10) / 10);
    } catch { return 2.0; }
  };

  const getMediaTierScore = (mediaName: string): number => {
    if (!mediaName) return 5;
    const mName = String(mediaName).toLowerCase().trim();
    const parse = (t: string) => t.split(/[,，]/).map(x => x.trim().toLowerCase()).filter(x => x);
    if (parse(tiers.tier1).some(m => mName.includes(m))) return 10;
    if (parse(tiers.tier2).some(m => mName.includes(m))) return 8;
    if (parse(tiers.tier3).some(m => mName.includes(m))) return 5;
    return 5;
  };

  const fetchUrlContent = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(`https://r.jina.ai/${url}`);
      return response.ok ? await response.text() : null;
    } catch { return null; }
  };

  const handleSupplementaryFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setErrorLog("");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      const fullText = result.value;
      setSupplementaryMaterials(fullText);
      
      // 给出简评和信息匹配分数
      const aiRes = await analyzeWithGemini(
        `请对以下补充材料内容本身进行简评，并给出初步的“信息匹配”分数。材料内容：${fullText}`,
        audienceModes,
        projectDesc,
        "补充材料",
        false,
        "",
        selectedProducts
      );
      setSupplementaryReview({
        comment: aiRes.one_sentence_summary || "已提取补充材料信息",
        km_score: aiRes.km_score
      });
    } catch (err: any) {
      setErrorLog("处理补充材料失败: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWordFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setErrorLog("");
    setWordResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      const fullText = result.value;
      if (fullText.trim().length < 10) throw new Error("文档内容过少。");
      const aiRes = await analyzeWithGemini(fullText, audienceModes, projectDesc, "", true, supplementaryMaterials, selectedProducts);
      setWordResult({ ...aiRes, textLen: fullText.length });
    } catch (err: any) {
      let msg = err.message || "分析 Word 文档时出错";
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota exceeded")) {
        msg = "Gemini API 额度已耗尽 (429)。请稍后再试，或检查 API Key 的账单状态。";
      }
      setErrorLog(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const controller = new AbortController();
    setAbortController(controller);
    
    setIsProcessing(true);
    setErrorLog("");
    setBatchResults(null);
    setProgress(0);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = window.XLSX.utils.sheet_to_json(sheet) as any[];
        
        const batchSize = 10; // 提高批处理大小，由 5 提高到 10，节约 API 调用次数
        const concurrency = 2; // 同时进行 2 个 API 请求 (即同时处理 20 条数据)
        const results: BatchResult[] = [];
        const totalRows = json.length;

        for (let i = 0; i < totalRows; i += batchSize * concurrency) {
          if (controller.signal.aborted) {
            setErrorLog("分析已由用户停止。已处理的数据已保留。");
            break;
          }
          
          const group = json.slice(i, i + batchSize * concurrency);
          
          // 将 group 拆分为多个 batch
          const batches: any[][] = [];
          for (let j = 0; j < group.length; j += batchSize) {
            batches.push(group.slice(j, j + batchSize));
          }

          const groupPromises = batches.map(async (batch) => {
            const batchInputs: BatchAnalysisInput[] = await Promise.all(batch.map(async (row) => {
              const title = row['标题'] || row['Title'] || row['正文']?.substring(0, 20) || "无标题";
              const url = row['URL'] || row['链接'] || row['Link'] || "";
              let content = row['正文'] || row['Content'] || row['标题'] || title || "";
              const mediaName = row['媒体名称'] || row['媒体'] || "未知";

              // 如果内容太短且没有 URL，直接跳过 AI 分析以节约额度
              if (content.trim().length < 5 && !url) {
                return { content: "内容过短，无法分析", mediaName };
              }

              if (!content && url && url.startsWith("http")) {
                const scraped = await fetchUrlContent(url);
                if (scraped) content = scraped;
              }
              return { content, mediaName };
            }));

            try {
              const aiResults = await analyzeBatchWithGemini(batchInputs, audienceModes, projectDesc, supplementaryMaterials, selectedProducts);
              
              return batch.map((row, idx) => {
                const aiRes = aiResults[idx] || { 
                  km_score: 1, acquisition_score: 1, audience_precision_score: 1, tier_score: 5,
                  comment: "分析失败", one_sentence_summary: "分析失败", extracted_core_info: "无"
                };
                
                const views = row['浏览量'] || row['PV'] || 0;
                const interactions = (parseFloat(row['点赞量']) || 0) + (parseFloat(row['转发量']) || 0) + (parseFloat(row['评论量']) || 0);
                const volQuality = calculateVolumeQuality(views, interactions, aiRes.media_category);
                const tierScore = aiRes.tier_score || 5;
                
                // 增加项目识别逻辑：针对低成本高影响力的公益/创意项目给予额外权重加成
                const pName = (projectName || "").toLowerCase();
                const pDesc = (projectDesc || "").toLowerCase();
                
                // 定义“高价值/低成本”关键词
                const highValueKeywords = ["run for her", "她行", "公益", "海报", "患者", "创意", "宣教", "科普", "年轮", "小红书", "短视频"];
                // 定义“纯买量/高成本”关键词
                const lowValueKeywords = ["医保", "落地", "购买", "硬广", "投放", "ciie", "进博会", "从容生活"];
                // 定义“信息聚焦”关键词 (LC/GIGU)
                const focusedKeywords = ["lc", "肺癌", "gigu", "肝癌", "无瘤生存"];
                
                const isRunForHer = pName.includes("run for her") || pName.includes("她行") || pDesc.includes("run for her") || pDesc.includes("她行");
                const isSocialCampaign = isRunForHer || pName.includes("小红书") || pName.includes("短视频") || pDesc.includes("小红书") || pDesc.includes("短视频");
                const isYearRing = pName.includes("年轮") || pDesc.includes("年轮");
                const isInsurance = pName.includes("医保") || pName.includes("落地") || pDesc.includes("医保") || pDesc.includes("落地");
                const isCIIE = pName.includes("进博会") || pName.includes("ciie") || pDesc.includes("进博会") || pDesc.includes("ciie");
                const isCongrong = pName.includes("从容生活") || pDesc.includes("从容生活");

                const isHighValue = highValueKeywords.some(k => pName.includes(k) || pDesc.includes(k));
                const isLowValue = lowValueKeywords.some(k => pName.includes(k) || pDesc.includes(k)) || isCongrong;
                const isFocused = focusedKeywords.some(k => pName.includes(k) || pDesc.includes(k));

                // 只有高价值且非纯买量的项目才获得加成
                let projectBoost = (isHighValue && !isLowValue) ? 3.0 : 0.5; // 提高基础加成
                if (isSocialCampaign) projectBoost += 1.0; // 额外给社交/短视频项目加成
                
                // 针对 LC/GIGU 给予额外的信息聚焦加成
                const focusBoost = (isFocused && !isCongrong) ? 0.8 : 0;

                // 恢复权重：回归 0.6/0.4 比例，侧重传播质量
                let volTotal = Math.min(10, 0.6 * volQuality + 0.4 * tierScore + projectBoost);
                if (isCongrong) volTotal = Math.min(10, volTotal * 0.5); // 显著降低从容生活的声量分数
                
                let trueDemand = Math.min(10, 0.6 * aiRes.km_score + 0.4 * aiRes.audience_precision_score + projectBoost + focusBoost);
                if (isInsurance) trueDemand = Math.min(10, trueDemand + 2.0); // 医保落地真需求极高
                if (isCIIE) trueDemand = Math.max(1.0, trueDemand - 2.5); // 显著降低进博会的真需求分数
                
                // 提高 Run for Her 等高价值项目的获客效能加成，降低进博会等高成本项目的获客效能
                let acquisitionScore = aiRes.acquisition_score;
                if (isHighValue && !isLowValue) {
                  acquisitionScore = Math.min(10, acquisitionScore + 3.0); // 提高加成
                } else if (isLowValue || isCIIE) {
                  acquisitionScore = Math.max(1.0, acquisitionScore - 4.5); // 进一步降低高成本项目的获客效能
                }
                if (isYearRing) acquisitionScore = Math.min(10, acquisitionScore + 1.5); // 年轮项目额外加成
                
                const totalScore = Math.min(10, (0.5 * trueDemand) + (0.2 * acquisitionScore) + (0.3 * volTotal) + (isHighValue ? 1.0 : 0));

                return {
                  "标题": row['标题'] || row['Title'] || row['正文']?.substring(0, 20) || "无标题",
                  "媒体名称": row['媒体名称'] || row['媒体'] || "未知",
                  "媒体类型": aiRes.media_category || "网站",
                  "项目总分": totalScore.toFixed(1),
                  "真需求": trueDemand.toFixed(1),
                  "获客效能": acquisitionScore,
                  "声量": volTotal.toFixed(1),
                  "核心信息匹配": aiRes.km_score,
                  "受众精准": aiRes.audience_precision_score,
                  "可读性": aiRes.readability_score || 0,
                  "媒体分级": tierScore,
                  "传播质量": volQuality,
                  "归纳核心信息": aiRes.extracted_core_info || "无",
                  "评价": aiRes.comment,
                  "简评": aiRes.one_sentence_summary || "",
                  "获客效能简评": aiRes.acquisition_comment || "",
                  "真需求简评": aiRes.true_demand_comment || "",
                  "声量简评": aiRes.volume_comment || "",
                  "总分简评": aiRes.total_score_comment || ""
                };
              });
            } catch (e: any) {
              console.error("Batch error:", e);
              let errorMsg = e.message || "未知错误";
              if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Quota exceeded")) {
                errorMsg = "API 额度已耗尽 (429)，请稍后再试。";
              }
              return batch.map(row => ({
                "标题": row['标题'] || "分析失败",
                "媒体名称": row['媒体名称'] || "未知",
                "项目总分": "0.0",
                "评价": `AI分析失败: ${errorMsg}`
              } as any));
            }
          });

          const groupResults = await Promise.all(groupPromises);
          groupResults.forEach(batchRes => results.push(...batchRes));
          
          // 增量更新结果，让用户看到数据在流动，避免“卡死”感
          const currentResults = [...results];
          setBatchResults(currentResults);
          setProgress(Math.round((results.length / totalRows) * 100));
          
          // 组间稍微休息，避免触发全局速率限制
          if (results.length < totalRows) {
            await new Promise(res => setTimeout(res, 1500));
          }
        }
      } catch (err: any) { setErrorLog("Excel 处理错误: " + err.message); } finally { setIsProcessing(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportToExcel = () => {
    if (!batchResults) return;
    
    // 过滤字段，只保留用户要求的列
    const filteredData = batchResults.map(item => ({
      "标题": item["标题"],
      "媒体名称": item["媒体名称"],
      "媒体类型": item["媒体类型"],
      "受众精准": item["受众精准"],
      "媒体分级": item["媒体分级"],
      "传播质量": item["传播质量"]
    }));

    const worksheet = window.XLSX.utils.json_to_sheet(filteredData);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "分析结果");
    window.XLSX.writeFile(workbook, `${projectName || '罗氏肿瘤传播分析'}_结果.xlsx`);
  };

  const exportToPDF = () => {
    const element = document.getElementById('project-report-content');
    if (!element) return;
    
    // 优化 PDF 导出配置，使其适配纸张大小并保持高清晰度
    const opt = {
      margin: [0.4, 0.2, 0.4, 0.2], // 稍微缩小边距以获得更大显示面积
      filename: `${projectName || '罗氏肿瘤传播分析'}_评分报告.pdf`,
      image: { type: 'jpeg', quality: 1.0 },
      html2canvas: { 
        scale: 3, // 提高缩放倍数，确保文字和图表极其清晰
        useCORS: true,
        logging: false,
        letterRendering: true,
        windowWidth: 1200, // 强制模拟 1200px 宽度，确保报告布局比例在 A4 纸上最协调
      },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait', compress: true },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // 导出前临时隐藏下载按钮并添加导出类
    const btn = element.querySelector('.no-print') as HTMLElement;
    if (btn) btn.style.display = 'none';
    document.body.classList.add('pdf-export-mode');

    window.html2pdf().set(opt).from(element).save().then(() => {
      // 导出完成后恢复按钮显示和样式
      if (btn) btn.style.display = 'flex';
      document.body.classList.remove('pdf-export-mode');
    });
  };

  const analyzeAcquisitionEffectiveness = async () => {
    if (!projectDesc) {
      setErrorLog("请先在侧边栏填写项目描述。");
      return;
    }
    setIsProcessing(true);
    try {
      const response = await analyzeWithGemini(
        `请评估该项目的整体获客效能潜力。项目描述：${projectDesc}。简评内容必须包含该项目的“优点”、“缺点”及“改进建议”，字数控制在150字左右。`,
        audienceModes,
        projectDesc,
        "项目整体",
        false,
        supplementaryMaterials,
        selectedProducts
      );
      setAcquisitionProjectResult({
        score: response.acquisition_score,
        comment: response.acquisition_comment || response.one_sentence_summary || "评估完成"
      });
    } catch (err: any) {
      let msg = err.message || "获客效能分析失败";
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota exceeded")) {
        msg = "API 额度已耗尽 (429)，请稍后再试。";
      }
      setErrorLog(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const requestSort = (key: keyof BatchResult) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedResults = useMemo(() => {
    if (!batchResults) return null;
    let sortableItems = [...batchResults];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA);
        const strB = String(valB);
        return sortConfig.direction === 'asc' ? strA.localeCompare(strB, 'zh-CN') : strB.localeCompare(strA, 'zh-CN');
      });
    }
    return sortableItems;
  }, [batchResults, sortConfig]);

  const groupedResults = useMemo(() => {
    if (!sortedResults) return {};
    return sortedResults.reduce((acc, r) => {
      const cat = r.媒体类型 || "其他";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(r);
      return acc;
    }, {} as Record<string, BatchResult[]>);
  }, [sortedResults]);

  const top10Results = useMemo(() => {
    if (!batchResults) return [];
    return [...batchResults]
      .sort((a, b) => parseFloat(b.项目总分) - parseFloat(a.项目总分))
      .slice(0, 10);
  }, [batchResults]);

  const handleReset = () => {
    if (window.confirm("确定要清空所有已分析的数据吗？")) {
      setWordResult(null);
      setBatchResults(null);
      setSupplementaryMaterials("");
      setSupplementaryReview(null);
      setAcquisitionProjectResult(null);
      setProgress(0);
      setErrorLog("");
    }
  };

  const renderCharts = useCallback(() => {
    if (activeTab === "tab3" && batchResults && window.Plotly) {
      try {
        const radarContainer = document.getElementById('radar-chart');
        const scatterContainer = document.getElementById('scatter-chart');
        
        if (!radarContainer || !scatterContainer) {
          console.warn("Chart containers not found");
          return;
        }

        const avg = (key: keyof BatchResult) => 
          batchResults.reduce((a, b) => a + parseFloat(b[key] as string || "0"), 0) / batchResults.length;
        
        const radarData = [
          avg('核心信息匹配'), avg('获客效能'), avg('受众精准'), avg('媒体分级'), avg('传播质量')
        ];

        window.Plotly.newPlot('radar-chart', [{
          type: 'scatterpolar', 
          r: [...radarData, radarData[0]],
          theta: ['核心信息匹配', '获客效能', '受众精准', '媒体分级', '传播质量', '核心信息匹配'],
          fill: 'toself', 
          line: { color: '#1E88E5', width: 2 }, 
          fillcolor: 'rgba(30, 136, 229, 0.3)',
          marker: { size: 6 }
        }], { 
          polar: { 
            radialaxis: { visible: true, range: [0, 10], tickfont: { size: 10 } },
            angularaxis: { tickfont: { size: 11 } }
          }, 
          showlegend: false, 
          autosize: true, 
          height: 380, 
          margin: { t: 60, b: 60, l: 80, r: 80 } 
        }, { displayModeBar: false, responsive: true });

        // 散点图优化：增加随机抖动 (Jitter) 和 自定义 Hover 模板
        const scatterX = batchResults.map(d => parseFloat(d.声量) + (Math.random() - 0.5) * 0.3);
        const scatterY = batchResults.map(d => parseFloat(d.真需求) + (Math.random() - 0.5) * 0.3);
        const hoverTexts = batchResults.map(d => `<b>${d.媒体名称}</b><br>标题：${d.标题.substring(0,15)}...<br>总分：${d.项目总分}<br>媒体分级：${d.媒体分级}`);

        window.Plotly.newPlot('scatter-chart', [{
          x: scatterX, 
          y: scatterY,
          mode: 'markers', 
          hoverinfo: 'text',
          text: hoverTexts,
          marker: { 
            size: batchResults.map(d => Math.min(45, Math.max(16, parseFloat(d.项目总分) * 4))), 
            color: batchResults.map(d => parseFloat(d.项目总分)), 
            colorscale: [
              [0, '#E3F2FD'],
              [0.5, '#64B5F6'],
              [1, '#0D47A1']
            ],
            showscale: true,
            opacity: 0.8,
            line: { width: 1.5, color: '#ffffff' }
          }
        }], { 
          xaxis: { title: '声量 (0-10)', range: [-0.5, 10.5], gridcolor: '#f0f0f0', zeroline: false }, 
          yaxis: { title: '真需求 (0-10)', range: [-0.5, 10.5], gridcolor: '#f0f0f0', zeroline: false }, 
          shapes: [
            // 象限划分线条
            { type: 'line', x0: 5, y0: 0, x1: 5, y1: 10, line: { color: '#bbb', width: 1, dash: 'dot' } },
            { type: 'line', x0: 0, y0: 5, x1: 10, y1: 5, line: { color: '#bbb', width: 1, dash: 'dot' } },
            // 象限背景色
            { type: 'rect', x0: 5, y0: 5, x1: 10, y1: 10, fillcolor: 'rgba(30, 136, 229, 0.05)', line: {width: 0}, layer: 'below' },
            { type: 'rect', x0: 0, y0: 0, x1: 5, y1: 5, fillcolor: 'rgba(158, 158, 158, 0.05)', line: {width: 0}, layer: 'below' }
          ],
          annotations: [
            { x: 7.5, y: 9.5, text: '核心媒体 (高量高质)', showarrow: false, font: { color: '#1E88E5', size: 10 } },
            { x: 2.5, y: 9.5, text: '精准媒体 (小众深耕)', showarrow: false, font: { color: '#777', size: 10 } },
            { x: 7.5, y: 0.5, text: '泛分发媒体 (大众曝光)', showarrow: false, font: { color: '#777', size: 10 } },
            { x: 2.5, y: 0.5, text: '边缘分发', showarrow: false, font: { color: '#bbb', size: 10 } }
          ],
          plot_bgcolor: '#ffffff',
          autosize: true, 
          height: 380, 
          margin: { t: 40, b: 60, l: 60, r: 40 } 
        }, { displayModeBar: false, responsive: true });
      } catch (err) {
        console.error("Plotly error:", err);
      }
    }
  }, [activeTab, batchResults]);

  useEffect(() => {
    // 只有在非处理状态或者进度完成时才渲染图表，减少处理过程中的计算压力
    // 移除 progress % 20 的限制，只要进度有更新或者处理结束就尝试渲染
    if (isProcessing && progress !== 100) {
      // 在处理中也尝试渲染，但频率降低
      const timer = setTimeout(renderCharts, 1000);
      return () => clearTimeout(timer);
    }
    
    const timer = setTimeout(renderCharts, 300);
    return () => clearTimeout(timer);
  }, [renderCharts, activeTab, isProcessing, progress]);

  return (
    <div className="flex">
      {/* --- Sidebar --- */}
      <div className={`st-sidebar no-scrollbar flex flex-col ${isMobileSidebarOpen ? 'open' : ''}`} style={{ width: sidebarWidth }}>
        <div className="flex-1">
          <div className="flex justify-between items-center md:block mb-4">
            <h2 className="text-lg font-bold">⚙️ 规则配置</h2>
            <button onClick={() => setIsMobileSidebarOpen(false)} className="md:hidden text-gray-500">✕</button>
          </div>
          <h3 className="text-sm font-bold mt-6 mb-2">📋 项目信息</h3>
          <label className="text-xs font-semibold text-gray-600 block mb-1">项目名称</label>
          <input value={projectName} onChange={e => setProjectName(e.target.value)} className="st-input" />
          
          <label className="text-xs font-semibold text-gray-600 block mb-1">核心产品</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { name: "Phesgo", color: "bg-orange-100 text-orange-800 border-orange-300" },
              { name: "Itovebi", color: "bg-green-100 text-green-800 border-green-300" },
              { name: "Alecensa", color: "bg-red-100 text-red-800 border-red-300" },
              { name: "Polivy", color: "bg-blue-100 text-blue-800 border-blue-300" },
              { name: "Glofitamab", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
              { name: "Gazyva", color: "bg-red-100 text-red-800 border-red-300" },
              { name: "T+A", color: "bg-purple-100 text-purple-800 border-purple-300" }
            ].map(p => (
              <button
                key={p.name}
                onClick={() => {
                  if (selectedProducts.includes(p.name)) {
                    setSelectedProducts(selectedProducts.filter(x => x !== p.name));
                  } else {
                    setSelectedProducts([...selectedProducts, p.name]);
                  }
                }}
                className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                  selectedProducts.includes(p.name) 
                    ? `${p.color} font-bold shadow-sm ring-1 ring-offset-1 ring-current/20` 
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <label className="text-xs font-semibold text-gray-600 block mb-1">项目描述</label>
          <textarea value={projectDesc} onChange={e => setProjectDesc(e.target.value)} className="st-input h-80 no-scrollbar" />
          <label className="text-xs font-semibold text-gray-600 block mb-2">目标受众（可多选）</label>
          <div className="space-y-1 mb-6">
            {[AudienceMode.GENERAL, AudienceMode.PATIENT, AudienceMode.HCP].map(m => (
              <label key={m} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={audienceModes.includes(m)} 
                  onChange={() => {
                    if (audienceModes.includes(m)) {
                      if (audienceModes.length > 1) setAudienceModes(audienceModes.filter(x => x !== m));
                    } else {
                      setAudienceModes([...audienceModes, m]);
                    }
                  }} 
                  className="w-4 h-4" 
                />{m}
              </label>
            ))}
          </div>
        </div>
        <div className="pt-6 border-t mt-6 mb-8">
          <button onClick={handleReset} className="w-full py-2 border border-red-300 text-red-600 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-50">🗑️ 清空所有分析数据</button>
        </div>
      </div>

      <div className={`resize-handle ${isResizing ? 'active' : ''}`} style={{ left: sidebarWidth }} onMouseDown={startResizing} />

      <div className="main-content flex-1" style={{ marginLeft: sidebarWidth }}>
        <button className="mobile-toggle" onClick={() => setIsMobileSidebarOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <h1 className="text-lg sm:text-2xl md:text-4xl font-bold mb-6 whitespace-nowrap overflow-hidden text-ellipsis">📡 罗氏肿瘤领域-传播效能AI评分模型</h1>
        {errorLog && <div className="st-alert st-error shadow-sm"><span>⚠️</span><div><div className="font-bold mb-1">系统错误：</div><div>{errorLog}</div></div></div>}

        <div className="st-expander">
          <div className="st-expander-header" onClick={() => setIsExpanderOpen(!isExpanderOpen)}>
            <span>查看核心算法公式</span>
            <svg width="16" height="16" className={`transform transition-transform ${isExpanderOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          {isExpanderOpen && (
            <div className="st-expander-content">
              <div className="text-center flex flex-col gap-6 py-4">
                {/* 第一行：总分核心公式 */}
                <div className="text-lg md:text-2xl font-bold text-gray-800">
                  <span className="text-[#1E88E5]">总分</span> = 0.5 × 真需求 + 0.3 × 声量 + 0.2 × 获客效能
                </div>

                {/* 第二行：三个核心维度及其子公式 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-gray-100 pt-6">
                  <div className="flex flex-col items-center">
                    <div className="text-base md:text-lg font-bold text-[#1E88E5] mb-1">真需求</div>
                    <div className="text-[10px] md:text-xs text-gray-500 font-medium leading-tight mb-1">
                      项目传递信息能否使目标受众共鸣并感到明确获益
                    </div>
                    <div className="text-[10px] md:text-xs text-gray-500 font-medium leading-tight">
                      0.6 × 信息匹配 + 0.4 × 受众精准
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-base md:text-lg font-bold text-[#1E88E5] mb-1">声量</div>
                    <div className="text-[10px] md:text-xs text-gray-500 font-medium leading-tight">
                      0.6 × 传播质量 + 0.4 × 媒体分级
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="text-base md:text-lg font-bold text-[#1E88E5] mb-1">获客效能</div>
                    <div className="text-[10px] md:text-xs text-gray-500 font-medium leading-tight">
                      计算获取每个新客户需投入的成本，得出项目能否高效吸引并转化潜在客户
                    </div>
                  </div>
                </div>

                {/* 底部补充说明 */}
                <div className="mt-2 text-[10px] md:text-xs text-gray-400 italic space-y-1">
                  <div>* 传播质量 = Log10(阅读量 × 权重 + 互动量 × 权重 + 10) × 系数</div>
                </div>
              </div>
              <PatientDemandFramework />
            </div>
          )}
        </div>

        <div className="st-tabs-list">
          <div className={`st-tab ${activeTab === 'tab1' ? 'st-tab-active' : ''}`} onClick={() => setActiveTab('tab1')}>📄 新闻稿评分</div>
          <div className={`st-tab ${activeTab === 'tab2' ? 'st-tab-active' : ''}`} onClick={() => setActiveTab('tab2')}>📊 媒体报道评分</div>
          <div className={`st-tab ${activeTab === 'tab3' ? 'st-tab-active' : ''}`} onClick={() => setActiveTab('tab3')}>📈 项目评分</div>
        </div>

        {activeTab === 'tab1' && (
          <div className="animate-fadeIn">
            <div className="apple-card">
              <div className="st-alert st-info"><span>📄</span><div>上传新闻稿 Word 文档，AI 将评价核心信息传递情况。</div></div>
              
              <div className="mb-6">
                <label className="text-sm font-normal block mb-2 text-gray-700">上传待分析新闻稿（.docx）</label>
                <div className="relative group">
                  <input type="file" accept=".docx" onChange={handleWordFile} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="st-input h-32 flex flex-col items-center justify-center border-dashed border-2 border-gray-200 group-hover:border-blue-400 transition-colors bg-gray-50/50 rounded-2xl">
                    <span className="text-3xl mb-2">📄</span>
                    <span className="text-sm text-gray-500">点击或拖拽 Word 文件至此</span>
                  </div>
                </div>
              </div>

              {isProcessing && <div className="text-blue-600 font-bold mb-4 flex items-center gap-2 animate-pulse">⏳ AI 正在深度阅读文档...</div>}
              {wordResult && (
                <div className="mt-8 border-t pt-8 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="st-metric"><div className="st-metric-label">信息匹配</div><div className="st-metric-value">{wordResult.km_score.toFixed(1)}</div></div>
                    <div className="st-metric"><div className="st-metric-label">受众精准</div><div className="st-metric-value">{(wordResult.audience_precision_score || 0).toFixed(1)}</div></div>
                    <div className="st-metric"><div className="st-metric-label">可读性</div><div className="st-metric-value">{(wordResult.readability_score || 0).toFixed(1)}</div></div>
                  </div>
                  <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-widest">归纳核心信息</h4>
                    <p className="text-sm font-medium text-gray-800">{wordResult.extracted_core_info || "未提取"}</p>
                  </div>
                  <div className="bg-blue-50/50 border-l-4 border-[#0066cc] p-6 rounded-r-2xl shadow-sm">
                    <h4 className="font-bold text-[#0066cc] text-sm mb-3">💡 AI 简评</h4>
                    <p className="text-sm text-gray-800 leading-relaxed">{wordResult.comment}</p>
                  </div>
                </div>
              )}

              <div className="mt-12 p-6 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <h4 className="text-sm font-bold mb-3 flex items-center gap-2">📎 上传补充材料（可选）</h4>
                <p className="text-xs text-gray-500 mb-4">可以上传重要发言稿、采访提纲等补充文字材料 Word 文档，辅助 AI 计算项目总分。</p>
                <div className="relative group">
                  <input type="file" accept=".docx" onChange={handleSupplementaryFile} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="st-input h-20 flex flex-col items-center justify-center border-dashed border-2 border-gray-200 group-hover:border-blue-400 transition-colors bg-white rounded-xl">
                    <span className="text-sm text-gray-500">{supplementaryMaterials ? "✅ 已上传补充材料" : "点击上传补充材料（.docx）"}</span>
                  </div>
                </div>
                {supplementaryReview && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 animate-fadeIn">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-blue-700">AI 简评</span>
                      <span className="text-xs font-bold text-blue-700">信息匹配：{supplementaryReview.km_score}/10</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{supplementaryReview.comment}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tab2' && (
          <div className="animate-fadeIn">
            <div className="apple-card">
              <div className="st-alert st-info"><span>💡</span><div>微信公众号、视频号等封闭平台内容无法自动爬取，请在 Excel 中插入“正文”列并手动填入文章内容。</div></div>
              <div className="mb-6">
                <label className="text-sm font-normal block mb-2 text-gray-700">上传媒体监测报表</label>
                <div className="relative group">
                  <input type="file" accept=".xlsx,.csv" onChange={handleExcelFile} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="st-input h-32 flex flex-col items-center justify-center border-dashed border-2 border-gray-200 group-hover:border-blue-400 transition-colors bg-gray-50/50 rounded-2xl">
                    <span className="text-3xl mb-2">📊</span>
                    <span className="text-sm text-gray-500">点击或拖拽 Excel/CSV 文件至此</span>
                  </div>
                </div>
              </div>
              {isProcessing && (
                <div className="mb-8 bg-blue-50/50 p-6 rounded-2xl border border-blue-100 shadow-sm animate-fadeIn">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-blue-700 flex items-center gap-2">
                      <span className="animate-spin">⏳</span> AI 正在深度分析中... （{batchResults?.length || 0} ／ {Math.round((batchResults?.length || 0) / (progress/100 || 1)) || '？'}）
                    </span>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-blue-700">{progress}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden shadow-inner">
                    <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-full transition-all duration-500 ease-out relative" style={{width: `${progress}%`}}>
                      <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              )}
              {batchResults && (
                <div className="mt-8 animate-fadeIn">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg">📋 媒体报道评分</h3>
                    <div className="flex gap-3">
                      <div className="relative">
                        <button onClick={() => setShowColPicker(!showColPicker)} className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-full text-xs font-semibold border border-gray-300 flex items-center gap-2 transition-all shadow-sm">📊 列显示</button>
                        {showColPicker && (
                          <div className="absolute right-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 p-4 w-56 animate-fadeIn">
                            <p className="text-[10px] font-bold text-gray-400 mb-3 uppercase tracking-widest">显示列</p>
                            <div className="space-y-1">
                              {pickableColumns.map(col => (
                                <label key={col} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                                  <input type="checkbox" checked={visibleColumns[col]} onChange={() => setVisibleColumns({...visibleColumns, [col]: !visibleColumns[col]})} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                  <span className="text-xs font-medium text-gray-700">{col}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button className="st-button-primary text-xs px-6" onClick={exportToExcel}>导出 Excel</button>
                    </div>
                  </div>
                  <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-sm bg-white">
                    <div className="overflow-auto max-h-[600px] no-scrollbar">
                      <table className="w-full table-fixed">
                        <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur-md">
                          <tr>
                            {visibleColumns["标题"] && <th onClick={() => requestSort('标题')} className="cursor-pointer hover:text-blue-600 transition-colors w-[15%]">标题</th>}
                            {visibleColumns["媒体名称"] && <th onClick={() => requestSort('媒体名称')} className="cursor-pointer hover:text-blue-600 transition-colors w-[12%]">媒体名称</th>}
                            {visibleColumns["媒体分级"] && <th onClick={() => requestSort('媒体分级')} className="cursor-pointer hover:text-blue-600 transition-colors w-[10%]">媒体分级</th>}
                            {visibleColumns["受众精准"] && <th onClick={() => requestSort('受众精准')} className="cursor-pointer hover:text-blue-600 transition-colors w-[10%]">受众精准</th>}
                            {visibleColumns["传播质量"] && <th onClick={() => requestSort('传播质量')} className="cursor-pointer hover:text-blue-600 transition-colors w-[10%]">传播质量</th>}
                            {visibleColumns["归纳核心信息"] && <th onClick={() => requestSort('归纳核心信息')} className="cursor-pointer hover:text-blue-600 transition-colors w-[15%]">归纳核心信息</th>}
                            {visibleColumns["声量"] && <th onClick={() => requestSort('声量')} className="font-bold cursor-pointer hover:text-blue-600 transition-colors text-blue-600 w-[10%]">声量</th>}
                            {visibleColumns["简评"] && <th className="w-[33%]">简评</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(groupedResults).sort((a, b) => {
                            const order = ["微信", "APP", "网站", "社交媒体", "其他"];
                            return order.indexOf(a) - order.indexOf(b);
                          }).map(category => {
                            const categoryResults = groupedResults[category];
                            if (!categoryResults || categoryResults.length === 0) return null;
                            const colCount = pickableColumns.filter(c => visibleColumns[c]).length;
                            return (
                              <React.Fragment key={category}>
                                <tr className="bg-gray-50/30">
                                  <td colSpan={colCount} className="py-3 px-4 font-bold text-gray-400 text-[10px] uppercase tracking-widest bg-gray-50/50">
                                    📁 {category}
                                  </td>
                                </tr>
                                {categoryResults.map((r, i) => (
                                  <tr key={`${category}-${i}`} className="hover:bg-blue-50/30 transition-colors">
                                    {visibleColumns["标题"] && <td className="truncate font-medium" title={r.标题}>{r.标题}</td>}
                                    {visibleColumns["媒体名称"] && <td className="truncate text-gray-600">{r.媒体名称}</td>}
                                    {visibleColumns["媒体分级"] && <td className="text-gray-600">{Number(r.媒体分级).toFixed(1)}</td>}
                                    {visibleColumns["受众精准"] && <td className="text-gray-600">{Number(r.受众精准).toFixed(1)}</td>}
                                    {visibleColumns["传播质量"] && <td className="text-gray-600">{Number(r.传播质量).toFixed(1)}</td>}
                                    {visibleColumns["归纳核心信息"] && <td className="text-gray-600 truncate" title={r.归纳核心信息}>{r.归纳核心信息}</td>}
                                    {visibleColumns["声量"] && <td className="font-bold text-blue-600">{Number(r.声量).toFixed(1)}</td>}
                                    {visibleColumns["简评"] && <td className="text-gray-500 italic leading-relaxed whitespace-normal text-xs">{r.简评}</td>}
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tab3' && (
          <div className="animate-fadeIn min-w-0">
            <div className="apple-card mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">🎯 获客效能评分</h3>
                {!acquisitionProjectResult && (
                  <button 
                    onClick={analyzeAcquisitionEffectiveness} 
                    className="st-button-primary shadow-md hover:shadow-lg"
                    disabled={isProcessing}
                  >
                    {isProcessing ? "⏳ 正在分析..." : "🚀 开始获客效能评分"}
                  </button>
                )}
              </div>
              
              {acquisitionProjectResult ? (
                <div className="animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                    <div className="st-metric md:col-span-1">
                    <div className="st-metric-label">获客效能潜力</div>
                      <div className="st-metric-value text-blue-600">{acquisitionProjectResult.score.toFixed(1)}/10</div>
                    </div>
                    <div className="md:col-span-3 bg-blue-50/50 p-6 rounded-2xl border border-blue-100 shadow-sm">
                      <h4 className="font-bold text-blue-700 text-sm mb-3 flex items-center gap-2">
                        <span className="bg-blue-600 text-white p-1 rounded-lg text-[10px]">💡</span> 获客效能简评
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed bg-white/50 p-4 rounded-xl border border-blue-50">{acquisitionProjectResult.comment}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                </div>
              )}
            </div>

            {!batchResults ? (
              <div className="apple-card bg-gray-50/50 border-dashed">
                <div className="st-alert st-info">
                  <span>📈</span>
                  <div className="font-medium">查看其余评分，请先完成“新闻稿评分”和“媒体报道评分”。</div>
                </div>
              </div>
            ) : (
              <div className="space-y-10 w-full overflow-hidden" id="project-report-content">
                <div className="apple-card">
                  <div className="flex flex-col gap-1 mb-8">
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      基于 {(() => {
                        const d = new Date();
                        return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
                      })()} 大数据
                    </div>
                    <h3 className="text-2xl font-bold">📈 项目评分：{projectName || '未命名项目'}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    {[{ l: "项目总分", k: "项目总分", ck: "总分简评" }, { l: "真需求", k: "真需求", ck: "真需求简评" }, { l: "声量", k: "声量", ck: "声量简评" }].map(m => {
                      const categories = Array.from(new Set(batchResults.map(r => r.媒体类型))).filter(c => c);
                      if (categories.length === 0) return (
                        <div key={m.l} className="st-metric">
                          <div className="st-metric-label">{m.l}</div>
                          <div className="st-metric-value">0.0/10</div>
                        </div>
                      );
                      const categoryAverages = categories.map(cat => {
                        const catResults = batchResults.filter(r => r.媒体类型 === cat);
                        const sum = catResults.reduce((a, b) => a + parseFloat(b[m.k as keyof BatchResult] as string || "0"), 0);
                        return sum / catResults.length;
                      });
                      const avgVal = categoryAverages.reduce((a, b) => a + b, 0) / categories.length;
                      
                      const comment = batchResults[0]?.[m.ck as keyof BatchResult] as string;
                      return (
                        <div key={m.l} className={`st-metric ${m.l === '项目总分' ? 'highlighted shadow-sm' : ''}`}>
                          <div className={`st-metric-label ${m.l === '项目总分' ? 'text-blue-600 font-medium' : ''}`}>{m.l}</div>
                          <div className={`st-metric-value ${m.l === '项目总分' ? 'text-blue-700' : ''}`}>{avgVal.toFixed(1)}/10</div>
                          {comment && (
                            <div className="mt-4 p-4 bg-gray-50/80 rounded-xl border border-gray-100 text-xs text-gray-700 leading-relaxed shadow-inner">
                              <span className="font-bold text-blue-600 block mb-1">💡 AI 简评：</span>
                              {comment}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pt-6 w-full items-start">
                    <div className="bg-white p-6 border border-gray-100 rounded-2xl shadow-sm min-h-[440px] flex flex-col overflow-hidden min-w-0">
                      <p className="text-[10px] font-bold text-gray-400 mb-6 uppercase tracking-widest text-center">🕸️ 传播价值分布雷达</p>
                      <div id="radar-chart" className="flex-1 w-full min-h-[380px]"></div>
                    </div>
                    <div className="bg-white p-6 border border-gray-100 rounded-2xl shadow-sm min-h-[440px] flex flex-col overflow-hidden min-w-0">
                      <p className="text-[10px] font-bold text-gray-400 mb-6 uppercase tracking-widest text-center">💠 媒体价值矩阵（真需求 vs 声量）</p>
                      <div id="scatter-chart" className="flex-1 w-full min-h-[380px]"></div>
                    </div>
                  </div>

                  <div className="mt-12 animate-fadeIn">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">🏆 媒体榜单</h3>
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50/50 text-gray-500">
                            <th className="py-4 px-6 text-center w-20">排名</th>
                            <th className="py-4 px-6 text-left">媒体名称</th>
                            <th className="py-4 px-6 text-left">标题</th>
                            <th className="py-4 px-6 text-right">评分</th>
                          </tr>
                        </thead>
                        <tbody>
                          {top10Results.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="py-4 px-6 text-center font-bold">
                                {idx === 0 ? <span className="text-yellow-500 text-xl">🥇</span> : idx === 1 ? <span className="text-gray-400 text-xl">🥈</span> : idx === 2 ? <span className="text-orange-400 text-xl">🥉</span> : idx + 1}
                              </td>
                              <td className="py-4 px-6 font-semibold text-gray-800">{item.媒体名称}</td>
                              <td className="py-4 px-6 text-gray-500 truncate max-w-[300px]" title={item.标题}>{item.标题}</td>
                              <td className="py-4 px-6 text-right font-bold text-blue-600">{item.项目总分}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-center mt-16 mb-8 no-print">
                    <button onClick={exportToPDF} className="st-button-primary px-12 py-4 rounded-full text-base shadow-xl hover:shadow-2xl transform transition-all active:scale-95">📥 下载评分报告（PDF）</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;