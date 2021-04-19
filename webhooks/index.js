/* 
    ver 0.1.0
    Andrea Sponziello - (c) Tiledesk.com
*/

const amqp = require('amqplib/callback_api');
const winston = require("../winston");
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
   * @param {Object} options.webhook_endpoint Mandatory. This weebhook endpoint.
   * @param {Object} options.queue_name Optional. The queue name. Defaults to 'weebhooks'.
   * @param {Object} options.webhook_events Optional. The active webhook events.
   * 
   */
  constructor(options) {
    // if (!options.database) {
    //   throw new Error('database option can NOT be empty.');
    // }
    // if (!options.exchange) {
    //   throw new Error('exchange option can NOT be empty.');
    // }
    // if (!options.amqp) {
    //     throw new Error('amqp option can NOT be empty.');
    // }
    // if (!options.pubChannel) {
    //   throw new Error('pubChannel option can NOT be empty.');
    // }
    // if (!options.offlinePubQueue) {
    //   throw new Error('offlinePubQueue option can NOT be empty.');
    // }

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
    if (!options.webhook_endpoint) {
      throw new Error('webhook_endpoint option can NOT be empty.');
    }
    this.webhook_endpoint = options.webhook_endpoint;
    this.RABBITMQ_URI = options.RABBITMQ_URI;
    this.appId = options.appId;
    this.topic_webhook_message_deliver = `observer.webhook.apps.${this.appId}.message_deliver`;
    this.topic_webhook_message_update = `observer.webhook.apps.${this.appId}.message_update`;
    // this.topic_webhook_message_received = `observer.webhook.apps.${this.appId}.message_received`;
    // this.topic_webhook_message_saved = `observer.webhook.apps.${this.appId}.message_saved`
    // this.topic_webhook_conversation_saved = `observer.webhook.apps.${this.appId}.conversation_saved`
    this.topic_webhook_conversation_archived = `observer.webhook.apps.${this.appId}.conversation_archived`;
    this.amqpConn = null;
    this.exchange = options.exchange;
    this.channel = null;
    this.pubChannel = null;
    this.offlinePubQueue = [];
    this.enabled = true
    this.queue = options.queue_name || 'webhooks';
    const DEFAULT_WEBHOOK_EVENTS = [
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_SENT,
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED,
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_RECEIVED,
      MessageConstants.WEBHOOK_EVENTS.MESSAGE_RETURN_RECEIPT,
    ]
    this.webhook_events = options.webhook_events || DEFAULT_WEBHOOK_EVENTS;
    winston.debug("webhooks inizialized: this.exchange:", this.exchange, "this.offlinePubQueue:", this.offlinePubQueue)
  }

  // WHnotifyMessageReceived
  // notifyMessageReceived(message) {
  //   winston.debug("NOTIFY MESSAGE:", message)
  //   const notify_topic = `observer.webhook.apps.${app_id}.message_received`
  //   winston.debug("notifying webhook notifyMessageReceived topic:", notify_topic)
  //   const message_payload = JSON.stringify(message)
  //   this.publish(this.exchange, notify_topic, Buffer.from(message_payload), (err) => {
  //     if (err) {
  //       winston.debug("Err", err)
  //     }
  //   })
  // }
  

  // WHprocess_webhook_message_received
  // process_webhook_message_received(topic, message_string, callback) {
  //   winston.debug("process_webhook_message_received.from.incoming:", message_string, "on topic", topic)
  //   var message = JSON.parse(message_string)
  //   winston.debug("timelineOf...:", message.timelineOf)
  //   if (callback) {
  //     callback(true)
  //   }
    
  //   if (this.isMessageOnGroupTimeline(message)) {
  //     winston.debug("Sending this message for group timeline:", message)
  //   }
  //   const message_id = message.message_id;
  //   const recipient_id = message.recipient_id;
  //   const app_id = message.app_id;
    
  //   var json = {
  //     event_type: "new-message",
  //     createdAt: new Date().getTime(),
  //     recipient_id: recipient_id,
  //     app_id: app_id,
  //     message_id: message_id,
  //     data: message
  //   };
  
  //   var q = url.parse(process.env.WEBHOOK_ENDPOINT, true);
  //   winston.debug("ENV WEBHOOK URL PARSED:", q)
  //   var protocol = (q.protocol == "http") ? require('http') : require('https');
  //   let options = {
  //     path:  q.pathname,
  //     host: q.hostname,
  //     port: q.port,
  //     method: 'POST',
  //     headers: {
  //       "Content-Type": "application/json"
  //     }
  //   };

  //   callback = function(response) {
  //     var respdata = ''
  //     response.on('data', function (chunk) {
  //       respdata += chunk;
  //     });
    
  //     response.on('end', function () {
  //       winston.debug("WEBHOOK RESPONSE:", respdata);
  //     });
  //   }
    
  //   var req = protocol.request(options, callback);
  //   req.write(json);
  //   req.end();
    
  // }
  
  
  // WHisMessageOnGroupTimeline
  // isMessageOnGroupTimeline(message) {
  //   if (message && message.timelineOf) {
  //     if (message.timelineOf.toLowerCase().indexOf("group") !== -1) {
  //       return true
  //     }
  //   }
  //   return false
  // }
  

  // ************ WEBHOOKS *********** //

  WHnotifyMessageStatusSentOrDelivered(message_payload, callback) {
    console.log("WHnotifyMessageStatusSentOrDelivered", message_payload)
    const message = JSON.parse(message_payload);
    if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT) {
      console.log("SENT...")
      this.WHnotifyMessageStatusSent(message, (err) => {
        if (callback) {
          callback(err);
        }
        else {
          callback(null);
        }
      })
    }
    else if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED) {
      console.log("DELIVERED...")
      this.WHnotifyMessageStatusDelivered(message, (err) => {
        if (callback) {
          callback(err);
        }
        else {
          callback(null);
        }
      })
    }
  }

  WHnotifyMessageStatusSent(message, callback) {
    console.log("WH Sent method.");
    if (this.webhook_events.indexOf(MessageConstants.WEBHOOK_EVENTS.MESSAGE_SENT) == -1) {
      winston.debug("WH MESSAGE_SENT disabled.");
      callback(null);
    } else {
      console.log("WH MESSAGE_SENT enabled");
      winston.debug("WH MESSAGE_DELIVERED enabled.");
      this.WHnotifyMessageDeliver(message, (err) => {
        callback(err);
      });
    }
  }

  WHnotifyMessageStatusDelivered(message, callback) {
    if (this.webhook_events.indexOf(MessageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED) == -1) {
      winston.debug("WH MESSAGE_DELIVERED disabled.");
      callback(null);
    } else {
      winston.debug("WH MESSAGE_DELIVERED enabled.");
      this.WHnotifyMessageDeliver(message, (err) => {
        callback(err);
      });
    }
  }

  WHnotifyMessageStatusReturnReceipt(message, callback) {
    if (this.webhook_events.indexOf(MessageConstants.WEBHOOK_EVENTS.MESSAGE_RETURN_RECEIPT) == -1) {
      winston.debug("WH MESSAGE_RETURN_RECEIPT disabled.");
      callback(null);
    } else {
      this.WHnotifyMessageUpdate(message, (err) => {
        callback(err);
      });
    }
  }

  WHnotifyMessageDeliver(message, callback) {
    winston.debug("WH NOTIFY MESSAGE:", message);
    if (this.enabled===false) {
      winston.debug("webhooks disabled");
      callback(null)
      return
    }
    const notify_topic = `observer.webhook.apps.${this.appId}.message_deliver`
    winston.debug("notifying webhook MessageSent topic:" + notify_topic)
    const message_payload = JSON.stringify(message)
    winston.debug("MESSAGE_PAYLOAD: " + message_payload)
    this.publish(this.exchange, notify_topic, Buffer.from(message_payload), (err) => {
      if (err) {
        winston.error("Err", err)
        callback(err)
      }
      else {
        callback(null)
      }
    })
  }

  WHnotifyMessageUpdate(message, callback) {
    winston.debug("NOTIFY MESSAGE UPDATE:", message);
    if (this.enabled===false) {
      winston.debug("webhooks disabled");
      callback(null)
      return
    }
    const notify_topic = `observer.webhook.apps.${this.appId}.message_update`
    winston.debug("notifying webhook message_update topic:" + notify_topic)
    const message_payload = JSON.stringify(message)
    winston.debug("MESSAGE_PAYLOAD: " + message_payload)
    this.publish(this.exchange, notify_topic, Buffer.from(message_payload), (err) => {
      if (err) {
        winston.error("Err", err)
        callback(err)
      }
      else {
        callback(null)
      }
    })
  }

  

