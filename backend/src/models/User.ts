import mongoose, { Schema, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  createdAt: Date;
  verifyPassword(password: string): Promise<boolean>;
}

interface IUserModel extends Model<IUser> {
  hashPassword(password: string): Promise<string>;
}

const userSchema = new Schema<IUser>({
  username:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt:    { type: Date, default: Date.now },
});

userSchema.methods.verifyPassword = function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash as string);
};

userSchema.statics.hashPassword = function (password: string): Promise<string> {
  return bcrypt.hash(password, 10);
};

export const User = mongoose.model<IUser, IUserModel>("User", userSchema);
