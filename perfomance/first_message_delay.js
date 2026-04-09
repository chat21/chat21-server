const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Questo script esegue un test di performance per misurare la latenza (in millisecondi)
 * nella ricezione delle risposte dal chatbot Tiledesk tramite protocollo MQTT.
 * 
 * Il test funziona così:
 * - Viene generato un utente anonimo e stabilita una connessione MQTT tramite Chat21Client.
 * - L'utente entra in un nuovo gruppo di supporto su Tiledesk.
 * - Viene inviato un messaggio di test al bot, identificato da un UUID univoco.
 * - Al ricevimento della risposta dal chatbot, viene calcolato il ritardo effettivo 
 *   (differenza tra il timestamp di invio e quello di ricezione).
 * - Il risultato della misurazione (timestamp, UUID messaggio, delay, tempi di invio/ricezione) 
 *   viene salvato nel file logs/performance_delay.log in formato CSV.
 * 
 * Questo script è usato anche in ciclo multiplo da uno script bash, per generare dati
 * statistici sulle prestazioni e la reattività del bot e della piattaforma Tilechat.
 *
 * Variabile opzionale: PERFORMANCE_TEST_REPLY_TIMEOUT_MS (default 120000) — evita che il processo
 * resti bloccato se la risposta MQTT non arriva.
 */


/**
 * MQTT SECTION
 */

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

/** Se la risposta del bot non arriva entro questo tempo, il processo termina (evita hang infiniti). */
const REPLY_TIMEOUT_MS = Number(process.env.PERFORMANCE_TEST_REPLY_TIMEOUT_MS) || 120000;
let replyTimeoutId = null;

function clearReplyTimeout() {
    if (replyTimeoutId !== null) {
        clearTimeout(replyTimeoutId);
        replyTimeoutId = null;
    }
}

const logs = false;

// Log file path
const LOG_DIR = path.join(__dirname, '.', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'first_message_delay.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize log file with header if it doesn't exist
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'timestamp,message_uuid,delay_ms,time_sent,time_received\n', 'utf8');
}

// Function to log delay to file
function logDelay(message_UUID, delay, time_sent, time_received) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp},${message_UUID},${delay},${time_sent},${time_received}\n`;
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

    let time_sent;
    let total_conversation_time = Date.now();
    let message_UUID = uuidv4().replace(/-+/g, "");

    replyTimeoutId = setTimeout(() => {
        console.error(
            `Timeout: nessuna risposta valida dal bot entro ${REPLY_TIMEOUT_MS} ms (group ${group_id}). ` +
            `Esporta PERFORMANCE_TEST_REPLY_TIMEOUT_MS per cambiare il limite.`
        );
        process.exit(1);
    }, REPLY_TIMEOUT_MS);

    chatClient1.onMessageAdded((message, topic) => {
        if (validMessageFromChatbot(message, group_id)) {
            clearReplyTimeout();
            let time_received = Date.now();
            let delay = time_received - time_sent;
            console.log("Reply delay: ", delay, "ms");
            logDelay(message_UUID, delay, time_sent, time_received);

            total_conversation_time = Date.now() - total_conversation_time;
            console.log("Total conversation time: ", total_conversation_time, "ms");
            process.exit(0);
        }
        else if (invalidMessageFromChatbot(message, group_id)) {
            clearReplyTimeout();
            console.warn("Chatbot replied with an invalid message: ", message.text);
            console.warn("Chatbot must echo the message. Check the flow and try again.")
            process.exit(0);
        } else {
            //console.log("Message not computed:", message.text);
        }

    });

    time_sent = Date.now();
    let recipient_id = group_id;
    let recipient_fullname = group_name;
    sendMessage(message_UUID, recipient_id, recipient_fullname);
}

function sendMessage(message_UUID, recipient_id, recipient_fullname, callback) {
    const sent_message = config.MESSAGE_PREFIX + "/"+ message_UUID;
    //console.log("Sending message with text:", sent_message);
    
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
            console.log("Message Sent");
        }
    );
}

function validMessageFromChatbot(message, group_id) {
    return message && message.text.startsWith(config.MESSAGE_PREFIX) && (message.sender_fullname !== "User 1" && message.sender_fullname !== "System") && message.recipient === group_id;
}

function invalidMessageFromChatbot(message, group_id) {
    return message && !message.text.startsWith(config.MESSAGE_PREFIX) && (message.sender_fullname !== "User 1" && message.sender_fullname !== "System") && message.recipient === group_id;
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