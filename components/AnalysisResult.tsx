import React from 'react';
import { AnalysisResponse, VerdictType, AnalysisItem, EvaluationMetric } from '../types';

interface AnalysisResultProps {
  result: AnalysisResponse;
  onReset: () => void;
  onItemClick: (item: AnalysisItem) => void;
}

const getVerdictColor = (verdict: VerdictType) => {
  switch (verdict) {
    case VerdictType.VERIFIED: return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/50';
    case VerdictType.EXAGGERATED: return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/50';
    case VerdictType.MISSING: return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/50';
    case VerdictType.UNCERTAIN: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/50';
    default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
  }
};

const MetricBar: React.FC<{ label: string; data: EvaluationMetric; color: string }> = ({ label, data, color }) => (
  <div className="mb-4 last:mb-0">
    <div className="flex justify-between items-end mb-1">
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-mono font-bold ${color}`}>{data.score}점</span>
    </div>
    <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
      <div 
        className={`h-full ${color.replace('text-', 'bg-')} transition-all duration-1000`} 
        style={{ width: `${data.score}%` }}
      ></div>
    </div>
    <p className="text-[11px] text-slate-600 dark:text-slate-500 leading-tight">{data.reason}</p>
  </div>
);

const ResultItemCard: React.FC<{ item: AnalysisItem; index: number; onClick: () => void }> = ({ item, index, onClick }) => {
  const renderQuestionBasis = (text: string) => {
    const jdMatch = text.match(/\[JD 요건\]:?\s*([\s\S]*?)(?=\[코드 현황\]|\[면접관의 의도\]|$)/);
    const codeMatch = text.match(/\[코드 현황\]:?\s*([\s\S]*?)(?=\[면접관의 의도\]|$)/);
    const intentMatch = text.match(/\[면접관의 의도\]:?\s*([\s\S]*?)$/);

    const hasStructure = jdMatch || codeMatch || intentMatch;

    if (hasStructure) {
      return (
        <div className="space-y-3 pt-1">
          {jdMatch && (
            <div className="pl-3 border-l-2 border-slate-400 dark:border-slate-600">
              <p className="text-[10px] font-bold text-slate-500 mb-0.5">JD 요건</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{jdMatch[1].trim()}</p>
            </div>
          )}
          {codeMatch && (
            <div className="pl-3 border-l-2 border-rose-500/50">
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mb-0.5">코드 현황</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{codeMatch[1].trim()}</p>
            </div>
          )}
          {intentMatch && (
            <div className="pl-3 border-l-2 border-amber-500/50">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mb-0.5">의도</p>
              <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">{intentMatch[1].trim()}</p>
            </div>
          )}
        </div>
      );
    }
    return <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{text}</p>;
  };

  return (
    <div 
      onClick={onClick}
      className="group bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg p-5 transition-all hover:border-rose-500 hover:shadow-lg hover:shadow-rose-500/10 dark:hover:shadow-rose-900/20 cursor-pointer"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded">#{index + 1}</span>
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">{item.topic}</h3>
        </div>
        <span className={`px-2 py-1 rounded text-[10px] font-bold border ${getVerdictColor(item.verdict)}`}>
          {item.verdict}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded border border-slate-200 dark:border-slate-800 min-w-0">
          <p className="text-[10px] text-slate-500 mb-1 uppercase font-bold">자소서 주장</p>
          <p className="text-xs text-slate-700 dark:text-slate-300">{item.resumeClaim}</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded border border-slate-200 dark:border-slate-800 min-w-0">
          <p className="text-[10px] text-slate-500 mb-1 uppercase font-bold">코드 팩트</p>
          <p className="text-xs text-slate-700 dark:text-slate-300 font-mono break-all whitespace-pre-wrap max-h-[240px] overflow-y-auto custom-scrollbar">
            {item.codeObservation}
          </p>
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded border border-slate-200 dark:border-slate-700/50 mb-4">
        {renderQuestionBasis(item.questionBasis)}
      </div>

      <div className="mt-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/20 p-4 rounded group-hover:bg-rose-100 dark:group-hover:bg-rose-950/40 transition-colors">
        <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">AI 압박 질문</p>
        <p className="text-base font-bold text-slate-800 dark:text-slate-200">"{item.interviewQuestion}"</p>
      </div>
    </div>
  );
};

const AnalysisResult: React.FC<AnalysisResultProps> = ({ result, onReset, onItemClick }) => {
  const { evaluation, summary } = result;
  
  // 7 Metrics Average Calculation
  const scores = [
    evaluation.architecture.score,
    evaluation.codeQuality.score,
    evaluation.problemSolving.score,
    evaluation.techProficiency.score,
    evaluation.projectCompleteness.score,
    evaluation.consistency.score,
    evaluation.growthPotential.score
  ];
  
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* 1. MAIN REPORT HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-slate-50 dark:bg-slate-950 p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">면접 역량 정밀 분석 리포트</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">AI 면접관이 7가지 핵심 기술 지표를 기준으로 산출한 결과입니다.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="block text-xs text-slate-500 font-bold uppercase">서류 역량 진단 (평균)</span>
              <span className={`text-3xl font-black ${avgScore >= 80 ? 'text-emerald-500 dark:text-emerald-400' : avgScore >= 60 ? 'text-amber-500 dark:text-amber-400' : 'text-rose-500'}`}>
                {avgScore >= 90 ? 'S' : avgScore >= 80 ? 'A' : avgScore >= 70 ? 'B' : avgScore >= 50 ? 'C' : 'D'}
              </span>
            </div>
            <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center bg-white dark:bg-slate-900 ${avgScore >= 70 ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-rose-500 text-rose-600 dark:text-rose-400'}`}>
              <span className="text-xl font-bold">{avgScore}</span>
            </div>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Metrics (7 Items) */}
          <div className="space-y-1">
             <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
               <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
               상세 평가 지표 (7대 기준)
             </h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
               <MetricBar label="아키텍처 이해도" data={evaluation.architecture} color="text-indigo-600 dark:text-indigo-400" />
               <MetricBar label="코드 품질" data={evaluation.codeQuality} color="text-cyan-600 dark:text-cyan-400" />
               
               <MetricBar label="문제 해결력" data={evaluation.problemSolving} color="text-rose-600 dark:text-rose-400" />
               <MetricBar label="기술 숙련도" data={evaluation.techProficiency} color="text-emerald-600 dark:text-emerald-400" />
               
               <MetricBar label="프로젝트 완성도" data={evaluation.projectCompleteness} color="text-amber-600 dark:text-amber-400" />
               <MetricBar label="서류 일치성 (Fact)" data={evaluation.consistency} color="text-purple-600 dark:text-purple-400" />
               
               <MetricBar label="성장 가능성" data={evaluation.growthPotential} color="text-blue-600 dark:text-blue-400" />
             </div>
          </div>

          {/* Right: 3-Step Summary */}
          <div className="space-y-4">
             <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1 block">Step 1. 공고 핵심 요약</span>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{summary.jdAnalysis}</p>
             </div>
             <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1 block">Step 2. 일치도 분석</span>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{summary.alignmentAnalysis}</p>
             </div>
          </div>
        </div>
      </div>

      {/* 2. PRACTICAL TIPS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900/80 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-3 flex items-center gap-2">🔥 예상 면접 질문</h4>
          <ul className="space-y-2">
            {summary.practicalTips.expectedQuestions.map((q, i) => (
              <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <span className="text-rose-500 font-bold">{i+1}.</span> {q}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white dark:bg-slate-900/80 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-2">⚠️ 보완 필요 사항</h4>
          <ul className="space-y-2">
            {summary.practicalTips.improvements.map((q, i) => (
              <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span> {q}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white dark:bg-slate-900/80 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
          <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-3 flex items-center gap-2">💡 답변 팁</h4>
          <ul className="space-y-2">
            {summary.practicalTips.answerTips.map((q, i) => (
              <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <span className="text-emerald-500 font-bold">✓</span> {q}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 3. FACT CHECK LIST (Verdicts visualized) */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3 px-2">
          <span className="w-1 h-6 bg-rose-500 rounded-full"></span>
          항목별 팩트체크 및 실전 질문 ({result.items.length})
        </h3>
        <div className="grid gap-4">
          {result.items.map((item, idx) => (
            <ResultItemCard 
              key={idx} 
              item={item} 
              index={idx} 
              onClick={() => onItemClick(item)} 
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center pt-8">
        <button
          onClick={onReset}
          className="px-8 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500 transition-all text-sm font-semibold"
        >
          처음으로 돌아가기
        </button>
      </div>
    </div>
  );
};

export default AnalysisResult;