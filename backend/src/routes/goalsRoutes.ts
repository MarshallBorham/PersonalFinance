import express, { Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { SavingsGoal } from "../models/SavingsGoal.js";

export const goalsRouter = express.Router();
goalsRouter.use(requireAuth);

goalsRouter.get("/", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  try {
    const goals = await SavingsGoal.find({ userId }).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

goalsRouter.post("/", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  const { name, targetAmount, currentAmount, deadline } = req.body as {
    name?:          string;
    targetAmount?:  number;
    currentAmount?: number;
    deadline?:      string;
  };
  if (!name || targetAmount == null) {
    res.status(400).json({ error: "name and targetAmount are required" });
    return;
  }
  try {
    const goal = new SavingsGoal({
      userId,
      name,
      targetAmount,
      currentAmount: currentAmount ?? 0,
      deadline:      deadline ? new Date(deadline) : undefined,
    });
    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create goal" });
  }
});

goalsRouter.put("/:id", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  try {
    const goal = await SavingsGoal.findOneAndUpdate(
      { _id: req.params.id, userId },
      { $set: req.body as Record<string, unknown> },
      { new: true }
    );
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    res.json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update goal" });
  }
});

goalsRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  try {
    const goal = await SavingsGoal.findOneAndDelete({ _id: req.params.id, userId });
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete goal" });
  }
});
