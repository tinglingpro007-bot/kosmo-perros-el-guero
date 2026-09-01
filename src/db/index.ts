import { openDatabase } from "./client";

const rawPath = process.env.DATABASE_URL || process.env.DATABASE_PATH || "sqlite.db";
const dbPath = rawPath.replace(/^file:\/\//, "").replace(/^file:/, "");

export const db = openDatabase(dbPath);

export { openDatabase } from "./client";
export type { Db } from "./client";
