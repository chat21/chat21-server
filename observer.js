const winston = require("./winston");
var amqp = require('amqplib/callback_api');
const { ChatDB } = require('./chatdb/index.js');
// const { Webhooks } = require('./webhooks/index.js');
// const uuidv4 = require('uuid/v4');
const { uuid } = require('uuidv4');
var MessageConstants = require("./models/messageConstants");
const express = require('express');
const bodyParser = require('body-parser');
var url = require('url');
const { Webhooks } = require("./webhooks");
const { Console } = require("console");
const app = express();
app.use(bodyParser.json());

var webhook_endpoint = process.env.WEBHOOK_ENDPOINT || "http://localhost:3000/chat21/requests";
winston.info("webhook_endpoint: " + webhook_endpoint);

let webhook_events_array = null;
if (process.env.WEBHOOK_EVENTS) {
  console.log(typeof process.env.WEBHOOK_EVENTS);
  const webhook_events = process.env.WEBHOOK_EVENTS;
  webhook_events_array = webhook_events.split(",");
}
winston.info("webhook_events_array: " , webhook_events_array);

var webhook_enabled = process.env.WEBHOOK_ENABLED;
if (webhook_enabled == undefined || webhook_enabled === "true" || webhook_enabled === true ) {
  webhook_enabled = true;
}else {
  webhook_enabled = false;
}
winston.info("webhook_enabled: " + webhook_enabled);

var app_id = process.env.APP_ID || "tilechat";
winston.info("app_id: " + app_id);


var amqpConn = null;
var exchange = 'amq.topic';

const topic_outgoing = `apps.${app_id}.users.*.messages.*.outgoing`
const topic_update = `apps.${app_id}.users.#.update`
const topic_archive = `apps.${app_id}.users.#.archive`
const topic_presence = `apps.${app_id}.users.*.presence.*`
// FOR OBSERVER TOPICS
const topic_persist = `apps.observer.${app_id}.users.*.messages.*.persist`
const topic_delivered = `apps.observer.${app_id}.users.*.messages.*.delivered`
const topic_create_group = `apps.observer.${app_id}.groups.create`
const topic_update_group = `apps.observer.${app_id}.groups.update`

var chatdb;
let webhooks;

function setWebHookEndpoint(url) {
  webhook_endpoint = url;
  return webhook_endpoint;
}

function setWebHookMethods(methods) {
  webhook_methods = methods;
  webhook_methods_array = webhook_methods.split(",");
  return webhook_methods_array;
}

function setWebHookEnabled(enabled) {
  webhook_enabled = enabled;
}

function start() {
  return new Promise(function (resolve, reject) {
    return startMQ(resolve, reject);
  });
}

