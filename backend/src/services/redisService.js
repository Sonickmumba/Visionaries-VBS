import IORedis from "ioredis";
import { env } from "../config/env.js";

let commandConnection = null;
let subscriberConnection = null;
let publisherConnection = null;

export function redisEnabled() {
  return Boolean(env.redisUrl);
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

export async function closeRedisConnections() {
  await Promise.allSettled([commandConnection, subscriberConnection, publisherConnection].filter(Boolean).map((connection) => connection.quit()));
  commandConnection = null;
  subscriberConnection = null;
  publisherConnection = null;
}
