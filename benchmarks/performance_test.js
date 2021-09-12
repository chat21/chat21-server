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
    REQS_PER_SECOND: 20, // 320
    MAX_SECONDS: 1, //5
    CONCURRENCY: 1, // 2
    API_SERVER_HOST: 'localhost',
    API_SERVER_PORT: 8004,
    MQTT_ENDPOINT: 'ws://localhost:15675/ws',
    API_ENDPOINT: 'http://localhost:8004/api',
    APPID: 'tilechat'
}

const user1 = {
	userid: 'USER1',
	fullname: 'User 1',
	firstname: 'User',
	lastname: '1',
	token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2NzI5NDc4ZS1mOWIwLTRiODctYjNhYS03ZjU1OWExNzc5YjIiLCJzdWIiOiJVU0VSMSIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjEuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVIxLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiVVNFUjEiLCJjaWQiOiJVU0VSMSIsImF6cCI6IlVTRVIxIiwidXNlcl9pZCI6IlVTRVIxIiwiYXBwX2lkIjoidGlsZWNoYXQiLCJpYXQiOjE2MjM3Njc1MjAsImV4cCI6MTkzNDgwNzUyMCwiYXVkIjpbInJhYmJpdG1xIiwiVVNFUjEiXSwia2lkIjoidGlsZWRlc2sta2V5IiwidGlsZWRlc2tfYXBpX3JvbGVzIjoidXNlciJ9.r-GBXo1fIUtl1QjOkXxcRaenVNQBElRkus3omh9YtjQ'
};

const user2 = {
	userid: 'USER2',
	fullname: 'User 2',
	firstname: 'User',
	lastname: '2',
	token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0MmEwMjc2ZC1lODUzLTQ5YjMtOTU4ZS0xODBkMjFjZGZjNWMiLCJzdWIiOiJVU0VSMiIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjIuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVIyLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiVVNFUjIiLCJjaWQiOiJVU0VSMiIsImF6cCI6IlVTRVIyIiwidXNlcl9pZCI6IlVTRVIyIiwiYXBwX2lkIjoidGlsZWNoYXQiLCJpYXQiOjE2MjM3Njc1MjAsImV4cCI6MTkzNDgwNzUyMCwiYXVkIjpbInJhYmJpdG1xIiwiVVNFUjIiXSwia2lkIjoidGlsZWRlc2sta2V5IiwidGlsZWRlc2tfYXBpX3JvbGVzIjoidXNlciJ9.Zkbr3e9MfGGDKRdVUyG4330LxeNaKYS0y3upPtS4Wgg'
};

const user3 = {
	userid: 'USER3',
 	fullname: 'User 3',
 	firstname: 'User',
 	lastname: '3',
 	token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlMmI2Y2RhMi0yNjhmLTQxZDMtYjBjYy1kZWNjN2I0M2UwMjEiLCJzdWIiOiJVU0VSMyIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjMuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVIzLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiVVNFUjMiLCJjaWQiOiJVU0VSMyIsImF6cCI6IlVTRVIzIiwidXNlcl9pZCI6IlVTRVIzIiwiYXBwX2lkIjoidGlsZWNoYXQiLCJpYXQiOjE2MjM3Njc1MjAsImV4cCI6MTkzNDgwNzUyMCwiYXVkIjpbInJhYmJpdG1xIiwiVVNFUjMiXSwia2lkIjoidGlsZWRlc2sta2V5IiwidGlsZWRlc2tfYXBpX3JvbGVzIjoidXNlciJ9.-Cio8ITPCQswv_4KnxJrRbm-5RCXMefuT91wWUNZJmU'
};

