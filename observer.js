require('dotenv').config();
var amqp = require('amqplib/callback_api');
const { ChatDB } = require('./chatdb/index.js');
const uuidv4 = require('uuid/v4');
var Message = require("./models/message");
var MessageConstants = require("./models/messageConstants");
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

var amqpConn = null;
var exchange = 'amq.topic';
// FROM CLIENTS TOPICS
const topic_outgoing = `apps.${process.env.APP_ID}.users.*.messages.*.outgoing`
const topic_update = `apps.${process.env.APP_ID}.users.#.update`
const topic_archive = `apps.${process.env.APP_ID}.users.#.archive`
const topic_presence = `apps.${process.env.APP_ID}.users.*.presence.*`
// FOR OBSERVER TOPICS
const topic_incoming = `apps.observer.${process.env.APP_ID}.users.*.messages.*.incoming`
const topic_delivered = `apps.observer.${process.env.APP_ID}.users.*.messages.*.delivered`
const topic_create_group = `apps.observer.${process.env.APP_ID}.groups.create`
const topic_update_group = `apps.observer.${process.env.APP_ID}.groups.update`

var chatdb;

function startMQ() {
  console.log("Connecting to RabbitMQ...")
  amqp.connect(process.env.RABBITMQ_URI, function (err, conn) {
    if (err) {
      console.error("[AMQP]...", err.message);
      return setTimeout(startMQ, 5000);
    }
    conn.on("error", function (err) {
      if (err.message !== "Connection closing") {
        console.error("[AMQP] conn error", err.message);
      }
    });
    conn.on("close", function () {
      console.error("[AMQP] reconnecting");
      return setTimeout(startMQ, 1000);
    });
    console.log("[AMQP] connected.");
    amqpConn = conn;
    whenConnected();
  });
}

function whenConnected() {
  startPublisher();
  startWorker();
}

var pubChannel = null;
var offlinePubQueue = [];
function startPublisher() {
  amqpConn.createConfirmChannel(function (err, ch) {
    if (closeOnErr(err)) return;
    ch.on("error", function (err) {
      console.error("[AMQP] channel error", err.message);
    });
    ch.on("close", function () {
      console.log("[AMQP] channel closed");
    });
    pubChannel = ch;
    if (offlinePubQueue.length > 0) {
      while (true) {
        var [exchange, routingKey, content] = offlinePubQueue.shift();
        publish(exchange, routingKey, content);
      }
    }
  });
}

function publish(exchange, routingKey, content, callback) {
  try {
    pubChannel.publish(exchange, routingKey, content, { persistent: true },
      function (err, ok) {
        if (err) {
          console.error("[AMQP] publish", err);
          offlinePubQueue.push([exchange, routingKey, content]);
          pubChannel.connection.close();
          callback(err)
        }
        else {
          // console.log("published to", routingKey, "result", ok)
          callback(null)
        }
      });
  } catch (e) {
    console.error("[AMQP] publish", e.message);
    offlinePubQueue.push([exchange, routingKey, content]);
    callback(e)
  }
}

// function publish(routingKey, content, callback) {
//   try {
//     _publish(exchange, routingKey, content, { persistent: true },
//       function (err, ok) {
//         callback(err, ok)
//       });
//   } catch (e) {
//     console.error("[AMQP] publish", e.message);
//     offlinePubQueue.push([exchange, routingKey, content]);
//     callback(e)
//   }
// }

