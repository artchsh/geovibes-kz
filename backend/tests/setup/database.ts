import { Pool } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "@/db/client";

function testDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error("TEST_DATABASE_URL is required to reset the test database");
  const databaseName = new URL(value).pathname.slice(1);
  if (!databaseName.endsWith("_test")) {
    throw new Error("Refusing to reset a database whose name does not end in _test");
  }
  return value;
}

export async function resetTestDatabase(): Promise<void> {
  const connectionString = testDatabaseUrl();
  const sqlClient = new Pool({ connectionString });
  try {
    await sqlClient.query("drop schema if exists public cascade");
    await sqlClient.query("drop schema if exists drizzle cascade");
    await sqlClient.query("create schema public");
    await migrate(db, { migrationsFolder: "./db/migrations" });
  } finally {
    await sqlClient.end();
  }
}