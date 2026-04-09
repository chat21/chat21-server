var assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// *******************************
// ******** MQTT SECTION *********
// *******************************

let TILEDESK_PROJECT_ID = "";
if (process.env && process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID) {
	TILEDESK_PROJECT_ID = process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID
}
else {
    throw new Error(".env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID is mandatory");
}

let MQTT_ENDPOINT = "";
if (process.env && process.env.PERFORMANCE_TEST_MQTT_ENDPOINT) {
	MQTT_ENDPOINT = process.env.PERFORMANCE_TEST_MQTT_ENDPOINT
}
else {
    throw new Error(".env.PERFORMANCE_TEST_MQTT_ENDPOINT is mandatory");
}

let API_ENDPOINT = "";
if (process.env && process.env.PERFORMANCE_TEST_API_ENDPOINT) {
	API_ENDPOINT = process.env.PERFORMANCE_TEST_API_ENDPOINT
}
else {
    throw new Error(".env.PERFORMANCE_TEST_API_ENDPOINT is mandatory");
}

let CHAT_API_ENDPOINT = "";
if (process.env && process.env.PERFORMANCE_TEST_CHAT_API_ENDPOINT) {
	CHAT_API_ENDPOINT = process.env.PERFORMANCE_TEST_CHAT_API_ENDPOINT
}
else {
    throw new Error(".env.PERFORMANCE_TEST_CHAT_API_ENDPOINT is mandatory");
}

let config = {
    MQTT_ENDPOINT: MQTT_ENDPOINT,
    CHAT_API_ENDPOINT: CHAT_API_ENDPOINT,
    APPID: 'tilechat',
    TILEDESK_PROJECT_ID: TILEDESK_PROJECT_ID,
    MESSAGE_PREFIX: "Performance-test",
}

const logs = false;

let iteration = 0;
const total_iterations = 10;

// Log file path
const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'performance_delay.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize log file with header if it doesn't exist
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(
        LOG_FILE,
        'timestamp,record_type,iteration,message_uuid,delay_ms,time_sent,time_received,conversation_total_ms\n',
        'utf8'
    );
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pending user→bot round-trip keyed by message index (matches Performance-test/<index> in bot reply). */
const pendingByIteration = new Map();
let conversationStartMs = null;

function logMessageRoundTrip(iteration, messageUuid, delayMs, timeSent, timeReceived) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp},message,${iteration},${messageUuid},${delayMs},${timeSent},${timeReceived},\n`;
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
}

function logConversationTotal(timeFirstSent, timeLastReceived, totalMs) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp},conversation,,,,${timeFirstSent},${timeLastReceived},${totalMs}\n`;
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
}

let user1 = {
	fullname: 'User 1',
	firstname: 'User',
	lastname: '1',
};

let chatClient1 = new Chat21Client(
{
    appId: config.APPID,
    MQTTendpoint: config.MQTT_ENDPOINT,
    APIendpoint: config.CHAT_API_ENDPOINT,
    log: false
});

(async () => {
    let userdata;
    try {
        userdata = await createAnonymousUser(TILEDESK_PROJECT_ID);
    }
    catch(error) {
        console.error("An error occurred during anonym auth:", error);
        process.exit(0);
    }
    
    user1.userid = userdata.userid;
    user1.token = userdata.token;

    let group_id;
    let group_name;

    if (logs) {
        console.log("Message delay check.");
        console.log("MQTT endpoint:", config.MQTT_ENDPOINT);
        console.log("API endpoint:", config.CHAT_API_ENDPOINT);
        console.log("Tiledesk Project Id:", config.TILEDESK_PROJECT_ID);
    }

    if (logs) { console.log("Connecting...") }
    chatClient1.connect(user1.userid, user1.token, () => {
        console.log("Chat client connected and subscribed");
        //group_id = "support-group-" + "64690469599137001a6dc6f5-" + uuidv4().replace(/-+/g, "");
        group_id = "support-group-" + TILEDESK_PROJECT_ID + "-" + uuidv4().replace(/-+/g, "");
        group_name = "benchmarks group => " + group_id;
        send(group_id, group_name);
    });
})();

