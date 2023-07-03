var assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
require('dotenv').config();

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

// console.log("process.env.PERFORMANCE_TEST_API_ENDPOINT:", process.env.PERFORMANCE_TEST_API_ENDPOINT);
let TILEDESK_USER_ID = "";
if (process.env && process.env.PERFORMANCE_TEST_USER_ID) {
	TILEDESK_USER_ID = process.env.PERFORMANCE_TEST_USER_ID
}
else {
    throw new Error(".env.PERFORMANCE_TEST_USER_ID is mandatory");
}

let TILEDESK_USER_TOKEN = "";
if (process.env && process.env.PERFORMANCE_TEST_USER_TOKEN) {
	TILEDESK_USER_TOKEN = process.env.PERFORMANCE_TEST_USER_TOKEN;
}
else {
    throw new Error(".env.PERFORMANCE_TEST_USER_TOKEN is mandatory");
}

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
    EXPECTED_AVG_DIRECT_MESSAGE_DELAY: 160,
    EXPECTED_AVG_GROUP_MESSAGE_DELAY: 160,
    REQS_PER_SECOND: REQS_PER_SECOND,
    MAX_SECONDS: 15000,
    CONCURRENCY: 1,
    MQTT_ENDPOINT: MQTT_ENDPOINT,
    API_ENDPOINT: API_ENDPOINT,
    APPID: 'tilechat',
    TILEDESK_PROJECT_ID: TILEDESK_PROJECT_ID,
    MESSAGE_PREFIX: "Performance-test",
    TILEDESK_USER_ID: TILEDESK_USER_ID,
    TILEDESK_USER_TOKEN: TILEDESK_USER_TOKEN
}

const user1 = {
    userid: config.TILEDESK_USER_ID, //'ad29ae36-f83d-447e-a197-f70fd7fa3eca', // test
	fullname: 'User 1',
	firstname: 'User',
	lastname: '1',
	token: config.TILEDESK_USER_TOKEN //'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ZGM1YTE5OC1kZWM5LTRjNGYtYWU0Yy03Y2M2MWI0MTIxYWMiLCJzdWIiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLmFkMjlhZTM2LWY4M2QtNDQ3ZS1hMTk3LWY3MGZkN2ZhM2VjYS4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuYWQyOWFlMzYtZjgzZC00NDdlLWExOTctZjcwZmQ3ZmEzZWNhLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5hZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EuKiIsInJhYmJpdG1xLmNvbmZpZ3VyZToqLyovKiJdLCJjbGllbnRfaWQiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJjaWQiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJhenAiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJ1c2VyX2lkIjoiYWQyOWFlMzYtZjgzZC00NDdlLWExOTctZjcwZmQ3ZmEzZWNhIiwiYXBwX2lkIjoidGlsZWNoYXQiLCJpYXQiOjE2ODQ3NjkwNTEsImV4cCI6MTY4NzM2MTA1MSwiYXVkIjpbInJhYmJpdG1xIiwiYWQyOWFlMzYtZjgzZC00NDdlLWExOTctZjcwZmQ3ZmEzZWNhIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.XC7TLQsrbYxoyKiCneNrHO_9pKhS_Cx55Maf0RT7o40'
};

