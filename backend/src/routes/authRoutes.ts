import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User.js";
import { getEnvVar } from "../getEnvVar.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = express.Router();

function signToken(user: IUser): string {
  return jwt.sign(
    {
      userId:             String(user._id),
      username:           user.username,
      onboardingComplete: user.onboardingComplete,
    },
    getEnvVar("JWT_SECRET") as string,
    { expiresIn: "8h" }
  );
}

authRouter.post("/register", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  if (username.length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  try {
    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
    const passwordHash = await User.hashPassword(password);
    const user = new User({ username: username.toLowerCase(), passwordHash });
    await user.save();
    const token = signToken(user);
    res.status(201).json({ token, username: user.username, onboardingComplete: false });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    const valid = await user.verifyPassword(password);
    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }
    const token = signToken(user);
    res.json({ token, username: user.username, onboardingComplete: user.onboardingComplete });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

authRouter.post("/onboarding", requireAuth, async (req: Request, res: Response) => {
  const userId = (req.user as { userId: string }).userId;
  const { score, profile } = req.body as { score?: number; profile?: string };

  if (score == null || !profile) {
    res.status(400).json({ error: "score and profile are required" });
    return;
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { onboardingComplete: true, riskScore: score, riskProfile: profile },
      { new: true }
    );
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const token = signToken(user);
    res.json({ token, username: user.username, onboardingComplete: true, riskProfile: profile });
  } catch (err) {
    console.error("Onboarding error:", err);
    res.status(500).json({ error: "Server error during onboarding" });
  }
});
