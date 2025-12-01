# ⭐ FactCheck AI

> 자소서나 이력서의 주장, GitHub 코드, 채용공고(JD)를 AI가 교차 분석하여  
> 지원자의 기술 신뢰도·일관성·실제 실력을 검증하고  
> 개인 맞춤형 압박 면접 시뮬레이션을 제공하는 서비스입니다.

![MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react)
![Gemini](https://img.shields.io/badge/Google%20Gemini-2.5%20Flash-8E75B2?logo=google)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)

📝 [발표자료 ↗](https://github.com/saa-hackathon-2025/factcheck/blob/main/4%E1%84%90%E1%85%B5%E1%86%B7%20%E1%84%87%E1%85%A1%E1%86%AF%E1%84%91%E1%85%AD%E1%84%8C%E1%85%A1%E1%84%85%E1%85%AD.pdf)

📸 [Demo Video ↗](https://www.youtube.com/watch?v=lmKNzcXLfa8)

<br>

# 🚀 How to Use

## Step 1. Input (원클릭 면접 준비)

<div align="center">
  <br>
  <img src="https://github.com/user-attachments/assets/d6c7bc45-116e-46c7-99f2-ef3d6fba15f7" alt="Step1 4x" width="65%">
  <br><br>
</div>

- 환경 설정

   - Intern~Senior 레벨
   - 타이머 설정

- 채용공고(JD) 입력 : 텍스트 / URL / 이미지 / PDF

- 지원자 서류 입력 : Resume / Cover Letter (텍스트·PDF·Notion)

- GitHub Repository 입력

   - 복수 Repo 지원
   - Private Repo → Token 사용 가능

## Step 2. Analysis (진위 판독 및 질문 도출)

<div align="center">
  <br>
  <img src="https://github.com/user-attachments/assets/9fe384be-02eb-4c9b-b95e-49f90cbd5992" alt="Step2 4x" width="65%">
  <br><br>
</div>

   - 7대 기술 지표 산출
   - 취약점 기반 면접 질문 출력

## Step 3. Action (실전 디펜스 & 피드백)

<div align="center">
  <br>
  <img src="https://github.com/user-attachments/assets/e563090b-d490-4035-a9d5-7219919def80" alt="Step3-1 60x" width="65%">
  <br><br>
</div>

- AI 압박 면접 진행

   - 실시간 타이머
   - 꼬리 질문

<div align="center">
  <br>
  <img src="https://github.com/user-attachments/assets/cba13198-6432-4fed-a303-1454d97e5627" alt="Step3-2 6x" width="65%">
  <br><br>
</div>

- 최종 리포트 확인

   - Logic Score(5점)
   - Solution Score(5점)
   - Total 10점 평가
   - 개선 Action Items 제공
     
# ✨ Features

### 🔍 3-Way Cross Verification
세 요소를 증거 기반으로 교차 검증합니다.
- Resume / Cover Letter (Text, PDF, Notion URL)
- GitHub Repository (Multiple Repos supported)
- Job Description (URL · 텍스트 · 이미지 · PDF)  

### 📊 7-Factor AI Evaluation
구현된 7가지 핵심 기술 지표를 기준으로 정밀 분석합니다.
- Architecture  
- Code Quality  
- Problem Solving  
- Tech Proficiency  
- Project Completeness  
- Consistency  
- Growth Potential  

### 🧩 Deep Code Analysis
- 디렉토리 구조 및 핵심 로직 파일 자동 선별  
- ML/Python, Java/Spring, TS/React 등 주요 스택 자동 인식  
- README, package.json, requirements.txt 기반 기술 스택 분석  

### 📄 Multimodal JD Parsing
- 텍스트 / 이미지(JPG, PNG) / PDF / URL  
- OCR 기반 텍스트 추출 및 JD 재구성  

### 💬 AI 압박 면접 (Live Interview Mode)
- Intern ~ Senior 레벨 질문  
- 꼬리 질문 / 추궁 질문  
- 답변 회피 감지  
- Time Limit Mode 지원  

### 🌓 Dark / Light Mode
- 화면 우측 하단 플로팅 버튼  
- LocalStorage 기반 테마 저장  
- 전체 페이지 실시간 업데이트  

# 💡 Detailed Features

### 1. 7-Factor Technical Scoring

- Architecture: 설계 패턴 및 구조
- Code Quality: 모듈화·네이밍·테스트
- Problem Solving: 예외 처리/알고리즘
- Consistency: 자소서 vs 코드 일치도
- Growth Potential: 리팩토링 흔적 등

### 2. Intelligent Interview Feedback

- Logic Score (5점)
- Solution Score (5점)
- Zero Score Penalty 적용

### 3. Adaptive Persona Interview

- 레벨별 질문 깊이 변화
- 설계 의도/트레이드오프 집요하게 검증
- Intern 모드에서는 힌트 제공

# 🏗️ Architecture

```mermaid
graph TD
    A[User Input] -->|Resume & JD| B(React Client)
    A -->|GitHub URL| B
    B -->|Tree & Blob Fetch| C[GitHub REST API]
    B -->|Multimodal Request| D[Google Gemini 2.5 Flash]
    C -->|Raw Code| B
    B -->|Context Assembly| D
    D -->|Analysis JSON Result| B
    B -->|AI Chat| E[Pressure Interview Module]
````

# 🛠️ Tech Stack

| Category         | Technologies                  |
| ---------------- | ----------------------------- |
| Frontend         | React 19, TypeScript, Vite    |
| Styling          | Tailwind CSS, Heroicons       |
| AI / LLM         | Google Gemini 2.5 Flash       |
| Data Fetching    | GitHub REST API               |
| Parsing          | PDF/Image → Base64 Multimodal |
| State Management | React Context API             |
| Architecture     | Client-Side SPA               |

# 📂 Project Structure

```bash
factcheck-ai/
├── public/
├── src/
│   ├── components/
│   │   ├── AnalysisResult.tsx
│   │   ├── Header.tsx
│   │   ├── InputForm.tsx
│   │   ├── InterviewChat.tsx
│   │   ├── InterviewFeedback.tsx
│   │   ├── FloatingThemeToggle.tsx
│   ├── context/
│   │   └── ThemeContext.tsx
│   ├── services/
│   │   ├── geminiService.ts
│   │   └── githubService.ts
│   ├── App.tsx
│   ├── index.tsx
│   └── types.ts
├── index.html
├── metadata.json
├── package.json
└── vite.config.ts
```
