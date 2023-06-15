var assert = require('assert');
const { send } = require('process');
const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
let axios = require('axios');

// *******************************
// ******** MQTT SECTION *********
// *******************************

// REMOTE
// const MQTT_ENDPOINT = 'ws://99.80.197.164:15675/ws';
// const API_ENDPOINT = 'http://99.80.197.164:8004/api';
// LOCAL
// const MQTT_ENDPOINT = 'ws://localhost:15675/ws';
// const API_ENDPOINT = 'http://localhost:8004/api';

// const APPID = 'tilechat';

let config = {
    EXPECTED_AVG_DIRECT_MESSAGE_DELAY: 160,
    EXPECTED_AVG_GROUP_MESSAGE_DELAY: 160,
    REQS_PER_SECOND: 4,
    MAX_SECONDS: 15000,
    CONCURRENCY: 1, // 2
    //API_SERVER_HOST: 'localhost',
    //API_SERVER_PORT: 8004,
    // MQTT_ENDPOINT: 'wss://console.native.tiledesk.com/ws',
    // API_ENDPOINT: 'https://console.native.tiledesk.com/chatapi/api',
    // LOCAL
    //MQTT_ENDPOINT: 'ws://localhost:15675/ws',
    //API_ENDPOINT: 'http://localhost:8004/api',
    // REMOTE TEST
    //MQTT_ENDPOINT: 'ws://35.198.150.252/mqws/ws',
    //API_ENDPOINT: 'http://35.198.150.252/chatapi/api',
    // REMOTE
    MQTT_ENDPOINT: 'wss://eu.rtmv3.tiledesk.com/mqws/ws',
    API_ENDPOINT: 'https://eu.rtmv3.tiledesk.com/chatapi/api',    
    APPID: 'tilechat'
}

// let config = {
//     EXPECTED_AVG_DIRECT_MESSAGE_DELAY: 160,
//     EXPECTED_AVG_GROUP_MESSAGE_DELAY: 160,
//     REQS_PER_SECOND: 100,
//     MAX_SECONDS: 10,
//     CONCURRENCY: 1, // 2
//     //API_SERVER_HOST: 'localhost',
//     API_SERVER_PORT: 8004,
//     MQTT_ENDPOINT: 'ws://localhost:15675/ws',
//     API_ENDPOINT: 'http://localhost:8004/api',
//     APPID: 'tilechat'
// }

const user1 = {
    // userid: "USER1",
    //userid: 'ad29ae36-f83d-447e-a197-f70fd7fa3eca', // test
    userid: "69a6b668-6a4f-4543-b5a9-5b3c34dd95ae",
	fullname: 'User 1',
	firstname: 'User',
	lastname: '1',
	// token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2OGFkODJjYi1lODE2LTRkYWEtYjljYi0wM2NiZmFjMDY1OGQiLCJzdWIiOiJVU0VSMSIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjEuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVIxLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSMS4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVIxIiwiY2lkIjoiVVNFUjEiLCJhenAiOiJVU0VSMSIsInVzZXJfaWQiOiJVU0VSMSIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjQ0Njc1NzcxLCJleHAiOjE5NTU3MTU3NzEsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVIxIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.CrvQLL3DMydcRyLSyfyJBSdyG-HKDj5Pd8kA1UIPjQA'
    // test token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI3ZGM1YTE5OC1kZWM5LTRjNGYtYWU0Yy03Y2M2MWI0MTIxYWMiLCJzdWIiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLmFkMjlhZTM2LWY4M2QtNDQ3ZS1hMTk3LWY3MGZkN2ZhM2VjYS4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuYWQyOWFlMzYtZjgzZC00NDdlLWExOTctZjcwZmQ3ZmEzZWNhLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5hZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EuKiIsInJhYmJpdG1xLmNvbmZpZ3VyZToqLyovKiJdLCJjbGllbnRfaWQiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJjaWQiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJhenAiOiJhZDI5YWUzNi1mODNkLTQ0N2UtYTE5Ny1mNzBmZDdmYTNlY2EiLCJ1c2VyX2lkIjoiYWQyOWFlMzYtZjgzZC00NDdlLWExOTctZjcwZmQ3ZmEzZWNhIiwiYXBwX2lkIjoidGlsZWNoYXQiLCJpYXQiOjE2ODQ3NjkwNTEsImV4cCI6MTY4NzM2MTA1MSwiYXVkIjpbInJhYmJpdG1xIiwiYWQyOWFlMzYtZjgzZC00NDdlLWExOTctZjcwZmQ3ZmEzZWNhIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.XC7TLQsrbYxoyKiCneNrHO_9pKhS_Cx55Maf0RT7o40'
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwOTAyM2JmYS1mZmZlLTRlZmQtYmQ1ZS1lZGExZTM0NTA1NmEiLCJzdWIiOiI2OWE2YjY2OC02YTRmLTQ1NDMtYjVhOS01YjNjMzRkZDk1YWUiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjY5YTZiNjY4LTZhNGYtNDU0My1iNWE5LTViM2MzNGRkOTVhZS4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuNjlhNmI2NjgtNmE0Zi00NTQzLWI1YTktNWIzYzM0ZGQ5NWFlLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy42OWE2YjY2OC02YTRmLTQ1NDMtYjVhOS01YjNjMzRkZDk1YWUuKiIsInJhYmJpdG1xLmNvbmZpZ3VyZToqLyovKiJdLCJjbGllbnRfaWQiOiI2OWE2YjY2OC02YTRmLTQ1NDMtYjVhOS01YjNjMzRkZDk1YWUiLCJjaWQiOiI2OWE2YjY2OC02YTRmLTQ1NDMtYjVhOS01YjNjMzRkZDk1YWUiLCJhenAiOiI2OWE2YjY2OC02YTRmLTQ1NDMtYjVhOS01YjNjMzRkZDk1YWUiLCJ1c2VyX2lkIjoiNjlhNmI2NjgtNmE0Zi00NTQzLWI1YTktNWIzYzM0ZGQ5NWFlIiwiYXBwX2lkIjoidGlsZWNoYXQiLCJpYXQiOjE2ODQ4MzMxOTIsImV4cCI6MTY4NzQyNTE5MiwiYXVkIjpbInJhYmJpdG1xIiwiNjlhNmI2NjgtNmE0Zi00NTQzLWI1YTktNWIzYzM0ZGQ5NWFlIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.-33y3cBb1a0hY4Te-I1doc-MHloFzX-qdml3o3DWXg8'
};

