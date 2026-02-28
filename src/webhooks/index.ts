/* 
    ver 0.1.0
    Andrea Sponziello - (c) Tiledesk.com
*/

import * as amqp from 'amqplib';
import * as MessageConstants from '../models/messageConstants';
import { logger as defaultLogger } from '../tiledesk-logger';
import { WebhookSender } from './WebhookSender';
import { WebhooksContext, WebhookNotifier } from './WebhookNotifier';
import { WebhookEventProcessorContext, WebhookEventProcessor } from './WebhookEventProcessor';

let logger: any;

/**
 * This is the class that manages webhooks
 */
export class Webhooks implements WebhooksContext, WebhookEventProcessorContext {
  webhook_endpoints: any;
  RABBITMQ_URI: string;
  appId: string;
  topic_webhook_message_deliver: string;
  topic_webhook_message_update: string;
  topic_webhook_conversation_archived: string;
  topic_webhook_presence: string;
  amqpConn: any;
  exchange: string;
  channel: any;
  pubChannel: any;
  offlinePubQueue: any[];
  enabled: boolean;
  durable_enabled: boolean;
  prefetch_messages: number;
  queue: string;
  webhook_events_array: string[];

  sender: WebhookSender;
  notifier: WebhookNotifier;
  processor: WebhookEventProcessor;

  // Interface properties needed by Context
  public get logger() { return logger; }

  constructor(options: any) {
    if (!options) {
      throw new Error('options can NOT be empty. appId and RABBITMQ_URI are mandatory');
    }
    if (!options.RABBITMQ_URI) {
      throw new Error('RABBITMQ_URI option can NOT be empty.');
    }
    if (!options.exchange) {
      throw new Error('exchange option can NOT be empty.');
    }
    if (!options.appId) {
      throw new Error('appId option can NOT be empty.');
    }
    if (options.logger) {
      logger = options.logger;
    } else {
      logger = defaultLogger;
    }
    this.webhook_endpoints = options.webhook_endpoints;
    this.RABBITMQ_URI = options.RABBITMQ_URI;
    this.appId = options.appId;
    this.topic_webhook_message_deliver = `observer.webhook.apps.${this.appId}.message_deliver`;
    this.topic_webhook_message_update = `observer.webhook.apps.${this.appId}.message_update`;
    this.topic_webhook_conversation_archived = `observer.webhook.apps.${this.appId}.conversation_archived`;
    this.topic_webhook_presence = `observer.webhook.apps.${this.appId}.presence`;
    this.amqpConn = null;
    this.exchange = options.exchange;
    this.channel = null;
    this.pubChannel = null;
    this.offlinePubQueue = [];
    this.enabled = true;
    this.durable_enabled = options.durable_enabled !== false;
    this.prefetch_messages = options.prefetch_messages || 10;
    this.queue = options.queue_name || 'webhooks';
    const DEFAULT_WEBHOOK_EVENTS = [
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_SENT,
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED,
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_RECEIVED,
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_RETURN_RECEIPT,
      MessageConstants.WEBHOOK_EVENTS.CONVERSATION_ARCHIVED,
      MessageConstants.WEBHOOK_EVENTS.CONVERSATION_UNARCHIVED,
    ]
    this.webhook_events_array = options.webhook_events || DEFAULT_WEBHOOK_EVENTS;

    // Initialize decomposed components
    this.sender = new WebhookSender(logger);
    this.notifier = new WebhookNotifier(this);
    this.processor = new WebhookEventProcessor(this, this.sender);

    logger.debug("webhooks inizialized: this.exchange:", this.exchange, "this.offlinePubQueue:", this.offlinePubQueue)
  }

  getWebHookEnabled() {
    return this.enabled;
  }

  setWebHookEnabled(enabled: boolean) {
    this.enabled = enabled;
    logger.log("Webhooks.enabled:", this.enabled);
  }

  getWebHookEndpoints() {
    return this.webhook_endpoints;
  }

  setWebHookEndpoints(endpoints: string[]) {
    this.webhook_endpoints = endpoints;
    logger.log("New webhook endpoints:", this.webhook_endpoints)
  }

  getWebHookEvents() {
    return this.webhook_events_array;
  }

  setWebHookEvents(events: string[]) {
    this.webhook_events_array = events;
  }

  // --- Delegate to WebhookNotifier (Backwards compatible logic used by MessageService) ---
  WHnotifyMessageStatusSentOrDelivered(message_payload: any, topic: string, callback?: any) {
    return this.notifier.notifyMessageStatusSentOrDelivered(message_payload, topic, callback);
  }

  WHnotifyMessageStatusSent(message: any, callback?: any) {
    return this.notifier.notifyMessageStatusSent(message, callback);
  }

  WHnotifyMessageStatusDelivered(message: any, callback?: any) {
    return this.notifier.notifyMessageStatusDelivered(message, callback);
  }

  WHnotifyMessageStatusReturnReceipt(message: any, callback?: any) {
    return this.notifier.notifyMessageStatusReturnReceipt(message, callback);
  }

  WHnotifyMessageDeliver(message: any, callback?: any) {
    return this.notifier.notifyMessageDeliver(message, callback);
  }

  WHnotifyMessageUpdate(message: any, callback?: any) {
    return this.notifier.notifyMessageUpdate(message, callback);
  }

  WHnotifyConversationArchived(conversation: any, topic: string, callback?: any) {
    return this.notifier.notifyConversationArchived(conversation, topic, callback);
  }

  WHnotifyPresence(payload: any, callback?: any) {
    return this.notifier.notifyPresence(payload, callback);
  }

