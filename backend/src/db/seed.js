import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = (await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ('admin@example.com',$1,'ADMIN')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING *`,
    [passwordHash]
  )).rows[0];

  const maryUser = (await pool.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ('mary@example.com',$1,'MEMBER')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING *`,
    [passwordHash]
  )).rows[0];

  const mary = (await pool.query(
    `INSERT INTO members (user_id, member_code, first_name, last_name, phone)
     VALUES ($1,'MBR-001','Mary','Phiri','+260970000001')
     ON CONFLICT (member_code) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING *`,
    [maryUser.id]
  )).rows[0];

  const demoMembers = [
    ["MBR-002", "Agnes", "Banda"],
    ["MBR-003", "Thandi", "Mwansa"],
    ["MBR-004", "Linda", "Tembo"],
    ["MBR-005", "Nancy", "Chanda"],
  ];

  const members = [mary];
  for (const [code, first, last] of demoMembers) {
    const member = (await pool.query(
      `INSERT INTO members (member_code, first_name, last_name)
       VALUES ($1,$2,$3)
       ON CONFLICT (member_code) DO UPDATE SET first_name = EXCLUDED.first_name
       RETURNING *`,
      [code, first, last]
    )).rows[0];
    members.push(member);
  }

  const cycle = (await pool.query(
    `INSERT INTO cycles
      (name, description, start_date, end_date, status, savings_cap, minimum_borrowing_amount,
       savings_interest_rate, loan_interest_rate, common_interest_rate, social_fund_amount,
       membership_fee_amount, declaration_start_day, declaration_end_day, payout_start_day, payout_end_day, created_by)
     VALUES
      ('2026 Main Cycle','Demo village banking cycle','2026-01-01','2026-12-31','ACTIVE',30000,20000,
       0.15,0.15,0.15,240,80,28,3,4,5,$1)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [admin.id]
  )).rows[0] || (await pool.query("SELECT * FROM cycles WHERE name = '2026 Main Cycle'")).rows[0];

  await pool.query(
    `INSERT INTO penalty_types (cycle_id, code, name, amount, is_convertible_to_loan)
     VALUES ($1,'FAILURE_TO_DECLARE','Failure to Declare',100,true)
     ON CONFLICT (cycle_id, code) DO UPDATE SET amount = EXCLUDED.amount`,
    [cycle.id]
  );

  for (let i = 0; i < 12; i += 1) {
    const monthNumber = i + 1;
    const periodStart = new Date(2026, i, 1);
    const periodEnd = new Date(2026, i + 1, 0);
    const declarationStart = new Date(2026, i, 28);
    const declarationEnd = new Date(2026, i + 1, 3);
    const payoutStart = new Date(2026, i, 4);
    const payoutEnd = new Date(2026, i, 5);
    await pool.query(
      `INSERT INTO cycle_months
        (cycle_id, month_number, period_start, period_end, declaration_window_start, declaration_window_end, payout_window_start, payout_window_end, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (cycle_id, month_number) DO NOTHING`,
      [cycle.id, monthNumber, periodStart, periodEnd, declarationStart, declarationEnd, payoutStart, payoutEnd, monthNumber === 3 ? "DECLARATION_PERIOD" : "OPEN"]
    );
  }

  for (const member of members) {
    await pool.query(
      `INSERT INTO cycle_members (cycle_id, member_id, joined_at)
       VALUES ($1,$2,'2026-01-01')
       ON CONFLICT (cycle_id, member_id) DO NOTHING`,
      [cycle.id, member.id]
    );
  }

  console.log("Seed complete");
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