const user2 = {
	userid: 'USER2',
	fullname: 'User 2',
	firstname: 'User',
	lastname: '2',
	token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0NGUzZjdhZC1jNGM1LTQxZmMtOTQzZi0wZjFjZjYwZTBkNDEiLCJzdWIiOiJVU0VSMiIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjIuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVIyLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSMi4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVIyIiwiY2lkIjoiVVNFUjIiLCJhenAiOiJVU0VSMiIsInVzZXJfaWQiOiJVU0VSMiIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjQ0Njc1NzcxLCJleHAiOjE5NTU3MTU3NzEsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVIyIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.NQsVvyrwGaCz9W6vS1-QSPRxBL1b2mPz1ntLtEFJm_A'
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
    APIendpoint: config.API_ENDPOINT
});

// DEPRECATED infos.
// noRequestPerSecond:
// >=95, direct ('messages'+'persist' queues, LOGLEVEL=error), not-passing
// <=105, direct, mean-latency=160 ('messages' queue only, LOGLEVEL=error,prefetch=10)
// <=300, direct, mean-latency=30 ('messages' queue only, LOGLEVEL=error, no-logs in load-http-app, prefetch=50)
// <=350, direct, mean-latency=110 ('messages' queue only, LOGLEVEL=error, no-logs in load-http-app, prefetch=50)

// deprecated
// let EXPECTED_AVG_MESSAGE_DELAY = 160;
// let REQS_PER_SECOND = 340;
// let MAX_SECONDS = 5;
// let CONCURRENCY = 2;

// var host = 'https://loadtest.andreasponziell.repl.co'
// let host = 'http://localhost:3000' // 3002 embedded
let group_id; // got in before()
let group_name; // got in before()

console.log("Executing benchmarks.");
console.log("MQTT endpoint:", config.MQTT_ENDPOINT);
console.log("API endpoint:", config.API_ENDPOINT);

