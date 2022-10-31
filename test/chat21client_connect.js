var assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
var chat21HttpServer = require('@chat21/chat21-http-server');
let observer = require('../index').observer;
let express = require('express');
//const { Logger } = require('mongodb');
const loggers = require('../tiledesk-logger');
let logger = new loggers.TiledeskLogger("debug");
// logger.setLog('DEBUG');
// let bodyParser = require('body-parser');
const bodyParser = require('body-parser');
const messageConstants = require('../models/messageConstants.js');

const user1 =  { userid: 'USER1',
  fullname: 'User 1',
  firstname: 'User',
  lastname: '1',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxNzkwNDBkNy00NzdiLTQ5NmUtYjA0NS0zMTdhM2JiYzY4NjUiLCJzdWIiOiJVU0VSMSIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjEuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVIxLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSMS4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVIxIiwiY2lkIjoiVVNFUjEiLCJhenAiOiJVU0VSMSIsInVzZXJfaWQiOiJVU0VSMSIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjM5MjE0NDE4LCJleHAiOjE5NTAyNTQ0MTgsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVIxIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.0qLEOVWY0iN7polG9HU33yC7YHRmFNkB1WPruXmHxJ8'
}

const user2 =  {
  userid: 'USER2',
  fullname: 'User 2',
  firstname: 'User',
  lastname: '2',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzMWY0NGFmMy0zOGVmLTRkZmMtODM2Yi05YTI5ZjQ3Y2VmMTgiLCJzdWIiOiJVU0VSMiIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjIuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVIyLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSMi4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVIyIiwiY2lkIjoiVVNFUjIiLCJhenAiOiJVU0VSMiIsInVzZXJfaWQiOiJVU0VSMiIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjM5MjE0NDE4LCJleHAiOjE5NTAyNTQ0MTgsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVIyIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.zARfYud7bbRIfK4l9rFrHVrXA6CRlTcol_KJv9yL1q4'
}



let local_stack = true;
if (process.env && process.env.TEST_LOCAL_STACK === undefined) {
	local_stack = true;
}
else if (process.env && process.env.TEST_LOCAL_STACK === 'false') {
	local_stack = false;
}

let client_api_log = true;
if (process.env && process.env.TEST_CLIENT_API_LOG !== 'true') {
	client_api_log = false;
}
console.log("client_api_log:", client_api_log);

// ** ALL-IN-ONE
// ** RABBITMQ, RUN IT WITH DOCKER
// ** RUN LOCAL MONGODB, EX: mongod --dbpath /usr/local/var/mongodb
/* example .env conf
TEST_APPID="tilechat"
TEST_MQTT_ENDPOINT=ws://localhost:15675/ws
TEST_API_ENDPOINT=http://localhost:8010/api
TEST_CLIENT_API_LOG=false
TEST_HTTP_SERVER_LOG_LEVEL=error
TEST_OBSERVER_LOG_LEVEL=error
TEST_LOCAL_STACK=true
*/
const config = {
	APPID: process.env.TEST_APPID || 'tilechat',
	MQTT_ENDPOINT: process.env.TEST_MQTT_ENDPOINT || 'ws://localhost:15675/ws',
	API_ENDPOINT: process.env.TEST_API_ENDPOINT || 'http://localhost:8010/api',
	CLIENT_API_LOG: client_api_log,
	HTTP_SERVER_LOG_LEVEL: process.env.TEST_HTTP_SERVER_LOG_LEVEL || 'error',
	OBSERVER_LOG_LEVEL: process.env.TEST_OBSERVER_LOG_LEVEL || 'error',
	LOCAL_STACK: local_stack
}

