var mqtt = require('mqtt')
var client  = mqtt.connect('ws://localhost:8888')

client.on('connect', function () {
    console.log("connected.")
    // console.log("publishing.")
    // client.publish('sensors/drone01/altitude', 'Hello mqtt')
    const topic = 'apps/tilechat/users/+/messages/+'
    const presence_topic = 'presence/+/+'
    client.subscribe(topic, function (err) {
        console.log("subscribed to",topic, " with err", err)
    })
    client.subscribe(presence_topic, function (err) {
      console.log("subscribed to",presence_topic, " with err", err)
  })
})

// rabbitmq AMQP-LIB

client.on('message', function (topic, message) {
  // message is Buffer
  const message_string = message.toString()
  console.log("got", message_string, " on topic", topic)
  if (topic.startsWith('app/')) {
    process_inbox(topic, message_string)
  }
  else if (topic.startsWith('presence/')) {
    process_presence(topic, message_string)
  }
})

function process_presence(topic, message_string) {
  console.log("got PRESENCE testament", message_string, " on topic", topic)
}

function process_inbox(topic, message_string) {
  var topic_parts = topic.split("/")
  console.log("parts: ", topic_parts)
  const sender_id = topic_parts[3]
  const recipient_id = topic_parts[5]

  dest_topic = 'apps/tilechat/users/' + recipient_id + '/conversations/' + sender_id
  console.log("dest_topic:", dest_topic)
  var incoming_message = JSON.parse(message_string)
  var outgoing_message = {
    text: incoming_message.text,
    sender_id: sender_id,
    recipient_id: recipient_id
  }
  const payload = JSON.stringify(outgoing_message)
  console.log("payload:", payload)
  client.publish(dest_topic, payload) // MQTT
}