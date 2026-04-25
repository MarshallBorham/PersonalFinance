import { useState, useEffect, useRef, FormEvent } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";

interface Holding  { _id: string; symbol: string; name: string; shares: number; costBasis: number; manualPrice?: number; }
interface PriceData { symbol: string; price: number; change: number; changePercent: number; }
interface HistoryData { symbol: string; dates: number[]; closes: number[]; }

type TimeRange = "1W" | "1M" | "3M" | "6M" | "12M" | "YTD";
type ParsedHolding = Omit<Holding, "_id">;

const TIME_RANGES: TimeRange[] = ["1W", "1M", "3M", "6M", "12M", "YTD"];
const COLORS = ["#22c55e", "#818cf8", "#f97316", "#38bdf8", "#d29922", "#f85149", "#a78bfa", "#34d399", "#fb923c", "#60a5fa"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`; }

function rangeStart(range: TimeRange): number {
  const now = new Date();
  switch (range) {
    case "1W":  return new Date(now.getTime() - 7 * 86400000).getTime() / 1000;
    case "1M":  return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).getTime() / 1000;
    case "3M":  return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).getTime() / 1000;
    case "6M":  return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).getTime() / 1000;
    case "12M": return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getTime() / 1000;
    case "YTD": return new Date(now.getFullYear(), 0, 1).getTime() / 1000;
  }
}

function parseCSV(text: string): ParsedHolding[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, "").toLowerCase());
    if (cols.some(c => c.includes("symbol") || c.includes("ticker") || c === "shares")) {
      headers = cols; headerIdx = i; break;
    }
  }
  if (headerIdx < 0) return [];

  const find = (...terms: string[]) => {
    for (const t of terms) { const i = headers.findIndex(h => h.includes(t)); if (i >= 0) return i; }
    return -1;
  };

  const symCol  = find("symbol", "ticker");
  const nameCol = find("description", "security", "fund name", "name");
  const shrCol  = find("shares", "units", "quantity");
  const costCol = find("cost basis", "average cost", "avg cost");

  if (symCol < 0 || shrCol < 0) return [];

  const results: ParsedHolding[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const row = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const symbol = row[symCol]?.toUpperCase().trim();
    if (!symbol || symbol === "SYMBOL" || symbol === "TICKER" || symbol === "TOTAL") continue;
    const shares = parseFloat((row[shrCol] ?? "").replace(/,/g, ""));
    if (isNaN(shares) || shares <= 0) continue;
    const costBasis = costCol >= 0 ? parseFloat((row[costCol] ?? "").replace(/[$,]/g, "")) : 0;
    const name = nameCol >= 0 ? (row[nameCol] ?? "") : "";
    results.push({ symbol, name, shares, costBasis: isNaN(costBasis) ? 0 : costBasis });
  }
  return results;
}

function buildChartData(
  holdings: Holding[],
  history: HistoryData[],
  prices: Record<string, PriceData>,
  range: TimeRange,
) {
  const nowTs  = Math.floor(Date.now() / 1000);
  const start  = rangeStart(range);

  // Build lookup: symbol → sorted array of {ts, price}
  const priceMap = new Map<string, { ts: number; price: number }[]>();
  for (const h of history) {
    const arr = h.dates.map((d, i) => ({ ts: d, price: h.closes[i] })).sort((a, b) => a.ts - b.ts);
    priceMap.set(h.symbol, arr);
  }

  function closestPrice(symbol: string, ts: number): number {
    const arr = priceMap.get(symbol);
    if (arr && arr.length > 0) {
      // Find the last entry on or before ts
      let lo = 0, hi = arr.length - 1, best = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (arr[mid].ts <= ts) { best = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      if (best >= 0) return arr[best].price;
    }
    return prices[symbol]?.price ?? holdings.find(h => h.symbol === symbol)?.manualPrice ?? 0;
  }

  // Generate sample points at 7-day intervals from start to now
  const sampleTs: number[] = [];
  for (let ts = nowTs; ts >= start; ts -= 7 * 86400) sampleTs.unshift(ts);
  if (sampleTs.length === 0 || sampleTs[0] > start + 86400) sampleTs.unshift(Math.floor(start));

  return sampleTs.map(ts => {
    const total = holdings.reduce((s, h) => s + h.shares * closestPrice(h.symbol, ts), 0);
    return {
      date:  new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.round(total * 100) / 100,
    };
  });
}

export default function PortfolioPage() {
  const { authFetch } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [holdings,    setHoldings]    = useState<Holding[]>([]);
  const [prices,      setPrices]      = useState<Record<string, PriceData>>({});
  const [history,     setHistory]     = useState<HistoryData[]>([]);
  const [timeRange,   setTimeRange]   = useState<TimeRange>("3M");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");

  const [csvPreview,  setCsvPreview]  = useState<ParsedHolding[] | null>(null);
  const [importing,   setImporting]   = useState(false);

  const [showAdd,     setShowAdd]     = useState(false);
  const [addSymbol,   setAddSymbol]   = useState("");
  const [addName,     setAddName]     = useState("");
  const [addShares,   setAddShares]   = useState("");
  const [addCost,     setAddCost]     = useState("");
  const [adding,      setAdding]      = useState(false);

  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});

  async function loadHoldings() {
    const res  = await authFetch("/api/portfolio/holdings");
    const data = await res.json() as Holding[];
    if (Array.isArray(data)) setHoldings(data);
    return data;
  }

  async function loadPrices(hs: Holding[]) {
    const symbols = [...new Set(hs.map(h => h.symbol))].join(",");
    if (!symbols) return;
    const res  = await authFetch(`/api/portfolio/prices?symbols=${symbols}`);
    const data = await res.json() as PriceData[];
    if (Array.isArray(data)) {
      const map: Record<string, PriceData> = {};
      data.forEach(p => { map[p.symbol] = p; });
      setPrices(map);
    }
  }

  async function loadHistory(hs: Holding[]) {
    const symbols = [...new Set(hs.map(h => h.symbol))].join(",");
    if (!symbols) return;
    const res  = await authFetch(`/api/portfolio/history?symbols=${symbols}`);
    const data = await res.json() as HistoryData[];
    if (Array.isArray(data)) setHistory(data);
  }

  useEffect(() => {
    async function init() {
      try {
        const hs = await loadHoldings();
        await Promise.all([loadPrices(hs), loadHistory(hs)]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setError("Could not parse CSV — check that it contains Symbol and Shares columns.");
        return;
      }
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function confirmImport() {
    if (!csvPreview) return;
    setImporting(true);
    setError("");
    try {
      const res = await authFetch("/api/portfolio/holdings/import", {
        method: "POST",
        body: JSON.stringify({ holdings: csvPreview }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Import failed");
        return;
      }
      const hs = await loadHoldings();
      await Promise.all([loadPrices(hs), loadHistory(hs)]);
      setCsvPreview(null);
    } finally {
      setImporting(false);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError("");
    const shares = parseFloat(addShares);
    const cost   = parseFloat(addCost) || 0;
    if (!addSymbol || isNaN(shares) || shares <= 0) { setError("Symbol and shares are required"); return; }
    setAdding(true);
    try {
      const res = await authFetch("/api/portfolio/holdings", {
        method: "POST",
        body: JSON.stringify({ symbol: addSymbol, name: addName, shares, costBasis: cost }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; setError(d.error ?? "Failed"); return; }
      const hs = await loadHoldings();
      await Promise.all([loadPrices(hs), loadHistory(hs)]);
      setAddSymbol(""); setAddName(""); setAddShares(""); setAddCost(""); setShowAdd(false);
    } finally { setAdding(false); }
  }

  async function handleDelete(id: string) {
    await authFetch(`/api/portfolio/holdings/${id}`, { method: "DELETE" });
    const hs = await loadHoldings();
    await loadPrices(hs);
  }

  async function saveManualPrice(id: string, symbol: string) {
    const val = parseFloat(manualInputs[id] ?? "");
    if (isNaN(val) || val <= 0) return;
    await authFetch(`/api/portfolio/holdings/${id}`, {
      method: "PUT",
      body: JSON.stringify({ manualPrice: val }),
    });
    setHoldings(prev => prev.map(h => h._id === id ? { ...h, manualPrice: val } : h));
    setManualInputs(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  // ── Computed values ──────────────────────────────────────────────────────────

  const holdingsWithValue = holdings.map(h => {
    const p          = prices[h.symbol]?.price ?? h.manualPrice ?? null;
    const value      = p !== null ? h.shares * p : null;
    const cost       = h.shares * h.costBasis;
    const gainLoss   = value !== null && h.costBasis > 0 ? value - cost : null;
    const returnPct  = gainLoss !== null && cost > 0 ? (gainLoss / cost) * 100 : null;
    return { ...h, currentPrice: p, value, gainLoss, returnPct };
  });

  const totalValue    = holdingsWithValue.reduce((s, h) => s + (h.value ?? 0), 0);
  const totalCost     = holdingsWithValue.reduce((s, h) => s + h.shares * h.costBasis, 0);
  const totalGainLoss = totalValue - totalCost;
  const totalReturn   = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  const pieData = holdingsWithValue
    .filter(h => h.value !== null && h.value > 0)
    .map(h => ({ name: h.symbol, value: Math.round((h.value ?? 0) * 100) / 100 }));

  const chartData = buildChartData(holdings, history, prices, timeRange);

  const chartColor = chartData.length > 1 && chartData[chartData.length - 1].value >= chartData[0].value
    ? "#22c55e" : "#f85149";

  return (
    <Layout>
      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Portfolio</h1>
            <p className="page-subtitle">Import holdings from TIAA or add them manually.</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              Import CSV
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(v => !v)}>
              {showAdd ? "Cancel" : "+ Add Holding"}
            </button>
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {/* CSV Preview */}
        {csvPreview && (
          <div className="add-form" style={{ marginBottom: "1.5rem" }}>
            <div className="form-section-title">CSV Preview — {csvPreview.length} holdings found</div>
            <div className="table-wrap" style={{ marginBottom: "1rem" }}>
              <table>
                <thead><tr><th>Symbol</th><th>Name</th><th>Shares</th><th>Cost Basis/Share</th></tr></thead>
                <tbody>
                  {csvPreview.map((h, i) => (
                    <tr key={i}>
                      <td>{h.symbol}</td>
                      <td className="text-muted">{h.name || "—"}</td>
                      <td>{h.shares}</td>
                      <td>{h.costBasis > 0 ? fmt(h.costBasis) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-primary btn-sm" onClick={() => void confirmImport()} disabled={importing}>
                {importing ? "Importing..." : "Confirm Import"}
              </button>
              <button className="btn btn-danger" onClick={() => setCsvPreview(null)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Add Holding Form */}
        {showAdd && (
          <form className="add-form" onSubmit={e => void handleAdd(e)}>
            <div className="form-section-title">Add Holding</div>
            <div className="form-row-2">
              <div className="form-group">
                <label>Symbol</label>
                <input type="text" value={addSymbol} onChange={e => setAddSymbol(e.target.value.toUpperCase())} placeholder="e.g. AAPL" required />
              </div>
              <div className="form-group">
                <label>Name (optional)</label>
                <input type="text" value={addName} onChange={e => setAddName(e.target.value)} placeholder="e.g. Apple Inc." />
              </div>
              <div className="form-group">
                <label>Shares</label>
                <input type="number" value={addShares} onChange={e => setAddShares(e.target.value)} placeholder="e.g. 10" min="0" step="any" required />
              </div>
              <div className="form-group">
                <label>Cost Basis / Share ($)</label>
                <input type="number" value={addCost} onChange={e => setAddCost(e.target.value)} placeholder="e.g. 150.00" min="0" step="any" />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={adding}>{adding ? "Adding..." : "Add"}</button>
          </form>
        )}

        {loading ? (
          <div className="status-msg">Loading portfolio...</div>
        ) : holdings.length === 0 ? (
          <div className="empty"><p>No holdings yet. Import a CSV or add one manually.</p></div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="card-grid" style={{ marginBottom: "1.5rem" }}>
              <div className="stat-card">
                <div className="stat-card-label">Total Value</div>
                <div className="stat-card-value">{fmt(totalValue)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Total Cost</div>
                <div className="stat-card-value">{fmt(totalCost)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Gain / Loss</div>
                <div className={`stat-card-value ${totalGainLoss >= 0 ? "amount-positive" : "amount-negative"}`}>
                  {fmt(totalGainLoss)}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Total Return</div>
                <div className={`stat-card-value ${totalReturn >= 0 ? "amount-positive" : "amount-negative"}`}>
                  {fmtPct(totalReturn)}
                </div>
              </div>
            </div>

            {/* Time range tabs */}
            <div className="time-range-tabs">
              {TIME_RANGES.map(r => (
                <button
                  key={r}
                  className={`time-range-tab ${timeRange === r ? "active" : ""}`}
                  onClick={() => setTimeRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Charts */}
            <div className="portfolio-charts">
              <div className="chart-card">
                <div className="chart-card-title">Portfolio Value</div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={chartColor} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#7d8590" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "#7d8590" }} tickFormatter={v => `$${((v as number) / 1000).toFixed(0)}k`} width={45} domain={[Math.round(totalValue * 0.5), (dataMax: number) => Math.round(dataMax * 1.15)]} />
                      <Tooltip formatter={(v: unknown) => [fmt(v as number), "Value"]} contentStyle={{ background: "#1c2333", border: "1px solid #30363d", fontSize: 12 }} />
                      <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill="url(#areaGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="status-msg" style={{ padding: "2rem" }}>Not enough history data for this range.</div>
                )}
              </div>

              <div className="chart-card">
                <div className="chart-card-title">Allocation</div>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="45%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: unknown) => fmt(v as number)} contentStyle={{ background: "#1c2333", border: "1px solid #30363d", fontSize: 12 }} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="status-msg" style={{ padding: "2rem" }}>No priced holdings yet.</div>
                )}
              </div>
            </div>

            {/* Holdings table */}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Shares</th>
                    <th>Cost Basis</th>
                    <th>Price</th>
                    <th>Value</th>
                    <th>Gain/Loss</th>
                    <th>Return</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {holdingsWithValue.map(h => (
                    <tr key={h._id}>
                      <td style={{ fontWeight: 700 }}>{h.symbol}</td>
                      <td className="text-muted">{h.name || "—"}</td>
                      <td>{h.shares}</td>
                      <td>{h.costBasis > 0 ? fmt(h.costBasis) : "—"}</td>
                      <td>
                        {h.currentPrice !== null ? (
                          fmt(h.currentPrice)
                        ) : (
                          <span className="price-unavailable">unavailable</span>
                        )}
                      </td>
                      <td>{h.value !== null ? fmt(h.value) : "—"}</td>
                      <td className={h.gainLoss !== null ? (h.gainLoss >= 0 ? "amount-positive" : "amount-negative") : ""}>
                        {h.gainLoss !== null ? fmt(h.gainLoss) : "—"}
                      </td>
                      <td className={h.returnPct !== null ? (h.returnPct >= 0 ? "amount-positive" : "amount-negative") : ""}>
                        {h.returnPct !== null ? fmtPct(h.returnPct) : "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                          {h.currentPrice === null && (
                            <>
                              <input
                                className="manual-price-input"
                                type="number"
                                placeholder="Enter price"
                                value={manualInputs[h._id] ?? ""}
                                onChange={e => setManualInputs(prev => ({ ...prev, [h._id]: e.target.value }))}
                                min="0"
                                step="any"
                              />
                              <button
                                className="btn btn-save btn-sm"
                                onClick={() => void saveManualPrice(h._id, h.symbol)}
                                disabled={!manualInputs[h._id]}
                              >
                                Set
                              </button>
                            </>
                          )}
                          <button className="btn btn-danger" onClick={() => void handleDelete(h._id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
