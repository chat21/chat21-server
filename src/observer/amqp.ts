/**
 * AMQP connection management for the observer.
 * Handles connect, publisher channel, worker channel, subscribe, and message dispatch.
 */
import amqp from 'amqplib/callback_api';
import { observerState } from './state';
import { work } from './handlers';
import { logger } from '../tiledesk-logger/index';

export function start(): Promise<{ conn: amqp.Connection; ch: amqp.ConfirmChannel }> {
  return new Promise(function (resolve, reject) {
    return startMQ(resolve, reject);
  });
}

export function startMQ(
  resolve: (value: { conn: amqp.Connection; ch: amqp.ConfirmChannel }) => void,
  reject: (reason?: unknown) => void,
  attempt = 0
): void {
  const autoRestart_val = process.env.AUTO_RESTART || observerState.autoRestartProperty;
  const autoRestart =
    autoRestart_val === undefined ||
    autoRestart_val === "true" ||
    autoRestart_val === true;

  const MAX_DELAY_MS = 30_000;
  const backoffDelay = Math.min(1000 * Math.pow(2, attempt), MAX_DELAY_MS);

  logger.debug("(Observer) Connecting to RabbitMQ...");
  amqp.connect(observerState.rabbitmq_uri, (err, conn) => {
    if (err) {
      logger.error("[Observer AMQP] connection error:", err.message);
      if (autoRestart) {
        logger.error(`[Observer AMQP] reconnecting in ${backoffDelay}ms (attempt ${attempt + 1})`);
        return setTimeout(() => { startMQ(resolve, reject, attempt + 1); }, backoffDelay);
      } else {
        process.exit(1);
      }
    }
    conn.on("error", (err: Error) => {
      if (err.message !== "Connection closing") {
        logger.error("[Observer AMQP] conn error:", err.message);
        return reject(err);
      }
    });
    conn.on("close", () => {
      logger.info("[Observer AMQP] close");
      if (autoRestart) {
        logger.info("[Observer AMQP] reconnecting because of a disconnection (Autorestart = true)");
        return setTimeout(() => { startMQ(resolve, reject, 0); }, 1000);
      } else {
        logger.info("[Observer AMQP] close event. No action.");
      }
    });
    observerState.amqpConn = conn;
    whenConnected().then(function (ch) {
      logger.debug("whenConnected() returned");
      return resolve({ conn: conn, ch: ch });
    });
  });
}

async function whenConnected(): Promise<amqp.ConfirmChannel> {
  const ch = await startPublisher();
  startWorker();
  return ch;
}

export function startPublisher(): Promise<amqp.ConfirmChannel> {
  return new Promise(function (resolve, reject) {
    observerState.amqpConn!.createConfirmChannel((err, ch) => {
      if (closeOnErr(err)) return;
      ch.on("error", function (err: Error) {
        logger.error("[AMQP] publisher channel error:", err.message);
        process.exit(0);
      });
      ch.on("close", function () {
        logger.debug("[AMQP] publisher channel closed");
      });
      observerState.pubChannel = ch;
      return resolve(ch);
    });
  });
}

export function startWorker(): void {
  observerState.amqpConn!.createChannel(function (err, ch) {
    observerState.channel = ch;
    if (closeOnErr(err)) return;
    const sharedQueueOptions = {
      durable: true,
      exclusive: false,
      autoDelete: false
    };
    ch.on("error", function (err: Error) {
      logger.error("[AMQP] worker channel error:", err.message);
      process.exit(0);
    });
    ch.on("close", function () {
      logger.debug("[AMQP] channel closed");
    });
    logger.info("(Observer) Prefetch messages:", observerState.prefetch_messages);
    ch.assertExchange(observerState.exchange, 'topic', {
      durable: observerState.durable_enabled
    });
    logger.info("(Observer) Enabling queues:", observerState.active_queues);
    if (observerState.active_queues['messages']) {
      ch.assertQueue("messages", sharedQueueOptions, function (err, _ok) {
        if (closeOnErr(err)) return;
        const queue = _ok.queue;
        logger.log("asserted queue:", queue);
        subscribeTo(observerState.topic_outgoing, ch, queue, observerState.exchange);
        subscribeTo(observerState.topic_update, ch, queue, observerState.exchange);
        subscribeTo(observerState.topic_archive, ch, queue, observerState.exchange);
        subscribeTo(observerState.topic_presence, ch, queue, observerState.exchange);
        subscribeTo(observerState.topic_update_group, ch, queue, observerState.exchange);
        subscribeTo(observerState.topic_delivered, ch, queue, observerState.exchange);
        ch.consume(queue, processMsg, { noAck: true });
      });
    }
    if (observerState.active_queues['persist']) {
      ch.assertQueue("persist", sharedQueueOptions, function (err, _ok) {
        if (closeOnErr(err)) return;
        const queue = _ok.queue;
        logger.log("asserted queue:", queue);
        subscribeTo(observerState.topic_persist, ch, queue, observerState.exchange);
        ch.consume(queue, processMsg, { noAck: true });
      });
    }
  });
}

function subscribeTo(
  topic: string,
  ch: amqp.Channel,
  queue: string,
  exchange: string
): void {
  ch.bindQueue(queue, exchange, topic, {}, function (err) {
    if (err) {
      logger.error("Error:", err, " binding on queue:", queue, "topic:", topic);
    } else {
      logger.info("binded queue: '" + queue + "' on topic: " + topic);
    }
  });
}

function processMsg(msg: amqp.Message | null): void {
  if (msg == null) {
    logger.error("Error. Msg is null. Stop job");
    return;
  }
  work(msg, function (_ok: boolean) {
    // noAck mode — no ack/reject needed
  });
}

export function closeOnErr(err: Error | null): boolean {
  if (!err) return false;
  logger.error("[AMQP] error:", err.message);
  observerState.amqpConn!.close();
  return true;
}
