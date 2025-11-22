

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResponse, VerdictType, AnalysisItem, ChatMessage, InterviewFeedbackResponse, InputData, InterviewLevel } from '../types';

// --- SCHEMAS ---

// 1. Analysis Schema (Updated for 7 Metrics)
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      description: "List of specific claims found in the Resume/Cover Letter that need to be fact-checked against the Code and JD.",
      items: {
        type: Type.OBJECT,
        properties: {
          topic: { type: Type.STRING },
          resumeClaim: { type: Type.STRING },
          codeObservation: { type: Type.STRING },
          questionBasis: { 
            type: Type.STRING, 
            description: "Structured text: '[JD 요건]: ... [코드 현황]: ... [면접관의 의도]: ...'" 
          },
          verdict: { 
            type: Type.STRING, 
            enum: [VerdictType.VERIFIED, VerdictType.EXAGGERATED, VerdictType.MISSING, VerdictType.UNCERTAIN] 
          },
          interviewQuestion: { type: Type.STRING, description: "Specific pressure question based on rules. Must mention time limit if set." },
          score: { type: Type.NUMBER },
        },
        required: ["topic", "resumeClaim", "codeObservation", "questionBasis", "verdict", "interviewQuestion", "score"],
      },
    },
    evaluation: {
      type: Type.OBJECT,
      description: "Score the candidate based on 7 distinct technical criteria (0-100).",
      properties: {
        architecture: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, reason: { type: Type.STRING } } },
        codeQuality: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, reason: { type: Type.STRING } } },
        problemSolving: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, reason: { type: Type.STRING } } },
        techProficiency: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, reason: { type: Type.STRING } } },
        projectCompleteness: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, reason: { type: Type.STRING } } },
        consistency: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, reason: { type: Type.STRING } } },
        growthPotential: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, reason: { type: Type.STRING } } },
      },
      required: ["architecture", "codeQuality", "problemSolving", "techProficiency", "projectCompleteness", "consistency", "growthPotential"]
    },
    summary: {
      type: Type.OBJECT,
      properties: {
        jdAnalysis: { type: Type.STRING, description: "Step 1: Company wants... (Narrative)" },
        alignmentAnalysis: { type: Type.STRING, description: "Step 2: Fact check, Exaggeration, Code evidence, Stack consistency, Depth check, Fit analysis." },
        practicalTips: {
          type: Type.OBJECT,
          properties: {
            expectedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
            answerTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["expectedQuestions", "improvements", "answerTips"]
        }
      },
      required: ["jdAnalysis", "alignmentAnalysis", "practicalTips"]
    }
  },
  required: ["items", "evaluation", "summary"],
};

// 2. Feedback Schema
const feedbackSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    defenseScore: { type: Type.NUMBER },
    logicScore: { type: Type.NUMBER },
    logicReasoning: { type: Type.STRING },
    logicImprovement: { type: Type.STRING },
    honestyScore: { type: Type.NUMBER },
    honestyReasoning: { type: Type.STRING },
    honestyImprovement: { type: Type.STRING },
    solutionScore: { type: Type.NUMBER },
    solutionReasoning: { type: Type.STRING },
    solutionImprovement: { type: Type.STRING },
    feedbackSummary: { type: Type.STRING },
    positiveFeedback: { type: Type.ARRAY, items: { type: Type.STRING } },
    constructiveFeedback: { type: Type.ARRAY, items: { type: Type.STRING } },
    actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "defenseScore", 
    "logicScore", "logicReasoning", "logicImprovement",
    "honestyScore", "honestyReasoning", "honestyImprovement",
    "solutionScore", "solutionReasoning", "solutionImprovement",
    "feedbackSummary", "positiveFeedback", "constructiveFeedback", "actionItems"
  ],
};

// --- API CLIENT & UTILS ---

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing");
  return new GoogleGenAI({ apiKey });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry Logic
