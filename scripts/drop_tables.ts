import postgres from "postgres";

async function run() {
  const sql = postgres("postgresql://mngm_user:mngm_password@localhost:5432/mngm_db");
  console.log("Dropping tables...");
  try {
    await sql`DROP TABLE IF EXISTS task_template_properties CASCADE;`;
    await sql`DROP TABLE IF EXISTS task_property_values CASCADE;`;
    await sql`DROP TABLE IF EXISTS property_relations CASCADE;`;
    await sql`DROP TABLE IF EXISTS task_properties CASCADE;`;
    await sql`DROP TABLE IF EXISTS project_views CASCADE;`;
    console.log("Success.");
  } catch(e) {
    console.error(e);
  } finally {
    await sql.end();
  }
}
run();
