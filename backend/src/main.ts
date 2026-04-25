import express, { Request, Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { getEnvVar } from "./getEnvVar.js";
import { authRouter } from "./routes/authRoutes.js";
import { budgetRouter } from "./routes/budgetRoutes.js";
import { netWorthRouter } from "./routes/netWorthRoutes.js";
import { goalsRouter } from "./routes/goalsRoutes.js";
import { portfolioRouter, initPortfolioCache } from "./routes/portfolioRoutes.js";
import { stocksRouter, initStockCache, initNewsCache, initRecsCache } from "./routes/stocksRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = Number.parseInt(getEnvVar("PORT", false) ?? "3001", 10) || 3001;
const MONGO_URI = getEnvVar("MONGODB_URI") as string;

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth",     authRouter);
app.use("/api/budget",   budgetRouter);
app.use("/api/networth", netWorthRouter);
app.use("/api/goals",    goalsRouter);
app.use("/api/stocks",    stocksRouter);
app.use("/api/portfolio", portfolioRouter);

app.use(express.static(path.join(__dirname, "../../frontend/dist")));

app.get("/{*path}", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
    void initStockCache();
    void initNewsCache();
    void initRecsCache();
    void initPortfolioCache();
  })
  .catch((err: Error) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