let chatClient1 = new Chat21Client(
{
    appId: config.APPID,
    MQTTendpoint: config.MQTT_ENDPOINT,
    APIendpoint: config.API_ENDPOINT
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
        chatClient1.connect(user1.userid, user1.token, () => {
            console.log("chatClient1 Connected...");
            chatClient2.connect(user2.userid, user2.token, async () => {
                console.log("chatClient2 Connected...");
                group_id = "group-" + uuidv4().replace("-", "");
                group_name = "benchmarks group " + group_id;
                const group_members = {}
                group_members[user2.userid] = 1;
                chatClient1.groupCreate(
                    group_name,
                    group_id,
                    group_members,
                    (err, result) => {
                        assert(err == null);
                        assert(result != null);
                        assert(result.success == true);
                        assert(result.group.name === group_name);
                        assert(result.group.members != null);
                        assert(result.group.members[user2.userid] == 1);
                        console.log("before() - Group created:", result.group.name);
                        chatClient1.groupData(group_id, (err, json) => {
                            // console.log("before() - Verified group updated:", group_id, "data:", json);
                            assert(err == null);
                            assert(json != null);
                            assert(json.success == true);
                            assert(json.result != null);
                            assert(json.result.uid === group_id);
                            assert(json.result.owner === user1.userid);
                            assert(json.result.members != null);
                            assert(json.result.members[user1.userid] != null);
                            assert(json.result.members[user2.userid] != null);
                            // console.log("before() - assertions ok -> done()");
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
                console.log("Clients connections closed.");
                done();
            });
        });
	});

    it("Benchmark for direct messages", function(done) {
        this.timeout(1000 * 70);
        
        // chatClient1.connect(user1.userid, user1.token, () => {
        //     console.log("chatClient1 Connected...");
        //     chatClient2.connect(user2.userid, user2.token, async () => {
        //         console.log("chatClient2 Connected...");
            async function benchmark() {
                let delay = 1000 / config.REQS_PER_SECOND;
                let total_iterations = config.REQS_PER_SECOND * config.MAX_SECONDS;
                let APP_start_time = Date.now();
                let current = 0;
                console.log("Direct - message average latency is expected to be <", config.EXPECTED_AVG_DIRECT_MESSAGE_DELAY + "ms");
                console.log("Direct - MESSAGES/SEC =", config.REQS_PER_SECOND * config.CONCURRENCY);
                console.log("Direct - MESSAGES/SEC/VU =", config.REQS_PER_SECOND);
                console.log("Direct - TEST DURATION (s) =", config.MAX_SECONDS);
                console.log("Direct - CONCURRENCY (#VUs) =", config.CONCURRENCY);
                console.log("Direct - DELAY BETWEEN MESSAGES (ms) =", delay);
                console.log("Direct - TOTAL ITERATIONS =", total_iterations);
                
                for (let i = 0; i < total_iterations; i++) {
                    console.log("DIRECT i:", i)
                    for (let c = 0; c < config.CONCURRENCY; c++) {
                        let recipient_id = user2.userid;
                        let recipient_fullname = user2.fullname;
                        sendMessage(i, c, recipient_id, recipient_fullname, async function(latency, iteration, concurrent_iteration) {
                            console.log("Direct - latency:", latency)
                            if (iteration == total_iterations - 1 && concurrent_iteration == config.CONCURRENCY - 1) {
                                endCallback(latency);
                                console.log("'Direct' benchmark end.");
                                done();
                            }
                        });
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                    current = Date.now() - APP_start_time;
                }
                
                function endCallback(latency) {
                    console.log("Direct - Final latency:", latency);
                    console.log("Direct - Test duration:", Math.round(current / 1000) + " seconds" + " (" + current + ") ms");
                    (latency.meanLatencyMs).should.be.below(config.EXPECTED_AVG_DIRECT_MESSAGE_DELAY);
                }
            }
            benchmark();
        //     });
        // });
    });

    it("Benchmark for group messages", function(done) {
        this.timeout(1000 * 70);
        
        // chatClient1.connect(user1.userid, user1.token, () => {
        //     console.log("chatClient1 Connected...");
        //     chatClient2.connect(user2.userid, user2.token, async () => {
        //         console.log("chatClient2 Connected...");
            async function benchmark2() {
                let delay = 1000 / config.REQS_PER_SECOND;
                let total_iterations = config.REQS_PER_SECOND * config.MAX_SECONDS;
                let APP_start_time = Date.now();
                let current = 0;
                console.log("Group - message average latency is expected to be <", config.EXPECTED_AVG_DIRECT_MESSAGE_DELAY + "ms");
                console.log("Group - CONCURRENCY (#VIRTUAL USERs aka VUs) =", config.CONCURRENCY);
                console.log("Group - MESSAGES/SEC =", config.REQS_PER_SECOND * config.CONCURRENCY);
                console.log("Group - MESSAGES/SEC/VU =", config.REQS_PER_SECOND);
                console.log("Group - TEST DURATION (s) =", config.MAX_SECONDS);
                console.log("Group - DELAY BETWEEN MESSAGES (ms) =", delay);
                console.log("Group - TOTAL ITERATIONS =", total_iterations);
                for (let i = 0; i < total_iterations; i++) {
                    console.log("GROUP i:", i)
                    // console.log("it", i)
                    for (let c = 0; c < config.CONCURRENCY; c++) {
                        // console.log("c", c)
                        let recipient_id = group_id;
                        let recipient_fullname = group_name;
                        sendMessage(i, c, recipient_id, recipient_fullname, async function(latency, iteration, concurrent_iteration) {
                            console.log("Group - latency:", latency)
                            if (iteration == total_iterations - 1 && concurrent_iteration == config.CONCURRENCY - 1) {
                                endCallback(latency);
                                console.log("'Group' benchmark end.");
                                done();
                            }
                        });
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                    current = Date.now() - APP_start_time;
                }
                
                function endCallback(latency) {
                    console.log("Group - Final latency:", latency);
                    console.log("Group - Test duration:", Math.round(current / 1000) + " seconds" + " (" + current + ") ms");
                    (latency.meanLatencyMs).should.be.below(config.EXPECTED_AVG_GROUP_MESSAGE_DELAY);
                }
            }
            benchmark2();
        //     });
        // });
    });
});

let messages = 0;
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
            messages++;
            // current = Date.now() - APP_start_time;
            total_delay += delay;
            // console.log("total:", total_delay)
            let mean = total_delay / messages
            // console.log("message N:", messages, "currentTimeMs:", current, "meanMs:", Math.floor(mean));
            let latency_info = {
                totalMessages: messages,
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
            // console.log("Message sent", msg.text);
        }
    );
}



