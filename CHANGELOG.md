
**npm @chat21/chat21-server@0.2.47**

available on:
 ▶️ https://www.npmjs.com/package/@chat21/chat21-server

## v0.2.53
- debug version

## v0.2.52
- debug version

## v0.2.51
- queues are always "durable". "DURABLE_ENABLED" option removed.

## v0.2.50
- renamed CHAT21OBSERVER_CACHE_ENABLED, CHAT21OBSERVER_REDIS_HOST, CHAT21OBSERVER_REDIS_PORT, CHAT21OBSERVER_REDIS_PASSWORD

## v0.2.49
- presence fix

## v0.2.48
- debug version

## v0.2.47
- presence is back!

## v0.2.46
- DURABLE_ENABLED fixed

## v0.2.45
- DISABLED ch.prefetch(prefetch_messages);

## v0.2.44
- presence fully disabled

## v0.2.43
- amqplib updated v0.8.0 => v0.10.3

## v0.2.42
- persistent: true on publish()

## v0.2.41
- Refactored testing (webhooks tests separated from conversations tests)

## v0.2.40
- BUG FIX: Webhooks now use PREFETCH_MESSAGES setup from .env
- Introduced DURABLE_ENABLED: true|false in .env
- persistent: false
- Improved perfomance management. To better scale now you can:

- Create an instance to only process webhooks queue:

> ACTIVE_QUEUES=none PRESENCE_ENABLED=false WEBHOOK_ENABLED=true node chatservermq.js

- Create an instance to only process "messages" queues (there are many):

> ACTIVE_QUEUES=messages PRESENCE_ENABLED=false WEBHOOK_ENABLED=false node chatservermq.js

- Create an instance to only process 'persist' queue:

> ACTIVE_QUEUES=persist PRESENCE_ENABLED=false WEBHOOK_ENABLED=false node chatservermq.js

- Create an instance to only process presence:

> ACTIVE_QUEUES=none PRESENCE_ENABLED=true WEBHOOK_ENABLED=false node chatservermq.js

Or everything in a single process:

> ACTIVE_QUEUES=messages,persist PRESENCE_ENABLED=true WEBHOOK_ENABLED=true node chatservermq.js

## v0.2.39
- durable: false on every queue

## v0.2.38
- persistent: true in publish AGAIN

## v0.2.37
- noAck: true

## v0.2.36
- persistent: false in publish NOW ONLINE

## v0.2.35
- persistent: false in publish

## v0.2.34
- Adds log info for Prefetch messages
- Adds support to disable Presence
- Log defaults to INFO level

## v0.2.33 - online
- presence webhook and observer.webhooks...presence introduced
- updated chat21client.js => v0.1.12.4 with 'presence' publish on.connect()
- updated chat21client.js => v0.1.12.4 with ImHere()

## v0.2.32 - online
- RESTORED if (savedMessage.attributes && savedMessage.attributes.updateconversation == false) {update_conversation = false}. See v0.2.26

## v0.2.31 - online
- always setting/forcing creation of index { 'timelineOf': 1, 'conversWith': 1 }, { unique: 1 } on "conversations" collection
- removed env options: UNIQUE_CONVERSATIONS_INDEX and UNIQUE_AND_DROP_DUPS_CONVERSATIONS_INDEX

## v0.2.28 - online
- introduced UNIQUE_AND_DROP_DUPS_CONVERSATIONS_INDEX=1 in .env to enable the "unique" index forcing removing duplicates. Please follow the instructions 'enable the "unique" index' at the end of CHANGELOG.md to correctly enable this feature.

## v0.2.27 - online
- introduced unique index on conversations collection to fix the duplication of conversations. Added UNIQUE_CONVERSATIONS_INDEX=1 in .env to enable the "unique" index. Please follow the instructions 'enable the "unique" index' at the end of CHANGELOG.md to correctly enable this feature.

## v0.2.26 - online
- removed if (savedMessage.attributes && savedMessage.attributes.updateconversation == false) {update_conversation = false}. Now conversations are always updated. Same modification also on chat21client.js

## v0.2.25 - online
- all negative acks removed. All callback(false) => callback(true) to avoid queue blocks
- minor fixes

