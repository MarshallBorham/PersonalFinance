import express, { Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Holding } from "../models/Holding.js";
import { CacheEntry } from "../models/CacheEntry.js";
import { getEnvVar } from "../getEnvVar.js";

export const portfolioRouter = express.Router();
portfolioRouter.use(requireAuth);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function persistCache(type: string, key: string, data: unknown, fetchedAt: number): Promise<void> {
  try {
    await CacheEntry.findOneAndUpdate({ type, key }, { type, key, data, fetchedAt }, { upsert: true });
  } catch (err) {
    console.error("[cache] persist failed:", (err as Error).message);
  }
}

export async function initPortfolioCache(): Promise<void> {
  try {
    // Remove any empty history cache entries (from failed fetches before Yahoo Finance switch)
    await CacheEntry.deleteMany({ type: "portfolio-history", "data.0": { $exists: false } });

    const entries = await CacheEntry.find({ type: { $in: ["portfolio-prices", "portfolio-history"] } });
    for (const e of entries) {
      if (e.type === "portfolio-prices") {
        priceCache.set(e.key, { data: e.data as PriceEntry[], fetchedAt: e.fetchedAt });
      } else if (e.type === "portfolio-history") {
        historyCache.set(e.key, { data: e.data as HistoryEntry[], fetchedAt: e.fetchedAt });
      }
    }
    if (entries.length > 0) console.log(`[portfolio] loaded ${entries.length} cache entries from MongoDB`);
  } catch (err) {
    console.error("[portfolio] cache load failed:", (err as Error).message);
  }
}

// ── Price cache ────────────────────────────────────────────────────────────────

interface PriceEntry {
  symbol:        string;
  price:         number;
  change:        number;
  changePercent: number;
}

interface PriceCache { data: PriceEntry[]; fetchedAt: number; }

const priceCache = new Map<string, PriceCache>();

async function fetchPrice(symbol: string, token: string): Promise<PriceEntry | null> {
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${token}`);
    if (!res.ok) return null;
    const d = await res.json() as { c?: number; d?: number; dp?: number };
    if (!d.c) return null;
    return {
      symbol,
      price:         Math.round(d.c  * 100) / 100,
      change:        Math.round((d.d  ?? 0) * 100) / 100,
      changePercent: Math.round((d.dp ?? 0) * 100) / 100,
    };
  } catch { return null; }
}

portfolioRouter.get("/prices", async (req: Request, res: Response) => {
  const token = getEnvVar("FINNHUB_API_KEY", false);
  if (!token) { res.json([]); return; }

  const raw     = (req.query.symbols as string | undefined) ?? "";
  const symbols = raw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length) { res.json([]); return; }

  const cacheKey = [...symbols].sort().join(",");
  const cached   = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 30 * 60 * 1000) {
    res.json(cached.data);
    return;
  }

  const results: PriceEntry[] = [];
  for (const symbol of symbols) {
    const p = await fetchPrice(symbol, token as string);
    if (p) results.push(p);
    await sleep(300);
  }
  const priceEntry = { data: results, fetchedAt: Date.now() };
  priceCache.set(cacheKey, priceEntry);
  void persistCache("portfolio-prices", cacheKey, results, priceEntry.fetchedAt);
  res.json(results);
});

// ── History cache ──────────────────────────────────────────────────────────────

interface HistoryEntry { symbol: string; dates: number[]; closes: number[]; }
interface HistoryCache  { data: HistoryEntry[]; fetchedAt: number; }

const historyCache = new Map<string, HistoryCache>();

interface YahooChart {
  chart: {
    result?: [{
      timestamp: number[];
      indicators: { quote: [{ close: (number | null)[] }] };
    }];
  };
}

async function fetchHistory(symbol: string): Promise<HistoryEntry | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1wk&range=2y`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept":     "application/json",
      },
    });
    if (!res.ok) return null;
    const data   = await res.json() as YahooChart;
    const result = data.chart.result?.[0];
    if (!result) return null;
    const timestamps = result.timestamp;
    const closes     = result.indicators.quote[0].close;
    const dates: number[] = [];
    const closePrices: number[] = [];
    timestamps.forEach((ts, i) => {
      const c = closes[i];
      if (c !== null && c !== undefined) {
        dates.push(ts);
        closePrices.push(Math.round(c * 100) / 100);
      }
    });
    if (dates.length === 0) return null;
    return { symbol, dates, closes: closePrices };
  } catch { return null; }
}

portfolioRouter.get("/history", async (req: Request, res: Response) => {
  const raw     = (req.query.symbols as string | undefined) ?? "";
  const symbols = raw.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!symbols.length) { res.json([]); return; }

  const cacheKey = [...symbols].sort().join(",");
  const cached   = historyCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) {
    res.json(cached.data);
    return;
  }

  const results: HistoryEntry[] = [];
  for (const symbol of symbols) {
    const h = await fetchHistory(symbol);
    if (h) results.push(h);
    await sleep(200);
  }
  if (results.length > 0) {
    const historyEntry = { data: results, fetchedAt: Date.now() };
    historyCache.set(cacheKey, historyEntry);
    void persistCache("portfolio-history", cacheKey, results, historyEntry.fetchedAt);
  }
  res.json(results);
});

// ── Holdings CRUD ──────────────────────────────────────────────────────────────

portfolioRouter.get("/holdings", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  try {
    const holdings = await Holding.find({ userId }).sort({ createdAt: -1 });
    res.json(holdings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch holdings" });
  }
});

portfolioRouter.post("/holdings", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  const { symbol, name, shares, costBasis } = req.body as {
    symbol?: string; name?: string; shares?: number; costBasis?: number;
  };
  if (!symbol || shares == null) {
    res.status(400).json({ error: "symbol and shares are required" });
    return;
  }
  try {
    const holding = new Holding({
      userId,
      symbol: symbol.toUpperCase(),
      name:   name ?? "",
      shares,
      costBasis: costBasis ?? 0,
    });
    await holding.save();
    res.status(201).json(holding);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create holding" });
  }
});

portfolioRouter.post("/holdings/import", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  const { holdings } = req.body as {
    holdings?: { symbol: string; name?: string; shares: number; costBasis?: number }[];
  };
  if (!Array.isArray(holdings) || holdings.length === 0) {
    res.status(400).json({ error: "holdings array is required" });
    return;
  }
  try {
    await Holding.deleteMany({ userId });
    const docs = holdings.map(h => ({
      userId,
      symbol:    h.symbol.toUpperCase(),
      name:      h.name ?? "",
      shares:    h.shares,
      costBasis: h.costBasis ?? 0,
    }));
    const created = await Holding.insertMany(docs);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to import holdings" });
  }
});

portfolioRouter.put("/holdings/:id", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  try {
    const holding = await Holding.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: req.body as Record<string, unknown> },
      { new: true }
    );
    if (!holding) { res.status(404).json({ error: "Holding not found" }); return; }
    res.json(holding);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update holding" });
  }
});

portfolioRouter.delete("/holdings/:id", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  try {
    const holding = await Holding.findOneAndDelete({ _id: req.params.id, userId });
    if (!holding) { res.status(404).json({ error: "Holding not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete holding" });
  }
});
