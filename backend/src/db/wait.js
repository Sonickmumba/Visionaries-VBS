import { pool } from "./pool.js";

const maxAttempts = Number(process.env.DB_WAIT_ATTEMPTS || 30);
const delayMs = Number(process.env.DB_WAIT_DELAY_MS || 1000);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      console.log("Database is ready");
      await pool.end();
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.log(`Waiting for database (${attempt}/${maxAttempts})`);
      await delay(delayMs);
    }
  }
}

main().catch(async (error) => {
  console.error("Database did not become ready");
  console.error(error);
  await pool.end();
  process.exit(1);
});
