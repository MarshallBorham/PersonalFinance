import { useEffect, useState } from "react";

interface Recommendation {
  symbol:     string;
  strongBuy:  number;
  buy:        number;
  hold:       number;
  sell:       number;
  strongSell: number;
  period:     string;
}

export default function RecommendationTrends() {
  const [recs,        setRecs]        = useState<Recommendation[]>([]);
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stocks/recommendations")
      .then(r => r.json())
      .then((data: Recommendation[]) => { if (Array.isArray(data)) setRecs(data); })
      .catch(() => {});
  }, []);

  if (recs.length === 0) return null;

  return (
    <div className="rec-trends">
      <div className="rec-trends-title">Analyst Recommendations</div>
      {recs.map(r => {
        const total = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell;
        if (total === 0) return null;
        const buyPct  = ((r.strongBuy + r.buy)  / total) * 100;
        const holdPct = (r.hold                  / total) * 100;
        const sellPct = ((r.sell + r.strongSell) / total) * 100;

        const isHovered = hoveredSymbol === r.symbol;

        return (
          <div
            className="rec-item"
            key={r.symbol}
            onMouseEnter={() => setHoveredSymbol(r.symbol)}
            onMouseLeave={() => setHoveredSymbol(null)}
          >
            <div className="rec-item-header">
              <span className="rec-symbol">{r.symbol}</span>
              <span className="rec-counts">
                {isHovered ? (
                  <>
                    <span className="rec-buy">{r.strongBuy + r.buy} Buy</span>
                    <span className="rec-hold">{r.hold} Hold</span>
                    <span className="rec-sell">{r.sell + r.strongSell} Sell</span>
                  </>
                ) : (
                  <span className="rec-buy">{buyPct.toFixed(1)}% buy</span>
                )}
              </span>
            </div>
            <div className="rec-bar">
              <div className="rec-bar-buy"  style={{ width: `${buyPct}%` }} />
              <div className="rec-bar-hold" style={{ width: `${holdPct}%` }} />
              <div className="rec-bar-sell" style={{ width: `${sellPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
