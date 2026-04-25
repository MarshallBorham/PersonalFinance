import { useEffect, useState } from "react";

interface StockQuote {
  symbol:        string;
  price:         number;
  change:        number;
  changePercent: number;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

export default function StockTicker() {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);

  useEffect(() => {
    fetch("/api/stocks/quotes")
      .then(r => r.json())
      .then((data: StockQuote[]) => { if (Array.isArray(data) && data.length > 0) setQuotes(data); })
      .catch(() => { /* silently hide ticker if fetch fails */ });
  }, []);

  if (quotes.length === 0) return null;

  // Duplicate so the scroll loops seamlessly
  const items = [...quotes, ...quotes];

  return (
    <div className="ticker-banner">
      <div className="ticker-track">
        {items.map((q, i) => (
          <span className="ticker-item" key={`${q.symbol}-${i}`}>
            <span className="ticker-symbol">{q.symbol}</span>
            <span className="ticker-price">{fmt(q.price)}</span>
            <span className={`ticker-change ${q.change >= 0 ? "positive" : "negative"}`}>
              {q.change >= 0 ? "+" : ""}{q.change.toFixed(2)} ({q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(2)}%)
            </span>
            <span className="ticker-sep">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
