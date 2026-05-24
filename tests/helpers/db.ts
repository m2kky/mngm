import { db } from "../../server/db";
import { sql } from "drizzle-orm";

export async function resetDatabase() {
  // Clean all main data tables - CASCADE handles the dependencies
  // In a robust implementation, you might dynamically discover tables
  const tables = [
    "time_entries",
    "task_comments",
    "subtasks",
    "task_assignees",
    "tasks",
    "project_stages",
    "project_members",
    "projects",
    "clients",
    "invitations",
    "users",
    "agencies",
  ];
  
  // Note: Only run this on test databases
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resetDatabase should only be called in a test environment!");
  }

  for (const table of tables) {
    try {
      await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE;`));
    } catch (e) {
      console.error(`Failed to truncate ${table}`, e);
    }
  }
}
