import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { query } from "../db/pool.js";
import { forbidden, unauthorized } from "../utils/httpError.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw unauthorized();

    const payload = jwt.verify(token, env.jwtSecret);
    const { rows } = await query(
      "SELECT id, email, role, is_active FROM users WHERE id = $1",
      [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.is_active) throw unauthorized();
    req.user = user;
    next();
  } catch (error) {
    next(error.status ? error : unauthorized());
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(forbidden());
    }
    next();
  };
}
