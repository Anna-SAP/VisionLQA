import React, { useState } from 'react';
import { UploadArea } from './components/UploadArea';
import { PairList } from './components/PairList';
import { CompareView } from './components/CompareView';
import { ReportPanel } from './components/ReportPanel';
import { GlobalSummary } from './components/GlobalSummary';
import { ScreenshotPair, LlmRequestPayload } from './types';
import { callTranslationQaLLM } from './services/llmService';
import { Layers, Activity, BookOpen, PanelLeftOpen, PanelLeftClose } from 'lucide-react';

const App: React.FC = () => {
  const [pairs, setPairs] = useState<ScreenshotPair[]>([]);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [glossaryText, setGlossaryText] = useState<string>('');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [activeRightPanel, setActiveRightPanel] = useState<'report' | 'global'>('report');
  
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

  const handleGenerateReport = async () => {
    if (!selectedPairId) return;

    // Update status to analyzing and clear previous errors
    setPairs(prev => prev.map(p => p.id === selectedPairId ? { ...p, status: 'analyzing', errorMessage: undefined } : p));

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
      
      setPairs(prev => prev.map(p => p.id === selectedPairId ? { 
        ...p, 
        status: 'completed', 
        report: response.report 
      } : p));
      
    } catch (error: any) {
      console.error("Analysis failed", error);
      const msg = error instanceof Error ? error.message : "Unknown error occurred";
      setPairs(prev => prev.map(p => p.id === selectedPairId ? { ...p, status: 'failed', errorMessage: msg } : p));
    }
  };

  const selectedPair = pairs.find(p => p.id === selectedPairId) || null;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Navbar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 justify-between shrink-0 z-20 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-accent p-1.5 rounded text-white">
            <Layers className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800">Vision LQA Pro</h1>
        </div>
        <div className="flex items-center space-x-4">
           <button onClick={loadDemoData} className="text-xs font-medium text-accent hover:underline">
             Load Demo Data
           </button>
           <div className="h-6 w-px bg-slate-200"></div>
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