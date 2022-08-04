var amqp = require('amqplib/callback_api');
const { ChatDB } = require('./chatdb/index.js');
//const { uuid } = require('uuidv4');
const { v4: uuidv4 } = require('uuid');
var mongodb = require("mongodb");
var MessageConstants = require("./models/messageConstants");
const express = require('express');
const bodyParser = require('body-parser');
var url = require('url');
const { Webhooks } = require("./webhooks");
const { Console } = require("console");
const app = express();
app.use(bodyParser.json());
const logger = require('./tiledesk-logger').logger;
var amqpConn = null;
let exchange;
let app_id;
let topic_outgoing;
let topic_update;
let topic_archive;
let topic_presence;
// FOR OBSERVER TOPICS
let topic_persist;
let topic_delivered;
// let topic_create_group;
let topic_update_group;
var chatdb;
let webhooks;
let webhook_enabled;
let autoRestart;

if (webhook_enabled == undefined || webhook_enabled === "true" || webhook_enabled === true ) {
  webhook_enabled = true;
}
else {
  webhook_enabled = false;
}
logger.info("(Observer) webhook_enabled: " + webhook_enabled);

let active_queues = {
  'messages': true,
  'persist': true
};

let webhook_endpoints_array;
let webhook_events_array;

function getWebhooks() {
  return webhooks;
}

function getWebHookEnabled() {
  return webhook_enabled;
}

function getWebHookEndpoints() {
  return webhook_endpoints_array;
}

function getWebHookEvents() {
  return webhook_events_array;
}

function setWebHookEnabled(enabled) {
  webhook_enabled = enabled;
  if (webhooks) {
    webhooks.setWebHookEnabled(webhook_enabled);
  }
}

function setWebHookEndpoints(endpoints) {
  webhook_endpoints_array = endpoints;
  if (webhooks) {
    webhooks.setWebHookEndpoints(webhook_endpoints_array);
  }
}

function setWebHookEvents(events) {
  webhook_events_array = events;
  if (webhooks) {
    webhooks.setWebHookEvents(events);
  }
}

// function initWebhooks(config) {
//   console.log("1")
//   if (!config) {
//     config = {}
//   }
//   app_id = config.app_id || "tilechat";
//   exchange = config.exchange || 'amq.topic';
//   if (config && config.rabbitmq_uri) {
//     // console.log("rabbitmq_uri found in config", config)
//     rabbitmq_uri = config.rabbitmq_uri;
//   }
//   else if (process.env.RABBITMQ_URI) {
//     // console.log("rabbimq_uri found in env")
//     rabbitmq_uri = process.env.RABBITMQ_URI;
//   }
//   else {
//     throw new Error('please configure process.env.RABBITMQ_URI or use parameter config.rabbimq_uri option.');
//   }
//   console.log("2")
//   webhooks = new Webhooks({appId: app_id, RABBITMQ_URI: rabbitmq_uri, exchange: exchange, webhook_endpoints: webhook_endpoints_array, webhook_events: webhook_events_array, queue_name: 'webhooks', logger: logger});
//   webhooks.enabled = webhook_enabled;
//   // await webhooks.start();
//   console.log("3")
// }

function setActiveQueues(queues) {
  logger.log("active queues setting", queues)
  active_queues = queues;
}

let prefetch_messages = 10;
function setPrefetchMessages(prefetch) {
  prefetch_messages = prefetch;
}

let autoRestartProperty;
function setAutoRestart(_autoRestart) {
  autoRestartProperty = _autoRestart;
}

// function setPersistentMessages(persist) {
//   persistent_messages = persist;
// }


function start() {
  return new Promise(function (resolve, reject) {
    return startMQ(resolve, reject);
  });
}

function startMQ(resolve, reject) {
  var autoRestart = process.env.AUTO_RESTART || autoRestartProperty;
  if (autoRestart===undefined || autoRestart==="true" || autoRestart===true) {
      autoRestart=true;
  } else {
      autoRestart=false;
  }
  logger.debug("Observer. Connecting to RabbitMQ...")
  amqp.connect(rabbitmq_uri, (err, conn) => {
      if (err) {
          logger.error("[Observer AMQP]", err);
          if (autoRestart) {
            logger.error("[Observer AMQP] reconnecting");
            return setTimeout(() => { startMQ(resolve, reject) }, 1000);
          } else {
              process.exit(1);
          }                     
      }
      conn.on("error", (err) => {
          if (err.message !== "Connection closing") {
            logger.error("[Observer AMQP] conn error", err);
              return reject(err);
          }
      });
      conn.on("close", () => {
        logger.info("[Observer AMQP] close");
        if (autoRestart) {
            logger.info("[Observer AMQP] reconnecting because of a disconnection (Autorestart = true)");
            return setTimeout(() => { startMQ(resolve, reject) }, 1000);
        } else {
            // process.exit(1);
            logger.info("[Observer AMQP] close event. No action.");
        }
      });
      amqpConn = conn;
      whenConnected().then(function(ch) {
        logger.debug("whenConnected() returned")
        return resolve({conn: conn, ch: ch});
      });
  });  
}

