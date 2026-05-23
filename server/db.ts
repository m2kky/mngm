import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@shared/schema";

const queryClient = process.env.DATABASE_URL 
  ? postgres(process.env.DATABASE_URL) 
  : null;

if (!queryClient) {
  console.warn("DATABASE_URL is not set — DatabaseStorage will not be available.");
}

export const db = queryClient
  ? drizzle(queryClient, { schema })
  : (null as unknown as ReturnType<typeof drizzle>);
