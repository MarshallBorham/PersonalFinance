import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";

interface Question {
  q:       string;
  options: { label: string; score: number }[];
}

const QUESTIONS: Question[] = [
  {
    q: "When do you plan to start withdrawing this money?",
    options: [
      { label: "Within 1–2 years",  score: 1 },
      { label: "3–5 years",         score: 2 },
      { label: "6–10 years",        score: 3 },
      { label: "11–20 years",       score: 4 },
      { label: "20+ years",         score: 5 },
    ],
  },
  {
    q: "How old are you?",
    options: [
      { label: "60 or older", score: 1 },
      { label: "50–59",       score: 2 },
      { label: "40–49",       score: 3 },
      { label: "30–39",       score: 4 },
      { label: "Under 30",    score: 5 },
    ],
  },
  {
    q: "How stable is your primary source of income?",
    options: [
      { label: "Very unstable or currently unemployed",   score: 1 },
      { label: "Somewhat unstable",                       score: 2 },
      { label: "Moderately stable",                       score: 3 },
      { label: "Stable",                                  score: 4 },
      { label: "Very stable with multiple income sources", score: 5 },
    ],
  },
  {
    q: "If you lost your job today, how long could you cover expenses without touching your investments?",
    options: [
      { label: "Less than 1 month", score: 1 },
      { label: "1–3 months",        score: 2 },
      { label: "3–6 months",        score: 3 },
      { label: "6–12 months",       score: 4 },
      { label: "12+ months",        score: 5 },
    ],
  },
  {
    q: "If your portfolio dropped 25% in a market downturn, you would...",
    options: [
      { label: "Sell everything to prevent further losses",   score: 1 },
      { label: "Sell some investments to reduce risk",        score: 2 },
      { label: "Hold and wait for recovery",                  score: 3 },
      { label: "Hold and watch for buying opportunities",     score: 4 },
      { label: "Buy more at the lower prices",                score: 5 },
    ],
  },
  {
    q: "What is the maximum annual loss you could accept without changing your investment strategy?",
    options: [
      { label: "Any loss is unacceptable", score: 1 },
      { label: "Up to 5%",                score: 2 },
      { label: "Up to 10%",               score: 3 },
      { label: "Up to 20%",               score: 4 },
      { label: "Up to 30% or more",       score: 5 },
    ],
  },
  {
    q: "Which best describes your primary financial goal?",
    options: [
      { label: "Preserve what I have — avoid any losses",                          score: 1 },
      { label: "Earn modest, steady returns with low risk",                         score: 2 },
      { label: "Balance growth and safety equally",                                 score: 3 },
      { label: "Grow my wealth, accepting occasional dips",                         score: 4 },
      { label: "Maximize long-term growth regardless of short-term volatility",     score: 5 },
    ],
  },
  {
    q: "Which investment would you prefer?",
    options: [
      { label: "Guaranteed 3% return",                             score: 1 },
      { label: "80% chance of 6%,  20% chance of −2%",            score: 2 },
      { label: "70% chance of 12%, 30% chance of −5%",            score: 3 },
      { label: "60% chance of 20%, 40% chance of −10%",           score: 4 },
      { label: "50% chance of 35%, 50% chance of −15%",           score: 5 },
    ],
  },
  {
    q: "Which best describes your current financial obligations?",
    options: [
      { label: "Supporting a family with high fixed expenses and debt",  score: 1 },
      { label: "Significant debt or obligations limiting flexibility",   score: 2 },
      { label: "Moderate obligations with manageable debt",              score: 3 },
      { label: "Low obligations with minimal debt",                      score: 4 },
      { label: "Minimal obligations and debt-free",                      score: 5 },
    ],
  },
  {
    q: "How would you describe your investment experience?",
    options: [
      { label: "No experience",                                                     score: 1 },
      { label: "Minimal — mainly savings accounts or CDs",                          score: 2 },
      { label: "Some — stocks or mutual funds",                                     score: 3 },
      { label: "Moderate — diversified portfolio across multiple asset classes",    score: 4 },
      { label: "Extensive — stocks, bonds, alternatives, and derivatives",          score: 5 },
    ],
  },
];

interface Profile {
  name:        string;
  description: string;
  allocation:  string;
  color:       string;
}