async function whenConnected() {
  const resolve = await startPublisher();
  startWorker();
  return resolve;
}

var pubChannel = null;
var offlinePubQueue = [];

function startPublisher() {
  return new Promise(function (resolve, reject) {
      amqpConn.createConfirmChannel( (err, ch) => {
          if (closeOnErr(err)) return;
          ch.on("error", function (err) {
              logger.error("[AMQP] channel error", err);
          });
          ch.on("close", function () {
              logger.debug("[AMQP] channel closed");
          });
          pubChannel = ch;
          // if (offlinePubQueue.length > 0) {
          //     while (true) {
          //         var [exchange, routingKey, content] = offlinePubQueue.shift();
          //         publish(exchange, routingKey, content);
          //     }
          // }
          return resolve(ch)
      });
  });
}

function publish(exchange, routingKey, content, callback) {
  try {
    pubChannel.publish(exchange, routingKey, content, { persistent: true },
      function (err, ok) {
        if (err) {
          logger.error("[AMQP] publish error:", err);
          offlinePubQueue.push([exchange, routingKey, content]);
          pubChannel.connection.close();
          callback(err)
        }
        else {
          // logger.debug("published to", routingKey, "result", ok)
          callback(null)
        }
      });
  } catch (e) {
    logger.error("[AMQP] publish", e.message);
    offlinePubQueue.push([exchange, routingKey, content]);
    callback(e)
  }
}

var channel;
function startWorker() {
  amqpConn.createChannel(function (err, ch) {
    channel = ch;
    if (closeOnErr(err)) return;
    ch.on("error", function (err) {
      logger.error("[AMQP] channel error", err);
    });
    ch.on("close", function () {
      logger.debug("[AMQP] channel closed");
    });
    logger.info("Prefetch messages:", prefetch_messages);
    ch.prefetch(prefetch_messages);
    ch.assertExchange(exchange, 'topic', {
      durable: true
    });
    logger.info("enabling queues", active_queues);
    if (active_queues['messages']) {
      ch.assertQueue("messages", { durable: true }, function (err, _ok) {
        if (closeOnErr(err)) return;
        let queue = _ok.queue;
        logger.log("asserted queue:", queue);
        // if (subscription_topics['outgoing']) {
          subscribeTo(topic_outgoing, ch, queue, exchange)
        // }
        // if (subscription_topics['update']) {
          subscribeTo(topic_update, ch, queue, exchange)
        // }
        // if (subscription_topics['persist']) {
        //   subscribeTo(topic_persist, ch, queue, exchange)
        // }
        // if (subscription_topics['archive']) {
          subscribeTo(topic_archive, ch, queue, exchange)
        // }
        // if (subscription_topics['presence']) {
          subscribeTo(topic_presence, ch, queue, exchange)
        // }
        // if (subscription_topics['update_group']) {
          subscribeTo(topic_update_group, ch, queue, exchange)
        // }
        // if (subscription_topics['delivered']) {
          subscribeTo(topic_delivered, ch, queue, exchange)
        // }
        ch.consume(queue, processMsg, { noAck: false });
      });
    }
    if (active_queues['persist']) {
      ch.assertQueue("persist", { durable: true }, function (err, _ok) {
        if (closeOnErr(err)) return;
        let queue = _ok.queue;
        logger.log("asserted queue:", queue);
        // if (subscription_topics['persist']) {
          subscribeTo(topic_persist, ch, queue, exchange)
        // }
        ch.consume(queue, processMsg, { noAck: false });
      });
    }
  });
}

function subscribeTo(topic, channel, queue, exchange) {
  channel.bindQueue(queue, exchange, topic, {}, function (err, oka) {
    if (err) {
      logger.error("Error:", err, " binding on queue:", queue, "topic:", topic)
    }
    else {
      logger.info("binded queue: '" + queue + "' on topic: " + topic);
    }
  });
}

function processMsg(msg) {
  // logger.debug("processMsgw. New msg:", msg);
  if (msg == null) {
    logger.error("Error. Msg is null. Stop job")
    return;
  }
  work(msg, function (ok) {
    try {
      if (ok) {
        // logger.debug("channel.ack(msg)");
        channel.ack(msg);
      }
      else {
        logger.debug("channel.reject(msg, true)");
        channel.reject(msg, true);
      }
    } catch (e) {
      logger.debug("processMsgwork error ", e)
      closeOnErr(e);
    }
  });
}

