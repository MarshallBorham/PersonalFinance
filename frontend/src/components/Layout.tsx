import { ReactNode } from "react";
import Header from "./Header";
import StockTicker from "./StockTicker";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="page-wrapper">
      <StockTicker />
      <div className="app-layout">
        <Header />
        <div className="main-content">
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
