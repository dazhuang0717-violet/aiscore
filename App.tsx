
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { analyzeWithGemini } from './services/geminiService';
import { Tiers, WordResult, BatchResult, AudienceMode, AIAnalysisResult } from './types';

declare global {
  interface Window {
    mammoth: any;
    XLSX: any;
    Plotly: any;
  }
}

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

  // --- Data Results ---
  const [wordResult, setWordResult] = useState<WordResult | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);

  // --- Resize Logic ---
  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth > 200 && newWidth < 600) {
        setSidebarWidth(newWidth);
      }
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

  // --- Core Utility Functions ---
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
      const rawScore = Math.log10(v + i * 5 + 1) * 1.5;
      return Math.min(10.0, Math.round(rawScore * 10) / 10);
    } catch { return 0.0; }
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

  // --- Helper to Scrape Content from URL ---
  const fetchUrlContent = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(`https://r.jina.ai/${url}`);
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  };

  // --- Handlers ---
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

      if (fullText.trim().length < 10) {
        throw new Error(`文档内容过少 (提取到 ${fullText.length} 字)，无法分析。`);
      }

      const aiRes = await analyzeWithGemini(fullText, audienceMode, projectKeyMessage, projectDesc);
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
          const views = row['浏览量'] || row['PV'] || 0;
          const interactions = (parseFloat(row['点赞量']) || 0) + (parseFloat(row['转发量']) || 0) + (parseFloat(row['评论量']) || 0);
          const url = row['URL'] || row['链接'] || row['Link'] || "";
          
          const volQuality = calculateVolumeQuality(views, interactions);
          const tierScore = getMediaTierScore(mediaName);
          const volTotal = 0.6 * volQuality + 0.4 * tierScore;
          
          let aiRes: AIAnalysisResult = { km_score: 0, acquisition_score: 0, audience_precision_score: 0, comment: "待评估" };
          let content = row['正文'] || row['Content'] || row['标题'] || "";
          
          // 如果正文为空但有 URL，尝试抓取内容
          if (!content && url && url.startsWith("http")) {
            const scraped = await fetchUrlContent(url);
            if (scraped) {
              content = scraped;
            } else {
              aiRes.comment = "自动抓取网页内容失败";
            }
          }
          
          if (content) {
            try { 
              aiRes = await analyzeWithGemini(content, audienceMode, projectKeyMessage, projectDesc, mediaName); 
            } catch (e: any) {
              aiRes.comment = `AI分析失败: ${e.message}`;
            }
          }
          
          const trueDemand = 0.6 * aiRes.km_score + 0.4 * aiRes.audience_precision_score;
          const totalScore = (0.5 * trueDemand) + (0.2 * aiRes.acquisition_score) + (0.3 * volTotal);
          
          results.push({
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
      } catch (err: any) {
        setErrorLog("Excel 处理错误: " + err.message);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- Rendering Charts ---
  useEffect(() => {
    if (activeTab === "tab3" && batchResults && window.Plotly) {
      const avg = (key: keyof BatchResult) => 
        batchResults.reduce((a, b) => a + parseFloat(b[key] as string), 0) / batchResults.length;
      
      const radarData = [
        avg('核心信息匹配'), 
        avg('获客效能'), 
        avg('受众精准度'), 
        avg('媒体分级'), 
        avg('传播质量')
      ];

      window.Plotly.newPlot('radar-chart', [{
        type: 'scatterpolar', 
        r: radarData,
        theta: ['核心信息匹配', '获客效能', '受众精准度', '媒体分级', '传播质量'],
        fill: 'toself', 
        line: { color: '#1E88E5' }, 
        fillcolor: 'rgba(30, 136, 229, 0.3)'
      }], { 
        polar: { radialaxis: { visible: true, range: [0, 10] } }, 
        showlegend: false, 
        height: 350, 
        margin: { t: 30, b: 30, l: 30, r: 30 } 
      }, { displayModeBar: false });

      window.Plotly.newPlot('scatter-chart', [{
        x: batchResults.map(d => parseFloat(d.声量)), 
        y: batchResults.map(d => parseFloat(d.真需求)),
        mode: 'markers', 
        text: batchResults.map(d => d.媒体名称),
        marker: { 
          size: batchResults.map(d => Math.max(10, parseFloat(d.项目总分) * 4)), 
          color: batchResults.map(d => parseFloat(d.项目总分)), 
          colorscale: 'Blues', 
          showscale: true 
        }
      }], { 
        xaxis: { title: '声量' }, 
        yaxis: { title: '真需求' }, 
        height: 350, 
        margin: { t: 20, b: 40, l: 40, r: 20 } 
      }, { displayModeBar: false });
    }
  }, [activeTab, batchResults]);

  return (
    <div className="flex">
      {/* --- Sidebar --- */}
      <div className="st-sidebar no-scrollbar" style={{ width: sidebarWidth }}>
        <h2 className="text-lg font-bold mb-4">⚙️ 规则配置</h2>
        
        <h3 className="text-sm font-bold mt-6 mb-2">📋 项目信息</h3>
        <label className="text-xs font-semibold text-gray-600 block mb-1">项目名称</label>
        <input 
          value={projectName} 
          onChange={e => setProjectName(e.target.value)} 
          className="st-input" 
        />
        
        <label className="text-xs font-semibold text-gray-600 block mb-1">核心信息 (Key Message)</label>
        <input 
          value={projectKeyMessage} 
          onChange={e => setProjectKeyMessage(e.target.value)} 
          className="st-input" 
        />
        
        <label className="text-xs font-semibold text-gray-600 block mb-1">项目描述 (用于评估获客)</label>
        <textarea 
          value={projectDesc} 
          onChange={e => setProjectDesc(e.target.value)} 
          className="st-input h-24 no-scrollbar" 
        />
        
        <label className="text-xs font-semibold text-gray-600 block mb-2">目标受众模式</label>
        <div className="space-y-1 mb-6">
          {[AudienceMode.GENERAL, AudienceMode.PATIENT, AudienceMode.HCP].map(m => (
            <label key={m} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input 
                type="radio" 
                checked={audienceMode === m} 
                onChange={() => setAudienceMode(m)} 
                className="w-4 h-4" 
              />
              {m}
            </label>
          ))}
        </div>
        
        <div className="border-t pt-4">
          <h3 className="text-sm font-bold mb-1">🏆 媒体分级</h3>
          <p className="text-[10px] text-gray-400 mb-2">使用逗号分隔媒体名称</p>
          {(['tier1', 'tier2', 'tier3'] as Array<keyof Tiers>).map(t => (
            <div key={t} className="mb-2">
              <label className="text-[10px] font-bold text-gray-500 block uppercase">
                {t === 'tier1' ? 'Tier 1 (10分)' : t === 'tier2' ? 'Tier 2 (8分)' : 'Tier 3 (5分)'}
              </label>
              <textarea 
                value={tiers[t]} 
                onChange={e => setTiers({...tiers, [t]: e.target.value})} 
                className="st-input h-16 no-scrollbar text-xs" 
              />
            </div>
          ))}
        </div>
      </div>

      {/* --- Resize Handle --- */}
      <div 
        className={`resize-handle ${isResizing ? 'active' : ''}`} 
        style={{ left: sidebarWidth }}
        onMouseDown={startResizing}
      />

      {/* --- Main Content --- */}
      <div className="main-content flex-1" style={{ marginLeft: sidebarWidth }}>
        <h1 className="text-4xl font-bold mb-6">📡 肿瘤业务-传播价值 AI 评分系统</h1>

        {errorLog && (
          <div className="st-alert st-error shadow-sm">
            <span>⚠️</span>
            <div>
              <div className="font-bold mb-1">系统错误:</div>
              <div>{errorLog}</div>
            </div>
          </div>
        )}

        {/* Expander */}
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

        {/* Tabs */}
        <div className="st-tabs-list">
          <div className={`st-tab ${activeTab === 'tab1' ? 'st-tab-active' : ''}`} onClick={() => setActiveTab('tab1')}>📄 新闻稿评分</div>
          <div className={`st-tab ${activeTab === 'tab2' ? 'st-tab-active' : ''}`} onClick={() => setActiveTab('tab2')}>📊 媒体报道评分</div>
          <div className={`st-tab ${activeTab === 'tab3' ? 'st-tab-active' : ''}`} onClick={() => setActiveTab('tab3')}>📈 项目评分</div>
        </div>

        {/* Tab Content */}
        {activeTab === 'tab1' && (
          <div className="animate-fadeIn">
            <div className="st-alert st-info">
              <span>📄</span>
              <div>上传新闻稿 Word 文档，AI 将评价核心信息传递情况。</div>
            </div>
            
            <div className="mb-4">
              <label className="text-sm font-semibold block mb-2">上传 .docx 文件</label>
              <input type="file" accept=".docx" onChange={handleWordFile} className="st-input h-auto py-4 bg-gray-50 border-dashed" />
            </div>

            {isProcessing && <div className="text-blue-600 font-bold mb-4 flex items-center gap-2 animate-pulse">⏳ AI 正在深度阅读文档...</div>}
            
            {wordResult && (
              <div className="mt-8 border-t pt-6">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="st-metric">
                    <div className="st-metric-label">信息匹配度</div>
                    <div className="st-metric-value">{wordResult.km_score}/10</div>
                  </div>
                  <div className="st-metric">
                    <div className="st-metric-label">获客效能</div>
                    <div className="st-metric-value">{wordResult.acquisition_score}/10</div>
                  </div>
                  <div className="st-metric">
                    <div className="st-metric-label">受众精准度</div>
                    <div className="st-metric-value">{wordResult.audience_precision_score}/10</div>
                  </div>
                </div>
                <div className="bg-blue-50 border-l-4 border-[#1E88E5] p-4 rounded-r">
                  <h4 className="font-bold text-[#1E88E5] text-sm mb-2">💡 AI 简评 ({wordResult.textLen} 字)</h4>
                  <p className="text-sm text-gray-800 leading-relaxed">{wordResult.comment}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tab2' && (
          <div className="animate-fadeIn">
            <div className="st-alert st-info">
              <span>💡</span>
              <div>微信公众号、视频号等封闭平台内容无法自动爬取，请在 Excel 中插入“正文”列并手动填入文章内容。</div>
            </div>
            <div className="mb-4">
              <label className="text-sm font-semibold block mb-2">上传媒体监测报表</label>
              <input type="file" accept=".xlsx,.csv" onChange={handleExcelFile} className="st-input h-auto py-4 bg-gray-50 border-dashed" />
            </div>
            {isProcessing && (
              <div className="mb-4">
                <div className="flex justify-between text-xs mb-1 font-bold text-blue-600"><span>分析进度</span><span>{progress}%</span></div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#1E88E5] h-full transition-all duration-300" style={{width: `${progress}%`}}></div>
                </div>
              </div>
            )}
            {batchResults && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold">📋 媒体报道评分 (前50条记录)</h3>
                  <button className="st-button-primary text-xs" onClick={() => window.print()}>导出 PDF</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="shadow-sm border-separate border-spacing-0 rounded-lg border overflow-hidden">
                    <thead>
                      <tr>
                        <th className="border-b">媒体名称</th>
                        <th className="border-b">分级</th>
                        <th className="border-b">精准度</th>
                        <th className="border-b">质量</th>
                        <th className="border-b font-bold">声量</th>
                        <th className="border-b">AI 评价</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.slice(0, 50).map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50/50">
                          <td className="border-b">{r.媒体名称}</td>
                          <td className="border-b">{r.媒体分级}</td>
                          <td className="border-b">{r.受众精准度}</td>
                          <td className="border-b">{r.传播质量}</td>
                          <td className="border-b font-bold text-[#1E88E5]">{r.声量}</td>
                          <td className="border-b text-xs text-gray-500 italic max-w-xs truncate" title={r.评价}>{r.评价}</td>
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
          <div className="animate-fadeIn">
            {!batchResults ? (
              <div className="st-alert st-info">
                <span>📈</span>
                <div>请先完成“新闻稿评分”和“媒体报道评分”。</div>
              </div>
            ) : (
              <div className="space-y-10">
                <h3 className="text-xl font-bold">📈 项目评分概览: {projectName || '未命名项目'}</h3>
                <div className="grid grid-cols-4 gap-6">
                  {[ 
                    { l: "项目总分", k: "项目总分" }, 
                    { l: "平均真需求", k: "真需求" }, 
                    { l: "平均获客效能", k: "获客效能" }, 
                    { l: "平均声量", k: "声量" } 
                  ].map(m => {
                    const avgVal = batchResults.reduce((a, b) => a + parseFloat(b[m.k as keyof BatchResult] as string || "0"), 0) / batchResults.length;
                    return (
                      <div key={m.l} className="st-metric shadow-sm">
                        <div className="st-metric-label">{m.l}</div>
                        <div className="st-metric-value">{avgVal.toFixed(2)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-8 pt-6">
                  <div className="bg-white p-4 border rounded-xl shadow-sm">
                    <p className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider text-center">🕸️ 传播价值分布雷达</p>
                    <div id="radar-chart"></div>
                  </div>
                  <div className="bg-white p-4 border rounded-xl shadow-sm">
                    <p className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider text-center">💠 媒体价值矩阵 (真需求 vs 声量)</p>
                    <div id="scatter-chart"></div>
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
