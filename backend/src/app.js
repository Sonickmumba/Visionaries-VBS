import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { passport } from "./auth/passport.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { sanitizeInput } from "./middleware/sanitizeInput.js";
import { sessionMiddleware } from "./middleware/session.js";
import { authRouter } from "./modules/auth/routes.js";
import { cyclesRouter } from "./modules/cycles/routes.js";
import { membersRouter } from "./modules/members/routes.js";
import { declarationsRouter } from "./modules/declarations/routes.js";
import { savingsRouter } from "./modules/savings/routes.js";
import { contributionsRouter } from "./modules/contributions/routes.js";
import { loansRouter } from "./modules/loans/routes.js";
import { penaltiesRouter } from "./modules/penalties/routes.js";
import { commonInterestRouter } from "./modules/commonInterest/routes.js";
import { closingRouter } from "./modules/closing/routes.js";
import { reportsRouter } from "./modules/reports/routes.js";
import { ledgerRouter } from "./modules/ledger/routes.js";
import { auditRouter } from "./modules/audit/routes.js";
import { overridesRouter } from "./modules/overrides/routes.js";
import { settingsRouter } from "./modules/settings/routes.js";
import { notificationsRouter } from "./modules/notifications/routes.js";

export const app = express();

app.use(helmet());
if (env.nodeEnv === "production") app.set("trust proxy", 1);
const allowedOrigins = new Set([
  env.frontendOrigin,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: env.requestSizeLimit }));
app.use(sanitizeInput);
app.use(requestId);
app.use(morgan("dev"));
app.use(sessionMiddleware());
app.use(passport.initialize());
app.use(passport.session());

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), requestId: req.requestId });
});

app.use("/api/auth", authRouter);
app.use("/api/cycles", cyclesRouter);
app.use("/api/members", membersRouter);
app.use("/api/declarations", declarationsRouter);
app.use("/api/savings", savingsRouter);
app.use("/api/contributions", contributionsRouter);
app.use("/api/loans", loansRouter);
app.use("/api/penalties", penaltiesRouter);
app.use("/api/common-interest", commonInterestRouter);
app.use("/api/monthly-closing", closingRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/ledger", ledgerRouter);
app.use("/api/audit", auditRouter);
app.use("/api/overrides", overridesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/notifications", notificationsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
