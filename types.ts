// Data Models

export interface QaScores {
  accuracy: number;
  terminology: number;
  layout: number;
  grammar: number;
  formatting: number;
  localizationTone: number;
}

export interface QaIssue {
  id: string;
  location: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  issueCategory: 'Layout' | 'Mistranslation' | 'Untranslated' | 'Terminology' | 'Formatting' | 'Grammar' | 'Style' | 'Other';
  severity: 'Critical' | 'Major' | 'Minor';
  sourceText: string;
  targetText: string;
  descriptionZh: string;
  suggestionsTarget: string[]; // Renamed from suggestionsDe
}

export interface ScreenshotReport {
  screenshotId: string;
  overall: {
    qualityLevel: 'Critical' | 'Poor' | 'Average' | 'Good' | 'Perfect';
    scores: QaScores;
    sceneDescriptionZh: string;
    mainProblemsSummaryZh: string;
  };
  issues: QaIssue[];
  summaryZh: {
    severeCount: number;
    majorCount: number;
    minorCount: number;
    optimizationAdvice: string;
    termAdvice: string;
  };
}

export type SupportedLocale = 'de-DE' | 'fr-FR';

export interface ScreenshotPair {
  id: string;
  fileName: string;
  enImageUrl: string;
  deImageUrl: string; // Keeping variable name for compatibility, but represents target image
  targetLanguage: SupportedLocale; // New field
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  report?: ScreenshotReport;
  errorMessage?: string;
}

export interface GlobalSummary {
  totalAnalyzed: number;
  totalPending: number;
  qualityDistribution: Record<string, number>;
  severityCounts: {
    critical: number;
    major: number;
    minor: number;
  };
  categoryCounts: Record<string, number>;
}

export interface LlmRequestPayload {
  screenshotId: string;
  enImageBase64?: string; // Or URL
  deImageBase64?: string; // Or URL (Target Image)
  targetLanguage: SupportedLocale;
  glossaryText?: string;
}

export interface LlmResponse {
  report: ScreenshotReport;
}