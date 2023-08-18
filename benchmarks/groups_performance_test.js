var assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
require('dotenv').config();
const axios = require('axios');

// *******************************
// ******** MQTT SECTION *********
// *******************************

console.log("process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID:", process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID);
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

// console.log("process.env.PERFORMANCE_TEST_API_ENDPOINT:", process.env.PERFORMANCE_TEST_API_ENDPOINT);
// let TILEDESK_USER_ID = "";
// if (process.env && process.env.PERFORMANCE_TEST_USER_ID) {
// 	TILEDESK_USER_ID = process.env.PERFORMANCE_TEST_USER_ID
// }
// else {
//     throw new Error(".env.PERFORMANCE_TEST_USER_ID is mandatory");
// }

// let TILEDESK_USER_TOKEN = "";
// if (process.env && process.env.PERFORMANCE_TEST_USER_TOKEN) {
// 	TILEDESK_USER_TOKEN = process.env.PERFORMANCE_TEST_USER_TOKEN;
// }
// else {
//     throw new Error(".env.PERFORMANCE_TEST_USER_TOKEN is mandatory");
// }

//console.log("process.env.PERFORMANCE_TEST_REQS_PER_SECOND:", process.env.PERFORMANCE_TEST_REQS_PER_SECOND);
let REQS_PER_SECOND = 4;
if (process.env && process.env.PERFORMANCE_TEST_REQS_PER_SECOND) {
	REQS_PER_SECOND = process.env.PERFORMANCE_TEST_REQS_PER_SECOND
    // console.log("REQS_PER_SECOND:", REQS_PER_SECOND);
}
else {
    console.log("Using default .env.PERFORMANCE_TEST_REQS_PER_SECOND:", REQS_PER_SECOND);
}

let config = {
    // EXPECTED_AVG_DIRECT_MESSAGE_DELAY: 160,
    // EXPECTED_AVG_GROUP_MESSAGE_DELAY: 160,
    // REQS_PER_SECOND: REQS_PER_SECOND,
    MAX_SECONDS: 15000,
    CONCURRENCY: 1,
    // MQTT_ENDPOINT: MQTT_ENDPOINT,
    // API_ENDPOINT: API_ENDPOINT,
    APPID: 'tilechat',
    // TILEDESK_PROJECT_ID: TILEDESK_PROJECT_ID,
    MESSAGE_PREFIX: "Performance-test",
    // TILEDESK_USER_ID: TILEDESK_USER_ID,
    // TILEDESK_USER_TOKEN: TILEDESK_USER_TOKEN
}

const user1 = {
    //userid: config.TILEDESK_USER_ID, //'ad29ae36-f83d-447e-a197-f70fd7fa3eca', // test
	fullname: 'User 1',
	firstname: 'User',
	lastname: '1',
	//token: config.TILEDESK_USER_TOKEN //'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ZGM1YTE5OC1kZWM5LTRjNGYtYWU0Yy03Y2M2MWI0MTIxYWMiLCJzdWIiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLmFkMjlhZTM2LWY4M2QtNDQ3ZS1hMTk3LWY3MGZkN2ZhM2VjYS4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuYWQyOWFlMzYtZjgzZC00NDdlLWExOTctZjcwZmQ3ZmEzZWNhLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5hZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EuKiIsInJhYmJpdG1xLmNvbmZpZ3VyZToqLyovKiJdLCJjbGllbnRfaWQiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJjaWQiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJhenAiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJ1c2VyX2lkIjoiYWQyOWFlMzYtZjgzZC00NDdlLWExOTctZjcwZmQ3ZmEzZWNhIiwiYXBwX2lkIjoidGlsZWNoYXQiLCJpYXQiOjE2ODQ3NjkwNTEsImV4cCI6MTY4NzM2MTA1MSwiYXVkIjpbInJhYmJpdG1xIiwiYWQyOWFlMzYtZjgzZC00NDdlLWExOTctZjcwZmQ3ZmEzZWNhIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.XC7TLQsrbYxoyKiCneNrHO_9pKhS_Cx55Maf0RT7o40'
};