function startMQ(resolve, reject) {
  var autoRestart = process.env.AUTO_RESTART;
  if (autoRestart===undefined || autoRestart==="true" || autoRestart===true) {
      autoRestart=true;
  } else {
      autoRestart=false;
  }  
      winston.debug("Connecting to RabbitMQ...")
      amqp.connect(process.env.RABBITMQ_URI, (err, conn) => {
          if (err) {
              winston.error("[AMQP]", err);                    
              if (autoRestart) {
                console.error("[AMQP] reconnecting");
                return setTimeout(() => { startMQ(resolve, reject) }, 1000);
              } else {
                  process.exit(1);
              }                     
          }
          conn.on("error", (err) => {
              if (err.message !== "Connection closing") {
                winston.error("[AMQP] conn error", err);
                  return reject(err);
              }
          });
          conn.on("close", () => {
            console.error("[AMQP] close");
            if (autoRestart) {
                console.error("[AMQP] reconnecting");
                return setTimeout(() => { startMQ(resolve, reject) }, 1000);
            } else {
                process.exit(1);
            }                                 
          });
          amqpConn = conn;
          whenConnected().then(function(ch) {
            winston.debug("whenConnected() returned")
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
  // var that = this;
  return new Promise(function (resolve, reject) {
      amqpConn.createConfirmChannel( (err, ch) => {
          if (closeOnErr(err)) return;
          ch.on("error", function (err) {
              winston.error("[AMQP] channel error", err);
          });
          ch.on("close", function () {
              winston.debug("[AMQP] channel closed");
          });
          pubChannel = ch;
          if (offlinePubQueue.length > 0) {
              // while (true) {
              //     var m = this.offlinePubQueue.shift();
              //     if (!m) break;
              //     this.publish(m[0], m[1], m[2]);
              //   }

              while (true) {
                  var [exchange, routingKey, content] = offlinePubQueue.shift();
                  publish(exchange, routingKey, content);
              }
          }
          return resolve(ch)
      });
  });
}

function publish(exchange, routingKey, content, callback) {
  try {
    pubChannel.publish(exchange, routingKey, content, { persistent: true },
      function (err, ok) {
        if (err) {
          winston.error("[AMQP] publish", err);
          offlinePubQueue.push([exchange, routingKey, content]);
          pubChannel.connection.close();
          callback(err)
        }
        else {
          // winston.debug("published to", routingKey, "result", ok)
          callback(null)
        }
      });
  } catch (e) {
    console.error("[AMQP] publish", e.message);
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
      subscribeTo(topic_outgoing, ch, _ok.queue)
      subscribeTo(topic_persist, ch, _ok.queue)
      subscribeTo(topic_update, ch, _ok.queue)
      subscribeTo(topic_archive, ch, _ok.queue)
      subscribeTo(topic_presence, ch, _ok.queue)
      subscribeTo(topic_create_group, ch, _ok.queue)
      subscribeTo(topic_update_group, ch, _ok.queue)
      subscribeTo(topic_delivered, ch, _ok.queue)
      ch.consume("jobs", processMsg, { noAck: false });
    });
  });
}

function subscribeTo(topic, channel, queue) {
  channel.bindQueue(queue, exchange, topic, {}, function (err, oka) {
    if (err) {
      winston.error("Error:", err, " binding on queue:", queue, "topic:", topic)
    }
    else {
      winston.info("bind: '" + queue + "' on topic: " + topic);
    }
  });
}

function processMsg(msg) {
  work(msg, function (ok) {
    try {
      if (ok) {
        console.debug("channel.ack(msg)");
        channel.ack(msg);
      }
      else {
        console.debug("channel.reject(msg, true)");
        channel.reject(msg, true);
      }
    } catch (e) {
      winston.debug("processMsgwork error ", e)
      closeOnErr(e);
    }
  });
}

function work(msg, callback) {
  winston.debug("work NEW TOPIC: " + msg.fields.routingKey) //, " message:", msg.content.toString());
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
  else if (topic.endsWith('.groups.create')) {
    process_create_group(topic, message_string, callback);
  }
  else if (topic.endsWith('.groups.update')) {
    process_update_group(topic, message_string, callback);
  }
  else if (topic.endsWith('.update')) {
    process_update(topic, message_string, callback);
  }
  else {
    winston.error("unhandled topic:", topic)
    callback(true)
  }
}

// ***** TOPIC HANDLERS ******/

function process_presence(topic, message_string, callback) {
  winston.debug("got PRESENCE testament", message_string, " on topic", topic)
  callback(true)
}

function process_outgoing(topic, message_string, callback) {
  winston.debug("process outgoing topic:" + topic)
  var topic_parts = topic.split(".")
  // /apps/tilechat/users/(ME)SENDER_ID/messages/RECIPIENT_ID/outgoing
  const app_id = topic_parts[1]
  const sender_id = topic_parts[3]
  const recipient_id = topic_parts[5]
  const me = sender_id

  var message = JSON.parse(message_string)
  var messageId = uuid()
  const now = Date.now()
  var outgoing_message = message
  outgoing_message.message_id = messageId
  outgoing_message.sender = me
  outgoing_message.recipient = recipient_id
  outgoing_message.app_id = app_id
  outgoing_message.timestamp = now

  let inbox_of;
  let convers_with;

  if (!isMessageGroup(outgoing_message)) {
    console.debug("Direct message.");
    inbox_of = sender_id;
    convers_with = recipient_id;
    outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT // =100. DELIVERED (=150) it's better, but the JS client actually wants 100 to show the sent-checkbox
    deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function(ok) {
      console.debug("delivered to sender. OK?", ok);
      if (ok) {
        outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED // =150
        inbox_of = recipient_id;
        convers_with = sender_id;
        deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function(ok) {
          console.debug("delivered to recipient. OK?", ok);
          if (ok) {
            callback(true);
          }
          else {
            callback(false);
          }
        });
      }
      else {
        winston.debug("Error delivering: ", outgoing_message)
        callback(false);
      }
    });

    // winston.debug("!isGroup")
    // let inbox_of = recipient_id
    // let convers_with = sender_id
    // deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function(ok) {
    //   // WEBHOOK DELIVERED STATUS // outgoing_message.status
    //   winston.debug("outgoing_message1 OK?", ok)
    //   if (ok) {
    //     if (recipient_id !== sender_id) {
          // inbox_of = sender_id
          // convers_with = recipient_id
          // outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT // =100. DELIVERED it's better, but the JS client actually wants 100 to show the sent-checkbox
          // deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function(ok) {
          //   winston.debug("outgoing_message2 OK?", ok)
          //   if (ok) {
          //     callback(true)
          //   }
          //   else {
          //     winston.debug("Error delivering: ", outgoing_message)
          //     callback(false)
          //   }
          // })
    //     }
    //     else {
    //       winston.debug("message sent to myself. not delivering")
    //       callback(true)
    //     }
    //   }
    //   else {
    //     winston.debug("!ok")
    //     callback(false)
    //   }
    // })
  }
  else {
    console.log("message group.");
    const group_id = recipient_id
    chatdb.getGroup(group_id, function(err, group) { // REDIS?
      // winston.debug("group found!", group)
      if (!group) { // created only to temporary store group-messages in group-timeline
        // TODO: 1. create group (on-the-fly), 2. remove this code, 3. continue as ifthe group exists.
        winston.debug("group doesn't exist! Sending anyway to group timeline...")
        group = {
          uid: group_id,
          transient: true,
          members: {
          }
        }
        group.members[me] = 1
      }
      // if (!group.members[me]) {
      //   winston.debug(me + " can't write to this group")
      //   callback(true)
      //   return
      // }
      // adding the group in the members so we easily get a copy of
      // all the group messages in timelineOf: group.uid
        
      group.members[group.uid] = 1
      // winston.debug("Writing to group:", group)
      let count = 0;
      let max = group.members.length;
      let error_encoutered = false;
      for (let [member_id, value] of Object.entries(group.members)) {
        const inbox_of = member_id
        const convers_with = recipient_id
        winston.debug("inbox_of: "+ inbox_of)
        winston.debug("convers_with: "  + convers_with)
        outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT
        deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function(ok) {
          winston.debug("MESSAGE DELIVERED?", ok)
          count++;
          console.log("Sent Counting:", count);
          console.log("Max:", max);
          if (!ok) {
            winston.debug("Error sending message to group " + group.uid);
            error_encoutered = true
          }
          if (count == max) {
            if (error_encoutered) {
              console.error("ERROR SENDING MESSAGE TO GROUP!");
              callback(false)
            }
            else {
              console.log("ALL OK! MESSAGE SENT TO GRUP! ACK!");
              callback(true);
            }
          }
        })
      } // end for
    }) // end getGroup
  }
}

function isMessageGroup(message) {
  // console.debug("checking is group", message);
  if (message.channel_type === 'group') {
    // console.log("is group!")
    return true
  }
  // console.log("not a group")
  return false
}

