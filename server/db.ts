import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

if (!pool) {
  console.warn("DATABASE_URL is not set — DatabaseStorage will not be available.");
}

export const db = pool
  ? drizzle({ client: pool, schema })
  : (null as unknown as ReturnType<typeof drizzle>);
