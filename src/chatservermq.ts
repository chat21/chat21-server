#!/usr/bin/env node
import 'dotenv/config';
import * as observer from './observer';
import { logger } from './tiledesk-logger/index';
import type { ActiveQueues } from './types/index';

const { startServer } = observer;

let active_queues_env_string: string | null = null;

if (process.env.ACTIVE_QUEUES) {
  logger.debug("Found process.env.ACTIVE_QUEUES:", process.env.ACTIVE_QUEUES);
  if (process.env.ACTIVE_QUEUES.trim().toLowerCase() === "none") {
    active_queues_env_string = "none";
  } else {
    active_queues_env_string = process.env.ACTIVE_QUEUES;
  }
}

let active_queues: ActiveQueues = {};
const ALL_SUBSCRIPTIONS_TOPICS: ActiveQueues = {
  'messages': true,
  'persist': true
};

if (active_queues_env_string === null) {
  active_queues = { ...ALL_SUBSCRIPTIONS_TOPICS };
  logger.info("(Observer) ACTIVE_QUEUES unset. Using default (all: messages & persist):", active_queues);
} else if (active_queues_env_string === "none") {
  logger.error("(Observer) Not ACTIVE_QUEUES enabled. Going on anyway...");
  logger.error("(Observer) To activate queues use syntax: active_queues=messages,persist (valid topics: messages | persist | messages,persist)");
} else {
  const active_queues_env_array = active_queues_env_string.split(",");
  logger.info("(Observer) ACTIVE_QUEUES found:", active_queues_env_array);
  if (active_queues_env_array.length === 0) {
    logger.error("(Observer) Not ACTIVE_QUEUES enabled.");
    logger.error("(Observer) To activate queues use syntax: active_queues=messages,persist (valid topics: messages | persist | messages,persist)");
    process.exit(1);
  } else {
    active_queues_env_array.forEach((e) => {
      const topic = e.trim();
      if (!ALL_SUBSCRIPTIONS_TOPICS[topic]) {
        logger.error("Invalid subscription topic:", topic);
        logger.error("Use syntax: active_queues=messages,persist (valid topics: messages | persist | messages,persist)");
        process.exit(1);
      } else {
        active_queues[topic] = true;
      }
    });
  }
}

let webhook_enabled: boolean;
const webhook_enabled_env = process.env.WEBHOOK_ENABLED;
if (webhook_enabled_env === undefined || webhook_enabled_env === "true") {
  webhook_enabled = true;
} else {
  webhook_enabled = false;
}
logger.debug("webhook_enabled: " + webhook_enabled);

let webhook_endpoints_array: string[] | null = null;
const env_webhook_endpoints = process.env.WEBHOOK_ENDPOINTS;
if (env_webhook_endpoints) {
  webhook_endpoints_array = env_webhook_endpoints.split(/\s*[,]\s*/);
}
logger.debug("webhook_endpoints_array: ", webhook_endpoints_array);

let webhook_events_array: string[] | null = null;
if (process.env.WEBHOOK_EVENTS) {
  webhook_events_array = process.env.WEBHOOK_EVENTS.split(",");
}
logger.info("(Observer) webhook_events_array: ", webhook_events_array);

let presence_enabled = false;
logger.debug("process.env.PRESENCE_ENABLED:", process.env.PRESENCE_ENABLED);
if (process.env.PRESENCE_ENABLED && process.env.PRESENCE_ENABLED === "true") {
  presence_enabled = true;
  logger.debug("(Observer) Presence manager enabled.");
} else {
  logger.debug("(Observer) Presence manager disabled.");
}

const durable_enabled = true;

logger.info("Starting observer (DURABLE_ENABLED disabled)");

async function start(): Promise<void> {
  observer.setPresenceEnabled(presence_enabled);
  observer.setDurableEnabled(durable_enabled);
  observer.setWebHookEnabled(webhook_enabled);
  observer.setWebHookEndpoints(webhook_endpoints_array);
  observer.setWebHookEvents(webhook_events_array);
  observer.setActiveQueues(active_queues);
  if (process.env.PREFETCH_MESSAGES) {
    const prefetch = parseInt(process.env.PREFETCH_MESSAGES, 10);
    if (prefetch > 0) {
      logger.log("Set prefetch messages number:", prefetch);
      observer.setPrefetchMessages(prefetch);
    }
  } else {
    logger.log("Using default prefetch messages number.");
  }

  await startServer({
    app_id: process.env.APP_ID,
    exchange: 'amq.topic',
    rabbitmq_uri: process.env.RABBITMQ_URI,
    mongodb_uri: process.env.MONGODB_URI,
    redis_enabled: process.env.CACHE_ENABLED,
    redis_host: process.env.CACHE_REDIS_HOST,
    redis_port: process.env.CACHE_REDIS_PORT,
    redis_password: process.env.CACHE_REDIS_PASSWORD
  });
}

start();

export { observer };
