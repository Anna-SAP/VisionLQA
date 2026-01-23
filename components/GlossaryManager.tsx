import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, FileSpreadsheet, Upload, History, Trash2, Check, AlertCircle, FileText, Loader2, Layers, Plus, X, RotateCcw } from 'lucide-react';
import * as XLSX from 'xlsx';

interface GlossaryManagerProps {
  currentGlossary: string;
  onUpdate: (text: string) => void;
  onLangDetected?: (lang: 'de-DE' | 'fr-FR' | null) => void;
  t: any;
}

interface GlossaryHistoryItem {
  name: string;
  date: string;
  count: number;
  content: string;
}

interface LoadedFile {
  id: string;
  name: string;
  count: number;
  terms: string[]; // Array of "Source = Target"
}

export const GlossaryManager: React.FC<GlossaryManagerProps> = ({ currentGlossary, onUpdate, onLangDetected, t }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [uploadMode, setUploadMode] = useState<'replace' | 'append'>('replace');
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);

  const [history, setHistory] = useState<GlossaryHistoryItem[]>([]);
  const [previewData, setPreviewData] = useState<string[]>([]);
  const [totalTerms, setTotalTerms] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vision_lqa_glossary_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load glossary history", e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'import') {
        recompileGlossary(loadedFiles);
    }
  }, [loadedFiles]);

  const saveToHistory = (name: string, content: string, count: number) => {
    const newItem: GlossaryHistoryItem = {
      name,
      date: new Date().toLocaleString(),
      count,
      content
    };
    const newHistory = [newItem, ...history].slice(0, 3);
    setHistory(newHistory);
    localStorage.setItem('vision_lqa_glossary_history', JSON.stringify(newHistory));
  };

  // Helper to guess language from filename
  const detectLanguageFromFile = (filename: string): 'de-DE' | 'fr-FR' | null => {
      const lower = filename.toLowerCase();
      if (lower.includes('de') || lower.includes('ger') || lower.includes('deutsch')) return 'de-DE';
      if (lower.includes('fr') || lower.includes('fre') || lower.includes('french')) return 'fr-FR';
      return null;
  };

  const recompileGlossary = (files: LoadedFile[]) => {
    if (files.length === 0) {
        setTotalTerms(0);
        setPreviewData([]);
        onUpdate("");
        if (onLangDetected) onLangDetected(null);
        return;
    }

    const termMap = new Map<string, string>();
    const fileLangs = new Set<'de-DE' | 'fr-FR'>();

    files.forEach(file => {
        // Collect Detected Langs
        const detected = detectLanguageFromFile(file.name);
        if (detected) fileLangs.add(detected);

        file.terms.forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const sourceKey = parts[0].trim().toLowerCase();
                termMap.set(sourceKey, line);
            }
        });
    });

    // Heuristic: If we found mostly DE files, notify parent it's DE context
    if (onLangDetected) {
        if (fileLangs.has('de-DE') && !fileLangs.has('fr-FR')) onLangDetected('de-DE');
        else if (fileLangs.has('fr-FR') && !fileLangs.has('de-DE')) onLangDetected('fr-FR');
        else onLangDetected(null); // Mixed or unknown
    }

    const uniqueTerms = Array.from(termMap.values());
    const mergedContent = uniqueTerms.join('\n');
    
    setTotalTerms(uniqueTerms.length);
    setPreviewData(uniqueTerms.slice(0, 10));
    onUpdate(mergedContent);
  };

  const handleResetContext = () => {
      if (window.confirm("Are you sure you want to remove all loaded glossary files?")) {
          setLoadedFiles([]);
          onUpdate("");
      }
  };

  const processFileContent = async (file: File): Promise<string[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) throw new Error("Empty file");

    const keys = Object.keys(jsonData[0]);
    let sourceKey = keys.find(k => /source|en|english/i.test(k));
    let targetKey = keys.find(k => /target|de|fr|german|french|trans/i.test(k));

    if (!sourceKey) sourceKey = keys[0];
    if (!targetKey && keys.length > 1) targetKey = keys[1];

    if (!sourceKey || !targetKey) throw new Error(t.glossary.errorFormat);

    return jsonData.map(row => {
      const src = row[sourceKey!] ? String(row[sourceKey!]).trim() : '';
      const tgt = row[targetKey!] ? String(row[targetKey!]).trim() : '';
      return src && tgt ? `${src} = ${tgt}` : null;
    }).filter(Boolean) as string[];
  };

  const handleFileUpload = async (file: File) => {
    setIsParsing(true);
    setError(null);

    try {
      const terms = await processFileContent(file);
      const content = terms.join('\n');

      const newFileObj: LoadedFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          count: terms.length,
          terms: terms
      };

      if (uploadMode === 'replace') {
          setLoadedFiles([newFileObj]);
      } else {
          setLoadedFiles(prev => [...prev, newFileObj]);
      }

      saveToHistory(file.name, content, terms.length);

    } catch (err: any) {
      setError(err.message || "Failed to parse file");
    } finally {
      setIsParsing(false);
    }
  };

  const removeFile = (idToRemove: string) => {
      setLoadedFiles(prev => prev.filter(f => f.id !== idToRemove));
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.size > 50 * 1024 * 1024) {
        setError("File size exceeds 50MB");
        return;
      }
      handleFileUpload(file);
    }
  };

  const fetchDefaultGlossary = async (lang: 'de' | 'fr') => {
    setIsParsing(true);
    setError(null);
    const fileName = lang === 'de' ? 'Default_DE.xlsx' : 'Default_FR.xlsx';
    try {
        const mockTerms = lang === 'de' 
            ? ["Site = Standort", "Extension = Nebenstelle", "Call Queue = Warteschleife", "IVR Menu = IVR-Menü"]
            : ["Site = Site", "Extension = Extension", "Call Queue = File d'attente", "IVR Menu = Menu IVR"];
        
        await new Promise(r => setTimeout(r, 600));

        const newFileObj: LoadedFile = {
            id: Math.random().toString(36).substr(2, 9),
            name: fileName,
            count: mockTerms.length,
            terms: mockTerms
        };

        if (uploadMode === 'replace') {
            setLoadedFiles([newFileObj]);
        } else {
            setLoadedFiles(prev => [...prev, newFileObj]);
        }

    } catch (e) {
        setError("Failed to load default glossary");
    } finally {
        setIsParsing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-t border-slate-100">
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center space-x-2 ${activeTab === 'manual' ? 'bg-white text-accent border-b-2 border-accent' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <FileText className="w-3 h-3" />
          <span>{t.glossary.tabManual}</span>
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center space-x-2 ${activeTab === 'import' ? 'bg-white text-accent border-b-2 border-accent' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Layers className="w-3 h-3" />
          <span>{t.glossary.tabImport}</span>
        </button>
      </div>

      <div className="flex-1 p-0 relative">
        {activeTab === 'manual' && (
          <textarea 
            className="w-full h-32 p-3 text-xs border-0 resize-none focus:ring-0 bg-transparent"
            placeholder="e.g. Site = Standort..."
            value={currentGlossary}
            onChange={(e) => onUpdate(e.target.value)}
          />
        )}

        {activeTab === 'import' && (
          <div className="p-3 h-32 overflow-y-auto custom-scrollbar">
            
            <div className="flex items-center justify-center space-x-4 mb-3 text-[10px]">
                <label className="flex items-center space-x-1 cursor-pointer">
                    <input 
                        type="radio" 
                        name="uploadMode" 
                        checked={uploadMode === 'replace'} 
                        onChange={() => setUploadMode('replace')}
                        className="text-accent focus:ring-accent"
                    />
                    <span className="text-slate-700 font-medium">{t.glossary.modeReplace}</span>
                </label>
                <label className="flex items-center space-x-1 cursor-pointer">
                    <input 
                        type="radio" 
                        name="uploadMode" 
                        checked={uploadMode === 'append'} 
                        onChange={() => setUploadMode('append')}
                        className="text-accent focus:ring-accent"
                    />
                    <span className="text-slate-700 font-medium">{t.glossary.modeAppend}</span>
                </label>
            </div>

            {/* Active Context Visual Indicator */}
            {loadedFiles.length > 0 && (
                <div className="mb-3 flex items-center justify-between bg-green-50 border border-green-200 rounded px-2 py-1.5">
                    <div className="flex items-center text-green-700 text-[10px] font-bold">
                        <Check className="w-3 h-3 mr-1" />
                        {t.contextActive}
                    </div>
                    <button 
                        onClick={handleResetContext}
                        className="text-[9px] text-red-500 hover:text-red-700 flex items-center font-medium bg-white px-1.5 py-0.5 rounded border border-red-100 shadow-sm hover:shadow"
                        title={t.glossary.resetAll}
                    >
                        <Trash2 className="w-2.5 h-2.5 mr-1" />
                        {t.glossary.clear}
                    </button>
                </div>
            )}

            {!isParsing && (
               <div 
                 onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                 onDragLeave={() => setIsDragging(false)}
                 onDrop={handleFileDrop}
                 className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer relative ${isDragging ? 'border-accent bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-white'}`}
               >
                 <input 
                   type="file" 
                   accept=".xlsx,.xls,.csv" 
                   className="absolute inset-0 opacity-0 cursor-pointer"
                   onChange={(e) => {
                     if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0]);
                   }}
                 />
                 <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                 <p className="text-xs font-medium text-slate-600">{t.glossary.dragDrop}</p>
                 <p className="text-[10px] text-slate-400 mt-0.5">
                    {uploadMode === 'replace' ? t.glossary.modeReplace : t.glossary.modeAppend}
                 </p>
               </div>
            )}

            {isParsing && (
              <div className="flex flex-col items-center justify-center h-20">
                <Loader2 className="w-5 h-5 animate-spin text-accent mb-2" />
                <span className="text-xs text-slate-500">{t.glossary.parsing}</span>
              </div>
            )}

            {error && (
              <div className="mt-2 p-2 bg-red-50 text-red-600 text-[10px] rounded flex items-start">
                <AlertCircle className="w-3 h-3 mr-1 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {loadedFiles.length > 0 && (
                <div className="mt-3">
                    <div className="flex justify-between items-center mb-1.5">
                         <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.glossary.filesLoaded} ({loadedFiles.length})</span>
                         <span className="text-[10px] text-accent font-mono">{t.glossary.mergedTotal}: {totalTerms}</span>
                    </div>
                    
                    <ul className="space-y-1.5 mb-3">
                        {loadedFiles.map(file => (
                            <li key={file.id} className="bg-white border border-slate-200 rounded p-1.5 flex justify-between items-center group shadow-sm">
                                <div className="flex items-center overflow-hidden">
                                    <FileSpreadsheet className="w-3 h-3 text-green-600 mr-2 shrink-0" />
                                    <div className="truncate">
                                        <div className="text-[10px] font-medium text-slate-700 truncate w-32" title={file.name}>{file.name}</div>
                                        <div className="text-[9px] text-slate-400">{file.count} terms</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => removeFile(file.id)}
                                    className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title={t.glossary.removeFile}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button 
                onClick={() => fetchDefaultGlossary('de')}
                className="flex items-center justify-center space-x-1 py-1.5 px-2 bg-white border border-slate-200 rounded shadow-sm hover:bg-slate-50 text-[10px] text-slate-700"
              >
                <img src="https://flagcdn.com/w20/de.png" className="w-3 h-2" alt="DE" />
                <span>{t.glossary.defaultDe}</span>
              </button>
              <button 
                onClick={() => fetchDefaultGlossary('fr')}
                className="flex items-center justify-center space-x-1 py-1.5 px-2 bg-white border border-slate-200 rounded shadow-sm hover:bg-slate-50 text-[10px] text-slate-700"
              >
                <img src="https://flagcdn.com/w20/fr.png" className="w-3 h-2" alt="FR" />
                <span>{t.glossary.defaultFr}</span>
              </button>
            </div>

            {loadedFiles.length === 0 && history.length > 0 && (
               <div className="mt-4 border-t border-slate-100 pt-2">
                  <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase flex items-center">
                    <History className="w-3 h-3 mr-1" /> {t.glossary.history}
                  </h4>
                  <ul className="space-y-1">
                    {history.map((item, idx) => (
                      <li key={idx} className="flex justify-between items-center bg-white p-1.5 rounded border border-slate-100">
                         <div className="truncate flex-1 mr-2">
                           <div className="text-[10px] font-medium text-slate-700 truncate" title={item.name}>{item.name}</div>
                           <div className="text-[9px] text-slate-400">{item.count} terms • {item.date}</div>
                         </div>
                         <button 
                           onClick={() => {
                               setUploadMode('replace');
                               const restoredFile: LoadedFile = {
                                   id: Math.random().toString(36).substr(2, 9),
                                   name: item.name,
                                   count: item.count,
                                   terms: item.content.split('\n')
                               };
                               setLoadedFiles([restoredFile]);
                           }}
                           className="text-[10px] text-accent hover:underline shrink-0"
                         >
                           {t.glossary.apply}
                         </button>
                      </li>
                    ))}
                  </ul>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};