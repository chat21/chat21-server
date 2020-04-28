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
const topicreceive = 'apps.tilechat.users.*.messages.*'
const topicpresence = 'presence.#'

var chatdb;

function startMQ() {
  console.log("Starting AMQP chat server...")
  amqp.connect('amqp://andrea:Freedom73@localhost:5672?heartbeat=60', function (err, conn) {
    if (err) {
      console.error("[AMQP]", err.message);
      return setTimeout(startMQ, 1000);
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
    console.log("[AMQP] connected.................");
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

function publish(exchange, routingKey, content) {
  try {
    pubChannel.publish(exchange, routingKey, content, { persistent: true },
      function (err, ok) {
        if (err) {
          console.error("[AMQP] publish", err);
          offlinePubQueue.push([exchange, routingKey, content]);
          pubChannel.connection.close();
        }
        else {
          console.log("published to", routingKey, "result", ok)
        }
      });
  } catch (e) {
    console.error("[AMQP] publish", e.message);
    offlinePubQueue.push([exchange, routingKey, content]);
  }
}

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
      ch.bindQueue(_ok.queue, exchange, topicreceive, {}, function (err3, oka) {
        console.log("queue: " + _ok.queue + " err: " + err3 + " key: " + topicreceive);
        console.log(oka)
      });
      ch.bindQueue(_ok.queue, exchange, topicpresence, {}, function (err3, oka) {
        console.log("queue lost: " + _ok.queue + " err: " + err3 + " key: " + topicpresence);
        console.log(oka)
      });
      ch.consume("jobs", processMsg, { noAck: false });
      console.log("Worker is started");
    });
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
  console.log("processing of:", msg.content.toString(), "topic:", msg.fields.routingKey);
  const topic = msg.fields.routingKey //.replace(/[.]/g, '/');
  const message_string = msg.content.toString();
  if (topic.startsWith('apps.')) {
    process_inbox(topic, message_string, callback);
  }
  else if (topic.startsWith('presence.')) {
    process_presence(topic, message_string, callback);
  }
  else {
    console.log("unkownn topic", topic)
  }

  // var topic_parts = msg.fields.routingKey.split(".")
  // const sender_id = topic_parts[3]
  // const recipient_id = topic_parts[5]
  // var dest_topic = 'apps.tilechat.users.' + recipient_id + '.conversations.' + sender_id 
  // console.log("destinazione:",  dest_topic);
  // publish(exchange, dest_topic, new Buffer(msg.content.toString()));
  // callback(true);

}

// ***** TOPICS HANDLERS ******/

function process_presence(topic, message_string, callback) {
  console.log("got PRESENCE testament", message_string, " on topic", topic)
  callback(true)
}

function process_inbox(topic, message_string, callback) {
  var topic_parts = topic.split(".")
  // /apps/tilechat/users/SENDER_ID/messages/RECIPIENT_ID
  const app_id = topic_parts[1]
  const sender_id = topic_parts[3]
  const recipient_id = topic_parts[5]

  dest_topic = 'apps.tilechat.users.' + recipient_id + '.conversations.' + sender_id
  console.log("dest_topic:", dest_topic)
  var incoming_message = JSON.parse(message_string)
  const sender_fullname = "SENDER FULLNAME"
  const recipient_fullname = "RECIPIENT FULLNAME"
  const channel_type = "direct"
  var messageId = uuidv4();
  var outgoing_message = {
    message_id: messageId,
    text: incoming_message.text,
    sender_id: sender_id,
    sender_fullname: sender_fullname,
    recipient_id: recipient_id,
    recipient_fullname: recipient_fullname,
    channel_type: channel_type
  }
  
  var newMessage = {
    message_id: messageId,
    text: incoming_message.text,
    sender_id: sender_id,
    sender_fullname: sender_fullname,
    recipient_id: recipient_id,
    recipient_fullname: recipient_fullname,
    channel_type: channel_type,
    app_id: app_id,
    createdBy: sender_id,
    timelineOf: sender_id,
    path: topic,
    status: MessageConstants.CHAT_MESSAGE_STATUS.SENT
  }
  console.log("message:", newMessage)
  chatdb.saveMessage(newMessage, function(err, msg) {
    const payload = JSON.stringify(outgoing_message)
    publish(exchange, dest_topic, Buffer.from(payload));
    console.log("message", msg, "saved with error ", err )
    callback(true)
  })
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
  var port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log('server started.')
    console.log('starting mq observer...')
    chatdb = new ChatDB({database: db})
    startMQ();
  });
});
