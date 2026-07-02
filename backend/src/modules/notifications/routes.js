import express from "express";
import { z } from "zod";
import { query } from "../../db/pool.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { archiveExpiredNotifications, countUnreadNotifications, listNotifications, markNotificationsRead, streamNotifications } from "../../services/notificationService.js";

export const notificationsRouter = express.Router();
notificationsRouter.use(requireAuth);

const readReceiptSchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1).max(100),
});

notificationsRouter.get("/", async (req, res, next) => {
  try {
    const result = await listNotifications(query, {
      user: req.user,
      limit: req.query.limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get("/unread-count", async (req, res, next) => {
  try {
    const unreadCount = await countUnreadNotifications(query, { user: req.user });
    res.json({ unreadCount });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get("/stream", (req, res) => {
  streamNotifications(req, res, query);
});

notificationsRouter.post("/read", validate(readReceiptSchema), async (req, res, next) => {
  try {
    const result = await markNotificationsRead(query, {
      userId: req.user.id,
      notificationIds: req.body.notificationIds,
    });
    const unreadCount = await countUnreadNotifications(query, { user: req.user });
    res.json({ ...result, unreadCount });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/archive-expired", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const result = await archiveExpiredNotifications(query, {
      reason: req.body?.reason || "Manual retention archive",
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});
