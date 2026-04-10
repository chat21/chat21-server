import amqp from 'amqplib/callback_api';
import { ChatDB } from './chatdb/index';
import { v4 as uuidv4 } from 'uuid';
import mongodb from 'mongodb';
import express from 'express';
import bodyParser from 'body-parser';
import { Webhooks } from './webhooks/index';
import { TdCache } from './TdCache';
import RateManager from './services/RateManager';
import { logger } from './tiledesk-logger/index';
import MessageConstants from './models/messageConstants';
import prometheus from 'prom-client';
import type { ActiveQueues } from './types/index';

const register = prometheus.register;

const messagesProjectCounter = new prometheus.Counter({
  name: 'chat21_messages_per_project_total',
  help: 'Total number of messages per project',
  labelNames: ['project_id']
});

const messagesIPCounter = new prometheus.Counter({
  name: 'chat21_messages_per_ip_total',
  help: 'Total number of messages per IP address',
  labelNames: ['ip_address']
});

const messagesProjectIPCounter = new prometheus.Counter({
  name: 'chat21_messages_per_project_ip_total',
  help: 'Total number of messages per project and IP address',
  labelNames: ['project_id', 'ip_address']
});

const messagesTopicCounter = new prometheus.Counter({
  name: 'chat21_messages_per_topic_total',
  help: 'Total number of messages per topic',
  labelNames: ['topic']
});

console.log("(Observer) Log level:", process.env.LOG_LEVEL);
logger.setLog(process.env.LOG_LEVEL);

const app = express();
app.use(bodyParser.json());

let amqpConn: amqp.Connection | null = null;
let exchange: string;
let app_id: string;
let tdcache: TdCache | null;
let topic_outgoing: string;
let topic_update: string;
let topic_archive: string;
let topic_presence: string;
let topic_persist: string;
let topic_delivered: string;
let topic_update_group: string;
let chatdb: ChatDB;
let webhooks: Webhooks | null;
let webhook_enabled = false;
let presence_enabled = false;
let durable_enabled: boolean;
let redis_enabled = false;
let autoRestartProperty: boolean | undefined;
let rate_manager: RateManager | null = null;
let rabbitmq_uri: string;

// webhook_enabled defaults to true (unless explicitly set to false)
webhook_enabled = true;

let active_queues: ActiveQueues = {
  'messages': true,
  'persist': true
};

let webhook_endpoints_array: string[] | null | undefined;
let webhook_events_array: string[] | null | undefined;

export function getWebhooks(): Webhooks | null {
  return webhooks;
}

export function getWebHookEnabled(): boolean {
  return webhook_enabled;
}

export function getWebHookEndpoints(): string[] | null | undefined {
  return webhook_endpoints_array;
}

export function getWebHookEvents(): string[] | null | undefined {
  return webhook_events_array;
}

export function setWebHookEnabled(enabled: boolean): void {
  webhook_enabled = enabled;
  if (webhooks) {
    webhooks.setWebHookEnabled(webhook_enabled);
  }
}

export function setWebHookEndpoints(endpoints: string[] | null | undefined): void {
  webhook_endpoints_array = endpoints;
  if (webhooks) {
    webhooks.setWebHookEndpoints(webhook_endpoints_array ?? null);
  }
}

export function setWebHookEvents(events: string[] | null | undefined): void {
  webhook_events_array = events;
  if (webhooks) {
    webhooks.setWebHookEvents(events ?? null);
  }
}

export function setPresenceEnabled(enabled: boolean): void {
  presence_enabled = enabled;
}

export function setDurableEnabled(enabled: boolean): void {
  durable_enabled = enabled;
}

export function setActiveQueues(queues: ActiveQueues): void {
  logger.log("active queues setting", queues);
  active_queues = queues;
}

let prefetch_messages = 10;
export function setPrefetchMessages(prefetch: number): void {
  prefetch_messages = prefetch;
}

export function setAutoRestart(_autoRestart: boolean): void {
  autoRestartProperty = _autoRestart;
}

function start(): Promise<{ conn: amqp.Connection; ch: amqp.ConfirmChannel }> {
  return new Promise(function (resolve, reject) {
    return startMQ(resolve, reject);
  });
}

