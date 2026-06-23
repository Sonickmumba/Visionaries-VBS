import { env } from "../config/env.js";
import { query } from "../db/pool.js";
import { archiveExpiredNotifications, startNotificationFanoutSubscriber } from "./notificationService.js";
import { startNotificationWorker } from "./notificationQueueService.js";

let maintenanceTimer = null;

export function startNotificationRuntime() {
  startNotificationFanoutSubscriber();
  startNotificationWorker();
  archiveExpiredNotifications(query).catch((error) => {
    console.warn(`Notification archive startup maintenance failed: ${error.message}`);
  });

  if (!maintenanceTimer && env.notificationMaintenanceIntervalMs > 0) {
    maintenanceTimer = setInterval(() => {
      archiveExpiredNotifications(query).catch((error) => {
        console.warn(`Notification archive maintenance failed: ${error.message}`);
      });
    }, env.notificationMaintenanceIntervalMs);
    maintenanceTimer.unref?.();
  }
}

export function stopNotificationRuntime() {
  if (maintenanceTimer) clearInterval(maintenanceTimer);
  maintenanceTimer = null;
}
