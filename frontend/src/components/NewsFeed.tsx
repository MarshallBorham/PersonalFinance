import { useEffect, useState } from "react";

interface NewsArticle {
  headline: string;
  summary:  string;
  source:   string;
  url:      string;
  image:    string;
  datetime: number;
}

function timeAgo(unix: number): string {
  const diff = Math.floor((Date.now() / 1000) - unix);
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NewsFeed() {
  const [articles,    setArticles]    = useState<NewsArticle[]>([]);
  const [failedImgs,  setFailedImgs]  = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/api/stocks/news")
      .then(r => r.json())
      .then((data: NewsArticle[]) => {
        if (Array.isArray(data)) {
          setArticles(data.filter(a =>
            !!a.image &&
            !a.image.includes("reutersmedia.net/resources/r/") &&
            !a.image.includes("static.reuters.com/resources/r/") &&
            !a.image.includes("finnhub.io/file/finnhub/logo/")
          ));
        }
      })
      .catch(() => {});
  }, []);

  const visibleArticles = articles.filter((_, i) => !failedImgs.has(i));

  if (visibleArticles.length === 0) return null;

  return (
    <div className="news-feed">
      <div className="news-feed-title">Market News</div>
      {articles.map((a, i) => {
        if (failedImgs.has(i)) return null;
        return (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="news-article"
          >
            <img
              className="news-article-image"
              src={a.image}
              alt=""
              loading="lazy"
              onError={() => setFailedImgs(prev => new Set(prev).add(i))}
            />
            <div className="news-article-body">
              <div className="news-article-headline">{a.headline}</div>
              <div className="news-article-meta">{a.source} · {timeAgo(a.datetime)}</div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
