import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/village_banking",
  sessionSecret: process.env.SESSION_SECRET || "dev-session-secret-change-me",
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
  emailVerificationTtlHours: Number(process.env.EMAIL_VERIFICATION_TTL_HOURS || 24),
  invitationTtlHours: Number(process.env.INVITATION_TTL_HOURS || 72),
};
