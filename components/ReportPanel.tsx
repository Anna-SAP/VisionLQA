import React from 'react';
import { ScreenshotPair, QaIssue, ScreenshotReport } from '../types';
import { Button } from './Button';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { AlertTriangle, AlertOctagon, Info, Download, RefreshCw, AlertCircle, FileText } from 'lucide-react';

interface ReportPanelProps {
  pair: ScreenshotPair | null;
  onGenerate: () => void;
  isGenerating: boolean;
  glossary: string;
}

export const ReportPanel: React.FC<ReportPanelProps> = ({ pair, onGenerate, isGenerating, glossary }) => {
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
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Ready to Analyze</h3>
          <p className="text-sm text-slate-500 mb-6">
            Compare en-US and {targetLangLabel} for layout, translation, and terminology issues.
          </p>
          {glossary && (
             <div className="mb-6 p-3 bg-blue-50 text-blue-700 text-xs rounded text-left max-w-xs mx-auto border border-blue-100">
               <span className="font-bold">Context Active:</span> {glossary.length} chars
             </div>
          )}
          <Button onClick={onGenerate} isLoading={isGenerating} size="lg">
            {isGenerating ? 'Analyzing with Vision LLM...' : 'Generate QA Report'}
          </Button>
        </div>
      </div>
    );
  }

  // Robust check for report existence and structural integrity
  const isReportValid = pair.report && pair.report.overall && pair.report.issues && pair.report.summaryZh;

  if (pair.status === 'failed' || !isReportValid) {
     return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              {pair.status === 'failed' ? 'Analysis Failed' : 'Invalid Report Data'}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
                {pair.errorMessage || "The analysis result is missing required data fields."}
            </p>
            
            {pair.errorMessage && (
                <div className="w-full bg-red-50 border border-red-100 rounded p-3 mb-6 text-left">
                    <p className="text-xs font-bold text-red-800 uppercase mb-1">Error Details</p>
                    <p className="text-xs text-red-700 font-mono break-words">{pair.errorMessage}</p>
                </div>
            )}

            <Button onClick={onGenerate} variant="secondary">
                {pair.status === 'failed' ? 'Try Again' : 'Retry Analysis'}
            </Button>
        </div>
     );
  }

  // At this point, report is guaranteed to be valid
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

  const generateHtmlContent = (report: ScreenshotReport, fileName: string) => {
    const { overall, issues, summaryZh } = report;
    const date = new Date().toLocaleString();

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

  const downloadHtml = () => {
    const htmlContent = generateHtmlContent(report, pair.fileName);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", url);
    
    // Updated: Prefix filename with quality level (e.g., Poor_Filename.html)
    const qualityPrefix = report.overall.qualityLevel;
    downloadAnchorNode.setAttribute("download", `${qualityPrefix}_${pair.fileName}_en-US_${targetLangLabel}.html`);
    
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
          <button onClick={downloadHtml} className="p-2 hover:bg-slate-100 rounded text-slate-500" title="Download HTML Report">
            <FileText className="w-4 h-4" />
          </button>
          <button onClick={downloadJson} className="p-2 hover:bg-slate-100 rounded text-slate-500" title="Download JSON">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={onGenerate} className="p-2 hover:bg-slate-100 rounded text-slate-500" title="Regenerate">
             <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          
          {/* Overview Section */}
          <div className="space-y-6 mb-8">
            <div className="flex items-center space-x-2 text-slate-400 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Overview</span>
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
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Scene Description</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{report.overall.sceneDescriptionZh}</p>
            </div>

             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Main Problems</h4>
              <p className="text-sm text-slate-700 leading-relaxed">{report.overall.mainProblemsSummaryZh}</p>
            </div>

            {/* Advice */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
               <h4 className="text-xs font-bold text-blue-500 uppercase mb-2">Optimization Advice</h4>
               <p className="text-sm text-blue-800 leading-relaxed">{report.summaryZh.optimizationAdvice}</p>
            </div>
             {report.summaryZh.termAdvice && (
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-100">
                <h4 className="text-xs font-bold text-purple-500 uppercase mb-2">Terminology</h4>
                <p className="text-sm text-purple-800 leading-relaxed">{report.summaryZh.termAdvice}</p>
              </div>
            )}
          </div>

          {/* Issues Section */}
          <div>
            <div className="flex items-center justify-between text-slate-800 mb-4 pt-4 border-t border-slate-100">
                <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Issues Detected</span>
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
                <p className="text-center text-slate-400 text-sm py-4">No issues found.</p>
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
      <p className="text-sm text-slate-700 mb-3">{issue.descriptionZh}</p>

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