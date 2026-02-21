/* 
    ver 0.1.0
    Andrea Sponziello - (c) Tiledesk.com
*/

const amqp = require('amqplib');
// const winston = require("../winston");
// const logger = require('../tiledesk-logger').logger;
let logger;
var url = require('url');
const MessageConstants = require("../models/messageConstants");
// const messageConstants = require('../models/messageConstants');

/**
 * This is the class that manages webhooks
 */
class Webhooks {

  /**
   * Constructor for Persistence object
   *
   * @example
   * const { Webhooks } = require('webhooks');
   * const webhooks = new Webhooks({appId: 'mychat'});
   *
   * @param {Object} options JSON configuration.
   * @param {Object} options.appId Mandatory. The appId.
   * @param {Object} options.exchange Mandatory. exchange name.
   * @param {Object} options.RABBITMQ_URI Mandatory. The RabbitMQ connection URI.
   * @param {Object} options.webhook_endpoints Optional. This weebhook endpoint.
   * @param {Object} options.queue_name Optional. The queue name. Defaults to 'weebhooks'.
   * @param {Object} options.webhook_events Optional. The active webhook events.
   * @param {Object} options.durable_enabled Optional. If true queues are declared as durable: true.
   * @param {Object} options.prefetch_messages Optional. How many prefecth from queue.
   * @param {Object} options.logger Optional. The logger.
   *
   */
  constructor(options) {
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
    // if (!options.webhook_endpoints) {
    //   throw new Error('webhook_endpoints option can NOT be empty.');
    // }
    if (options.logger) {
      logger = options.logger;
    } else {
      logger = require('../tiledesk-logger').logger;
    }
    // throw new Error('webhook_endpoint option can NOT be empty.......');
    this.webhook_endpoints = options.webhook_endpoints;
    this.RABBITMQ_URI = options.RABBITMQ_URI;
    this.appId = options.appId;
    this.topic_webhook_message_deliver = `observer.webhook.apps.${this.appId}.message_deliver`;
    this.topic_webhook_message_update = `observer.webhook.apps.${this.appId}.message_update`;
    // this.topic_webhook_message_received = `observer.webhook.apps.${this.appId}.message_received`;
    // this.topic_webhook_message_saved = `observer.webhook.apps.${this.appId}.message_saved`
    // this.topic_webhook_conversation_saved = `observer.webhook.apps.${this.appId}.conversation_saved`
    this.topic_webhook_conversation_archived = `observer.webhook.apps.${this.appId}.conversation_archived`;
    this.topic_webhook_presence = `observer.webhook.apps.${this.appId}.presence`;
    this.amqpConn = null;
    this.exchange = options.exchange;
    this.channel = null;
    this.pubChannel = null;
    this.offlinePubQueue = [];
    this.enabled = true;
    this.durable_enabled = options.durable_enabled || true;
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
    const http = require('http');
    const https = require('https');
    this.httpAgent = new http.Agent({keepAlive: true});
    this.httpsAgent = new https.Agent({keepAlive: true});
    logger.debug("webhooks inizialized: this.exchange:", this.exchange, "this.offlinePubQueue:", this.offlinePubQueue)
  }

  getWebHookEnabled() {
    return this.enabled;
  }

  setWebHookEnabled(enabled) {
    this.enabled = enabled;
    logger.log("Webhooks.enabled:", this.enabled);
  }

  getWebHookEndpoints() {
    return this.webhook_endpoints;
  }

  setWebHookEndpoints(endpoints) {
    this.webhook_endpoints = endpoints;
    logger.log("New webhook endpoints:", this.webhook_endpoints)
  }

  getWebHookEvents() {
    return this.webhook_events_array;
  }

  setWebHookEvents(events) {
    this.webhook_events_array = events;
  }

