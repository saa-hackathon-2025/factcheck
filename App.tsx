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
    // Inject current theme into input data
    const dataWithTheme = { ...data, themeMode: theme };
    setInputData(dataWithTheme); 
    setIsLoading(true);
    setLoadingMessage("GitHub 레포지토리 연결 중...");

    try {
      // Step 1: Fetch GitHub Repo Data (Multiple)
      const repoCount = data.githubUrls.length;
      setLoadingMessage(`${repoCount}개의 레포지토리 구조 스캔 중...`);
      
      let repoContext = { structure: "", fileContents: "", summary: "" };
      
      try {
        repoContext = await fetchRepoData(data.githubUrls, data.githubToken);
      } catch (e: any) {
        console.error("GitHub Fetch Error", e);
        // Alert user but stop process
        alert(`GitHub 데이터 가져오기 실패: ${e.message}`);
        setIsLoading(false);
        return;
      }

      // Step 2: Gemini Analysis
      setLoadingMessage("AI가 코드를 분석하고 있습니다... (최대 1분 소요)");
      
      // Combine structure and content for context
      const codeContext = `
=== REPO STRUCTURE ===
${repoContext.structure}

=== FILE CONTENTS ===
${repoContext.fileContents}
      `;

      const analysisResult = await analyzeCandidate(dataWithTheme, codeContext);

      setResult(analysisResult);
      setView('ANALYSIS');
    } catch (error: any) {
      console.error("Analysis Error", error);
      alert(error.message || "분석 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setView('INPUT');
    setResult(null);
    setInputData(null);
    setSelectedItem(null);
    setFeedback(null);
  };

  const handleItemClick = (item: AnalysisItem) => {
    setSelectedItem(item);
    setView('INTERVIEW');
  };

  const handleInterviewFinish = async (history: ChatMessage[]) => {
    if (!selectedItem || !inputData) return;
    
    setIsLoading(true);
    setLoadingMessage("면접 결과를 분석하여 피드백을 생성 중입니다...");

    try {
      const feedbackResponse = await getInterviewFeedback(
        history, 
        selectedItem, 
        inputData.interviewLevel,
        theme
      );
      setFeedback(feedbackResponse);
      setView('FEEDBACK');
    } catch (error: any) {
      console.error("Feedback Error", error);
      alert("피드백 생성 중 오류가 발생했습니다: " + error.message);
      // Fallback to analysis view if feedback fails
      setView('ANALYSIS');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInterviewCancel = () => {
    // Just go back to analysis result
    setView('ANALYSIS');
    setSelectedItem(null);
  };

  const handleFeedbackClose = () => {
    // Go back to analysis list
    setView('ANALYSIS');
    setFeedback(null);
    setSelectedItem(null);
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="flex justify-center items-center min-h-[600px]">
            <InterviewChat 
              item={selectedItem}
              interviewLevel={inputData.interviewLevel}
              timeLimitSeconds={inputData.timeLimitSeconds}
              onFinish={handleInterviewFinish}
              onCancel={handleInterviewCancel}
            />
          </div>
        )}

        {view === 'FEEDBACK' && feedback && (
          <InterviewFeedback 
            feedback={feedback} 
            onClose={handleFeedbackClose} 
          />
        )}
      </main>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
          <p className="text-lg font-bold animate-pulse whitespace-pre-line text-center px-4">
            {loadingMessage}
          </p>
        </div>
      )}
      
      <FloatingThemeToggle />
    </div>
  );
};

export default App;