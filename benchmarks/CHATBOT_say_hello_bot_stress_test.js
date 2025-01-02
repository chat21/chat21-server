
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

let user1 = {};
let requests = new Map();
let interval = 1500;

(async () => {
    // return new Promise(async (resolve, reject) => {
    let userdata;
    try {
        const auth_start = new Date().getTime();
        console.log("Requests interval:", interval, "ms.");
        console.log("Authenticating...");
        userdata = await createAnonymousUser(TILEDESK_PROJECT_ID);
        // console.log("Authenticated.");
        const auth_end = new Date().getTime();
        const auth_delay = auth_end - auth_start;
        console.log("Authenticated in:", auth_delay, "ms");
    }
    catch(error) {
        console.error("An error occurred during anonym auth:", error);
        process.exit(0);
    }
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
    chatClient1.connect(user1.userid, user1.token, async () => {
        const MQTT_end = new Date().getTime();
        const MQTT_delay = MQTT_end - MQTT_start;
        console.log("MQTT connected in:", MQTT_delay, "ms");
        if (LOG_STATUS) {
            console.log("chatClient1 connected and subscribed.");
        }

        let handler = chatClient1.onMessageAdded((message, topic) => {
            if (LOG_STATUS) {
                console.log(">>> Incoming message [sender:" + message.sender_fullname + "]: ", message);
                console.log("> Incoming message commands [sender:" + message.sender_fullname + "]: ", message.attributes?.commands);
            }
            if (
                message &&
                message.sender_fullname === "Welcome bot" &&
                message.text.startsWith("Hi,")
            ) {
                if (LOG_STATUS) {
                    console.log("> Incoming message from 'Replaced bot 1' is ok.");
                }
                // console.log("> First message ok.");
                
                // start measuring replace bot delay
                const sent_at_as_date = new Date();
                const sent_at = sent_at_as_date.getTime();
                // console.log("sent at:",sent_at_as_date);
                // console.log("sent at (timestamp):", sent_at);
                requests.get(message.recipient).sent_at = sent_at;
                // requests[message.recipient].sent_at = sent_at;
                // console.log("replaces[message.recipient]", replaces[message.recipient]);
                chatClient1.sendMessage(
                    "/hello{\"sent_at\": " + sent_at + "}", // + ", \"msg\": " + count + "}",
                    'text',
                    message.recipient,
                    "Test support group",
                    user1.fullname,
                    {projectId: config.TILEDESK_PROJECT_ID},
                    null, // no metadata
                    'group',
                    (err, msg) => {
                        if (err) {
                            console.error("Error send:", err);
                        }
                        if (LOG_STATUS) {
                            console.log("Message Sent ok:", msg);
                        }
                    }
                );
            }
            else if (
                message &&
                message.text.startsWith("Hello at:") &&
                message.sender_fullname === "Welcome bot"
            ) {
                const parts = message.text.split(":");
                const last = parts[parts.length - 1];
                const sent_at = parseInt(last);
                const now_as_date = new Date();
                const now = now_as_date.getTime();
                const delay = now - sent_at;
                requests.get(message.recipient).received_at = now;
                requests.get(message.recipient).delay = delay;
                // average delay
                let sum = 0;
                // for (const [key, value] of Object.entries(requests)) {
                requests.forEach( (value, key, map) => {
                    if (delay != 0) {
                        sum += value.delay
                    }
                });
                let keys_number = requests.size;
                let avg = sum/keys_number
                // console.log(">", requests.get(message.recipient).delay);
                getLast20ElementsByStartAt(requests).forEach(e => {
                    console.log(e[0],e[1]);
                });
                // console.log(getLast20ElementsByStartAt(requests));
                console.log("Average delay:", Math.round(avg), "ms [", keys_number,"]");
            }
            else {
                // console.log("Message not computed:", message.text);
            }
        });
        go(0);
    });
    // });
})();

function getLast20ElementsByStartAt(map) {
    // Converti la mappa in un array di oggetti chiave-valore
    const entries = Array.from(map.entries());

    // Ordina gli elementi per la proprietà "start_at"
    entries.sort((a, b) => a[1].start_at - b[1].start_at);

    // Ottieni gli ultimi 20 elementi
    const last20 = entries.slice(-20);

    // Stampa gli ultimi 20 elementi
    // console.log(last20);

    // Restituisci gli ultimi 20 elementi, se necessario
    return last20;
}

async function go(count) {
    let group_id = "support-group-" + TILEDESK_PROJECT_ID + "-" + uuidv4().replace(/-+/g, "");
    requests.set(
        group_id,
        {
            sent_at: null,
            received_at: null,
            delay: 0
        }
    );
    // requests[group_id] = {
    //     sent_at: null,
    //     received_at: null,
    //     delay: 0
    // }
    trigger(group_id, user1, count);
    // console.log("Replacing...");
    await new Promise(r => setTimeout(r, interval));
    count++;
    go(count);
}
    // after(function (done) {
    //     chatClient1.close(() => {
    //         done();
    //     });
    // });

function trigger(recipient_id) {
    if (LOG_STATUS) {
        console.log("Triggering Conversation...");
    }
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
