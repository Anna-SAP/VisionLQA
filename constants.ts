import { SupportedLocale, AppLanguage } from "./types";

export const LLM_MODEL_ID = 'gemini-3-flash-preview';
export const LLM_DISPLAY_NAME = 'Gemini 3 Flash';
export const APP_VERSION = 'v1.4.5';

// UI Translations
export const UI_TEXT = {
  zh: {
    title: "Vision LQA Pro",
    uploadTitle: "拖拽上传图片或 ZIP 压缩包",
    uploadSub: "支持 PNG, JPG",
    uploadTipTitle: "批量上传提示：",
    uploadTip: "请上传两个 ZIP 包（如 en-US.zip 和 de-DE.zip）。确保压缩包内的文件名一一对应（如都有 home.png）。目前仅支持 FR 和 DE。",
    processing: "处理文件中...",
    projectContext: "项目上下文 / 术语表",
    screenshotsList: "截图列表",
    globalStats: "全局统计",
    runBulk: "批量运行",
    loadDemo: "加载演示数据",
    startOver: "重新开始",
    source: "源语言",
    target: "目标语言",
    readyToAnalyze: "准备分析",
    readyDesc: "对比 en-US 和目标语言界面的布局、翻译及术语问题。",
    contextActive: "上下文已激活",
    genReport: "生成 LQA 报告",
    analyzing: "AI 正在分析...",
    analysisFailed: "分析失败",
    tryAgain: "重试",
    sceneDesc: "场景描述",
    mainProblems: "主要问题",
    optAdvice: "优化建议",
    terminology: "术语建议",
    issuesDetected: "发现的问题",
    noIssues: "未发现问题",
    exportJson: "导出报告 (JSON)",
    exportHtml: "下载 HTML 报告",
    exportGlobal: "导出全局报告 (JSON)",
    overview: "概览",
    bulkModalTitle: "批量 LQA 分析",
    bulkReady: "准备处理",
    bulkNote: "注意：最大并发数为 5。大批量任务可能需要几分钟。",
    cancel: "取消",
    startBulk: "开始批量运行",
    processingCount: "处理中...",
    complete: "分析完成",
    success: "成功",
    failed: "失败",
    failures: "失败原因",
    downloadZip: "下载全部 (ZIP)",
    downloadCsv: "汇总表 (CSV)",
    close: "关闭窗口",
    langName: "简体中文",
    // Glossary Manager
    glossary: {
      tabManual: "手动输入",
      tabImport: "文件导入",
      dragDrop: "点击或拖拽上传术语表",
      formats: "支持 .xlsx, .csv (最大 50MB)",
      parsing: "解析中...",
      loadDefault: "加载预置术语表",
      defaultDe: "加载 DE-DE 标准术语",
      defaultFr: "加载 FR-FR 标准术语",
      history: "历史记录",
      preview: "预览 (前10条)",
      totalTerms: "总术语数",
      clear: "清空",
      errorFormat: "文件格式错误或缺少必要的列 (Source/Target)",
      apply: "应用",
      applied: "已应用",
      modeLabel: "上传模式",
      modeReplace: "覆盖模式",
      modeAppend: "追加模式",
      filesLoaded: "已加载文件",
      mergedTotal: "合并后共计",
      removeFile: "移除此文件"
    }
  },
  en: {
    title: "Vision LQA Pro",
    uploadTitle: "Drag & drop images or ZIP archives",
    uploadSub: "Supports PNG, JPG",
    uploadTipTitle: "Bulk Upload Tip:",
    uploadTip: "Upload two ZIPs (e.g. en-US.zip & de-DE.zip). Ensure filenames match inside (e.g. home.png). Only FR & DE are supported for now.",
    processing: "Processing files...",
    projectContext: "Project Context / Glossary",
    screenshotsList: "Screenshots",
    globalStats: "Global Stats",
    runBulk: "Run Bulk",
    loadDemo: "Load Demo Data",
    startOver: "Start Over",
    source: "Source",
    target: "Target",
    readyToAnalyze: "Ready to Analyze",
    readyDesc: "Compare en-US and target language for layout, translation, and terminology issues.",
    contextActive: "Context Active",
    genReport: "Generate QA Report",
    analyzing: "AI Analyzing...",
    analysisFailed: "Analysis Failed",
    tryAgain: "Try Again",
    sceneDesc: "Scene Description",
    mainProblems: "Main Problems",
    optAdvice: "Optimization Advice",
    terminology: "Terminology",
    issuesDetected: "Issues Detected",
    noIssues: "No issues found",
    exportJson: "Export JSON",
    exportHtml: "Download HTML",
    exportGlobal: "Export Global Report (JSON)",
    overview: "Overview",
    bulkModalTitle: "Bulk QA Analysis",
    bulkReady: "Ready to process",
    bulkNote: "Note: Max 5 concurrent requests. Large batches may take a few minutes.",
    cancel: "Cancel",
    startBulk: "Start Bulk Run",
    processingCount: "Processing...",
    complete: "Analysis Complete",
    success: "Success",
    failed: "Failed",
    failures: "Failure Reasons",
    downloadZip: "Download All (ZIP)",
    downloadCsv: "Summary (CSV)",
    close: "Close Window",
    langName: "English",
    // Glossary Manager
    glossary: {
      tabManual: "Manual Input",
      tabImport: "File Import",
      dragDrop: "Click or drag to upload glossary",
      formats: "Supports .xlsx, .csv (Max 50MB)",
      parsing: "Parsing...",
      loadDefault: "Load Default Glossary",
      defaultDe: "Load DE-DE Standard",
      defaultFr: "Load FR-FR Standard",
      history: "History",
      preview: "Preview (Top 10)",
      totalTerms: "Total Terms",
      clear: "Clear",
      errorFormat: "Invalid format or missing required columns (Source/Target)",
      apply: "Apply",
      applied: "Applied",
      modeLabel: "Upload Mode",
      modeReplace: "Replace Mode",
      modeAppend: "Append Mode",
      filesLoaded: "Loaded Files",
      mergedTotal: "Merged Total",
      removeFile: "Remove file"
    }
  }
};