function getProfile(score: number): Profile {
  if (score <= 18) return {
    name:        "Very Conservative",
    description: "Capital preservation is your top priority. You prioritize avoiding losses over growth.",
    allocation:  "80% Bonds & Cash · 20% Stocks",
    color:       "var(--accent)",
  };
  if (score <= 26) return {
    name:        "Conservative",
    description: "You prefer stable returns with minimal risk. Modest growth over time is your goal.",
    allocation:  "60% Bonds · 40% Stocks",
    color:       "var(--primary)",
  };
  if (score <= 34) return {
    name:        "Moderate",
    description: "You seek balance between growth and stability. You can handle moderate fluctuations.",
    allocation:  "40% Bonds · 60% Stocks",
    color:       "var(--warning)",
  };
  if (score <= 42) return {
    name:        "Aggressive",
    description: "Long-term growth is your priority. You can handle significant short-term volatility.",
    allocation:  "20% Bonds · 80% Stocks",
    color:       "var(--secondary)",
  };
  return {
    name:        "Very Aggressive",
    description: "Maximum long-term growth is your goal. You fully accept high short-term volatility.",
    allocation:  "100% Stocks (including high-growth & emerging markets)",
    color:       "var(--error)",
  };
}

export default function OnboardingPage() {
  const { authFetch, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [step,    setStep]    = useState(0);           // 0-9 = questions, 10 = result
  const [answers, setAnswers] = useState<number[]>([]); // selected score per question
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const total     = QUESTIONS.length;
  const isDone    = step >= total;
  const score     = answers.reduce((s, a) => s + a, 0);
  const profile   = isDone ? getProfile(score) : null;
  const current   = !isDone ? QUESTIONS[step] : null;
  const selected  = answers[step];

  function selectOption(score: number) {
    const next = [...answers];
    next[step] = score;
    setAnswers(next);
  }

  function handleNext() {
    if (step < total - 1) setStep(step + 1);
    else setStep(total);
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  async function handleFinish() {
    if (!profile) return;
    setSaving(true);
    setError("");
    try {
      const res = await authFetch("/api/auth/onboarding", {
        method: "POST",
        body: JSON.stringify({ score, profile: profile.name }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Failed to save");
        return;
      }
      const data = await res.json() as { token: string };
      completeOnboarding(data.token);
      navigate("/");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="onboarding-page">
      {!isDone ? (
        <div className="onboarding-card">
          <div className="onboarding-header">
            <span className="onboarding-step">Question {step + 1} of {total}</span>
            <div className="onboarding-progress">
              <div className="onboarding-progress-fill" style={{ width: `${((step) / total) * 100}%` }} />
            </div>
          </div>

          <h2 className="onboarding-question">{current?.q}</h2>

          <div className="option-cards">
            {current?.options.map((opt, i) => (
              <button
                key={i}
                className={`option-card ${selected === opt.score ? "selected" : ""}`}
                onClick={() => selectOption(opt.score)}
              >
                <span className="option-marker">{selected === opt.score ? "●" : "○"}</span>
                {opt.label}
              </button>
            ))}
          </div>

          <div className="onboarding-nav">
            <button className="btn btn-secondary btn-sm" onClick={handleBack} disabled={step === 0}>
              Back
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleNext}
              disabled={selected === undefined}
              style={{ width: "auto", minWidth: 100 }}
            >
              {step === total - 1 ? "See Results" : "Next"}
            </button>
          </div>
        </div>
      ) : (
        <div className="onboarding-card profile-result">
          <div className="onboarding-progress" style={{ marginBottom: "1.5rem" }}>
            <div className="onboarding-progress-fill" style={{ width: "100%" }} />
          </div>

          <p className="onboarding-step">Your Risk Profile</p>
          <div className="risk-badge" style={{ background: profile!.color }}>
            {profile!.name}
          </div>
          <p className="profile-description">{profile!.description}</p>
          <div className="profile-allocation">
            <span className="profile-allocation-label">Suggested Allocation</span>
            <span className="profile-allocation-value">{profile!.allocation}</span>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            className="btn btn-primary"
            onClick={() => void handleFinish()}
            disabled={saving}
            style={{ marginTop: "1.5rem" }}
          >
            {saving ? "Saving..." : "Go to Dashboard"}
          </button>
        </div>
      )}
    </div>
  );
}
