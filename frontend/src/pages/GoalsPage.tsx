import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";

interface SavingsGoal {
  _id:           string;
  name:          string;
  targetAmount:  number;
  currentAmount: number;
  deadline?:     string;
  createdAt:     string;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

export default function GoalsPage() {
  const { authFetch } = useAuth();
  const [goals,   setGoals]   = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const [name,          setName]          = useState("");
  const [targetAmount,  setTargetAmount]  = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [deadline,      setDeadline]      = useState("");
  const [adding,        setAdding]        = useState(false);

  const [updateValues, setUpdateValues] = useState<Record<string, string>>({});
  const [updating,     setUpdating]     = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res  = await authFetch("/api/goals");
        const data = await res.json() as SavingsGoal[];
        setGoals(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    const target  = parseFloat(targetAmount);
    const current = parseFloat(currentAmount) || 0;
    if (isNaN(target) || target <= 0) { setError("Enter a valid target amount"); return; }
    setAdding(true);
    try {
      const res = await authFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify({
          name,
          targetAmount:  target,
          currentAmount: current,
          deadline:      deadline || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to create goal");
        return;
      }
      const goal = await res.json() as SavingsGoal;
      setGoals(prev => [goal, ...prev]);
      setName(""); setTargetAmount(""); setCurrentAmount(""); setDeadline("");
    } catch {
      setError("Network error");
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdate(id: string) {
    const val = parseFloat(updateValues[id] ?? "");
    if (isNaN(val) || val < 0) return;
    setUpdating(id);
    try {
      const res = await authFetch(`/api/goals/${id}`, {
        method: "PUT",
        body: JSON.stringify({ currentAmount: val }),
      });
      if (res.ok) {
        const updated = await res.json() as SavingsGoal;
        setGoals(prev => prev.map(g => g._id === id ? updated : g));
        setUpdateValues(prev => { const next = { ...prev }; delete next[id]; return next; });
      }
    } finally {
      setUpdating(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await authFetch(`/api/goals/${id}`, { method: "DELETE" });
      setGoals(prev => prev.filter(g => g._id !== id));
    } catch {
      setError("Failed to delete goal");
    }
  }

  return (
    <Layout>
      <div className="container">
        <h1 className="page-title">Savings Goals</h1>
        <p className="page-subtitle">Set targets and track your progress.</p>

        <form className="add-form" onSubmit={handleAdd}>
          <div className="form-section-title">New Goal</div>
          <div className="form-row-2">
            <div className="form-group">
              <label>Goal Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Emergency Fund"
                required
              />
            </div>
            <div className="form-group">
              <label>Target Amount ($)</label>
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="e.g. 10000"
                min="1"
                required
              />
            </div>
            <div className="form-group">
              <label>Current Amount ($)</label>
              <input
                type="number"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                placeholder="0"
                min="0"
              />
            </div>
            <div className="form-group">
              <label>Deadline (optional)</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={adding}>
            {adding ? "Adding..." : "Add Goal"}
          </button>
        </form>

        {loading ? (
          <div className="status-msg">Loading...</div>
        ) : goals.length === 0 ? (
          <div className="empty"><p>No goals yet. Create your first one above.</p></div>
        ) : (
          goals.map(goal => {
            const pct = goal.targetAmount > 0
              ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
              : 0;
            const fillClass = pct >= 100 ? "" : pct >= 60 ? "" : pct >= 30 ? "warning" : "danger";

            return (
              <div className="goal-card" key={goal._id}>
                <div className="goal-header">
                  <div>
                    <div className="goal-name">{goal.name}</div>
                    {goal.deadline && (
                      <div className="goal-deadline">
                        Target: {new Date(goal.deadline).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </div>
                    )}
                  </div>
                  <div className="goal-actions">
                    <button className="btn btn-danger" onClick={() => void handleDelete(goal._id)}>Delete</button>
                  </div>
                </div>

                <div className="goal-amounts">
                  <span>Saved: <strong>{fmt(goal.currentAmount)}</strong></span>
                  <span>Target: <strong>{fmt(goal.targetAmount)}</strong></span>
                  <span className="goal-pct">{pct.toFixed(1)}%</span>
                </div>

                <div className="progress-bar-wrap">
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${fillClass}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="goal-update-row">
                  <span className="goal-update-label">Update saved:</span>
                  <input
                    type="number"
                    placeholder={String(goal.currentAmount)}
                    value={updateValues[goal._id] ?? ""}
                    onChange={(e) => setUpdateValues(prev => ({ ...prev, [goal._id]: e.target.value }))}
                    min="0"
                  />
                  <button
                    className="btn btn-save btn-sm"
                    onClick={() => void handleUpdate(goal._id)}
                    disabled={updating === goal._id || !updateValues[goal._id]}
                  >
                    {updating === goal._id ? "Saving..." : "Update"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Layout>
  );
}
