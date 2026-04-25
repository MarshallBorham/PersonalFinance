import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";

interface LineItem { name: string; amount: string; }

interface Snapshot {
  _id:         string;
  date:        string;
  assets:      { name: string; amount: number }[];
  liabilities: { name: string; amount: number }[];
  netWorth:    number;
}

const ASSET_PRESETS      = ["Savings Account", "Investments", "Home Value", "Vehicle", "Other Asset"];
const LIABILITY_PRESETS  = ["Mortgage", "Student Loans", "Credit Card", "Car Loan", "Other Debt"];

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

function blankRow(name = ""): LineItem { return { name, amount: "" }; }

export default function NetWorthPage() {
  const { authFetch } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const [assets,      setAssets]      = useState<LineItem[]>([blankRow("Savings Account")]);
  const [liabilities, setLiabilities] = useState<LineItem[]>([blankRow("Mortgage")]);
  const [date,        setDate]        = useState(() => new Date().toISOString().slice(0, 10));

  const totalAssets      = assets.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const netWorth         = totalAssets - totalLiabilities;

  useEffect(() => {
    async function load() {
      try {
        const res  = await authFetch("/api/networth");
        const data = await res.json() as Snapshot[];
        setSnapshots(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function updateRow(list: LineItem[], setList: (l: LineItem[]) => void, i: number, field: keyof LineItem, val: string) {
    const next = [...list];
    next[i] = { ...next[i], [field]: val };
    setList(next);
  }

  function addRow(list: LineItem[], setList: (l: LineItem[]) => void) {
    setList([...list, blankRow()]);
  }

  function removeRow(list: LineItem[], setList: (l: LineItem[]) => void, i: number) {
    if (list.length === 1) return;
    setList(list.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const payload = {
        date,
        assets:      assets.filter(a => a.name || a.amount).map(a => ({ name: a.name, amount: parseFloat(a.amount) || 0 })),
        liabilities: liabilities.filter(l => l.name || l.amount).map(l => ({ name: l.name, amount: parseFloat(l.amount) || 0 })),
      };
      const res = await authFetch("/api/networth", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to save");
        return;
      }
      const snap = await res.json() as Snapshot;
      setSnapshots(prev => [snap, ...prev]);
      setAssets([blankRow("Savings Account")]);
      setLiabilities([blankRow("Mortgage")]);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await authFetch(`/api/networth/${id}`, { method: "DELETE" });
      setSnapshots(prev => prev.filter(s => s._id !== id));
    } catch {
      setError("Failed to delete snapshot");
    }
  }

  return (
    <Layout>
      <div className="container">
        <h1 className="page-title">Net Worth</h1>
        <p className="page-subtitle">Track your assets and liabilities over time.</p>

        <div className="nw-form">
          <div className="form-group">
            <label>Snapshot Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ maxWidth: 200 }}
            />
          </div>

          <div className="nw-section">
            <div className="nw-section-header">
              <span className="nw-section-title assets">Assets</span>
              <button className="btn btn-sm btn-save" onClick={() => addRow(assets, setAssets)}>+ Add Row</button>
            </div>
            {assets.map((row, i) => (
              <div className="nw-row" key={i}>
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateRow(assets, setAssets, i, "name", e.target.value)}
                  placeholder={ASSET_PRESETS[i % ASSET_PRESETS.length]}
                />
                <input
                  type="number"
                  value={row.amount}
                  onChange={(e) => updateRow(assets, setAssets, i, "amount", e.target.value)}
                  placeholder="0"
                  min="0"
                />
                <button className="btn btn-danger" onClick={() => removeRow(assets, setAssets, i)}>✕</button>
              </div>
            ))}
          </div>

          <div className="nw-section">
            <div className="nw-section-header">
              <span className="nw-section-title liabilities">Liabilities</span>
              <button className="btn btn-sm btn-save" onClick={() => addRow(liabilities, setLiabilities)}>+ Add Row</button>
            </div>
            {liabilities.map((row, i) => (
              <div className="nw-row" key={i}>
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateRow(liabilities, setLiabilities, i, "name", e.target.value)}
                  placeholder={LIABILITY_PRESETS[i % LIABILITY_PRESETS.length]}
                />
                <input
                  type="number"
                  value={row.amount}
                  onChange={(e) => updateRow(liabilities, setLiabilities, i, "amount", e.target.value)}
                  placeholder="0"
                  min="0"
                />
                <button className="btn btn-danger" onClick={() => removeRow(liabilities, setLiabilities, i)}>✕</button>
              </div>
            ))}
          </div>

          <div className="nw-divider" />

          <div className="nw-total-row">
            <div>
              <span className="nw-total-label">Assets </span>
              <span className="amount-positive">{fmt(totalAssets)}</span>
              {"  ·  "}
              <span className="nw-total-label">Liabilities </span>
              <span className="amount-negative">{fmt(totalLiabilities)}</span>
            </div>
            <div>
              <span className="nw-total-label">Net Worth  </span>
              <span className={`nw-total-value ${netWorth < 0 ? "amount-negative" : "amount-positive"}`}>
                {fmt(netWorth)}
              </span>
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : "Save Snapshot"}
          </button>
        </div>

        <div className="section-title">Snapshot History</div>

        {loading ? (
          <div className="status-msg">Loading...</div>
        ) : snapshots.length === 0 ? (
          <div className="empty"><p>No snapshots saved yet.</p></div>
        ) : (
          snapshots.map(snap => {
            const tAssets = snap.assets.reduce((s, a) => s + a.amount, 0);
            const tLiab   = snap.liabilities.reduce((s, l) => s + l.amount, 0);
            return (
              <div className="snapshot-card" key={snap._id}>
                <div>
                  <div className="snapshot-date">{new Date(snap.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</div>
                  <div className="snapshot-breakdown">
                    {fmt(tAssets)} assets · {fmt(tLiab)} liabilities
                  </div>
                </div>
                <div className={`snapshot-value ${snap.netWorth < 0 ? "amount-negative" : "amount-positive"}`}>
                  {fmt(snap.netWorth)}
                </div>
                <button className="btn btn-danger" onClick={() => void handleDelete(snap._id)}>Delete</button>
              </div>
            );
          })
        )}
      </div>
    </Layout>
  );
}
