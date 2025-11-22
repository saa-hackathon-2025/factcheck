

export enum VerdictType {
  VERIFIED = 'VERIFIED',
  EXAGGERATED = 'EXAGGERATED',
  MISSING = 'MISSING',
  UNCERTAIN = 'UNCERTAIN'
}

export interface AnalysisItem {
  topic: string;
  resumeClaim: string;
  codeObservation: string;
  questionBasis: string; // Why we are asking this? (Link to JD or specific code logic)
  verdict: VerdictType;
  interviewQuestion: string;
  score: number; // 0 to 100 confidence of mismatch
}

export interface EvaluationMetric {
  score: number;
  reason: string;
}

export interface EvaluationMetrics {
  architecture: EvaluationMetric;       // 1. 아키텍처 및 설계 능력
  codeQuality: EvaluationMetric;        // 2. 코드 품질 및 스타일
  problemSolving: EvaluationMetric;     // 3. 문제 해결 및 논리력
  techProficiency: EvaluationMetric;    // 4. 기술 활용 숙련도
  projectCompleteness: EvaluationMetric;// 5. 프로젝트 완성도
  consistency: EvaluationMetric;        // 6. 서류와 코드의 일치성 (진실성)
  growthPotential: EvaluationMetric;    // 7. 성장 가능성 및 학습 태도
}

export interface PracticalTips {
  expectedQuestions: string[];
  improvements: string[];
  answerTips: string[];
}

export interface AnalysisSummary {
  jdAnalysis: string; // 공고 요약
  alignmentAnalysis: string; // 일치도 분석
  practicalTips: PracticalTips; // 실전 팁
}

export interface AnalysisResponse {
  items: AnalysisItem[]; 
  evaluation: EvaluationMetrics;
  summary: AnalysisSummary;
}

export interface CoverLetterItem {
  question: string;
  answer: string;
}

export type InterviewLevel = 'intern' | 'junior' | 'mid3' | 'mid5';
export type RepoType = 'backend' | 'frontend' | 'ml' | 'research' | 'unknown';

export interface InputData {
  // Interview Config
  interviewLevel: InterviewLevel;
  timeLimitSeconds?: number;
  themeMode?: 'light' | 'dark'; // Added for theme-aware analysis

  // Company Info
  talentIdeal: string; // 인재상
  jdType: 'text' | 'file' | 'url';
  jobDescription: string;
  jdFileBase64?: string; // Data URL
  jdFileMimeType?: string;

  // Candidate Info
  docType: 'resume' | 'coverLetter';
  resumeType: 'text' | 'file' | 'notion'; // resume sub-type
  resumeText: string;
  resumeFileBase64?: string;
  resumeFileMimeType?: string;
  coverLetterItems: CoverLetterItem[];

  // Code Info
  githubUrls: string[];
  githubToken?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface InterviewFeedbackResponse {
  defenseScore: number; // Total 0 to 10
  
  // Detailed Scoring
  logicScore: number; // Max 5
  logicReasoning: string; // Why they got points
  logicImprovement: string; // Why they lost points
  
  solutionScore: number; // Max 5
  solutionReasoning: string;
  solutionImprovement: string;

  feedbackSummary: string;
  
  // Categorized Feedback
  positiveFeedback: string[];    // 3 strengths
  constructiveFeedback: string[]; // 3 weaknesses
  actionItems: string[];         // 3 concrete actions
}