function work(msg, callback) {
  if (!msg) {
    logger.error("Error. Work Message is empty. Removing this job with ack=ok.", msg);
    callback(true);
    return;
  }
  logger.debug("work NEW TOPIC: " + msg.fields.routingKey) //, " message:", msg.content.toString());
  const topic = msg.fields.routingKey //.replace(/[.]/g, '/');
  const message_string = msg.content.toString();
  if (topic.endsWith('.outgoing')) {
    process_outgoing(topic, message_string, callback);
  }
  else if (topic.endsWith('.persist')) {
    process_persist(topic, message_string, callback);
  }
  else if (topic.endsWith('.delivered')) {
    process_delivered(topic, message_string, callback);
  }
  else if (topic.endsWith('.archive')) {
    process_archive(topic, message_string, callback);
  }
  else if (topic.includes('.presence.')) {
    process_presence(topic, message_string, callback);
  }
  // else if (topic.endsWith('.groups.create')) {
  //   process_create_group(topic, message_string, callback);
  // }
  else if (topic.endsWith('.groups.update')) {
    process_update_group(topic, message_string, callback);
  }
  else if (topic.endsWith('.update')) {
    process_update(topic, message_string, callback);
  }
  else {
    logger.error("unhandled topic:", topic)
    callback(true)
  }
}

// ***** TOPIC HANDLERS ******/

function process_presence(topic, message_string, callback) {
  logger.debug("got PRESENCE testament", message_string, " on topic", topic)
  callback(true)
}

function process_outgoing(topic, message_string, callback) {
  logger.debug("***** TOPIC outgoing: " + topic +  " MESSAGE PAYLOAD: " + message_string)
  var topic_parts = topic.split(".")
  // /apps/tilechat/outgoing/users/(ME)SENDER_ID/messages/RECIPIENT_ID/outgoing
  const app_id = topic_parts[1]
  // const sender_id = topic_parts[3]
  const sender_id = topic_parts[4]
  // const recipient_id = topic_parts[5]
  const recipient_id = topic_parts[6];
  const me = sender_id

  let message = JSON.parse(message_string)
  let messageId = uuidv4()
  let outgoing_message = message
  outgoing_message.message_id = messageId
  outgoing_message.sender = me
  outgoing_message.recipient = recipient_id
  outgoing_message.app_id = app_id
  if (!outgoing_message.timestamp) {
    logger.debug("No timestamp provided, forcing to Date.now()");
    const now = Date.now()
    outgoing_message.timestamp = now
  }
  else {
    logger.debug("Timestamp provided.");
  }

  let inbox_of;
  let convers_with;

  if (!isMessageGroup(outgoing_message)) {
    logger.debug("Direct message.");
    inbox_of = sender_id;
    convers_with = recipient_id;
    outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT
    deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function(ok) {
      logger.debug("delivered to sender. OK?", ok);
      if (ok) {
        outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED // =150
        inbox_of = recipient_id;
        convers_with = sender_id;
        deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function(ok) {
          logger.debug("delivered to recipient. OK?", ok);
          if (ok) {
            callback(true);
          }
          else {
            callback(false);
          }
        });
      }
      else {
        logger.debug("Error delivering: ", outgoing_message)
        callback(false);
      }
    });
  }
  else {
    logger.debug("Group message.");
    const group_id = recipient_id
    // chatdb.getGroup(group_id, function(err, group) { // REDIS?
    getGroup(group_id, function(err, group) {
      // logger.debug("group found!", group)
      if (!group) { // created only to temporary store group-messages in group-timeline
        // TODO: 1. create group (on-the-fly), 2. remove this code, 3. continue as if the group exists.
        logger.debug("group doesn't exist! Sending anyway to group timeline...");
        group = {
          uid: group_id,
          transient: true,
          members: {
          }
        }
        group.members[me] = 1
      }
      // if (!group.members[me]) {
      //   logger.debug(me + " can't write to this group")
      //   callback(true)
      //   return
      // }

      // Adding the group as a "volatile" member, so we easily get a copy of
      // all the group messages in timelineOf: group.uid
      group.members[group.uid] = 1
      // logger.debug("Writing to group:", group)
      let count = 0;
      logger.debug("group members", group.members);
      let max = Object.keys(group.members).length;
      let error_encoutered = false;
      for (let [member_id, value] of Object.entries(group.members)) {
        const inbox_of = member_id;
        const convers_with = recipient_id;
        logger.debug("inbox_of: "+ inbox_of);
        logger.debug("convers_with: "  + convers_with);
        logger.debug("sending group outgoing message to member", member_id);
        // if (inbox_of === outgoing_message.sender) {
        if (inbox_of === group.uid) { // choosing one member, the group ("volatile" member), for the "status=SENT", used by the "message-sent" webhook
          logger.debug("inbox_of === outgoing_message.sender. status=SENT system YES?", inbox_of);
          outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT;
        }
        else {
          logger.debug("inbox_of != outgoing_message.sender. status=DELIVERED no system, is:", inbox_of);
          outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED;
        }
        logger.debug("delivering group message with status...", outgoing_message.status, " to:", inbox_of);
        deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function(ok) {
          logger.debug("GROUP MESSAGE DELIVERED?", ok)
          count++;
          logger.debug("Sent Counting:", count);
          logger.debug("Max:", max);
          if (!ok) {
            logger.debug("Error sending message to group " + group.uid);
            error_encoutered = true
          }
          if (count == max) {
            if (error_encoutered) {
              logger.error("ERROR SENDING MESSAGE TO GROUP!");
              callback(false)
            }
            else {
              logger.log("ALL OK! MESSAGE SENT TO GROUP! ACK!");
              callback(true);
            }
          }
        })
      } // end for
    }) // end getGroup
  }
}

