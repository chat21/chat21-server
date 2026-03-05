const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../src/mqttclient/chat21client.js');
require('dotenv').config();
const axios = require('axios');

// Load configuration from environment
const TILEDESK_PROJECT_ID = process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID || process.env.TEST_PROJECT_ID;
const MQTT_ENDPOINT = process.env.PERFORMANCE_TEST_MQTT_ENDPOINT || process.env.TEST_MQTT_ENDPOINT || 'ws://localhost:15675/ws';
const API_ENDPOINT = process.env.PERFORMANCE_TEST_API_ENDPOINT || process.env.TEST_API_ENDPOINT || 'http://localhost:8004';
const CHAT_API_ENDPOINT = process.env.PERFORMANCE_TEST_CHAT_API_ENDPOINT || process.env.TEST_CHAT_API_ENDPOINT || 'http://localhost:8004';
const NUM_MESSAGE = process.env.NUM_MESSAGE || 10;
const APPID = process.env.APP_ID || 'tilechat';

if (!TILEDESK_PROJECT_ID) {
    console.error("Error: PERFORMANCE_TEST_TILEDESK_PROJECT_ID or TEST_PROJECT_ID is mandatory in .env");
    process.exit(1);
}

const RUN_ID = uuidv4().substring(0, 8);
const config = {
    MQTT_ENDPOINT,
    CHAT_API_ENDPOINT,
    API_ENDPOINT,
    APPID,
    TILEDESK_PROJECT_ID,
    MESSAGE_PREFIX: "Conv-bench-" + RUN_ID,
    GROUP_PREFIX: process.env.GROUP_PREFIX || 'bench-group',
    NUM_MESSAGES: NUM_MESSAGE,
    MESSAGE_DELAY: process.env.MESSAGE_DELAY || 1000
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
            log: false
        });

        const user2Client = new Chat21Client({
            appId: config.APPID,
            MQTTendpoint: config.MQTT_ENDPOINT,
            APIendpoint: config.CHAT_API_ENDPOINT,
            log: false
        });

        // User2 behavior: reply to benchmark messages from user1
        user2Client.onMessageAdded((message) => {
            console.log(">>> USER2 SAW MESSAGE:", JSON.stringify({ text: message.text, sender: message.sender, recipient: message.recipient }));
            const isBenchMessage = message && typeof message.text === 'string' && message.text.startsWith(config.MESSAGE_PREFIX);
            if (message && message.recipient === group_id && message.sender === userData1.userid && isBenchMessage) {

                // Extract the exchange index from the message text to ensure we only reply once per exchange
                const match = message.text.match(new RegExp(`${config.MESSAGE_PREFIX}-(\\d+)`));
                if (match) {
                    const exchangeIdx = parseInt(match[1]);
                    const replyText = `${config.MESSAGE_PREFIX}-${exchangeIdx}-reply`;

                    console.log(`User2 replying to exchange ${exchangeIdx}...`);
                    user2Client.sendMessage(
                        replyText,
                        'text',
                        group_id,
                        group_name,
                        "User 2",
                        { projectId: config.TILEDESK_PROJECT_ID },
                        null,
                        'group',
                        (err) => {
                            if (err) {
                                console.error(`User2 failed to send reply for exchange ${exchangeIdx}:`, err);
                            } else {
                                console.log(`User2 sent reply for exchange ${exchangeIdx}`);
                            }
                        }
                    );
                }
            }
        });

        console.log("Connecting User...");
        await connectClient(userClient, userData1.userid, userData1.token);
        console.log("User connected:", userData1.userid);

        console.log("Connecting User2...");
        await connectClient(user2Client, userData2.userid, userData2.token);
        console.log("User2 connected:", userData2.userid);

        const group_id = `${config.GROUP_PREFIX}-${config.TILEDESK_PROJECT_ID}-${uuidv4().replace(/-+/g, "")}`;
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

        let retryInterval = null;

        // User behavior: wait for reply, then send next or finish
        const conversationFinished = new Promise((resolve, reject) => {
            const TIMEOUT_MS = 120000;
            const timeout = setTimeout(() => {
                if (retryInterval) clearInterval(retryInterval);
                reject(new Error(`Conversation timed out after ${TIMEOUT_MS / 1000} seconds`));
            }, TIMEOUT_MS);

            userClient.onMessageAdded((message) => {
                const expectedReply = `${config.MESSAGE_PREFIX}-${messages_exchanged}-reply`;

                if (message && message.recipient === group_id) {
                    console.log("<<< USER SAW MESSAGE:", JSON.stringify({ text: message.text, sender: message.sender, recipient: message.recipient }), "Expected:", expectedReply);
                }

                if (message && message.recipient === group_id && message.sender !== userData1.userid && message.sender !== userData2.userid) {
                    console.log("<<< USER IGNORED NON-BENCH PARTICIPANT:", JSON.stringify({ text: message.text, sender: message.sender, recipient: message.recipient }));
                }

                if (message &&
                    message.recipient === group_id &&
                    message.sender === userData2.userid &&
                    message.text === expectedReply) {

                    const now = Date.now();
                    const latency = now - last_message_sent_time;
                    latencies.push(latency);

                    console.log(`Exchange ${messages_exchanged + 1}/${config.NUM_MESSAGES} completed. Latency: ${latency}ms`);

                    messages_exchanged++;
                    if (retryInterval) {
                        clearInterval(retryInterval);
                        retryInterval = null;
                    }

                    if (messages_exchanged < config.NUM_MESSAGES) {
                        console.log(`Waiting ${config.MESSAGE_DELAY}ms before next exchange...`);
                        setTimeout(() => {
                            sendNextMessage();
                        }, config.MESSAGE_DELAY);
                    } else {
                        clearTimeout(timeout);
                        resolve();
                    }
                }
            });
        });

        function sendNextMessage() {
            if (retryInterval) {
                clearInterval(retryInterval);
            }

            const messageText = `${config.MESSAGE_PREFIX}-${messages_exchanged}`;
            // console.log(`User sending message for exchange ${messages_exchanged}...`);
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
                (err) => {
                    if (err) {
                        console.error(`User failed to send message for exchange ${messages_exchanged}:`, err);
                    }
                }
            );

            // Set retry interval
            retryInterval = setInterval(() => {
                console.log(`Retrying exchange ${messages_exchanged} (no reply after 10s)...`);
                userClient.sendMessage(
                    messageText,
                    'text',
                    group_id,
                    group_name,
                    "User 1",
                    { projectId: config.TILEDESK_PROJECT_ID },
                    null,
                    'group',
                    (err) => {
                        if (err) {
                            console.error(`User failed to resend message for exchange ${messages_exchanged}:`, err);
                        }
                    }
                );
            }, 10000);
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
        user2Client.close();
        process.exit(0);

    } catch (error) {
        console.error("Benchmark failed:", error);
        process.exit(1);
    }
}

runBenchmark();
