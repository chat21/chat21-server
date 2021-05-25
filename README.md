
# Chat21 Real Time messaging engine

Chat21 Real Time messaging engine is a simple "observer" on RabbitMQ Message Brocker.

Chat21 Client Applications use MQTT protocol to connect to RabbitMQ.
Each end-user writes outoging messages on a specific path where his RabbitMQ JWT Token
allows him to write.

MQTT Outgoing path example:

/apps/tilechat/users/USER-ID/RECIPIENT-USER-ID/messages/outgoing

The Client application connected with MQTT to RabbitMQ, sends the message as a JSON payload
to the "/outgoing" path.

The observer subscribes himself to these paths. As soon as he gets notified of an _outgoing_ message
the same message payload is forwarded (AMQP publish operation) to the recipient path:

/apps/tilechat/users/RECIPIENT-USER-ID/SENDER-USER-ID/messages/clientadded

The recipient will receive the MQTT publish notification on the incoming path decoding it as
a new message based on the final part of the path, that always indicates the type of operation
on that path ("/clientadded" = new payload arrived on the path).

Using this observer Chat21 implements the use of the "inbox" concept. Messages will never arrive
directly with a client-to-client communication, but always through the observer who can take additional
actions to improve privacy, security, persistence and other policies on messages.

Moreover, a granular security can be applied with the "inbox" patterns, using RabbitMQ JWT Tokens,
where a user can only read and write on his own, specific paths, never reading or writing directly on
other users inboxes.

The "inbox" pattern works just like email SMTP/POP3 protocol. The message is sent from the user
to his own SMTP server inbox, as an _outgoing_ message. This "observer", gets the message and
sends it to the recipient's SMTP server (the recipient inbox path) where the recipient itself
will read the message as soon as he connect to RabbitMQ through MQTT.

