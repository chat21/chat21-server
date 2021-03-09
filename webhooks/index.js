/* 
    ver 0.1.0
    Andrea Sponziello - (c) Tiledesk.com
*/

var amqp = require('amqplib/callback_api');

/**
 * This is the class that manages webhooks
 */
class Webhooks {

  /**
   * Constructor for Persistence object
   *
   * @example
   * const { Webhooks } = require('webhooks');
   * const webhooks = new Webhooks({database: db});
   *
   */
  constructor(options) {
    // if (!options.database) {
    //   throw new Error('database option can NOT be empty.');
    // }
    if (!options.exchange) {
      throw new Error('exchange option can NOT be empty.');
    }
    if (!options.amqp) {
        throw new Error('amqp option can NOT be empty.');
    }
    if (!options.pubChannel) {
      throw new Error('pubChannel option can NOT be empty.');
    }
    if (!options.offlinePubQueue) {
      throw new Error('offlinePubQueue option can NOT be empty.');
    }
    this.amqp = options.amqp
    this.exchange = options.exchange
    this.pubChannel = options.pubChannel
    this.offlinePubQueue = options.offlinePubQueue
    winston.debug("webhooks inizialized: this.exchange:", this.exchange, "this.offlinePubQueue:", this.offlinePubQueue)
  }

  notifyMessageReceived(message) {
    winston.debug("NOTIFY MESSAGE:", message)
    const notify_topic = `observer.webhook.apps.${process.env.APP_ID}.message_received`
    winston.debug("notifying webhook notifyMessageReceived topic:", notify_topic)
    const message_payload = JSON.stringify(message)
    this.publish(this.exchange, notify_topic, Buffer.from(message_payload), (err) => {
      if (err) {
        winston.debug("Err", err)
      }
    })
  }

  process_webhook_message_received(topic, message_string, callback) {
    winston.debug("process_webhook_message_received.from.incoming:", message_string, "on topic", topic)
    var message = JSON.parse(message_string)
    winston.debug("timelineOf...:", message.timelineOf)
    if (callback) {
      callback(true)
    }
    
    if (this.isMessageOnGroupTimeline(message)) {
      winston.debug("Sending this message for group timeline:", message)
    }
    const message_id = message.message_id;
    const recipient_id = message.recipient_id;
    const app_id = message.app_id;
    
    var json = {
      event_type: "new-message",
      createdAt: new Date().getTime(),
      recipient_id: recipient_id,
      app_id: app_id,
      message_id: message_id,
      data: message
    };
  
    var q = url.parse(process.env.WEBHOOK_ENDPOINT, true);
    winston.debug("ENV WEBHOOK URL PARSED:", q)
    var protocol = (q.protocol == "http") ? require('http') : require('https');
    let options = {
      path:  q.pathname,
      host: q.hostname,
      port: q.port,
      method: 'POST',
      headers: {
        "Content-Type": "application/json"
      }
    };

    callback = function(response) {
      var respdata = ''
      response.on('data', function (chunk) {
        respdata += chunk;
      });
    
      response.on('end', function () {
        winston.debug("WEBHOOK RESPONSE:", respdata);
      });
    }
    
    var req = protocol.request(options, callback);
    req.write(json);
    req.end();
    
  }
  
  isMessageOnGroupTimeline(message) {
    if (message && message.timelineOf) {
      if (message.timelineOf.toLowerCase().indexOf("group") !== -1) {
        return true
      }
    }
    return false
  }

  publish(exchange, routingKey, content, callback) {
    try {
      winston.debug("TRYING TO PUB...")
      this.pubChannel.publish(exchange, routingKey, content, { persistent: true }, (err, ok) => {
          if (err) {
            console.error("[AMQP] publish ERROR:", err);
            this.offlinePubQueue.push([exchange, routingKey, content]);
            this.pubChannel.connection.close();
            callback(err)
          }
          else {
            callback(null)
          }
        });
    } catch (e) {
      console.error("[AMQP] publish CATCHED ERROR:", e);
      this.offlinePubQueue.push([exchange, routingKey, content]);
      callback(e)
    }
  }

  
}

module.exports = { Webhooks };