  async WHnotifyMessageStatusSentOrDelivered(message_payload, topic, callback) {
    if (this.enabled === false) {
      logger.debug("webhooks disabled");
      if (callback) {
        callback(null);
      }
      return;
    }
    logger.log("WHnotifyMessageStatusSentOrDelivered()", message_payload)
    let message;
    if (typeof message_payload === 'string') {
      message = JSON.parse(message_payload);
    } else {
      message = message_payload;
    }
    message['temp_field_chat_topic'] = topic;
    try {
      if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT) {
        logger.log("SENT...")
        const result = await this.WHnotifyMessageStatusSent(message);
        if (callback) callback(null, result);
        return result;
      } else if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED) {
        logger.log("DELIVERED...")
        const result = await this.WHnotifyMessageStatusDelivered(message);
        if (callback) callback(null, result);
        return result;
      } else {
        logger.log("STATUS NEITHER SENT OR DELIVERED...");
        if (callback) callback(null);
      }
    } catch (err) {
      if (callback) callback(err);
      throw err;
    }
  }

  async WHnotifyMessageStatusSent(message, callback) {
    if (this.enabled === false) {
      logger.debug("webhooks disabled");
      if (callback) callback(null);
      return;
    }
    logger.log("WH Sent method.");
    if (this.webhook_events_array.indexOf(MessageConstants.WEBHOOK_EVENTS.MESSAGE_SENT) == -1) {
      logger.debug("WH MESSAGE_SENT disabled.");
      if (callback) callback(null);
    } else {
      logger.log("WH MESSAGE_SENT enabled");
      try {
        const result = await this.WHnotifyMessageDeliver(message);
        if (callback) callback(null, result);
        return result;
      } catch (err) {
        if (callback) callback(err);
        throw err;
      }
    }
  }

  async WHnotifyMessageStatusDelivered(message, callback) {
    if (this.enabled === false) {
      logger.debug("webhooks disabled");
      if (callback) callback(null);
      return;
    }
    if (this.webhook_events_array.indexOf(MessageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED) == -1) {
      logger.debug("WH MESSAGE_DELIVERED disabled.");
      if (callback) callback(null);
    } else {
      logger.debug("WH MESSAGE_DELIVERED enabled.");
      try {
        const result = await this.WHnotifyMessageDeliver(message);
        if (callback) callback(null, result);
        return result;
      } catch (err) {
        if (callback) callback(err);
        throw err;
      }
    }
  }

  async WHnotifyMessageStatusReturnReceipt(message, callback) {
    if (this.enabled === false) {
      logger.debug("webhooks disabled");
      if (callback) callback(null);
      return;
    }
    if (this.webhook_events_array.indexOf(MessageConstants.WEBHOOK_EVENTS.MESSAGE_RETURN_RECEIPT) == -1) {
      logger.debug("WH MESSAGE_RETURN_RECEIPT disabled.");
      if (callback) callback(null);
    } else {
      try {
        const result = await this.WHnotifyMessageUpdate(message);
        if (callback) callback(null, result);
        return result;
      } catch (err) {
        if (callback) callback(err);
        throw err;
      }
    }
  }

  async WHnotifyMessageDeliver(message, callback) {
    if (this.enabled === false) {
      logger.debug("webhooks disabled");
      if (callback) callback(null);
      return;
    }
    message['temp_webhook_endpoints'] = this.webhook_endpoints;
    const notify_topic = `observer.webhook.apps.${this.appId}.message_deliver`
    logger.debug("notifying webhook MessageSent topic:" + notify_topic)
    const message_payload = JSON.stringify(message)
    logger.debug("MESSAGE_PAYLOAD: " + message_payload)
    try {
      const result = await this.publish(this.exchange, notify_topic, Buffer.from(message_payload));
      if (callback) callback(null, result);
      return result;
    } catch (err) {
      logger.error("Error publishing webhook WHnotifyMessageDeliver", err);
      if (callback) callback(err);
      throw err;
    }
  }

  async WHnotifyMessageUpdate(message, callback) {
    if (this.enabled === false) {
      logger.debug("webhooks disabled");
      if (callback) callback(null)
      return
    }
    logger.debug("NOTIFY MESSAGE UPDATE:", message);
    const notify_topic = `observer.webhook.apps.${this.appId}.message_update`
    logger.debug("notifying webhook message_update topic:" + notify_topic)
    const message_payload = JSON.stringify(message)
    logger.debug("MESSAGE_PAYLOAD: " + message_payload)
    try {
      const result = await this.publish(this.exchange, notify_topic, Buffer.from(message_payload));
      if (callback) callback(null, result);
      return result;
    } catch (err) {
      logger.error("Err", err)
      if (callback) callback(err)
      throw err;
    }
  }

  async WHnotifyConversationArchived(conversation, topic, callback) {
    if (this.enabled === false) {
      logger.debug("WHnotifyConversationArchived Discarding notification. webhook_enabled is false.");
      if (callback) callback(null);
      return;
    }
    logger.debug("NOTIFY CONVERSATION ARCHIVED:", conversation)
    conversation['temp_field_chat_topic'] = topic;
    const notify_topic = `observer.webhook.apps.${this.appId}.conversation_archived`
    logger.debug("notifying webhook notifyConversationArchived topic: " + notify_topic)
    const payload = JSON.stringify(conversation)
    logger.debug("PAYLOAD:", payload)
    try {
      const result = await this.publish(this.exchange, notify_topic, Buffer.from(payload));
      if (callback) callback(null, result);
      return result;
    } catch (err) {
      logger.error("Err", err)
      if (callback) callback(err)
      throw err;
    }
  }

  async WHprocess_webhook_message_deliver(topic, message_string, callback) {
    logger.debug("process WHprocess_webhook_message_deliver: " + message_string + " on topic: " + topic)
    var message = JSON.parse(message_string);
    if (callback) {
      callback(true);
    }
    
    if (!message['temp_webhook_endpoints']) {
      logger.debug("Error. WHprocess_webhook_message_deliver Discarding notification. webhook_endpoints undefined.")
      return;
    }

    let delivered_to_inbox_of = null;
    if (
        message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED ||
        message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT
        && message['temp_field_chat_topic']) {
      const topic_parts = message['temp_field_chat_topic'].split(".");
      if (topic_parts.length >= 4) {
        delivered_to_inbox_of = topic_parts[3]
      } else {
        logger.error("Error: inbox_of not found in topic:", topic);
        return;
      }
    } else {
      logger.error("Error. Topic processing error on message-delivered/message-sent event. Topic:", topic, ",message:", message);
      return;
    }

    const message_id = message.message_id;
    const recipient_id = message.recipient;
    const app_id = message.app_id;
    let event_type;
    if (message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT) {
      event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_SENT;
    } else {
      event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED;
    }
    var json = {
      event_type: event_type,
      createdAt: new Date().getTime(),
      recipient_id: recipient_id,
      app_id: app_id, 
      message_id: message_id,
      data: message,
      extras: {topic: message['temp_field_chat_topic']} 
    };
    if (delivered_to_inbox_of) {
      json['delivered_to'] = delivered_to_inbox_of;
    }
    delete message['temp_field_chat_topic']; 

    const endpoints = message['temp_webhook_endpoints'];
    delete message['temp_webhook_endpoints'];
    logger.log("Event JSON:" + JSON.stringify(json));
    
    const sendPromises = endpoints.map((endpoint) => {
      logger.debug("Sending notification to webhook (message_deliver) on webhook_endpoint:", endpoint);
      return this.WHsendData(endpoint, json).catch(err => {
        logger.error("Err WHsendData", err);
      });
    });
    await Promise.all(sendPromises);
  }

  async WHprocess_webhook_message_update(topic, message_string, callback) {
    logger.debug("process WHprocess_webhook_message_update: " + message_string + " on topic: " + topic)
    var message = JSON.parse(message_string)
    logger.debug("timelineOf:" + message.timelineOf)
    if (callback) {
      callback(true)
    }

    if (!message['temp_webhook_endpoints']) {
      logger.debug("WHprocess_webhook_message_update Discarding notification. temp_webhook_endpoints undefined.")
      return
    }

    const endpoints = message['temp_webhook_endpoints'];
    delete message['temp_webhook_endpoints'];
    
    const sendPromises = endpoints.map((endpoint) => {
      logger.debug("Sending notification to webhook (message_update) on webhook_endpoint:" + endpoint);
      const message_id = message.message_id;
      const recipient_id = message.recipient;
      const app_id = message.app_id;
      let event_type;
      if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.RECEIVED) {
        event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_RECEIVED;
      } else if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.RETURN_RECEIPT) {
        event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_RETURN_RECEIPT;
      }
      var json = {
        event_type: event_type,
        createdAt: new Date().getTime(),
        recipient_id: recipient_id,
        app_id: app_id,
        message_id: message_id,
        data: message,
        extras: {topic: topic}
      };
      return this.WHsendData(endpoint, json).catch(err => {
        logger.error("Err WHsendData", err);
      });
    });
    await Promise.all(sendPromises);
  }

  async WHprocess_webhook_conversation_archived(topic, payload, callback) {
    logger.debug("process webhook_conversation_archived on topic" + topic)
    logger.debug("process webhook_conversation_archived on payload" + payload)

    var conversation = JSON.parse(payload)
    logger.debug("conversation['temp_field_chat_topic']", conversation['temp_field_chat_topic']);
    if (callback) {
      callback(true)
    }

    if (this.enabled === false) {
      logger.debug("Discarding notification. webhook_enabled is false.");
      return
    }

    if (!conversation['temp_webhook_endpoints']) {
      logger.debug("WHprocess_webhook_conversation_archived Discarding notification. temp_webhook_endpoints undefined.")
      return
    }

    const endpoints = conversation['temp_webhook_endpoints'];
    delete conversation['temp_webhook_endpoints'];
    
    const sendPromises = endpoints.map((endpoint) => {
      logger.debug("Sending notification to webhook (webhook_conversation_archived):", endpoint)
      if (!conversation['temp_field_chat_topic']) {
        logger.debug("WHprocess_webhook_conversation_archived NO 'temp_field_chat_topic' error.")
      }
      var topic_parts = (conversation['temp_field_chat_topic'] || "").split(".")
      logger.debug("ARCHIVE. TOPIC PARTS:", topic_parts)
      if (topic_parts.length < 7) {
        logger.debug("process_archive topic error. topic_parts.length < 7:" + topic)
        return Promise.resolve();
      }
      const app_id = topic_parts[1];
      const user_id = topic_parts[3];
      const convers_with = topic_parts[5];

      var json = {
        event_type: MessageConstants.WEBHOOK_EVENTS.CONVERSATION_ARCHIVED,
        createdAt: new Date().getTime(),
        app_id: app_id,
        user_id: user_id, 
        recipient_id: convers_with,
        convers_with: convers_with,
        data: conversation,
        extras: {topic: conversation['temp_field_chat_topic']}
      };
      // delete conversation['temp_field_chat_topic']; // Move deletion outside of loop if possible or handle carefully
      logger.debug("Sending JSON webhook:", json)
      return this.WHsendData(endpoint, json).catch(err => {
        logger.error("Err WHsendData", err);
      });
    });
    await Promise.all(sendPromises);
    delete conversation['temp_field_chat_topic'];
  }

  async WHprocess_webhook_presence(topic, presence_payload_string, callback) {
    logger.debug("process WHprocess_webhook_presence: " + presence_payload_string + " on topic: " + topic)
    var payload = JSON.parse(presence_payload_string);
    if (callback) {
      callback(true)
    }
    if (!payload['temp_webhook_endpoints']) {
      logger.debug("WHprocess_webhook_presence Discarding notification. temp_webhook_endpoints undefined.")
      return
    }

    const endpoints = payload['temp_webhook_endpoints'];
    delete payload['temp_webhook_endpoints'];
    
    const sendPromises = endpoints.map((endpoint) => {
      logger.debug("Sending notification to webhook (presence) on webhook_endpoint:" + endpoint);
      return this.WHsendData(endpoint, payload).catch(err => {
        logger.error("Err WHsendData", err);
      });
    });
    await Promise.all(sendPromises);
  }

  WHisMessageOnGroupTimeline(message) {
    if (message && message.timelineOf) {
      if (message.timelineOf.toLowerCase().indexOf("group") !== -1) {
        return true
      }
    }
    return false
  }

  WHsendData(endpoint, json, callback) {
    return new Promise((resolve, reject) => {
      var q = url.parse(endpoint, true);
      var protocol = (q.protocol == "http:") ? require('http') : require('https');
      let agent = (q.protocol == "http:") ? this.httpAgent : this.httpsAgent;
      let options = {
        path: q.pathname,
        host: q.hostname,
        port: q.port,
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        agent: agent
      };
      
      logger.debug("Using request options:" + JSON.stringify(options));
      try {
        const req = protocol.request(options, (response) => {
          logger.debug("statusCode: " + response.statusCode + " for webhook_endpoint: " + endpoint);
          if (response.statusCode < 200 || response.statusCode > 299) {
            logger.debug("http statusCode error " + response.statusCode + " for webhook_endpoint: " + endpoint);
            const err = { statusCode: response.statusCode };
            if (callback) callback(err, null);
            return reject(err);
          }
          var respdata = '';
          response.on('data', (chunk) => {
            respdata += chunk;
          });
          response.on('end', () => {
            logger.debug("WEBHOOK RESPONSE: " + respdata + " for webhook_endpoint: " + endpoint);
            if (callback) callback(null, respdata);
            return resolve(respdata);
          });
        });
        req.on('error', (err) => {
          logger.error("WEBHOOK RESPONSE Error: ", err);
          if (callback) callback(err, null);
          return reject(err);
        });
        req.write(JSON.stringify(json));
        req.end();
      } catch (err) {
        logger.error("An error occurred while posting this json " + JSON.stringify(json), err)
        if (callback) callback(err, null);
        return reject(err);
      }
    });
  }

  async WHnotifyPresence(payload, callback) {
    if (this.enabled === false) {
      logger.debug("webhooks disabled");
      if (callback) callback(null);
      return;
    }
    payload['temp_webhook_endpoints'] = this.webhook_endpoints;
    const notify_topic = `observer.webhook.apps.${this.appId}.presence`
    logger.debug("notifying webhook Presence topic:" + notify_topic)
    const payload_string = JSON.stringify(payload)
    try {
      const result = await this.publish(this.exchange, notify_topic, Buffer.from(payload_string));
      if (callback) callback(null, result);
      return result;
    } catch (err) {
      logger.error("Err", err)
      if (callback) callback(err)
      throw err;
    }
  }

  async whenConnected() {
    await this.startPublisher();
    logger.info("webhook publisher started.");
    await this.startWorker();
    logger.info("webhook worker started.");
  }

  async startPublisher() {
    try {
      this.pubChannel = await this.amqpConn.createConfirmChannel();
      this.pubChannel.on("error", (err) => {
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

  closeOnErr(err) {
    if (!err) return false;
    logger.error("[Webooks.AMQP] error", err);
    this.amqpConn.close();
    return true;
  }

  async startWorker() {
    logger.debug("starting webhook worker.");
    try {
      this.channel = await this.amqpConn.createChannel();
      this.channel.on("error", (err) => {
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

  async subscribeTo(topic, channel, queue) {
    try {
      await channel.bindQueue(queue, this.exchange, topic, {});
      logger.info("Webhooks.bind: '" + queue + "' on topic: " + topic);
    } catch (err) {
      logger.error("Webooks.Error:", err, " binding on queue:", queue, "topic:", topic);
      throw err;
    }
  }

  async processMsg(msg) {
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
      this.amqpConn.on("error", (err) => {
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
    } catch (err) {
      logger.error("[Webooks.AMQP]", err.message);
      setTimeout(() => this.start(), 1000);
    }
  }

  async publish(exchange, routingKey, content, callback) {
    try {
      if (!this.pubChannel) {
        throw new Error("Publisher channel not initialized");
      }
      await this.pubChannel.publish(exchange, routingKey, content, { persistent: true });
      if (callback) callback(null);
      return true;
    } catch (e) {
      logger.error("[Webooks.AMQP] publish", e.message);
      if (callback) callback(e);
      throw e;
    }
  }

  async work(msg) {
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