let groups = {};
function getGroup(group_id, callback) {
  // if (groups[group_id]) { // REDIS?
  //   logger.log("--GROUP", group_id, "FOUND!");
  //   callback(null, groups[group_id]);
  // }
  // else {
  //   logger.log("--GROUP", group_id, "NOT FOUND! QUERYING DB...");
    chatdb.getGroup(group_id, function(err, group) {
      // if (!err) {
      //   groups[group_id] = group;
      // }
      callback(err, group);
    });
  // }
}

function isMessageGroup(message) {
  // logger.debug("checking is group", message);
  if (message.channel_type === 'group') {
    // logger.log("is group!")
    return true
  }
  // logger.log("not a group")
  return false
}

// function isGroup(group_id) {
//   if (group_id.indexOf('group-') >= 0 || ) {
//     return true
//   }
//   return false
// }

// Places te message in the inbox of the recipient
function deliverMessage(message, app_id, inbox_of, convers_with_id, callback) {
  logger.debug(">DELIVERING:", message, "inbox_of:", inbox_of, "convers_with:", convers_with_id)
  // internal flow
  const persist_topic = `apps.observer.${app_id}.users.${inbox_of}.messages.${convers_with_id}.persist`
  // mqtt (client) flow
  const added_topic = `apps.${app_id}.users.${inbox_of}.messages.${convers_with_id}.clientadded`
  logger.debug("will pubblish on added_topic: " + added_topic)
  logger.debug("will pubblish on persist_topic: " + persist_topic)
  const mstatus = message.status;
  logger.log("mstatus:", mstatus)
  const message_payload = JSON.stringify(message)
  // notifies to the client (on MQTT client topic)
  publish(exchange, added_topic, Buffer.from(message_payload), function(err, msg) { // .clientadded
    if (err) {
      logger.error("Error on topic: ", added_topic, " Err:", err);
      callback(false);
      return;
    }
    logger.debug("NOTIFY VIA WHnotifyMessageStatusDelivered, topic: " + added_topic);
    if (webhooks && webhook_enabled) {
      logger.debug("webhooks && webhook_enabled ON, processing webhooks, message:", message);
      webhooks.WHnotifyMessageStatusSentOrDelivered(message_payload, added_topic, (err) => {
        if (err) {
          logger.error("WHnotifyMessageStatusSentOrDelivered with err:"+ err);
          callback(false);
        }
        else {
          logger.debug("WHnotifyMessageStatusSentOrDelivered ok");
          logger.debug("ADDED. NOW PUBLISH TO 'persist' TOPIC: " + persist_topic);
          publish(exchange, persist_topic, Buffer.from(message_payload), function(err, msg) { // .persist
            if (err) {
              logger.error("Error PUBLISH TO 'persist' TOPIC:", err);
              callback(false);
              return;
            }
            logger.debug("(WEBHOOK ENABLED) SUCCESSFULLY PUBLISHED ON:", persist_topic);
            callback(true);
          })
        }
      });
    }
    else {
      logger.debug("ADDED. NOW PUBLISH TO 'persist' TOPIC: " + persist_topic);
      publish(exchange, persist_topic, Buffer.from(message_payload), function(err, msg) { // .persist
        if (err) {
          logger.error("Error PUBLISH TO 'persist' TOPIC:", err);
          callback(false);
          return;
        }
        logger.debug("(NO WEBHOOK) SUCCESSFULLY PUBLISHED ON::", persist_topic);
        callback(true);
      })
    }
  })
}

// delivers messages to inboxes with rabbitmq queues
function process_delivered(topic, message_string, callback) {
  logger.debug(">>>>> DELIVERING:", topic, "MESSAGE PAYLOAD:",message_string)
  var topic_parts = topic.split(".")
  // delivers the message payload in INBOX_OF -> CONVERS_WITH timeline
  // /apps/observer/tilechat/users/INBOX_OF/messages/CONVERS_WITH/delivered
  const app_id = topic_parts[2]
  const inbox_of = topic_parts[4]
  const convers_with = topic_parts[6]
  const message = JSON.parse(message_string)
  if (message.status != MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED) {
    logger.error("process_delivered() error: status != DELIVERED (150). Only delivering messages with status DELIVERED", message);
    callback(true);
    return;
  }
  logger.debug("____DELIVER MESSAGE (status=" + message.status + "):", message.text, message.message_id, ", __history:", message.__history);
  deliverMessage(message, app_id, inbox_of, convers_with, function(ok) {
    logger.debug("MESSAGE DELIVERED?: "+ ok)
    if (!ok) {
      logger.error("____Error delivering message. NOACKED:", message);
      logger.log("____DELIVER MESSAGE:", message.message_id, " NOACKED!");
      callback(false)
    }
    else {
      logger.log("____DELIVER MESSAGE ", message.message_id, " ACKED");
      callback(true)
    }
  });
}

