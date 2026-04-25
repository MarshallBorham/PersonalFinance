import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";

interface BudgetEntry {
  _id:         string;
  month:       string;
  category:    string;
  type:        "income" | "expense";
  amount:      number;
  description: string;
  createdAt:   string;
}

const CATEGORIES = ["Housing", "Food", "Transport", "Health", "Entertainment", "Utilities", "Savings", "Income", "Other"];

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  }).format(n);
}

export default function BudgetPage() {
  const { authFetch } = useAuth();
  const [month,    setMonth]    = useState(() => new Date().toISOString().slice(0, 7));
  const [entries,  setEntries]  = useState<BudgetEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const [category,    setCategory]    = useState("Food");
  const [type,        setType]        = useState<"income" | "expense">("expense");
  const [amount,      setAmount]      = useState("");
  const [description, setDescription] = useState("");
  const [adding,      setAdding]      = useState(false);

  async function fetchEntries(m: string) {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/budget?month=${m}`);
      const data = await res.json() as BudgetEntry[];
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load entries");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchEntries(month); }, [month]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { setError("Enter a valid amount"); return; }
    setAdding(true);
    try {
      const res = await authFetch("/api/budget", {
        method: "POST",
        body: JSON.stringify({ month, category, type, amount: parsed, description }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to add entry");
        return;
      }
      setAmount("");
      setDescription("");
      await fetchEntries(month);
    } catch {
      setError("Network error");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await authFetch(`/api/budget/${id}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e._id !== id));
    } catch {
      setError("Failed to delete entry");
    }
  }

  const income   = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const expenses = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const net      = income - expenses;

  return (
    <Layout>
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Budget Tracker</h1>
          </div>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="month-picker"
          />
        </div>

        <div className="budget-summary">
          <div className="budget-summary-item">
            <span className="budget-summary-label">Income</span>
            <span className="budget-summary-value amount-positive">{fmt(income)}</span>
          </div>
          <div className="budget-summary-item">
            <span className="budget-summary-label">Expenses</span>
            <span className="budget-summary-value amount-negative">{fmt(expenses)}</span>
          </div>
          <div className="budget-summary-item">
            <span className="budget-summary-label">Net</span>
            <span className={`budget-summary-value ${net >= 0 ? "amount-positive" : "amount-negative"}`}>
              {fmt(net)}
            </span>
          </div>
        </div>

        <form className="add-form" onSubmit={handleAdd}>
          <div className="form-section-title">Add Entry</div>
          <div className="form-row-3">
            <div className="form-group">
              <label>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Amount ($)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Grocery run"
            />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={adding}>
            {adding ? "Adding..." : "Add Entry"}
          </button>
        </form>

        <div className="table-wrap">
          {loading ? (
            <div className="status-msg">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="empty">
              <p>No entries for {month}.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry._id}>
                    <td><span className="category-badge">{entry.category}</span></td>
                    <td className={`entry-type-${entry.type}`}>{entry.type}</td>
                    <td className={entry.type === "income" ? "amount-positive" : "amount-negative"}>
                      {fmt(entry.amount)}
                    </td>
                    <td className="text-muted">{entry.description || "—"}</td>
                    <td>
                      <button
                        className="btn btn-danger"
                        onClick={() => void handleDelete(entry._id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
