import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import NewsFeed from "../components/NewsFeed";
import RecommendationTrends from "../components/RecommendationTrends";

interface NetWorthSnapshot { _id: string; netWorth: number; date: string; }
interface BudgetEntry      { _id: string; type: "income" | "expense"; amount: number; }
interface SavingsGoal      { _id: string; targetAmount: number; currentAmount: number; }

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);
}

export default function DashboardPage() {
  const { authFetch, username } = useAuth();
  const [netWorth,      setNetWorth]      = useState<number | null>(null);
  const [budgetSummary, setBudgetSummary] = useState<{ income: number; expenses: number } | null>(null);
  const [goals,         setGoals]         = useState<SavingsGoal[]>([]);
  const [loading,       setLoading]       = useState(true);

  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [nwRes, budgetRes, goalsRes] = await Promise.all([
          authFetch("/api/networth"),
          authFetch(`/api/budget?month=${currentMonth}`),
          authFetch("/api/goals"),
        ]);
        const nw     = await nwRes.json()     as NetWorthSnapshot[];
        const budget = await budgetRes.json() as BudgetEntry[];
        const gs     = await goalsRes.json()  as SavingsGoal[];

        if (nw.length > 0) setNetWorth(nw[0].netWorth);

        const income   = budget.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
        const expenses = budget.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
        setBudgetSummary({ income, expenses });
        setGoals(gs);
      } finally {
        setLoading(false);
      }
    }
    void fetchAll();
  }, []);

  const netIncome       = budgetSummary ? budgetSummary.income - budgetSummary.expenses : null;
  const avgGoalProgress = goals.length > 0
    ? goals.reduce((s, g) => s + Math.min(100, g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 0), 0) / goals.length
    : null;

  return (
    <Layout>
      <div className="container flush">
        <div className="dashboard-layout">
          <div className="dashboard-left">
            <h1 className="page-title">Dashboard</h1>
            <p className="dashboard-greeting">Welcome back, {username}.</p>

            {loading ? (
              <div className="status-msg">Loading...</div>
            ) : (
              <div className="card-grid">
                <Link to="/networth" className="stat-card stat-card-link">
                  <div className="stat-card-label">Net Worth</div>
                  <div className={`stat-card-value ${netWorth !== null && netWorth < 0 ? "amount-negative" : ""}`}>
                    {netWorth !== null ? fmt(netWorth) : "—"}
                  </div>
                  <div className="stat-card-sub">
                    {netWorth !== null ? "Latest snapshot" : "No snapshots yet"}
                  </div>
                </Link>

                <Link to="/budget" className="stat-card stat-card-link">
                  <div className="stat-card-label">This Month</div>
                  <div className={`stat-card-value ${netIncome !== null && netIncome < 0 ? "amount-negative" : "amount-positive"}`}>
                    {netIncome !== null ? fmt(netIncome) : "—"}
                  </div>
                  <div className="stat-card-sub">
                    {budgetSummary && budgetSummary.income + budgetSummary.expenses > 0
                      ? `${fmt(budgetSummary.income)} in · ${fmt(budgetSummary.expenses)} out`
                      : "No entries yet"}
                  </div>
                </Link>

                <Link to="/goals" className="stat-card stat-card-link">
                  <div className="stat-card-label">Savings Goals</div>
                  <div className="stat-card-value">{goals.length}</div>
                  <div className="stat-card-sub">
                    {avgGoalProgress !== null
                      ? `${avgGoalProgress.toFixed(0)}% avg progress`
                      : "No goals yet"}
                  </div>
                </Link>

                <Link to="/retirement" className="stat-card stat-card-link">
                  <div className="stat-card-label">Retirement</div>
                  <div className="stat-card-value">Calc →</div>
                  <div className="stat-card-sub">Plan your future</div>
                </Link>
              </div>
            )}
          </div>

          <div className="dashboard-right">
            <NewsFeed />
            <RecommendationTrends />
          </div>
        </div>
      </div>
    </Layout>
  );
}
