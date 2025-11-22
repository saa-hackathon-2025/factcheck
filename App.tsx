

import React, { useState } from 'react';
import Header from './components/Header';
import InputForm from './components/InputForm';
import AnalysisResult from './components/AnalysisResult';
import InterviewChat from './components/InterviewChat';
import InterviewFeedback from './components/InterviewFeedback';
import FloatingThemeToggle from './components/FloatingThemeToggle';
import { useTheme } from './context/ThemeContext';
import { analyzeCandidate, getInterviewFeedback } from './services/geminiService';
import { fetchRepoData } from './services/githubService';
import { InputData, AnalysisResponse, AnalysisItem, ChatMessage, InterviewFeedbackResponse } from './types';

type ViewState = 'INPUT' | 'ANALYSIS' | 'INTERVIEW' | 'FEEDBACK';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('INPUT');
  const [inputData, setInputData] = useState<InputData | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [selectedItem, setSelectedItem] = useState<AnalysisItem | null>(null);
  const [feedback, setFeedback] = useState<InterviewFeedbackResponse | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  
  const { theme } = useTheme();

  const handleAnalyze = async (data: InputData) => {
    const dataWithTheme = { ...data, themeMode: theme };
    setInputData(dataWithTheme); // Save input data with theme
    setIsLoading(true);
    setLoadingMessage("GitHub 레포지토리 연결 중...");

    try {
      // Step 1: Fetch GitHub Repo Data (Multiple)
      const repoCount = data.githubUrls.length;
      setLoadingMessage(`${repoCount}개의 레포지토리 구조 스캔 및 병합 중...`);
      
      const repoContextData = await fetchRepoData(data.githubUrls, data.githubToken);
      
      setLoadingMessage(`[${data.interviewLevel}] 레벨 기준 핵심 코드 분석 및 검증 진행 중...`);
      
      const fullCodeContext = `
        ${repoContextData.structure}
        
        ${repoContextData.fileContents}
      `;

      // Step 2: Gemini Analysis with new complex inputs
      const analysisData = await analyzeCandidate(
        dataWithTheme,
        fullCodeContext
      );
      
      setResult(analysisData);
      setView('ANALYSIS');
    } catch (error: any) {
      console.error("Analysis failed:", error);
      alert(`오류 발생: ${error.message || "분석에 실패했습니다."}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemClick = (item: AnalysisItem) => {
    setSelectedItem(item);
    setView('INTERVIEW');
    window.scrollTo(0, 0);
  };

  const handleInterviewFinish = async (history: ChatMessage[]) => {
    if (!selectedItem || !inputData) return;
    
    setIsLoading(true);
    setLoadingMessage("면접 답변을 분석하고 피드백을 생성 중입니다...");
    
    try {
      const feedbackData = await getInterviewFeedback(
        history, 
        selectedItem, 
        inputData.interviewLevel,
        theme // Pass current theme for feedback generation
      );
      setFeedback(feedbackData);
      setView('FEEDBACK');
    } catch (error) {
      alert("피드백 생성 중 오류가 발생했습니다.");
      // Fallback to analysis view
      setView('ANALYSIS');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setSelectedItem(null);
    setFeedback(null);
    setView('INPUT');
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen transition-colors duration-300 bg-slate-50 dark:bg-[#0f172a] dark:bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] dark:from-slate-800 dark:via-[#0f172a] dark:to-black text-slate-900 dark:text-slate-50 font-sans">
      <Header />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Section (Only on Input) */}
        {view === 'INPUT' && !isLoading && (
          <div className="text-center mb-12 space-y-6">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white pb-2">
              코드로 검증하는 내 자소서
            </h2>
            <div className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto text-left space-y-3 bg-white dark:bg-slate-900/50 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-inner">
              <p className="flex items-start gap-3">
                <span className="text-rose-600 dark:text-rose-500 font-bold text-xl">✓</span>
                <span className="leading-relaxed"><strong className="text-slate-900 dark:text-slate-200">당신의 프로젝트가 어떤 질문을 부를지, AI가 먼저 분석합니다.</strong></span>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-rose-600 dark:text-rose-500 font-bold text-xl">✓</span>
                <span className="leading-relaxed"><strong className="text-slate-900 dark:text-slate-200">버튼 하나로</strong> 레포지토리 전체 구조를 파악해서 질문을 뽑아보세요.</span>
              </p>
              <p className="flex items-start gap-3">
                <span className="text-rose-600 dark:text-rose-500 font-bold text-xl">✓</span>
                <span className="leading-relaxed">단순 CS 암기 테스트가 아닌, <strong className="text-slate-900 dark:text-slate-200">내 프로젝트에 최적화된 심층 검증 리포트를 받아보세요.</strong></span>
              </p>
            </div>
          </div>
        )}

        {/* Loading View */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 border-t-4 border-rose-500 rounded-full animate-spin"></div>
              <div className="absolute inset-4 border-t-4 border-emerald-500 rounded-full animate-spin reverse-spin"></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white animate-pulse">AI 처리 중...</h3>
              <p className="text-slate-500 dark:text-slate-400 font-mono text-sm">
                {`> ${loadingMessage}`}
              </p>
            </div>
          </div>
        )}

        {/* Main Content Views */}
        {!isLoading && (
          <>
            {view === 'INPUT' && (
              <InputForm onSubmit={handleAnalyze} isLoading={isLoading} />
            )}

            {view === 'ANALYSIS' && result && (
              <AnalysisResult 
                result={result} 
                onReset={handleReset} 
                onItemClick={handleItemClick}
              />
            )}

            {view === 'INTERVIEW' && selectedItem && inputData && (
              <InterviewChat 
                item={selectedItem}
                interviewLevel={inputData.interviewLevel}
                timeLimitSeconds={inputData.timeLimitSeconds}
                onFinish={handleInterviewFinish}
                onCancel={() => setView('ANALYSIS')}
              />
            )}

            {view === 'FEEDBACK' && feedback && (
              <InterviewFeedback 
                feedback={feedback}
                onClose={() => setView('ANALYSIS')}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-900 mt-12 py-8 bg-slate-100 dark:bg-slate-950 transition-colors">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 dark:text-slate-600 text-sm">
          <p>© 2025 FactCheckAI</p>
          <p className="text-xs mt-1 text-slate-400 dark:text-slate-700">API Rate Limit에 따라 분석이 제한될 수 있습니다.</p>
        </div>
      </footer>

      <FloatingThemeToggle />
    </div>
  );
};

export default App;