"""Rule-based AI Doctor symptom analysis engine."""

from app.core.enums import RiskLevel

SYMPTOM_DATABASE: dict[str, dict] = {
    "fever": {
        "conditions": [
            {"name": "Viral Infection", "probability": 0.45},
            {"name": "Bacterial Infection", "probability": 0.25},
            {"name": "Flu (Influenza)", "probability": 0.20},
        ],
        "specialists": ["General Physician", "Internal Medicine"],
        "recommendations": [
            "Rest and stay hydrated",
            "Monitor temperature every 4 hours",
            "Take paracetamol if fever exceeds 38.5°C",
        ],
        "risk_weight": 1,
    },
    "headache": {
        "conditions": [
            {"name": "Tension Headache", "probability": 0.50},
            {"name": "Migraine", "probability": 0.25},
            {"name": "Sinusitis", "probability": 0.15},
        ],
        "specialists": ["Neurologist", "General Physician"],
        "recommendations": [
            "Rest in a quiet, dark room",
            "Stay hydrated",
            "Avoid screen time",
        ],
        "risk_weight": 1,
    },
    "chest pain": {
        "conditions": [
            {"name": "Angina", "probability": 0.30},
            {"name": "Acid Reflux", "probability": 0.25},
            {"name": "Musculoskeletal Pain", "probability": 0.20},
        ],
        "specialists": ["Cardiologist", "Emergency Medicine"],
        "recommendations": [
            "Seek immediate medical attention if pain is severe",
            "Avoid physical exertion",
            "Do not ignore persistent chest pain",
        ],
        "risk_weight": 4,
    },
    "cough": {
        "conditions": [
            {"name": "Upper Respiratory Infection", "probability": 0.40},
            {"name": "Allergic Rhinitis", "probability": 0.25},
            {"name": "Bronchitis", "probability": 0.20},
        ],
        "specialists": ["Pulmonologist", "General Physician"],
        "recommendations": [
            "Use warm fluids and honey",
            "Avoid cold air exposure",
            "Consult if cough persists beyond 2 weeks",
        ],
        "risk_weight": 1,
    },
    "shortness of breath": {
        "conditions": [
            {"name": "Asthma", "probability": 0.30},
            {"name": "Anxiety", "probability": 0.25},
            {"name": "Pneumonia", "probability": 0.20},
        ],
        "specialists": ["Pulmonologist", "Emergency Medicine"],
        "recommendations": [
            "Sit upright and try to stay calm",
            "Seek emergency care if severe",
            "Use prescribed inhaler if available",
        ],
        "risk_weight": 4,
    },
    "abdominal pain": {
        "conditions": [
            {"name": "Gastritis", "probability": 0.35},
            {"name": "Appendicitis", "probability": 0.15},
            {"name": "IBS", "probability": 0.20},
        ],
        "specialists": ["Gastroenterologist", "General Physician"],
        "recommendations": [
            "Avoid heavy meals",
            "Apply warm compress to abdomen",
            "Seek urgent care if pain is severe and localized",
        ],
        "risk_weight": 2,
    },
    "fatigue": {
        "conditions": [
            {"name": "Anemia", "probability": 0.30},
            {"name": "Thyroid Disorder", "probability": 0.25},
            {"name": "Chronic Fatigue", "probability": 0.20},
        ],
        "specialists": ["Internal Medicine", "Endocrinologist"],
        "recommendations": [
            "Ensure adequate sleep (7-9 hours)",
            "Maintain balanced nutrition",
            "Get blood work if fatigue persists",
        ],
        "risk_weight": 1,
    },
    "nausea": {
        "conditions": [
            {"name": "Food Poisoning", "probability": 0.35},
            {"name": "Gastritis", "probability": 0.25},
            {"name": "Migraine", "probability": 0.15},
        ],
        "specialists": ["Gastroenterologist", "General Physician"],
        "recommendations": [
            "Stay hydrated with small sips of water",
            "Avoid solid food initially",
            "Rest and avoid strong odors",
        ],
        "risk_weight": 1,
    },
    "dizziness": {
        "conditions": [
            {"name": "Vertigo", "probability": 0.35},
            {"name": "Low Blood Pressure", "probability": 0.25},
            {"name": "Dehydration", "probability": 0.20},
        ],
        "specialists": ["Neurologist", "ENT Specialist"],
        "recommendations": [
            "Sit or lie down immediately",
            "Avoid sudden head movements",
            "Increase fluid intake",
        ],
        "risk_weight": 2,
    },
    "skin rash": {
        "conditions": [
            {"name": "Allergic Reaction", "probability": 0.40},
            {"name": "Eczema", "probability": 0.25},
            {"name": "Contact Dermatitis", "probability": 0.20},
        ],
        "specialists": ["Dermatologist", "Allergist"],
        "recommendations": [
            "Avoid scratching the affected area",
            "Use mild, fragrance-free soap",
            "Seek care if rash spreads rapidly",
        ],
        "risk_weight": 1,
    },
}


