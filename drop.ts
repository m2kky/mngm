import { sql } from 'drizzle-orm';
import { db } from './server/db';

async function run() {
  await db.execute(sql`DROP TABLE IF EXISTS project_stages CASCADE`);
  console.log('Dropped project_stages table');
  process.exit(0);
}

run().catch(console.error);