// WHnotifyMessageReceived(message, callback) {
//   winston.debug("NOTIFY MESSAGE:", message);
  
//   if (this.enabled===false) {
//     winston.debug("WHnotifyMessageReceived Discarding notification. webhook_enabled is false.");
//     // callback({err: "WHnotifyMessageReceived Discarding notification. webhook_enabled is false."}); 
//     callback(null)
//     return
//   }

//   const notify_topic = `observer.webhook.apps.${this.appId}.message_received`
//   winston.debug("notifying webhook notifyMessageReceived topic:" + notify_topic)
//   const message_payload = JSON.stringify(message)
//   winston.debug("MESSAGE_PAYLOAD: " + message_payload)
//   this.publish(this.exchange, notify_topic, Buffer.from(message_payload), (err) => {
//     if (err) {
//       winston.error("Err", err)
//       callback(err)
//     }
//     else {
//       callback(null)
//     }
//   })
// }

WHnotifyConversationArchived(conversation, callback) {
  winston.debug("NOTIFY CONVERSATION ARCHIVED:", conversation)

  if (this.enabled===false) {
    winston.debug("WHnotifyConversationArchived Discarding notification. webhook_enabled is false.");
    // callback({err: "WHnotifyConversationArchived Discarding notification. webhook_enabled is false."}); 
    callback(null)
    return
  }

  const notify_topic = `observer.webhook.apps.${this.appId}.conversation_archived`
  winston.debug("notifying webhook notifyConversationArchived topic: " + notify_topic)
  const payload = JSON.stringify(conversation)
  winston.debug("PAYLOAD:", payload)
  this.publish(exchange, notify_topic, Buffer.from(payload), (err) => {
    if (err) {
      winston.error("Err", err)
      callback(err)
    }
    else {
      callback(null)
    }
  })
}

