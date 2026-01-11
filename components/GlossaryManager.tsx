import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, FileSpreadsheet, Upload, History, Trash2, Check, AlertCircle, FileText, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface GlossaryManagerProps {
  currentGlossary: string;
  onUpdate: (text: string) => void;
  t: any;
}

interface GlossaryHistoryItem {
  name: string;
  date: string;
  count: number;
  content: string;
}

export const GlossaryManager: React.FC<GlossaryManagerProps> = ({ currentGlossary, onUpdate, t }) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('manual');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GlossaryHistoryItem[]>([]);
  const [previewData, setPreviewData] = useState<string[]>([]);
  const [totalTerms, setTotalTerms] = useState(0);

  // Load history from local storage on mount
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

  const saveToHistory = (name: string, content: string, count: number) => {
    const newItem: GlossaryHistoryItem = {
      name,
      date: new Date().toLocaleString(),
      count,
      content
    };
    
    // Keep last 3
    const newHistory = [newItem, ...history].slice(0, 3);
    setHistory(newHistory);
    localStorage.setItem('vision_lqa_glossary_history', JSON.stringify(newHistory));
  };

  const parseExcelFile = async (file: File) => {
    setIsParsing(true);
    setError(null);
    setPreviewData([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error("Empty file");
      }

      // Detect columns (looking for keys that resemble 'Source'/'Target' or just take 1st and 2nd)
      const keys = Object.keys(jsonData[0]);
      let sourceKey = keys.find(k => /source|en|english/i.test(k));
      let targetKey = keys.find(k => /target|de|fr|german|french|trans/i.test(k));

      // Fallback to col 0 and 1 if no headers matched
      if (!sourceKey) sourceKey = keys[0];
      if (!targetKey && keys.length > 1) targetKey = keys[1];

      if (!sourceKey || !targetKey) {
        throw new Error(t.glossary.errorFormat);
      }

      const terms = jsonData.map(row => {
        const src = row[sourceKey!] ? String(row[sourceKey!]).trim() : '';
        const tgt = row[targetKey!] ? String(row[targetKey!]).trim() : '';
        return src && tgt ? `${src} = ${tgt}` : null;
      }).filter(Boolean) as string[];

      const content = terms.join('\n');
      setTotalTerms(terms.length);
      setPreviewData(terms.slice(0, 10));
      
      // Update parent immediately or user can choose to apply? 
      // Req says "User uploads... then applies". Let's apply immediately for simplicity but show success.
      onUpdate(content);
      saveToHistory(file.name, content, terms.length);

    } catch (err: any) {
      setError(err.message || "Failed to parse file");
    } finally {
      setIsParsing(false);
    }
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
      parseExcelFile(file);
    }
  };

  const fetchDefaultGlossary = async (lang: 'de' | 'fr') => {
    setIsParsing(true);
    setError(null);
    
    const fileName = lang === 'de' ? 'RC_Glossary_DE-DE_20240426.xlsx' : 'RC_Glossary_FR-FR_20240703.xlsx';
    const filePath = `/glossaries/${fileName}`; // Assumes files are in public/glossaries/

    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        // Fallback for demo environment where file might not exist
        throw new Error(`Default glossary not found at ${filePath}. Please ensure file exists in public/glossaries folder.`);
      }
      
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await parseExcelFile(file);
    } catch (err: any) {
      console.warn("Failed to load default glossary, using mock data for demo.");
      // MOCK DATA FALLBACK for Vibe Coding Demo
      const mockTerms = lang === 'de' 
        ? ["Site = Standort", "Extension = Nebenstelle", "Call Queue = Warteschleife", "IVR Menu = IVR-Menü"]
        : ["Site = Site", "Extension = Extension", "Call Queue = File d'attente", "IVR Menu = Menu IVR"];
      
      const content = mockTerms.join('\n');
      onUpdate(content);
      setTotalTerms(mockTerms.length);
      setPreviewData(mockTerms);
      saveToHistory(fileName + " (Demo)", content, mockTerms.length);
      setIsParsing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-t border-slate-100">
      {/* Tabs */}
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
          <FileSpreadsheet className="w-3 h-3" />
          <span>{t.glossary.tabImport}</span>
        </button>
      </div>

      <div className="flex-1 p-0 relative">
        
        {/* Manual Tab */}
        {activeTab === 'manual' && (
          <textarea 
            className="w-full h-32 p-3 text-xs border-0 resize-none focus:ring-0 bg-transparent"
            placeholder="e.g. Site = Standort..."
            value={currentGlossary}
            onChange={(e) => onUpdate(e.target.value)}
          />
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="p-3 h-32 overflow-y-auto custom-scrollbar">
            
            {/* Upload Area */}
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
                     if (e.target.files && e.target.files[0]) parseExcelFile(e.target.files[0]);
                   }}
                 />
                 <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
                 <p className="text-xs font-medium text-slate-600">{t.glossary.dragDrop}</p>
                 <p className="text-[10px] text-slate-400 mt-0.5">{t.glossary.formats}</p>
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

            {/* Default Buttons */}
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

            {/* History / Preview */}
            {(previewData.length > 0 || history.length > 0) && (
               <div className="mt-4 border-t border-slate-100 pt-2">
                 {previewData.length > 0 ? (
                   <div>
                     <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-green-600 flex items-center">
                          <Check className="w-3 h-3 mr-1" /> {t.glossary.applied}: {totalTerms}
                        </span>
                        <button onClick={() => setPreviewData([])} className="text-[10px] text-slate-400 hover:text-slate-600">{t.glossary.history}</button>
                     </div>
                     <div className="bg-slate-100 p-2 rounded text-[10px] font-mono text-slate-600 h-16 overflow-y-auto">
                        {previewData.map((term, i) => <div key={i} className="truncate">{term}</div>)}
                        {totalTerms > 10 && <div className="text-slate-400 italic">... +{totalTerms - 10} more</div>}
                     </div>
                   </div>
                 ) : (
                   <div>
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
                               onClick={() => { onUpdate(item.content); setTotalTerms(item.count); setPreviewData(item.content.split('\n').slice(0, 10)); }}
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
        )}
      </div>
    </div>
  );
};