export const getAnalysisSystemPrompt = (targetLang: SupportedLocale, reportLang: AppLanguage) => {
  const langName = targetLang === 'fr-FR' ? 'French (Français)' : 'German (Deutsch)';
  const langCode = targetLang;
  
  // Define instructions based on report language
  const isZh = reportLang === 'zh';
  const roleDesc = isZh 
    ? `你是一名专业的${langName}本地化质量保证专家（LQA Specialist，母语为 ${langCode}）。你具备极强的视觉空间感知能力，能够严格遵循“遮罩过滤规则”。`
    : `You are an expert Localization Quality Assurance (LQA) Specialist in ${langName} (Native in ${langCode}). You possess strong visual-spatial perception and strictly adhere to "Mask Filtering Rules".`;

  const maskInstructionZh = `
*** 核心规则：严格的遮罩过滤 (STRICT MASK FILTERING) ***
1. **第一步：分析源图 (Image 1, en-US)**
   - 寻找图中被 **灰色/深色矩形色块 (Gray/Dark Blocks)** 覆盖的区域。
   - 这些区域是“非检查区 (Exclusion Zones)”，通常覆盖了顶部导航栏、侧边栏或敏感数据。

2. **第二步：映射到目标图 (Image 2, ${langCode})**
   - 将源图中的“非检查区”坐标在空间上映射到目标图上。
   - 即使目标图在这些位置显示了清晰的文字、按钮或 UI 控件，也必须视其为**不存在**。

3. **第三步：仅检查有效区域**
   - 只对源图中**完全可见、未被遮挡**的区域对应的目标图内容进行 LQA 检查。
   - **严禁**报告任何位于遮罩区域内的翻译问题、布局错误或术语问题。
   - 示例：如果源图顶部导航栏被灰色块遮盖，而目标图显示了导航栏，**请完全忽略导航栏中的任何问题**（即使存在明显的翻译错误）。
`;

  const maskInstructionEn = `
*** CORE RULE: STRICT MASK FILTERING ***
1. **Step 1: Analyze Source Image (Image 1, en-US)**
   - Identify areas covered by **SOLID GRAY/DARK BLOCKS**.
   - These are "Exclusion Zones", usually covering headers, sidebars, or sensitive data.

2. **Step 2: Map to Target Image (Image 2, ${langCode})**
   - Project these Exclusion Zones onto the Target Image coordinates.
   - Even if the Target Image shows clear text, buttons, or UI controls in these zones, treat them as **NON-EXISTENT**.

3. **Step 3: Inspect Only Valid Areas**
   - Perform LQA checks ONLY on content that is **VISIBLY UNMASKED** in the Source Image.
   - **DO NOT** report any mistranslations, layout issues, or terminology errors located within the masked zones.
   - Example: If the top header is grayed out in Source, but visible in Target, **IGNORE the header completely** (even if it has mistranslation).
`;
    
  const taskDesc = isZh
    ? `任务目标：
这是一次 UI 截图测试。
${maskInstructionZh}

你需要从两个角度检查**有效区域**内的内容：
1. 语言层面：翻译准确性（不包含未翻译的内容）、术语、语法、语气、文化与格式（日期/数字/单位）；
2. 视觉层面：${langName}文本是否因为长度增加而导致 截断（Truncation）、溢出、重叠、换行异常 等 UI 问题。

注意：请忽略所有“未翻译（Untranslated）”的文本，这部分由其他团队负责。`
    : `Task Objective:
This is a UI Screenshot Testing task.
${maskInstructionEn}

You need to inspect the **VALID AREAS** from two perspectives:
1. Linguistic: Translation accuracy (excluding untranslated text), terminology, grammar, tone, culture, and formatting (dates/numbers/units).
2. Visual: Check for UI issues caused by text expansion in ${langName}, such as Truncation, Overflow, Overlap, or abnormal line breaks.

NOTE: Please IGNORE all "Untranslated" text, as this is handled by another team.`;

  const outputInstruction = isZh
    ? `请严格按以下 JSON 格式输出（所有描述性文字请使用简体中文）：`
    : `Please strictly output the following JSON format (All descriptive text must be in English):`;

  // Removed "Untranslated" from issueCategory enum
  const jsonSchema = `{
  "screenshotId": "string",
  "overall": {
    "qualityLevel": "Critical" | "Poor" | "Average" | "Good" | "Perfect",
    "scores": { "accuracy": 0, "terminology": 0, "layout": 0, "grammar": 0, "formatting": 0, "localizationTone": 0 },
    "sceneDescription": "${isZh ? '简体中文场景描述（需注明：已忽略遮罩区域）' : 'Scene description in English (Note: Masked areas ignored)'}",
    "mainProblemsSummary": "${isZh ? '简体中文问题总结' : 'Summary of main problems in English'}"
  },
  "issues": [
    {
      "id": "Issue-XX",
      "location": "${isZh ? '问题位置描述' : 'Location description'}",
      "issueCategory": "Layout" | "Mistranslation" | "Terminology" | "Formatting" | "Grammar" | "Style" | "Other",
      "severity": "Critical" | "Major" | "Minor",
      "sourceText": "en text",
      "targetText": "${langCode} text",
      "description": "${isZh ? '简体中文问题详情' : 'Detailed issue description in English'}",
      "suggestionsTarget": ["${isZh ? '建议译文' : 'Suggested translation'}"]
    }
  ],
  "summary": {
    "severeCount": 0,
    "majorCount": 0,
    "minorCount": 0,
    "optimizationAdvice": "${isZh ? '简体中文优化建议' : 'Optimization advice in English'}",
    "termAdvice": "${isZh ? '简体中文术语建议' : 'Terminology advice in English'}"
  }
}`;

  return `
${roleDesc}
You possess strong visual understanding capabilities to read and analyze UI screenshots.

Inputs:
1. sourceScreenshot: en-US Interface (Source)
2. targetScreenshot: ${langCode} Interface (Target)
3. glossaryText (Optional): Project context/glossary strings.

${taskDesc}

Evaluation Dimensions (0-5 score):
- Translation Accuracy
- Terminology Consistency
- Layout & Truncation
- Grammar & Spelling
- Locale Formatting
- Localization & Tone

${outputInstruction}
${jsonSchema}
`;
};