// WHprocess_webhook_message_received(topic, message_string, callback) {
//   winston.debug("process webhook_message_received: " + message_string + " on topic: " + topic)
//   var message = JSON.parse(message_string)
//   winston.debug("timelineOf...:" + message.timelineOf)
//   if (callback) {
//     callback(true)
//   }
//   if (this.enabled===false) {
//     winston.debug("WHprocess_webhook_message_received Discarding notification. webhook_enabled is false.");
//     // callback(true); 
//     return
//   }

//   // if (!this.WHisMessageOnGroupTimeline(message)) {
//   //   winston.debug("WHprocess_webhook_message_received Discarding notification. Not to group.");
//   //   // callback(true); 
//   //   return
//   // }
//   if (!this.webhook_endpoint) {
//     winston.debug("WHprocess_webhook_message_received Discarding notification. webhook_endpoint is undefined.")
//     // callback(true);
//     return
//   }
//   if (this.webhook_methods_array.indexOf("new-message")==-1) {
//     winston.debug("WHprocess_webhook_message_received Discarding notification. new-message not enabled.");
//     // callback(true); 
//     return
//   }

//   winston.verbose("Sending notification to webhook (webhook_message_received) on webhook_endpoint:", this.webhook_endpoint)
//   const message_id = message.message_id;
//   const recipient_id = message.recipient;
//   const app_id = message.app_id;
//   var json = {
//     event_type: "new-message",
//     createdAt: new Date().getTime(),
//     recipient_id: recipient_id,
//     app_id: app_id, // or this.appId?
//     message_id: message_id,
//     data: message
//   };
//   winston.debug("WHprocess_webhook_message_received Sending JSON webhook:", json)
//   this.WHsendData(json, function(err, data) {
//     if (err)  {
//       winston.error("Err WHsendData callback", err);
//     } else {
//       winston.debug("WHsendData sendata end with data:" + data);
//     }
//   })
// }

