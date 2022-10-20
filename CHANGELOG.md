
**npm @chat21/chat21-server@0.2.22**

available on:
 ▶️ https://www.npmjs.com/package/@chat21/chat21-server

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
