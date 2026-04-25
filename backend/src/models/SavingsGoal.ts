import mongoose, { Schema, Document } from "mongoose";

export interface ISavingsGoal extends Document {
  userId:        mongoose.Types.ObjectId;
  name:          string;
  targetAmount:  number;
  currentAmount: number;
  deadline?:     Date;
  createdAt:     Date;
}

const savingsGoalSchema = new Schema<ISavingsGoal>({
  userId:        { type: Schema.Types.ObjectId, ref: "User", required: true },
  name:          { type: String, required: true },
  targetAmount:  { type: Number, required: true, min: 0 },
  currentAmount: { type: Number, default: 0, min: 0 },
  deadline:      { type: Date },
  createdAt:     { type: Date, default: Date.now },
});

export const SavingsGoal = mongoose.model<ISavingsGoal>("SavingsGoal", savingsGoalSchema);