// ** **LOCAL MACHINE COMPONENTS ****
// ** RABBITMQ, RUN IT WITH DOCKER
// ** RUN LOCAL MONGODB, EX: mongod --dbpath /usr/local/var/mongodb
// ** RUN LOCAL CHAT-HTTP-SERVER ON "API_ENDPOINT"
// ** RUN LOCAL CHAT-OBSERVER (ENSURE: ONLY ONE INSTANCE!)
// const config = {
// 	APPID: 'tilechat',
// 	MQTT_ENDPOINT: 'ws://localhost:15675/ws',
// 	API_ENDPOINT: 'http://localhost:8004/api',
// 	CLIENT_API_LOG: false,
// 	HTTP_SERVER_LOG_LEVEL: 'ERROR',
// 	OBSERVER_LOG_LEVEL: 'ERROR',
// 	LOCAL_STACK: false
// }

// DEPRECATED
// const MQTT_ENDPOINT = 'ws://localhost:15675/ws';
// const API_ENDPOINT = 'http://localhost:8004/api'
// const CLIENT_API_LOG = false;
// const HTTP_SERVER_LOG_LEVEL = 'ERROR';
// const OBSERVER_LOG_LEVEL = 'ERROR';
// LOCAL_STACK = false;

// **** REMOTE ON AWS ****
// const MQTT_ENDPOINT = 'ws://99.80.197.164:15675/ws';
// const API_ENDPOINT = 'http://99.80.197.164:8004/api';
// const CLIENT_API_LOG = false;
// LOCAL_STACK = false

// const APPID = 'tilechat';
const TYPE_TEXT = 'text';
const CHANNEL_TYPE_GROUP = 'group';
const CHANNEL_TYPE_DIRECT = 'direct';

let chatClient1;

console.log(`



************************************************************
************************************************************
************************************************************
************************************************************
************************************************************
**************                           *******************
************** BEFORE STARTING TAKE CARE *******************
**************                           *******************
                                         *******************
SHUT DOWN ANY LOCAL STANDALONE COMPONENT *******************
OF THE CHAT21 INFRASTRUCTURE             *******************
(I.E. CHATSERVERMQ, CHAT21HTTP ETC.)     *******************
YOU ONLY NEED TO START                   *******************
- RABBITMQ                               *******************
- MONGODB                                *******************
************************************************************
************************************************************
************************************************************
************************************************************
************************************************************
************************************************************
************************************************************
************************************************************`);

describe('Main', function() {
	before(function(done) {
		logger.log("before...");
		done();
	});
	
	after(function(done) {
		logger.log("after...");
		done();
	});
  
	beforeEach(function() {
	  // runs before each test in this block
	});
  
	afterEach(function() {
	  // runs after each test in this block
	});
  
	// *********************************************
	// **************** TEST CASES *****************
    // *********************************************

	describe('TiledeskClient - test 0', function() {
		it('Test 0', function(done) {
			logger.log("test 0 - start.");
			done();
		});
	});

	describe('TiledeskClient - Connect/Disconnect', function() {
		
		it('User1 successfully connects, then diconnects.', function(done) {
			logger.log("test 1 - connect()");
			chatClient1 = new Chat21Client(
				{
					appId: config.APPID,
					MQTTendpoint: config.MQTT_ENDPOINT,
					APIendpoint: config.API_ENDPOINT,
					log: config.CLIENT_API_LOG
				}
			);
			chatClient1.connect(user1.userid, user1.token, () => {
				logger.log("(test 1) chatClient1 connected.");
				chatClient1.close(async () => {
					logger.log("(test 1) chatClient1 disconnected.");
					done();
				});
			});
		});
	});

	/* Error wrong connection token is not supported */
	// it('User1 unsuccessfully connects, using the wrong token.', function(done) {
	// 	logger.log("test 2 - connect()");
	// 	chatClient1 = new Chat21Client(
	// 		{
	// 			appId: config.APPID,
	// 			MQTTendpoint: config.MQTT_ENDPOINT,
	// 			APIendpoint: config.API_ENDPOINT,
	// 			log: config.CLIENT_API_LOG
	// 		}
	// 	);
	// 	chatClient1.connect(user1.userid, "AAAA", () => {
	// 		logger.log("(test 1) chatClient1 connected.");
	// 		done();
	// 	});
	// });

});