var channel;
function startWorker() {
  amqpConn.createChannel(function (err, ch) {
    channel = ch;
    if (closeOnErr(err)) return;
    ch.on("error", function (err) {
      console.error("[AMQP] channel error", err.message);
    });
    ch.on("close", function () {
      console.log("[AMQP] channel closed");
    });
    ch.prefetch(10);
    ch.assertExchange(exchange, 'topic', {
      durable: true
    });
    ch.assertQueue("jobs", { durable: true }, function (err, _ok) {
      if (closeOnErr(err)) return;
      subscribeTo(topic_outgoing, ch, _ok.queue)
      subscribeTo(topic_incoming, ch, _ok.queue)
      subscribeTo(topic_update, ch, _ok.queue)
      subscribeTo(topic_archive, ch, _ok.queue)
      subscribeTo(topic_presence, ch, _ok.queue)
      subscribeTo(topic_create_group, ch, _ok.queue)
      subscribeTo(topic_update_group, ch, _ok.queue)
      subscribeTo(topic_delivered, ch, _ok.queue)
      ch.consume("jobs", processMsg, { noAck: false });
      console.log("Worker is started");
    });
  });
}

function subscribeTo(topic, channel, queue) {
  channel.bindQueue(queue, exchange, topic, {}, function (err, oka) {
    console.log("bind: " + queue + " err: " + err + " topic: " + topic);
  });
}

function processMsg(msg) {
  work(msg, function (ok) {
    try {
      if (ok)
        channel.ack(msg);
      else
        channel.reject(msg, true);
    } catch (e) {
      closeOnErr(e);
    }
  });
}

function work(msg, callback) {
  console.log("NEW TOPIC:", msg.fields.routingKey) //, " message:", msg.content.toString());
  const topic = msg.fields.routingKey //.replace(/[.]/g, '/');
  const message_string = msg.content.toString();
  if (topic.endsWith('.outgoing')) {
    process_outgoing(topic, message_string, callback);
  }
  else if (topic.endsWith('.incoming')) {
    process_incoming(topic, message_string, callback);
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
    console.log("unhandled topic:", topic)
    callback(true)
  }
}

// ***** TOPIC HANDLERS ******/

function process_presence(topic, message_string, callback) {
  console.log("got PRESENCE testament", message_string, " on topic", topic)
  callback(true)
}

function process_outgoing(topic, message_string, callback) {
  console.log("TOPIC OUTGOING:", topic)
  var topic_parts = topic.split(".")
  // /apps/tilechat/users/(ME)SENDER_ID/messages/RECIPIENT_ID/outgoing
  const app_id = topic_parts[1]
  const sender_id = topic_parts[3]
  const recipient_id = topic_parts[5]
  const convers_with = recipient_id
  const me = sender_id

  var message = JSON.parse(message_string)
  var messageId = uuidv4()
  const now = Date.now()
  var outgoing_message = message
  outgoing_message.message_id = messageId
  outgoing_message.sender = me
  outgoing_message.recipient = recipient_id
  outgoing_message.app_id = app_id
  outgoing_message.timestamp = now
  outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED // =150

  if (!isGroup(recipient_id)) {
    console.log("!isGroup")
    let inbox_of = recipient_id
    let convers_with = sender_id
    deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function(ok) {
      if (ok) {
        if (recipient_id !== sender_id) {
          inbox_of = sender_id
          convers_with = recipient_id
          outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT // =100. DELIVERED it's better, but the JS client actually wants 100 to show the sent-checkbox
          deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function(ok) {
            if (ok) {
              callback(true)
            }
            else {
              callback(false)
            }
          })
        }
      }
    })
  }
  else {
    const group_id = recipient_id
    chatdb.getGroup(group_id, function(err, group) { // REDIS?
      console.log("group found!", group)
      // adding the group in the members so we got a copy of
      // all the group messages in timelineOf: group.uid
      group.members[group.uid] = 1
      for (let [member_id, value] of Object.entries(group.members)) {
        const inbox_of = member_id
        const convers_with = recipient_id
        console.log("inbox_of:", inbox_of)
        console.log("convers_with:", convers_with)
        outgoing_message.channel_type = "group"
        deliverMessage(outgoing_message, app_id, inbox_of, convers_with, function(ok) {
          console.log("MESSAGE DELIVERED?", ok)
          if (!ok) {
            console.log("Error sending group creation message.", group_created_message)
            callback(false)
            return
          }
        })
      }
      callback(true)
    })
  }
}