  // --- Delegated Processors ---
  WHprocess_webhook_message_deliver(topic: string, message_string: string, callback?: any) {
    return this.processor.process_webhook_message_deliver(topic, message_string, callback);
  }
  WHprocess_webhook_message_update(topic: string, message_string: string, callback?: any) {
    return this.processor.process_webhook_message_update(topic, message_string, callback);
  }
  WHprocess_webhook_conversation_archived(topic: string, payload: any, callback?: any) {
    return this.processor.process_webhook_conversation_archived(topic, payload, callback);
  }
  WHprocess_webhook_presence(topic: string, presence_payload_string: string, callback?: any) {
    return this.processor.process_webhook_presence(topic, presence_payload_string, callback);
  }

  WHisMessageOnGroupTimeline(message: any) {
    if (message && message.timelineOf) {
      if (message.timelineOf.toLowerCase().indexOf("group") !== -1) {
        return true
      }
    }
    return false
  }

  WHsendData(endpoint: string, json: any, callback?: any) {
    return this.sender.sendData(endpoint, json, callback);
  }

  // --- Lifecycle and core AMQP features ---

  async whenConnected() {
    await this.startPublisher();
    logger.info("webhook publisher started.");
    await this.startWorker();
    logger.info("webhook worker started.");
  }

  async startPublisher() {
    try {
      this.pubChannel = await this.amqpConn.createConfirmChannel();
      this.pubChannel.on("error", (err: any) => {
        logger.error("[Webooks.AMQP] channel error", err);
      });
      this.pubChannel.on("close", () => {
        logger.debug("[Webooks.AMQP] channel closed");
      });
      return this.pubChannel;
    } catch (err) {
      this.closeOnErr(err);
      throw err;
    }
  }

  closeOnErr(err: any) {
    if (!err) return false;
    logger.error("[Webooks.AMQP] error", err);
    this.amqpConn.close();
    return true;
  }

  async startWorker() {
    logger.debug("starting webhook worker.");
    try {
      this.channel = await this.amqpConn.createChannel();
      this.channel.on("error", (err: any) => {
        logger.error("[Webooks.AMQP] channel error", err);
      });
      this.channel.on("close", () => {
        logger.debug("[Webooks.AMQP] channel closed");
      });
      this.channel.prefetch(this.prefetch_messages);
      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: this.durable_enabled
      });
      const ok = await this.channel.assertQueue(this.queue, { durable: this.durable_enabled });
      logger.debug("subscribed to ok.queue: " + ok.queue);
      await this.subscribeTo(this.topic_webhook_message_deliver, this.channel, ok.queue);
      await this.subscribeTo(this.topic_webhook_message_update, this.channel, ok.queue);
      await this.subscribeTo(this.topic_webhook_conversation_archived, this.channel, ok.queue);
      await this.subscribeTo(this.topic_webhook_presence, this.channel, ok.queue);
      await this.channel.consume(this.queue, this.processMsg.bind(this), { noAck: false });
    } catch (err) {
      this.closeOnErr(err);
      throw err;
    }
  }

  async subscribeTo(topic: string, channel: any, queue: string) {
    try {
      await channel.bindQueue(queue, this.exchange, topic, {});
      logger.info("Webhooks.bind: '" + queue + "' on topic: " + topic);
    } catch (err) {
      logger.error("Webooks.Error:", err, " binding on queue:", queue, "topic:", topic);
      throw err;
    }
  }

  async processMsg(msg: any) {
    try {
      const ok = await this.work(msg);
      logger.debug("Webhooks.worked.");
      if (ok) {
        this.channel.ack(msg);
      } else {
        this.channel.reject(msg, true);
      }
    } catch (e) {
      logger.debug("processMsg error:", e);
      this.closeOnErr(e);
    }
  }

  async start() {
    try {
      this.amqpConn = await amqp.connect(this.RABBITMQ_URI);
      this.amqpConn.on("error", (err: any) => {
        if (err.message !== "Connection closing") {
          logger.error("[Webooks.AMQP] conn error", err.message);
        }
      });
      this.amqpConn.on("close", () => {
        logger.error("[Webooks.AMQP] reconnecting");
        setTimeout(() => this.start(), 1000);
      });
      logger.info("[Webooks.AMQP] connected");
      await this.whenConnected();
    } catch (err: any) {
      logger.error("[Webooks.AMQP]", err.message);
      setTimeout(() => this.start(), 1000);
    }
  }

  async publish(exchange: string, routingKey: string, content: Buffer, callback?: any) {
    try {
      if (!this.pubChannel) {
        throw new Error("Publisher channel not initialized");
      }
      await this.pubChannel.publish(exchange, routingKey, content, { persistent: true });
      if (callback) callback(null);
      return true;
    } catch (e: any) {
      logger.error("[Webooks.AMQP] publish", e.message);
      if (callback) callback(e);
      throw e;
    }
  }

  async work(msg: any) {
    const topic = msg.fields.routingKey;
    const message_string = msg.content.toString();
    try {
      if (topic === this.topic_webhook_message_deliver) {
        await this.WHprocess_webhook_message_deliver(topic, message_string);
      } else if (topic === this.topic_webhook_message_update) {
        await this.WHprocess_webhook_message_update(topic, message_string);
      } else if (topic === this.topic_webhook_conversation_archived) {
        await this.WHprocess_webhook_conversation_archived(topic, message_string);
      } else if (topic === this.topic_webhook_presence) {
        await this.WHprocess_webhook_presence(topic, message_string);
      } else {
        logger.error("Unknown topic in webhook worker:", topic);
      }
      return true;
    } catch (err) {
      logger.error("Error in webhook work:", err);
      return false;
    }
  }
}
