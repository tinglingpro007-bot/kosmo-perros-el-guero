import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";
import { seedIfEmpty } from "./seed";

export type Db = BetterSQLite3Database<typeof schema>;

const initializedPaths = new Set<string>();

export function openDatabase(dbPath: string): Db {
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });

  if (!initializedPaths.has(dbPath)) {
    initializedPaths.add(dbPath);
    try {
      migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    } catch (err) {
      // ponytail: `next build` evaluates a route in several worker processes that all
      // migrate the same DB file. The journal is idempotent within a process, but two
      // processes racing the DDL can surface "table already exists". Once tables exist,
      // skipping is safe; upgrade to a file lock if multi-process migration ever matters.
      if (!(err instanceof Error && /already exists/.test(err.message))) {
        throw err;
      }
    }
    seedIfEmpty(db);
  }

  return db;
}
