
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
      description: "Score the candidate based on 7 distinct technical criteria (0-100). Do NOT base scores solely on the 'Consistency' metric.",
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
    defenseScore: { type: Type.NUMBER, description: "Sum of logicScore + solutionScore. Max 10." },
    logicScore: { type: Type.NUMBER, description: "Score out of 5 (Logical Consistency)." },
    logicReasoning: { type: Type.STRING, description: "Summary of logical performance. MUST mention both good answers and 0-point answers." },
    logicImprovement: { type: Type.STRING },
    solutionScore: { type: Type.NUMBER, description: "Score out of 5 (Problem Solving & Alternatives)." },
    solutionReasoning: { type: Type.STRING, description: "Summary of solution quality." },
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

  // Define Persona (Neutral, strictly technical)
  const personaInstruction = "Interviewer Tone: Analytical, Objective, and Fact-Based. You are a code auditor.";

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
    - You must **NEVER** mention "Light Mode", "Dark Mode", "UI Theme" in your output text.
    - Your analysis must be purely technical.
    
    **TASK 1: Evaluate Metrics (0-100) based on the 7 Criteria Table**:
    Analyze the code quality and engineering standards.
    
    **SCORING RULES (CRITICAL)**:
    - **Architecture, Code Quality, Problem Solving, Tech Proficiency, Project Completeness, Growth Potential**: 
      Score these based on the **ACTUAL CODE QUALITY** in the context. 
      *Example: Even if the candidate lied about using Kafka, if their Java code structure is excellent, 'Code Quality' should be High (80+).*
    - **Consistency**: 
      This is the **ONLY** metric where you penalize mismatches/lies between Resume and Code. 
      *Example: If they lied about Kafka, 'Consistency' is Low (20), but 'Code Quality' stays High (80).*
    - **Objectivity**: Do not let the 'Consistency' score drag down other technical scores unless the code itself is bad.
    
    1. **architecture**: System design, directory structure, separation of concerns.
    2. **codeQuality**: Clean code, naming, modularity, readability.
    3. **problemSolving**: Logic complexity, algorithm usage, edge case handling.
    4. **techProficiency**: Depth of usage (not just boilerplate), library knowledge.
    5. **projectCompleteness**: Runnable state, tests, README, CI/CD, documentation.
    6. **consistency**: Fact Check Score. Does the code prove the resume claims?
    7. **growthPotential**: Evidence of modern practices, refactoring, learning.

    **TASK 2: Identify Fact-Check Items**:
    Find mismatches, exaggerations, or missing proofs.
    - Verdict: VERIFIED, EXAGGERATED, MISSING, UNCERTAIN.
    
    **TASK 3: Generate Summary**:
    - JD Analysis, Alignment Analysis, Practical Tips.

    **INPUT CODE SNIPPETS**:
    ${codeContext.substring(0, 100000)}

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
        temperature: 0.2,
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
  timeLimitSeconds: number | undefined
  // Removed themeMode to prevent hallucination
): Promise<string> => {
  const ai = getAiClient();
  
  const personaInstruction = "Your tone is critical, deep-diving, and professional. Focus only on the technical validation.";

  const timeLimitInstruction = timeLimitSeconds
    ? `IMPORTANT: The user has a ${timeLimitSeconds}s time limit. If they answer too briefly or vaguely, press them for details.`
    : "";

  const internInstruction = level === 'intern' 
    ? `**INTERN SPECIAL RULE**: If the candidate answers "모르겠습니다" (I don't know), "..." or gives a very weak/empty answer:
       - **Be Encouraging**: respond kindly (e.g., "괜찮습니다. 처음엔 어려울 수 있습니다.").
       - **Provide a Hint**: Give a technical clue or ask a simpler related question to guide them.
       - Do NOT be aggressive or fail them immediately.`
    : ``;

  const systemPrompt = `
    You are a Technical Lead Interviewer (FactCheck AI). 
    Topic: ${item.topic}
    Verdict: ${item.verdict}
    Code Observation: ${item.codeObservation}
    Level: ${level}
    Tone: ${personaInstruction}
    ${timeLimitInstruction}
    ${internInstruction}
    
    **Goal**: Verify technical depth.
    **Rules**:
    1. Keep responses short and sharp (max 2-3 sentences).
    2. Ask specific technical questions (function names, logic, error handling).
    3. **STRICT TURNS**: Ask at least 10 questions.
    4. Only after 10 questions, say "면접을 종료하겠습니다.".
    5. Speak in Korean.
    6. **NEVER** mention "Light Mode" or "Dark Mode".
  `;

  return callWithRetry(async () => {
    const lastUserMsg = history[history.length - 1];
    let previousMessages = history.slice(0, -1);

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

    const result = await chatSession.sendMessage({ message: lastUserMsg.text });
    return result.text;
  });
};

export const getInterviewFeedback = async (
  history: ChatMessage[],
  item: AnalysisItem,
  level: InterviewLevel
  // Removed themeMode
): Promise<InterviewFeedbackResponse> => {
  const ai = getAiClient();
  
  const prompt = `
    Analyze the following technical interview transcript.
    Topic: "${item.topic}".
    Target Level: ${level}.

    **SCORING RULES (CRITICAL)**:
    1. **Evaluate the ENTIRE conversation**:
       - Do NOT judge the candidate solely on the *last* answer.
       - If they answered Questions 1-9 well but failed Question 10, the score should reflect the 9 good answers (e.g., 4.0/5.0), NOT 0.
    
    2. **ZERO SCORE CONDITION**:
       - IF a specific answer is "I don't know" (모르겠습니다), "No answer" (무답변), or "Nonsense" (이해 불가) WITHOUT any attempt to deduce:
         -> **That specific turn counts as 0 points.**
       - **However**, previous valid answers must still be credited.
    
    3. **Logic Reasoning Output**:
       - You MUST explicitly mention which parts were good and which were 0-points.
       - Format: "You explained [Concept A] well, but for [Question B], you failed to answer (0 points applied)."
       - If the *entire* interview was nonsense, then give 0 total.

    **SCORING CRITERIA (Total 10 Points)**:
    - **Logic Score (5)**: Consistency, terminology, reasoning depth.
    - **Solution Score (5)**: Problem solving, alternatives, concrete examples.

    **OUTPUT RULES**:
    - 'defenseScore': sum of logic + solution.
    - If there was a 0-point answer, start 'logicReasoning' with "[0점 처리 사유 포함]:" (Included 0-point reason).
    - Provide 3 positive, 3 constructive, 3 action items.
    - Language: Korean.

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
