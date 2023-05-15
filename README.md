
# Chat21 Real Time messaging engine

> ***🚀 Do you want to install Tiledesk on your server with just one click?***
> 
> ***Use [Docker Compose Tiledesk installation](https://github.com/Tiledesk/tiledesk-deployment/blob/master/docker-compose/README.md) guide***

Chat21 Real Time messaging engine is a simple "observer" on RabbitMQ Message Brocker.

Chat21 Client Applications use MQTT protocol to connect to RabbitMQ.
Each end-user writes outoging messages on a specific path where his RabbitMQ JWT Token
allows him to write.

MQTT Outgoing path example:

```
/apps/tilechat/users/USER-ID/RECIPIENT-USER-ID/messages/outgoing
```

The Client application connected with MQTT to RabbitMQ, sends the message as a JSON payload
to the **/outgoing** path.

The observer subscribes himself to these paths. As soon as he gets notified of an _outgoing_ message
the same message payload is forwarded (AMQP publish operation) to the recipient path:

```
/apps/tilechat/users/RECIPIENT-USER-ID/SENDER-USER-ID/messages/clientadded
```

The recipient will receive the MQTT publish notification on the incoming path decoding it as
a new message based on the final part of the path, that always indicates the type of operation
on that path:

**/clientadded** = new payload (a message) arrived on the path.

Using this observer Chat21 implements the "inbox" concept. Messages are not delivered 
directly with shared path between the two clients, but rather delivered through this _observer_ who can take additional
actions to improve privacy, security, persistence and apply other policies on messages (i.e. blocking users).

Moreover, a granular security can be applied with the "inbox" pattern, using RabbitMQ JWT Tokens specification,
where a user can only read and write on his own, specific paths, never reading or writing directly on
other users inboxes.

The **inbox** pattern just works like email _SMTP/POP3_ protocols. The message is sent from the user
to his own SMTP server inbox (the _/outgoing_ path), as an _outgoing_ message. The "observer" (this application),
gets the message and sends it to the recipient's SMTP server (the recipient inbox path) with a */clientadded* action
where the recipient itself will receive the message as soon as he connects to RabbitMQ through MQTT.

## Docker Build

docker build -t chat21/chat21-server:dev .

docker push chat21/chat21-server:dev

docker run chat21/chat21-server:dev

## Benchmarks

On local project folder run:

```
./benchmarks.sh
```

With the following settings:

EXPECTED_AVG_DIRECT_MESSAGE_DELAY: 160,
EXPECTED_AVG_GROUP_MESSAGE_DELAY: 160,
REQS_PER_SECOND: 50,
MAX_SECONDS: 10,
CONCURRENCY: 1, // 2

The benchmark must pass to get good results, getting somthing like this:

```
Performance Test
chatClient1 Connected...
chatClient2 Connected...
TOTAL GROUP CREATION TIME 36ms


*********************************************
********* Direct messages benchmark *********
*********************************************


Direct - Expected message average latency to be < 160ms
Direct - Expected MESSAGES/SEC = 60
Direct - Expected MESSAGES/SEC/VU = 60
Direct - Expected TEST DURATION (s) = 10
Direct - Expected CONCURRENCY (#VUs) = 1
Direct - Expected DELAY BETWEEN MESSAGES (ms) = 16.666666666666668
Direct - Expected TOTAL ITERATIONS = 600
Direct - Running benchmark...


********* Direct - Benchmark results *********
Direct - Message mean latency: 13.851666666666667
Direct - Test duration: 10 seconds (10441) ms
Direct - MESSAGES/SEC: 60
Direct messages benchmark performed good! 😎
'Direct' benchmark end.
    ✔ Benchmark for direct messages (10452ms)


********************************************
********* Group messages benchmark *********
********************************************


Group - Expected message average latency to be < 160ms
Group - Expected CONCURRENCY (#VIRTUAL USERs aka VUs) = 1
Group - Expected MESSAGES/SEC = 60
Group - Expected MESSAGES/SEC/VU = 60
Group - Expected TEST DURATION (s) = 10
Group - Expected DELAY BETWEEN MESSAGES (ms) = 16.666666666666668
Group - Expected TOTAL ITERATIONS = 600
Group - Running benchmark...
End 'Direct' benchmark iterations.


********* Group - Benchmark results *********
Group - Final latency: 45.611666666666665
Group - Expected max average latency: 160
Group - Test duration: 10 seconds (10456) ms
Group - MESSAGES/SEC: 60
Group messages benchmark performed good! 😎
'Group' benchmark end.
    ✔ Benchmark for group messages (10523ms)


  2 passing (21s)
```