function isGroup(group_id) {
  if (group_id.indexOf('group-') >= 0) {
    return true
  }
  return false
}

function deliverMessage(message, app_id, inbox_of, convers_with_id, callback) {
  console.log("DELIVERING:", message, "inbox_of:", inbox_of, "convers_with:", convers_with_id)
  const incoming_topic = `apps.observer.${app_id}.users.${inbox_of}.messages.${convers_with_id}.incoming`
  const added_topic = `apps.${app_id}.users.${inbox_of}.messages.${convers_with_id}.clientadded`
  console.log("incoming_topic:", incoming_topic)
  console.log("added_topic:", added_topic)
  const message_payload = JSON.stringify(message)
  // notifies to the client
  publish(exchange, added_topic, Buffer.from(message_payload), function(err, msg) { // .clientadded
    if (err) {
      callback(false)
      return
    }
    // saves on db and creates conversation
    console.log("ADDED. NOW TO INCOMING:", incoming_topic)
    publish(exchange, incoming_topic, Buffer.from(message_payload), function(err, msg) { // .incoming
      if (err) {
        console.log("... ALL BAD ON:", incoming_topic)
        callback(false)
        return
      }
      console.log("... ALL GOOD ON:", incoming_topic)
      callback(true)
    })
  })
}

// delivers messages to inboxes with rabbitmq quues
function process_delivered(topic, message_string, callback) {
  console.log(">>>>> DELIVERED:", topic, "MESSAGE PAYLOAD:",message_string)
  var topic_parts = topic.split(".")
  // delivers the message payload in the INBOX_OF -> CONVERS_WITH timeline
  // /apps/observer/tilechat/users/INBOX_OF/messages/CONVERS_WITH/delivered
  const app_id = topic_parts[2]
  const inbox_of = topic_parts[4]
  const convers_with = topic_parts[6]
  deliverMessage(message_string, app_id, inbox_of, convers_with, function(ok) {
    console.log("MESSAGE DELIVERED?", ok)
    if (!ok) {
      console.log("Error delivering message.", message_string)
      callback(false)
    }
    else {
      callback(true)
    }
  })
}

// This handler only saves messages and updates relative conversations.
// Original messages were already delivered with *.messages.*.clientadded
function process_incoming(topic, message_string, callback) {
  console.log(">>>>> INCOMING:", topic, "MESSAGE PAYLOAD:",message_string)
  var topic_parts = topic.split(".")
  // /apps/observer/tilechat/users/ME/messages/CONVERS_WITH/incoming -> WITH "SERVER" THIS MESSAGES WILL NOT BE DELIVERED TO CLIENTS
  const app_id = topic_parts[2]
  const me = topic_parts[4]
  const convers_with = topic_parts[6]

  let incoming_message = JSON.parse(message_string)
  let savedMessage = incoming_message
  savedMessage.app_id = app_id
  savedMessage.timelineOf = me
  savedMessage.conversWith = convers_with
  // savedMessage.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.DELIVERED
  
  console.log("saving incoming message:", savedMessage)
  chatdb.saveOrUpdateMessage(savedMessage, function(err, msg) {
    const my_conversation_topic = 'apps.tilechat.users.' + me + '.conversations.' + convers_with + ".clientadded"
    let conversation = incoming_message
    conversation.conversWith = convers_with // new!
    conversation.key = convers_with // retro comp
    conversation.is_new = true
    conversation.archived = false
    conversation.last_message_text = conversation.text // retro comp
    const conversation_payload = JSON.stringify(conversation)
    console.log("PUB CONV:", conversation_payload)
    publish(exchange, my_conversation_topic, Buffer.from(conversation_payload), function(err) {
      if (err) {
        callback(false) // TODO message was already saved! What todo? Remove?
      }
      else {
        chatdb.saveOrUpdateConversation(conversation, null)
        callback(true)
      }
    });
  })
}

