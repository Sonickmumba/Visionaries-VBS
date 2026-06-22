import express from "express";
import { requireAuth } from "../../middleware/auth.js";
import { recentNotifications, streamNotifications } from "../../services/notificationService.js";

export const notificationsRouter = express.Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get("/", (req, res) => {
  res.json({ data: recentNotifications({ limit: req.query.limit }) });
});

notificationsRouter.get("/stream", (req, res) => {
  streamNotifications(req, res);
});
