import { Queue, Worker } from "bullmq";
import { env } from "../config/env.js";
import { query } from "../db/pool.js";
import { publishActivityNotification } from "./notificationService.js";
import { getRedisCommandConnection, redisEnabled } from "./redisService.js";

const QUEUE_NAME = "visionaries-notifications";
let queue = null;
let worker = null;

export function notificationQueueEnabled() {
  return env.notificationsQueueEnabled && redisEnabled();
}

function getQueue() {
  if (!notificationQueueEnabled()) return null;
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedisCommandConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return queue;
}

export async function addNotificationJob(input) {
  const activeQueue = getQueue();
  if (!activeQueue) return false;
  await activeQueue.add("publish-activity", input);
  return true;
}

export function startNotificationWorker() {
  if (!notificationQueueEnabled() || worker) return null;
  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await publishActivityNotification(query, job.data);
    },
    {
      connection: getRedisCommandConnection(),
      concurrency: 5,
    }
  );
  worker.on("failed", (job, error) => {
    console.warn(`Notification job ${job?.id || "unknown"} failed: ${error.message}`);
  });
  return worker;
}

export async function closeNotificationQueue() {
  await Promise.allSettled([worker?.close(), queue?.close()].filter(Boolean));
  worker = null;
  queue = null;
}
