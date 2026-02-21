const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../src/mqttclient/chat21client.js');
require('dotenv').config();
const axios = require('axios');

// Load configuration from environment
const TILEDESK_PROJECT_ID = process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID || process.env.TEST_PROJECT_ID;
const MQTT_ENDPOINT = process.env.PERFORMANCE_TEST_MQTT_ENDPOINT || process.env.TEST_MQTT_ENDPOINT || 'ws://localhost:15675/ws';
const API_ENDPOINT = process.env.PERFORMANCE_TEST_API_ENDPOINT || process.env.TEST_API_ENDPOINT || 'http://localhost:8004';
const CHAT_API_ENDPOINT = process.env.PERFORMANCE_TEST_CHAT_API_ENDPOINT || process.env.TEST_CHAT_API_ENDPOINT || 'http://localhost:8004';
const APPID = process.env.APP_ID || 'tilechat';

if (!TILEDESK_PROJECT_ID) {
    console.error("Error: PERFORMANCE_TEST_TILEDESK_PROJECT_ID or TEST_PROJECT_ID is mandatory in .env");
    process.exit(1);
}

const config = {
    MQTT_ENDPOINT,
    CHAT_API_ENDPOINT,
    API_ENDPOINT,
    APPID,
    TILEDESK_PROJECT_ID,
    MESSAGE_PREFIX: "Conv-bench",
    NUM_MESSAGES: 10
};

async function createAnonymousUser(tiledeskProjectId) {
    const ANONYMOUS_TOKEN_URL = config.API_ENDPOINT + '/auth/signinAnonymously';
    try {
        const response = await axios.post(ANONYMOUS_TOKEN_URL, { id_project: tiledeskProjectId });
        const CHAT21_TOKEN_URL = config.API_ENDPOINT + '/chat21/native/auth/createCustomToken';
        const response2 = await axios.post(CHAT21_TOKEN_URL, {}, {
            headers: { 'Authorization': response.data.token }
        });
        return {
            userid: response2.data.userid,
            token: response2.data.token
        };
    } catch (error) {
        console.error("Error creating anonymous user:", error.message);
        throw error;
    }
}

function connectClient(client, userid, token) {
    return new Promise((resolve, reject) => {
        client.connect(userid, token, () => {
            resolve();
        });
    });
}

async function runBenchmark() {
    console.log("--- Conversation Benchmark ---");
    console.log("MQTT Endpoint:", config.MQTT_ENDPOINT);
    console.log("API Endpoint:", config.API_ENDPOINT);
    console.log("Project ID:", config.TILEDESK_PROJECT_ID);
    console.log("Messages to exchange:", config.NUM_MESSAGES);
    console.log("------------------------------\n");

    try {
        console.log("Creating users...");
        const userData1 = await createAnonymousUser(config.TILEDESK_PROJECT_ID);
        const userData2 = await createAnonymousUser(config.TILEDESK_PROJECT_ID);

        const userClient = new Chat21Client({
            appId: config.APPID,
            MQTTendpoint: config.MQTT_ENDPOINT,
            APIendpoint: config.CHAT_API_ENDPOINT,
            log: true
        });

        const botClient = new Chat21Client({
            appId: config.APPID,
            MQTTendpoint: config.MQTT_ENDPOINT,
            APIendpoint: config.CHAT_API_ENDPOINT,
            log: true
        });

        console.log("Connecting User...");
        await connectClient(userClient, userData1.userid, userData1.token);
        console.log("User connected:", userData1.userid);

        console.log("Connecting Bot...");
        await connectClient(botClient, userData2.userid, userData2.token);
        console.log("Bot connected:", userData2.userid);

        const group_id = "support-group-" + config.TILEDESK_PROJECT_ID + "-" + uuidv4().replace(/-+/g, "");
        const group_name = "Benchmark Group " + group_id;

        console.log("Group ID:", group_id);

        console.log("Creating Group and adding members...");
        const group_members = {};
        group_members[userData1.userid] = 1;
        group_members[userData2.userid] = 1;
        
        await userClient.groupCreate(group_name, group_id, group_members);
        console.log("Group created successfully.");

        let messages_exchanged = 0;
        let last_message_sent_time = 0;
        let latencies = [];

        // Bot behavior: reply to any message starting with prefix from the user
        botClient.onMessageAdded((message) => {
            if (message && message.recipient === group_id && message.sender !== userData2.userid && message.text.startsWith(config.MESSAGE_PREFIX)) {
                // console.log("Bot received:", message.text);
                const replyText = message.text + "-reply";
                botClient.sendMessage(
                    replyText,
                    'text',
                    group_id,
                    group_name,
                    "Bot User",
                    { projectId: config.TILEDESK_PROJECT_ID },
                    null,
                    'group',
                    null
                );
            }
        });

        // User behavior: wait for reply, then send next or finish
        const conversationFinished = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Conversation timed out after 60 seconds"));
            }, 60000);

            userClient.onMessageAdded((message) => {
                if (message && message.recipient === group_id && message.sender === userData2.userid && message.text.includes("-reply")) {
                    const now = Date.now();
                    const latency = now - last_message_sent_time;
                    latencies.push(latency);
                    messages_exchanged++;
                    
                    console.log(`Exchange ${messages_exchanged}/${config.NUM_MESSAGES} completed. Latency: ${latency}ms`);

                    if (messages_exchanged < config.NUM_MESSAGES) {
                        sendNextMessage();
                    } else {
                        clearTimeout(timeout);
                        resolve();
                    }
                }
            });
        });

        function sendNextMessage() {
            const messageText = `${config.MESSAGE_PREFIX}-${messages_exchanged}`;
            last_message_sent_time = Date.now();
            userClient.sendMessage(
                messageText,
                'text',
                group_id,
                group_name,
                "User 1",
                { projectId: config.TILEDESK_PROJECT_ID },
                null,
                'group',
                null
            );
        }

        console.log("\nStarting conversation...");
        const startTime = Date.now();
        sendNextMessage();

        await conversationFinished;
        const totalTime = Date.now() - startTime;

        console.log("\n--- Benchmark Results ---");
        console.log("Total messages exchanged:", messages_exchanged);
        console.log("Total time:", totalTime, "ms");
        
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        console.log("Average Round-trip Latency:", avgLatency.toFixed(2), "ms");
        console.log("Min Latency:", Math.min(...latencies), "ms");
        console.log("Max Latency:", Math.max(...latencies), "ms");
        console.log("--------------------------\n");

        userClient.close();
        botClient.close();
        process.exit(0);

    } catch (error) {
        console.error("Benchmark failed:", error);
        process.exit(1);
    }
}

runBenchmark();