// function isGroup(group_id) {
//   if (group_id.indexOf('group-') >= 0 || ) {
//     return true
//   }
//   return false
// }

//deliverMessage(appid, message, inbox_of, convers_with, (err) => {
function deliverMessage(message, app_id, inbox_of, convers_with_id, callback) {
  winston.debug("DELIVERING:", message, "inbox_of:", inbox_of, "convers_with:", convers_with_id)
  // internal flow
  const persist_topic = `apps.observer.${app_id}.users.${inbox_of}.messages.${convers_with_id}.persist`
  // mqtt (client) flow
  const added_topic = `apps.${app_id}.users.${inbox_of}.messages.${convers_with_id}.clientadded`
  winston.debug("persist_topic: " + persist_topic)
  winston.debug("added_topic: " + added_topic)
  const message_payload = JSON.stringify(message)
  // notifies to the client (on MQTT client topic)
  publish(exchange, added_topic, Buffer.from(message_payload), function(err, msg) { // .clientadded
    if (err) {
      console.error("Error on topic: ", added_topic, " Err:", err);
      callback(false);
      return;
    }
    console.debug("NOTIFY VIA WHnotifyMessageStatusDelivered, topic: " + added_topic);
    console.log("webhook_enabled:", webhook_enabled);
    if (webhook_enabled) {
      webhooks.WHnotifyMessageStatusSentOrDelivered(message, (err) => {
        if (err) {
          console.error("WHnotifyMessageStatusSentOrDelivered with err:"+ err);
          callback(false);
        }
        else {
          console.debug("WHnotifyMessageStatusSentOrDelivered ok");
          console.debug("ADDED. NOW PUBLISH TO 'persist' TOPIC: " + persist_topic);
          publish(exchange, persist_topic, Buffer.from(message_payload), function(err, msg) { // .persist
            if (err) {
              console.error("Error PUBLISH TO 'persist' TOPIC:", err);
              callback(false);
              return;
            }
            console.debug("... ALL GOOD ON:", persist_topic);
            callback(true);
          })
        }
      });
    }
    // if (webhook_enabled) {
    //   console.log("webhook_enabled!!!!!", webhook_enabled, message.status)
    //   if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED) {
    //     winston.debug("WHnotifyMessageStatusDelivered before message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED");
    //     webhooks.WHnotifyMessageStatusDelivered(message, (err) => {
    //       if (err) {
    //         winston.error("WHnotifyMessageStatusDelivered with err:"+ err)
    //       } else {
    //         winston.debug("WHnotifyMessageStatusDelivered ok")
    //       }
    //     })
    //   }
    //   else if (message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT) {
    //     winston.debug("WHnotifyMessageStatusDelivered before message.status == MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT");
    //     webhooks.WHnotifyMessageStatusSent(message, (err) => {
    //       if (err) {
    //         winston.error("Webhook notified with err:"+ err)
    //       } else {
    //         winston.debug("Webhook notified WHnotifyMessageReceived ok")
    //       }
    //     })
    //   }else {
    //     winston.debug("WHnotifyMessageStatusDelivered before else other???");
    //   }
    // }
    // saves on db and creates conversation
    // winston.debug("ADDED. NOW PUBLISH TO 'persist' TOPIC: " + persist_topic)
    // publish(exchange, persist_topic, Buffer.from(message_payload), function(err, msg) { // .persist
    //   if (err) {
    //     console.error("Error PUBLISH TO 'persist' TOPIC:", err)
    //     callback(false)
    //     return
    //   }
    //   winston.debug("... ALL GOOD ON:", persist_topic)
    //   callback(true)
    //   // publish convs .clientadded
    // })
  })
}

// delivers messages to inboxes with rabbitmq queues
function process_delivered(topic, message_string, callback) {
  winston.debug(">>>>> DELIVERED:", topic, "MESSAGE PAYLOAD:",message_string)
  var topic_parts = topic.split(".")
  // delivers the message payload in INBOX_OF -> CONVERS_WITH timeline
  // /apps/observer/tilechat/users/INBOX_OF/messages/CONVERS_WITH/delivered
  const app_id = topic_parts[2]
  const inbox_of = topic_parts[4]
  const convers_with = topic_parts[6]
  const message = JSON.parse(message_string)
  deliverMessage(message, app_id, inbox_of, convers_with, function(ok) {
    winston.debug("MESSAGE DELIVERED?: "+ ok)
    if (!ok) {
      winston.error("Error delivering message.", message)
      callback(false)
    }
    else {
      callback(true)
    }
  })
}

// This handler only persists messages and persists/updates conversations.
// Original messages were already delivered with *.messages.*.clientadded
function process_persist(topic, message_string, callback) {
  winston.debug(">>>>> TOPIC persist: " + topic +  " MESSAGE PAYLOAD: " +message_string)
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
  winston.debug("updateconversation = " + update_conversation)
  chatdb.saveOrUpdateMessage(savedMessage, function(err, msg) {
    winston.debug("Message saved.")
    winston.debug("Updating conversation? updateconversation is: " + update_conversation)
    if (update_conversation) {
      const my_conversation_topic = 'apps.tilechat.users.' + me + '.conversations.' + convers_with + ".clientadded"
      let conversation = persist_message
      conversation.conversWith = convers_with // new!
      conversation.key = convers_with // retro comp
      conversation.is_new = true
      conversation.archived = false
      conversation.last_message_text = conversation.text // retro comp
      const conversation_payload = JSON.stringify(conversation)
      winston.debug("Updating conversation...")
      chatdb.saveOrUpdateConversation(conversation, (err, doc) => {
        if (err) {
          console.error("(chatdb.saveOrUpdateConversation callback) ERROR: ", err)
          callback(false)
        }
        else {
          callback(true)
        }
      })
    }
    else {
      winston.debug("Skip updating conversation. (update_conversation = false)")
      callback(true)
    }
  })
}

