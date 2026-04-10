/*
    ver 0.1.0
    Andrea Sponziello - (c) Tiledesk.com
*/

import * as amqp from 'amqplib/callback_api';
import * as url from 'url';
import * as http from 'http';
import * as https from 'https';
import { TiledeskLogger } from '../tiledesk-logger';
import MessageConstants from '../models/messageConstants';
import { ChatMessage, Conversation } from '../types';
import type { WorkCallback, SendDataCallback, SimpleCallback } from './types';

export interface WebhooksOptions {
  RABBITMQ_URI: string;
  exchange: string;
  appId: string;
  webhook_endpoints?: string[] | null;
  queue_name?: string;
  webhook_events?: string[] | null;
  durable_enabled?: boolean;
  prefetch_messages?: number;
  logger?: TiledeskLogger;
}

/**
 * Manages webhooks for chat21-server.
 */
export class Webhooks {
  private webhook_endpoints: string[] | null | undefined;
  private readonly RABBITMQ_URI: string;
  readonly appId: string;
  private readonly topic_webhook_message_deliver: string;
  private readonly topic_webhook_message_update: string;
  private readonly topic_webhook_conversation_archived: string;
  private readonly topic_webhook_presence: string;
  amqpConn: amqp.Connection | null = null;
  private readonly exchange: string;
  private channel: amqp.Channel | null = null;
  private pubChannel: amqp.ConfirmChannel | null = null;
  private offlinePubQueue: [string, string, Buffer][] = [];
  enabled = true;
  private readonly durable_enabled: boolean;
  private readonly prefetch_messages: number;
  private readonly queue: string;
  private webhook_events_array: string[];

  constructor(options: WebhooksOptions) {
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
      logger = require('../tiledesk-logger').logger as TiledeskLogger;
    }

    this.webhook_endpoints = options.webhook_endpoints;
    this.RABBITMQ_URI = options.RABBITMQ_URI;
    this.appId = options.appId;
    this.topic_webhook_message_deliver = `observer.webhook.apps.${this.appId}.message_deliver`;
    this.topic_webhook_message_update = `observer.webhook.apps.${this.appId}.message_update`;
    this.topic_webhook_conversation_archived = `observer.webhook.apps.${this.appId}.conversation_archived`;
    this.topic_webhook_presence = `observer.webhook.apps.${this.appId}.presence`;
    this.exchange = options.exchange;
    this.durable_enabled = options.durable_enabled ?? true;
    this.prefetch_messages = options.prefetch_messages ?? 10;
    this.queue = options.queue_name ?? 'webhooks';

    const DEFAULT_WEBHOOK_EVENTS: string[] = [
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_SENT,
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED,
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_RECEIVED,
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_RETURN_RECEIPT,
      MessageConstants.WEBHOOK_EVENTS.CONVERSATION_ARCHIVED,
      MessageConstants.WEBHOOK_EVENTS.CONVERSATION_UNARCHIVED,
    ];
    this.webhook_events_array = options.webhook_events ?? DEFAULT_WEBHOOK_EVENTS;