const user2 = {
	//userid: 'USER2',
	fullname: 'User 2',
	firstname: 'User',
	lastname: '2',
	//token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0NGUzZjdhZC1jNGM1LTQxZmMtOTQzZi0wZjFjZjYwZTBkNDEiLCJzdWIiOiJVU0VSMiIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjIuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVIyLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSMi4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVIyIiwiY2lkIjoiVVNFUjIiLCJhenAiOiJVU0VSMiIsInVzZXJfaWQiOiJVU0VSMiIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjQ0Njc1NzcxLCJleHAiOjE5NTU3MTU3NzEsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVIyIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.NQsVvyrwGaCz9W6vS1-QSPRxBL1b2mPz1ntLtEFJm_A'
};

let chatClient1 = new Chat21Client(
    {
        appId: config.APPID,
        MQTTendpoint: MQTT_ENDPOINT,
        APIendpoint: CHAT_API_ENDPOINT,
        log: false
    });
    
let chatClient2 = new Chat21Client(
{
    appId: config.APPID,
    MQTTendpoint: MQTT_ENDPOINT,
    APIendpoint: CHAT_API_ENDPOINT,
    log: false
});

let sent_messages = new Map();
let total_messages = 0;
let total_delay = 0;
let group_id; // got in before()
let group_name; // got in before()
let test_start_time = Date.now();

console.log("Starting1...");
(async () => {
    console.log("Starting2...")
    let userdata1;
    let userdata2;
    try {
        userdata1 = await createAnonymousUser(TILEDESK_PROJECT_ID);
        userdata2 = await createAnonymousUser(TILEDESK_PROJECT_ID);
    }
    catch(error) {
        console.log("An error occurred during anonym auth:", error);
        process.exit(0);
    }
    user1.userid = userdata1.userid;
    user1.token = userdata1.token;
    user2.userid = userdata2.userid;
    user2.token = userdata2.token;
    
    console.log("Executing benchmarks.");
    console.log("MQTT endpoint:", MQTT_ENDPOINT);
    console.log("API endpoint:", CHAT_API_ENDPOINT);
    console.log("Tiledesk Project Id:", TILEDESK_PROJECT_ID);
    console.log("Requests per second:", REQS_PER_SECOND);
    
    console.log("connecting...")
    chatClient2.connect(user2.userid, user2.token, () => {
        console.log("chatClient2 Connected.");
        chatClient1.connect(user1.userid, user1.token, () => {
            console.log("chatClient1 Connected.");
            group_id = "group-" + "64690469599137001a6dc6f5-" + uuidv4().replace(/-+/g, "");
            group_name = "benchmarks group => " + group_id;
            const group_members = {}
            group_members[user2.userid] = 1;
            let total_ = 0
            const start_ = Date.now();
            chatClient1.groupCreate(
                group_name,
                group_id,
                group_members,
                (err, result) => {
                    total_ = Date.now() - start_
                    console.log("TOTAL GROUP CREATION TIME", total_ + "ms");
                    assert(err == null);
                    assert(result != null);
                    assert(result.success == true);
                    assert(result.group.name === group_name);
                    assert(result.group.members != null);
                    assert(result.group.members[user1.userid] == 1);
                    assert(result.group.members[user2.userid] == 1);
                    console.log("Group created:", result.group.name);
                    chatClient1.groupData(group_id, (err, json) => {
                        // console.log("before() - Verified group updated:", group_id, "data:", json);
                        //console.log("groupData:", json)
                        assert(err == null);
                        assert(json != null);
                        assert(json.success == true);
                        assert(json.result != null);
                        assert(json.result.uid === group_id);
                        assert(json.result.owner === user1.userid);
                        assert(json.result.members != null);
                        assert(json.result.members[user1.userid] == 1);
                        assert(json.result.members[user2.userid] == 1);
                        benchmark();
                    });
                }
            );
        });
    });
})();



