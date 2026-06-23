import { app } from "./app.js";
import { env } from "./config/env.js";
import { startNotificationRuntime } from "./services/notificationRuntimeService.js";

app.listen(env.port, () => {
  startNotificationRuntime();
  console.log(`Visionaries Village Banking API running on http://localhost:${env.port}`);
});
