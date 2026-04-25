import dotenv from "dotenv";
dotenv.config();

export function getEnvVar(name: string, required = true): string | undefined {
  const val = process.env[name];
  if (required && !val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}