const user2 = {
	userid: '63b711fa2ef2e4001a5e4977_63a05d755f117f0013541383',
	fullname: 'Andrea',
	firstname: 'Andrea',
	lastname: 'Andrea',
	token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzZjAwMmNlMi01ZDVkLTQyZGMtYjhmNy01ZTQxNWQwNDE3YTAiLCJzdWIiOiI2M2I3MTFmYTJlZjJlNDAwMWE1ZTQ5NzdfNjNhMDVkNzU1ZjExN2YwMDEzNTQxMzgzIiwic2NvcGUiOlsicmFiYml0bXEucmVhZDoqLyovYXBwcy50aWxlY2hhdC51c2Vycy42M2I3MTFmYTJlZjJlNDAwMWE1ZTQ5NzdfNjNhMDVkNzU1ZjExN2YwMDEzNTQxMzgzLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC51c2Vycy42M2I3MTFmYTJlZjJlNDAwMWE1ZTQ5NzdfNjNhMDVkNzU1ZjExN2YwMDEzNTQxMzgzLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy42M2I3MTFmYTJlZjJlNDAwMWE1ZTQ5NzdfNjNhMDVkNzU1ZjExN2YwMDEzNTQxMzgzLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiNjNiNzExZmEyZWYyZTQwMDFhNWU0OTc3XzYzYTA1ZDc1NWYxMTdmMDAxMzU0MTM4MyIsImNpZCI6IjYzYjcxMWZhMmVmMmU0MDAxYTVlNDk3N182M2EwNWQ3NTVmMTE3ZjAwMTM1NDEzODMiLCJhenAiOiI2M2I3MTFmYTJlZjJlNDAwMWE1ZTQ5NzdfNjNhMDVkNzU1ZjExN2YwMDEzNTQxMzgzIiwidXNlcl9pZCI6IjYzYjcxMWZhMmVmMmU0MDAxYTVlNDk3N182M2EwNWQ3NTVmMTE3ZjAwMTM1NDEzODMiLCJhcHBfaWQiOiJ0aWxlY2hhdCIsImlhdCI6MTY4NjgxOTg5OCwiZXhwIjoxNjg5NDExODk4LCJhdWQiOlsicmFiYml0bXEiLCI2M2I3MTFmYTJlZjJlNDAwMWE1ZTQ5NzdfNjNhMDVkNzU1ZjExN2YwMDEzNTQxMzgzIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.HybzaanlIt-_RuKyZ5AznnXL0nG4hhQz084rYFizQM4'
};

let chatClient1 = new Chat21Client(
{
    appId: config.APPID,
    MQTTendpoint: config.MQTT_ENDPOINT,
    APIendpoint: config.API_ENDPOINT,
    log: false
});

let chatClient2 = new Chat21Client(
{
    appId: config.APPID,
    MQTTendpoint: config.MQTT_ENDPOINT,
    APIendpoint: config.API_ENDPOINT,
    log: false
});

let group_id; // got in before()
let group_name; // got in before()
let sent_messages = new Map();
let total_messages = 0;
let total_delay = 0;

console.log("Executing benchmarks.");
console.log("MQTT endpoint:", config.MQTT_ENDPOINT);
console.log("API endpoint:", config.API_ENDPOINT);
console.log("Tiledesk Project Id:", config.TILEDESK_PROJECT_ID);
console.log("Requests per second:", config.REQS_PER_SECOND);

