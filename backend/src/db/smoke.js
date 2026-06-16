import { pool } from "./pool.js";

async function count(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return Number(rows[0]?.count || 0);
}

async function main() {
  const [users, cycles, activeCycles, members, cycleMembers, months, penaltyTypes] = await Promise.all([
    count("SELECT COUNT(*) FROM users"),
    count("SELECT COUNT(*) FROM cycles"),
    count("SELECT COUNT(*) FROM cycles WHERE status = 'ACTIVE'"),
    count("SELECT COUNT(*) FROM members"),
    count("SELECT COUNT(*) FROM cycle_members"),
    count("SELECT COUNT(*) FROM cycle_months"),
    count("SELECT COUNT(*) FROM penalty_types"),
  ]);
  const admin = await count("SELECT COUNT(*) FROM users WHERE email = $1 AND role = 'ADMIN'", ["admin@example.com"]);
  const mary = await count("SELECT COUNT(*) FROM users WHERE email = $1 AND role = 'MEMBER'", ["mary@example.com"]);

  const checks = [
    ["users", users >= 2],
    ["admin demo login", admin === 1],
    ["mary demo login", mary === 1],
    ["cycles", cycles >= 1],
    ["active cycle", activeCycles >= 1],
    ["members", members >= 5],
    ["cycle memberships", cycleMembers >= 5],
    ["cycle months", months >= 12],
    ["penalty types", penaltyTypes >= 1],
  ];

  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length) {
    throw new Error(`Seed smoke failed: ${failed.map(([name]) => name).join(", ")}`);
  }

  console.log("Seed smoke passed");
  console.table({ users, cycles, activeCycles, members, cycleMembers, months, penaltyTypes });
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
