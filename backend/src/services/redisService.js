import IORedis from "ioredis";
import { env } from "../config/env.js";

let commandConnection = null;
let subscriberConnection = null;
let publisherConnection = null;
let queueConnection = null;
let redisAvailable = null;

export function redisEnabled() {
  return Boolean(env.redisUrl) && redisAvailable !== false;
}

function createRedisConnection(role) {
  if (!redisEnabled()) return null;
  const connection = new IORedis(env.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: role === "queue" ? null : 2,
    enableReadyCheck: false,
  });
  connection.on("error", (error) => {
    console.warn(`Redis ${role} connection error: ${error.message}`);
  });
  return connection;
}

export async function probeRedisAvailability() {
  if (!env.redisUrl) {
    redisAvailable = false;
    return false;
  }
  const probe = new IORedis(env.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    enableReadyCheck: false,
  });
  try {
    await probe.connect();
    await probe.ping();
    redisAvailable = true;
    return true;
  } catch (error) {
    redisAvailable = false;
    console.warn(`Redis unavailable; notification queue/fanout disabled for this process: ${error.code || error.message}`);
    return false;
  } finally {
    await probe.quit().catch(() => probe.disconnect());
  }
}

export function getRedisCommandConnection() {
  if (!commandConnection) commandConnection = createRedisConnection("command");
  return commandConnection;
}

export function getRedisSubscriberConnection() {
  if (!subscriberConnection) subscriberConnection = createRedisConnection("subscriber");
  return subscriberConnection;
}

export function getRedisPublisherConnection() {
  if (!publisherConnection) publisherConnection = createRedisConnection("publisher");
  return publisherConnection;
}

export function getRedisQueueConnection() {
  if (!queueConnection) queueConnection = createRedisConnection("queue");
  return queueConnection;
}

export async function closeRedisConnections() {
  await Promise.allSettled([commandConnection, subscriberConnection, publisherConnection, queueConnection].filter(Boolean).map((connection) => connection.quit()));
  commandConnection = null;
  subscriberConnection = null;
  publisherConnection = null;
  queueConnection = null;
}
