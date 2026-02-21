const amqp = require('amqplib/callback_api');
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
    return new Promise((resolve, reject) => {
      logger.debug("(MQService) Connecting to RabbitMQ...");
      amqp.connect(this.rabbitmq_uri, (err, conn) => {
        if (err) {
          logger.error("[MQService AMQP]", err);
          if (this.autoRestart) {
            logger.error("[MQService AMQP] reconnecting");
            return setTimeout(() => { this.connect().then(resolve).catch(reject) }, 1000);
          } else {
            process.exit(1);
          }
        }
        conn.on("error", (err) => {
          if (err.message !== "Connection closing") {
            logger.error("[MQService AMQP] conn error", err);
            return reject(err);
          }
        });
        conn.on("close", () => {
          logger.info("[MQService AMQP] close");
          if (this.autoRestart) {
            logger.info("[MQService AMQP] reconnecting because of a disconnection");
            return setTimeout(() => { this.connect().then(resolve).catch(reject) }, 1000);
          }
        });
        this.amqpConn = conn;
        this.startPublisher()
          .then(() => resolve(conn))
          .catch(reject);
      });
    });
  }

  startPublisher() {
    return new Promise((resolve, reject) => {
      this.amqpConn.createConfirmChannel((err, ch) => {
        if (err) {
          logger.error("[MQService AMQP] publisher error", err);
          return reject(err);
        }
        ch.on("error", (err) => {
          logger.error("[MQService AMQP] channel error", err);
          process.exit(0);
        });
        this.pubChannel = ch;
        resolve(ch);
      });
    });
  }

  publish(exchange, routingKey, content, callback) {
    if (routingKey.length > 255) {
      logger.error("routingKey invalid length (> 255).", routingKey.length);
      if (callback) callback(null);
      return;
    }
    try {
      this.pubChannel.publish(exchange, routingKey, content, { persistent: true }, (err, ok) => {
        if (err) {
          logger.error("[MQService AMQP] publish error:", err);
          this.offlinePubQueue.push([exchange, routingKey, content]);
          this.pubChannel.connection.close();
          if (callback) callback(err);
        } else if (callback) {
          callback(null);
        }
      });
    } catch (e) {
      logger.error("[MQService AMQP] publish catch:", e.message);
      this.offlinePubQueue.push([exchange, routingKey, content]);
      if (callback) callback(e);
    }
  }

  publishAsync(exchange, routingKey, content) {
    return new Promise((resolve, reject) => {
      this.publish(exchange, routingKey, content, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  startWorker(topics, processMsg) {
    this.amqpConn.createChannel((err, ch) => {
      if (err) {
        logger.error("[MQService AMQP] worker channel error", err);
        return;
      }
      this.channel = ch;
      ch.on("error", (err) => {
        logger.error("[MQService AMQP] channel error", err);
        process.exit(0);
      });
      
      ch.prefetch(this.prefetch_messages);
      ch.assertExchange(this.exchange, 'topic', { durable: this.durable_enabled });

      if (this.active_queues['messages']) {
        ch.assertQueue("messages", { durable: this.durable_enabled }, (err, _ok) => {
          if (err) return;
          const queue = _ok.queue;
          topics.messages.forEach(topic => this.subscribeTo(topic, ch, queue));
          ch.consume(queue, (msg) => this.handleMsg(msg, processMsg), { noAck: false });
        });
      }
      if (this.active_queues['persist']) {
        ch.assertQueue("persist", { durable: this.durable_enabled }, (err, _ok) => {
          if (err) return;
          const queue = _ok.queue;
          topics.persist.forEach(topic => this.subscribeTo(topic, ch, queue));
          ch.consume(queue, (msg) => this.handleMsg(msg, processMsg), { noAck: false });
        });
      }
    });
  }

  subscribeTo(topic, channel, queue) {
    channel.bindQueue(queue, this.exchange, topic, {}, (err) => {
      if (err) logger.error("Error binding queue:", queue, "topic:", topic, err);
      else logger.info("Bound queue: '" + queue + "' on topic: " + topic);
    });
  }

  handleMsg(msg, processMsg) {
    if (!msg) return;
    processMsg(msg, (ok) => {
      try {
        if (ok) this.channel.ack(msg);
        else this.channel.reject(msg, true);
      } catch (e) {
        logger.error("handleMsg error", e);
      }
    });
  }

  close(callback) {
    if (this.amqpConn) {
      this.amqpConn.close(callback);
    } else if (callback) {
      callback();
    }
  }
}

module.exports = MQService;
