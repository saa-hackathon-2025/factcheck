

import React, { useState, useRef, useEffect } from 'react';
import { AnalysisItem, ChatMessage, InterviewLevel } from '../types';
import { chatWithInterviewer } from '../services/geminiService';
// Removed unused useTheme

interface InterviewChatProps {
  item: AnalysisItem;
  interviewLevel: InterviewLevel;
  timeLimitSeconds?: number;
  onFinish: (history: ChatMessage[]) => void;
  onCancel: () => void;
}

const InterviewChat: React.FC<InterviewChatProps> = ({ 
  item, 
  interviewLevel, 
  timeLimitSeconds, 
  onFinish, 
  onCancel 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: item.interviewQuestion }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConcluding, setIsConcluding] = useState(false);
  const [countdown, setCountdown] = useState(5);
  
  // Timer State for "Time Limit Mode"
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Removed theme context usage to prevent leak

  // Calculate current question number (User messages count)
  const currentQuestionCount = messages.filter(m => m.role === 'user').length + 1;
  const targetQuestions = 10;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Timer Effect
  useEffect(() => {
    if (timeLimitSeconds && !isTyping && !isConcluding) {
      // Reset timer when it's user's turn
      setTimeLeft(timeLimitSeconds);
    } else {
      setTimeLeft(null);
    }
  }, [messages.length, timeLimitSeconds, isTyping, isConcluding]);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isTyping || isConcluding) return;

    const userMsg: ChatMessage = { role: 'user', text: inputValue };
    const currentHistory = [...messages, userMsg];
    
    setMessages(currentHistory);
    setInputValue('');
    setIsTyping(true);
    setTimeLeft(null); // Stop timer

    try {
      const responseText = await chatWithInterviewer(
        currentHistory, 
        item, 
        interviewLevel, 
        timeLimitSeconds
        // Removed theme arg
      );
      const updatedHistory = [...currentHistory, { role: 'model' as const, text: responseText }];
      
      setMessages(updatedHistory);

      // Check if the interviewer is ending the session
      if (responseText.includes("면접을 종료하겠습니다")) {
        setIsConcluding(true);
        
        let count = 5;
        const intervalId = setInterval(() => {
          count--;
          setCountdown(count);
          if (count <= 0) {
            clearInterval(intervalId);
            onFinish(updatedHistory);
          }
        }, 1000);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: "통신 오류가 발생했습니다. 잠시 후 다시 답변을 입력해주세요." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[600px] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-2xl animate-fade-in-up relative">
      
      {/* Concluding Overlay */}
      {isConcluding && (
        <div className="absolute inset-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-fade-in text-center">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-bounce">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">면접 방어 성공!</h3>
          <p className="text-slate-600 dark:text-slate-300 mb-6">충분히 설명되었습니다. 잠시 후 피드백 페이지로 이동합니다.</p>
          <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-cyan-400">
            {countdown}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-100 dark:bg-slate-800 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center z-10">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConcluding ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></span>
            심층 압박 면접
            <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 ml-2">
              Q. {Math.min(currentQuestionCount, targetQuestions)} / {targetQuestions}
            </span>
          </h3>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-xs text-slate-500 dark:text-slate-400">주제: {item.topic}</span>
             <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 rounded border border-slate-300 dark:border-slate-600 uppercase">{interviewLevel}</span>
          </div>
        </div>
        
        {/* Timer Display */}
        {timeLimitSeconds && timeLeft !== null && (
           <div className={`flex items-center gap-1 text-lg font-mono font-bold ${timeLeft <= 5 ? 'text-rose-600 dark:text-rose-500 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {timeLeft}s
           </div>
        )}

        <button 
          onClick={onCancel}
          disabled={isConcluding}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm px-3 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 ml-4"
        >
          나가기
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-[#0f172a]">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap border
                ${msg.role === 'user' 
                  ? 'bg-rose-600 text-white border-rose-600 rounded-tr-none' 
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 rounded-tl-none'
                }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 flex gap-1 shadow-sm">
              <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-10">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isConcluding ? "면접이 종료되었습니다." : "답변을 입력하세요... (Shift+Enter로 줄바꿈)"}
            disabled={isTyping || isConcluding}
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 text-slate-900 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 focus:outline-none disabled:bg-slate-50 disabled:dark:bg-slate-950 disabled:text-slate-400 dark:disabled:text-slate-600 resize-none h-[50px] custom-scrollbar"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping || isConcluding}
            className="bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-3 rounded-lg font-bold transition-colors h-[50px] flex items-center justify-center"
          >
            전송
          </button>
        </form>
        {!isConcluding && (
          <div className="mt-3 flex justify-center">
             <button 
               onClick={() => onFinish(messages)}
               className="text-xs text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 underline decoration-dotted transition-colors"
             >
               답변이 어렵나요? 면접 종료하고 피드백 받기
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewChat;
