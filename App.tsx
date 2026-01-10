import React, { useState, useRef, useCallback, Suspense } from 'react';
import { UploadArea } from './components/UploadArea';
import { PairList } from './components/PairList';
import { CompareView } from './components/CompareView';
import { ScreenshotPair, LlmRequestPayload, BulkProcessingState, ScreenshotReport, AppLanguage } from './types';
import { callTranslationQaLLM } from './services/llmService';
import { Layers, Activity, BookOpen, PanelLeftOpen, PanelLeftClose, PlayCircle, Globe, Loader2 } from 'lucide-react';
import { LLM_DISPLAY_NAME, APP_VERSION, UI_TEXT } from './constants';
import JSZip from 'jszip';

// Code Splitting: Lazy load heavy components
const ReportPanel = React.lazy(() => import('./components/ReportPanel').then(module => ({ default: module.ReportPanel })));
const GlobalSummary = React.lazy(() => import('./components/GlobalSummary').then(module => ({ default: module.GlobalSummary })));
const BulkRunModal = React.lazy(() => import('./components/BulkRunModal').then(module => ({ default: module.BulkRunModal })));

const App: React.FC = () => {
  // Language State
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => {
    const saved = localStorage.getItem('vision_lqa_lang');
    return (saved === 'en' || saved === 'zh') ? saved : 'zh';
  });

  const [pairs, setPairs] = useState<ScreenshotPair[]>([]);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [glossaryText, setGlossaryText] = useState<string>('');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [activeRightPanel, setActiveRightPanel] = useState<'report' | 'global'>('report');
  
  // Bulk Run State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkState, setBulkState] = useState<BulkProcessingState>({
    isProcessing: false,
    total: 0,
    completed: 0,
    success: 0,
    failed: 0,
    errors: [],
    isComplete: false
  });
  
  const t = UI_TEXT[appLanguage];
  const abortControllerRef = useRef<AbortController | null>(null);

  // Handle Language Change
  const toggleLanguage = () => {
    const newLang = appLanguage === 'zh' ? 'en' : 'zh';
    setAppLanguage(newLang);
    localStorage.setItem('vision_lqa_lang', newLang);
  };

  // Demo Data Loading
  const loadDemoData = useCallback(() => {
    const demoId = "demo-pair-01";
    const demoImage = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?q=80&w=1200&auto=format&fit=crop";

    // Demo report needs to match new schema (no Zh suffixes)
    // We provide a generic demo report
    const demoReport: ScreenshotReport = {
      screenshotId: demoId,
      overall: {
        qualityLevel: 'Poor',
        scores: { accuracy: 4, terminology: 3, layout: 2, grammar: 5, formatting: 4, localizationTone: 4 },
        sceneDescription: appLanguage === 'zh' 
          ? "图中展示了一只猫咪看着日落的精美画面。右侧是德语设置界面。" 
          : "The image shows a beautiful cat looking at the sunset. On the right is the German settings interface.",
        mainProblemsSummary: appLanguage === 'zh' 
          ? "主要问题在于文本重叠和术语不一致。" 
          : "Main issues are text overlap and inconsistent terminology."
      },
      issues: [
        {
          id: "ISSUE-01",
          location: "Header",
          issueCategory: "Layout",
          severity: "Major",
          sourceText: "Settings",
          targetText: "Einstellungen für Benutzer",
          description: appLanguage === 'zh' ? "文本过长导致换行。" : "Text is too long causing line wrap.",
          suggestionsTarget: ["Einstellungen"]
        }
      ],
      summary: {
        severeCount: 0,
        majorCount: 1,
        minorCount: 0,
        optimizationAdvice: appLanguage === 'zh' ? "建议缩短德语翻译。" : "Suggest shortening German translations.",
        termAdvice: ""
      }
    };

    setPairs([
      {
        id: demoId,
        fileName: "RingCentral_Cat_Demo",
        enImageUrl: demoImage,
        deImageUrl: demoImage,
        targetLanguage: 'de-DE',
        status: 'completed', // Set to completed to show the report immediately
        report: demoReport
      }
    ]);
    setSelectedPairId(demoId);
    setGlossaryText("Site = Standort\nExtension = Nebenstelle");
    setActiveRightPanel('report');
  }, [appLanguage]);

  // Performance: Removed automatic loadDemoData effect to save initial bandwidth.
  // User can manually load demo data via the button.

  const handlePairsCreated = (newPairs: ScreenshotPair[]) => {
    setPairs(prev => [...prev, ...newPairs]);
    if (newPairs.length > 0 && !selectedPairId) {
      setSelectedPairId(newPairs[0].id);
      setActiveRightPanel('report'); // Switch to report view when user uploads files
    }
  };

  const updatePairStatus = (id: string, updates: Partial<ScreenshotPair>) => {
    setPairs(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleGenerateReport = async () => {
    if (!selectedPairId) return;

    updatePairStatus(selectedPairId, { status: 'analyzing', errorMessage: undefined });

    const pair = pairs.find(p => p.id === selectedPairId);
    if (!pair) return;

    try {
      const payload: LlmRequestPayload = {
        screenshotId: pair.id,
        enImageBase64: pair.enImageUrl, 
        deImageBase64: pair.deImageUrl,
        targetLanguage: pair.targetLanguage,
        glossaryText,
        reportLanguage: appLanguage // Pass current language
      };

      const response = await callTranslationQaLLM(payload);
      
      updatePairStatus(selectedPairId, { status: 'completed', report: response.report });
      
    } catch (error: any) {
      console.error("Analysis failed", error);
      const msg = error instanceof Error ? error.message : "Unknown error occurred";
      updatePairStatus(selectedPairId, { status: 'failed', errorMessage: msg });
    }
  };

  // --- Bulk Operation Logic ---

  const handleOpenBulkModal = () => {
    setIsBulkModalOpen(true);
    if (!bulkState.isProcessing && !bulkState.isComplete) {
       setBulkState({
         isProcessing: false,
         total: 0,
         completed: 0,
         success: 0,
         failed: 0,
         errors: [],
         isComplete: false
       });
    }
  };

  const handleCancelBulk = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setBulkState(prev => ({ ...prev, isProcessing: false, isComplete: true }));
  };

  const startBulkAnalysis = async () => {
    const pendingItems = pairs.filter(p => p.status === 'pending' || p.status === 'failed');
    
    if (pendingItems.length === 0) return;
    if (pendingItems.length > 100) {
      alert("Please process max 100 screenshots at a time.");
      return;
    }

    setBulkState({
      isProcessing: true,
      total: pendingItems.length,
      completed: 0,
      success: 0,
      failed: 0,
      errors: [],
      isComplete: false
    });

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const processItem = async (pair: ScreenshotPair, retries = 2): Promise<boolean> => {
      if (signal.aborted) return false;
      updatePairStatus(pair.id, { status: 'analyzing', errorMessage: undefined });

      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Request timed out (30s)")), 30000)
        );

        const payload: LlmRequestPayload = {
          screenshotId: pair.id,
          enImageBase64: pair.enImageUrl,
          deImageBase64: pair.deImageUrl,
          targetLanguage: pair.targetLanguage,
          glossaryText,
          reportLanguage: appLanguage // Pass current language for bulk
        };

        const response: any = await Promise.race([
           callTranslationQaLLM(payload),
           timeoutPromise
        ]);

        updatePairStatus(pair.id, { status: 'completed', report: response.report });
        return true;

      } catch (error: any) {
        if (retries > 0 && !signal.aborted) {
          return processItem(pair, retries - 1);
        }
        
        const msg = error instanceof Error ? error.message : "Unknown error";
        updatePairStatus(pair.id, { status: 'failed', errorMessage: msg });
        
        setBulkState(prev => ({
          ...prev,
          errors: [...prev.errors, { id: pair.id, fileName: pair.fileName, error: msg }]
        }));
        return false;
      }
    };

    const concurrency = 5;
    const queue = [...pendingItems];
    const workers = Array(concurrency).fill(null).map(async () => {
      while(queue.length > 0 && !signal.aborted) {
        const item = queue.shift();
        if (item) {
          const success = await processItem(item);
          setBulkState(prev => ({
            ...prev,
            completed: prev.completed + 1,
            success: success ? prev.success + 1 : prev.success,
            failed: success ? prev.failed : prev.failed + 1
          }));
        }
      }
    });

    await Promise.all(workers);
    setBulkState(prev => ({ ...prev, isProcessing: false, isComplete: true }));
    abortControllerRef.current = null;
  };

  const generateSummaryCsv = () => {
    const criticalItems = pairs.filter(p => 
      p.report && 
      p.report.overall && 
      (p.report.overall.qualityLevel === 'Critical' || p.report.overall.qualityLevel === 'Poor')
    );

    if (criticalItems.length === 0) {
      alert("No 'Critical' or 'Poor' items found to export.");
      return;
    }

    const headers = ["Screenshot ID", "File Name", "Quality Level", "Total Issues", "Major Issues", "Critical Issues", "Main Problems"];
    const rows = criticalItems.map(p => {
      const r = p.report!;
      return [
        r.screenshotId,
        `"${p.fileName.replace(/"/g, '""')}"`,
        r.overall.qualityLevel,
        r.issues.length,
        r.summary.majorCount,
        r.summary.severeCount,
        `"${r.overall.mainProblemsSummary.replace(/"/g, '""')}"`
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `LQA_Defect_Summary_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateBulkZip = async () => {
    const completedPairs = pairs.filter(p => p.status === 'completed' && p.report && p.report.overall);
    if (completedPairs.length === 0) {
      alert("No completed reports to download.");
      return;
    }

    const zip = new JSZip();
    for (const pair of completedPairs) {
        const html = generateReportHtml(pair.report!, pair.fileName, pair.targetLanguage, t);
        const qualityPrefix = pair.report!.overall.qualityLevel;
        zip.file(`${qualityPrefix}_${pair.fileName}.html`, html);
        zip.file(`${qualityPrefix}_${pair.fileName}.json`, JSON.stringify(pair.report, null, 2));
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    const distinctLangs = new Set(completedPairs.map(p => p.targetLanguage));
    const langCode = distinctLangs.size === 1 ? [...distinctLangs][0] : 'Mixed';
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `VisionLQA_${langCode}_${dateStr}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedPair = pairs.find(p => p.id === selectedPairId) || null;
  const pendingCount = pairs.filter(p => p.status === 'pending' || p.status === 'failed').length;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900">
      
      <Suspense fallback={null}>
         {isBulkModalOpen && (
           <BulkRunModal 
             isOpen={isBulkModalOpen}
             state={bulkState}
             pendingCount={pendingCount}
             onClose={() => setIsBulkModalOpen(false)}
             onCancel={handleCancelBulk}
             onStart={startBulkAnalysis}
             onDownloadCsv={generateSummaryCsv}
             onDownloadZip={generateBulkZip}
             t={t}
           />
         )}
      </Suspense>

      {/* Navbar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-accent p-1.5 rounded text-white">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800">{t.title}</h1>
        </div>
        <div className="flex items-center space-x-4">
           
           <div className="hidden md:flex flex-col items-end mr-2">
             <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700 tracking-tight">{LLM_DISPLAY_NAME}</span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded border border-slate-200">{APP_VERSION}</span>
             </div>
             <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-medium text-emerald-600">Active</span>
             </div>
           </div>

           <div className="h-6 w-px bg-slate-200"></div>

           {/* Language Switcher */}
           <button 
             onClick={toggleLanguage}
             className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-bold transition-colors"
           >
             <Globe className="w-3.5 h-3.5" />
             <span>{appLanguage === 'zh' ? '中文' : 'EN'}</span>
           </button>
           
           <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

           <button 
             onClick={handleOpenBulkModal}
             className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm"
             title={t.runBulk}
           >
             <PlayCircle className="w-4 h-4" />
             <span>{t.runBulk} ({pendingCount})</span>
           </button>

           <div className="h-6 w-px bg-slate-200"></div>
           
           <button onClick={loadDemoData} className="text-xs font-medium text-accent hover:underline">
             {t.loadDemo}
           </button>
           
           <button 
            onClick={() => setActiveRightPanel('global')}
            className={`flex items-center space-x-1 text-sm font-medium px-3 py-1.5 rounded transition-colors ${activeRightPanel === 'global' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
           >
             <Activity className="w-4 h-4" />
             <span>{t.globalStats}</span>
           </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden">
        
        <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} flex flex-col bg-white border-r border-slate-200 transition-all duration-300 relative shrink-0`}>
          <div className="p-4 border-b border-slate-100">
            <UploadArea onPairsCreated={handlePairsCreated} t={t} />
          </div>
          
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <label className="flex items-center text-xs font-bold text-slate-500 mb-2">
              <BookOpen className="w-3 h-3 mr-1" />
              {t.projectContext}
            </label>
            <textarea 
              className="w-full text-xs p-2 border border-slate-200 rounded h-20 focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
              placeholder="e.g. Site = Standort..."
              value={glossaryText}
              onChange={(e) => setGlossaryText(e.target.value)}
            />
          </div>

          <div className="p-2 bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-3">
            {t.screenshotsList} ({pairs.length})
          </div>
          
          <PairList 
            pairs={pairs} 
            selectedId={selectedPairId} 
            onSelect={(id) => {
              setSelectedPairId(id);
              setActiveRightPanel('report');
            }} 
          />
        </aside>

        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="absolute bottom-4 left-4 z-50 p-2 bg-white border border-slate-300 rounded-full shadow-md text-slate-600 hover:bg-slate-50"
          style={{ left: isSidebarOpen ? '19rem' : '1rem' }}
        >
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        <section className="flex-1 relative border-r border-slate-200 bg-slate-200 overflow-hidden">
          <CompareView pair={selectedPair} t={t} />
        </section>

        <aside className="w-[400px] flex flex-col bg-white shrink-0 shadow-xl z-10 relative">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm">Loading module...</p>
            </div>
          }>
            {activeRightPanel === 'global' ? (
              <GlobalSummary pairs={pairs} t={t} />
            ) : (
              <ReportPanel 
                pair={selectedPair} 
                onGenerate={handleGenerateReport}
                isGenerating={selectedPair?.status === 'analyzing'}
                glossary={glossaryText}
                t={t}
              />
            )}
          </Suspense>
        </aside>

      </main>
    </div>
  );
};

export default App;

// Helper: Updated to accept UI Translations
const generateReportHtml = (report: ScreenshotReport, fileName: string, targetLang: string, t: any) => {
    if (!report || !report.overall || !report.summary || !report.issues) {
      return `<html><body><h1>Error</h1></body></html>`;
    }

    const { overall, issues, summary } = report;
    const date = new Date().toLocaleString();
    const targetLangLabel = targetLang;

    const categoryCounts: Record<string, number> = {};
    issues.forEach(issue => {
      categoryCounts[issue.issueCategory] = (categoryCounts[issue.issueCategory] || 0) + 1;
    });

    const styles = `
      body { font-family: sans-serif; color: #334155; line-height: 1.5; max-width: 900px; margin: 0 auto; padding: 40px; background: #f8fafc; }
      .header { border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
      .title { font-size: 24px; font-weight: bold; color: #0f172a; }
      .meta { color: #64748b; font-size: 14px; }
      .section { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
      .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; }
      .issue-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 16px; border-left-width: 5px; background: white; }
      .issue-critical { border-left-color: #ef4444; } .issue-major { border-left-color: #f97316; } .issue-minor { border-left-color: #eab308; }
      .text-box { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 8px; }
    `;

    const issueHtml = issues.map(issue => `
      <div class="issue-card issue-${issue.severity.toLowerCase()}">
        <div><strong>${issue.id}</strong> | ${issue.issueCategory} | <span style="color:red">${issue.severity}</span></div>
        <p>${issue.description}</p>
        <div class="text-box"><strong>Source:</strong> ${issue.sourceText}</div>
        <div class="text-box"><strong>Current:</strong> ${issue.targetText}</div>
        <div style="margin-top:8px; color:green;"><strong>Suggestion:</strong> ${issue.suggestionsTarget.join(', ')}</div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head><meta charset="utf-8"><title>LQA - ${fileName}</title><style>${styles}</style></head>
        <body>
          <div class="header">
            <div><div class="title">Vision LQA Report</div><div>File: ${fileName}</div></div>
            <div class="meta">${date}</div>
          </div>
          <div class="section">
            <div class="section-title">Summary</div>
            <p>${overall.mainProblemsSummary}</p>
            <div>Quality: <strong>${overall.qualityLevel}</strong> | Issues: ${issues.length}</div>
          </div>
          <div class="section">
             <div class="section-title">Optimization Advice</div>
             <p>${summary.optimizationAdvice}</p>
          </div>
          <div class="section">
            <div class="section-title">Issues</div>
            ${issueHtml}
          </div>
        </body>
      </html>
    `;
};