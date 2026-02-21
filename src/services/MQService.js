const amqp = require('amqplib');
const logger = require('../tiledesk-logger').logger;

class MQService {
  constructor(options = {}) {
    this.rabbitmq_uri = options.rabbitmq_uri;
    this.exchange = options.exchange || 'amq.topic';
    this.autoRestart = options.autoRestart !== false;
    this.prefetch_messages = options.prefetch_messages || 10;
    this.durable_enabled = options.durable_enabled !== false;
    this.active_queues = options.active_queues || { 'messages': true, 'persist': true };
    
    this.amqpConn = null;
    this.pubChannel = null;
    this.channel = null;
    this.offlinePubQueue = [];
  }

  async connect() {
    logger.debug("(MQService) Connecting to RabbitMQ...");
    try {
      this.amqpConn = await amqp.connect(this.rabbitmq_uri);
      this.amqpConn.on("error", (err) => {
        if (err.message !== "Connection closing") {
          logger.error("[MQService AMQP] conn error", err);
        }
      });
      this.amqpConn.on("close", () => {
        logger.info("[MQService AMQP] close");
        if (this.autoRestart) {
          logger.info("[MQService AMQP] reconnecting because of a disconnection");
          setTimeout(() => this.connect(), 1000);
        }
      });
      await this.startPublisher();
      return this.amqpConn;
    } catch (err) {
      logger.error("[MQService AMQP]", err);
      if (this.autoRestart) {
        logger.error("[MQService AMQP] reconnecting");
        setTimeout(() => this.connect(), 1000);
      } else {
        process.exit(1);
      }
    }
  }

  async startPublisher() {
    try {
      this.pubChannel = await this.amqpConn.createConfirmChannel();
      this.pubChannel.on("error", (err) => {
        logger.error("[MQService AMQP] channel error", err);
        process.exit(0);
      });
      return this.pubChannel;
    } catch (err) {
      logger.error("[MQService AMQP] publisher error", err);
      throw err;
    }
  }

  async publish(exchange, routingKey, content, callback) {
    if (routingKey.length > 255) {
      logger.error("routingKey invalid length (> 255).", routingKey.length);
      if (callback) callback(null);
      return;
    }
    try {
      if (!this.pubChannel) {
        throw new Error("Publisher channel not initialized");
      }
      await this.pubChannel.publish(exchange, routingKey, content, { persistent: true });
      if (callback) callback(null);
      return true;
    } catch (err) {
      logger.error("[MQService AMQP] publish error:", err);
      this.offlinePubQueue.push([exchange, routingKey, content]);
      if (callback) callback(err);
      throw err;
    }
  }

  async publishAsync(exchange, routingKey, content) {
    return await this.publish(exchange, routingKey, content);
  }

  async startWorker(topics, processMsg) {
    try {
      this.channel = await this.amqpConn.createChannel();
      this.channel.on("error", (err) => {
        logger.error("[MQService AMQP] channel error", err);
        process.exit(0);
      });
      
      this.channel.prefetch(this.prefetch_messages);
      await this.channel.assertExchange(this.exchange, 'topic', { durable: this.durable_enabled });

      if (this.active_queues['messages']) {
        const ok = await this.channel.assertQueue("messages", { durable: this.durable_enabled });
        const queue = ok.queue;
        topics.messages.forEach(topic => this.subscribeTo(topic, this.channel, queue));
        await this.channel.consume(queue, (msg) => this.handleMsg(msg, processMsg), { noAck: false });
      }
      if (this.active_queues['persist']) {
        const ok = await this.channel.assertQueue("persist", { durable: this.durable_enabled });
        const queue = ok.queue;
        topics.persist.forEach(topic => this.subscribeTo(topic, this.channel, queue));
        await this.channel.consume(queue, (msg) => this.handleMsg(msg, processMsg), { noAck: false });
      }
    } catch (err) {
      logger.error("[MQService AMQP] worker channel error", err);
    }
  }

  async subscribeTo(topic, channel, queue) {
    try {
      await channel.bindQueue(queue, this.exchange, topic, {});
      logger.info("Bound queue: '" + queue + "' on topic: " + topic);
    } catch (err) {
      logger.error("Error binding queue:", queue, "topic:", topic, err);
    }
  }

  async handleMsg(msg, processMsg) {
    if (!msg) return;
    try {
      const ok = await processMsg(msg);
      if (ok) this.channel.ack(msg);
      else this.channel.reject(msg, true);
    } catch (e) {
      logger.error("handleMsg error", e);
    }
  }

  async close(callback) {
    if (this.amqpConn) {
      try {
        await this.amqpConn.close();
        if (callback) callback();
      } catch (err) {
        if (callback) callback(err);
      }
    } else if (callback) {
      callback();
    }
  }
}

module.exports = MQService;