const callWithRetry = async <T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3, 
  baseDelay: number = 2000
): Promise<T> => {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const isRateLimit = 
        error?.status === 429 || 
        error?.code === 429 || 
        (error?.message && error.message.includes('RESOURCE_EXHAUSTED')) ||
        error?.status === 503;

      if (isRateLimit && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await wait(delay);
        continue;
      }
      break;
    }
  }
  if (lastError?.status === 429 || (lastError?.message && lastError.message.includes('RESOURCE_EXHAUSTED'))) {
    throw new Error("현재 사용자가 많아 API 요청 한도를 초과했습니다. 잠시 후(약 1분 뒤) 다시 시도해주세요.");
  }
  throw lastError;
};

// --- HELPER FOR LEVELS ---
const getLevelInstructions = (level: InterviewLevel) => {
  switch(level) {
    case 'intern': return "Level: Intern. Focus on terminology understanding, basic usage, and willingness to learn. Keep questions fundamental.";
    case 'junior': return "Level: Junior (New Grad). Verify basic CS knowledge, project roles, and actual contribution to code. Check if they understand what they copy-pasted.";
    case 'mid3': return "Level: Mid-Level (3 years). Focus on Architecture, Troubleshooting, and Operational experience. Ask 'Why this stack?' and 'How did you handle this error?'.";
    case 'mid5': return "Level: Senior/Lead (5 years+). Deep dive into Design Patterns, Bottleneck resolution, Non-reproducible bugs, and Trade-offs. Question the design intent rigorously.";
    default: return "Level: Junior.";
  }
};

// --- FUNCTIONS ---

