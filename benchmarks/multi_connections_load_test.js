// var loadtest = require('loadtest');
var assert = require('assert');
var should = require('should');
const { send } = require('process');
const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
// const { Console } = require('console');

// *******************************
// ******** MQTT SECTION *********
// *******************************

let config = {
    EXPECTED_AVG_DIRECT_MESSAGE_DELAY: 160,
    EXPECTED_AVG_GROUP_MESSAGE_DELAY: 160,
    REQS_PER_SECOND: 2,
    MAX_SECONDS: 5000,
    CONCURRENCY: 1,
    // LOCAL
    //MQTT_ENDPOINT: 'ws://localhost:15675/ws',
    //API_ENDPOINT: 'http://localhost:8004/api',
    // REMOTE
    //MQTT_ENDPOINT: 'ws://34.106.191.96/mqws/ws',
    //API_ENDPOINT: 'http://34.106.191.96/chatapi/api',
    // POWERFUL
    MQTT_ENDPOINT: 'ws://35.198.150.252/mqws/ws',
    API_ENDPOINT: 'http://35.198.150.252/chatapi/api',
    APPID: 'tilechat'
}

const user1 = {
	userid: 'USER1',
	fullname: 'User 1',
	firstname: 'User',
	lastname: '1',
	token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2OGFkODJjYi1lODE2LTRkYWEtYjljYi0wM2NiZmFjMDY1OGQiLCJzdWIiOiJVU0VSMSIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjEuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVIxLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSMS4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVIxIiwiY2lkIjoiVVNFUjEiLCJhenAiOiJVU0VSMSIsInVzZXJfaWQiOiJVU0VSMSIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjQ0Njc1NzcxLCJleHAiOjE5NTU3MTU3NzEsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVIxIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.CrvQLL3DMydcRyLSyfyJBSdyG-HKDj5Pd8kA1UIPjQA'
};

console.log("MQTT multi-connections benchmarks.");
console.log("MQTT endpoint:", config.MQTT_ENDPOINT);

describe("Performance Test", function() {
    // before(function(done) {
    //     this.timeout(20000);
    //     chatClient1.connect(user1.userid, user1.token, () => {
    //         console.log("chatClient1 Connected...");
    //         chatClient2.connect(user2.userid, user2.token, async () => {
    //             console.log("chatClient2 Connected...");
    //         });
    //     });
	// });
	
	// after(function(done) {
	// });

    it("Creating N connections", function(done) {
        this.timeout(7000000);
        async function benchmark() {
            console.log("\n\n**************************************");
            console.log("********* Creating N connections *********");
            console.log("******************************************\n\n");
            let total_connections = 200;
            let delay = 2000;
            for (let i = 0; i < total_connections; i++) {
                console.log("Creating connection:", i);
                let chatClient = new Chat21Client(
                {
                    appId: config.APPID,
                    MQTTendpoint: config.MQTT_ENDPOINT,
                    APIendpoint: config.API_ENDPOINT,
                    log: false
                });
                chatClient.connect(user1.userid, user1.token, () => {
                    console.log("Connection created:", i);
                });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            console.log("All connections created. Waiting.");
            await new Promise(resolve => setTimeout(resolve, 10000000));
        }
        benchmark();
    });

});
