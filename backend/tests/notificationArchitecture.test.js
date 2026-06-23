import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("notification production architecture", () => {
  it("keeps PostgreSQL persistence, recipients, retention, queue, and Redis fanout wired", () => {
    const migration = read("migrations/008_notification_recipients_retention.sql");
    const service = read("src/services/notificationService.js");
    const queue = read("src/services/notificationQueueService.js");
    const runtime = read("src/services/notificationRuntimeService.js");
    const env = read("src/config/env.js");
    const pkg = JSON.parse(read("package.json"));

    expect(migration).toContain("notification_recipients");
    expect(migration).toContain("archived_at");
    expect(migration).toContain("expires_at");
    expect(service).toContain("recipientUserIds");
    expect(service).toContain("notification_recipients");
    expect(service).toContain("archiveExpiredNotifications");
    expect(service).toContain("Redis notification fanout");
    expect(queue).toContain("new Queue");
    expect(queue).toContain("new Worker");
    expect(runtime).toContain("startNotificationFanoutSubscriber");
    expect(runtime).toContain("startNotificationWorker");
    expect(env).toContain("NOTIFICATIONS_QUEUE_ENABLED");
    expect(env).toContain("NOTIFICATIONS_REDIS_FANOUT_ENABLED");
    expect(pkg.dependencies).toHaveProperty("bullmq");
    expect(pkg.dependencies).toHaveProperty("ioredis");
  });
});
