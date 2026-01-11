import { ScreenshotReport } from '../types';

export const generateReportHtml = (report: ScreenshotReport, fileName: string, targetLang: string) => {
    if (!report || !report.overall || !report.summary || !report.issues) {
      return `<html><body><h1>Error: Incomplete Report Data</h1></body></html>`;
    }

    const { overall, issues, summary } = report;
    const date = new Date().toLocaleString();

    const styles = `
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #334155; line-height: 1.6; max-width: 960px; margin: 0 auto; padding: 40px; background: #f8fafc; }
      .header { border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
      .title { font-size: 28px; font-weight: 800; color: #0f172a; line-height: 1.2; }
      .subtitle { font-size: 16px; color: #64748b; margin-top: 4px; }
      .meta { text-align: right; color: #64748b; font-size: 14px; }
      .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
      .badge-critical { background: #fee2e2; color: #991b1b; }
      .badge-poor { background: #ffedd5; color: #9a3412; }
      .badge-average { background: #fef9c3; color: #854d0e; }
      .badge-good { background: #dbeafe; color: #1e40af; }
      .badge-perfect { background: #dcfce7; color: #166534; }
      
      .section { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 24px; border: 1px solid #e2e8f0; }
      .section-title { font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; letter-spacing: -0.01em; }
      .section-content { font-size: 15px; color: #475569; }
      
      .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
      .stat-box { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
      .stat-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; margin-bottom: 4px; }
      .stat-value { font-size: 24px; font-weight: 700; color: #0f172a; }
      
      .issue-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 20px; border-left-width: 6px; background: white; transition: transform 0.2s; }
      .issue-card:hover { transform: translateY(-2px); box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
      .issue-critical { border-left-color: #ef4444; } 
      .issue-major { border-left-color: #f97316; } 
      .issue-minor { border-left-color: #eab308; }
      
      .issue-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
      .issue-id { font-family: monospace; font-weight: 700; color: #334155; background: #f1f5f9; padding: 2px 6px; rounded: 4px; }
      .issue-cat { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-left: 8px; }
      .issue-sev { font-size: 12px; font-weight: 700; text-transform: uppercase; }
      .sev-critical { color: #dc2626; } .sev-major { color: #ea580c; } .sev-minor { color: #ca8a04; }

      .issue-desc { margin-bottom: 16px; font-size: 15px; color: #334155; }
      
      .comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
      .text-box { background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 14px; }
      .text-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; display: block; }
      .text-content { word-wrap: break-word; }
      .text-content.target { text-decoration: line-through; text-decoration-color: #f87171; color: #991b1b; }
      
      .suggestion-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 12px; }
      .suggestion-label { color: #15803d; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; display: block; }
      .suggestion-content { color: #166534; font-weight: 500; font-size: 14px; }
    `;

    const getQualityBadgeClass = (level: string) => {
        switch(level) {
            case 'Critical': return 'badge-critical';
            case 'Poor': return 'badge-poor';
            case 'Average': return 'badge-average';
            case 'Good': return 'badge-good';
            case 'Perfect': return 'badge-perfect';
            default: return 'badge-average';
        }
    };

    const issueHtml = issues.map(issue => `
      <div class="issue-card issue-${issue.severity.toLowerCase()}">
        <div class="issue-header">
            <div>
                <span class="issue-id">${issue.id}</span>
                <span class="issue-cat">${issue.issueCategory}</span>
            </div>
            <span class="issue-sev sev-${issue.severity.toLowerCase()}">${issue.severity}</span>
        </div>
        <p class="issue-desc">${issue.description}</p>
        <div class="comparison-grid">
            <div class="text-box">
                <span class="text-label">Source (EN-US)</span>
                <div class="text-content">${issue.sourceText || '-'}</div>
            </div>
            <div class="text-box">
                <span class="text-label">Current (${targetLang})</span>
                <div class="text-content target">${issue.targetText || '-'}</div>
            </div>
        </div>
        <div class="suggestion-box">
            <span class="suggestion-label">Suggestion</span>
            <div class="suggestion-content">${issue.suggestionsTarget?.join('<br/>') || '-'}</div>
        </div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LQA Report - ${fileName}</title>
            <style>${styles}</style>
        </head>
        <body>
          <div class="header">
            <div>
                <div class="title">Vision LQA Report</div>
                <div class="subtitle">File: ${fileName} &nbsp;|&nbsp; Target: ${targetLang}</div>
            </div>
            <div class="meta">
                <div>Generated: ${date}</div>
                <div style="margin-top:8px;">
                    <span class="badge ${getQualityBadgeClass(overall.qualityLevel)}">${overall.qualityLevel} Quality</span>
                </div>
            </div>
          </div>

          <div class="stat-grid">
            <div class="stat-box">
                <div class="stat-label">Total Issues</div>
                <div class="stat-value">${issues.length}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Critical / Major</div>
                <div class="stat-value" style="color:#dc2626">${summary.severeCount + summary.majorCount}</div>
            </div>
             <div class="stat-box">
                <div class="stat-label">Accuracy Score</div>
                <div class="stat-value" style="color:#2563eb">${overall.scores?.accuracy || 0}<span style="font-size:14px;color:#94a3b8;font-weight:400">/5</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Scene Description</div>
            <div class="section-content">${overall.sceneDescription}</div>
          </div>

          <div class="section">
            <div class="section-title">Main Problems Summary</div>
            <div class="section-content">${overall.mainProblemsSummary}</div>
          </div>

          <div class="section">
             <div class="section-title">Optimization Advice</div>
             <div class="section-content">${summary.optimizationAdvice}</div>
          </div>

          ${summary.termAdvice ? `
          <div class="section">
             <div class="section-title">Terminology Advice</div>
             <div class="section-content">${summary.termAdvice}</div>
          </div>
          ` : ''}

          <div class="section" style="background:transparent; border:none; padding:0; box-shadow:none;">
            <div class="section-title" style="margin-bottom:20px; border:none;">Detailed Issues</div>
            ${issueHtml}
          </div>
          
          <div style="text-align:center; color:#94a3b8; font-size:12px; margin-top:40px;">
            Generated by Vision LQA Pro
          </div>
        </body>
      </html>
    `;
};