WHprocess_webhook_message_deliver(topic, message_string, callback) {
  winston.debug("process WHprocess_webhook_message_deliver: " + message_string + " on topic: " + topic)
  var message = JSON.parse(message_string)
  if (callback) {
    callback(true)
  }
  // if (this.enabled===false) {
  //   winston.debug("WHprocess_webhook_message_deliver Discarding notification. webhook_enabled is false.");
  //   return
  // }

  // if (!this.WHisMessageOnGroupTimeline(message)) {
  //   winston.debug("WHprocess_webhook_message_deliver Discarding notification. Not to group.");
  //   // callback(true);
  //   return
  // }
  if (!this.webhook_endpoint) {
    winston.debug("WHprocess_webhook_message_deliver Discarding notification. webhook_endpoint is undefined.")
    // callback(true);
    return
  }
  // if (this.webhook_methods_array.indexOf("new-message")==-1) {
  //   winston.debug("WHprocess_webhook_message_deliver Discarding notification. new-message not enabled.");
  //   // callback(true); 
  //   return
  // }

  winston.verbose("Sending notification to webhook (message_deliver) on webhook_endpoint:" + this.webhook_endpoint);
  const message_id = message.message_id;
  const recipient_id = message.recipient;
  const app_id = message.app_id;
  let event_type;
  if (message.status === MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT) {
    event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_SENT;
  }
  else {
    event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED;
  }
  var json = {
    event_type: event_type,
    createdAt: new Date().getTime(),
    recipient_id: recipient_id,
    app_id: app_id, // or this.appId?
    message_id: message_id,
    data: message
  };
  winston.debug("WHprocess_webhook_message_received Sending JSON webhook:", json)
  this.WHsendData(json, function(err, data) {
    if (err)  {
      winston.error("Err WHsendData callback", err);
    } else {
      winston.debug("WHsendData sendata end with data:" + data);
    }
  })
}

WHprocess_webhook_message_update(topic, message_string, callback) {
  winston.debug("process WHprocess_webhook_message_update: " + message_string + " on topic: " + topic)
  var message = JSON.parse(message_string)
  winston.debug("timelineOf:" + message.timelineOf)
  if (callback) {
    callback(true)
  }
  if (!this.webhook_endpoint) {
    winston.debug("WHprocess_webhook_message_deliver Discarding notification. webhook_endpoint is undefined.")
    return
  }
  winston.verbose("Sending notification to webhook (message_deliver) on webhook_endpoint:" + this.webhook_endpoint);
  const message_id = message.message_id;
  const recipient_id = message.recipient;
  const app_id = message.app_id;
  let event_type;
  if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.RECEIVED) {
    event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_RECEIVED;
  }
  else if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.RETURN_RECEIPT) {
    event_type = MessageConstants.WEBHOOK_EVENTS.MESSAGE_RETURN_RECEIPT;
  }
  var json = {
    event_type: event_type,
    createdAt: new Date().getTime(),
    recipient_id: recipient_id,
    app_id: app_id, // or this.appId?
    message_id: message_id,
    data: message
  };
  winston.debug("WHprocess_webhook_message_received Sending JSON webhook:", json)
  this.WHsendData(json, function(err, data) {
    if (err)  {
      winston.error("Err WHsendData callback", err);
    } else {
      winston.debug("WHsendData sendata end with data:" + data);
    }
  })
}

// WHprocess_webhook_message_saved(topic, message_string, callback) {
//   winston.debug("process webhook_message_saved: " + message_string + " on topic: " + topic)
//   var message = JSON.parse(message_string)
//   winston.debug("timelineOf...: " + message.timelineOf)
//   if (callback) {
//     callback(true)
//   }

//   if (enabled===false) {
//     winston.debug("WHprocess_webhook_message_saved Discarding notification. webhook_enabled is false.");
//     // callback(true); 
//     return
//   }

//   if (!WHisMessageOnGroupTimeline(message)) {
//     winston.debug("WHprocess_webhook_message_saved Discarding notification. Not to group.")
//     return
//   } else if (!webhook_endpoint) {
//     winston.debug("WHprocess_webhook_message_saved Discarding notification. webhook_endpoint is undefined.")
//     return
//   }

//   if (webhook_methods_array.indexOf("new-message-saved")==-1) {
//     winston.debug("WHprocess_webhook_message_saved Discarding notification. new-message-saved not enabled.");
//     // callback(true); 
//     return
//   }

