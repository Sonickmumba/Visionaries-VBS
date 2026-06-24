import { app } from "./app.js";
import { env } from "./config/env.js";
import { startNotificationRuntime } from "./services/notificationRuntimeService.js";

app.listen(env.port, () => {
  startNotificationRuntime().catch((error) => {
    console.warn(`Notification runtime startup failed: ${error.message}`);
  });
  console.log(`Visionaries Village Banking API running on http://localhost:${env.port}`);
});
