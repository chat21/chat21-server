// var loadtest = require('loadtest');
var assert = require('assert');
var should = require('should');
// let express = require('express');
// var http = require('http');
const { send } = require('process');
const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
const { Console } = require('console');

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
    REQS_PER_SECOND: 60,
    MAX_SECONDS: 120,
    CONCURRENCY: 1, // 2
    //API_SERVER_HOST: 'localhost',
    //API_SERVER_PORT: 8004,
    // MQTT_ENDPOINT: 'wss://console.native.tiledesk.com/ws',
    // API_ENDPOINT: 'https://console.native.tiledesk.com/chatapi/api',
    // LOCAL
    //MQTT_ENDPOINT: 'ws://localhost:15675/ws',
    //API_ENDPOINT: 'http://localhost:8004/api',
    // REMOTE
    MQTT_ENDPOINT: 'ws://34.106.191.96/mqws/ws',
    API_ENDPOINT: 'http://34.106.191.96/chatapi/api',
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
	userid: 'USER1',
	fullname: 'User 1',
	firstname: 'User',
	lastname: '1',
	token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2OGFkODJjYi1lODE2LTRkYWEtYjljYi0wM2NiZmFjMDY1OGQiLCJzdWIiOiJVU0VSMSIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjEuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVIxLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSMS4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVIxIiwiY2lkIjoiVVNFUjEiLCJhenAiOiJVU0VSMSIsInVzZXJfaWQiOiJVU0VSMSIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjQ0Njc1NzcxLCJleHAiOjE5NTU3MTU3NzEsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVIxIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.CrvQLL3DMydcRyLSyfyJBSdyG-HKDj5Pd8kA1UIPjQA'
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


describe("Performance Test", function() {
    before(function(done) {
        this.timeout(5000);
        chatClient1.connect(user1.userid, user1.token, () => {
            console.log("chatClient1 Connected...");
            chatClient2.connect(user2.userid, user2.token, async () => {
                console.log("chatClient2 Connected...");
                group_id = "group-" + uuidv4().replace("-", "");
                group_name = "benchmarks group " + group_id;
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
                        console.log("TOTAL GROUP CREATION TIME", total_ + "ms")
                        assert(err == null);
                        assert(result != null);
                        assert(result.success == true);
                        assert(result.group.name === group_name);
                        assert(result.group.members != null);
                        assert(result.group.members[user2.userid] == 1);
                        // console.log("before() - Group created:", result.group.name);
                        chatClient1.groupData(group_id, (err, json) => {
                            // console.log("before() - Verified group updated:", group_id, "data:", json);
                            console.log("groupData:", json)
                            assert(err == null);
                            assert(json != null);
                            assert(json.success == true);
                            assert(json.result != null);
                            assert(json.result.uid === group_id);
                            assert(json.result.owner === user1.userid);
                            assert(json.result.members != null);
                            assert(json.result.members[user1.userid] != null);
                            assert(json.result.members[user2.userid] != null);
                            console.log("before() - assertions ok -> done()");
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

    it("Benchmark for direct messages", function(done) {
        console.log("..................::::::::::::::::")
        this.timeout(1000 * 70);
        async function benchmark() {
            console.log("\n\n*********************************************");
            console.log("********* Direct messages benchmark *********");
            console.log("*********************************************\n\n");
            total_delay = 0;
            total_messages = 0;
            let delay = 1000 / config.REQS_PER_SECOND;
            let total_iterations = config.REQS_PER_SECOND * config.MAX_SECONDS;
            let test_start_time = Date.now();
            let current = 0;
            console.log("Direct - Expected message average latency to be <", config.EXPECTED_AVG_DIRECT_MESSAGE_DELAY + "ms");
            console.log("Direct - Expected MESSAGES/SEC =", config.REQS_PER_SECOND * config.CONCURRENCY);
            console.log("Direct - Expected MESSAGES/SEC/VU =", config.REQS_PER_SECOND);
            console.log("Direct - Expected TEST DURATION (s) =", config.MAX_SECONDS);
            console.log("Direct - Expected CONCURRENCY (#VUs) =", config.CONCURRENCY);
            console.log("Direct - Expected DELAY BETWEEN MESSAGES (ms) =", delay);
            console.log("Direct - Expected TOTAL ITERATIONS =", total_iterations);
            console.log("Direct - Running benchmark...");
            
            for (let i = 0; i < total_iterations; i++) {
                for (let c = 0; c < config.CONCURRENCY; c++) {
                    let recipient_id = user2.userid;
                    let recipient_fullname = user2.fullname;
                    // console.log("sending...",i,c);
                    sendMessage(i, c, recipient_id, recipient_fullname, async function(latency, iteration, concurrent_iteration) {
                        // console.log("Direct - latency:", latency)
                        if (iteration == total_iterations - 1 && concurrent_iteration == config.CONCURRENCY - 1) {
                            endCallback(latency);
                            console.log("'Direct' benchmark end.");
                            done();
                        }
                    });
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                current = Date.now() - test_start_time;
            }
            console.log("End 'Direct' benchmark iterations.");

            function endCallback(latency) {
                console.log("\n\n********* Direct - Benchmark results *********");
                console.log("Direct - Message mean latency:", latency.meanLatencyMs);
                let test_duration = Math.round(current / 1000)
                console.log("Direct - Test duration:", test_duration + " seconds" + " (" + current + ") ms");
                let mesg_sec = Math.round(latency.totalMessages / test_duration)
                console.log("Direct - MESSAGES/SEC:", mesg_sec);
                if (latency.meanLatencyMs > config.EXPECTED_AVG_DIRECT_MESSAGE_DELAY) {
                    console.error("Warning: final mean latency " + latency.meanLatencyMs + " is greater then expected (" + config.EXPECTED_AVG_DIRECT_MESSAGE_DELAY + ")")
                }
                else {
                    console.log("Direct messages benchmark performed good! 😎");
                }
                // (latency.meanLatencyMs).should.be.below(config.EXPECTED_AVG_DIRECT_MESSAGE_DELAY);
            }
        }
        benchmark();
    });

    it("Benchmark for group messages", function(done) {
        this.timeout(1000 * 70);

        async function benchmark() {
            console.log("\n\n********************************************");
            console.log("********* Group messages benchmark *********");
            console.log("********************************************\n\n");
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
                        // console.log("Group - latency:", latency)
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
    const sent_message = uuidv4();
    let handler = chatClient2.onMessageAdded((message, topic) => {
        // console.log("user2 message added:", message.text);
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
    
    chatClient1.sendMessage(
        sent_message,
        'text',
        recipient_id, //user2.userid, // recipient
        recipient_fullname, //user2.fullname, // recipient fullname
        user1.fullname, // sender fullname
        null,
        null,
        recipient_id.startsWith("group-") ? 'group' : 'direct', //user2.userid.startsWith("group-") ? 'group' : 'direct',
        (err, msg) => {
            if (err) {
                console.error("Error send:", err);
            }
            // else {
            //     console.log("Message sent:", msg.text);
            // }
        }
    );
}