export const analyzeCandidate = async (
  inputData: InputData,
  codeContext: string
): Promise<AnalysisResponse> => {
  const ai = getAiClient();
  const themeMode = inputData.themeMode || 'dark';

  // Tone instructions based on theme
  const toneInstruction = themeMode === 'light'
    ? "Tone: Bright, Energetic, Crisp. Be sharp but encouraging, like a supportive senior mentor."
    : "Tone: Calm, Deep, Analytical. Be serious and critical, like a strict code reviewer.";

  let candidateContent = "";
  if (inputData.docType === 'coverLetter') {
    candidateContent = "--- COVER LETTER (Q&A) ---\n" + 
      inputData.coverLetterItems.map((item, i) => `Q${i+1}: ${item.question}\nA${i+1}: ${item.answer}`).join("\n\n");
  } else {
    candidateContent = "--- RESUME/PORTFOLIO ---\n" + inputData.resumeText;
  }

  const timeLimitInstruction = inputData.timeLimitSeconds 
    ? `**TIME LIMIT MODE**: All generated questions MUST explicitly state: "이 질문은 ${inputData.timeLimitSeconds}초 안에 대답해야 합니다." at the beginning.`
    : "";
  
  const isJdUrl = inputData.jdType === 'url';
  const jdContext = isJdUrl 
    ? `[JD URL]: ${inputData.jobDescription}\n(Warning: If you cannot access this URL, assume standard requirements for a '${inputData.interviewLevel}' role. DO NOT summarize the Candidate Document as the JD.)`
    : (inputData.jdType === 'text' ? inputData.jobDescription : "Provided as image/file.");

  const promptText = `
    You are a strict Technical Lead Interviewer (FactCheck AI).
    Analyze the Candidate's Documents against the Codebase and Job Description (JD).
    
    **STRICT LANGUAGE RULE**: Output strictly in **KOREAN** (except code variable names).

    **Configuration**:
    1. **Target Level**: ${inputData.interviewLevel}
    2. **Level Instruction**: ${getLevelInstructions(inputData.interviewLevel)}
    3. **UI Mode**: ${themeMode} (${toneInstruction})
    4. ${timeLimitInstruction}

    **Context**:
    - **Company Ideal**: ${inputData.talentIdeal || "Not specified"}
    - **Job Description**: ${jdContext}
    - **Candidate Document**: ${inputData.docType}
    
    **TASK 1: Evaluate Metrics (0-100) based on the 7 Criteria Table**:
    Calculate the scores based on technical evidence found in the code.
    **IMPORTANT**: Score based on the quality and depth of the code, not just by counting false suspicions.
    1. **architecture** (아키텍처): System design, directory structure, separation of concerns.
    2. **codeQuality** (코드 품질): Clean code, variable naming, modularity, dead code presence.
    3. **problemSolving** (문제 해결력): Logic complexity, algorithm usage, handling edge cases.
    4. **techProficiency** (기술 숙련도): Depth of library/framework usage (not just boilerplate).
    5. **projectCompleteness** (완성도): Runnable state, README quality, test coverage, CI/CD.
    6. **consistency** (일치성): Does the code *actually* contain what the resume claims? (Fact Check score).
    7. **growthPotential** (성장 가능성): Use of modern practices, challenging attempts, learning evidence.

    **TASK 2: Fact Check Items (Verdicts)**:
    - Identify specific claims in the resume.
    - Assign a Verdict: [VERIFIED, EXAGGERATED, MISSING, UNCERTAIN].
    - This verdict helps visualize specific issues but the *score* should be calculated via the 'consistency' metric in Task 1.

    **TASK 3: Summary & Question Generation**:
    - **JD Analysis**: Narrative summary of company's core requirements. 
      **CRITICAL**: If the JD is missing or a URL you cannot read, DO NOT summarize the candidate's resume here. Instead state: "공고 URL 내용을 확인할 수 없어 일반적인 ${inputData.interviewLevel} 기준을 적용합니다."
    - **Alignment**: Analyze Fact-check, Exaggeration, Code evidence, Stack consistency, Depth vs Level, Job Fit.
    - **Tips**: 3 Probable Questions, 3 Weaknesses, 3 Answer Tips.
    - **Questions**: Generate pressure questions based on [Missing Evidence] or [Exaggeration].
    - **Note on UI Mode**: In the analysis summary, briefly mention the UI mode context (e.g., "현재 ${themeMode === 'light' ? '밝은' : '차분한'} 분위기에서 분석되었습니다. ${themeMode === 'light' ? '긍정적인 에너지를 보여주세요.' : '차분하게 논리를 전개하세요.'}").

    **Special Instructions for ML/Research Repositories**:
    - If the repository contains Python ML code (PyTorch, TensorFlow, sklearn), focus on:
      1. **Model Architecture**: Are classes defined properly? Is forward pass logical?
      2. **Training Loop**: Are optimizers, schedulers, and loss functions correctly implemented?
      3. **Data Processing**: Is there a Dataset/DataLoader? Are augmentations applied?
      4. **Experimentation**: Are hyperparameters (epochs, lr) visible?
      5. **External Libraries**: Is the usage of imported libraries justified?

    [Context: Job Description (Requirements)]
    ${jdContext}

    [Context: Candidate Document (Claims)]
    ${candidateContent}

    [Context: Codebase Implementation (Evidence)]
    (Note: Pay close attention to comments and documentation in the code to understand intent)
    ${codeContext}
  `;

  const parts: any[] = [{ text: promptText }];

  if (inputData.jdType === 'file' && inputData.jdFileBase64) {
    const base64Data = inputData.jdFileBase64.split(',')[1];
    parts.push({
      inlineData: { mimeType: inputData.jdFileMimeType || 'image/png', data: base64Data }
    });
    parts.push({ text: "\n(JD Image Provided above)"});
  }
  
  if (inputData.docType === 'resume' && inputData.resumeType === 'file' && inputData.resumeFileBase64) {
    const base64Data = inputData.resumeFileBase64.split(',')[1];
    parts.push({
      inlineData: { mimeType: inputData.resumeFileMimeType || 'application/pdf', data: base64Data }
    });
    parts.push({ text: "\n(Candidate Resume File Provided above)"});
  }

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.3,
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalysisResponse;
    }
    throw new Error("Failed to generate analysis");
  });
};