describe("Performance Test", function() {
    before(function(done) {
        this.timeout(20000);
        chatClient1.connect(user1.userid, user1.token, () => {
            console.log("chatClient1 Connected...");
            chatClient2.connect(user2.userid, user2.token, async () => {
                console.log("chatClient2 Connected...");
                group_id = "support-group-" + "64690469599137001a6dc6f5-" + uuidv4().replace(/-+/g, "");
                group_name = "benchmarks group: " + group_id;
                const group_members = {}
                group_members['USER2'] = 1;
                group_members['USER3'] = 1;
                group_members['USER4'] = 1;
                group_members['USER5'] = 1;
                let total_ = 0
                const start_ = Date.now();
                chatClient1.groupCreate(
                    group_name,
                    group_id,
                    group_members,
                    (err, result) => {
                        total_ = Date.now() - start_
                        console.log("TOTAL GROUP CREATION TIME", total_ + "ms")
                        assert(err == null);
                        assert(result != null);
                        assert(result.success == true);
                        assert(result.group.name === group_name);
                        assert(result.group.members != null);
                        assert(result.group.members[user1.userid] == 1);
                        assert(result.group.members['USER2'] == 1);
                        assert(result.group.members['USER3'] == 1);
                        assert(result.group.members['USER4'] == 1);
                        assert(result.group.members['USER5'] == 1);
                        console.log("before() - Group created:", result.group.name);
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
                            // assert(json.result.members[user1.userid] != null);
                            // assert(json.result.members[user2.userid] != null);
                            assert(json.result.members[user1.userid] == 1);
                            assert(json.result.members['USER2'] == 1);
                            assert(json.result.members['USER3'] == 1);
                            assert(json.result.members['USER4'] == 1);
                            assert(json.result.members['USER5'] == 1);
                            //console.log("before() - assertions ok -> done()");
                            done();
                        });
                    }
                );
            });
        });
	});
	
	after(function(done) {
        chatClient1.close(() => {
            chatClient2.close(() => {
                done();
            });
        });
	});

    it("Benchmark for group messages", function(done) {
        this.timeout(1000 * 700000);

        async function benchmark() {
            console.log("\n\n****************************************************");
            console.log("********* Support Group messages benchmark *********");
            console.log("****************************************************\n\n");
            total_delay = 0;
            total_messages = 0;
            let delay = 1000 / config.REQS_PER_SECOND;
            let total_iterations = config.REQS_PER_SECOND * config.MAX_SECONDS;
            let test_start_time = Date.now();
            let current = 0;
            console.log("Group - Expected message average latency to be <", config.EXPECTED_AVG_DIRECT_MESSAGE_DELAY + "ms");
            console.log("Group - Expected CONCURRENCY (#VIRTUAL USERs aka VUs) =", config.CONCURRENCY);
            console.log("Group - Expected MESSAGES/SEC =", config.REQS_PER_SECOND * config.CONCURRENCY);
            console.log("Group - Expected MESSAGES/SEC/VU =", config.REQS_PER_SECOND);
            console.log("Group - Expected TEST DURATION (s) =", config.MAX_SECONDS);
            console.log("Group - Expected DELAY BETWEEN MESSAGES (ms) =", delay);
            console.log("Group - Expected TOTAL ITERATIONS =", total_iterations);
            console.log("Group - Running benchmark...");
            for (let i = 0; i < total_iterations; i++) {
                // console.log("GROUP i:", i)
                for (let c = 0; c < config.CONCURRENCY; c++) {
                    // console.log("c", c)
                    let recipient_id = group_id;
                    let recipient_fullname = group_name;
                    sendMessage(i, c, recipient_id, recipient_fullname, async function(latency, iteration, concurrent_iteration) {
                        console.log("Group", i, "- latency/meanLatency:", latency.latencyMs + "/" + Math.round(latency.meanLatencyMs));
                        if (iteration == total_iterations - 1 && concurrent_iteration == config.CONCURRENCY - 1) {
                            endCallback(latency);
                            console.log("'Group' benchmark end.");
                            done();
                        }
                    });
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                current = Date.now() - test_start_time;
            }

            function endCallback(latency) {
                console.log("\n\n********* Group - Benchmark results *********");
                console.log("Group - Final latency:", latency.meanLatencyMs);
                console.log("Group - Expected max average latency:", config.EXPECTED_AVG_GROUP_MESSAGE_DELAY);
                let test_duration = Math.round(current / 1000)
                console.log("Group - Test duration:", test_duration + " seconds" + " (" + current + ") ms");
                let mesg_sec = Math.round(latency.totalMessages / test_duration)
                console.log("Group - MESSAGES/SEC:", mesg_sec);
                if (latency.meanLatencyMs > config.EXPECTED_AVG_GROUP_MESSAGE_DELAY) {
                    console.error("Warning: final mean latency " + latency.meanLatencyMs + " is greater then expected (" + config.EXPECTED_AVG_GROUP_MESSAGE_DELAY + ")")
                }
                else {
                    console.log("Group messages benchmark performed good! 😎");
                }
                // assert(latency.meanLatencyMs < config.EXPECTED_AVG_GROUP_MESSAGE_DELAY);
                
                // (latency.meanLatencyMs).should.be.below(config.EXPECTED_AVG_GROUP_MESSAGE_DELAY);
            }
        }
        benchmark();
    });
});

