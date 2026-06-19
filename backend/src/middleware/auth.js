import { forbidden, unauthorized } from "../utils/httpError.js";

export async function requireAuth(req, res, next) {
  try {
    if (!req.isAuthenticated?.() || !req.user?.is_active) throw unauthorized();
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
