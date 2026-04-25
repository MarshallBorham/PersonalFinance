import express, { Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { BudgetEntry } from "../models/BudgetEntry.js";

export const budgetRouter = express.Router();
budgetRouter.use(requireAuth);

budgetRouter.get("/", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  const { month } = req.query as { month?: string };
  const filter: Record<string, unknown> = { userId };
  if (month) filter.month = month;
  try {
    const entries = await BudgetEntry.find(filter).sort({ createdAt: -1 });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch budget entries" });
  }
});

budgetRouter.post("/", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  const { month, category, type, amount, description } = req.body as {
    month?: string;
    category?: string;
    type?: string;
    amount?: number;
    description?: string;
  };
  if (!month || !category || !type || amount == null) {
    res.status(400).json({ error: "month, category, type, and amount are required" });
    return;
  }
  try {
    const entry = new BudgetEntry({ userId, month, category, type, amount, description });
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create budget entry" });
  }
});

budgetRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  try {
    const entry = await BudgetEntry.findOneAndDelete({ _id: req.params.id, userId });
    if (!entry) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete budget entry" });
  }
});