//   winston.verbose("Sending notification to webhook (webhook_message_saved) on webhook_endpoint:", webhook_endpoint)
//   const message_id = message.message_id;
//   const recipient_id = message.recipient;
//   const app_id = message.app_id;
//   var json = {
//     event_type: "new-message-saved",
//     createdAt: new Date().getTime(),
//     recipient_id: recipient_id,
//     app_id: app_id,
//     message_id: message_id,
//     data: message
//   };
//   winston.debug("WHprocess_webhook_message_saved Sending JSON webhook:", json)
//   this.WHsendData(json, function(err, data) {
//     if (err)  {
//       winston.error("Err WHsendData callback", err);
//     } else {
//       winston.debug("WHsendData sendata end with data:" + data);
//     }
//   })
// }


// WHprocess_webhook_conversation_saved(topic, conversation_string, callback) {
//   winston.debug("process webhook_conversation_saved:" + conversation_string + "on topic" + topic)
//   var conversation = JSON.parse(conversation_string)

//   if (callback) {
//     callback(true)
//   }
  
//   if (enabled===false) {
//     winston.debug("Discarding notification. webhook_enabled is false.");
//     // callback(true); 
//     return
//   }

//   if (!webhook_endpoint) {
//     winston.debug("Discarding notification. webhook_endpoint is undefined.")
//     return
//   }

//   if (webhook_methods_array.indexOf("conversation-saved")==-1) {
//     winston.debug("Discarding notification. conversation-saved not enabled.");
//     // callback(true); 
//     return
//   }

//   winston.verbose("Sending notification to webhook (webhook_conversation_saved) on webhook_endpoint:"+ webhook_endpoint + " coonversation: " + conversation_string)
//   // const message_id = message.message_id;
//   // const recipient_id = message.recipient;
//   const app_id = conversation.app_id;
//   var json = {
//     event_type: "conversation-saved",
//     createdAt: new Date().getTime(),
//     // recipient_id: recipient_id,
//     app_id: app_id,
//     // message_id: message_id,
//     data: conversation
//   };
//   winston.debug("Sending JSON webhook:", json)
//   this.WHsendData(json, function(err, data) {
//     if (err)  {
//       winston.error("Err WHsendData callback", err);
//     } else {
//       winston.debug("WHsendData sendata end with data:" + data);
//     }    
//   })
// }

WHprocess_webhook_conversation_archived(topic, message_string, callback) {
  winston.debug("process webhook_conversation_archived:", message_string, "on topic", topic)
  var conversation = JSON.parse(message_string)
  if (callback) {
    callback(true)
  }

  if (this.enabled===false) {
    winston.debug("Discarding notification. webhook_enabled is false.");
    // callback(true); 
    return
  }

  // if (!WHisMessageOnGroupTimeline(message)) {
  //   winston.debug("Discarding notification. Not to group.")
  //   return
  // }

  if (!this.webhook_endpoint) {
    winston.debug("WHprocess_webhook_conversation_archived: Discarding notification. webhook_endpoint is undefined.")
    return
  }

  if (this.webhook_methods_array.indexOf("deleted-conversation")==-1) {
    winston.debug("Discarding notification. deleted-conversation not enabled.");
    // callback(true); 
    return
  }

  winston.verbose("Sending notification to webhook (webhook_conversation_archived):", this.webhook_endpoint)
  const conversWith = conversation.conversWith;
  const timelineOf = "system"; // conversation.timelineOf; temporary patch for Tiledesk

  chatdb.getConversation(timelineOf, conversWith, function(err, conversation) {
    var json = {
      event_type: "deleted-conversation",
      createdAt: new Date().getTime(),
      app_id: conversation.app_id,
      user_id: "system", // temporary patch for Tiledesk
      recipient_id: conversWith,
      data: conversation
    };
    winston.debug("Sending JSON webhook:", json)
    this.WHsendData(json, function(err, data) {
      if (err)  {
        winston.error("Err WHsendData callback", err);
      } else {
        winston.debug("WHsendData sendata end with data:" + data);
      }    
    })
  })
}

WHisMessageOnGroupTimeline(message) {
  if (message && message.timelineOf) {
    if (message.timelineOf.toLowerCase().indexOf("group") !== -1) {
      return true
    }
  }
  return false
}

