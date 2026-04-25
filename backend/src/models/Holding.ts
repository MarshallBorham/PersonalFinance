import mongoose, { Schema, Document } from "mongoose";

export interface IHolding extends Document {
  userId:       mongoose.Types.ObjectId;
  symbol:       string;
  name:         string;
  shares:       number;
  costBasis:    number;
  manualPrice?: number;
  createdAt:    Date;
}

const holdingSchema = new Schema<IHolding>({
  userId:      { type: Schema.Types.ObjectId, ref: "User", required: true },
  symbol:      { type: String, required: true, uppercase: true, trim: true },
  name:        { type: String, default: "" },
  shares:      { type: Number, required: true, min: 0 },
  costBasis:   { type: Number, default: 0, min: 0 },
  manualPrice: { type: Number },
  createdAt:   { type: Date, default: Date.now },
});

export const Holding = mongoose.model<IHolding>("Holding", holdingSchema);
