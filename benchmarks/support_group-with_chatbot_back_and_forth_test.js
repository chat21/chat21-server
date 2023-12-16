var assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
require('dotenv').config();
const axios = require('axios');

// *******************************
// ******** MQTT SECTION *********
// *******************************

// console.log("process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID:", process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID);
let TILEDESK_PROJECT_ID = "";
if (process.env && process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID) {
	TILEDESK_PROJECT_ID = process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID
    // console.log("TILEDESK_PROJECT_ID:", TILEDESK_PROJECT_ID);
}
else {
    throw new Error(".env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID is mandatory");
}

// console.log("process.env.PERFORMANCE_TEST_MQTT_ENDPOINT:", process.env.PERFORMANCE_TEST_MQTT_ENDPOINT);
let MQTT_ENDPOINT = "";
if (process.env && process.env.PERFORMANCE_TEST_MQTT_ENDPOINT) {
	MQTT_ENDPOINT = process.env.PERFORMANCE_TEST_MQTT_ENDPOINT
    // console.log("MQTT_ENDPOINT:", MQTT_ENDPOINT);
}
else {
    throw new Error(".env.PERFORMANCE_TEST_MQTT_ENDPOINT is mandatory");
}

let API_ENDPOINT = "";
if (process.env && process.env.PERFORMANCE_TEST_API_ENDPOINT) {
	API_ENDPOINT = process.env.PERFORMANCE_TEST_API_ENDPOINT
    // console.log("API_ENDPOINT:", API_ENDPOINT);
}
else {
    throw new Error(".env.PERFORMANCE_TEST_API_ENDPOINT is mandatory");
}

let CHAT_API_ENDPOINT = "";
if (process.env && process.env.PERFORMANCE_TEST_CHAT_API_ENDPOINT) {
	CHAT_API_ENDPOINT = process.env.PERFORMANCE_TEST_CHAT_API_ENDPOINT
    // console.log("CHAT_API_ENDPOINT:", CHAT_API_ENDPOINT);
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
        console.log("An error occurred during anonym auth:", error);
        process.exit(0);
    }
    
    user1.userid = userdata.userid;
    user1.token = userdata.token;

    let group_id;
    let group_name;

    console.log("Message delay check.");
    console.log("MQTT endpoint:", config.MQTT_ENDPOINT);
    console.log("API endpoint:", config.CHAT_API_ENDPOINT);
    console.log("Tiledesk Project Id:", config.TILEDESK_PROJECT_ID);

    console.log("Connecting...")
    chatClient1.connect(user1.userid, user1.token, () => {
        console.log("chatClient1 connected and subscribed.");
        group_id = "support-group-" + "64690469599137001a6dc6f5-" + uuidv4().replace(/-+/g, "");
        group_name = "benchmarks group => " + group_id;
        send(group_id, group_name);
    });
})();

async function send(group_id, group_name) {
    console.log("\n\n***********************************************");
    console.log("********* Single message delay script *********");
    console.log("***********************************************\n\n");
    let time_sent = Date.now();
    let handler = chatClient1.onMessageAdded((message, topic) => {
        console.log("> Incoming message [sender:" + message.sender_fullname + "]: " + message.text);
        if (
            message &&
            message.text.startsWith(config.MESSAGE_PREFIX) &&
            (message.sender_fullname !== "User 1" && message.sender_fullname !== "System") && // bot is the sender
            message.recipient === group_id
        ) {
            console.log("> Incoming message (sender is the chatbot) used for computing ok.");
            let text = message.text.trim();
            let time_received = Date.now();
            let delay = time_received - time_sent;
            console.log("Total delay:" + delay + "ms");
            process.exit(0);
        }
        else {
            console.log("Message not computed:", message.text);
        }
    });
    console.log("Sending test message...");
    let recipient_id = group_id;
    let recipient_fullname = group_name;
    let message_UUID = uuidv4().replace(/-+/g, "");
    sendMessage(message_UUID, recipient_id, recipient_fullname, async (latency) => {
        console.log("Sent ok:", message_UUID);
    });
}

function sendMessage(message_UUID, recipient_id, recipient_fullname, callback) {
    const sent_message = config.MESSAGE_PREFIX + "/"+ message_UUID;
    console.log("Sending message with text:", sent_message);
    
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
            console.log("Message Sent ok:", msg);
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
