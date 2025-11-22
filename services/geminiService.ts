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

// 2. Feedback Schema (REMOVED HONESTY, SCALED TO 10)
const feedbackSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    defenseScore: { type: Type.NUMBER, description: "Sum of logicScore + solutionScore. Max 10." },
    logicScore: { type: Type.NUMBER, description: "Score out of 5 (Logical Consistency)." },
    logicReasoning: { type: Type.STRING, description: "If score is 0, MUST start with '[0점 처리 사유]:'" },
    logicImprovement: { type: Type.STRING },
    solutionScore: { type: Type.NUMBER, description: "Score out of 5 (Problem Solving & Alternatives)." },
    solutionReasoning: { type: Type.STRING, description: "If score is 0, MUST start with '[0점 처리 사유]:'" },
    solutionImprovement: { type: Type.STRING },
    feedbackSummary: { type: Type.STRING },
    positiveFeedback: { type: Type.ARRAY, items: { type: Type.STRING } },
    constructiveFeedback: { type: Type.ARRAY, items: { type: Type.STRING } },
    actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "defenseScore", 
    "logicScore", "logicReasoning", "logicImprovement",
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

  // Define Persona based on theme, BUT DO NOT mention 'Light Mode' or 'Dark Mode' in content
  const personaInstruction = themeMode === 'light'
    ? "Interviewer Tone: Practical, Fast-paced, Direct."
    : "Interviewer Tone: Critical, Analytical, Deep-dive.";

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
    3. **Interviewer Tone**: ${personaInstruction}
    4. ${timeLimitInstruction}

    **Context**:
    - **Company Ideal**: ${inputData.talentIdeal || "Not specified"}
    - **Job Description**: ${jdContext}
    - **Candidate Document**: ${inputData.docType}
    
    **GLOBAL PROHIBITION (CRITICAL)**:
    - You must **NEVER** mention "Light Mode", "Dark Mode", "UI Theme", "Black Mode", "White Mode" in your output text (Summary, Alignment Analysis, Reasons, etc.). 
    - **The UI theme is only for your 'Persona/Tone' simulation (e.g., be direct vs. be deep-dive). Do NOT mention the theme itself.**
    
    **TASK 1: Evaluate Metrics (0-100) based on the 7 Criteria Table**:
    Analyze the code quality and engineering standards.
    **SCORING RULE**: 
    - Do NOT base the score solely on "Suspicion" or "Verification" status.
    - **Architecture, Code Quality, Problem Solving, Tech Proficiency, Project Completeness, Growth Potential**: These MUST be scored based on the ACTUAL CODE QUALITY provided in the context.
    - **Consistency**: This is the ONLY metric where you strictly penalize mismatches between Resume and Code.
    - **OBJECTIVITY**: A score of 80 must be 80 regardless of whether the UI is light or dark. Do not penalize for "style" differences unless they are technical anti-patterns.
    
    1. **architecture** (아키텍처): System design patterns, directory structure, separation of concerns.
    2. **codeQuality** (코드 품질): Clean code, variable naming, modularity, presence of dead code.
    3. **problemSolving** (문제 해결력): Logic complexity, algorithm usage, handling edge cases.
    4. **techProficiency** (기술 숙련도): Depth of library/framework usage (not just boilerplate).
    5. **projectCompleteness** (완성도): Runnable state, README quality, test coverage, CI/CD.
    6. **consistency** (일치성): Does the code *actually* contain what the resume claims? (Fact Check score).
    7. **growthPotential** (성장 가능성): Evidence of learning, refactoring, or modern practices.

    **TASK 2: Identify Fact-Check Items**:
    Find mismatches, exaggerations, or missing proofs between Candidate Document and Code/JD.
    - If code supports the claim -> Verdict: VERIFIED.
    - If code contradicts or is missing -> Verdict: EXAGGERATED / MISSING.
    - If code is too simple for the claim -> Verdict: EXAGGERATED.
    
    **TASK 3: Generate Summary**:
    - JD Analysis: What is the company looking for?
    - Alignment Analysis: How well does the candidate fit? Where are the lies/truths?
    - Practical Tips: Specific questions to ask and improvements.

    **INPUT CODE SNIPPETS**:
    ${codeContext.substring(0, 100000)} // Limit context size

    **INPUT CANDIDATE DOCUMENT**:
    ${candidateContent.substring(0, 20000)}
  `;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.2, // Low temp for factual analysis
      },
    });
    const text = response.text;
    return JSON.parse(text) as AnalysisResponse;
  });
};

export const chatWithInterviewer = async (
  history: ChatMessage[],
  item: AnalysisItem,
  level: InterviewLevel,
  timeLimitSeconds: number | undefined,
  themeMode: 'light' | 'dark'
): Promise<string> => {
  const ai = getAiClient();
  
  const personaInstruction = themeMode === 'light'
    ? "Your tone is direct, practical, and fast-paced."
    : "Your tone is critical, deep-diving, and slightly skeptical.";

  const timeLimitInstruction = timeLimitSeconds
    ? `IMPORTANT: The user has a ${timeLimitSeconds}s time limit per answer. If their answer is very short or feels rushed, ask them to elaborate if time permits, or penalize them if they missed the core point.`
    : "";

  const systemPrompt = `
    You are a Technical Lead Interviewer (FactCheck AI). 
    You are currently interviewing a candidate about a specific suspicion found in their resume vs code.
    
    **Topic**: ${item.topic}
    **Verdict**: ${item.verdict}
    **Code Observation**: ${item.codeObservation}
    **Level**: ${level}
    **Tone**: ${personaInstruction}
    ${timeLimitInstruction}
    
    **Goal**: Drill down into the technical details to verify if they really understand what they wrote.
    **Rules**:
    1. Keep responses short and sharp (max 2-3 sentences).
    2. Do NOT be polite. Be professional but demanding.
    3. If they give a vague answer, ask for specific function names, logic flow, or error handling details.
    4. **STRICT TURNS**: You MUST ask at least 10 questions in total before concluding. Count the user's turns. If turns < 10, KEEP ASKING technical deep-dive questions.
    5. Only after 10 questions, if satisfied or if they fail completely, say "면접을 종료하겠습니다." to end the chat.
    6. Speak in Korean.
    7. **NEVER** mention "Light Mode" or "Dark Mode" in your chat responses.
  `;

  // Wrap in Retry Logic to handle API failures during chat
  return callWithRetry(async () => {
    // We strictly use the history provided by the React state.
    // However, to avoid context limits or format issues, we sanitize and limit it.
    
    const lastUserMsg = history[history.length - 1];
    
    // Valid history for Gemini must alternate or at least be well-formed.
    // We take previous messages (excluding the current user message we want to send).
    let previousMessages = history.slice(0, -1);

    // Context Window Optimization: Keep last 20 messages (approx 10 turns)
    if (previousMessages.length > 20) {
      previousMessages = previousMessages.slice(-20);
    }

    const formattedHistory = previousMessages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { 
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
      history: formattedHistory
    });

    // Fix: sendMessage expects an object in newer SDKs to properly match signatures
    const result = await chatSession.sendMessage({ message: lastUserMsg.text });
    return result.text;
  });
};

export const getInterviewFeedback = async (
  history: ChatMessage[],
  item: AnalysisItem,
  level: InterviewLevel,
  themeMode: 'light' | 'dark'
): Promise<InterviewFeedbackResponse> => {
  const ai = getAiClient();
  
  const prompt = `
    Analyze the following technical interview transcript.
    The interviewer (AI) questioned the candidate about: "${item.topic}".
    The suspicion was: ${item.codeObservation}.
    Target Level: ${level}.

    **CRITICAL SCORING ALIGNMENT RULE**:
    - The numerical score **MUST** strictly reflect the sentiment of your "Reasoning" and "Improvement" text.
    - If you write "The candidate explained the core concept perfectly", the Logic Score **MUST** be 5.0.
    - If you write "The explanation was vague and missed the key point", the Logic Score **MUST** be below 3.0.
    - **Prohibited**: Do NOT give a high score (4-5) if you listed critical "Action Items" implying they don't know the basics.
    - **Prohibited**: Do NOT give a low score (1-2) if your feedback text says "Good answer".

    **SCORING CRITERIA (Total 10 Points)**:
    1. **Logic Score (5 Points)**: 
       - Did the candidate explain the "Why" and "How" logically? 
       - Did they use correct terminology?
       - If they provided good technical reasoning, give HIGH score (4.0-5.0).
       - If they were vague or dodged the question, give LOW score.
       - **ZERO SCORE RULE**: If the candidate answered "모르겠습니다" (I don't know), gave an empty answer, or provided a completely irrelevant/nonsense response (무답변, 이해 불가) without attempting to guess or deduce, set score to 0. 

    2. **Solution Score (5 Points)**:
       - Did they provide a concrete solution or alternative?
       - Even if they didn't know the exact answer, did they propose a workaround?
       - **ZERO SCORE RULE**: If they just gave up without offering a solution, or the answer was "I don't know" / empty / nonsense, set score to 0.
       - **CALIBRATION**: If they solved the problem, score MUST be above 4.5/5.

    **TOTAL SCORE**: Logic (5) + Solution (5) = 10.
    
    **OUTPUT RULES**:
    - Provide the sum as 'defenseScore' (max 10).
    - If any score is 0, start the 'Reasoning' text with "[0점 처리 사유]:".
    - 'positiveFeedback': 3 things they did well.
    - 'constructiveFeedback': 3 things to improve.
    - 'actionItems': 3 concrete technical tasks to study (e.g., "Study Redis AOF persistence").
    - **Language**: Korean.

    **TRANSCRIPT**:
    ${history.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n')}
  `;

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: feedbackSchema,
      },
    });
    return JSON.parse(response.text) as InterviewFeedbackResponse;
  });
};