function startMQ(
  resolve: (value: { conn: amqp.Connection; ch: amqp.ConfirmChannel }) => void,
  reject: (reason?: unknown) => void
): void {
  const autoRestart_val = process.env.AUTO_RESTART || autoRestartProperty;
  const autoRestart =
    autoRestart_val === undefined ||
    autoRestart_val === "true" ||
    autoRestart_val === true;

  logger.debug("(Observer) Connecting to RabbitMQ...");
  amqp.connect(rabbitmq_uri, (err, conn) => {
    if (err) {
      logger.error("[Observer AMQP]", err);
      if (autoRestart) {
        logger.error("[Observer AMQP] reconnecting");
        return setTimeout(() => { startMQ(resolve, reject); }, 1000);
      } else {
        process.exit(1);
      }
    }
    conn.on("error", (err: Error) => {
      if (err.message !== "Connection closing") {
        logger.error("[Observer AMQP] conn error", err);
        return reject(err);
      }
    });
    conn.on("close", () => {
      logger.info("[Observer AMQP] close");
      if (autoRestart) {
        logger.info("[Observer AMQP] reconnecting because of a disconnection (Autorestart = true)");
        return setTimeout(() => { startMQ(resolve, reject); }, 1000);
      } else {
        logger.info("[Observer AMQP] close event. No action.");
      }
    });
    amqpConn = conn;
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

let pubChannel: amqp.ConfirmChannel | null = null;
const offlinePubQueue: Array<[string, string, Buffer]> = [];

function startPublisher(): Promise<amqp.ConfirmChannel> {
  return new Promise(function (resolve, reject) {
    amqpConn!.createConfirmChannel((err, ch) => {
      if (closeOnErr(err)) return;
      ch.on("error", function (err: Error) {
        logger.error("[AMQP] channel error", err);
        process.exit(0);
      });
      ch.on("close", function () {
        logger.debug("[AMQP] channel closed");
      });
      pubChannel = ch;
      return resolve(ch);
    });
  });
}

function publish(
  exchange: string,
  routingKey: string,
  content: Buffer,
  callback: (err: Error | null) => void
): void {
  logger.debug("[AMQP] publish routingKey:", routingKey);
  if (routingKey.length > 255) {
    logger.error("routingKey invalid length (> 255). Publish canceled.", routingKey.length);
    callback(null);
    return;
  }
  try {
    pubChannel!.publish(exchange, routingKey, content, { persistent: true },
      function (err) {
        if (err) {
          logger.error("[AMQP] publish error:", err);
          offlinePubQueue.push([exchange, routingKey, content]);
          pubChannel!.connection.close();
          callback(err);
        } else {
          callback(null);
        }
      });
  } catch (e) {
    logger.error("[AMQP] publish", (e as Error).message);
    offlinePubQueue.push([exchange, routingKey, content]);
    callback(e as Error);
  }
}

let channel: amqp.Channel;
function startWorker(): void {
  amqpConn!.createChannel(function (err, ch) {
    channel = ch;
    if (closeOnErr(err)) return;
    const sharedQueueOptions = {
      durable: true,
      exclusive: false,
      autoDelete: false
    };
    ch.on("error", function (err: Error) {
      logger.error("[AMQP] channel error", err);
      process.exit(0);
    });
    ch.on("close", function () {
      logger.debug("[AMQP] channel closed");
    });
    logger.info("(Observer) Prefetch messages:", prefetch_messages);
    ch.assertExchange(exchange, 'topic', {
      durable: durable_enabled
    });
    logger.info("(Observer) Enabling queues:", active_queues);
    if (active_queues['messages']) {
      ch.assertQueue("messages", sharedQueueOptions, function (err, _ok) {
        if (closeOnErr(err)) return;
        const queue = _ok.queue;
        logger.log("asserted queue:", queue);
        subscribeTo(topic_outgoing, ch, queue, exchange);
        subscribeTo(topic_update, ch, queue, exchange);
        subscribeTo(topic_archive, ch, queue, exchange);
        subscribeTo(topic_presence, ch, queue, exchange);
        subscribeTo(topic_update_group, ch, queue, exchange);
        subscribeTo(topic_delivered, ch, queue, exchange);
        ch.consume(queue, processMsg, { noAck: true });
      });
    }
    if (active_queues['persist']) {
      ch.assertQueue("persist", sharedQueueOptions, function (err, _ok) {
        if (closeOnErr(err)) return;
        const queue = _ok.queue;
        logger.log("asserted queue:", queue);
        subscribeTo(topic_persist, ch, queue, exchange);
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

function work(msg: amqp.Message, callback: (ok: boolean) => void): void {
  if (!msg) {
    logger.error("Error. Work Message is empty. Removing this job with ack=ok.", msg);
    callback(true);
    return;
  }
  logger.debug("work NEW TOPIC (v0.2.48): " + msg.fields.routingKey);
  const topic = msg.fields.routingKey;
  const message_string = msg.content.toString();
  if (topic.endsWith('.outgoing')) {
    process_outgoing(topic, message_string, callback);
  } else if (topic.endsWith('.persist')) {
    process_persist(topic, message_string, callback);
  } else if (topic.endsWith('.delivered')) {
    process_delivered(topic, message_string, callback);
  } else if (topic.endsWith('.archive')) {
    logger.log("Got presence topic:", topic);
    process_archive(topic, message_string, callback);
  } else if (topic.includes('.presence.')) {
    process_presence(topic, message_string, callback);
  } else if (topic.endsWith('.groups.update')) {
    process_update_group(topic, message_string, callback);
  } else if (topic.endsWith('.update')) {
    process_update(topic, message_string, callback);
  } else {
    logger.error("unhandled topic:", topic);
    callback(true);
  }
}

// ***** TOPIC HANDLERS ******/

function process_presence(topic: string, message_string: string, callback: (ok: boolean) => void): void {
  callback(true);
  if (!presence_enabled) {
    logger.log("Presence disabled");
    return;
  }
  logger.debug("> got PRESENCE testament", message_string, " on topic", topic);
  if (!webhook_enabled) {
    logger.debug("WEBHOOKS DISABLED. Skipping presence notification");
    return;
  }
  const topic_parts = topic.split(".");
  const pres_app_id = topic_parts[1];
  const user_id = topic_parts[3];
  const presence_payload = JSON.parse(message_string);
  logger.debug("presence_payload:", presence_payload);
  const presence_status = presence_payload.connected ? "online" : "offline";
  logger.debug("presence_status:", presence_status);
  const presence_event = {
    "event_type": "presence-change",
    "presence": presence_status,
    "createdAt": new Date().getTime(),
    "app_id": pres_app_id,
    "user_id": user_id,
    "data": true,
    temp_webhook_endpoints: webhook_endpoints_array
  };
  const presence_event_string = JSON.stringify(presence_event);
  const presence_webhook_topic = `observer.webhook.apps.${pres_app_id}.presence`;
  logger.debug(">>> NOW PUBLISHING PRESENCE. TOPIC: " + presence_webhook_topic + ", EVENT PAYLOAD ", presence_event_string);
  publish(exchange, presence_webhook_topic, Buffer.from(presence_event_string), function (err) {
    logger.debug(">>> PUBLISHED PRESENCE!" + presence_webhook_topic + " WITH PATCH: " + presence_event_string);
    if (err) {
      logger.error("publish presence error:", err);
    } else {
      logger.log("PRESENCE UPDATE PUBLISHED");
    }
  });
}

async function process_outgoing(topic: string, message_string: string, callback: (ok: boolean) => void): Promise<void> {
  callback(true);
  logger.debug("***** TOPIC outgoing: " + topic + " MESSAGE PAYLOAD: " + message_string);
  const topic_parts = topic.split(".");
  const out_app_id = topic_parts[1];
  const sender_id = topic_parts[4];
  const recipient_id = topic_parts[6];

  // Pre-fetch group from cache in parallel with the rate limit check to save a Redis RTT.
  const groupCachePromise = recipient_id.includes("group-")
    ? groupFromCache(recipient_id).catch(() => null)
    : null;

  if (rate_manager) {
    const allowed = await rate_manager.canExecute(sender_id, 'message');
    if (!allowed) {
      console.warn("Webhook rate limit exceeded for user " + sender_id);
      return;
    }
  }

  const outgoing_message: Record<string, unknown> = JSON.parse(message_string);

  if (topic) {
    messagesTopicCounter.inc({ topic: topic });
  }

  if (outgoing_message.attributes) {
    const attrs = outgoing_message.attributes as Record<string, string>;
    const project_id = attrs.projectId;
    const ip_address = attrs.ipAddress;
    if (project_id) {
      messagesProjectCounter.inc({ project_id: project_id });
    }
    if (ip_address) {
      messagesIPCounter.inc({ ip_address: ip_address });
    }
    if (project_id && ip_address) {
      messagesProjectIPCounter.inc({ project_id: project_id, ip_address: ip_address });
    }
  }

  const messageId = uuidv4();
  outgoing_message.message_id = messageId;
  outgoing_message.sender = sender_id;
  outgoing_message.recipient = recipient_id;
  outgoing_message.app_id = out_app_id;
  if (!outgoing_message.timestamp) {
    logger.debug("No timestamp provided, forcing to Date.now()");
    outgoing_message.timestamp = Date.now();
  } else {
    logger.debug("Timestamp provided.");
  }

  if (!isGroupMessage(outgoing_message)) {
    logger.debug("Direct message.");
    const inbox_of = sender_id;
    const convers_with = recipient_id;
    const sent_message = { ...outgoing_message };
    const delivered_message = { ...outgoing_message };
    sent_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT;
    deliverMessage(sent_message, out_app_id, inbox_of, convers_with, function (ok) {
      logger.debug("delivered to sender. OK?", ok);
      if (ok) {
        delivered_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED;
        const inbox_of2 = recipient_id;
        const convers_with2 = sender_id;
        deliverMessage(delivered_message, out_app_id, inbox_of2, convers_with2, function (ok2) {
          logger.debug("delivered to recipient. OK?", ok2);
        });
      } else {
        logger.debug("Error delivering: ", outgoing_message);
      }
    });
  } else {
    const group_id = recipient_id;
    if (outgoing_message.group) {
      logger.debug("Inline Group message.", outgoing_message);
      const inline_group = outgoing_message.group as Record<string, unknown>;
      inline_group.uid = group_id;
      (inline_group.members as Record<string, number>)[group_id] = 1;
      (inline_group.members as Record<string, number>)[sender_id] = 1;
      logger.debug("...inline_group:", inline_group);
      sendMessageToGroupMembers(outgoing_message, inline_group, out_app_id, (_ack) => {});
      return;
    }
    logger.debug("getting group:", group_id);
    getGroup(group_id, function (err, group) {
      if (!group) {
        logger.debug("group doesn't exist! Sending anyway to group timeline...");
        group = {
          uid: group_id,
          transient: true,
          members: {} as Record<string, number>
        };
        (group.members as Record<string, number>)[sender_id] = 1;
      }
      logger.debug("got group:" + JSON.stringify(group));
      (group.members as Record<string, number>)[group.uid as string] = 1;
      sendMessageToGroupMembers(outgoing_message, group, out_app_id, (_ack) => {
        logger.debug("Message sent to group:" + JSON.stringify(group));
      });
    }, groupCachePromise);
  }
}

function sendMessageToGroupMembers(
  outgoing_message: Record<string, unknown>,
  group: Record<string, unknown>,
  app_id: string,
  callback: (ok: boolean) => void
): void {
  logger.debug("sendMessageToGroupMembers():", JSON.stringify(group));
  const members = group.members as Record<string, number>;
  for (const [member_id] of Object.entries(members)) {
    const inbox_of = member_id;
    const convers_with = group.uid as string;
    logger.debug("sendMessageToGroupMembers() inbox_of: " + inbox_of);
    logger.debug("sendMessageToGroupMembers() convers_with: " + convers_with);
    logger.debug("sendMessageToGroupMembers() sending group outgoing message to member", member_id);
    if (inbox_of === group.uid) {
      logger.debug("sendMessageToGroupMembers() inbox_of === outgoing_message.sender. status=SENT system YES?", inbox_of);
      outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT;
    } else if (
      outgoing_message.attributes &&
      (outgoing_message.attributes as Record<string, unknown>).hiddenFor &&
      (outgoing_message.attributes as Record<string, unknown>).hiddenFor === inbox_of
    ) {
      logger.debug('sendMessageToGroupMembers() sendGroupMessageToMembersTimeline skip message for ' + (outgoing_message.attributes as Record<string, unknown>).hiddenFor);
      break;
    } else {
      logger.debug("sendMessageToGroupMembers() inbox_of != outgoing_message.sender. status=DELIVERED no system, is:", inbox_of);
      outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED;
    }
    logger.debug("sendMessageToGroupMembers() delivering group message with status...", outgoing_message.status, " to:", inbox_of);
    deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function (ok) {
      logger.debug("GROUP MESSAGE DELIVERED?", ok);
      if (!ok) {
        logger.debug("Error sending message to group " + (group.uid as string) + " inbox_of: " + inbox_of);
      }
    });
  }
  callback(true);
}

// Optional `prefetchPromise` is the result of groupFromCache() already started in parallel
// with the rate-limit check. When provided, the extra Redis GET is skipped entirely.
function getGroup(
  group_id: string,
  callback: (err: Error | null, group: Record<string, unknown> | null) => void,
  prefetchPromise?: Promise<Record<string, unknown> | null> | null
): void {
  logger.log("**** getGroup:", group_id);
  const cachePromise = prefetchPromise || groupFromCache(group_id);
  cachePromise.then((group) => {
    logger.log("group from cache?", group);
    if (group) {
      logger.log("--GROUP", group_id, "FOUND IN CACHE:", group);
      callback(null, group);
    } else {
      logger.log("--GROUP", group_id, "NO CACHE! GET FROM DB...");
      chatdb.getGroup(group_id, function (err, dbGroup) {
        if (!err && dbGroup) {
          saveGroupInCache(dbGroup, group_id, () => {});
        }
        logger.log("group from db:", dbGroup);
        callback(err, dbGroup);
      });
    }
  }).catch((err) => {
    logger.error("groupFromCache error:", err);
    chatdb.getGroup(group_id, callback);
  });
}

async function groupFromCache(group_id: string): Promise<Record<string, unknown> | null> {
  logger.log("groupFromCache() group_id:", group_id);
  if (redis_enabled && tdcache) {
    const group_key = "chat21:messages:groups:" + group_id;
    logger.log("group key", group_key);
    try {
      const value = await tdcache.get(group_key);
      logger.log("got group by key:", value);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      logger.error("Error during groupFromCache():", err);
      return null;
    }
  } else {
    logger.log("No redis.");
    return null;
  }
}

async function saveGroupInCache(
  group: Record<string, unknown>,
  group_id: string,
  callback: () => void
): Promise<void> {
  if (redis_enabled && tdcache) {
    const group_key = "chat21:messages:groups:" + group_id;
    await tdcache.set(group_key, JSON.stringify(group), { EX: 86400 });
    callback();
  } else {
    callback();
  }
}

function isGroupMessage(message: Record<string, unknown>): boolean {
  if (!message) {
    return false;
  }
  if (
    (message.channel_type && message.channel_type === 'group') ||
    (message.recipient && (message.recipient as string).includes("group-"))
  ) {
    return true;
  }
  return false;
}

function deliverMessage(
  message: Record<string, unknown>,
  app_id: string,
  inbox_of: string,
  convers_with_id: string,
  callback: (ok: boolean) => void
): void {
  logger.debug(">DELIVERING:", JSON.stringify(message), "inbox_of:", inbox_of, "convers_with:", convers_with_id);
  const persist_topic = `apps.observer.${app_id}.users.${inbox_of}.messages.${convers_with_id}.persist`;
  const added_topic = `apps.${app_id}.users.${inbox_of}.messages.${convers_with_id}.clientadded`;
  logger.debug("will pubblish on added_topic: " + added_topic);
  logger.debug("will pubblish on persist_topic: " + persist_topic);
  const message_payload = JSON.stringify(message);
  publish(exchange, added_topic, Buffer.from(message_payload), function (err) {
    if (err) {
      logger.error("Error on topic: ", added_topic, " Err:", err);
      callback(true);
      return;
    }
    logger.debug("NOTIFY VIA WHnotifyMessageStatusDelivered, topic: " + added_topic);
    if (webhooks && webhook_enabled) {
      logger.debug("webhooks && webhook_enabled ON, processing webhooks, message:", message);
      webhooks.WHnotifyMessageStatusSentOrDelivered(message_payload, added_topic, (err) => {
        if (err) {
          logger.error("WHnotifyMessageStatusSentOrDelivered with err (noack):" + err);
        } else {
          logger.debug("WHnotifyMessageStatusSentOrDelivered ok");
        }
      });
    }
    logger.debug("ADDED. NOW PUBLISH TO 'persist' TOPIC: " + persist_topic);
    publish(exchange, persist_topic, Buffer.from(message_payload), function (err) {
      if (err) {
        logger.error("Error PUBLISH TO 'persist' TOPIC (noack):", err);
        callback(true);
      } else {
        logger.debug("(WEBHOOK ENABLED) SUCCESSFULLY PUBLISHED ON:", persist_topic);
        callback(true);
      }
    });
  });
}

function process_delivered(topic: string, message_string: string, callback: (ok: boolean) => void): void {
  logger.debug(">>>>> DELIVERING:", topic, "MESSAGE PAYLOAD:", message_string);
  const topic_parts = topic.split(".");
  const del_app_id = topic_parts[2];
  const inbox_of = topic_parts[4];
  const convers_with = topic_parts[6];
  const message: Record<string, unknown> = JSON.parse(message_string);
  if (message.status !== MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED) {
    logger.error("process_delivered() error: status != DELIVERED (150). Only delivering messages with status DELIVERED", message);
    callback(true);
    return;
  }
  logger.debug("____DELIVER MESSAGE (status=" + message.status + "):", message.text, message.message_id, ", __history:", message.__history);
  deliverMessage(message, del_app_id, inbox_of, convers_with, function (ok) {
    logger.debug("MESSAGE DELIVERED?: " + ok);
    if (!ok) {
      logger.error("____Error delivering message. NOACKED:", message);
      logger.log("____DELIVER MESSAGE:", message.message_id, " (noack)!");
      callback(true);
    } else {
      logger.log("____DELIVER MESSAGE ", message.message_id, " ACKED");
      callback(true);
    }
  });
}

function process_persist(topic: string, message_string: string, callback: (ok: boolean) => void): void {
  logger.debug(">>>>> TOPIC persist: " + topic + " MESSAGE PAYLOAD: " + message_string);
  const topic_parts = topic.split(".");
  const per_app_id = topic_parts[2];
  const me = topic_parts[4];
  const convers_with = topic_parts[6];

  const persist_message: Record<string, unknown> = JSON.parse(message_string);
  const savedMessage = persist_message;
  savedMessage.app_id = per_app_id;
  savedMessage.timelineOf = me;
  savedMessage.conversWith = convers_with;

  let update_conversation = true;
  if (savedMessage.attributes && (savedMessage.attributes as Record<string, unknown>).updateconversation === false) {
    update_conversation = false;
  }
  chatdb.saveOrUpdateMessage(savedMessage, function (_err) {
    if (update_conversation) {
      const conversation: Record<string, unknown> = { ...persist_message };
      conversation.conversWith = convers_with;
      conversation.key = convers_with;
      conversation.is_new = true;
      conversation.archived = false;
      conversation.last_message_text = conversation.text;
      chatdb.saveOrUpdateConversation(conversation, (err) => {
        if (err) {
          logger.error("(chatdb.saveOrUpdateConversation callback) ERROR (noack): ", err);
          callback(true);
        } else {
          callback(true);
        }
      });
    } else {
      logger.debug("Skip updating conversation. (update_conversation = false)");
      callback(true);
    }
  });
}

function process_update(topic: string, message_string: string, callback: (ok: boolean) => void): void {
  const topic_parts = topic.split(".");
  logger.debug("UPDATE. TOPIC PARTS:", topic_parts);
  logger.debug("payload:" + message_string);
  if (topic_parts.length < 5) {
    logger.debug("Error GRAVE- process_update topic error - SKIP UPDATE. topic_parts.length < 5.", topic);
    callback(true);
    return;
  }
  if (topic_parts[4] === "messages") {
    logger.debug(" MESSAGE UPDATE.");
    const upd_app_id = topic_parts[1];
    const user_id = topic_parts[3];
    const convers_with = topic_parts[5];
    const message_id = topic_parts[6];
    logger.debug("updating message:", message_id, "on convers_with", convers_with, "for user", user_id, "patch", message_string);
    const patch: Record<string, unknown> = JSON.parse(message_string);
    if (!patch.status || patch.status !== 200) {
      logger.debug("Error GRAVE- process_update: (!patch.status || patch.status != 200) - SKIP UPDATE.", topic);
      callback(true);
      return;
    }
    const me = user_id;
    const my_message_patch: Record<string, unknown> = {
      "timelineOf": me,
      "message_id": message_id,
      "status": patch.status
    };
    const dest_message_patch: Record<string, unknown> = {
      "timelineOf": convers_with,
      "message_id": message_id,
      "status": MessageConstants.CHAT_MESSAGE_STATUS_CODE.RETURN_RECEIPT
    };
    const dest_message_patch_payload = JSON.stringify(dest_message_patch);
    const recipient_message_update_topic = 'apps.tilechat.users.' + convers_with + '.messages.' + me + '.' + message_id + '.clientupdated';
    logger.debug(">>> NOW PUBLISHING... DEST_PATCH: RETURN_RECEIPT. TOPIC: " + recipient_message_update_topic + ", PATCH ", dest_message_patch);
    publish(exchange, recipient_message_update_topic, Buffer.from(dest_message_patch_payload), function (err) {
      logger.debug(">>> PUBLISHED!!!! RECIPIENT MESSAGE TOPIC UPDATE" + recipient_message_update_topic + " WITH PATCH: " + JSON.stringify(dest_message_patch));
      if (err) {
        logger.error("publish error (noack):", err);
        callback(true);
      } else {
        logger.log("webhook_enabled?????", webhook_enabled);
        if (webhook_enabled && webhooks) {
          webhooks.WHnotifyMessageStatusReturnReceipt(dest_message_patch, (err) => {
            if (err) {
              logger.error("WHnotifyMessageStatusReturnReceipt with err:" + err);
            } else {
              logger.debug("WHnotifyMessageStatusReturnReceipt ok");
            }
          });
        }
        logger.debug(">>> ON DISK... WITH A STATUS ON MY MESSAGE-UPDATE TOPIC", topic, "WITH PATCH: " + JSON.stringify(my_message_patch));
        chatdb.saveOrUpdateMessage(my_message_patch, function (err) {
          if (err) {
            logger.error("error on topic:", topic, " - Error (noack):", err);
            callback(true);
          } else {
            chatdb.saveOrUpdateMessage(dest_message_patch, function (err) {
              if (err) {
                logger.error("error on topic:", topic, " - Error (noack):", err);
                callback(true);
              } else {
                callback(true);
              }
            });
          }
        });
      }
    });
  } else if (topic_parts[4] === "conversations") {
    logger.debug(" CONVERSATION UPDATE.");
    const upd_app_id = topic_parts[1];
    const user_id = topic_parts[3];
    const convers_with = topic_parts[5];
    logger.debug("updating conversation:" + convers_with + " for user " + user_id + " patch " + message_string);
    const patch: Record<string, unknown> = JSON.parse(message_string);
    const me = user_id;
    patch.timelineOf = me;
    patch.conversWith = convers_with;
    logger.debug(">>> ON DISK... CONVERSATION TOPIC " + topic + " WITH PATCH " + patch);
    logger.debug("Updating conversation 2.");
    chatdb.saveOrUpdateConversation(patch, function (err) {
      logger.debug(">>> CONVERSATION ON TOPIC:", topic, "UPDATED?");
      if (err) {
        logger.error("CONVERSATION ON TOPIC UPDATE error (noack)", err);
        callback(true);
        return;
      }
      const patch_payload = JSON.stringify(patch);
      const my_conversation_update_topic = 'apps.tilechat.users.' + me + '.conversations.' + convers_with + '.clientupdated';
      logger.debug(">>> NOW PUBLISHING... MY CONVERSATION UPDATE " + my_conversation_update_topic + " WITH PATCH " + patch_payload);
      publish(exchange, my_conversation_update_topic, Buffer.from(patch_payload), function (err) {
        logger.debug(">>> PUBLISHED!!!! MY CONVERSATION UPDATE TOPIC " + my_conversation_update_topic + " WITH PATCH " + patch_payload);
        if (err) {
          logger.error("PUBLISH MY CONVERSATION UPDATE TOPIC error (noack)", err);
          callback(true);
        } else {
          callback(true);
        }
      });
    });
  }
}

function process_archive(topic: string, payload: string, callback: (ok: boolean) => void): void {
  logger.log("Inside presence function:", topic);
  const topic_parts = topic.split(".");
  logger.debug("ARCHIVE. TOPIC PARTS:" + topic_parts + "payload (ignored): " + payload);
  if (topic_parts.length < 7) {
    logger.debug("ERROR GRAVE. process_archive topic error. topic_parts.length < 7:" + topic);
    callback(true);
    return;
  }
  if (topic_parts[4] === "conversations") {
    logger.debug("CONVERSATION ARCHIVE.");
    const arc_app_id = topic_parts[1];
    const user_id = topic_parts[3];
    const convers_with = topic_parts[5];
    logger.debug("archiving conversation:" + convers_with + " for user " + user_id + " payload: " + payload);
    const me = user_id;
    const conversation_archive_patch: Record<string, unknown> = {
      "timelineOf": user_id,
      "conversWith": convers_with,
      "archived": true
    };
    logger.debug("NOTIFY VIA WEBHOOK ON SAVE TOPIC " + topic);
    if (webhook_enabled && webhooks) {
      webhooks.WHnotifyConversationArchived(conversation_archive_patch, topic, (err) => {
        if (err) {
          logger.error("Webhook notified with err:" + err);
        } else {
          logger.debug("Webhook notified WHnotifyConversationArchived ok");
        }
      });
    }
    logger.debug(">>> ON DISK... ARCHIVE CONVERSATION ON TOPIC: " + topic);
    logger.debug("Updating conversation 3.");
    chatdb.saveOrUpdateConversation(conversation_archive_patch, function (err) {
      logger.debug(">>> CONVERSATION ON TOPIC:", topic, "ARCHIVED!");
      if (err) {
        logger.error("CONVERSATION ON TOPIC: error (noack)", err);
        callback(true);
        return;
      }
      chatdb.conversationDetail(arc_app_id, user_id, convers_with, true, (err, convs) => {
        if (err) {
          logger.error("Error GRAVE. getting conversationDetail()", err);
          callback(true);
        } else if (!convs || convs.length < 1) {
          logger.error("Error GRAVE. getting conversationDetail(): convs[].length < 1");
          callback(true);
        } else {
          const conversation_archived = convs[0];
          logger.debug("got archived conversation detail:", conversation_archived);
          const conversation_deleted_topic = 'apps.tilechat.users.' + user_id + '.conversations.' + convers_with + '.clientdeleted';
          logger.debug(">>> NOW PUBLISHING... CONVERSATION ARCHIVED (DELETED) TOPIC " + conversation_deleted_topic);
          const arc_payload = JSON.stringify(conversation_archived);
          publish(exchange, conversation_deleted_topic, Buffer.from(arc_payload), function (err) {
            logger.debug(">>> PUBLISHED!!!! CONVERSATION ON TOPIC: " + conversation_deleted_topic + " ARCHIVED (DELETED). Payload: " + arc_payload);
            if (err) {
              logger.error("error PUBLISHING CONVERSATION ON TOPIC:", err);
              callback(true);
            } else {
              const archived_conversation_added_topic = 'apps.tilechat.users.' + user_id + '.archived_conversations.' + convers_with + '.clientadded';
              logger.debug(">>> NOW PUBLISHING... CONVERSATION ARCHIVED (ADDED) TOPIC: " + archived_conversation_added_topic);
              publish(exchange, archived_conversation_added_topic, Buffer.from(arc_payload), function (err) {
                if (err) {
                  logger.error("error PUBLISHING ARCHIVED (DELETED) CONVERSATION ON TOPIC", err);
                  callback(true);
                } else {
                  logger.debug(">>> PUBLISHED ARCHIVED (DELETED) CONVERSATION ON TOPIC: " + conversation_deleted_topic);
                  callback(true);
                }
              });
            }
          });
        }
      });
    });
  }
}

function process_update_group(topic: string, payload: string, callback: (ok: boolean) => void): void {
  const topic_parts = topic.split(".");
  logger.debug("process_update_group. TOPIC PARTS:" + topic_parts + "payload:" + payload);
  const grp_app_id = topic_parts[2];
  logger.debug("app_id:" + grp_app_id);
  logger.debug("payload:" + payload);
  const data: Record<string, unknown> = JSON.parse(payload);
  logger.debug("process_update_group DATA ", JSON.stringify(data));
  const group = data.group as Record<string, unknown>;
  const notify_to = data.notify_to as Record<string, unknown>;
  if (!group || !group.uid) {
    logger.error("ERROR GRAVE. Group not found!");
    callback(true);
    return;
  }
  // Keep the cache in sync so that subsequent messages use the updated member list
  saveGroupInCache(group, group.uid as string, () => {});
  deliverGroupUpdated(group, notify_to, function (ok) {
    callback(ok);
  });
}

function deliverGroupUpdated(
  group: Record<string, unknown>,
  notify_to: Record<string, unknown>,
  callback: (ok: boolean) => void
): void {
  const grp_app_id = group.appId as string;
  for (const [key] of Object.entries(notify_to)) {
    const member_id = key;
    const updated_group_topic = `apps.${grp_app_id}.users.${member_id}.groups.${group.uid}.clientupdated`;
    logger.debug("updated_group_topic:", updated_group_topic);
    const payload = JSON.stringify(group);
    publish(exchange, updated_group_topic, Buffer.from(payload), function (err) {
      if (err) {
        logger.error("error publish deliverGroupUpdated:", err);
      }
    });
  }
  callback(true);
}

function closeOnErr(err: Error | null): boolean {
  if (!err) return false;
  logger.error("[AMQP] error", err);
  amqpConn!.close();
  return true;
}

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

  logger.debug("(Observer) webhook_enabled: " + webhook_enabled);
  logger.debug("(Observer) presence_enabled: " + presence_enabled);

  app_id = config.app_id || "tilechat";
  exchange = config.exchange || 'amq.topic';

  if (config.rabbitmq_uri) {
    rabbitmq_uri = config.rabbitmq_uri;
  } else if (process.env.RABBITMQ_URI) {
    rabbitmq_uri = process.env.RABBITMQ_URI;
  } else {
    throw new Error('please configure process.env.RABBITMQ_URI or use parameter config.rabbitmq_uri option.');
  }

  topic_outgoing = `apps.${app_id}.outgoing.users.*.messages.*.outgoing`;
  topic_update = `apps.${app_id}.users.#.update`;
  topic_archive = `apps.${app_id}.users.#.archive`;
  topic_presence = `apps.${app_id}.users.*.presence.*`;
  topic_persist = `apps.observer.${app_id}.users.*.messages.*.persist`;
  topic_delivered = `apps.observer.${app_id}.users.*.messages.*.delivered`;
  topic_update_group = `apps.observer.${app_id}.groups.update`;

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
    redis_enabled = true;
  } else {
    redis_enabled = false;
  }
  if (redis_enabled && config.redis_host && config.redis_port) {
    logger.info("(Observer) Redis enabled.");
    tdcache = new TdCache({
      host: config.redis_host,
      port: Number(config.redis_port),
      password: config.redis_password
    });
    await connectRedis();
    await startRateManager(tdcache!);
    logger.info("(Observer) Redis connected.");
  } else {
    logger.info("(Observer) Redis disabled.");
  }

  chatdb = new ChatDB({ database: db });
  try {
    if (webhook_enabled) {
      logger.info("(Observer) Starting webhooks...");
      webhooks = new Webhooks({
        appId: app_id,
        RABBITMQ_URI: rabbitmq_uri,
        exchange: exchange,
        webhook_endpoints: webhook_endpoints_array,
        webhook_events: webhook_events_array,
        queue_name: 'webhooks',
        durable_enabled: durable_enabled,
        prefetch_messages: prefetch_messages,
        logger: logger
      });
      webhooks.enabled = true;
      await webhooks.start();
    } else {
      logger.info("(Observer) Webhooks disabled.");
    }
  } catch (error) {
    logger.error("An error occurred initializing webhooks:", error);
  }

  if (presence_enabled) {
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
  if (tdcache) {
    try {
      await tdcache.connect();
    } catch (error) {
      tdcache = null;
      process.exit(1);
    }
  }
}

async function startRateManager(tdCache: TdCache): Promise<void> {
  rate_manager = new RateManager({ tdCache: tdCache });
}

export function stopServer(callback: () => void): void {
  amqpConn!.close(callback);
}

export { logger };
