import express, { Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { NetWorthSnapshot } from "../models/NetWorthSnapshot.js";

export const netWorthRouter = express.Router();
netWorthRouter.use(requireAuth);

netWorthRouter.get("/", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  try {
    const snapshots = await NetWorthSnapshot.find({ userId }).sort({ date: -1 }).limit(24);
    res.json(snapshots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch snapshots" });
  }
});

netWorthRouter.post("/", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  const { assets, liabilities, date } = req.body as {
    assets?:      { name: string; amount: number }[];
    liabilities?: { name: string; amount: number }[];
    date?:        string;
  };
  try {
    const snapshot = new NetWorthSnapshot({
      userId,
      assets:      assets ?? [],
      liabilities: liabilities ?? [],
      date:        date ? new Date(date) : new Date(),
    });
    await snapshot.save();
    res.status(201).json(snapshot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create snapshot" });
  }
});

netWorthRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  try {
    const snapshot = await NetWorthSnapshot.findOneAndDelete({ _id: req.params.id, userId });
    if (!snapshot) {
      res.status(404).json({ error: "Snapshot not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete snapshot" });
  }
});
