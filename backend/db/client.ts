import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

const client = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? env.DATABASE_URL });

export const db = drizzle({ client, schema });