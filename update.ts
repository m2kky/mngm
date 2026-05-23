import { sql } from 'drizzle-orm';
import { db } from './server/db';

async function run() {
  await db.execute(sql`UPDATE tasks SET stage_id = NULL`);
  console.log('Tasks updated');
  process.exit(0);
}

run().catch(console.error);