// This handler only persists messages and persists/updates conversations.
// Original messages were already delivered with *.messages.*.clientadded
function process_persist(topic, message_string, callback) {
  logger.debug(">>>>> TOPIC persist: " + topic +  " MESSAGE PAYLOAD: " + message_string)
  var topic_parts = topic.split(".")
  // /apps/observer/tilechat/users/ME/messages/CONVERS_WITH/persist -> WITH "SERVER" THIS MESSAGES WILL NOT BE DELIVERED TO CLIENTS
  const app_id = topic_parts[2]
  const me = topic_parts[4]
  const convers_with = topic_parts[6]

  let persist_message = JSON.parse(message_string)
  let savedMessage = persist_message
  savedMessage.app_id = app_id
  savedMessage.timelineOf = me
  savedMessage.conversWith = convers_with

  let update_conversation = true
  if (savedMessage.attributes && savedMessage.attributes.updateconversation == false) {
    update_conversation = false
  }
  // logger.debug("updateconversation = " + update_conversation)
  chatdb.saveOrUpdateMessage(savedMessage, function(err, msg) {
    // logger.debug("Message saved", savedMessage)
    // logger.debug("Updating conversation? updateconversation is: " + update_conversation)
    if (update_conversation) {
      const my_conversation_topic = 'apps.tilechat.users.' + me + '.conversations.' + convers_with + ".clientadded"
      let conversation = persist_message
      conversation.conversWith = convers_with // new!
      conversation.key = convers_with // retro comp
      conversation.is_new = true
      conversation.archived = false
      conversation.last_message_text = conversation.text // retro comp
      const conversation_payload = JSON.stringify(conversation)
      // logger.debug("Updating conversation...")
      chatdb.saveOrUpdateConversation(conversation, (err, doc) => {
        if (err) {
          logger.error("(chatdb.saveOrUpdateConversation callback) ERROR: ", err)
          callback(false)
        }
        else {
          callback(true)
        }
      });
    }
    else {
      logger.debug("Skip updating conversation. (update_conversation = false)")
      callback(true)
    }
  })
}

