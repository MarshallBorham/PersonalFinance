import mongoose, { Schema, Document } from "mongoose";

interface ILineItem {
  name:   string;
  amount: number;
}

export interface INetWorthSnapshot extends Document {
  userId:      mongoose.Types.ObjectId;
  date:        Date;
  assets:      ILineItem[];
  liabilities: ILineItem[];
  netWorth:    number;
}

const lineItemSchema = new Schema<ILineItem>({ name: String, amount: Number }, { _id: false });

const netWorthSnapshotSchema = new Schema<INetWorthSnapshot>({
  userId:      { type: Schema.Types.ObjectId, ref: "User", required: true },
  date:        { type: Date, default: Date.now },
  assets:      [lineItemSchema],
  liabilities: [lineItemSchema],
  netWorth:    { type: Number, default: 0 },
});

netWorthSnapshotSchema.pre("save", function () {
  const totalAssets      = this.assets.reduce((s, a) => s + a.amount, 0);
  const totalLiabilities = this.liabilities.reduce((s, l) => s + l.amount, 0);
  this.netWorth = totalAssets - totalLiabilities;
});

export const NetWorthSnapshot = mongoose.model<INetWorthSnapshot>("NetWorthSnapshot", netWorthSnapshotSchema);