export const chatWithInterviewer = async (
  history: ChatMessage[], 
  item: AnalysisItem,
  level: InterviewLevel,
  timeLimit?: number,
  themeMode: 'light' | 'dark' = 'dark'
): Promise<string> => {
  const ai = getAiClient();
  const lastUserMessage = history[history.length - 1]?.text.trim();

  // **Rule: Silence / Failed Answer / Time Limit Handling**
  const silenceTriggers = ["", "모르겠습니다", "모름", "기억안남", "pass", "패스", "...", "잘 모르겠어요", "시간 초과", "(답변 시간 초과)"];
  const isSilence = !lastUserMessage || silenceTriggers.some(t => lastUserMessage.includes(t));

  if (isSilence) {
    if (timeLimit) {
      // Prompt specifically asked for an "appropriate comment" when time limit fails
      return `시간이 종료되었습니다. ${themeMode === 'light' ? '아쉽지만, 다음 질문에서 만회해봅시다!' : '실전에서는 시간 관리도 실력입니다. 집중하세요.'} 다음 질문으로 넘어가겠습니다.`;
    }
    return `괜찮습니다. ${themeMode === 'light' ? '긴장하지 말고 편하게 이야기해보세요.' : '답변이 어렵다면 솔직하게 말하고 다음으로 넘어가도 좋습니다.'} 다른 질문을 드려볼까요?`;
  }

  // Tone instructions based on theme
  const tonePrompt = themeMode === 'light'
    ? "Tone: Bright, Direct, Crisp. Be energetic. If the answer is good, praise efficiently."
    : "Tone: Calm, Analytical, Serious. Be professional. If the answer is good, acknowledge quietly.";

  const systemPrompt = `
    You are a sharp, skeptical Technical Interviewer. 
    The user is answering your question about: "${item.resumeClaim}".
    
    **Context**:
    - Topic: ${item.topic}
    - Code Reality: ${item.codeObservation}
    - Verdict: ${item.verdict}
    - **Candidate Level**: ${level}
    - **Time Limit**: ${timeLimit ? timeLimit + ' seconds' : 'None'}
    - **UI Mode & Persona**: ${tonePrompt}
    
    **Rules**:
    1. **Language**: STRICTLY **KOREAN ONLY**.
    2. **Level Adjustment**: 
       - If ${level} is 'intern/junior', be encouraging but verify basics.
       - If ${level} is 'mid3/mid5', be critical. Ask for architectural reasons and trade-offs.
    3. **Time Limit Logic**:
       - If a Time Limit (${timeLimit}s) is active and the user's answer is too long or verbose, scold them gently: "실전에서는 시간 제한이 있어요. 핵심만 요약해 대답해보세요."
    4. **Flow**:
       - If logic matches code -> "알겠습니다. 충분히 소명되었습니다. 면접을 종료하겠습니다."
       - If vague -> Press for details.
  `;

  const contents = [
    { role: 'user', parts: [{ text: systemPrompt }] },
    ...history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }))
  ];

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
    });

    return response.text || "오류가 발생했습니다.";
  });
};

export const getInterviewFeedback = async (
  history: ChatMessage[], 
  item: AnalysisItem,
  level: InterviewLevel,
  themeMode: 'light' | 'dark' = 'dark'
): Promise<InterviewFeedbackResponse> => {
  const ai = getAiClient();
  const conversationText = history.map(m => `${m.role}: ${m.text}`).join('\n');

  const prompt = `
    Analyze the interview transcript and generate a detailed Feedback Report.

    **Target Level**: ${level}
    **UI Mode**: ${themeMode}
    
    **Rules**:
    1. **Language**: Korean Only.
    2. **Scoring Rule (CRITICAL)**:
       - If the user response includes "pass", "I don't know", "...", silence, "시간 초과", or the interviewer mentioned "시간이 종료되었습니다":
         -> **STRICTLY SET ALL SCORES (Logic, Honesty, Solution) TO 0 POINTS.** (Answer was missing or invalid).
         -> In 'feedbackSummary', you MUST output exactly: "답변이 입력되지 않았거나 시간 내에 답변하지 못해 0점 처리되었습니다. ${themeMode === 'light' ? '다음엔 더 자신감 있게 도전해보세요!' : '시간 관리와 순발력 훈련이 필요합니다.'}"
    3. **Evaluation Criteria**:
       - Did they answer within the expectations of a ${level}?
       - Did they prove their contribution?
    4. **Theme Context**:
       - Add a brief comment in 'feedbackSummary' or 'actionItems' about how the user handled the pressure in ${themeMode} mode.

    **Context**:
    - Topic: ${item.topic}
    - Conversation:
    ${conversationText}
  `;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: feedbackSchema,
        temperature: 0.5,
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as InterviewFeedbackResponse;
    }
    throw new Error("Failed to generate feedback");
  });
};