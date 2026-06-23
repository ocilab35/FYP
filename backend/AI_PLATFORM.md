# AI-Powered Healthcare Platform

Virtual Hospital Management System (VHMS) integrates **Qwen LLM** for clinical AI features while preserving all existing APIs, authentication, appointments, prescriptions, medical records, blockchain verification, and dashboards.

## Environment Configuration

Add to `backend/.env` (never commit real API keys):

```env
QWEN_API_KEY=your-dashscope-api-key
QWEN_MODEL=qwen-plus
QWEN_VISION_MODEL=qwen-vl-plus
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
AI_ENABLED=true
```

Keys are loaded via `app/core/config.py` (`Settings`). The frontend never receives API keys — all AI calls go through FastAPI.

When `QWEN_API_KEY` is empty or `AI_ENABLED=false`, services fall back to rule-based responses so the app remains functional.

## Architecture

```
backend/app/
├── ai/
│   ├── qwen_client.py      # Async OpenAI-compatible Qwen client (httpx)
│   ├── json_utils.py       # JSON extraction from LLM output
│   └── prompts/system.py   # Safety rules + medical disclaimer
├── services/
│   ├── patient_context_service.py       # Demographics, meds, records, history
│   ├── ai_doctor_chat_service.py        # Conversational clinical questioning
│   ├── health_risk_service.py             # 0–100 risk scoring
│   ├── drug_interaction_service.py        # Interactions, duplicates, allergies
│   ├── medical_report_ai_service.py       # Report summarization
│   ├── consultation_ai_summary_service.py # Post-consultation auto-summary
│   ├── prescription_qwen_service.py       # OCR text → structured medicines
│   └── medication_extraction_service.py   # OCR + Qwen pipeline
└── api/routes/
    ├── ai_doctor.py    # Chat, health-risk, insights, medication-alerts
    └── patients.py     # Report summarize, medication interactions
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/ai-doctor/chat` | POST | Conversational AI Doctor (clinical questioning) |
| `/api/v1/ai-doctor/consult` | POST | Legacy one-shot symptom analysis |
| `/api/v1/ai-doctor/history` | GET | Past AI sessions |
| `/api/v1/ai-doctor/sessions/{id}` | GET | Load session conversation |
| `/api/v1/ai-doctor/health-risk` | GET | Health risk score 0–100 |
| `/api/v1/ai-doctor/medication-alerts` | GET | Drug interaction alerts |
| `/api/v1/ai-doctor/insights` | GET | Combined dashboard insights |
| `/api/v1/patients/medical-records/{id}/summarize` | POST | Patient-friendly report summary |
| `/api/v1/patients/medications/interactions` | GET | Medication interaction check |
| `/api/v1/patients/medications/extract-from-prescription` | POST | OCR + Qwen prescription parsing |

## Features

### AI Doctor (Conversational)
- Asks follow-up questions before assessment (onset, severity, fever, medications, etc.)
- Uses full patient context (age, allergies, chronic conditions, meds, records)
- Emergency keyword detection (chest pain, difficulty breathing, loss of consciousness)
- Specialist recommendations with links to doctor search

### Health Risk Engine
- Score 0–100 with category (Low / Medium / High)
- Factors: diseases, medications, history, age, symptoms
- Dashboard widget on patient home

### Prescription Reader
- Multi-pass OCR → Qwen text analysis → structured medicines
- Confidence scores; manual correction in review dialog

### Medical Report Summarization
- Patient-friendly language for MRI, CT, X-Ray, blood/lab reports
- Key findings, concerns, follow-up recommendations
- Cached in `medical_records.metadata_json.ai_summary`

### Drug Interaction Detection
- Current meds + allergies + chronic conditions
- Alerts in Medications module, AI Doctor context, dashboard

### Consultation Auto-Summary
- Generated on session completion
- Stored in `consultation_notes.draft_json.ai_summary`
- Shown on patient consultation summary page

## Safety

- AI never claims to be a licensed doctor
- Disclaimer on every AI response
- Emergency symptoms trigger immediate ER guidance
- All outputs are informational only

## Frontend Components

```
frontend/src/components/ai/
├── chat-message.tsx           # Chat bubbles
├── typing-indicator.tsx       # AI thinking animation
├── medical-context-card.tsx   # Patient profile context
├── health-risk-widget.tsx     # Risk score widget
├── medication-alerts-widget.tsx
└── ai-insights-panel.tsx      # Dashboard insights
```

## Testing Strategy

1. **Without API key**: Verify fallback responses on `/ai-doctor/chat`, health risk, interactions
2. **With API key**: Test conversational flow, report summarize, prescription extract
3. **Emergency**: Send "chest pain" — expect emergency redirect message
4. **Consultation**: Complete a telemedicine session — verify `ai_summary` in summary page
5. **Regression**: Login, appointments, prescriptions, blockchain badges unchanged

## Running Locally

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev
```

Set `QWEN_API_KEY` in `backend/.env` for full AI capabilities.