WHsendData(json, callback) {
  var q = url.parse(this.webhook_endpoint, true);
  winston.debug("ENV WEBHOOK URL PARSED:", q)
  var protocol = (q.protocol == "http:") ? require('http') : require('https');
  let options = {
    path:  q.pathname,
    host: q.hostname,
    port: q.port,
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    }
  };
  try {
    const req = protocol.request(options, (response) => {
      winston.debug("statusCode: "+  response.statusCode + " for webhook_endpoint: " + this.webhook_endpoint);
      if (response.statusCode < 200 || response.statusCode > 299) { // (I don"t know if the 3xx responses come here, if so you"ll want to handle them appropriately
        winston.debug("http statusCode error "+  response.statusCode + " for webhook_endpoint: " + this.webhook_endpoint);
        return callback({statusCode:response.statusCode}, null)
      }
      var respdata = ''
      response.on('data', (chunk) => {
        // winston.debug("chunk"+chunk)
        respdata += chunk;
      });
      response.on('end', () => {
        winston.info("WEBHOOK RESPONSE: "+ respdata + " for webhook_endpoint: " + this.webhook_endpoint);
        return callback(null, respdata) //TODO SE IL WEBHOOK NN RITORNA SEMBRA CHE SI BLOCCI
      });
    });
    req.on('error', (err) => {
      winston.error("WEBHOOK RESPONSE Error: ", err);
      return callback(err, null)
    });
    req.write(JSON.stringify(json));
    req.end();
    // winston.debug("end")
  }
  catch(err) {
    winston.error("an error occurred while posting this json " + JSON.stringify(json), err)
    return callback(err, null)
  }
}

async whenConnected() {
  const resolve = await this.startPublisher();
  this.startWorker();
  return resolve;
}

startPublisher() {
  const that = this;
  return new Promise(function (resolve, reject) {
      that.amqpConn.createConfirmChannel( (err, ch) => {
          if (that.closeOnErr(err)) return;
          ch.on("error", function (err) {
              winston.error("[Webooks.AMQP] channel error", err);
          });
          ch.on("close", function () {
              winston.debug("[Webooks.AMQP] channel closed");
          });
          that.pubChannel = ch;
          if (that.offlinePubQueue.length > 0) {
              // while (true) {
              //     var m = this.offlinePubQueue.shift();
              //     if (!m) break;
              //     this.publish(m[0], m[1], m[2]);
              //   }

              while (true) {
                  var [exchange, routingKey, content] = offlinePubQueue.shift();
                  that.publish(exchange, routingKey, content);
              }
          }
          return resolve(ch)
      });
  });
}

closeOnErr(err) {
  if (!err) return false;
  console.error("[Webooks.AMQP] error", err);
  this.amqpConn.close();
  return true;
}

startWorker() {
  // const that = this;
  this.amqpConn.createChannel((err, ch) => {
    this.channel = ch;
    if (this.closeOnErr(err)) return;
    ch.on("error", function (err) {
      winston.error("[Webooks.AMQP] channel error", err);
    });
    ch.on("close", function () {
      winston.debug("[Webooks.AMQP] channel closed");
    });
    ch.prefetch(10);
    ch.assertExchange(this.exchange, 'topic', {
      durable: true
    });
    ch.assertQueue(this.queue, { durable: true }, (err, _ok) => {
      if (this.closeOnErr(err)) return;
      winston.debug("subscribed to _ok.queue: " + _ok.queue);
      this.subscribeTo(this.topic_webhook_message_deliver, ch, _ok.queue)
      this.subscribeTo(this.topic_webhook_message_update, ch, _ok.queue)
      // this.subscribeTo(this.topic_webhook_message_received, ch, _ok.queue)
      // that.subscribeTo(topic_webhook_message_saved, ch, _ok.queue)
      // that.subscribeTo(topic_webhook_conversation_saved, ch, _ok.queue)
      this.subscribeTo(this.topic_webhook_conversation_archived, ch, _ok.queue)
      // console.log("this is...", this);
      ch.consume(this.queue, this.processMsg.bind(this), { noAck: false });
    });
  });
}

