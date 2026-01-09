import React, { useState, useRef, useCallback } from 'react';
import { UploadArea } from './components/UploadArea';
import { PairList } from './components/PairList';
import { CompareView } from './components/CompareView';
import { ReportPanel } from './components/ReportPanel';
import { GlobalSummary } from './components/GlobalSummary';
import { BulkRunModal } from './components/BulkRunModal';
import { ScreenshotPair, LlmRequestPayload, BulkProcessingState, ScreenshotReport } from './types';
import { callTranslationQaLLM } from './services/llmService';
import { Layers, Activity, BookOpen, PanelLeftOpen, PanelLeftClose, PlayCircle } from 'lucide-react';
import JSZip from 'jszip';

const App: React.FC = () => {
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
  
  // Abort controller reference for bulk operations
  const abortControllerRef = useRef<AbortController | null>(null);

  // Demo Data Loading
  const loadDemoData = () => {
    const demoId = "demo-pair-01";
    setPairs([
      {
        id: demoId,
        fileName: "CallHandling_Settings",
        enImageUrl: "https://picsum.photos/seed/en/800/600",
        deImageUrl: "https://picsum.photos/seed/de/800/600",
        targetLanguage: 'de-DE',
        status: 'pending'
      }
    ]);
    setSelectedPairId(demoId);
    setGlossaryText("Site = Standort\nExtension = Nebenstelle");
  };

  const handlePairsCreated = (newPairs: ScreenshotPair[]) => {
    setPairs(prev => [...prev, ...newPairs]);
    if (newPairs.length > 0 && !selectedPairId) {
      setSelectedPairId(newPairs[0].id);
    }
  };

  const updatePairStatus = (id: string, updates: Partial<ScreenshotPair>) => {
    setPairs(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleGenerateReport = async () => {
    if (!selectedPairId) return;

    // Update status to analyzing and clear previous errors
    updatePairStatus(selectedPairId, { status: 'analyzing', errorMessage: undefined });

    const pair = pairs.find(p => p.id === selectedPairId);
    if (!pair) return;

    try {
      const payload: LlmRequestPayload = {
        screenshotId: pair.id,
        enImageBase64: pair.enImageUrl, 
        deImageBase64: pair.deImageUrl,
        targetLanguage: pair.targetLanguage,
        glossaryText
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
    // Reset state only if not currently processing
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

    // Helper: Analysis with Retry
    const processItem = async (pair: ScreenshotPair, retries = 2): Promise<boolean> => {
      if (signal.aborted) return false;

      // Update UI to show analyzing
      updatePairStatus(pair.id, { status: 'analyzing', errorMessage: undefined });

      try {
        // Timeout Wrapper
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Request timed out (30s)")), 30000)
        );

        const payload: LlmRequestPayload = {
          screenshotId: pair.id,
          enImageBase64: pair.enImageUrl,
          deImageBase64: pair.deImageUrl,
          targetLanguage: pair.targetLanguage,
          glossaryText
        };

        // Race between API call and Timeout
        const response: any = await Promise.race([
           callTranslationQaLLM(payload),
           timeoutPromise
        ]);

        updatePairStatus(pair.id, { status: 'completed', report: response.report });
        return true;

      } catch (error: any) {
        if (retries > 0 && !signal.aborted) {
          console.log(`Retrying ${pair.fileName}... (${retries} left)`);
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

    // Concurrency Pool (Max 5)
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
    // Filter for Poor or Critical
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
        `"${p.fileName.replace(/"/g, '""')}"`, // CSV escape
        r.overall.qualityLevel,
        r.issues.length,
        r.summaryZh.majorCount,
        r.summaryZh.severeCount,
        `"${r.overall.mainProblemsSummaryZh.replace(/"/g, '""')}"`
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n"); // Add BOM for Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LQA_Defect_Summary_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateBulkZip = async () => {
    // Check for report AND overall to prevent undefined errors
    const completedPairs = pairs.filter(p => p.status === 'completed' && p.report && p.report.overall);
    if (completedPairs.length === 0) {
      alert("No completed reports to download.");
      return;
    }

    const zip = new JSZip();
    
    // We need to access the generateHtml function logic. 
    // Ideally, ReportPanel's generator should be a pure utility, but it's inside the component.
    // We will duplicate the minimal HTML generation logic here for the ZIP export to keep it self-contained in the bulk flow
    // or we could extract it. For simplicity in this edit, I'll use a simplified version or assume we extract it later.
    // I will inline a simplified HTML generator for the ZIP to ensure it works without major refactoring of ReportPanel.

    completedPairs.forEach(pair => {
      const report = pair.report!;
      // Re-use the generation logic (simplified for brevity, but matching the structure)
      // Note: In a real refactor, 'generateHtmlContent' should be moved to a 'utils' file.
      // I'll create a basic valid HTML content here representing the file.
      
      const qualityPrefix = report.overall.qualityLevel;
      const fileName = `${qualityPrefix}_${pair.fileName}_Report.json`;
      
      // Save JSON as it's raw data
      zip.file(fileName, JSON.stringify(report, null, 2));

      // Also Save HTML (Simplified dump for now to ensure functionality)
      // *To do it properly, we should move generateHtmlContent from ReportPanel to a utility file*
      // For this implementation, I will just export the JSONs in the ZIP as the requirement asks for "Mass processing help".
      // Actually, requirement says "All HTML Reports". I should copy the HTML generation logic.
      // I will implement a helper 'getHtmlString' inside App to support this.
    });
    
    // ... Actually, let's just grab the JSONs first, or better, let's copy the generateHtmlContent logic 
    // to a method we can call. Since I can't easily import internal component functions, 
    // I will extract the HTML generation logic to a standalone function in this file for now.
    
    for (const pair of completedPairs) {
        const html = generateReportHtml(pair.report!, pair.fileName, pair.targetLanguage);
        const qualityPrefix = pair.report!.overall.qualityLevel;
        zip.file(`${qualityPrefix}_${pair.fileName}.html`, html);
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    
    // Determine filename based on language
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
      
      {/* Bulk Modal */}
      <BulkRunModal 
        isOpen={isBulkModalOpen}
        state={bulkState}
        pendingCount={pendingCount}
        onClose={() => setIsBulkModalOpen(false)}
        onCancel={handleCancelBulk}
        onStart={startBulkAnalysis}
        onDownloadCsv={generateSummaryCsv}
        onDownloadZip={generateBulkZip}
      />

      {/* Navbar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-accent p-1.5 rounded text-white">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800">Vision LQA Pro</h1>
        </div>
        <div className="flex items-center space-x-4">
           
           <button 
             onClick={handleOpenBulkModal}
             className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm"
             title="Process all pending screenshots"
           >
             <PlayCircle className="w-4 h-4" />
             <span>Run Bulk ({pendingCount})</span>
           </button>

           <div className="h-6 w-px bg-slate-200"></div>
           
           <button onClick={loadDemoData} className="text-xs font-medium text-accent hover:underline">
             Load Demo Data
           </button>
           
           <button 
            onClick={() => setActiveRightPanel('global')}
            className={`flex items-center space-x-1 text-sm font-medium px-3 py-1.5 rounded transition-colors ${activeRightPanel === 'global' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
           >
             <Activity className="w-4 h-4" />
             <span>Global Stats</span>
           </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar */}
        <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} flex flex-col bg-white border-r border-slate-200 transition-all duration-300 relative shrink-0`}>
          <div className="p-4 border-b border-slate-100">
            <UploadArea onPairsCreated={handlePairsCreated} />
          </div>
          
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <label className="flex items-center text-xs font-bold text-slate-500 mb-2">
              <BookOpen className="w-3 h-3 mr-1" />
              Project Context / Glossary
            </label>
            <textarea 
              className="w-full text-xs p-2 border border-slate-200 rounded h-20 focus:ring-2 focus:ring-accent focus:border-transparent resize-none"
              placeholder="e.g. Site = Standort..."
              value={glossaryText}
              onChange={(e) => setGlossaryText(e.target.value)}
            />
          </div>

          <div className="p-2 bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-3">
            Screenshots ({pairs.length})
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

        {/* Toggle Sidebar Button */}
        <button 
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="absolute bottom-4 left-4 z-50 p-2 bg-white border border-slate-300 rounded-full shadow-md text-slate-600 hover:bg-slate-50"
          style={{ left: isSidebarOpen ? '19rem' : '1rem' }}
        >
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        {/* Middle: Compare View */}
        <section className="flex-1 relative border-r border-slate-200 bg-slate-200 overflow-hidden">
          <CompareView pair={selectedPair} />
        </section>

        {/* Right Panel: Report or Global Summary */}
        <aside className="w-[400px] flex flex-col bg-white shrink-0 shadow-xl z-10">
          {activeRightPanel === 'global' ? (
            <GlobalSummary pairs={pairs} />
          ) : (
            <ReportPanel 
              pair={selectedPair} 
              onGenerate={handleGenerateReport}
              isGenerating={selectedPair?.status === 'analyzing'}
              glossary={glossaryText}
            />
          )}
        </aside>

      </main>
    </div>
  );
};

export default App;

// Helper to generate HTML string (Duplicated logic from ReportPanel to allow independent generation)
const generateReportHtml = (report: ScreenshotReport, fileName: string, targetLang: string) => {
    // Add safety check for overall and summaryZh
    if (!report || !report.overall || !report.summaryZh || !report.issues) {
      return `
      <!DOCTYPE html>
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Report Generation Failed</h1>
          <p>The report data for ${fileName} is incomplete or corrupted.</p>
        </body>
      </html>
      `;
    }

    const { overall, issues, summaryZh } = report;
    const date = new Date().toLocaleString();
    const targetLangLabel = targetLang === 'fr-FR' ? 'fr-FR' : 'de-DE';
    const targetLangShort = targetLang === 'fr-FR' ? 'FR' : 'DE';

    // Calculate Category Counts
    const categoryCounts: Record<string, number> = {};
    issues.forEach(issue => {
      categoryCounts[issue.issueCategory] = (categoryCounts[issue.issueCategory] || 0) + 1;
    });

    const styles = `
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.5; max-width: 900px; margin: 0 auto; padding: 40px; background: #f8fafc; }
      .header { border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
      .title { font-size: 24px; font-weight: bold; color: #0f172a; }
      .meta { color: #64748b; font-size: 14px; }
      .section { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
      .section-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; color: #1e293b; }
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 20px; }
      .stat-card { background: #f1f5f9; padding: 12px; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0; }
      .stat-value { font-size: 20px; font-weight: bold; display: block; }
      .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
      .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; display: inline-block; }
      .severity-critical { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
      .severity-major { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
      .severity-minor { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
      .cat-badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; color: white; margin-right: 6px; }
      
      .cat-Layout { background-color: #8b5cf6; }
      .cat-Mistranslation { background-color: #ef4444; }
      .cat-Untranslated { background-color: #f97316; }
      .cat-Terminology { background-color: #3b82f6; }
      .cat-Formatting { background-color: #14b8a6; }
      .cat-Grammar { background-color: #22c55e; }
      .cat-Style { background-color: #ec4899; }
      .cat-Other { background-color: #64748b; }

      .issue-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 16px; border-left-width: 5px; background: white; }
      .issue-critical { border-left-color: #ef4444; }
      .issue-major { border-left-color: #f97316; }
      .issue-minor { border-left-color: #eab308; }
      
      .issue-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
      .issue-id { font-weight: bold; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #334155; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
      .text-box { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px; }
      .text-label { display: block; font-size: 10px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; font-weight: bold; }
      .suggestion-box { background: #f0fdf4; padding: 12px; border-radius: 6px; border: 1px solid #dcfce7; color: #166534; font-size: 14px; }
      .empty-state { text-align: center; padding: 60px; color: #94a3b8; font-style: italic; background: white; border-radius: 8px; border: 1px dashed #cbd5e1; }
      .category-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      .cat-pill { display: inline-flex; align-items: center; font-size: 12px; background: #f1f5f9; padding: 4px 8px; border-radius: 12px; color: #475569; border: 1px solid #e2e8f0; }
      .cat-count { background: #cbd5e1; color: white; border-radius: 10px; padding: 0 6px; margin-left: 6px; font-size: 10px; height: 16px; line-height: 16px; }
      .location-tag { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #64748b; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; border: 1px solid #e2e8f0; display: inline-block; margin-bottom: 12px; }
    `;

    const issueHtml = issues.length > 0 ? issues.map(issue => `
      <div class="issue-card issue-${issue.severity.toLowerCase()}">
        <div class="issue-header">
          <div style="display: flex; align-items: center;">
            <span class="issue-id">${issue.id}</span>
            <span style="margin: 0 8px; color: #cbd5e1;">|</span>
            <span class="cat-badge cat-${issue.issueCategory}">${issue.issueCategory}</span>
          </div>
          <span class="badge severity-${issue.severity.toLowerCase()}">${issue.severity}</span>
        </div>
        
        ${issue.location ? `<div class="location-tag">📍 ${issue.location}</div>` : ''}

        <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155; line-height: 1.6;">${issue.descriptionZh}</p>
        <div class="grid-2">
          <div class="text-box">
            <span class="text-label">Source (EN)</span>
            <div style="white-space: pre-wrap;">${issue.sourceText || '<em style="color:#cbd5e1">N/A</em>'}</div>
          </div>
          <div class="text-box">
            <span class="text-label">Current (${targetLangShort})</span>
            <div style="white-space: pre-wrap; color: #ef4444; text-decoration: line-through; text-decoration-color: #fca5a5;">${issue.targetText || '<em style="color:#cbd5e1">N/A</em>'}</div>
          </div>
        </div>
        <div class="suggestion-box">
          <span style="font-weight: 700; display: block; margin-bottom: 6px; font-size: 11px; text-transform: uppercase;">Suggestion (${targetLangShort})</span>
          ${(issue.suggestionsTarget || []).map(s => `<div>• ${s}</div>`).join('')}
        </div>
      </div>
    `).join('') : `
      <div class="empty-state">
        <svg style="width: 48px; height: 48px; margin-bottom: 16px; color: #cbd5e1;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div style="font-size: 18px; font-weight: 500; color: #64748b;">No Issues Detected</div>
        <p>Great job! This screen appears to be free of localization issues.</p>
      </div>
    `;

    const categoryHtml = Object.entries(categoryCounts).map(([cat, count]) => `
      <span class="cat-pill">
        <span style="width: 8px; height: 8px; border-radius: 50%; margin-right: 6px;" class="cat-${cat}"></span>
        ${cat} 
        <span class="cat-count">${count}</span>
      </span>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>LQA Report - ${fileName}</title>
          <style>${styles}</style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Vision LQA Report</div>
              <div class="meta" style="margin-top: 4px;">File: <strong>${fileName}</strong></div>
              <div class="meta" style="margin-top: 2px;">Lang: <strong>en-US &rarr; ${targetLangLabel}</strong></div>
            </div>
            <div class="meta" style="text-align: right;">
              <div>Generated: ${date}</div>
              <div style="margin-top: 4px;">Powered by Google Gemini</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Executive Summary</div>
            <p style="margin-bottom: 24px; color: #475569;">${overall.mainProblemsSummaryZh}</p>
            
            <div class="stats-grid">
              <div class="stat-card">
                <span class="stat-value" style="color: ${overall.qualityLevel === 'Critical' ? '#ef4444' : overall.qualityLevel === 'Poor' ? '#f97316' : '#22c55e'}">${overall.qualityLevel}</span>
                <span class="stat-label">Overall Quality</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">${issues.length}</span>
                <span class="stat-label">Total Issues</span>
              </div>
              <div class="stat-card" style="background: #fef2f2; border-color: #fee2e2;">
                <span class="stat-value" style="color: #991b1b;">${summaryZh.severeCount}</span>
                <span class="stat-label" style="color: #ef4444;">Critical</span>
              </div>
              <div class="stat-card" style="background: #fff7ed; border-color: #ffedd5;">
                <span class="stat-value" style="color: #9a3412;">${summaryZh.majorCount}</span>
                <span class="stat-label" style="color: #f97316;">Major</span>
              </div>
              <div class="stat-card" style="background: #fffbeb; border-color: #fef3c7;">
                <span class="stat-value" style="color: #92400e;">${summaryZh.minorCount}</span>
                <span class="stat-label" style="color: #eab308;">Minor</span>
              </div>
            </div>

            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
               <div style="font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Issues by Category</div>
               <div class="category-grid">
                 ${categoryHtml || '<span style="color: #94a3b8; font-size: 13px;">No issues found</span>'}
               </div>
            </div>
          </div>

          <div class="section">
             <div class="section-title">Optimization Advice</div>
             <p style="white-space: pre-wrap; color: #475569;">${summaryZh.optimizationAdvice}</p>
          </div>

          <div class="section" style="background: transparent; box-shadow: none; padding: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <div class="section-title" style="margin: 0; border: none; font-size: 20px;">Detailed Issues List</div>
              <div class="badge" style="background: #e2e8f0; color: #64748b; padding: 6px 12px;">Count: ${issues.length}</div>
            </div>
            ${issueHtml}
          </div>
          
          <div style="text-align: center; color: #cbd5e1; font-size: 12px; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            End of Report
          </div>
        </body>
      </html>
    `;
};