async function send(group_id, group_name) {
    if (logs) {
        console.log("\n\n***********************************************");
        console.log("********* Single message delay script *********");
        console.log("***********************************************\n\n");
    }
    const prefixRe = new RegExp('^' + escapeRegExp(config.MESSAGE_PREFIX) + '\\/(\\d+)');

    chatClient1.onMessageAdded((message, topic) => {
        //console.log("> Incoming message [sender:" + message.sender_fullname + "]: " + message.text);
        if (
            message &&
            message.text.startsWith(config.MESSAGE_PREFIX) &&
            (message.sender_fullname !== "User 1" && message.sender_fullname !== "System") && // bot is the sender
            message.recipient === group_id
        ) {
            console.log("> Incoming message (from chatbot) with text: ", message.text);
            const text = message.text.trim();
            const iterMatch = text.match(prefixRe);
            if (!iterMatch) {
                console.warn("Could not parse message index from bot reply:", text);
                return;
            }
            const msgIteration = parseInt(iterMatch[1], 10);
            const pending = pendingByIteration.get(msgIteration);
            if (!pending) {
                console.warn("No pending send for iteration", msgIteration);
                return;
            }
            const time_received = Date.now();
            const delay = time_received - pending.timeSent;
            pendingByIteration.delete(msgIteration);
            console.log(`Message ${msgIteration} round-trip delay: ${delay} ms`);
            logMessageRoundTrip(msgIteration, pending.messageUuid, delay, pending.timeSent, time_received);

            iteration++;
            if (iteration < total_iterations) {
                console.log("Next message received. Sending next message...");
                const nextIteration = iteration;
                sendMessage(null, recipient_id, recipient_fullname, nextIteration, async (latency) => {
                    console.log("Sent ok, iteration:", nextIteration);
                });
            } else {
                const conversationTotalMs = time_received - conversationStartMs;
                console.log("Conversation total duration:", conversationTotalMs, "ms");
                logConversationTotal(conversationStartMs, time_received, conversationTotalMs);
                console.log("Last message received. Stopping...");
                process.exit(0);
            }

        } else if (message && 
            !message.text.startsWith(config.MESSAGE_PREFIX) && 
            (message.sender_fullname !== "User 1" && message.sender_fullname !== "System") && // bot is the sender
            message.recipient === group_id
        ) {
            console.log("> Incoming message (from chatbot) with text: ", message.text);
            console.warn("Chatbot must echo the message. Check the flow and try again.")
            process.exit(0);
        }
        else {
            //console.log("Message not computed:", message.text);
        }
    });
    //console.log("Sending test message...");
    let recipient_id = group_id;
    let recipient_fullname = group_name;
    const firstIteration = iteration;
    sendMessage(null, recipient_id, recipient_fullname, firstIteration, async (latency) => {
        console.log("Sent ok, iteration:", firstIteration);
    });
}

function sendMessage(message_UUID, recipient_id, recipient_fullname, i, callback) {
    const sent_message = config.MESSAGE_PREFIX + "/" + i;
    console.log("Sending message with text:", sent_message);

    if (conversationStartMs === null) {
        conversationStartMs = Date.now();
    }
    const timeSent = Date.now();
    const messageUuid = message_UUID || uuidv4().replace(/-+/g, "");
    pendingByIteration.set(i, { timeSent, messageUuid });

    chatClient1.sendMessage(
        sent_message,
        'text',
        recipient_id,
        recipient_fullname,
        user1.fullname,
        {projectId: config.TILEDESK_PROJECT_ID},
        null, // no metadata
        'group',
        (err, msg) => {
            if (err) {
                console.error("Error send:", err);
            }
            //console.log("Message Sent ok:", msg);
            console.log("Message Sent");
        }
    );
}

async function createAnonymousUser(tiledeskProjectId) {
    ANONYMOUS_TOKEN_URL = API_ENDPOINT + '/auth/signinAnonymously';
    // console.log("Getting ANONYMOUS_TOKEN_URL:", ANONYMOUS_TOKEN_URL);
    return new Promise((resolve, reject) => {
        let data = JSON.stringify({
            "id_project": tiledeskProjectId
        });
    
        let axios_config = {
            method: 'post',
            url: ANONYMOUS_TOKEN_URL, //'https://api.tiledesk.com/v3/auth/signinAnonymously',
            headers: { 
                'Content-Type': 'application/json'
            },
            data : data
        };
    
        axios.request(axios_config)
        .then((response) => {
        // console.log("Got Anonymous Token:", JSON.stringify(response.data.token));
        CHAT21_TOKEN_URL = API_ENDPOINT + '/chat21/native/auth/createCustomToken';
            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: CHAT21_TOKEN_URL,
                headers: { 
                    'Authorization': response.data.token
                }
            };
    
            axios.request(config)
            .then((response) => {
                const mqtt_token = response.data.token;
                const chat21_userid = response.data.userid;
                resolve({
                    userid: chat21_userid,
                    token:  mqtt_token
                });
            })
            .catch((error) => {
                console.log(error);
                reject(error);
            });
        })
        .catch((error) => {
            console.log(error);
            reject(error)
        });
    });
}
