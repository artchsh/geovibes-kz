import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@/db/client";

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "db/migrations") });
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  void runMigrations().finally(() => db.$client.end());
}