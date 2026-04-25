import { useState } from "react";
import Layout from "../components/Layout";

const LS_KEY = "retirement_inputs";

interface Inputs {
  currentSavings: string;
  currentAge:     string;
  annualSpending: string;
  annualReturn:   number;
}

interface Result {
  target:     number;
  gap:        number;
  years:      number;
  multiplier: number;
  savings:    number;
  spending:   number;
}

function loadInputs(): Inputs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Inputs;
  } catch { /* ignore */ }
  return { currentSavings: "", currentAge: "", annualSpending: "", annualReturn: 3 };
}

function calcTarget(age: number, spending: number, rate: number): number {
  const n = 95 - age;
  if (rate === 0) return spending * n;
  return spending * (1 - Math.pow(1 + rate, -n)) / rate;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

export default function RetirementPage() {
  const [inputs, setInputs] = useState<Inputs>(loadInputs);
  const [result, setResult] = useState<Result | null>(null);
  const [error,  setError]  = useState("");

  function updateInput<K extends keyof Inputs>(field: K, value: Inputs[K]) {
    setInputs(prev => {
      const next = { ...prev, [field]: value };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function calculate() {
    setError("");
    const savings = parseFloat(inputs.currentSavings.replace(/,/g, ""));
    const age     = parseInt(inputs.currentAge, 10);
    const spending = parseFloat(inputs.annualSpending.replace(/,/g, ""));
    const rate     = inputs.annualReturn / 100;

    if (isNaN(savings) || savings < 0)           { setError("Enter a valid savings amount (0 or more)"); return; }
    if (isNaN(age) || age < 10 || age >= 95)     { setError("Enter a valid age between 10 and 94"); return; }
    if (isNaN(spending) || spending <= 0)         { setError("Enter a valid annual spending amount"); return; }

    const target     = calcTarget(age, spending, rate);
    const gap        = target - savings;
    const years      = 95 - age;
    const multiplier = target / spending;

    setResult({ target, gap, years, multiplier, savings, spending });
  }

  const progressPct = result
    ? Math.min(100, result.savings > 0 ? (result.savings / result.target) * 100 : 0)
    : 0;

  return (
    <Layout>
      <div className="container">
        <h1 className="page-title">Retirement Calculator</h1>
        <p className="page-subtitle">
          Find out how much you need saved to live comfortably to age 95.
        </p>

        <div className="calc-card">
          <div className="form-row-3">
            <div className="form-group">
              <label>Current Savings ($)</label>
              <input
                type="text"
                value={inputs.currentSavings}
                onChange={(e) => updateInput("currentSavings", e.target.value)}
                placeholder="e.g. 50000"
              />
            </div>
            <div className="form-group">
              <label>Current Age</label>
              <input
                type="number"
                value={inputs.currentAge}
                onChange={(e) => updateInput("currentAge", e.target.value)}
                placeholder="e.g. 30"
                min="10"
                max="94"
              />
            </div>
            <div className="form-group">
              <label>Annual Spending ($)</label>
              <input
                type="text"
                value={inputs.annualSpending}
                onChange={(e) => updateInput("annualSpending", e.target.value)}
                placeholder="e.g. 40000"
              />
            </div>
          </div>

          <div className="slider-group">
            <label>
              Minimum Annual Return
              <span className="slider-value">{inputs.annualReturn.toFixed(1)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={inputs.annualReturn}
              onChange={(e) => updateInput("annualReturn", parseFloat(e.target.value))}
            />
            <div className="slider-labels">
              <span>0% (no growth)</span>
              <span>5% (optimistic)</span>
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button className="btn btn-primary" onClick={calculate}>
            Calculate Target
          </button>
        </div>

        {result && (
          <div className="result-section">
            <div className="result-box">
              <div className="result-label">Target Nest Egg Needed</div>
              <div className="result-value">{fmt(result.target)}</div>
              <div className="result-sub">
                to sustain {fmt(result.spending)}/year for {result.years} years at {inputs.annualReturn.toFixed(1)}% returns
              </div>
            </div>

            <div className="result-grid">
              <div className="result-stat">
                <div className="result-stat-label">Current Savings</div>
                <div className="result-stat-value">{fmt(result.savings)}</div>
              </div>
              <div className="result-stat">
                <div className="result-stat-label">{result.gap > 0 ? "Gap Remaining" : "Surplus"}</div>
                <div className={`result-stat-value ${result.gap > 0 ? "amount-negative" : "amount-positive"}`}>
                  {fmt(Math.abs(result.gap))}
                </div>
              </div>
              <div className="result-stat">
                <div className="result-stat-label">Years Until 95</div>
                <div className="result-stat-value">{result.years}</div>
              </div>
              <div className="result-stat">
                <div className="result-stat-label">Savings Multiplier</div>
                <div className="result-stat-value">{result.multiplier.toFixed(1)}×</div>
              </div>
            </div>

            {result.gap > 0 ? (
              <div className="progress-bar-wrap">
                <div className="progress-label">
                  <span>Progress toward target</span>
                  <span>{progressPct.toFixed(1)}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className={`progress-fill ${progressPct < 30 ? "danger" : progressPct < 70 ? "warning" : ""}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="on-track-msg">
                You are on track. Your savings exceed your retirement target.
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