function process_update(topic, message_string, callback) {
  var topic_parts = topic.split(".")
  logger.debug("UPDATE. TOPIC PARTS:", topic_parts)
  logger.debug("payload:" + message_string)
  if (topic_parts.length < 5) {
    logger.debug("process_update topic error.")
    callback(false)
    return
  }
  if (topic_parts[4] === "messages") {
    logger.debug(" MESSAGE UPDATE.")
    // 'apps.tilechat.users.*.messages.*.*.update'
    // 'apps/tilechat/users/USER_ID/messages/CONVERS_WITH/MESSAGE_ID/update'
    // message update, only status update actually supported
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    const message_id = topic_parts[6]
    logger.debug("updating message:", message_id, "on convers_with", convers_with, "for user", user_id, "patch", message_string)
    
    const patch = JSON.parse(message_string)
    if (!patch.status || patch.status != 200) {
      callback(true)
      return
    }
    // If patched with "status = 200" then:
    // 1. Save message in my timeline with status = 200
    // 2. propagate "status = 250" to the symmetric message in recipient inbox

    // 1. SAVE MESSAGE ON MY TIMELINE
    // timelineOf: message.timelineOf, message_id: message.message_id
    const me = user_id
    const my_message_patch = {
      "timelineOf": me,
      "message_id": message_id,
      "status": patch.status // actually this is always = 200 (SENT)
    }
    const my_message_patch_payload = JSON.stringify(my_message_patch)
    const dest_message_patch = {
      "timelineOf": convers_with,
      "message_id": message_id,
      "status": MessageConstants.CHAT_MESSAGE_STATUS_CODE.RETURN_RECEIPT
    }
    const dest_message_patch_payload = JSON.stringify(dest_message_patch)
    // PUBLISH DEST_PATCH: RETURN_RECEIPT
    const recipient_message_update_topic = 'apps.tilechat.users.' + convers_with + '.messages.' + me + '.' + message_id + '.clientupdated'
    logger.debug(">>> NOW PUBLISHING... DEST_PATCH: RETURN_RECEIPT. TOPIC: " + recipient_message_update_topic + ", PATCH ", dest_message_patch)
    publish(exchange, recipient_message_update_topic, Buffer.from(dest_message_patch_payload), function(err) {
      logger.debug(">>> PUBLISHED!!!! RECIPIENT MESSAGE TOPIC UPDATE" + recipient_message_update_topic + " WITH PATCH " , dest_message_patch)
      if (err) {
        logger.error("error",err);
        callback(false)
      }
      else {
        logger.log("webhook_enabled?????", webhook_enabled);
        if (webhook_enabled) {
          webhooks.WHnotifyMessageStatusReturnReceipt(dest_message_patch, (err) => {
            if (err) {
              logger.error("WHnotifyMessageStatusReturnReceipt with err:" + err)
            } else {
              logger.debug("WHnotifyMessageStatusReturnReceipt ok")
            }
          })
        }
        // DISABLED BECAUSE NOT REALLY NECESSARY (FOR PERF) TO NOTIFY STATUS MODIFICATION TO THE ONE WHO COMMITED THE SAME MOD
        // PUBLISH MY_PATCH: RECEIVED
        // const my_message_update_topic = 'apps.tilechat.users.' + me + '.messages.' + convers_with + '.' + message_id + '.clientupdate'
        // logger.debug(">>> NOW PUBLISHING... MY MESSAGE TOPIC UPDATE", my_message_update_topic, "WITH PATCH", my_message_patch)
        // publish(exchange, my_message_update_topic, Buffer.from(my_message_patch_payload), function(err) {
        //   logger.debug(">>> PUBLISHED!!!! MY MESSAGE TOPIC UPDATE", my_message_update_topic, "WITH PATCH", my_message_patch)
        //   if (err) {
        //     callback(false)
        //     return
        //   }

        // TODO: MOVE TO A PERSIST_UPDATED TOPIC/QUEUE...
        logger.debug(">>> ON DISK... WITH A STATUS ON MY MESSAGE-UPDATE TOPIC", topic, "WITH PATCH", my_message_patch)
        chatdb.saveOrUpdateMessage(my_message_patch, function(err, msg) {
          logger.debug(">>> MESSAGE ON TOPIC", topic, "UPDATED!")
          if (err) {
            logger.error("error",err);
            callback(false)
            return
          }
          logger.debug(">>> ON DISK... RECIPIENT MESSAGE ON DB WITH", dest_message_patch)
          chatdb.saveOrUpdateMessage(dest_message_patch, function(err, msg) {
            callback(true)
          });
        });
      }
    });
  }
  else if (topic_parts[4] === "conversations") {
    // conversation update, only is_new update actually supported
    // 'apps/tilechat/users/USER_ID/conversations/CONVERS_WITH/update'
    logger.debug(" CONVERSATION UPDATE.")
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    logger.debug("updating conversation:" + convers_with + " for user " + user_id + " patch " + message_string)
    
    const patch = JSON.parse(message_string)
    // 1. Patch my conversation: convers_with
    // 2. Publish the patch to my conversation: convers_with
    // 1. SAVE PATCH
    const me = user_id
    patch.timelineOf = me
    patch.conversWith = convers_with
    logger.debug(">>> ON DISK... CONVERSATION TOPIC " + topic + " WITH PATCH " + patch)
    logger.debug("Updating conversation 2.")
    chatdb.saveOrUpdateConversation(patch, function(err, doc) {
      logger.debug(">>> CONVERSATION ON TOPIC:", topic, "UPDATED!")
      if (err) {
        logger.error("error",err);
        callback(false)
        return
      }
      const patch_payload = JSON.stringify(patch)
      const my_conversation_update_topic = 'apps.tilechat.users.' + me + '.conversations.' + convers_with + '.clientupdated'
      logger.debug(">>> NOW PUBLISHING... MY CONVERSATION UPDATE " + my_conversation_update_topic + " WITH PATCH " + patch_payload)
      publish(exchange, my_conversation_update_topic, Buffer.from(patch_payload), function(err) {
        logger.debug(">>> PUBLISHED!!!! MY CONVERSATION UPDATE TOPIC " + my_conversation_update_topic + " WITH PATCH " + patch_payload)
        if (err) {
          logger.error("error",err);
          callback(false)
          return
        }
        else {
          callback(true)
        }
      });
    });
  }
}

