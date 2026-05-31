# ReflectDev — AI Chat Evaluator for VS Code

> **Know Your AI. Know Yourself.** A developer intelligence mirror that reveals your knowledge gaps, prompt habits, and token efficiency — entirely on your own device.

[![VS Code](https://img.shields.io/badge/VS_Code-1.90%2B-007ACC?logo=visualstudiocode)](https://code.visualstudio.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-22C55E)](LICENSE)
[![Prototype](https://img.shields.io/badge/Status-v1.0_Prototype-F59E0B)](DEPLOYMENT.md)
[![Zero Cloud Costs](https://img.shields.io/badge/Cloud_Cost-$0-22C55E)](DEPLOYMENT.md)

---

## 🏷️ Project Name

**ReflectDev** (keep this name — it's final)

The name works on two levels:
- **"Dev"** = developer, the user we serve
- **"Reflect"** = reflect on how you develop. Calm, thoughtful positioning, good for the student angle

The metaphor is perfect: ReflectDev is the mirror a developer looks into to see their AI-assisted development clearly, spotting blind spots and growth patterns they would otherwise never notice. It's also short, clean, and domain-name-friendly (`ReflectDev.io`, `ReflectDev.ai`).

---

## 🚀 The Opportunity (For Investors)

Every developer using AI tools today is flying blind. They know AI makes them faster, but they have no idea:
- Whether they're getting dumber or smarter as a result
- How much money they waste on bad prompts and over-contexted questions
- Which topics they actually understand vs. which ones they just copy-paste through

**ReflectDev is the fitness tracker for AI-assisted development.** Just as Fitbit made people aware of how little they walked, ReflectDev makes developers aware of how shallow their AI interactions really are — and gives them a roadmap to improve.

**Target market:** 28 million developers who use AI coding tools daily, growing 40% YoY. No comparable tool exists.

**Business model:** Free VS Code extension → Student/Developer Pro subscription ($8/month) → Team Dashboard (enterprise) → Integration partnerships with AI providers.

---

## What is ReflectDev?

ReflectDev is a VS Code extension that sits silently in the background and captures your AI-assisted coding sessions — whether you are chatting in VS Code's built-in chat panel, running `claude`, `codex`, or `gemini` from the terminal, or importing your chat history manually.

It then runs the **Developer ROI Evaluation Framework** locally on your device, scoring you across four dimensions:

- **Domain knowledge depth** — how deeply you actually understand what you're asking about
- **Prompt quality** — are you giving AI enough context to give you good answers?
- **Token efficiency** — are you wasting money on vague, over-long, or repetitive prompts?
- **Learning velocity** — are you growing as a developer, or staying in place?

The results appear in a sidebar dashboard inside VS Code. **No data ever leaves your machine unless you explicitly enable cloud sync (opt-in, disabled by default).**

---

## 🎯 v1.0 Prototype Scope (What We're Building Now)

This prototype is designed to run for **one week** as a live investor demo, costing **$0 in cloud infrastructure** (everything runs locally in your VS Code).

| Feature | Status in v1 |
|---------|-------------|
| Manual chat import (Claude export / OpenAI export) | ✅ MVP |
| Local scoring engine (knowledge + prompt + tokens) | ✅ MVP |
| VS Code Dashboard WebView | ✅ MVP |
| Sidebar TreeView with live scores | ✅ MVP |
| Recommendations engine (rule-based) | ✅ MVP |
| Student report card export | ✅ MVP |
| Claude CLI auto-detection | ⚠️ Stretch goal |
| VS Code Chat Participant hook | ⚠️ Stretch goal |
| Cloud sync / Azure backend | ❌ v2 only |
| Team dashboard | ❌ v3 only |

**The prototype proves the core value proposition: import a chat file → see an insightful score → get actionable recommendations.** Everything else is a growth feature.

---

## Why ReflectDev?

| Without ReflectDev | With ReflectDev |
|----------------|-------------|
| No idea how much AI costs per session | Real-time token cost per session and per day |
| Can't tell if prompting is improving | Prompt quality score tracked over time |
| Repeat the same mistakes with AI | Mistake-repeat index flags recurring patterns |
| No idea what your actual knowledge level is | Per-technology competency scores from your own chats |
| Waste tokens on vague questions | Specific, actionable recommendations after every session |

---

## Core Features (v1 Prototype)

### 1. Manual Chat Import
Upload a JSON export from Claude.ai, ChatGPT, or any ReflectDev-format file. ReflectDev parses the conversation history and immediately scores it. No CLI tools or API keys required.

### 2. Local Scoring Engine
All analysis runs on your machine — no API calls, no cloud, no subscriptions needed:
- Token counting via `tiktoken` (same tokenizer as OpenAI/Anthropic models)
- NLP analysis via `compromise` and `natural` (lightweight, no internet)
- Knowledge depth scoring: novice → expert
- Prompt quality signals: specificity, context efficiency, retry rate
- Estimated cost in USD (down to $0.0001 precision)

### 3. Developer Intelligence Dashboard
A WebView panel opened with `Ctrl+Shift+P → ReflectDev: Open Dashboard`:
- **Overall score ring** (0–100) with animated fill
- **4 score cards**: Knowledge, Prompt Quality, Token Efficiency, Learning Velocity
- **Technology radar chart**: your competency across detected tech stacks
- **Score timeline**: 30-day trend line
- **Token cost breakdown**: where your money actually goes
- **Recommendations panel**: ranked, actionable, with one-click actions

### 4. Sidebar Score Panel
Real-time score visible in the VS Code Activity Bar:
- Today's score at a glance
- Active session status and running token cost
- Top 3 recommendations
- Recent session history

### 5. Smart Recommendations Engine
After every session, ReflectDev generates personalized recommendations:
- Which prompt habits to fix (before/after examples included)
- Which topics to study based on knowledge gaps you revealed in chat
- Which model tier to use for which tasks (real money savings)
- Learning resources matched to your exact weak spots

### 6. Student Mode
For students sharing chat history for self-evaluation:
- Competency Level display (encouraging, non-judgmental framing)
- Shareable report card (PDF export)
- Before/after comparison across sessions
- Works as a standalone import tool — no other AI tool required

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Your Machine (VS Code Extension Host — Node.js)                │
│                                                                 │
│  ┌──────────────────────┐   ┌──────────────────────────────┐   │
│  │  Chat Import Handler  │   │  CLI Extractor (future v1.1) │   │
│  │  (JSON file picker)   │   │  · Claude CLI file watcher   │   │
│  └──────────┬────────────┘   │  · Terminal output capture   │   │
│             │                └──────────────┬───────────────┘   │
│             └───────────────┬───────────────┘                   │
│                             ▼                                   │
│              ┌──────────────────────────┐                       │
│              │   Session Normalizer      │ → ChatSession[]       │
│              └─────────────┬────────────┘                       │
│                            ▼                                    │
│              ┌──────────────────────────┐                       │
│              │   Local Scoring Engine    │                       │
│              │   · KnowledgeScorer      │                       │
│              │   · PromptAnalyzer       │                       │
│              │   · TokenCounter         │                       │
│              │   · RecommendationEngine │                       │
│              └─────────────┬────────────┘                       │
│                            ▼                                    │
│              ┌──────────────────────────┐                       │
│              │   VS Code State Store     │ → globalState (local) │
│              └─────────────┬────────────┘                       │
│                            │                                    │
│          ┌─────────────────┼──────────────────┐                │
│          ▼                 ▼                   ▼                │
│   ┌────────────┐   ┌──────────────┐   ┌───────────────┐        │
│   │  Dashboard │   │   Sidebar    │   │  Report Card  │        │
│   │  WebView   │   │  TreeView    │   │  PDF Export   │        │
│   └────────────┘   └──────────────┘   └───────────────┘        │
│                                                                 │
│  [FUTURE — opt-in, disabled in v1] ─────────────────────────── │
│  Azure Static Web Apps (shareable report links — free tier)     │
└─────────────────────────────────────────────────────────────────┘
```

**v1 Prototype: 100% local. Zero cloud. Zero cost.**

---

## Getting Started

### Prerequisites
- VS Code 1.90 or later
- Node.js 20.x or later ([download here](https://nodejs.org))
- npm 10.x (comes with Node.js)

### Install from Source (Development)
```bash
git clone https://github.com/your-username/ReflectDev-vscode
cd ReflectDev-vscode
npm install
npm run compile
```
Press **F5** in VS Code to launch the Extension Development Host.

### First Run
1. Open any project in VS Code
2. Press `Ctrl+Shift+P` → type `ReflectDev: Import Chat History`
3. Select your exported chat JSON file (Claude.ai → Settings → Export Data)
4. Watch the sidebar update with your competency score
5. Press `Ctrl+Shift+P` → `ReflectDev: Open Dashboard` to see your full report

---

## Cost Architecture (Why This Is $0)

ReflectDev is built specifically to run within the constraints of a student Azure subscription:

| What we use | Cost |
|------------|------|
| VS Code Extension API | $0 — it's free |
| Node.js scoring engine | $0 — runs locally |
| `tiktoken`, `compromise`, `natural` npm packages | $0 — open source |
| VS Code `globalState` for data storage | $0 — built into VS Code |
| GitHub repo + Actions (Student Pack) | $0 — free |
| **Total for the prototype** | **$0** |

Cloud services (Azure) are only added in v2 when the product has users and the Azure student credit can be justified. See `DEPLOYMENT.md` for the phased plan.

---

## Supported AI Tools

| Tool | v1 Support | How |
|------|-----------|-----|
| Claude.ai (export) | ✅ | Manual JSON import |
| ChatGPT (export) | ✅ | Manual JSON import |
| Claude CLI (`claude`) | ⚠️ Stretch | FS watcher on `~/.claude/` |
| VS Code Chat (built-in) | ⚠️ Stretch | Chat Participant API |
| Any tool | ✅ | Paste conversation text |

---

## Configuration

All settings under `ReflectDev` namespace in VS Code settings:

```json
{
  "ReflectDev.enabled": true,
  "ReflectDev.sources.claudeCLI": true,
  "ReflectDev.sources.terminalWatch": false,
  "ReflectDev.scoring.mode": "student",
  "ReflectDev.scoring.domain": "cloud-devops",
  "ReflectDev.privacy.cloudSync": false,
  "ReflectDev.ui.showStatusBar": true,
  "ReflectDev.notifications.postSessionReport": true
}
```

---

## Project Structure

```
ReflectDev-vscode/
├── src/
│   ├── extension.ts                # Entry point
│   ├── extractors/
│   │   ├── importHandler.ts        # Manual JSON import (v1 primary)
│   │   ├── cliExtractor.ts         # Claude/Codex/Gemini CLI (v1.1)
│   │   └── terminalWatcher.ts      # Terminal capture (v1.1)
│   ├── evaluators/
│   │   ├── knowledgeScorer.ts      # Knowledge depth scoring
│   │   ├── promptAnalyzer.ts       # Prompt quality metrics
│   │   ├── tokenCounter.ts         # tiktoken-based counter
│   │   ├── recommendationEngine.ts # Actionable recommendations
│   │   └── velocityTracker.ts      # Learning growth curves
│   ├── views/
│   │   ├── dashboardPanel.ts       # WebView dashboard
│   │   ├── sidebarProvider.ts      # Activity bar TreeView
│   │   └── webview/
│   │       ├── dashboard.html
│   │       ├── dashboard.css
│   │       └── dashboard.js
│   ├── models/
│   │   ├── session.ts              # ChatSession type
│   │   ├── score.ts                # Score + competency types
│   │   └── recommendation.ts       # Recommendation type
│   ├── store/
│   │   └── sessionStore.ts         # globalState wrapper
│   └── utils/
│       ├── nlpHelper.ts            # NLP library wrappers
│       └── logger.ts               # Output channel logger
├── package.json                    # Extension manifest
├── tsconfig.json
├── webpack.config.js
├── README.md                       ← this file
├── PROMPT_SRS.md                   # Build spec + vibe coding workflow
├── DEPLOYMENT.md                   # Deployment guide (beginner-friendly)
└── DEV_GUIDE.md                    # Developer guide with code snippets
```

---

## Scoring Framework

ReflectDev implements the **Developer ROI Evaluation Framework**:

| Dimension | What it measures | Weight |
|-----------|-----------------|--------|
| Conceptual depth | Do questions show system-level thinking? | 30% |
| Problem-solving approach | Hypothesis → test → revise? | 30% |
| Independence index | How much code is original vs. AI? | 20% |
| Domain knowledge | Framework/pattern awareness | 20% |

---

## Privacy

- All processing happens locally by default — no network calls during scoring
- No telemetry collected without explicit opt-in
- Cloud sync is opt-in, disabled by default, and anonymizes all content before upload
- Session data stored in VS Code's encrypted `globalState`
- Delete all stored data: `Ctrl+Shift+P → ReflectDev: Clear All Data`

---

## 🗺️ Product Roadmap

### Now — v1.0 Prototype (Current Sprint)
- Manual chat import (Claude + OpenAI export formats)
- Local scoring engine (knowledge, prompts, tokens)
- Dashboard WebView with charts
- Sidebar score panel
- Recommendations engine
- Student report card PDF export

### Next — v1.1 Auto-Capture (Month 2)
- Claude CLI auto-detection (`~/.claude/projects/` watcher)
- Gemini CLI auto-detection
- VS Code Chat Participant (`@ReflectDev` hook)
- Terminal output capture
- Azure Static Web Apps: shareable report link (free tier)

### Later — v2.0 SaaS MVP (Month 3–6, post-seed funding)
- Team comparison dashboard
- GitHub PR correlation
- Azure cloud sync with anonymized analytics
- Web app (no VS Code required — pure upload tool)
- Stripe subscription (Student Pro $8/month, Team $25/user/month)

### Future — v3.0 Enterprise (Month 6+)
- Jira/Linear ticket attribution
- Code quality correlation (does AI usage affect PR review time?)
- Manager view: team-level prompt ROI
- SSO, audit logs, compliance export
- White-labeling for bootcamps and universities
- AI coaching suggestions (personalized, not generic)

---

## Documentation

| File | Purpose |
|------|---------|
| [README.md](README.md) | Project overview — you are here |
| [PROMPT_SRS.md](PROMPT_SRS.md) | Build spec, vibe coding workflow, UI design prompt |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Step-by-step deployment (beginner-friendly, $0 prototype) |
| [DEV_GUIDE.md](DEV_GUIDE.md) | Code snippets, VS Code API guide, debugging tips |

---

## License

MIT © 2026 — See [LICENSE](LICENSE) for details.
