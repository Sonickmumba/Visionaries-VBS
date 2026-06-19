import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

const PgSessionStore = connectPgSimple(session);

function sessionStore() {
  if (env.nodeEnv === "test") {
    return new session.MemoryStore();
  }
  return new PgSessionStore({
    pool,
    tableName: "user_sessions",
  });
}

export function sessionMiddleware() {
  return session({
    name: env.sessionCookieName,
    secret: env.sessionSecret,
    store: sessionStore(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: env.nodeEnv === "production" ? "lax" : "lax",
      maxAge: env.sessionMaxAgeMs,
    },
  });
}