subscribeTo(topic, channel, queue) {
  channel.bindQueue(queue, this.exchange, topic, {}, function (err, oka) {
    if (err) {
      winston.error("Webooks.Error:", err, " binding on queue:", queue, "topic:", topic)
    }
    else {
      winston.info("Webooks.bind: '" + queue + "' on topic: " + topic);
    }
  });
}

processMsg(msg) {
  winston.debug("Webhooks.subscribeTo:" + this);
  this.work(msg, (ok) => {
    winston.debug("Webhooks.worked.");
    try {
      if (ok)
        this.channel.ack(msg);
      else
        this.channel.reject(msg, true);
    } catch (e) {
      winston.debug("gin2:", e)
      this.closeOnErr(e);
    }
  });
}

work(msg, callback) {
  winston.debug("Webhooks.NEW TOPIC..." + msg.fields.routingKey) //, " message:", msg.content.toString());
  const topic = msg.fields.routingKey //.replace(/[.]/g, '/');
  const message_string = msg.content.toString();
  if (topic.startsWith('observer.webhook.') && topic.endsWith('.message_deliver')) {
    // if (this.enabled === false) {
    //    winston.debug("work observer.webhook....message_received notification. webhook_enabled is false.");
    //    callback(true);
    // } else {
      this.WHprocess_webhook_message_deliver(topic, message_string, callback);
    // }
  }
  else if (topic.startsWith('observer.webhook.') && topic.endsWith('.message_update')) {
    // if (this.enabled === false) {
    //    winston.debug("work observer.webhook....message_update notification. webhook_enabled is false.");
    //    callback(true);
    // } else {
      this.WHprocess_webhook_message_update(topic, message_string, callback);
    // }
  }
  // else if (topic.startsWith('observer.webhook.') && topic.endsWith('.message_received')) {
  //   if (this.enabled === false) {
  //      winston.debug("work observer.webhook....message_received notification. webhook_enabled is false.");
  //      callback(true);
  //   } else {
  //     this.WHprocess_webhook_message_received(topic, message_string, callback);
  //   }
  // }
  else if (topic.startsWith('observer.webhook.') && topic.endsWith('.conversation_archived')) {
  //   if (this.enabled === false) {
  //     winston.debug("work observer.webhook....conversation_archived notification. webhook_enabled is false.");
  //     callback(true);
  //  } else {
    this.WHprocess_webhook_conversation_archived(topic, message_string, callback);
  //  }
  }
  else {
    winston.error("Webooks.unhandled topic:", topic)
    callback(true)
  }
}

start() {
  const that = this;
  return new Promise(function (resolve, reject) {
    return that.startMQ(resolve, reject);
  });
}

startMQ(resolve, reject) {
  const that = this;
  
  winston.debug("Webooks. Connecting to RabbitMQ...")
  amqp.connect(that.RABBITMQ_URI, (err, conn) => {
      if (err) {
          winston.error("[Webooks.AMQP]", err);                    
          return setTimeout(() => { that.startMQ(resolve, reject) }, 1000);
      }
      conn.on("error", (err) => {
          if (err.message !== "Connection closing") {
            winston.error("[Webooks.AMQP] conn error", err);
              return reject(err);
          }
      });
      conn.on("close", () => {
          console.error("[Webooks.AMQP] reconnecting");
          return setTimeout(() => { that.startMQ(resolve, reject) }, 1000);
      });
      winston.info("Webooks. AMQP connected.")
      that.amqpConn = conn;
      that.whenConnected().then(function(ch) {
        winston.debug("Webooks. whenConnected() returned")
         resolve({conn: conn, ch: ch});
      });
  });
  
}

  publish(exchange, routingKey, content, callback) {
    try {
      winston.debug("Webooks.TRYING TO PUB...")
      this.pubChannel.publish(exchange, routingKey, content, { persistent: true }, (err, ok) => {
          if (err) {
            console.error("[Webooks.AMQP] publish ERROR:", err);
            this.offlinePubQueue.push([exchange, routingKey, content]);
            this.pubChannel.connection.close();
            callback(err)
          }
          else {
            callback(null)
          }
        });
    } catch (e) {
      console.error("[Webooks.AMQP] publish CATCHED ERROR:", e);
      this.offlinePubQueue.push([exchange, routingKey, content]);
      callback(e)
    }
  }

  
}

module.exports = { Webhooks };