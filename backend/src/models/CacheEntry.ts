import mongoose, { Schema, Document } from "mongoose";

export interface ICacheEntry extends Document {
  type:      string;
  key:       string;
  data:      unknown;
  fetchedAt: number;
}

const cacheEntrySchema = new Schema<ICacheEntry>({
  type:      { type: String, required: true },
  key:       { type: String, required: true },
  data:      { type: Schema.Types.Mixed, required: true },
  fetchedAt: { type: Number, required: true },
});

cacheEntrySchema.index({ type: 1, key: 1 }, { unique: true });

export const CacheEntry = mongoose.model<ICacheEntry>("CacheEntry", cacheEntrySchema);