## v0.2.24 - online
- updated dev dependency: "@chat21/chat21-http-server": "^0.2.15",
- start_all.sh logging from ERROR to INFO
- logging fixes
- ver updtd "version": "0.2.24"

## v0.2.23 - online
- log updates

## v0.2.21 - online
- Docker image update:16

## v0.2.21 - online
- amqplib ^0.7.1 => ^0.8.0
- node 12 => 16.17.1

## v0.2.20
- added process.exit(0) on "[AMQP] channel error". It lets the server to silently restart on blocking AMQP errors.

## v0.2.19
- ack in sendMessageToGroupMembers() sent immediately.
- added group_id as memebr of inlineGroup.

## v0.2.18
- Added inlineGroup management. You can create on the fly group just sending a message with the "group.members" attribute.

## v0.2.17
- "ack" management improvements

## v0.2.16
- Deployed new version

## v0.2.15
- Added check on "routingKey invalid length (> 255). Publish canceled."

## v0.2.14
- added logs for better debug "routingKey" error

## v0.2.11
- archive-conversation payload now publishes on MQTT the full conversation data, not only the conversation patch

## v0.2.10
- added test #17 - conversation/archivedConversation detail

## v0.2.9
- minor fixes on testing: added assert.fail() in test #16

## v0.2.8
- added test #16 for testing that only webhook "message-delivered" event willreceive history notifications && "message-sent" to NEVER receive history messages notifications

## v0.2.5
- added support for the new outgoing path apps.appId.outgoing

## v0.2.4
- Webhooks: moved process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" in .env
- Webhooks: process.env.WEBHOOK_ENDPOINTS separator "," now support spaces
- Testing: added configuration in .env. See 'example.env' for a complete list of test properties (starting with TEST_)
- Testing: bug fix

## v0.2.3
- replaced uuidv4 with uuid

## v0.2.2
- removed process.exit(1) from "close" event in observer's AMQP connection handlers
- refactored testing
- added test 14, 15 for webhooks

## v0.2.1
- added multiple webhooks support
- added selective queues for performance improvements.
E.g. start the observer with command:
  "ACTIVE_QUEUES=messages node chatservermq.js MSG"
to only enable "messages" queue.

## v0.1.14
- removed function: function joinGroup()
- exported logger from observer.js

## v0.1.13 npm online

- bugfix:
this:
if (inbox_of === outgoing_message.sender) {
became:
if (inbox_of === group.uid) {
  logger.debug("inbox_of === outgoing_message.sender. status=SENT system YES?", inbox_of);
  outgoing_message.status = MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT;
}
// choosing one member, the group ("volatile" member), for the "status=SENT", used by the "message-sent" webhook
// achived changing the delivered status to SENT "on-the-fly" when I deliver the message to the group id. This
will trigger the webhookSentOrDelivered to "Sent" only

If "system" sends info messages and he is not member of the group, webhooks are never called.
The "message-sent" webhook is called only once: when, iterating all the members, the selected one is the same as the group.
This because the "message-sent" must be called only once per message. The "sender" can't be used, because the "sender" not always is a group's member (ex. info messages by system while system is not always a member of the group).

# Enable the "unique" index

UNIQUE INDEX FOR CONVERSATIONS

The "Query" to get all the duplicated conversations:

db.getCollection('conversations').aggregate([
    { 
        "$group": { 
            "_id": { "timelineOf": "$timelineOf", "conversWith": "$conversWith" }, 
            "uniqueIds": { "$addToSet": "$_id" },
            "count": { "$sum": 1 } 
        }
    }, 
    { "$match": { "count": { "$gt": 1 } } }
])

From uniqueIds get one of the two Object('id')

Delete one of the N duoplicates with the following query:

db.getCollection('conversations').deleteOne({ "_id": ObjectId("636e7c11035d0b0599563f87") } )

After you deleted all the duplicated conversations based on the unique index you can run the server with the following option in *.env*:

*UNIQUE_CONVERSATIONS_INDEX=1*

The unique index is created and you will no more have duplicated conversations.

*UNIQUE_AND_DROP_DUPS_CONVERSATIONS_INDEX=1*

Will also automatically remove duplicates (with the simple rule: keep the first, delete all the others)

Well done.