def normalize_symptom(symptom: str) -> str:
    return symptom.strip().lower()


def analyze_symptoms(symptoms: list[str], additional_info: str | None = None) -> dict:
    normalized = [normalize_symptom(s) for s in symptoms]
    condition_scores: dict[str, float] = {}
    all_recommendations: list[str] = []
    all_specialists: set[str] = set()
    total_risk = 0
    matched = 0

    for symptom in normalized:
        matched_data = None
        for key, data in SYMPTOM_DATABASE.items():
            if key in symptom or symptom in key:
                matched_data = data
                break

        if matched_data:
            matched += 1
            total_risk += matched_data["risk_weight"]
            for cond in matched_data["conditions"]:
                condition_scores[cond["name"]] = condition_scores.get(cond["name"], 0) + cond["probability"]
            all_recommendations.extend(matched_data["recommendations"])
            all_specialists.update(matched_data["specialists"])

    if matched == 0:
        return {
            "predicted_conditions": [{"name": "General Assessment Required", "probability": 0.5}],
            "recommendations": [
                "Consult a healthcare professional for proper evaluation",
                "Keep a symptom diary",
                "Avoid self-medication",
            ],
            "recommended_specialists": ["General Physician"],
            "risk_level": RiskLevel.LOW,
            "summary": "Your symptoms require professional medical evaluation. Please consult a doctor.",
        }

    sorted_conditions = sorted(condition_scores.items(), key=lambda x: x[1], reverse=True)
    predicted = [
        {"name": name, "probability": round(min(score / matched, 0.95), 2)}
        for name, score in sorted_conditions[:5]
    ]

    avg_risk = total_risk / matched
    if avg_risk >= 3.5:
        risk = RiskLevel.CRITICAL
    elif avg_risk >= 2.5:
        risk = RiskLevel.HIGH
    elif avg_risk >= 1.5:
        risk = RiskLevel.MODERATE
    else:
        risk = RiskLevel.LOW

    unique_recs = list(dict.fromkeys(all_recommendations))[:6]
    specialists = list(all_specialists)[:4]

    summary_parts = [f"Based on {matched} recognized symptom(s), our analysis suggests:"]
    if predicted:
        top = predicted[0]
        summary_parts.append(f"The most likely condition is {top['name']} ({int(top['probability']*100)}% confidence).")
    if risk in (RiskLevel.HIGH, RiskLevel.CRITICAL):
        summary_parts.append("⚠️ Some symptoms may indicate a serious condition. Please consult a doctor promptly.")
    else:
        summary_parts.append("This is a preliminary assessment only. Please consult a qualified healthcare provider.")

    if additional_info:
        summary_parts.append(f"Additional context noted: {additional_info[:200]}")

    return {
        "predicted_conditions": predicted,
        "recommendations": unique_recs,
        "recommended_specialists": specialists,
        "risk_level": risk,
        "summary": " ".join(summary_parts),
    }