function process_update(topic, message_string, callback) {
  var topic_parts = topic.split(".")
  winston.debug("UPDATE. TOPIC PARTS:", topic_parts)
  winston.debug("payload:" + message_string)
  if (topic_parts.length < 5) {
    winston.debug("process_update topic error.")
    callback(false)
    return
  }
  if (topic_parts[4] === "messages") {
    winston.debug(" MESSAGE UPDATE.")
    // 'apps.tilechat.users.*.messages.*.*.update'
    // 'apps/tilechat/users/USER_ID/messages/CONVERS_WITH/MESSAGE_ID/update'
    // message update, only status update actually supported
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    const message_id = topic_parts[6]
    console.debug("updating message:", message_id, "on convers_with", convers_with, "for user", user_id, "patch", message_string)
    
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
    winston.debug(">>> NOW PUBLISHING... DEST_PATCH: RETURN_RECEIPT. TOPIC: " + recipient_message_update_topic + ", PATCH ", dest_message_patch)
    publish(exchange, recipient_message_update_topic, Buffer.from(dest_message_patch_payload), function(err) {
      winston.debug(">>> PUBLISHED!!!! RECIPIENT MESSAGE TOPIC UPDATE" + recipient_message_update_topic + " WITH PATCH " , dest_message_patch)
      if (err) {
        winston.error("error",err);
        callback(false)
      }
      else {
        console.log("webhook_enabled?????", webhook_enabled);
        if (webhook_enabled) {
          webhooks.WHnotifyMessageStatusReturnReceipt(dest_message_patch, (err) => {
            if (err) {
              winston.error("WHnotifyMessageStatusReturnReceipt with err:" + err)
            } else {
              winston.debug("WHnotifyMessageStatusReturnReceipt ok")
            }
          })
        }
        // DISABLED BECAUSE NOT REALLY NECESSARY (FOR PERF) TO NOTIFY STATUS MODIFICATION TO THE ONE WHO COMMITED THE SAME MOD
        // PUBLISH MY_PATCH: RECEIVED
        // const my_message_update_topic = 'apps.tilechat.users.' + me + '.messages.' + convers_with + '.' + message_id + '.clientupdate'
        // winston.debug(">>> NOW PUBLISHING... MY MESSAGE TOPIC UPDATE", my_message_update_topic, "WITH PATCH", my_message_patch)
        // publish(exchange, my_message_update_topic, Buffer.from(my_message_patch_payload), function(err) {
        //   winston.debug(">>> PUBLISHED!!!! MY MESSAGE TOPIC UPDATE", my_message_update_topic, "WITH PATCH", my_message_patch)
        //   if (err) {
        //     callback(false)
        //     return
        //   }

        // TODO: MOVE TO A PERSIST_UPDATED TOPIC/QUEUE...
        winston.debug(">>> ON DISK... WITH A STATUS ON MY MESSAGE-UPDATE TOPIC", topic, "WITH PATCH", my_message_patch)
        chatdb.saveOrUpdateMessage(my_message_patch, function(err, msg) {
          winston.debug(">>> MESSAGE ON TOPIC", topic, "UPDATED!")
          if (err) {
            winston.error("error",err);
            callback(false)
            return
          }
          winston.debug(">>> ON DISK... RECIPIENT MESSAGE ON DB WITH", dest_message_patch)
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
    winston.debug(" CONVERSATION UPDATE.")
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    winston.debug("updating conversation:" + convers_with + " for user " + user_id + " patch " + message_string)
    
    const patch = JSON.parse(message_string)
    // 1. Patch my conversation: convers_with
    // 2. Publish the patch to my conversation: convers_with
    // 1. SAVE PATCH
    const me = user_id
    patch.timelineOf = me
    patch.conversWith = convers_with
    winston.debug(">>> ON DISK... CONVERSATION TOPIC " + topic + " WITH PATCH " + patch)
    winston.debug("Updating conversation 2.")
    chatdb.saveOrUpdateConversation(patch, function(err, doc) {
      winston.debug(">>> CONVERSATION ON TOPIC" + topic + " UPDATED!")
      if (err) {
        winston.error("error",err);
        callback(false)
        return
      }
      const patch_payload = JSON.stringify(patch)
      const my_conversation_update_topic = 'apps.tilechat.users.' + me + '.conversations.' + convers_with + '.clientupdated'
      winston.debug(">>> NOW PUBLISHING... MY CONVERSATION UPDATE " + my_conversation_update_topic + " WITH PATCH " + patch_payload)
      publish(exchange, my_conversation_update_topic, Buffer.from(patch_payload), function(err) {
        winston.debug(">>> PUBLISHED!!!! MY CONVERSATION UPDATE TOPIC " + my_conversation_update_topic + " WITH PATCH " + patch_payload)
        if (err) {
          winston.error("error",err);
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
  var topic_parts = topic.split(".")
  winston.debug("ARCHIVE. TOPIC PARTS:" + topic_parts + "payload (ignored): " + payload)
  if (topic_parts.length < 7) {
    winston.debug("process_archive topic error. topic_parts.length < 7:" + topic)
    callback(true)
    return
  }
  if (topic_parts[4] === "conversations") {
    winston.debug("CONVERSATION ARCHIVE.")
    // 'apps.tilechat.users.*.messages.*.*.update'
    // 'apps/tilechat/users/USER_ID/messages/CONVERS_WITH/MESSAGE_ID/update'
    // message update, only status update actually supported
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    winston.debug("archiving conversation:" + convers_with + " for user " + user_id + " payload: "+ payload)
    const me = user_id
    conversation_archive_patch = {
      "timelineOf": me,
      "conversWith": convers_with,
      "archived": true
    }
    winston.debug("NOTIFY VIA WEBHOOK ON SAVE TOPIC "+ topic)
    if (webhook_enabled) {
      webhooks.WHnotifyConversationArchived(conversation_archive_patch, (err) => {
        if (err) {
            winston.error("Webhook notified with err:"+ err)
          }else {
            winston.debug("Webhook notified WHnotifyConversationArchived ok")
          }
      });
    }
    winston.debug(">>> ON DISK... ARCHIVE CONVERSATION ON TOPIC: " + topic)
    winston.debug("Updating conversation 3.")
    chatdb.saveOrUpdateConversation(conversation_archive_patch, function(err, msg) {
      winston.debug(">>> CONVERSATION ON TOPIC: " + topic + " ARCHIVED!")
      if (err) {
        winston.error("error",err);
        callback(false)
        return
      }
      const conversation_deleted_topic = 'apps.tilechat.users.' + user_id + '.conversations.' + convers_with + '.clientdeleted'
      winston.debug(">>> NOW PUBLISHING... CONVERSATION ARCHIVED (DELETED) TOPIC " + conversation_deleted_topic)
      const payload = JSON.stringify(conversation_archive_patch)
      publish(exchange, conversation_deleted_topic, Buffer.from(payload), function(err) {
        winston.debug(">>> PUBLISHED!!!! CONVERSATION ON TOPIC: " + conversation_deleted_topic + " ARCHIVED (DELETED). Payload: " + payload + " buffered:" + Buffer.from(payload))
        if (err) {
          winston.error("error",err);
          callback(false)
        }
        else {
          // now publish new archived conversation added
          const archived_conversation_added_topic = 'apps.tilechat.users.' + user_id + '.archived_conversations.' + convers_with + '.clientadded'
          winston.debug(">>> NOW PUBLISHING... CONVERSATION ARCHIVED (ADDED) TOPIC: "+ archived_conversation_added_topic)
          // const success_payload = JSON.stringify({"success": true})
          publish(exchange, archived_conversation_added_topic, Buffer.from(payload), function(err) {
            winston.debug(">>> PUBLISHED!!!! ARCHIVED (DELETED) CONVERSATION ON TOPIC: " + conversation_deleted_topic)
            if (err) {
              winston.error("error",err);
              callback(false)
            }
            else {
              callback(true)
            }
          });
        }
      });
    });
  }
}

function process_create_group(topic, payload, callback) {
  var topic_parts = topic.split(".")
  winston.debug("process_create_group. TOPIC PARTS:" + topic_parts + " payload:" + payload)
  // `apps.observer.${app_id}.groups.create`
  const app_id = topic_parts[2]
  winston.debug("app_id:" + app_id)
  winston.debug("payload:"+ payload)
  const group = JSON.parse(payload)
  if (!group.uid || !group.name || !group.members || !group.owner) {
    winston.debug("group error.");
    callback(true);
    return
  }
  group.appId = app_id
  // saveOrUpdateGroup(group, function(ok) {
  //   if (ok) {

  deliverGroupAdded(group, function(ok) {
    if (!ok) {
      callback(false)
    }
    else {
      sendGroupWelcomeMessageToInitialMembers(app_id, group, function(ok) {
        if (!ok) {
          callback(false)
        }
        else {
          for (let [member_id, value] of Object.entries(group.members)) {
            winston.debug(">>>>> JOINING MEMBER: "+member_id)
            joinGroup(member_id, group, function(reply) {
                winston.debug("member: " + member_id + " invited on group " + group + " result " + reply)
            })
          }
          callback(true)
        }
      })
    }
  })

    // }
    // else {
    //   callback(false)
    // }
  // })
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
function joinGroup(joined_member_id, group, callback) {
  winston.debug("SENDING 'ADDED TO GROUP' TO EACH MEMBER INCLUDING THE JOINED ONE...", group)
  const appid = group.appId
  for (let [member_id, value] of Object.entries(group.members)) {
      winston.debug("to member:" + member_id)
      const now = Date.now()
      const message = {
          message_id: uuid(),
          type: "text",
          text: joined_member_id + " added to group",
          timestamp: now,
          channel_type: "group",
          sender_fullname: "System",
          sender: "system",
          recipient_fullname: group.name,
          recipient: group.uid,
          status: 100, // MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT,
          attributes: {
              subtype:"info",
              updateconversation : true,
              messagelabel: {
                  key: "MEMBER_JOINED_GROUP",
                  parameters: {
                      member_id: joined_member_id
                      // fullname: fullname // OPTIONAL
                  }
              }
          }
      }
      winston.debug("Member joined group message:", message)
      let inbox_of = member_id
      let convers_with = group.uid
      deliverMessage(message, appid, inbox_of, convers_with, (ok) => {
        if (!ok) {
          winston.error("error delivering message to joined member", inbox_of)
          callback(ok)
          return
        }
        else {
          winston.debug("DELIVERED MESSAGE TO: " + inbox_of + " CONVERS_WITH " + convers_with)
        }
      })
  }
  // 2. pubblish old group messages to the joined member (in the member/group-conversWith timeline)
  const userid = group.uid
  const convid = group.uid
  chatdb.lastMessages(appid, userid, convid, 1, 200, (err, messages) => {
      if (err) {
          winston.error("Error", err)
          callback(err)
      }
      else if (!messages) {
          winston.debug("No messages in group: " + group.uid)
          callback(null)
      }
      else {
          winston.debug("delivering past group messages to:" + joined_member_id + " messages: ", messages)
          const inbox_of = joined_member_id
          const convers_with = group.uid
          messages.forEach(message => {
              // TODO: CHECK IN MESSAGE WAS ALREADY DELIVERED. (CLIENT? SERVER?)
              winston.debug("Message:", message.text)
              deliverMessage(message, appid, inbox_of, convers_with, (err) => {
                  if (err) {
                      winston.error("error delivering past message to joined member: " + inbox_of, err)
                  }
                  else {
                      winston.debug("DELIVERED PAST MESSAGE TO: " + inbox_of + " CONVERS_WITH : " + convers_with)
                  }
              })
          });
          callback(null)
      }
  })
}

function process_update_group(topic, payload, callback) {
  var topic_parts = topic.split(".")
  winston.debug("process_update_group. TOPIC PARTS:" + topic_parts + "payload:" + payload)
  // `apps.observer.${app_id}.groups.update`
  const app_id = topic_parts[2]
  winston.debug("app_id:" + app_id)
  winston.debug("payload:" + payload)
  const data = JSON.parse(payload)
  winston.debug("process_update_group DATA ", data)
  const group = data.group
  winston.debug("process_update_group DATA.group ", data.group)
  const notify_to = data.notify_to
  winston.debug("process_update_group DATA.notify_to ", data.notify_to)
  if (!group || !group.uid) {
    winston.debug("group error.")
    callback(true)
    return
  }
  deliverGroupUpdated(group, notify_to, function(ok) {
    callback(ok)
  })
}

// enqueues group saving on db DEPRECATED
// function saveOrUpdateGroup(group, callback) {
//   chatdb.saveOrUpdateGroup(group, function(err, doc) {
//     if (err) {
//       winston.error("Error saving group:", err)
//       callback(false)
//       return
//     }
//     else {
//       callback(true)
//     }
//   })
// }

function deliverGroupAdded(group, callback) {
  const app_id = group.appId
  for (let [key, value] of Object.entries(group.members)) {
    const member_id = key
    const added_group_topic = `apps.${app_id}.users.${member_id}.groups.${group.uid}.clientadded`
    winston.debug("added_group_topic:", added_group_topic)
    const payload = JSON.stringify(group)
    publish(exchange, added_group_topic, Buffer.from(payload), function(err, msg) {
      if (err) {
        winston.error("error",err);
        callback(false)
        return
      }
    })
  }
  callback(true)
}

function deliverGroupUpdated(group, notify_to, callback) {
  const app_id = group.appId
  for (let [key, value] of Object.entries(notify_to)) {
    const member_id = key
    const updated_group_topic = `apps.${app_id}.users.${member_id}.groups.${group.uid}.clientupdated`
    winston.debug("updated_group_topic:", updated_group_topic)
    const payload = JSON.stringify(group)
    publish(exchange, updated_group_topic, Buffer.from(payload), function(err, msg) {
      if (err) {
        winston.error("error",err);
        callback(false)
        return
      }
    })
  }
  callback(true)
}

function sendGroupWelcomeMessageToInitialMembers(app_id, group, callback) {
  for (let [key, value] of Object.entries(group.members)) {
    const member_id = key
    const now = Date.now()
    var group_created_message = {
      message_id: uuid(),
      type: "text",
      text: "Group created",
      timestamp: now,
      channel_type: "group",
      sender_fullname: "System",
      sender: "system",
      recipient_fullname: group.name,
      recipient: group.uid,
      status: MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT,
      attributes: {
        subtype: "info",
        updateconversation: true, // TO BE USED LATER
        messagelabel: {
          key: "GROUP_CREATED",
          parameters:
          {
            creator: group.owner
          }
        }
      }
    }
    // if (member_id !== group.owner) {
    //   group_created_message.text = "You was added to this group"
    // }
    // else {
    //   group_created_message.text = "You created this group"
    // }
    const user_id = member_id
    const convers_with = group.uid
    winston.debug("user_id: " + user_id)
    winston.debug("convers_with: " + convers_with)
    deliverMessage(group_created_message, app_id, user_id, convers_with, function(ok) {
      winston.debug("MESSAGE DELIVERED?", ok)
      if (!ok) {
        winston.debug("Error sending group creation message.", group_created_message)
        callback(false)
        return
      }
    })
  }
  callback(true)
}

function closeOnErr(err) {
  if (!err) return false;
  console.error("[AMQP] error", err);
  amqpConn.close();
  return true;
}

// var mongouri = process.env.MONGODB_URI || "mongodb://localhost:27017/chatdb";
// var mongodb = require("mongodb");
// const { Console } = require('console');
// // var ObjectID = mongodb.ObjectID;
// // Create a database variable outside of the
// // database connection callback to reuse the connection pool in the app.
// var db;
// winston.debug("connecting to mongodb...")
// mongodb.MongoClient.connect(mongouri, { useNewUrlParser: true, useUnifiedTopology: true }, function (err, client) {
//   if (err) {
//     winston.debug(err);
//     process.exit(1);
//   } else {
//     winston.debug("MongoDB successfully connected.")
//   }
//   db = client.db();
//   // var port = process.env.PORT || 3000;
//   // app.listen(port, () => {
//   //   winston.debug('Web server started.');
//   // })
//   chatdb = new ChatDB({database: db})
//   winston.debug('Starting observer.')
//   startMQ();
// });

async function startServer() {
  var mongouri = process.env.MONGODB_URI || "mongodb://localhost:27017/chatdb";
  var mongodb = require("mongodb");
  var db;
  winston.debug("connecting to mongodb...");
  var client = await mongodb.MongoClient.connect(mongouri, { useNewUrlParser: true, useUnifiedTopology: true })
  winston.debug("mongodb connected...", db);
  db = client.db();
  chatdb = new ChatDB({database: db})
  winston.debug('Starting observer.')
  var amqpConnection = await start();
  winston.debug("[Observer.AMQP] connected.");
  winston.info("Starting webhooks...");
  webhooks = new Webhooks({appId: app_id, RABBITMQ_URI: process.env.RABBITMQ_URI, exchange: exchange, webhook_endpoint: webhook_endpoint, webhook_events: webhook_events_array, queue_name: 'webhooks'});
  await webhooks.start();
  webhooks.enabled = webhook_enabled;
}

// startServer()

// ************ WEBHOOKS *********** //

// function WHnotifyMessageReceived(message, callback) {
//   winston.debug("NOTIFY MESSAGE:", message);
  
//   if (webhook_enabled===false) {
//     winston.debug("WHnotifyMessageReceived Discarding notification. webhook_enabled is false.");
//     // callback({err: "WHnotifyMessageReceived Discarding notification. webhook_enabled is false."}); 
//     callback(null)
//     return
//   }

//   const notify_topic = `observer.webhook.apps.${app_id}.message_received`
//   winston.debug("notifying webhook notifyMessageReceived topic:" + notify_topic)
//   const message_payload = JSON.stringify(message)
//   winston.debug("MESSAGE_PAYLOAD: " + message_payload)
//   publish(exchange, notify_topic, Buffer.from(message_payload), (err) => {
//     if (err) {
//       winston.error("Err", err)
//       callback(err)
//     }
//     else {
//       callback(null)
//     }
//   })
// }

// function WHnotifyMessageSaved(message, callback) {
//   winston.debug("NOTIFY MESSAGE:", message)

//   if (webhook_enabled===false) {
//     winston.debug("WHnotifyMessageSaved Discarding notification. webhook_enabled is false.");
//     // callback({err: "WHnotifyMessageSaved Discarding notification. webhook_enabled is false."});
//     callback(null)
//     return
//   }

//   // callback(null)
//   const notify_topic = `observer.webhook.apps.${app_id}.message_saved`
//   winston.debug("notifying webhook notifyMessageSaved topic: " + notify_topic)
//   const message_payload = JSON.stringify(message)
//   winston.debug("MESSAGE_PAYLOAD: " + message_payload)
//   publish(exchange, notify_topic, Buffer.from(message_payload), (err) => {
//     if (err) {
//       winston.error("Err", err)
//       callback(err)
//     }
//     else {
//       callback(null)
//     }
//   })
// }

// function WHnotifyConversationSaved(conversation, callback) {
//   winston.debug("NOTIFY CONVERSATION:", conversation)

//   if (webhook_enabled===false) {
//     winston.debug("WHnotifyConversationSaved Discarding notification. webhook_enabled is false.");
//     // callback({err: "WHnotifyConversationSaved Discarding notification. webhook_enabled is false."}); 
//     callback(null)
//     return
//   }

//   // callback(null)
//   const notify_topic = `observer.webhook.apps.${app_id}.conversation_saved`
//   winston.debug("notifying webhook notifyConversationSaved topic: "+ notify_topic)
//   const conversation_payload = JSON.stringify(conversation)
//   winston.debug("CONVERSATION_PAYLOAD:"+ conversation_payload)
//   publish(exchange, notify_topic, Buffer.from(conversation_payload), (err) => {
//     if (err) {
//       winston.error("Err", err)
//       callback(err)
//       //ATTENTO
//     }
//     else {
//       // winston.debug("ok",callback)
//       callback(null)
//       //ATTENTO
//     }
//   })
// }

// function WHnotifyConversationArchived(conversation, callback) {
//   winston.debug("NOTIFY CONVERSATION ARCHIVED:", conversation)

//   if (webhook_enabled===false) {
//     winston.debug("WHnotifyConversationArchived Discarding notification. webhook_enabled is false.");
//     // callback({err: "WHnotifyConversationArchived Discarding notification. webhook_enabled is false."}); 
//     callback(null)
//     return
//   }

//   const notify_topic = `observer.webhook.apps.${app_id}.conversation_archived`
//   winston.debug("notifying webhook notifyConversationArchived topic: " + notify_topic)
//   const payload = JSON.stringify(conversation)
//   winston.debug("PAYLOAD:", payload)
//   publish(exchange, notify_topic, Buffer.from(payload), (err) => {
//     if (err) {
//       winston.error("Err", err)
//       callback(err)
//     }
//     else {
//       callback(null)
//     }
//   })
// }

// function WHprocess_webhook_message_received(topic, message_string, callback) {
//   winston.debug("process webhook_message_received: " + message_string + " on topic: " + topic)
//   var message = JSON.parse(message_string)
//   winston.debug("timelineOf...:" + message.timelineOf)
//   if (callback) {
//     callback(true)
//   }
//   if (webhook_enabled===false) {
//     winston.debug("WHprocess_webhook_message_received Discarding notification. webhook_enabled is false.");
//     // callback(true); 
//     return
//   }

//   if (!WHisMessageOnGroupTimeline(message)) {
//     winston.debug("WHprocess_webhook_message_received Discarding notification. Not to group.");
//     // callback(true); 
//     return
//   } if (!webhook_endpoint) {
//     winston.debug("WHprocess_webhook_message_received Discarding notification. webhook_endpoint is undefined.")
//     // callback(true);
//     return
//   }
//   if (webhook_methods_array.indexOf("new-message")==-1) {
//     winston.debug("WHprocess_webhook_message_received Discarding notification. new-message not enabled.");
//     // callback(true); 
//     return
//   }

//   winston.verbose("Sending notification to webhook (webhook_message_received) on webhook_endpoint:", webhook_endpoint)
//   const message_id = message.message_id;
//   const recipient_id = message.recipient;
//   const app_id = message.app_id;
//   var json = {
//     event_type: "new-message",
//     createdAt: new Date().getTime(),
//     recipient_id: recipient_id,
//     app_id: app_id,
//     message_id: message_id,
//     data: message
//   };
//   winston.debug("WHprocess_webhook_message_received Sending JSON webhook:", json)
//   WHsendData(json, function(err, data) {
//     if (err)  {
//       winston.error("Err WHsendData callback", err);
//     } else {
//       winston.debug("WHsendData sendata end with data:" + data);
//     }    
//   })
// }




// function WHprocess_webhook_message_saved(topic, message_string, callback) {
//   winston.debug("process webhook_message_saved: " + message_string + " on topic: " + topic)
//   var message = JSON.parse(message_string)
//   winston.debug("timelineOf...: " + message.timelineOf)
//   if (callback) {
//     callback(true)
//   }

//   if (webhook_enabled===false) {
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
//   WHsendData(json, function(err, data) {
//     if (err)  {
//       winston.error("Err WHsendData callback", err);
//     } else {
//       winston.debug("WHsendData sendata end with data:" + data);
//     }
//   })
// }


// function WHprocess_webhook_conversation_saved(topic, conversation_string, callback) {
//   winston.debug("process webhook_conversation_saved:" + conversation_string + "on topic" + topic)
//   var conversation = JSON.parse(conversation_string)

//   if (callback) {
//     callback(true)
//   }
  
//   if (webhook_enabled===false) {
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
//   WHsendData(json, function(err, data) {
//     if (err)  {
//       winston.error("Err WHsendData callback", err);
//     } else {
//       winston.debug("WHsendData sendata end with data:" + data);
//     }    
//   })
// }

// function WHprocess_webhook_conversation_archived(topic, message_string, callback) {
//   winston.debug("process webhook_conversation_archived:", message_string, "on topic", topic)
//   var conversation = JSON.parse(message_string)
//   if (callback) {
//     callback(true)
//   }

//   if (webhook_enabled===false) {
//     winston.debug("Discarding notification. webhook_enabled is false.");
//     // callback(true); 
//     return
//   }

//   // if (!WHisMessageOnGroupTimeline(message)) {
//   //   winston.debug("Discarding notification. Not to group.")
//   //   return
//   // }

//   if (!webhook_endpoint) {
//     winston.debug("WHprocess_webhook_conversation_archived: Discarding notification. webhook_endpoint is undefined.")
//     return
//   }

//   if (webhook_methods_array.indexOf("deleted-conversation")==-1) {
//     winston.debug("Discarding notification. deleted-conversation not enabled.");
//     // callback(true); 
//     return
//   }

//   winston.verbose("Sending notification to webhook (webhook_conversation_archived):", webhook_endpoint)
//   const conversWith = conversation.conversWith;
//   const timelineOf = "system"; // conversation.timelineOf; temporary patch for Tiledesk

//   chatdb.getConversation(timelineOf, conversWith, function(err, conversation) {
//     var json = {
//       event_type: "deleted-conversation",
//       createdAt: new Date().getTime(),
//       app_id: conversation.app_id,
//       user_id: "system", // temporary patch for Tiledesk
//       recipient_id: conversWith,
//       data: conversation
//     };
//     winston.debug("Sending JSON webhook:", json)
//     WHsendData(json, function(err, data) {
//       if (err)  {
//         winston.error("Err WHsendData callback", err);
//       } else {
//         winston.debug("WHsendData sendata end with data:" + data);
//       }    
//     })
//     // var q = url.parse(webhook_endpoint, true);
//     // winston.debug("ENV WEBHOOK URL PARSED:", q)
//     // var protocol = (q.protocol == "http:") ? require('http') : require('https');
//     // let options = {
//     //   path:  q.pathname,
//     //   host: q.hostname,
//     //   port: q.port,
//     //   method: 'POST',
//     //   headers: {
//     //     "Content-Type": "application/json"
//     //   }
//     // };
//     // try {
//     //   const req = protocol.request(options, (response) => {
//     //     var respdata = ''
//     //     response.on('data', function (chunk) {
//     //       respdata += chunk;
//     //     });
//     //     response.on('end', function () {
//     //       winston.debug("WEBHOOK RESPONSE:", respdata);
//     //     });
//     //   });
//     //   req.write(JSON.stringify(json));
//     //   req.end();
//     // }
//     // catch(err) {
//     //   winston.debug("an error occurred:", err)
//     // }
//   })
// }

// function WHisMessageOnGroupTimeline(message) {
//   if (message && message.timelineOf) {
//     if (message.timelineOf.toLowerCase().indexOf("group") !== -1) {
//       return true
//     }
//   }
//   return false
// }

// function WHsendData2(json, callback) {
//   return callback(null, {ok:"ok"})
// }
// function WHsendData(json, callback) {
//   var q = url.parse(webhook_endpoint, true);
//   winston.debug("ENV WEBHOOK URL PARSED:", q)
//   var protocol = (q.protocol == "http:") ? require('http') : require('https');
//   let options = {
//     path:  q.pathname,
//     host: q.hostname,
//     port: q.port,
//     method: 'POST',
//     headers: {
//       "Content-Type": "application/json"
//     }
//   };
//   try {
//     const req = protocol.request(options, (response) => {
//       winston.debug("statusCode: "+  response.statusCode + " for webhook_endpoint: " + webhook_endpoint);
//       if (response.statusCode < 200 || response.statusCode > 299) { // (I don"t know if the 3xx responses come here, if so you"ll want to handle them appropriately
//         winston.debug("http statusCode error "+  response.statusCode + " for webhook_endpoint: " + webhook_endpoint);
//         return callback({statusCode:response.statusCode}, null)
//       }
//       var respdata = ''
//       response.on('data', function (chunk) {
//         // winston.debug("chunk"+chunk)
//         respdata += chunk;
//       });
//       response.on('end', function () {
//         winston.info("WEBHOOK RESPONSE:"+ respdata + " for webhook_endpoint: " + webhook_endpoint);
//         return callback(null, respdata) //TODO SE IL WEBHOOK NN RITORNA SEMBRA CHE SI BLOCCI
//       });     
//     });
//     req.on('error', function(err) {
//       winston.error("WEBHOOK RESPONSE Error:", err);
//       return callback(err, null)
//     });
//     req.write(JSON.stringify(json));
//     req.end();
//     // winston.debug("end")
//   }
//   catch(err) {
//     winston.error("an error occurred while posting this json " + JSON.stringify(json), err)
//     return callback(err, null)
//   }
// }

module.exports = {startServer: startServer, setWebHookEndpoint: setWebHookEndpoint, setWebHookMethods:setWebHookMethods, setWebHookEnabled:setWebHookEnabled };