let total_messages = 0;
let total_delay = 0;
function sendMessage(iteration, concurrent_iteration, recipient_id, recipient_fullname, callback) {
    let starttime = Date.now();
    const sent_message = "Performance-test-" + uuidv4();
    let handler = chatClient2.onMessageAdded((message, topic) => {
        // console.log("******** message added:", message);
        // console.log("callback2")
        if (
            message &&
            message.text === sent_message
        ) {
            // console.log("message received: " + sent_message);
            let endtime = Date.now();
            let delay = endtime - starttime;
            // console.log("message received:", sent_message, "after: " + delay + " ms");
            // TEST
            // if (APP_start_time == 0) {
            //     APP_start_time = Date.now();
            // }
            total_messages++;
            // current = Date.now() - APP_start_time;
            total_delay += delay;
            // console.log("total:", total_delay)
            let mean = total_delay / total_messages
            // console.log("total_messages N:", total_messages, "currentTimeMs:", current, "meanMs:", Math.floor(mean));
            let latency_info = {
                totalMessages: total_messages,
                latencyMs: delay,
                meanLatencyMs: mean
            };
            callback(latency_info, iteration, concurrent_iteration);
            chatClient2.removeOnMessageAddedHandler(handler);
        }
    });

    
    // console.log("handler:", handler);
    // console.log("client1:", chatClient1);
    
    sendSupportMessage( {
        text: sent_message
    }, (err, msg) => {
            if (err) {
                console.error("Error send:", err);
            }
        }
    );
}

function sendSupportMessage(APIURL, projectId, requestId, message, jwt_token, callback) {
    
    const url = `${APIURL}/${projectId}/requests/${requestId}/messages`;
    const HTTPREQUEST = {
        url: url,
        headers: {
            'Content-Type' : 'application/json',
            'Authorization': jwt_token
        },
        json: message,
        method: 'POST',
        httpsOptions: this.httpsOptions
    };
    myrequest(
        HTTPREQUEST,
        function(err, resbody) {
            if (err) {
            if (callback) {
                callback(err);
            }
            }
            else {
            if (callback) {
                callback(null, resbody);
            }
            }
        },
        true
    );
  }

  function sendMessageChat21(APIURL, projectId, requestId, message, jwt_token, callback) {
    // {
    //     "sender_fullname": "Andrea Sponziello",
    //     "recipient_id": "support-group-64690469599137001a6dc6f5-00071",
    //     "recipient_fullname": "Test Group 00071",
    //     "text": "/start",
    //     "type": "text",
    //     "channel_type": "group",
    //     "attributes": {
    //         "client": "",
    //         "sourcePage": "",
    //         "userEmail": "",
    //         "userFullname": "",
    //         "projectId": "5eff5a6d81e73800190af221"
    //     }
    // }
    const url = `${APIURL}/${requestId}/messages`;
    const HTTPREQUEST = {
        url: url,
        headers: {
            'Content-Type' : 'application/json',
            'Authorization': jwt_token
        },
        json: message,
        method: 'POST',
        httpsOptions: this.httpsOptions
    };
    myrequest(
        HTTPREQUEST,
        function(err, resbody) {
            if (err) {
            if (callback) {
                callback(err);
            }
            }
            else {
            if (callback) {
                callback(null, resbody);
            }
            }
        },
        true
    );
  }

  function myrequest(options, callback, log) {
    if (log) {
      console.log("** API URL:", options.url);
      console.log("** Options:", JSON.stringify(options));
    }
    let axios_settings = {
      url: options.url,
      method: options.method,
      data: options.json,
      params: options.params,
      headers: options.headers
    }
    // console.log("options.url.startsWith(https:)", options.url.startsWith("https:"))
    // console.log("this.httpsOptions", this.httpsOptions)
    
    if (options.url.startsWith("https:") && options.httpsOptions) {
      // console.log("Tiledesk Client v 0.9.x: url.startsWith https: && httpsOptions");
      const httpsAgent = new https.Agent(options.httpsOptions);
      axios_settings.httpsAgent = httpsAgent;
    }
    else if (options.url.startsWith("https:") && !options.httpsOptions) {
      // HTTPS default is rejectUnauthorized: false
      // console.log("Tiledesk Client v 0.9.x: url.startsWith https: && NOT httpsOptions");
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false,
      });
      axios_settings.httpsAgent = httpsAgent;
    }
    axios(axios_settings)
    .then(function (res) {
      if (log) {
        console.log("Response for url:", options.url);
        console.log("Response headers:\n", JSON.stringify(res.headers));
        //console.log("******** Response for url:", res);
      }
      if (res && res.status == 200 && res.data) {
        if (callback) {
          callback(null, res.data);
        }
      }
      else {
        if (callback) {
          callback(TiledeskClient.getErr({message: "Response status not 200"}, options, res), null, null);
        }
      }
    })
    .catch(function (error) {
      if (callback) {
        callback(error, null, null);
      }
    });
  }