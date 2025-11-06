export interface VideoAnalysisRequest {
  video1: string;
  video2: string;
  studentName: string;
  grade: string;
  level: string;
  unit: string;
  apiKey?: string;
  useMockData?: boolean;
}

export interface LearningDataMetric {
  trend: "提升" | "下降" | "持平";
  percentage: string;
  analysis: string;
}

export interface ProgressDimension {
  analysis: string;
  example: string;
}

export interface PronunciationExample {
  word: string;
  incorrect: string;
  correct: string;
  type: string;
}

export interface GrammarExample {
  sentence: string;
  error: string;
  correction: string;
  rule: string;
}

export interface IntonationExample {
  sentence: string;
  issue: string;
  improvement: string;
}

export interface Suggestion {
  title?: string;
  description?: string;
  point?: string;
}

export interface VideoAnalysisResponse {
  studentName: string;
  grade: string;
  level: string;
  unit: string;
  learningData: {
    handRaising: LearningDataMetric;
    answerLength: LearningDataMetric;
    completeSentences: LearningDataMetric;
    readingAccuracy: LearningDataMetric;
  };
  progressDimensions: {
    fluency: ProgressDimension;
    confidence: ProgressDimension;
    languageApplication: ProgressDimension;
    sentenceComplexity: ProgressDimension;
  };
  improvementAreas: {
    pronunciation?: {
      overview: string;
      details: string;
      examples: PronunciationExample[];
      persistentIssues?: {
        title: string;
        items: string[];
      };
      suggestions: Suggestion[];
    };
    grammar?: {
      overview: string;
      details: string;
      examples: GrammarExample[];
      suggestions: Suggestion[];
    };
    intonation?: {
      overview: string;
      details: string;
      examples: IntonationExample[];
      suggestions: Suggestion[];
    };
  };
}

