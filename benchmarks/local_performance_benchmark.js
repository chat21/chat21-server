const aedes = require('aedes')();
const server = require('net').createServer(aedes.handle);
const httpServer = require('http').createServer();
const ws = require('websocket-stream');
const port = 1883;
const wsPort = 15675;

const { observer } = require('../src/index');
const { Chat21Client } = require('../src/mqttclient/chat21client');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
require('dotenv').config();

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat21';
const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://localhost:5672';
const MQTT_WS_ENDPOINT = process.env.MQTT_WS_ENDPOINT;
const APP_ID = 'tilechat';

async function startMqttBroker() {
    return new Promise((resolve) => {
        server.listen(port, function () {
            console.log('MQTT broker started on port', port);
        });

        ws.createServer({ server: httpServer }, aedes.handle);
        httpServer.listen(wsPort, function () {
            console.log('MQTT over WS started on port', wsPort);
            resolve();
        });
    });
}

async function runBenchmark() {
    console.log("--- Local Performance Benchmark ---");
    
    // 1. Start MQTT Broker (if no remote provided)
    if (!MQTT_WS_ENDPOINT) {
        await startMqttBroker();
    } else {
        console.log("Using remote MQTT endpoint:", MQTT_WS_ENDPOINT);
    }

    // 2. Start Observer
    console.log("Starting Observer...");
    await observer.startServer({
        app_id: APP_ID,
        mongodb_uri: MONGODB_URI,
        rabbitmq_uri: RABBITMQ_URI,
        redis_enabled: false
    });
    console.log("Observer started.");

    // 3. Setup Clients
    // Note: In a real local setup, we'd also need the chat-http-server to handle authentication and group creation.
    // For this benchmark, if we want to test the observer's performance, we can mock the tokens if we are using a local broker 
    // that doesn't enforce JWT, but Chat21Client expects some tokens.
    // However, the user said they want to measure the performance of THIS version.
    
    const user1 = {
        userid: 'USER1',
        fullname: 'User 1',
        token: 'mock-token-1'
    };

    const user2 = {
        userid: 'USER2',
        fullname: 'User 2',
        token: 'mock-token-2'
    };

    const client1 = new Chat21Client({
        appId: APP_ID,
        MQTTendpoint: MQTT_WS_ENDPOINT || `ws://localhost:${wsPort}`,
        APIendpoint: 'http://localhost:8004/api', // This might still need a running http server for some calls
        log: false
    });

    const client2 = new Chat21Client({
        appId: APP_ID,
        MQTTendpoint: MQTT_WS_ENDPOINT || `ws://localhost:${wsPort}`,
        log: false
    });

    console.log("Connecting clients...");
    // Since we're using Aedes without specialized auth for this bench, any token might work if not configured otherwise.
    await client1.connect(user1.userid, user1.token);
    await client2.connect(user2.userid, user2.token);
    console.log("Clients connected.");

    const group_id = "group-" + uuidv4().replace(/-/g, "");
    const group_name = "Benchmark Group";

    let messages_received = 0;
    const NUM_MESSAGES = 10;
    const latencies = [];
    let last_sent_time = 0;

    const benchmarkFinished = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Benchmark timed out")), 30000);

        client2.onMessageAdded((message) => {
            if (message.recipient === group_id && message.sender !== user2.userid) {
                const now = Date.now();
                latencies.push(now - last_sent_time);
                messages_received++;
                
                console.log(`Message ${messages_received}/${NUM_MESSAGES} received. Latency: ${now - last_sent_time}ms`);

                if (messages_received < NUM_MESSAGES) {
                    sendNext();
                } else {
                    clearTimeout(timeout);
                    resolve();
                }
            }
        });
    });

    function sendNext() {
        last_sent_time = Date.now();
        client1.sendMessage(
            `Msg-${messages_received}`,
            'text',
            group_id,
            group_name,
            user1.fullname,
            {},
            null,
            'group',
            null
        );
    }

    console.log("Starting message exchange...");
    const startTime = Date.now();
    sendNext();

    await benchmarkFinished;
    const totalTime = Date.now() - startTime;

    console.log("\n--- Benchmark Results ---");
    console.log("Total messages:", NUM_MESSAGES);
    console.log("Total time:", totalTime, "ms");
    console.log("Average Latency:", (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2), "ms");
    console.log("Min Latency:", Math.min(...latencies), "ms");
    console.log("Max Latency:", Math.max(...latencies), "ms");
    console.log("--------------------------\n");

    await client1.close();
    await client2.close();
    observer.stopServer();
    if (!MQTT_WS_ENDPOINT) {
        server.close();
        httpServer.close();
    }
    process.exit(0);
}

runBenchmark().catch(err => {
    console.error("Benchmark failed:", err);
    process.exit(1);
});