// describe("Performance Test", function() {
//     before(function(done) {
//         this.timeout(20000);
let test_start_time = Date.now();
console.log("connecting...")
    chatClient2.connect(user2.userid, user2.token, () => {
        console.log("chatClient2 Connected...");
        chatClient1.connect(user1.userid, user1.token, () => {
            console.log("chatClient1 Connected...");
            group_id = "support-group-" + TILEDESK_PROJECT_ID + "-" + uuidv4().replace(/-+/g, "");
            group_name = "benchmarks group => " + group_id;
            const group_members = {}
            group_members['USER2'] = 1;
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
                    assert(result.group.members['USER2'] == 1);
                    // assert(result.group.members['USER3'] == 1);
                    // assert(result.group.members['USER4'] == 1);
                    // assert(result.group.members['USER5'] == 1);
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
                        assert(json.result.members['USER2'] == 1);
                        // assert(json.result.members['USER3'] == 1);
                        // assert(json.result.members['USER4'] == 1);
                        // assert(json.result.members['USER5'] == 1);
                        //console.log("before() - assertions ok -> done()");
                        // done();
                        benchmark();
                    });
                }
            );
        });
	});

        async function benchmark() {
            console.log("\n\n****************************************************");
            console.log("****** Tiledesk Support Group messages benchmark *********");
            console.log("****************************************************\n\n");
            let delay = 1000 / config.REQS_PER_SECOND;
            let total_iterations = config.REQS_PER_SECOND * config.MAX_SECONDS;
            // let current = 0;
            // console.log("Group - Expected message average latency to be <", config.EXPECTED_AVG_DIRECT_MESSAGE_DELAY + "ms");
            console.log("Group - Expected CONCURRENCY (#VIRTUAL USERs aka VUs) =", config.CONCURRENCY);
            console.log("Group - Expected MESSAGES/SEC =", config.REQS_PER_SECOND * config.CONCURRENCY);
            console.log("Group - Expected MESSAGES/SEC/VU =", config.REQS_PER_SECOND);
            console.log("Group - Expected TEST DURATION (s) =", config.MAX_SECONDS);
            console.log("Group - Expected DELAY BETWEEN MESSAGES (ms) =", delay);
            // console.log("Group - Expected TOTAL ITERATIONS =", total_iterations);

            let handler = chatClient2.onMessageAdded((message, topic) => {
                console.log("> Incoming message:", message);
                //console.log("> Incoming message [sender:" + message.sender_fullname + "]: " + message.text);
                // if (
                //     message &&
                //     message.text.startsWith(config.MESSAGE_PREFIX) &&
                //     (message.sender_fullname === "User 1") &&
                //     message.recipient === group_id
                // ) {
                //     let text = message.text.trim();
                //     // console.log("> Accepted [sender:" + message.sender_fullname + "]: " + text);
                //     let message_iteration = text.split("/")[1];
                //     let time_sent = sent_messages.get(text);
                //     let seconds_from_start = Math.round( (Date.now() - test_start_time) /1000);
                //     // console.log("seconds_from_start", seconds_from_start)
                //     // console.log("> sent_message[" + message_iteration + "], time sent:", time_sent);
                //     let time_received = Date.now();
                //     let delay = time_received - time_sent;
                //     total_messages++;
                //     // current = Date.now() - APP_start_time;
                //     total_delay += delay;
                //     // console.log("total:", total_delay)
                //     let mean = total_delay / total_messages;
                //     // console.log("total_messages N:", total_messages, "currentTimeMs:", current, "meanMs:", Math.floor(mean));
                //     let latency = {
                //         totalMessages: total_messages,
                //         latencyMs: delay,
                //         meanLatencyMs: mean
                //     };
                //     // x humans
                //     // console.log("Message id:", message_iteration, "- latency/meanLatency:", latency.latencyMs + "/" + Math.round(latency.meanLatencyMs));
                //     // for spreadsheet
                //     // console.log(message_iteration + ";" + latency.latencyMs);
                //     console.log(seconds_from_start + ";" + latency.latencyMs);
                // }
            });
            console.log("Group - Running benchmark...");
            for (let i = 0; i < total_iterations; i++) {
                // console.log("GROUP i:", i)
                for (let c = 0; c < config.CONCURRENCY; c++) {
                    // console.log("c", c)
                    let recipient_id = group_id;
                    let recipient_fullname = group_name;
                    sendMessage(i, c, recipient_id, recipient_fullname, async (latency, iteration, concurrent_iteration) => {
                        console.log("Group", i, "- latency/meanLatency:", latency.latencyMs + "/" + Math.round(latency.meanLatencyMs));
                    });
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                current = Date.now() - test_start_time;
            }
        }
        // benchmark();
//     });
// });

function sendMessage(iteration, concurrent_iteration, recipient_id, recipient_fullname, callback) {
    let time_sent = Date.now();
    const sent_message = config.MESSAGE_PREFIX + "/"+ iteration; //config.MESSAGE_PREFIX + uuidv4() + "/"+ iteration;
    sent_messages.set(sent_message, time_sent);
    console.log("Sent (and added to map):", sent_message);
    
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
        }
    );
}



