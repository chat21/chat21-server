class PresenceObserver {

    /**
     * Constructor for MessagingObserver object
     *
     * @example
     * const { MessagingObserver } = require('tiledesk-messaging-observer');
     * const tdq = new TiledeskQueuesManager({database: value});
     * 
     * @param {Object} options JSON configuration.
     * @param {Object} options.database Mandatory. Mongodb database.
     * 
     */
    constructor(options) {
      if (!options.database) {
        throw new Error('Databse can NOT be empty.');
      }
      this.chatdb = options.database;
      if (!options.RABBITMQ_URI) {
        throw new Error('Databse can NOT be empty.');
      }
      this.RABBITMQ_URI = options.RABBITMQ_URI;
      this.amqpConn = null;
      this.channel = null;
    }

    startServer() {
        winston.debug('Starting observer.')
        const amqpConnection = await startMQ();
        winston.debug("[AMQP] connected.");
    }

    startMQ() {
        return new Promise(function (resolve, reject) {
            winston.debug("Connecting to RabbitMQ...")
            amqp.connect(this.RABBITMQ_URI, (err, conn) => {
                if (err) {
                    winston.error("[AMQP]", err);                    
                    return setTimeout(() => { startMQ() }, 1000);
                }
                conn.on("error", (err) => {
                    if (err.message !== "Connection closing") {
                      winston.error("[AMQP] conn error", err);
                        return reject(err);
                    }
                });
                conn.on("close", () => {
                    console.error("[AMQP] reconnecting");
                    return setTimeout(() => { startMQ() }, 1000);
                });
                amqpConn = conn;
                whenConnected().then(function(ch) {
                  winston.debug("whenConnected() returned")
                  return resolve({conn: conn, ch: ch});
                });
            });
        });
    }

    startWorker() {
        amqpConn.createChannel(function (err, ch) {
          channel = ch;
          if (closeOnErr(err)) return;
          ch.on("error", function (err) {
            winston.error("[AMQP] channel error", err);
          });
          ch.on("close", function () {
            winston.debug("[AMQP] channel closed");
          });
          ch.prefetch(10);
          ch.assertExchange(exchange, 'topic', {
            durable: true
          });
          ch.assertQueue("jobs", { durable: true }, function (err, _ok) {
            if (closeOnErr(err)) return;
            subscribeTo(topic_presence, ch, _ok.queue)
            ch.consume("jobs", processMsg, { noAck: false });
          });
        });
    }

    subscribeTo(topic, channel, queue) {
        channel.bindQueue(queue, exchange, topic, {}, function (err, oka) {
          if (err) {
            winston.error("Error:", err, " binding on queue:", queue, "topic:", topic)
          }
          else {
            winston.info("bind: '" + queue + "' on topic: " + topic);
          }
        });
    }
      
    processMsg(msg) {
        work(msg, function (ok) {
          try {
            if (ok)
              channel.ack(msg);
            else
              channel.reject(msg, true);
          } catch (e) {
            winston.debug("gin:", e)
            closeOnErr(e);
          }
        });
    }
      
    work(msg, callback) {
        winston.debug("NEW TOPIC:"+msg.fields.routingKey) //, " message:", msg.content.toString());
        const topic = msg.fields.routingKey //.replace(/[.]/g, '/');
        const message_string = msg.content.toString();
        if (topic.includes('.presence.')) {
          process_presence(topic, message_string, callback);
        }
    }
      
    // ***** TOPIC HANDLERS ******/
    
    process_presence(topic, message_string, callback) {
        winston.debug("got PRESENCE testament", message_string, " on topic", topic)
        callback(true)
    }
}