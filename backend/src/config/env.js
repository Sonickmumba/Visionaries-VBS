import dotenv from "dotenv";

dotenv.config();

const DEFAULT_SESSION_SECRET = "dev-session-secret-change-me";

export const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/village_banking",
  sessionSecret: process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET,
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "vb_sid",
  sessionMaxAgeMs: Number(process.env.SESSION_MAX_AGE_MS || 8 * 60 * 60 * 1000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  requestSizeLimit: process.env.REQUEST_SIZE_LIMIT || "512kb",
  authRateLimitWindowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  cloudinaryProofFolder: process.env.CLOUDINARY_PROOF_FOLDER || "village-banking/payment-proofs",
  paymentProofMaxBytes: Number(process.env.PAYMENT_PROOF_MAX_BYTES || 5 * 1024 * 1024),
  nodeEnv: process.env.NODE_ENV || "development",
  redisUrl: process.env.REDIS_URL || "",
  notificationsQueueEnabled: process.env.NOTIFICATIONS_QUEUE_ENABLED === "true",
  notificationsRedisFanoutEnabled: process.env.NOTIFICATIONS_REDIS_FANOUT_ENABLED === "true",
  notificationRetentionDays: Number(process.env.NOTIFICATION_RETENTION_DAYS || 730),
  notificationMaintenanceIntervalMs: Number(process.env.NOTIFICATION_MAINTENANCE_INTERVAL_MS || 60 * 60 * 1000),
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "Visionaries Village Banking <onboarding@resend.dev>",
  emailDevFallback: process.env.EMAIL_DEV_FALLBACK === "true",
  emailVerificationTtlHours: Number(process.env.EMAIL_VERIFICATION_TTL_HOURS || 24),
  invitationTtlHours: Number(process.env.INVITATION_TTL_HOURS || 72),
  adminMfaRequired: process.env.ADMIN_MFA_REQUIRED === "true",
  adminMfaTtlMinutes: Number(process.env.ADMIN_MFA_TTL_MINUTES || 10),
};

export function validateProductionEnv(config = env, rawEnv = process.env) {
  if (config.nodeEnv !== "production") return;

  const errors = [];
  if (!rawEnv.DATABASE_URL) errors.push("DATABASE_URL is required in production.");
  if (!rawEnv.FRONTEND_ORIGIN) errors.push("FRONTEND_ORIGIN is required in production.");
  if (config.frontendOrigin.includes("localhost") || config.frontendOrigin.includes("127.0.0.1")) {
    errors.push("FRONTEND_ORIGIN must not be localhost in production.");
  }
  if (!rawEnv.SESSION_SECRET || config.sessionSecret === DEFAULT_SESSION_SECRET || config.sessionSecret.length < 32) {
    errors.push("SESSION_SECRET must be set to at least 32 characters in production.");
  }
  if (config.emailDevFallback) errors.push("EMAIL_DEV_FALLBACK must be disabled in production.");
  if (!config.resendApiKey) errors.push("RESEND_API_KEY is required in production for verification and invitation emails.");
  if (!config.emailFrom || config.emailFrom.includes("@resend.dev")) {
    errors.push("EMAIL_FROM must use a verified production sender domain.");
  }
  if (config.adminMfaRequired && !config.resendApiKey) {
    errors.push("RESEND_API_KEY is required when ADMIN_MFA_REQUIRED is enabled.");
  }
  if (!config.cloudinaryCloudName || !config.cloudinaryApiKey || !config.cloudinaryApiSecret) {
    errors.push("Cloudinary credentials are required in production for payment proof verification.");
  }
  if ((config.notificationsQueueEnabled || config.notificationsRedisFanoutEnabled) && !config.redisUrl) {
    errors.push("REDIS_URL is required when Redis-backed notification features are enabled.");
  }

  if (errors.length) {
    throw new Error(`Invalid production configuration:\n- ${errors.join("\n- ")}`);
  }
}

validateProductionEnv();
