import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { query } from "../db/pool.js";

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
  };
}

passport.use(new LocalStrategy(
  { usernameField: "email", passwordField: "password" },
  async (email, password, done) => {
    try {
      const { rows } = await query("SELECT * FROM users WHERE email = $1", [String(email || "").toLowerCase()]);
      const user = rows[0];
      if (!user || !user.is_active) return done(null, false);

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return done(null, false);

      return done(null, publicUser(user));
    } catch (error) {
      return done(error);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await query("SELECT id, email, role, is_active FROM users WHERE id = $1", [id]);
    const user = publicUser(rows[0]);
    if (!user || !user.is_active) return done(null, false);
    return done(null, user);
  } catch (error) {
    return done(error);
  }
});

export { passport };
