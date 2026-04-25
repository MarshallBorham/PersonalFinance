import express, { Request, Response } from "express";
import { getEnvVar } from "../getEnvVar.js";

export const stocksRouter = express.Router();

interface StockQuote {
  symbol:        string;
  price:         number;
  change:        number;
  changePercent: number;
}

interface StockCache {
  data:      StockQuote[];
  fetchedAt: number;
}

const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "SPY", "QQQ", "JPM"];
const REFRESH_MS      = 30 * 60 * 1000; // 30 minutes

let cache: StockCache = { data: [], fetchedAt: 0 };

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchSymbol(symbol: string, token: string): Promise<StockQuote | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${token}`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { c?: number; d?: number; dp?: number };
    if (!data.c) return null;
    return {
      symbol,
      price:         Math.round(data.c * 100) / 100,
      change:        Math.round((data.d ?? 0) * 100) / 100,
      changePercent: Math.round((data.dp ?? 0) * 100) / 100,
    };
  } catch {
    return null;
  }
}

export async function initStockCache(): Promise<void> {
  const token = getEnvVar("FINNHUB_API_KEY", false);
  if (!token) {
    console.log("[stocks] FINNHUB_API_KEY not set — ticker disabled");
    return;
  }

  const symbolsEnv = getEnvVar("STOCK_SYMBOLS", false);
  const symbols    = symbolsEnv ? String(symbolsEnv).split(",").map(s => s.trim()) : DEFAULT_SYMBOLS;

  await refreshCache(symbols, token);

  setInterval(() => {
    void refreshCache(symbols, token as string);
  }, REFRESH_MS);
}

async function refreshCache(symbols: string[], token: string): Promise<void> {
  const results: StockQuote[] = [];
  for (const symbol of symbols) {
    const quote = await fetchSymbol(symbol, token);
    if (quote) results.push(quote);
    await sleep(300); // stay well under 60 req/min
  }
  if (results.length > 0) {
    cache = { data: results, fetchedAt: Date.now() };
    console.log(`[stocks] cache refreshed: ${results.length} symbols`);
  }
}

stocksRouter.get("/quotes", (_req: Request, res: Response) => {
  res.json(cache.data);
});

// ── News ──────────────────────────────────────────────────────────────────────

interface NewsArticle {
  headline: string;
  summary:  string;
  source:   string;
  url:      string;
  image:    string;
  datetime: number;
}

interface NewsCache {
  articles:  NewsArticle[];
  fetchedAt: number;
}

const NEWS_REFRESH_MS = 60 * 60 * 1000; // 1 hour

let newsCache: NewsCache = { articles: [], fetchedAt: 0 };

async function refreshNewsCache(token: string): Promise<void> {
  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${token}`;
    const res  = await fetch(url);
    if (!res.ok) return;
    const data = await res.json() as NewsArticle[];
    if (Array.isArray(data) && data.length > 0) {
      newsCache = { articles: data.slice(0, 30), fetchedAt: Date.now() };
      console.log(`[news] cache refreshed: ${newsCache.articles.length} articles`);
    }
  } catch (err) {
    console.error("[news] fetch failed:", (err as Error).message);
  }
}

export async function initNewsCache(): Promise<void> {
  const token = getEnvVar("FINNHUB_API_KEY", false);
  if (!token) return;

  await refreshNewsCache(token);

  setInterval(() => {
    void refreshNewsCache(token as string);
  }, NEWS_REFRESH_MS);
}

stocksRouter.get("/news", (_req: Request, res: Response) => {
  res.json(newsCache.articles);
});

// ── Recommendation Trends ─────────────────────────────────────────────────────

interface Recommendation {
  symbol:      string;
  strongBuy:   number;
  buy:         number;
  hold:        number;
  sell:        number;
  strongSell:  number;
  period:      string;
}

interface RecsCache {
  data:      Recommendation[];
  fetchedAt: number;
}

const RECS_REFRESH_MS = 24 * 60 * 60 * 1000; // 24 hours — analyst ratings change slowly

let recsCache: RecsCache = { data: [], fetchedAt: 0 };

async function fetchRecommendation(symbol: string, token: string): Promise<Recommendation | null> {
  try {
    const url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${token}`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as Array<{
      strongBuy?: number; buy?: number; hold?: number;
      sell?: number; strongSell?: number; period?: string;
    }>;
    if (!Array.isArray(data) || data.length === 0) return null;
    const latest = data[0];
    return {
      symbol,
      strongBuy:  latest.strongBuy  ?? 0,
      buy:        latest.buy        ?? 0,
      hold:       latest.hold       ?? 0,
      sell:       latest.sell       ?? 0,
      strongSell: latest.strongSell ?? 0,
      period:     latest.period     ?? "",
    };
  } catch {
    return null;
  }
}

async function refreshRecsCache(symbols: string[], token: string): Promise<void> {
  const results: Recommendation[] = [];
  for (const symbol of symbols) {
    const rec = await fetchRecommendation(symbol, token);
    if (rec) results.push(rec);
    await sleep(300);
  }
  if (results.length > 0) {
    recsCache = { data: results, fetchedAt: Date.now() };
    console.log(`[recs] cache refreshed: ${results.length} symbols`);
  }
}

export async function initRecsCache(): Promise<void> {
  const token = getEnvVar("FINNHUB_API_KEY", false);
  if (!token) return;

  const symbolsEnv = getEnvVar("STOCK_SYMBOLS", false);
  const symbols    = symbolsEnv ? String(symbolsEnv).split(",").map(s => s.trim()) : DEFAULT_SYMBOLS;

  await refreshRecsCache(symbols, token);

  setInterval(() => {
    void refreshRecsCache(symbols, token as string);
  }, RECS_REFRESH_MS);
}

stocksRouter.get("/recommendations", (_req: Request, res: Response) => {
  res.json(recsCache.data);
});
