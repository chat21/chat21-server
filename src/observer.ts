/**
 * Observer — core entry point.
 *
 * Initialises shared state, connects to MongoDB / Redis / RabbitMQ,
 * wires up the Webhooks module, and starts the Prometheus metrics endpoint.
 *
 * All message-routing logic lives in the observer/* submodules:
 *   observer/state.ts     — shared mutable state singleton
 *   observer/prometheus.ts — metric counter definitions
 *   observer/publish.ts   — AMQP publish helper
 *   observer/groups.ts    — group cache helpers
 *   observer/message.ts   — message delivery helpers
 *   observer/handlers.ts  — topic handlers + message router
 *   observer/amqp.ts      — AMQP connection management
 */
import mongodb from 'mongodb';
import express from 'express';
import bodyParser from 'body-parser';
import { ChatDB } from './chatdb/index';
import { Webhooks } from './webhooks/index';
import { TdCache } from './TdCache';
import RateManager from './services/RateManager';
import { logger } from './tiledesk-logger/index';
import type { ActiveQueues } from './types/index';
import { observerState } from './observer/state';
import { register } from './observer/prometheus';
import { start } from './observer/amqp';

console.log("(Observer) Log level:", process.env.LOG_LEVEL);
logger.setLog(process.env.LOG_LEVEL);

const app = express();
app.use(bodyParser.json());

// ─── Config setters / getters ────────────────────────────────────────────────

export function getWebhooks(): Webhooks | null {
  return observerState.webhooks;
}

export function getWebHookEnabled(): boolean {
  return observerState.webhook_enabled;
}

export function getWebHookEndpoints(): string[] | null | undefined {
  return observerState.webhook_endpoints_array;
}

export function getWebHookEvents(): string[] | null | undefined {
  return observerState.webhook_events_array;
}

export function setWebHookEnabled(enabled: boolean): void {
  observerState.webhook_enabled = enabled;
  if (observerState.webhooks) {
    observerState.webhooks.setWebHookEnabled(observerState.webhook_enabled);
  }
}

export function setWebHookEndpoints(endpoints: string[] | null | undefined): void {
  observerState.webhook_endpoints_array = endpoints;
  if (observerState.webhooks) {
    observerState.webhooks.setWebHookEndpoints(observerState.webhook_endpoints_array ?? null);
  }
}

export function setWebHookEvents(events: string[] | null | undefined): void {
  observerState.webhook_events_array = events;
  if (observerState.webhooks) {
    observerState.webhooks.setWebHookEvents(events ?? null);
  }
}

export function setPresenceEnabled(enabled: boolean): void {
  observerState.presence_enabled = enabled;
}

export function setDurableEnabled(enabled: boolean): void {
  observerState.durable_enabled = enabled;
}

export function setActiveQueues(queues: ActiveQueues): void {
  logger.log("active queues setting", queues);
  observerState.active_queues = queues;
}

export function setPrefetchMessages(prefetch: number): void {
  observerState.prefetch_messages = prefetch;
}

export function setAutoRestart(_autoRestart: boolean): void {
  observerState.autoRestartProperty = _autoRestart;
}

// ─── Server lifecycle ─────────────────────────────────────────────────────────

export interface ObserverStartConfig {
  app_id?: string;
  exchange?: string;
  rabbitmq_uri?: string;
  mongodb_uri?: string;
  redis_enabled?: boolean | string;
  redis_host?: string;
  redis_port?: number | string;
  redis_password?: string;
}

