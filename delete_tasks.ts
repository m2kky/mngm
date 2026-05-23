import { sql } from 'drizzle-orm';
import { db } from './server/db';

async function run() {
  await db.execute(sql`DELETE FROM tasks`);
  console.log('Tasks deleted');
  process.exit(0);
}

run().catch(console.error);
