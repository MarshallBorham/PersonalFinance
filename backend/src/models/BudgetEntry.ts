import mongoose, { Schema, Document } from "mongoose";

export interface IBudgetEntry extends Document {
  userId:      mongoose.Types.ObjectId;
  month:       string;
  category:    string;
  type:        "income" | "expense";
  amount:      number;
  description: string;
  createdAt:   Date;
}

const budgetEntrySchema = new Schema<IBudgetEntry>({
  userId:      { type: Schema.Types.ObjectId, ref: "User", required: true },
  month:       { type: String, required: true },
  category:    { type: String, required: true },
  type:        { type: String, enum: ["income", "expense"], required: true },
  amount:      { type: Number, required: true, min: 0 },
  description: { type: String, default: "" },
  createdAt:   { type: Date, default: Date.now },
});

export const BudgetEntry = mongoose.model<IBudgetEntry>("BudgetEntry", budgetEntrySchema);