export async function startServer(config?: ObserverStartConfig): Promise<void> {
  if (!config) {
    config = {};
  }

  logger.debug("(Observer) webhook_enabled: " + observerState.webhook_enabled);
  logger.debug("(Observer) presence_enabled: " + observerState.presence_enabled);

  // Analytics config
  observerState.analytics_enabled = process.env.ANALYTICS_ENABLED === 'true';
  if (process.env.ANALYTICS_EXCHANGE) {
    observerState.analytics_exchange = process.env.ANALYTICS_EXCHANGE;
  }
  logger.info(`(Observer) analytics_enabled: ${observerState.analytics_enabled}, exchange: ${observerState.analytics_exchange}`);

  observerState.app_id = config.app_id || "tilechat";
  observerState.exchange = config.exchange || 'amq.topic';

  if (config.rabbitmq_uri) {
    observerState.rabbitmq_uri = config.rabbitmq_uri;
  } else if (process.env.RABBITMQ_URI) {
    observerState.rabbitmq_uri = process.env.RABBITMQ_URI;
  } else {
    throw new Error('please configure process.env.RABBITMQ_URI or use parameter config.rabbitmq_uri option.');
  }

  observerState.topic_outgoing = `apps.${observerState.app_id}.outgoing.users.*.messages.*.outgoing`;
  observerState.topic_update = `apps.${observerState.app_id}.users.#.update`;
  observerState.topic_archive = `apps.${observerState.app_id}.users.#.archive`;
  observerState.topic_presence = `apps.${observerState.app_id}.users.*.presence.*`;
  observerState.topic_persist = `apps.observer.${observerState.app_id}.users.*.messages.*.persist`;
  observerState.topic_delivered = `apps.observer.${observerState.app_id}.users.*.messages.*.delivered`;
  observerState.topic_update_group = `apps.observer.${observerState.app_id}.groups.update`;

  let mongouri: string | null = null;
  if (config.mongodb_uri) {
    mongouri = config.mongodb_uri;
  } else if (process.env.MONGODB_URI) {
    mongouri = process.env.MONGODB_URI;
  } else {
    throw new Error('please configure process.env.MONGODB_URI or use parameter config.mongodb_uri option.');
  }

  logger.debug("(Observer) connecting to mongodb:", mongouri);
  const client = await mongodb.MongoClient.connect(mongouri, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db();
  logger.debug("(Observer) Mongodb connected.");

  if (config.redis_enabled && (config.redis_enabled === "true" || config.redis_enabled === true)) {
    observerState.redis_enabled = true;
  } else {
    observerState.redis_enabled = false;
  }
  if (observerState.redis_enabled && config.redis_host && config.redis_port) {
    logger.info("(Observer) Redis enabled.");
    observerState.tdcache = new TdCache({
      host: config.redis_host,
      port: Number(config.redis_port),
      password: config.redis_password
    });
    await connectRedis();
    await startRateManager(observerState.tdcache!);
    logger.info("(Observer) Redis connected.");
  } else {
    logger.info("(Observer) Redis disabled.");
  }

  observerState.chatdb = new ChatDB({ database: db });
  try {
    if (observerState.webhook_enabled) {
      logger.info("(Observer) Starting webhooks...");
      observerState.webhooks = new Webhooks({
        appId: observerState.app_id,
        RABBITMQ_URI: observerState.rabbitmq_uri,
        exchange: observerState.exchange,
        webhook_endpoints: observerState.webhook_endpoints_array,
        webhook_events: observerState.webhook_events_array,
        queue_name: 'webhooks',
        durable_enabled: observerState.durable_enabled,
        prefetch_messages: observerState.prefetch_messages,
        logger: logger
      });
      observerState.webhooks.enabled = true;
      await observerState.webhooks.start();
    } else {
      logger.info("(Observer) Webhooks disabled.");
    }
  } catch (error) {
    logger.error("An error occurred initializing webhooks:", error);
  }

  if (observerState.presence_enabled) {
    logger.info("(Observer) Presence enabled.");
  } else {
    logger.info("(Observer) Presence disabled.");
  }

  app.get('/metrics', async (_req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (ex) {
      res.status(500).end(ex);
    }
  });

  const metrics_port = process.env.METRICS_PORT || 9090;
  app.listen(metrics_port, () => {
    logger.info(`(Observer) Prometheus metrics listening on port ${metrics_port}`);
  });

  logger.debug('(Observer) Starting AMQP connection....');
  await start();
  logger.debug("[Observer.AMQP] connected.");
  logger.debug("Observer started.");
}

async function connectRedis(): Promise<void> {
  if (observerState.tdcache) {
    try {
      await observerState.tdcache.connect();
    } catch (error) {
      observerState.tdcache = null;
      process.exit(1);
    }
  }
}

async function startRateManager(tdCache: TdCache): Promise<void> {
  observerState.rate_manager = new RateManager({ tdCache: tdCache });
}

export function stopServer(callback: () => void): void {
  observerState.amqpConn!.close(callback);
}

export { logger };