function process_update(topic, message_string, callback) {
  var topic_parts = topic.split(".")
  console.log("UPDATE. TOPIC PARTS:", topic_parts, "payload:", message_string)
  if (topic_parts.length < 5) {
    console.log("process_update topic error.")
    callback(false)
    return
  }
  if (topic_parts[4] === "messages") {
    console.log(" MESSAGE UPDATE.")
    // 'apps.tilechat.users.*.messages.*.*.update'
    // 'apps/tilechat/users/USER_ID/messages/CONVERS_WITH/MESSAGE_ID/update'
    // message update, only status update actually supported
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    const message_id = topic_parts[6]
    console.log("updating message:", message_id, "on convers_with", convers_with, "for user", user_id, "patch", message_string)
    
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
      "status": patch.status // for the moment this is always = 200 (SENT)
    }
    const my_message_patch_payload = JSON.stringify(my_message_patch)
    console.log(">>> ON DISK... WITH A STATUS ON MY MESSAGE-UPDATE TOPIC", topic, "WITH PATCH", my_message_patch)
    chatdb.saveOrUpdateMessage(my_message_patch, function(err, msg) {
      console.log(">>> MESSAGE ON TOPIC", topic, "UPDATED!")
      if (err) {
        callback(false)
        return
      }
      // DISABLE BECAUSE NOT REALLY NECESSARY (FOR PERF) TO NOTIFY STATUS MODIFICATION TO THE ONE WHO COMMITED THE SAME MOD
      // const my_message_update_topic = 'apps.tilechat.users.' + me + '.messages.' + convers_with + '.' + message_id + '.clientupdate'
      // console.log(">>> NOW PUBLISHING... MY MESSAGE TOPIC UPDATE", my_message_update_topic, "WITH PATCH", my_message_patch)
      // publish(exchange, my_message_update_topic, Buffer.from(my_message_patch_payload), function(err) {
      //   console.log(">>> PUBLISHED!!!! MY MESSAGE TOPIC UPDATE", my_message_update_topic, "WITH PATCH", my_message_patch)
      //   if (err) {
      //     callback(false)
      //     return
      //   }
        const dest_message_patch = {
          "timelineOf": convers_with,
          "message_id": message_id,
          "status": MessageConstants.CHAT_MESSAGE_STATUS_CODE.RETURN_RECEIPT
        }
        const dest_message_patch_payload = JSON.stringify(dest_message_patch)
        console.log(">>> ON DISK... RECIPIENT MESSAGE ON DB WITH", dest_message_patch)
        chatdb.saveOrUpdateMessage(dest_message_patch, function(err, msg) {
          const recipient_message_update_topic = 'apps.tilechat.users.' + convers_with + '.messages.' + me + '.' + message_id + '.clientupdated'
          console.log(">>> NOW PUBLISHING... RECIPIENT MESSAGE TOPIC UPDATE", recipient_message_update_topic, "WITH PATCH", dest_message_patch)
          publish(exchange, recipient_message_update_topic, Buffer.from(dest_message_patch_payload), function(err) {
            console.log(">>> PUBLISHED!!!! RECIPIENT MESSAGE TOPIC UPDATE", recipient_message_update_topic, "WITH PATCH", dest_message_patch)
            if (err) {
              callback(false)
            }
            else {
              callback(true)
            }
          });
        });
      // });
    });
  }
  else if (topic_parts[4] === "conversations") {
    // conversation update, only is_new update actually supported
    // 'apps/tilechat/users/USER_ID/conversations/CONVERS_WITH/update'
    console.log(" CONVERSATION UPDATE.")
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    console.log("updating conversation:", convers_with, "for user", user_id, "patch", message_string)
    
    const patch = JSON.parse(message_string)
    // 1. Patch my conversation: convers_with
    // 2. Publish the patch to my conversation: convers_with
    // 1. SAVE PATCH
    const me = user_id
    patch.timelineOf = me
    patch.conversWith = convers_with
    console.log(">>> ON DISK... CONVERSATION TOPIC", topic, "WITH PATCH", patch)
    chatdb.saveOrUpdateConversation(patch, function(err, doc) {
      console.log(">>> CONVERSATION ON TOPIC", topic, "UPDATED!")
      if (err) {
        callback(false)
        return
      }
      const patch_payload = JSON.stringify(patch)
      const my_conversation_update_topic = 'apps.tilechat.users.' + me + '.conversations.' + convers_with + '.clientupdated'
      console.log(">>> NOW PUBLISHING... MY CONVERSATION UPDATE", my_conversation_update_topic, "WITH PATCH", patch_payload)
      publish(exchange, my_conversation_update_topic, Buffer.from(patch_payload), function(err) {
        console.log(">>> PUBLISHED!!!! MY CONVERSATION UPDATE TOPIC", my_conversation_update_topic, "WITH PATCH", patch_payload, "err", err)
        if (err) {
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
  console.log("ARCHIVE. TOPIC PARTS:", topic_parts, "payload (ignored):", payload)
  if (topic_parts.length < 7) {
    console.log("process_archive topic error. topic_parts.length < 7:", topic)
    callback(true)
    return
  }
  if (topic_parts[4] === "conversations") {
    console.log("CONVERSATION ARCHIVE.")
    // 'apps.tilechat.users.*.messages.*.*.update'
    // 'apps/tilechat/users/USER_ID/messages/CONVERS_WITH/MESSAGE_ID/update'
    // message update, only status update actually supported
    const app_id = topic_parts[1]
    const user_id = topic_parts[3]
    const convers_with = topic_parts[5]
    console.log("archiving conversation:", convers_with, "for user", user_id, "payload", payload)
    const me = user_id
    conversation_archive_patch = {
      "timelineOf": me,
      "conversWith": convers_with,
      "archived": true
    }
    console.log(">>> ON DISK... ARCHIVE CONVERSATION ON TOPIC", topic)
    chatdb.saveOrUpdateConversation(conversation_archive_patch, function(err, msg) {
      console.log(">>> CONVERSATION ON TOPIC", topic, "ARCHIVED!")
      if (err) {
        callback(false)
        return
      }
      const conversation_deleted_topic = 'apps.tilechat.users.' + user_id + '.conversations.' + convers_with + '.clientdeleted'
      console.log(">>> NOW PUBLISHING... CONVERSATION ARCHIVED (DELETED) TOPIC", conversation_deleted_topic)
      const success_payload = JSON.stringify({"success": true})
      publish(exchange, conversation_deleted_topic, Buffer.from(success_payload), function(err) {
        console.log(">>> PUBLISHED!!!! CONVERSATION ON TOPIC", conversation_deleted_topic, "ARCHIVED (DELETED)")
        if (err) {
          callback(false)
        }
        else {
          // now publish new archived conversation added
          const archived_conversation_added_topic = 'apps.tilechat.users.' + user_id + '.archived_conversations.' + convers_with + '.clientadded'
          console.log(">>> NOW PUBLISHING... CONVERSATION ARCHIVED (ADDED) TOPIC", archived_conversation_added_topic)
          const success_payload = JSON.stringify({"success": true})
          publish(exchange, archived_conversation_added_topic, Buffer.from(success_payload), function(err) {
            console.log(">>> PUBLISHED!!!! ARCHIVED (DELETED) CONVERSATION ON TOPIC", conversation_deleted_topic)
            if (err) {
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
  console.log("process_create_group. TOPIC PARTS:", topic_parts, "payload:", payload)
  // `apps.observer.${process.env.APP_ID}.groups.create`
  const app_id = topic_parts[2]
  console.log("app_id:", app_id)
  console.log("payload:", payload)
  const group = JSON.parse(payload)
  if (!group.uid || !group.name || !group.members || !group.owner) {
    console.log("group error.")
    callback(true)
    return
  }
  group.appId = app_id
  saveOrUpdateGroup(group, function(ok) {
    if (ok) {
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
              callback(true)
            }
          })
        }
      })
    }
    else {
      callback(false)
    }
  })
}

function process_update_group(topic, payload, callback) {
  var topic_parts = topic.split(".")
  console.log("process_update_group. TOPIC PARTS:", topic_parts, "payload:", payload)
  // `apps.observer.${process.env.APP_ID}.groups.update`
  const app_id = topic_parts[2]
  console.log("app_id:", app_id)
  console.log("payload:", payload)
  const group = JSON.parse(payload)
  if (!group.uid || !group.name || !group.members || !group.owner) {
    console.log("group error.")
    callback(true)
    return
  }
  // group.appId = app_id
  // saveOrUpdateGroup(group, function(ok) { // ????
    // if (ok) {
  deliverGroupUpdated(group, function(ok) {
  callback(ok)
  //     })
  //   }
  //   else {
  //     callback(false)
  //   }
  })
}

// enqueues group saving on db
function saveOrUpdateGroup(group, callback) {
  chatdb.saveOrUpdateGroup(group, function(err, doc) {
    if (err) {
      console.log("Error saving group:", err)
      callback(false)
      return
    }
    else {
      callback(true)
    }
  })
}

function deliverGroupAdded(group, callback) {
  const app_id = group.appId
  for (let [key, value] of Object.entries(group.members)) {
    const member_id = key
    const added_group_topic = `apps.${app_id}.users.${member_id}.groups.${group.uid}.clientadded`
    console.log("added_group_topic:", added_group_topic)
    const payload = JSON.stringify(group)
    publish(exchange, added_group_topic, Buffer.from(payload), function(err, msg) {
      if (err) {
        callback(false)
        return
      }
    })
  }
  callback(true)
}

function deliverGroupUpdated(group, callback) {
  const app_id = group.appId
  for (let [key, value] of Object.entries(group.members)) {
    const member_id = key
    const updated_group_topic = `apps.${app_id}.users.${member_id}.groups.${group.uid}.clientupdated`
    console.log("updated_group_topic:", updated_group_topic)
    const payload = JSON.stringify(group)
    publish(exchange, updated_group_topic, Buffer.from(payload), function(err, msg) {
      if (err) {
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
      message_id: uuidv4(),
      type: "text",
      timestamp: now,
      channel_type: "group",
      sender_fullname: "System",
      sender: group.owner,
      recipient_fullname: group.name,
      recipient: group.uid,
      status: MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT
    }
    if (member_id !== group.owner) {
      group_created_message.text = "You was added to this group"
    }
    else {
      group_created_message.text = "You created this group"
    }
    const user_id = member_id
    const convers_with = group.uid
    console.log("user_id:", user_id)
    console.log("convers_with:", convers_with)
    deliverMessage(group_created_message, app_id, user_id, convers_with, function(ok) {
      console.log("MESSAGE DELIVERED?", ok)
      if (!ok) {
        console.log("Error sending group creation message.", group_created_message)
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

var mongouri = process.env.MONGODB_URI || "mongodb://localhost:27017/chatdb";
var mongodb = require("mongodb");
// var ObjectID = mongodb.ObjectID;
// Create a database variable outside of the
// database connection callback to reuse the connection pool in the app.
var db;
console.log("connecting to mongodb...")
mongodb.MongoClient.connect(mongouri, { useNewUrlParser: true, useUnifiedTopology: true }, function (err, client) {
  if (err) {
    console.log(err);
    process.exit(1);
  } else {
    console.log("MongoDB successfully connected.")
  }
  db = client.db();
  // var port = process.env.PORT || 3000;
  // app.listen(port, () => {
  
  chatdb = new ChatDB({database: db})
  console.log('Starting observer.')
  startMQ();
  // });
});
