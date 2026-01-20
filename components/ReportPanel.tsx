import React from 'react';
import { ScreenshotPair, QaIssue, ScreenshotReport } from '../types';
import { Button } from './Button';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { AlertTriangle, AlertOctagon, Info, Download, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { generateReportHtml } from '../services/reportGenerator';

interface ReportPanelProps {
  pair: ScreenshotPair | null;
  onGenerate: () => void;
  isGenerating: boolean;
  glossary: string;
  t: any; // Translation object
}

export const ReportPanel: React.FC<ReportPanelProps> = ({ pair, onGenerate, isGenerating, glossary, t }) => {
  if (!pair) {
    return (
      <div className="p-6 text-center text-slate-500 mt-20">
        <p>Select a screenshot to view details</p>
      </div>
    );
  }

  const targetLangLabel = pair.targetLanguage === 'fr-FR' ? 'fr-FR' : 'de-DE';
  const targetLangShort = pair.targetLanguage === 'fr-FR' ? 'FR' : 'DE';

  if (pair.status === 'pending' || pair.status === 'analyzing') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">{t.readyToAnalyze}</h3>
          <p className="text-sm text-slate-500 mb-6">
            {t.readyDesc}
          </p>
          {glossary && (
             <div className="mb-6 p-3 bg-blue-50 text-blue-700 text-xs rounded text-left max-w-xs mx-auto border border-blue-100">
               <span className="font-bold">{t.contextActive}:</span> {glossary.length} chars
             </div>
          )}
          <Button onClick={onGenerate} isLoading={isGenerating} size="lg">
            {isGenerating ? t.analyzing : t.genReport}
          </Button>
        </div>
      </div>
    );
  }

  const isReportValid = pair.report && pair.report.overall && pair.report.issues && pair.report.summary;

  if (pair.status === 'failed' || !isReportValid) {
     return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {pair.status === 'failed' ? t.analysisFailed : 'Invalid Report Data'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
                {pair.errorMessage || "The analysis result is missing required data fields."}
            </p>
            <Button onClick={onGenerate} variant="secondary">
                {t.tryAgain}
            </Button>
        </div>
     );
  }

  const report = pair.report!;
  const scores = report.overall.scores;
  
  const radarData = [
    { subject: 'Accuracy', A: scores?.accuracy || 0, fullMark: 5 },
    { subject: 'Terms', A: scores?.terminology || 0, fullMark: 5 },
    { subject: 'Layout', A: scores?.layout || 0, fullMark: 5 },
    { subject: 'Grammar', A: scores?.grammar || 0, fullMark: 5 },
    { subject: 'Format', A: scores?.formatting || 0, fullMark: 5 },
    { subject: 'Tone', A: scores?.localizationTone || 0, fullMark: 5 },
  ];

  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${pair.fileName}_en-US_${targetLangLabel}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const downloadHtml = () => {
    // Use shared generator to ensure full content
    const htmlContent = generateReportHtml(report, pair.fileName, targetLangLabel);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    const qualityPrefix = report.overall.qualityLevel;
    downloadAnchorNode.setAttribute("download", `${qualityPrefix}_${targetLangLabel}_${pair.fileName}.html`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white z-10 shrink-0">
        <div className="overflow-hidden mr-2">
          <h2 className="font-bold text-slate-800 truncate text-base" title={pair.fileName}>{pair.fileName}</h2>
          <div className="flex items-center mt-0.5 space-x-2">
            <span className="text-xs text-slate-500">QA Report ({targetLangLabel})</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
              report.overall.qualityLevel === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' : 
              report.overall.qualityLevel === 'Poor' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'
            }`}>
              {report.overall.qualityLevel}
            </span>
          </div>
        </div>
        <div className="flex space-x-2 shrink-0">
          <button onClick={downloadHtml} className="p-2 hover:bg-slate-100 rounded text-slate-500" title={t.exportHtml}>
            <FileText className="w-4 h-4" />
          </button>
          <button onClick={downloadJson} className="p-2 hover:bg-slate-100 rounded text-slate-500" title={t.exportJson}>
            <Download className="w-4 h-4" />
          </button>
          <button onClick={onGenerate} className="p-2 hover:bg-slate-100 rounded text-slate-500" title={t.tryAgain}>
             <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          
          {/* Overview Section */}
          <div className="space-y-6 mb-8">
            <div className="flex items-center space-x-2 text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">{t.overview}</span>
                <div className="h-px bg-slate-100 flex-1"></div>
            </div>

            {/* Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                  <Radar name="Score" dataKey="A" stroke="#2563eb" fill="#2563eb" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Description */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">{t.sceneDesc}</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{report.overall.sceneDescription}</p>
            </div>

             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">{t.mainProblems}</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{report.overall.mainProblemsSummary}</p>
            </div>

            {/* Advice */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
               <h4 className="text-xs font-bold text-blue-500 uppercase mb-2">{t.optAdvice}</h4>
               <p className="text-sm text-blue-800 leading-relaxed">{report.summary.optimizationAdvice}</p>
            </div>
             {report.summary.termAdvice && (
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                <h4 className="text-xs font-bold text-purple-500 uppercase mb-2">{t.terminology}</h4>
                <p className="text-sm text-purple-800 leading-relaxed">{report.summary.termAdvice}</p>
              </div>
            )}
          </div>

          {/* Issues Section */}
          <div>
            <div className="flex items-center justify-between text-slate-800 mb-4 pt-4 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{t.issuesDetected}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                        {report.issues.length}
                    </span>
                </div>
            </div>
            
            <div className="space-y-4 pb-4">
              {report.issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} targetLang={targetLangShort} />
              ))}
              {report.issues.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-4">{t.noIssues}</p>
              )}
            </div>
          </div>
      </div>
    </div>
  );
};

const IssueCard: React.FC<{ issue: QaIssue, targetLang: string }> = ({ issue, targetLang }) => {
  const getSeverityColor = (sev: string) => {
    switch(sev) {
      case 'Critical': return 'border-l-red-500 bg-red-50/50';
      case 'Major': return 'border-l-orange-500 bg-orange-50/50';
      default: return 'border-l-yellow-500 bg-yellow-50/50';
    }
  };

  const getIcon = (sev: string) => {
    if (sev === 'Critical') return <AlertOctagon className="w-4 h-4 text-red-500" />;
    if (sev === 'Major') return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    return <Info className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <div className={`p-3 rounded border border-slate-200 border-l-4 ${getSeverityColor(issue.severity)} shadow-sm`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          {getIcon(issue.severity)}
          <span className="font-bold text-sm text-slate-800">{issue.id}</span>
          <span className="text-xs px-2 py-0.5 bg-white border rounded text-slate-500">{issue.issueCategory}</span>
        </div>
        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{issue.severity}</span>
      </div>
      
      <p className="text-xs text-slate-500 mb-2 font-mono bg-white/50 p-1 rounded inline-block">{issue.location}</p>
      <p className="text-sm text-slate-700 mb-3">{issue.description}</p>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-white p-2 rounded border border-slate-200">
          <span className="block text-slate-400 text-[10px] mb-1">Source (EN)</span>
          <div className="font-medium break-words">{issue.sourceText}</div>
        </div>
        <div className="bg-white p-2 rounded border border-slate-200">
          <span className="block text-slate-400 text-[10px] mb-1">Current ({targetLang})</span>
          <div className="font-medium text-red-600 line-through decoration-red-300 break-words">{issue.targetText}</div>
        </div>
      </div>

      <div className="bg-green-50 p-2 rounded border border-green-100">
         <span className="block text-green-700 text-[10px] font-bold mb-1">Suggestion ({targetLang})</span>
         <ul className="list-disc list-inside">
           {(issue.suggestionsTarget || []).map((sug, idx) => (
             <li key={idx} className="text-sm text-green-800 font-medium break-words">{sug}</li>
           ))}
         </ul>
      </div>
    </div>
  );
};