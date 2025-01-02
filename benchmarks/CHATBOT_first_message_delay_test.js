
const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
require('dotenv').config();
const axios = require('axios');
const { TiledeskClient } = require('./TiledeskClient');

// const LOG_STATUS = (process.env.LOG_STATUS && process.env.LOG_STATUS) === 'true' ? true : false;
const LOG_STATUS = false;

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
    TILEDESK_PROJECT_ID: TILEDESK_PROJECT_ID
}

let chatClient1 = new Chat21Client(
{
    appId: config.APPID,
    MQTTendpoint: config.MQTT_ENDPOINT,
    APIendpoint: config.CHAT_API_ENDPOINT,
    log: LOG_STATUS
});

let group_id;
let trig_conv_start;
  
(async () => {
    // return new Promise(async (resolve, reject) => {
    let userdata;
    try {
        const auth_start = new Date().getTime();
        console.log("Authenticating...");
        userdata = await createAnonymousUser(TILEDESK_PROJECT_ID);
        // console.log("Authenticated.");
        const auth_end = new Date().getTime();
        const auth_delay = auth_end - auth_start;
        console.log("Authenticated in:", auth_delay);
    }
    catch(error) {
        console.error("An error occurred during anonym auth:", error);
        process.exit(0);
    }
    let user1 = {};
    user1.userid = userdata.userid;
    user1.token = userdata.token;
    user1.tiledesk_token = userdata.tiledesk_token;
    if (LOG_STATUS) {
        console.log("MQTT endpoint:", config.MQTT_ENDPOINT);
        console.log("API endpoint:", config.CHAT_API_ENDPOINT);
        console.log("Tiledesk Project Id:", config.TILEDESK_PROJECT_ID);
        console.log("Connecting...");    
    }
    console.log("MQTT connecting...");
    const MQTT_start = new Date().getTime();
    chatClient1.connect(user1.userid, user1.token, () => {
        // console.log("MQTT connected.");
        const MQTT_end = new Date().getTime();
        const MQTT_delay = MQTT_end - MQTT_start;
        console.log("MQTT connected in:", MQTT_delay);
        if (LOG_STATUS) {
            console.log("chatClient1 connected and subscribed.");
        }
        group_id = "support-group-" + TILEDESK_PROJECT_ID + "-" + uuidv4().replace(/-+/g, "");
        replace(user1, () => {
            console.log("Finished.");
        });
    });
    // });
})();

function replace(user1, done) {
    const message_text = uuidv4().replace(/-+/g, "");
    let handler = chatClient1.onMessageAdded((message, topic) => {
        if (LOG_STATUS) {
            console.log(">>> Incoming message [sender:" + message.sender_fullname + "]: ", message);
            console.log("> Incoming message commands [sender:" + message.sender_fullname + "]: ", message.attributes?.commands);
        }
        if (
            message &&
            message.sender_fullname === "MAIN BOT" &&
            message.text === "My name is Main"
        ) {
            if (LOG_STATUS) {
                console.log("> Incoming message from 'Replaced bot 1' is ok.");
            }
            console.log("> First message ok.");
            const trig_conv_end = new Date().getTime();
            const trig_conv_delay = trig_conv_end - trig_conv_start;
            console.log("First message delay:", trig_conv_delay);
            
            process.exit(0);
        }
        else if (
            message &&
            message.text.startsWith("My name is Replaced") &&
            message.sender_fullname === "REPLACED"
        ) {
            if (LOG_STATUS) {
                console.log("> Got replaced.");
            }
            console.log("replaced bot message received."); //, message.text);
            const parts = message.text.split(":");
            const last = parts[parts.length - 1];
            // console.log("last:", last);
            const sent_at = parseInt(last);
            const sent_at_date = new Date(sent_at);
            // console.log("sent at:",sent_at_date);
            // console.log("sent at (timestamp):", sent_at_date.getTime());
            const now_as_date = new Date();
            // console.log("received at:", now_as_date);
            const now = now_as_date.getTime();
            // console.log("received at (timestamp):", now);
            const diff = now - sent_at;
            console.log("replace bot delay:", diff);
            done();
        }
        else {
            // console.log("Message not computed:", message.text);
        }
    });
    if (LOG_STATUS) {
        console.log("Triggering Conversation...");
    }
    console.log("Triggering Conversation...");
    trig_conv_start = new Date().getTime();
    let recipient_id = group_id;
    triggerConversation(recipient_id, user1.tiledesk_token, (err) => {
        if (err) {
            console.error("An error occurred while triggering echo bot conversation:", err);
        }
    });
}

async function createAnonymousUser(tiledeskProjectId) {
    ANONYMOUS_TOKEN_URL = API_ENDPOINT + '/auth/signinAnonymously';
    if (LOG_STATUS) {
        console.log("Getting ANONYMOUS_TOKEN_URL:", ANONYMOUS_TOKEN_URL);
    }
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
        if (LOG_STATUS) {
            console.log("HTTP Params ANONYMOUS_TOKEN_URL:", axios_config);
        }
        axios.request(axios_config)
        .then((response) => {
            if (LOG_STATUS) {
                console.log("Got Anonymous Tiledesk Token:", JSON.stringify(response.data.token));
            }
            const tiledesk_token = response.data.token
            CHAT21_TOKEN_URL = API_ENDPOINT + '/chat21/native/auth/createCustomToken';
            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: CHAT21_TOKEN_URL,
                headers: { 
                    'Authorization': tiledesk_token
                }
            };

            axios.request(config)
            .then((response) => {
                const mqtt_token = response.data.token;
                const chat21_userid = response.data.userid;
                resolve({
                    userid: chat21_userid,
                    token:  mqtt_token,
                    tiledesk_token: tiledesk_token
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

async function triggerConversation(request_id, token, callback) {
    const tdclient = new TiledeskClient(
    {
        APIKEY: "__APIKEY__",
        APIURL: API_ENDPOINT,
        projectId: TILEDESK_PROJECT_ID,
        token: token,
        log: LOG_STATUS
    });
    
    const event = {
        name: "new_conversation",
        attributes: {
            "request_id": request_id,
            // "department": default_dep.id,
            // "participants": ["bot_" + chatbot_id],
            "language": "en",
            "subtype": "info",
            "fullname": "me",
            "email": "me@email.com",
            "attributes": {}
        }
    };
    // if (LOG_STATUS) {
        // console.log("Firing trigger conversation event:", event);
    // }
    tdclient.fireEvent(event, function(err, result) {
        if (err) {
            console.error("An error occurred invoking an event:", err);
            process.exit(1);
        }
        // console.log("Fired.");
        callback();
    });
        
    
}
