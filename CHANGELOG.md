## v0.1.14

- removed function: function joinGroup()
- exported logger from observer.js

## v0.1.13 npm online

- bugfix:
this: if (inbox_of === outgoing_message.sender) {
became: if (inbox_of === group.uid) { // choosing one member, the group ("volatile" member), for the "status=SENT", used by the "message-sent" webhook

If "system" sends info messages and he is not member of the group, webhooks are never called.
The "message-sent" webhook is called only once: when, iterating all the members, the selected one is the same as the group.
This because the "message-sent" must be called only once per message. The "sender" can't be used, why not always the "sender"
is a member of the group (ex. info messages by system while system is not always a member of the group).