function process_archive(topic, payload, callback) {
  // Ex. apps/tilechat/users/USER_ID/conversations/CONVERS_WITH/archive
  const topic_parts = topic.split(".")
  logger.debug("ARCHIVE. TOPIC PARTS:" + topic_parts + "payload (ignored): " + payload)
  if (topic_parts.length < 7) {
    logger.debug("process_archive topic error. topic_parts.length < 7:" + topic)
    callback(true)
    return
  }
  if (topic_parts[4] === "conversations") {
    logger.debug("CONVERSATION ARCHIVE.")
    // 'apps.tilechat.users.*.messages.*.*.update'
    // 'apps/tilechat/users/USER_ID/messages/CONVERS_WITH/MESSAGE_ID/update'
    // message update, only status update actually supported
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    logger.debug("archiving conversation:" + convers_with + " for user " + user_id + " payload: "+ payload)
    const me = user_id
    conversation_archive_patch = {
      "timelineOf": me,
      "conversWith": convers_with,
      "archived": true
    }
    logger.debug("NOTIFY VIA WEBHOOK ON SAVE TOPIC "+ topic)
    if (webhook_enabled) {
      webhooks.WHnotifyConversationArchived(conversation_archive_patch, topic, (err) => {
        if (err) {
            logger.error("Webhook notified with err:"+ err)
          }
          else {
            logger.debug("Webhook notified WHnotifyConversationArchived ok")
          }
      });
    }
    logger.debug(">>> ON DISK... ARCHIVE CONVERSATION ON TOPIC: " + topic)
    logger.debug("Updating conversation 3.")
    chatdb.saveOrUpdateConversation(conversation_archive_patch, function(err, msg) {
      logger.debug(">>> CONVERSATION ON TOPIC:", topic, "ARCHIVED!")
      if (err) {
        logger.error("error",err);
        callback(false)
        return
      }
      chatdb.conversationDetail(app_id, me, convers_with, true, (err, convs) => {
        if (err) {
          logger.error("Error getting conversationDetail()", err);
          callback(true);
        }
        else if (convs && convs.length < 1) {
          logger.error("Error getting conversationDetail(): convs[].length < 1");
          callback(true);
        }
        else {
          const conversation_archived = convs[0];
          logger.debug("got archived conversation detail:", conversation_archived);
          const conversation_deleted_topic = 'apps.tilechat.users.' + user_id + '.conversations.' + convers_with + '.clientdeleted'
          logger.debug(">>> NOW PUBLISHING... CONVERSATION ARCHIVED (DELETED) TOPIC " + conversation_deleted_topic)
          const payload = JSON.stringify(conversation_archived);
          publish(exchange, conversation_deleted_topic, Buffer.from(payload), function(err) {
            logger.debug(">>> PUBLISHED!!!! CONVERSATION ON TOPIC: " + conversation_deleted_topic + " ARCHIVED (DELETED). Payload: " + payload + " buffered:" + Buffer.from(payload))
            if (err) {
              logger.error("error",err);
              callback(false);
            }
            else {
              // now publish new archived conversation added
              const archived_conversation_added_topic = 'apps.tilechat.users.' + user_id + '.archived_conversations.' + convers_with + '.clientadded'
              logger.debug(">>> NOW PUBLISHING... CONVERSATION ARCHIVED (ADDED) TOPIC: " + archived_conversation_added_topic)
              // const success_payload = JSON.stringify({"success": true})
              publish(exchange, archived_conversation_added_topic, Buffer.from(payload), function(err) {
                logger.debug(">>> PUBLISHED!!!! ARCHIVED (DELETED) CONVERSATION ON TOPIC: " + conversation_deleted_topic)
                if (err) {
                  logger.error("error",err);
                  callback(false);
                }
                else {
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

/**
 * Adds a member to a group.
 * 1. Sends "{user} added to this group" message to every member of the group, including the joined one
 * 2. Pubblishes old group messages to the newly joined member timeline
 * NOTE: this method doesn't modify the group members neither sends a group.updated message to
 * the clients. Use addMemberToGroupAndNotifyUpdate() to reach these couple of goals.
 * 
 * @param {*} joined_member_id 
 * @param {*} group 
 * @param {*} callback 
 */
// function joinGroup(joined_member_id, group, callback) {
//   logger.debug("SENDING 'ADDED TO GROUP' TO EACH MEMBER INCLUDING THE JOINED ONE...", group)
//   const appid = group.appId
//   for (let [member_id, value] of Object.entries(group.members)) {
//       logger.debug("to member:" + member_id)
//       const now = Date.now()
//       const message = {
//           message_id: uuid(),
//           type: "text",
//           text: joined_member_id + " added to group",
//           timestamp: now,
//           channel_type: "group",
//           sender_fullname: "System",
//           sender: "system",
//           recipient_fullname: group.name,
//           recipient: group.uid,
//           status: 100, // MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT,
//           attributes: {
//               subtype:"info",
//               updateconversation : true,
//               messagelabel: {
//                   key: "MEMBER_JOINED_GROUP",
//                   parameters: {
//                       member_id: joined_member_id
//                       // fullname: fullname // OPTIONAL
//                   }
//               }
//           }
//       }
//       logger.debug("Member joined group message:", message)
//       let inbox_of = member_id
//       let convers_with = group.uid
//       deliverMessage(message, appid, inbox_of, convers_with, (ok) => {
//         console.log("delivering...")
//         if (!ok) {
//           logger.error("error delivering message to joined member", inbox_of)
//           callback(ok)
//           return
//         }
//         else {
          
//           logger.debug("DELIVERED MESSAGE TO: " + inbox_of + " CONVERS_WITH " + convers_with)
//         }
//       })
//   }
//   // 2. pubblish old group messages to the joined member (in the member/group-conversWith timeline)
//   const userid = group.uid
//   const convid = group.uid
//   chatdb.lastMessages(appid, userid, convid, 1, 200, (err, messages) => {
//       if (err) {
//           logger.error("Error", err)
//           callback(err)
//       }
//       else if (!messages) {
//           logger.debug("No messages in group: " + group.uid)
//           callback(null)
//       }
//       else {
//           logger.debug("delivering past group messages to:" + joined_member_id + " messages: ", messages)
//           const inbox_of = joined_member_id
//           const convers_with = group.uid
//           messages.forEach(message => {
//               // TODO: CHECK IN MESSAGE WAS ALREADY DELIVERED. (CLIENT? SERVER?)
//               logger.debug("Message:", message.text)
//               deliverMessage(message, appid, inbox_of, convers_with, (err) => {
//                   if (err) {
//                       logger.error("error delivering past message to joined member: " + inbox_of, err)
//                   }
//                   else {
//                       logger.debug("DELIVERED PAST MESSAGE TO: " + inbox_of + " CONVERS_WITH : " + convers_with)
//                   }
//               })
//           });
//           callback(null)
//       }
//   })
// }

function process_update_group(topic, payload, callback) {
  var topic_parts = topic.split(".")
  logger.debug("process_update_group. TOPIC PARTS:" + topic_parts + "payload:" + payload)
  // `apps.observer.${app_id}.groups.update`
  const app_id = topic_parts[2]
  logger.debug("app_id:" + app_id)
  logger.debug("payload:" + payload)
  const data = JSON.parse(payload)
  logger.debug("process_update_group DATA ", JSON.stringify(data))
  const group = data.group
  // logger.debug("process_update_group DATA.group ", JSON.stringify(data.group))
  const notify_to = data.notify_to
  // logger.debug("process_update_group DATA.notify_to ", data.notify_to);
  if (!group || !group.uid) {
    logger.error("Group not found!");
    callback(true)
    return
  }
  deliverGroupUpdated(group, notify_to, function(ok) {
    callback(ok)
  })
}

function deliverGroupUpdated(group, notify_to, callback) {
  const app_id = group.appId
  for (let [key, value] of Object.entries(notify_to)) {
    const member_id = key
    const updated_group_topic = `apps.${app_id}.users.${member_id}.groups.${group.uid}.clientupdated`
    logger.debug("updated_group_topic:", updated_group_topic)
    const payload = JSON.stringify(group)
    publish(exchange, updated_group_topic, Buffer.from(payload), function(err, msg) {
      if (err) {
        logger.error("error publish deliverGroupUpdated",err);
        // callback(false)
        // return
      }
    })
  }
  callback(true)
}

function closeOnErr(err) {
  if (!err) return false;
  logger.error("[AMQP] error", err);
  amqpConn.close();
  return true;
}

async function startServer(config) {
  logger.info("Starting observer....");
  if (!config) {
    config = {}
  }

  app_id = config.app_id || "tilechat";

  exchange = config.exchange || 'amq.topic';

  if (config && config.rabbitmq_uri) {
    rabbitmq_uri = config.rabbitmq_uri;
  }
  else if (process.env.RABBITMQ_URI) {
    rabbitmq_uri = process.env.RABBITMQ_URI;
  }
  else {
    throw new Error('please configure process.env.RABBITMQ_URI or use parameter config.rabbimq_uri option.');
  }

  // topic_outgoing = `apps.${app_id}.users.*.messages.*.outgoing`;
  topic_outgoing = `apps.${app_id}.outgoing.users.*.messages.*.outgoing`;
  topic_update = `apps.${app_id}.users.#.update`;
  topic_archive = `apps.${app_id}.users.#.archive`;
  topic_presence = `apps.${app_id}.users.*.presence.*`;
// FOR OBSERVER TOPICS
  topic_persist = `apps.observer.${app_id}.users.*.messages.*.persist`;
  topic_delivered = `apps.observer.${app_id}.users.*.messages.*.delivered`;
  // topic_create_group = `apps.observer.${app_id}.groups.create`
  topic_update_group = `apps.observer.${app_id}.groups.update`;
  // mongo_uri = config.mongo_uri || "mongodb://localhost:27017/chatdb";

  let mongouri = null;
  if (config && config.mongodb_uri) {
    mongouri = config.mongodb_uri;
  }
  else if (process.env.MONGODB_URI) {
    mongouri = process.env.MONGODB_URI;
  }
  else {
    throw new Error('please configure process.env.MONGODB_URI or use parameter config.mongodb_uri option.');
  }

  var db;
  logger.debug("[Observer] connecting to mongodb:", mongouri);
  var client = await mongodb.MongoClient.connect(mongouri, { useNewUrlParser: true, useUnifiedTopology: true });
  db = client.db();
  logger.debug("Mongodb connected.");
  chatdb = new ChatDB({database: db})
  logger.info("Starting webhooks..., logger", logger);
  try {
    webhooks = new Webhooks({appId: app_id, RABBITMQ_URI: rabbitmq_uri, exchange: exchange, webhook_endpoints: webhook_endpoints_array, webhook_events: webhook_events_array, queue_name: 'webhooks', logger: logger});
    webhooks.enabled = webhook_enabled;
    await webhooks.start();
  }
  catch(error) {
    logger.error("An error occurred initializing webhooks:", error)
  }
  logger.debug('Starting AMQP connection....');
  var amqpConnection = await start();
  logger.debug("[Observer.AMQP] connected.");
  logger.debug("Observer started.");
}

function stopServer(callback) {
  amqpConn.close(callback);
}

module.exports = {startServer: startServer, stopServer: stopServer, setAutoRestart: setAutoRestart, getWebhooks: getWebhooks, setWebHookEndpoints: setWebHookEndpoints, setWebHookEvents: setWebHookEvents, setWebHookEnabled: setWebHookEnabled, setActiveQueues: setActiveQueues, setPrefetchMessages: setPrefetchMessages, logger: logger };