async function benchmark() {
    console.log("\n\n****************************************************");
    console.log("********* Chat21 Group messages benchmark *********");
    console.log("****************************************************\n\n");
    let delay = 1000 / REQS_PER_SECOND;
    let total_iterations = REQS_PER_SECOND * config.MAX_SECONDS;
    // let current = 0;
    // console.log("Group - Expected message average latency to be <", config.EXPECTED_AVG_DIRECT_MESSAGE_DELAY + "ms");
    console.log("Group - Expected CONCURRENCY (#VIRTUAL USERs aka VUs) =", config.CONCURRENCY);
    console.log("Group - Expected MESSAGES/SEC =", REQS_PER_SECOND * config.CONCURRENCY);
    console.log("Group - Expected MESSAGES/SEC/VU =", REQS_PER_SECOND);
    // console.log("Group - Expected TEST DURATION (s) =", config.MAX_SECONDS);
    console.log("Group - Expected DELAY BETWEEN MESSAGES (ms) =", delay);
    // console.log("Group - Expected TOTAL ITERATIONS =", total_iterations);

    let handler = chatClient2.onMessageAdded((message, topic) => {
        //console.log("> Incoming message:", message);
        //console.log("> Incoming message [sender:" + message.sender_fullname + "]: " + message.text);
        if (
            message &&
            message.text.startsWith(config.MESSAGE_PREFIX) &&
            (message.sender_fullname === "User 1") &&
            message.recipient === group_id
        ) {
            let text = message.text.trim();
            // console.log("> Accepted [sender:" + message.sender_fullname + "]: " + text);
            let message_iteration = text.split("/")[1];
            let time_sent = sent_messages.get(text);
            let seconds_from_start = Math.round( (Date.now() - test_start_time) /1000);
            // console.log("seconds_from_start", seconds_from_start)
            // console.log("> sent_message[" + message_iteration + "], time sent:", time_sent);
            let time_received = Date.now();
            let delay = time_received - time_sent;
            total_messages++;
            // current = Date.now() - APP_start_time;
            total_delay += delay;
            // console.log("total:", total_delay)
            let mean = total_delay / total_messages;
            // console.log("total_messages N:", total_messages, "currentTimeMs:", current, "meanMs:", Math.floor(mean));
            let latency = {
                totalMessages: total_messages,
                latencyMs: delay,
                meanLatencyMs: mean
            };
            // x humans
            // console.log("Message id:", message_iteration, "- latency/meanLatency:", latency.latencyMs + "/" + Math.round(latency.meanLatencyMs));
            // for spreadsheet
            // console.log(message_iteration + ";" + latency.latencyMs);
            console.log(seconds_from_start + ";" + latency.latencyMs);
        }
    });
    console.log("Group - Running benchmark...", total_iterations,config.CONCURRENCY );
    for (let i = 0; i < total_iterations; i++) {
        // console.log("GROUP i:", i)
        for (let c = 0; c < config.CONCURRENCY; c++) {
            // console.log("c", c)
            let recipient_id = group_id;
            let recipient_fullname = group_name;
            sendMessage(i, c, recipient_id, recipient_fullname, async (latency, iteration, concurrent_iteration) => {
                // console.log("Group", i, "- latency/meanLatency:", latency.latencyMs + "/" + Math.round(latency.meanLatencyMs));
            });
        }
        await new Promise(resolve => setTimeout(resolve, delay)); // sleep
        current = Date.now() - test_start_time;
    }
}

function sendMessage(iteration, concurrent_iteration, recipient_id, recipient_fullname, callback) {
    let time_sent = Date.now();
    const sent_message = config.MESSAGE_PREFIX + "/"+ iteration; //config.MESSAGE_PREFIX + uuidv4() + "/"+ iteration;
    sent_messages.set(sent_message, time_sent);
    // console.log("Sent (and added to map):", sent_message, recipient_id);
    
    chatClient1.sendMessage(
        sent_message,
        'text',
        recipient_id,
        recipient_fullname,
        user1.fullname,
        {projectId: TILEDESK_PROJECT_ID},
        null, // no metadata
        'group',
        (err, msg) => {
            if (err) {
                console.error("Error send:", err);
            }
            else {
                // console.log("message sent:", msg);
            }
        }
    );
}

async function createAnonymousUser(tiledeskProjectId) {
    ANONYMOUS_TOKEN_URL = API_ENDPOINT + '/auth/signinAnonymously';
    console.log("Getting ANONYMOUS_TOKEN_URL:", ANONYMOUS_TOKEN_URL);
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
        console.log("Got Anonymous Token:", JSON.stringify(response.data.token));
        CHAT21_TOKEN_URL = API_ENDPOINT + '/chat21/native/auth/createCustomToken';
        //   console.log("Getting CHAT21_TOKEN_URL:", CHAT21_TOKEN_URL);
            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: CHAT21_TOKEN_URL, //'https://api.tiledesk.com/v3/chat21/native/auth/createCustomToken',
                headers: { 
                    'Authorization': response.data.token
                }
            };
    
            axios.request(config)
            .then((response) => {
                // console.log("response.data:", typeof response.data, response.data);
                const mqtt_token = response.data.token;
                const chat21_userid = response.data.userid;
                // console.log("chat21 userid:", chat21_userid);
                // console.log("chat21 token:", mqtt_token);
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



