
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
this: if (inbox_of === outgoing_message.sender) {
became: if (inbox_of === group.uid) { // choosing one member, the group ("volatile" member), for the "status=SENT", used by the "message-sent" webhook

If "system" sends info messages and he is not member of the group, webhooks are never called.
The "message-sent" webhook is called only once: when, iterating all the members, the selected one is the same as the group.
This because the "message-sent" must be called only once per message. The "sender" can't be used, because the "sender" not always
is a group's member (ex. info messages by system while system is not always a member of the group).