    logger.debug(
      'webhooks inizialized: this.exchange:',
      this.exchange,
      'this.offlinePubQueue:',
      this.offlinePubQueue,
    );
  }

  // ─── Config getters / setters ──────────────────────────────────────────────

  getWebHookEnabled(): boolean {
    return this.enabled;
  }

  setWebHookEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.log('Webhooks.enabled:', this.enabled);
  }

  getWebHookEndpoints(): string[] | null | undefined {
    return this.webhook_endpoints;
  }

  setWebHookEndpoints(endpoints: string[] | null): void {
    this.webhook_endpoints = endpoints;
    logger.log('New webhook endpoints:', this.webhook_endpoints);
  }

  getWebHookEvents(): string[] {
    return this.webhook_events_array;
  }

  setWebHookEvents(events: string[] | null): void {
    if (events) {
      this.webhook_events_array = events;
    }
  }

  // ─── Notification helpers (WHnotify*) ──────────────────────────────────────

  WHnotifyMessageStatusSentOrDelivered(
    message_payload: string,
    topic: string,
    callback: SimpleCallback,
  ): void {
    if (this.enabled === false) {
      logger.debug('webhooks disabled');
      callback(null);
      return;
    }
    logger.log('WHnotifyMessageStatusSentOrDelivered()', message_payload);
    const message: ChatMessage = JSON.parse(message_payload);
    message['temp_field_chat_topic'] = topic;
    if (message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT) {
      logger.log('SENT...');
      this.WHnotifyMessageStatusSent(message, callback);
    } else if (message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED) {
      logger.log('DELIVERED...');
      this.WHnotifyMessageStatusDelivered(message, callback);
    } else {
      logger.log('STATUS NEITHER SENT OR DELIVERED...');
      callback(null);
    }
  }

  WHnotifyMessageStatusSent(message: ChatMessage, callback: SimpleCallback): void {
    if (this.enabled === false) {
      logger.debug('webhooks disabled');
      callback(null);
      return;
    }
    logger.log('WH Sent method.');
    if (!this.webhook_events_array.includes(MessageConstants.WEBHOOK_EVENTS.MESSAGE_SENT)) {
      logger.debug('WH MESSAGE_SENT disabled.');
      callback(null);
    } else {
      logger.log('WH MESSAGE_SENT enabled');
      this.WHnotifyMessageDeliver(message, callback);
    }
  }

  WHnotifyMessageStatusDelivered(message: ChatMessage, callback: SimpleCallback): void {
    if (this.enabled === false) {
      logger.debug('webhooks disabled');
      callback(null);
      return;
    }
    if (!this.webhook_events_array.includes(MessageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED)) {
      logger.debug('WH MESSAGE_DELIVERED disabled.');
      callback(null);
    } else {
      logger.debug('WH MESSAGE_DELIVERED enabled.');
      this.WHnotifyMessageDeliver(message, callback);
    }
  }

  WHnotifyMessageStatusReturnReceipt(message: ChatMessage, callback: SimpleCallback): void {
    if (this.enabled === false) {
      logger.debug('webhooks disabled');
      callback(null);
      return;
    }
    if (!this.webhook_events_array.includes(MessageConstants.WEBHOOK_EVENTS.MESSAGE_RETURN_RECEIPT)) {
      logger.debug('WH MESSAGE_RETURN_RECEIPT disabled.');
      callback(null);
    } else {
      this.WHnotifyMessageUpdate(message, callback);
    }
  }

  WHnotifyMessageDeliver(message: ChatMessage, callback: SimpleCallback): void {
    if (this.enabled === false) {
      logger.debug('webhooks disabled');
      callback(null);
      return;
    }
    message['temp_webhook_endpoints'] = this.webhook_endpoints;
    const notify_topic = `observer.webhook.apps.${this.appId}.message_deliver`;
    logger.debug('notifying webhook MessageSent topic:' + notify_topic);
    const message_payload = JSON.stringify(message);
    logger.debug('MESSAGE_PAYLOAD: ' + message_payload);
    this.publish(this.exchange, notify_topic, Buffer.from(message_payload), (err) => {
      if (err) {
        logger.error('Error publishing webhook WHnotifyMessageDeliver', err);
        callback(err as Error);
      } else {
        callback(null);
      }
    });
  }

  WHnotifyMessageUpdate(message: ChatMessage, callback: SimpleCallback): void {
    if (this.enabled === false) {
      logger.debug('webhooks disabled');
      callback(null);
      return;
    }
    logger.debug('NOTIFY MESSAGE UPDATE:', message);
    const notify_topic = `observer.webhook.apps.${this.appId}.message_update`;
    logger.debug('notifying webhook message_update topic:' + notify_topic);
    const message_payload = JSON.stringify(message);
    logger.debug('MESSAGE_PAYLOAD: ' + message_payload);
    this.publish(this.exchange, notify_topic, Buffer.from(message_payload), (err) => {
      if (err) {
        logger.error('Err', err);
        callback(err as Error);
      } else {
        callback(null);
      }
    });
  }

  WHnotifyConversationArchived(
    conversation: Conversation,
    topic: string,
    callback: SimpleCallback,
  ): void {
    if (this.enabled === false) {
      logger.debug('WHnotifyConversationArchived Discarding notification. webhook_enabled is false.');
      callback(null);
      return;
    }
    logger.debug('NOTIFY CONVERSATION ARCHIVED:', conversation);
    conversation['temp_field_chat_topic'] = topic;
    const notify_topic = `observer.webhook.apps.${this.appId}.conversation_archived`;
    logger.debug('notifying webhook notifyConversationArchived topic: ' + notify_topic);
    const payload = JSON.stringify(conversation);
    logger.debug('PAYLOAD:', payload);
    this.publish(this.exchange, notify_topic, Buffer.from(payload), (err) => {
      if (err) {
        logger.error('Err', err);
        callback(err as Error);
      } else {
        callback(null);
      }
    });
  }

  // ─── Webhook process handlers (WHprocess_*) ────────────────────────────────

  WHprocess_webhook_message_deliver(
    topic: string,
    message_string: string,
    callback: WorkCallback,
  ): void {
    logger.debug(
      'process WHprocess_webhook_message_deliver: ' + message_string + ' on topic: ' + topic,
    );
    const message: ChatMessage = JSON.parse(message_string);
    if (callback) {
      callback(true);
    }

    if (!message['temp_webhook_endpoints']) {
      logger.debug(
        'Error. WHprocess_webhook_message_deliver Discarding notification. webhook_endpoints undefined.',
      );
      return;
    }

    let delivered_to_inbox_of: string | null = null;
    if (
      message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED ||
      (message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT &&
        message['temp_field_chat_topic'])
    ) {
      const topic_parts = (message['temp_field_chat_topic'] as string).split('.');
      if (topic_parts.length >= 4) {
        delivered_to_inbox_of = topic_parts[3];
      } else {
        logger.error('Error: inbox_of not found in topic:', topic);
        return;
      }
    } else {
      logger.error(
        'Error. Topic processing error on message-delivered/message-sent event. Topic:',
        topic,
        ',message:',
        message,
      );
      return;
    }

    const message_id = message.message_id;
    const recipient_id = message.recipient;
    const app_id = message.app_id;
    let event_type: string;
    if (message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT) {
      event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_SENT;
    } else {
      event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED;
    }
    const json: Record<string, unknown> = {
      event_type,
      createdAt: new Date().getTime(),
      recipient_id,
      app_id,
      message_id,
      data: message,
      extras: { topic: message['temp_field_chat_topic'] },
    };
    if (delivered_to_inbox_of) {
      json['delivered_to'] = delivered_to_inbox_of;
    }
    delete message['temp_field_chat_topic'];

    const endpoints = message['temp_webhook_endpoints'] as string[];
    delete message['temp_webhook_endpoints'];
    logger.log('Event JSON:' + JSON.stringify(json));
    endpoints.forEach((endpoint) => {
      logger.debug(
        'Sending notification to webhook (message_deliver) on webhook_endpoint:',
        endpoint,
      );
      this.WHsendData(endpoint, json, (err, data) => {
        if (err) {
          logger.error('Err WHsendData callback', err);
        } else {
          logger.debug('WHsendData sendata end with data:' + data);
        }
      });
    });
  }

  WHprocess_webhook_message_update(
    topic: string,
    message_string: string,
    callback: WorkCallback,
  ): void {
    logger.debug(
      'process WHprocess_webhook_message_update: ' + message_string + ' on topic: ' + topic,
    );
    const message: ChatMessage = JSON.parse(message_string);
    logger.debug('timelineOf:' + message['timelineOf']);
    if (callback) {
      callback(true);
    }

    if (!message['temp_webhook_endpoints']) {
      logger.debug(
        'WHprocess_webhook_message_update Discarding notification. temp_webhook_endpoints undefined.',
      );
      return;
    }

    const endpoints = message['temp_webhook_endpoints'] as string[];
    delete message['temp_webhook_endpoints'];
    endpoints.forEach((endpoint) => {
      logger.debug(
        'Sending notification to webhook (message_update) on webhook_endpoint:' + endpoint,
      );
      const message_id = message.message_id;
      const recipient_id = message.recipient;
      const app_id = message.app_id;
      let event_type: string | undefined;
      if (message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.RECEIVED) {
        event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_RECEIVED;
      } else if (message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.RETURN_RECEIPT) {
        event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_RETURN_RECEIPT;
      }
      const json: Record<string, unknown> = {
        event_type,
        createdAt: new Date().getTime(),
        recipient_id,
        app_id,
        message_id,
        data: message,
        extras: { topic },
      };
      this.WHsendData(endpoint, json, (err, data) => {
        if (err) {
          logger.error('Err WHsendData callback', err);
        } else {
          logger.debug('WHsendData sendata end with data:' + data);
        }
      });
    });
  }

  WHprocess_webhook_conversation_archived(
    topic: string,
    payload: string,
    callback: WorkCallback,
  ): void {
    logger.debug('process webhook_conversation_archived on topic' + topic);
    logger.debug('process webhook_conversation_archived on payload' + payload);

    const conversation: Conversation = JSON.parse(payload);
    logger.debug("conversation['temp_field_chat_topic']", conversation['temp_field_chat_topic']);
    if (callback) {
      callback(true);
    }

    if (this.enabled === false) {
      logger.debug('Discarding notification. webhook_enabled is false.');
      return;
    }

    if (!conversation['temp_webhook_endpoints']) {
      logger.debug(
        'WHprocess_webhook_conversation_archived Discarding notification. temp_webhook_endpoints undefined.',
      );
      return;
    }

    const endpoints = conversation['temp_webhook_endpoints'] as string[];
    delete conversation['temp_webhook_endpoints'];
    endpoints.forEach((endpoint) => {
      logger.debug(
        'Sending notification to webhook (webhook_conversation_archived):',
        endpoint,
      );
      if (!conversation['temp_field_chat_topic']) {
        logger.debug("WHprocess_webhook_conversation_archived NO 'temp_field_chat_topic' error.");
      }
      const topic_parts = (conversation['temp_field_chat_topic'] as string).split('.');
      logger.debug('ARCHIVE. TOPIC PARTS:', topic_parts);
      if (topic_parts.length < 7) {
        logger.debug('process_archive topic error. topic_parts.length < 7:' + topic);
        return;
      }
      const app_id = topic_parts[1];
      const user_id = topic_parts[3];
      const convers_with = topic_parts[5];

      const json: Record<string, unknown> = {
        event_type: MessageConstants.WEBHOOK_EVENTS.CONVERSATION_ARCHIVED,
        createdAt: new Date().getTime(),
        app_id,
        user_id,
        recipient_id: convers_with,
        convers_with,
        data: conversation,
        extras: { topic: conversation['temp_field_chat_topic'] },
      };
      delete conversation['temp_field_chat_topic'];
      logger.debug('Sending JSON webhook:', json);
      this.WHsendData(endpoint, json, (err, data) => {
        if (err) {
          logger.error('Err WHsendData callback', err);
        } else {
          logger.debug('WHsendData sendata end with data:' + data);
        }
      });
    });
  }

  WHprocess_webhook_presence(
    topic: string,
    presence_payload_string: string,
    callback: WorkCallback,
  ): void {
    logger.debug(
      'process WHprocess_webhook_presence: ' + presence_payload_string + ' on topic: ' + topic,
    );
    const payload: Record<string, unknown> = JSON.parse(presence_payload_string);
    if (callback) {
      callback(true);
    }
    if (!payload['temp_webhook_endpoints']) {
      logger.debug(
        'WHprocess_webhook_presence Discarding notification. temp_webhook_endpoints undefined.',
      );
      return;
    }

    const endpoints = payload['temp_webhook_endpoints'] as string[];
    delete payload['temp_webhook_endpoints'];
    endpoints.forEach((endpoint) => {
      logger.debug(
        'Sending notification to webhook (presence) on webhook_endpoint:' + endpoint,
      );
      this.WHsendData(endpoint, payload, (err, data) => {
        if (err) {
          logger.error('Err WHsendData callback', err);
        } else {
          logger.debug('WHsendData sendata end with data:' + data);
        }
      });
    });
  }

  WHisMessageOnGroupTimeline(message: ChatMessage): boolean {
    if (message?.['timelineOf']) {
      if ((message['timelineOf'] as string).toLowerCase().includes('group')) {
        return true;
      }
    }
    return false;
  }

  // ─── HTTP delivery ─────────────────────────────────────────────────────────

  WHsendData(
    endpoint: string,
    json: Record<string, unknown>,
    callback: SendDataCallback,
  ): void {
    const q = url.parse(endpoint, true);
    const protocol = q.protocol === 'http:' ? http : https;
    const options: http.RequestOptions = {
      path: q.pathname ?? '/',
      host: q.hostname,
      port: q.port ?? undefined,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    logger.debug('Using request options:' + JSON.stringify(options));
    try {
      const req = protocol.request(options, (response) => {
        logger.debug(
          'statusCode: ' + response.statusCode + ' for webhook_endpoint: ' + endpoint,
        );
        if (
          response.statusCode !== undefined &&
          (response.statusCode < 200 || response.statusCode > 299)
        ) {
          logger.debug(
            'http statusCode error ' + response.statusCode + ' for webhook_endpoint: ' + endpoint,
          );
          return callback({ statusCode: response.statusCode }, null);
        }
        let respdata = '';
        response.on('data', (chunk: Buffer) => {
          respdata += chunk.toString();
        });
        response.on('end', () => {
          logger.debug('WEBHOOK RESPONSE: ' + respdata + ' for webhook_endpoint: ' + endpoint);
          return callback(null, respdata);
        });
      });
      req.on('error', (err: Error) => {
        logger.error('WEBHOOK RESPONSE Error: ', err);
        return callback(err, null);
      });
      req.write(JSON.stringify(json));
      req.end();
    } catch (err) {
      logger.error('An error occurred while posting this json ' + JSON.stringify(json), err);
      return callback(err as Error, null);
    }
  }

  // ─── AMQP infrastructure ───────────────────────────────────────────────────

  async whenConnected(): Promise<amqp.ConfirmChannel> {
    const ch = await this.startPublisher();
    logger.info('webhook publisher started.');
    this.startWorker();
    logger.info('webhook worker started.');
    return ch;
  }

  startPublisher(): Promise<amqp.ConfirmChannel> {
    return new Promise((resolve, reject) => {
      if (!this.amqpConn) {
        return reject(new Error('amqpConn not set'));
      }
      this.amqpConn.createConfirmChannel((err, ch) => {
        if (this.closeOnErr(err)) return;
        ch.on('error', (err) => {
          logger.error('[Webooks.AMQP] channel error', err);
        });
        ch.on('close', () => {
          logger.debug('[Webooks.AMQP] channel closed');
        });
        this.pubChannel = ch;
        resolve(ch);
      });
    });
  }

  closeOnErr(err: Error | null | undefined): boolean {
    if (!err) return false;
    logger.error('[Webooks.AMQP] error', err);
    this.amqpConn?.close();
    return true;
  }

  startWorker(): void {
    logger.debug('starting webhook worker.');
    if (!this.amqpConn) return;
    this.amqpConn.createChannel((err, ch) => {
      this.channel = ch;
      if (this.closeOnErr(err)) return;
      const sharedQueueOptions = {
        durable: true,
        exclusive: false,
        autoDelete: false,
      };
      ch.on('error', (err) => {
        logger.error('[Webooks.AMQP] channel error', err);
      });
      ch.on('close', () => {
        logger.debug('[Webooks.AMQP] channel closed');
      });
      ch.assertExchange(this.exchange, 'topic', { durable: this.durable_enabled });
      ch.assertQueue(this.queue, sharedQueueOptions, (err, _ok) => {
        if (this.closeOnErr(err)) return;
        logger.debug('subscribed to _ok.queue: ' + _ok.queue);
        this.subscribeTo(this.topic_webhook_message_deliver, ch, _ok.queue);
        this.subscribeTo(this.topic_webhook_message_update, ch, _ok.queue);
        this.subscribeTo(this.topic_webhook_conversation_archived, ch, _ok.queue);
        this.subscribeTo(this.topic_webhook_presence, ch, _ok.queue);
        ch.consume(this.queue, this.processMsg.bind(this), { noAck: true });
      });
    });
  }

  subscribeTo(topic: string, channel: amqp.Channel, queue: string): void {
    channel.bindQueue(queue, this.exchange, topic, {}, (err) => {
      if (err) {
        logger.error('Webooks.Error:', err, ' binding on queue:', queue, 'topic:', topic);
      } else {
        logger.info("Webhooks.bind: '" + queue + "' on topic: " + topic);
      }
    });
  }

  processMsg(msg: amqp.Message | null): void {
    if (!msg) return;
    this.work(msg, () => {
      logger.debug('Webhooks.worked.');
    });
  }

  work(msg: amqp.Message, callback: WorkCallback): void {
    logger.debug('Webhooks.NEW TOPIC...' + msg.fields.routingKey);
    const topic = msg.fields.routingKey;
    const message_string = msg.content.toString();
    if (topic.startsWith('observer.webhook.') && topic.endsWith('.message_deliver')) {
      this.WHprocess_webhook_message_deliver(topic, message_string, callback);
    } else if (topic.startsWith('observer.webhook.') && topic.endsWith('.message_update')) {
      this.WHprocess_webhook_message_update(topic, message_string, callback);
    } else if (topic.startsWith('observer.webhook.') && topic.endsWith('.conversation_archived')) {
      this.WHprocess_webhook_conversation_archived(topic, message_string, callback);
    } else if (topic.startsWith('observer.webhook.') && topic.endsWith('.presence')) {
      this.WHprocess_webhook_presence(topic, message_string, callback);
    } else {
      logger.error('Webooks.unhandled topic:', topic);
      callback(true);
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  start(): Promise<{ conn: amqp.Connection; ch: amqp.ConfirmChannel }> {
    logger.info('Webhook config: ', this);
    return new Promise((resolve, reject) => {
      this.startMQ(resolve, reject);
    });
  }

  private startMQ(
    resolve: (value: { conn: amqp.Connection; ch: amqp.ConfirmChannel }) => void,
    reject: (reason?: unknown) => void,
  ): void {
    logger.debug('Webooks. Connecting to RabbitMQ...');
    amqp.connect(this.RABBITMQ_URI, (err, conn) => {
      if (err) {
        logger.error('[Webooks.AMQP]', err);
        return setTimeout(() => {
          this.startMQ(resolve, reject);
        }, 1000);
      }
      conn.on('error', (err) => {
        if (err.message !== 'Connection closing') {
          logger.error('[Webooks.AMQP] conn error', err);
          reject(err);
        }
      });
      conn.on('close', () => {
        logger.error('[Webooks.AMQP] reconnecting');
        setTimeout(() => {
          this.startMQ(resolve, reject);
        }, 1000);
      });
      logger.info('Webooks. AMQP connected.');
      this.amqpConn = conn;
      this.whenConnected().then((ch) => {
        logger.debug('Webooks. whenConnected() returned');
        resolve({ conn, ch });
      });
    });
  }

  publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    callback: (err: Error | null) => void,
  ): void {
    try {
      logger.debug('Webooks.TRYING TO PUB...');
      if (!this.pubChannel) {
        return callback(new Error('pubChannel not initialized'));
      }
      this.pubChannel.publish(
        exchange,
        routingKey,
        content,
        { persistent: true },
        (err) => {
          if (err) {
            logger.error('[Webooks.AMQP] publish ERROR:', err);
            this.offlinePubQueue.push([exchange, routingKey, content]);
            this.pubChannel?.connection.close();
            callback(err);
          } else {
            callback(null);
          }
        },
      );
    } catch (e) {
      logger.error('[Webooks.AMQP] publish CATCHED ERROR:', e);
      this.offlinePubQueue.push([exchange, routingKey, content]);
      callback(e as Error);
    }
  }
}

// Module-level logger (set in constructor based on options)
let logger: TiledeskLogger = require('../tiledesk-logger').logger as TiledeskLogger;
