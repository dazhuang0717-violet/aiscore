import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { analyzeWithGemini } from './services/geminiService';
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

const App: React.FC = () => {
  // --- Configuration State ---
  const [projectName, setProjectName] = useState("");
  const [projectKeyMessage, setProjectKeyMessage] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(AudienceMode.GENERAL);
  const [tiers, setTiers] = useState<Tiers>({ 
    tier1: "", 
    tier2: "", 
    tier3: "" 
  });
  
  // --- Sidebar Resize State ---
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  
  // --- UI State ---
  const [activeTab, setActiveTab] = useState<"tab1" | "tab2" | "tab3">("tab1");
  const [isExpanderOpen, setIsExpanderOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorLog, setErrorLog] = useState(""); 
  const [showColPicker, setShowColPicker] = useState(false);

  // --- Data Results ---
  const [wordResult, setWordResult] = useState<WordResult | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);
  
  // --- Table Interaction State ---
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    "标题": true,
    "媒体名称": true,
    "媒体分级": true,
    "受众精准度": true,
    "传播质量": true,
    "声量": true,
    "项目总分": false, 
    "真需求": false,
    "获客效能": false,
    "核心信息匹配": false
  });

  const pickableColumns = ["标题", "媒体名称", "媒体分级", "受众精准度", "传播质量", "声量"];

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

  const calculateVolumeQuality = (views: any, interactions: any): number => {
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
      const rawScore = Math.log10(v + i * 5 + 10) * 1.5;
      return Math.min(10.0, Math.round(rawScore * 10) / 10);
    } catch { return 1.0; }
  };

  const getMediaTierScore = (mediaName: string): number => {
    if (!mediaName) return 3;
    const mName = String(mediaName).toLowerCase().trim();
    const parse = (t: string) => t.split(/[,，]/).map(x => x.trim().toLowerCase()).filter(x => x);
    if (parse(tiers.tier1).some(m => mName.includes(m))) return 10;
    if (parse(tiers.tier2).some(m => mName.includes(m))) return 8;
    if (parse(tiers.tier3).some(m => mName.includes(m))) return 5;
    return 3;
  };

  const fetchUrlContent = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(`https://r.jina.ai/${url}`);
      return response.ok ? await response.text() : null;
    } catch { return null; }
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
      const aiRes = await analyzeWithGemini(fullText, audienceMode, projectKeyMessage, projectDesc, "内部稿件");
      setWordResult({ ...aiRes, textLen: fullText.length });
    } catch (err: any) {
      setErrorLog(err.message || "分析 Word 文档时出错");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
        
        const results: BatchResult[] = [];
        const totalRows = json.length;

        for (let i = 0; i < totalRows; i++) {
          const row = json[i];
          const mediaName = row['媒体名称'] || row['媒体'] || "未知";
          const title = row['标题'] || row['Title'] || row['正文']?.substring(0, 20) || "无标题";
          const views = row['浏览量'] || row['PV'] || 0;
          const interactions = (parseFloat(row['点赞量']) || 0) + (parseFloat(row['转发量']) || 0) + (parseFloat(row['评论量']) || 0);
          const url = row['URL'] || row['链接'] || row['Link'] || "";
          
          const volQuality = calculateVolumeQuality(views, interactions);
          const tierScore = getMediaTierScore(mediaName);
          const volTotal = 0.6 * volQuality + 0.4 * tierScore;
          
          let aiRes: AIAnalysisResult = { km_score: 1, acquisition_score: 1, audience_precision_score: 1, comment: "待评估" };
          let content = row['正文'] || row['Content'] || row['标题'] || title || "";
          
          if (!content && url && url.startsWith("http")) {
            const scraped = await fetchUrlContent(url);
            if (scraped) content = scraped;
          }
          
          if (content || mediaName) {
            try { 
              if (i > 0) await new Promise(res => setTimeout(res, 800));
              aiRes = await analyzeWithGemini(content, audienceMode, projectKeyMessage, projectDesc, mediaName); 
            } catch (e: any) { aiRes.comment = `AI分析失败: ${e.message}`; }
          }
          
          const trueDemand = 0.6 * aiRes.km_score + 0.4 * aiRes.audience_precision_score;
          const totalScore = (0.5 * trueDemand) + (0.2 * aiRes.acquisition_score) + (0.3 * volTotal);
          
          results.push({
            "标题": title,
            "媒体名称": mediaName,
            "项目总分": totalScore.toFixed(2),
            "真需求": trueDemand.toFixed(2),
            "获客效能": aiRes.acquisition_score,
            "声量": volTotal.toFixed(2),
            "核心信息匹配": aiRes.km_score,
            "受众精准度": aiRes.audience_precision_score,
            "媒体分级": tierScore,
            "传播质量": volQuality,
            "评价": aiRes.comment
          });
          setProgress(Math.round(((i + 1) / totalRows) * 100));
        }
        setBatchResults(results);
      } catch (err: any) { setErrorLog("Excel 处理错误: " + err.message); } finally { setIsProcessing(false); }
    };
    reader.readAsArrayBuffer(file);
  };

  const exportToExcel = () => {
    if (!batchResults) return;
    const worksheet = window.XLSX.utils.json_to_sheet(batchResults);
    const workbook = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(workbook, worksheet, "分析结果");
    window.XLSX.writeFile(workbook, `${projectName || '肿瘤业务传播分析'}_结果.xlsx`);
  };

  const exportToPDF = () => {
    const element = document.getElementById('project-report-content');
    if (!element) return;
    const opt = {
      margin: 0.5,
      filename: `${projectName || '肿瘤业务传播分析'}_评分报告.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    window.html2pdf().set(opt).from(element).save();
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
      setProgress(0);
      setErrorLog("");
    }
  };

  const renderCharts = useCallback(() => {
    if (activeTab === "tab3" && batchResults && window.Plotly) {
      const radarContainer = document.getElementById('radar-chart');
      const scatterContainer = document.getElementById('scatter-chart');
      
      if (!radarContainer || !scatterContainer) return;

      const avg = (key: keyof BatchResult) => 
        batchResults.reduce((a, b) => a + parseFloat(b[key] as string || "0"), 0) / batchResults.length;
      
      const radarData = [
        avg('核心信息匹配'), avg('获客效能'), avg('受众精准度'), avg('媒体分级'), avg('传播质量')
      ];

      window.Plotly.newPlot('radar-chart', [{
        type: 'scatterpolar', 
        r: [...radarData, radarData[0]],
        theta: ['核心信息匹配', '获客效能', '受众精准度', '媒体分级', '传播质量', '核心信息匹配'],
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
      const hoverTexts = batchResults.map(d => `<b>${d.媒体名称}</b><br>标题: ${d.标题.substring(0,15)}...<br>总分: ${d.项目总分}<br>媒体分级: ${d.媒体分级}`);

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
    }
  }, [activeTab, batchResults]);

  useEffect(() => {
    const timer = setTimeout(renderCharts, 200);
    return () => clearTimeout(timer);
  }, [renderCharts, activeTab]);

  return (
    <div className="flex">
      {/* --- Sidebar --- */}
      <div className="st-sidebar no-scrollbar flex flex-col" style={{ width: sidebarWidth }}>
        <div className="flex-1">
          <h2 className="text-lg font-bold mb-4">⚙️ 规则配置</h2>
          <h3 className="text-sm font-bold mt-6 mb-2">📋 项目信息</h3>
          <label className="text-xs font-semibold text-gray-600 block mb-1">项目名称</label>
          <input value={projectName} onChange={e => setProjectName(e.target.value)} className="st-input" />
          <label className="text-xs font-semibold text-gray-600 block mb-1">核心信息 (Key Message)</label>
          <input value={projectKeyMessage} onChange={e => setProjectKeyMessage(e.target.value)} className="st-input" />
          <label className="text-xs font-semibold text-gray-600 block mb-1">项目描述 (用于评估获客逻辑)</label>
          <textarea value={projectDesc} onChange={e => setProjectDesc(e.target.value)} className="st-input h-24 no-scrollbar" />
          <label className="text-xs font-semibold text-gray-600 block mb-2">目标受众模式</label>
          <div className="space-y-1 mb-6">
            {[AudienceMode.GENERAL, AudienceMode.PATIENT, AudienceMode.HCP].map(m => (
              <label key={m} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" checked={audienceMode === m} onChange={() => setAudienceMode(m)} className="w-4 h-4" />{m}
              </label>
            ))}
          </div>
          <div className="border-t pt-4">
            <h3 className="text-sm font-bold mb-1">🏆 媒体分级</h3>
            {(['tier1', 'tier2', 'tier3'] as Array<keyof Tiers>).map(t => (
              <div key={t} className="mb-2">
                <label className="text-[10px] font-bold text-gray-500 block uppercase">
                  {t === 'tier1' ? 'Tier 1 (10分)' : t === 'tier2' ? 'Tier 2 (8分)' : 'Tier 3 (5分)'}
                </label>
                <textarea value={tiers[t]} onChange={e => setTiers({...tiers, [t]: e.target.value})} className="st-input h-16 no-scrollbar text-xs" />
              </div>
            ))}
          </div>
        </div>
        <div className="pt-6 border-t mt-6 mb-8">
          <button onClick={handleReset} className="w-full py-2 border border-red-300 text-red-600 rounded text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-50">🗑️ 清空所有分析数据</button>
        </div>
      </div>

      <div className={`resize-handle ${isResizing ? 'active' : ''}`} style={{ left: sidebarWidth }} onMouseDown={startResizing} />

      <div className="main-content flex-1" style={{ marginLeft: sidebarWidth }}>
        <h1 className="text-4xl font-bold mb-6">📡 肿瘤业务-传播价值 AI 评分系统</h1>
        {errorLog && <div className="st-alert st-error shadow-sm"><span>⚠️</span><div><div className="font-bold mb-1">系统错误:</div><div>{errorLog}</div></div></div>}

        <div className="st-expander">
          <div className="st-expander-header" onClick={() => setIsExpanderOpen(!isExpanderOpen)}>
            <span>查看核心算法公式</span>
            <svg width="16" height="16" className={`transform transition-transform ${isExpanderOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
          {isExpanderOpen && (
            <div className="st-expander-content">
              <div className="text-center text-lg leading-loose">
                <span className="font-bold text-[#1E88E5]">总分</span> = 0.5 × 真需求 + 0.2 × 获客效能 + 0.3 × 声量<br/>
                <span className="font-bold text-[#1E88E5]">真需求</span> = 0.6 × 信息匹配 + 0.4 × 受众精准度 &nbsp;&nbsp;&nbsp;&nbsp; 
                <span className="font-bold text-[#1E88E5]">声量</span> = 0.6 × 传播质量 + 0.4 × 媒体分级
              </div>
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
            <div className="st-alert st-info"><span>📄</span><div>上传新闻稿 Word 文档，AI 将评价核心信息传递情况。</div></div>
            <div className="mb-4">
              <label className="text-sm font-semibold block mb-2">上传 .docx 文件</label>
              <input type="file" accept=".docx" onChange={handleWordFile} className="st-input h-auto py-4 bg-gray-50 border-dashed" />
            </div>
            {isProcessing && <div className="text-blue-600 font-bold mb-4 flex items-center gap-2 animate-pulse">⏳ AI 正在深度阅读文档...</div>}
            {wordResult && (
              <div className="mt-8 border-t pt-6 animate-fadeIn">
                <div className="st-metric max-w-xs mb-6"><div className="st-metric-label">信息匹配度</div><div className="st-metric-value">{wordResult.km_score}/10</div></div>
                <div className="bg-blue-50 border-l-4 border-[#1E88E5] p-4 rounded-r"><h4 className="font-bold text-[#1E88E5] text-sm mb-2">💡 AI 简评</h4><p className="text-sm text-gray-800 leading-relaxed">{wordResult.comment}</p></div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tab2' && (
          <div className="animate-fadeIn">
            <div className="st-alert st-info"><span>💡</span><div>微信公众号、视频号等封闭平台内容无法自动爬取，请在 Excel 中插入“正文”列并手动填入文章内容。</div></div>
            <div className="mb-4">
              <label className="text-sm font-semibold block mb-2">上传媒体监测报表</label>
              <input type="file" accept=".xlsx,.csv" onChange={handleExcelFile} className="st-input h-auto py-4 bg-gray-50 border-dashed" />
            </div>
            {isProcessing && (
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1 font-bold text-blue-600"><span>分析进度</span><span>{progress}%</span></div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden"><div className="bg-[#1E88E5] h-full transition-all duration-300" style={{width: `${progress}%`}}></div></div>
              </div>
            )}
            {batchResults && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold">📋 媒体报道评分</h3>
                  <div className="flex gap-2">
                    <div className="relative">
                      <button onClick={() => setShowColPicker(!showColPicker)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-xs font-medium border border-gray-300 flex items-center gap-1 transition-all">📊 列显示</button>
                      {showColPicker && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3 w-48 animate-fadeIn">
                          <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase">显示列</p>
                          {pickableColumns.map(col => (
                            <label key={col} className="flex items-center gap-2 mb-1 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors">
                              <input type="checkbox" checked={visibleColumns[col]} onChange={() => setVisibleColumns({...visibleColumns, [col]: !visibleColumns[col]})} className="w-3 h-3" />
                              <span className="text-xs text-gray-600">{col}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="st-button-primary text-xs px-4" onClick={exportToExcel}>导出 Excel</button>
                  </div>
                </div>
                <div className="overflow-auto max-h-[600px] border border-gray-200 rounded-lg shadow-sm no-scrollbar">
                  <table className="border-separate border-spacing-0 w-full table-fixed">
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr>
                        {visibleColumns["标题"] && <th onClick={() => requestSort('标题')} className="border-b bg-[#f8f9fa] py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors text-xs">标题</th>}
                        {visibleColumns["媒体名称"] && <th onClick={() => requestSort('媒体名称')} className="border-b bg-[#f8f9fa] py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors text-xs">媒体名称</th>}
                        {visibleColumns["媒体分级"] && <th onClick={() => requestSort('媒体分级')} className="border-b bg-[#f8f9fa] py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors text-xs">媒体分级</th>}
                        {visibleColumns["受众精准度"] && <th onClick={() => requestSort('受众精准度')} className="border-b bg-[#f8f9fa] py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors text-xs">受众精准度</th>}
                        {visibleColumns["传播质量"] && <th onClick={() => requestSort('传播质量')} className="border-b bg-[#f8f9fa] py-3 px-4 text-left cursor-pointer hover:bg-gray-200 transition-colors text-xs">传播质量</th>}
                        {visibleColumns["声量"] && <th onClick={() => requestSort('声量')} className="border-b bg-[#f8f9fa] py-3 px-4 text-left font-bold cursor-pointer hover:bg-gray-200 transition-colors text-xs">声量</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults?.map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50/50 transition-colors border-b">
                          {visibleColumns["标题"] && <td className="py-2 px-4 truncate text-[11px]" title={r.标题}>{r.标题}</td>}
                          {visibleColumns["媒体名称"] && <td className="py-2 px-4 truncate text-[11px]">{r.媒体名称}</td>}
                          {visibleColumns["媒体分级"] && <td className="py-2 px-4 text-[11px]">{r.媒体分级}</td>}
                          {visibleColumns["受众精准度"] && <td className="py-2 px-4 text-[11px]">{r.受众精准度}</td>}
                          {visibleColumns["传播质量"] && <td className="py-2 px-4 text-[11px]">{r.传播质量}</td>}
                          {visibleColumns["声量"] && <td className="py-2 px-4 font-bold text-[#1E88E5] text-[11px]">{r.声量}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tab3' && (
          <div className="animate-fadeIn min-w-0">
            {!batchResults ? (
              <div className="st-alert st-info"><span>📈</span><div>请先完成“新闻稿评分”和“媒体报道评分”。</div></div>
            ) : (
              <div className="space-y-10 w-full overflow-hidden" id="project-report-content">
                <h3 className="text-xl font-bold">📈 项目评分: {projectName || '未命名项目'}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[{ l: "项目总分", k: "项目总分" }, { l: "真需求", k: "真需求" }, { l: "获客效能", k: "获客效能" }, { l: "声量", k: "声量" }].map(m => {
                    const avgVal = batchResults.reduce((a, b) => a + parseFloat(b[m.k as keyof BatchResult] as string || "0"), 0) / batchResults.length;
                    return (
                      <div key={m.l} className="st-metric shadow-sm border border-blue-50">
                        <div className="st-metric-label">{m.l}</div>
                        <div className="st-metric-value">{avgVal.toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 w-full items-start">
                  <div className="bg-white p-4 border rounded-xl shadow-sm min-h-[440px] flex flex-col overflow-hidden min-w-0">
                    <p className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider text-center">🕸️ 传播价值分布雷达</p>
                    <div id="radar-chart" className="flex-1 w-full min-h-[380px]"></div>
                  </div>
                  <div className="bg-white p-4 border rounded-xl shadow-sm min-h-[440px] flex flex-col overflow-hidden min-w-0">
                    <p className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider text-center">💠 媒体价值矩阵 (真需求 vs 声量)</p>
                    <div id="scatter-chart" className="flex-1 w-full min-h-[380px]"></div>
                  </div>
                </div>

                <div className="mt-10 animate-fadeIn">
                   <h3 className="text-lg font-bold mb-4 flex items-center gap-2">🏆 媒体榜单</h3>
                   <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                     <table className="w-full text-sm">
                       <thead>
                         <tr className="bg-gray-50 text-gray-600">
                           <th className="py-3 px-4 text-center w-16 border-b">排名</th>
                           <th className="py-3 px-4 text-left border-b">媒体名称</th>
                           <th className="py-3 px-4 text-left border-b">标题</th>
                           <th className="py-3 px-4 text-right border-b">评分</th>
                         </tr>
                       </thead>
                       <tbody>
                         {top10Results.map((item, idx) => (
                           <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                             <td className="py-3 px-4 text-center font-bold">
                               {idx === 0 ? <span className="text-yellow-500 text-lg">🥇</span> : idx === 1 ? <span className="text-gray-400 text-lg">🥈</span> : idx === 2 ? <span className="text-orange-400 text-lg">🥉</span> : idx + 1}
                             </td>
                             <td className="py-3 px-4 font-medium text-gray-800">{item.媒体名称}</td>
                             <td className="py-3 px-4 text-gray-500 truncate max-w-[250px]" title={item.标题}>{item.标题}</td>
                             <td className="py-3 px-4 text-right font-bold text-[#1E88E5]">{item.项目总分}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                </div>

                <div className="flex justify-center mt-12 mb-8 no-print">
                  <button onClick={exportToPDF} className="st-button-primary px-10 py-3 rounded-full text-base shadow-lg hover:shadow-xl transform transition-all active:scale-95">📥 下载评分报告 (PDF)</button>
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