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

const user3 =  {
  userid: 'USER3',
  fullname: 'User 3',
  firstname: 'User',
  lastname: '3',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyM2Q4Yjk3YS1jNzU4LTQxNTUtYTM2NC0wYTZiYjY4OTE5MTIiLCJzdWIiOiJVU0VSMyIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjMuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVIzLioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSMy4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVIzIiwiY2lkIjoiVVNFUjMiLCJhenAiOiJVU0VSMyIsInVzZXJfaWQiOiJVU0VSMyIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjM5MjE0NDE4LCJleHAiOjE5NTAyNTQ0MTgsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVIzIl0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.eS1FVzg5DIfBbRRX08LlmIS1sHm0Lh2HqA1nq3jLwgM'
}

const user4 =  {
  userid: 'USER4',
  fullname: 'User 4',
  firstname: 'User',
  lastname: '4',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlMGM2Y2ZiOC1mODQwLTQxZTYtOWM2OS1mOWE5OTM2OTA3ODkiLCJzdWIiOiJVU0VSNCIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjQuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVI0LioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSNC4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVI0IiwiY2lkIjoiVVNFUjQiLCJhenAiOiJVU0VSNCIsInVzZXJfaWQiOiJVU0VSNCIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjM5MjE0NDE4LCJleHAiOjE5NTAyNTQ0MTgsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVI0Il0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.7bDSCmMYSB8fCFFNuFim846KB_owkIl9oHX32N3j-rs'
}

const user5 =  { userid: 'USER5',
fullname: 'User 5',
firstname: 'User',
lastname: 'Fifth',
token:
 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxMmRkZGNhMi02YmY0LTRmY2UtOGE1OS1hOTY1YmQ3ODMzZTkiLCJzdWIiOiJVU0VSNSIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjUuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVI1LioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSNS4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVI1IiwiY2lkIjoiVVNFUjUiLCJhenAiOiJVU0VSNSIsInVzZXJfaWQiOiJVU0VSNSIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjY2OTg3NTM2LCJleHAiOjE5NzgwMjc1MzYsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVI1Il0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.FZmbVPqdW2pZfTpyJ9y2HqD3GZIOri2kWD5F6SKepEk' }

 const user6 =  { userid: 'USER6',
 fullname: 'User 6',
 firstname: 'User',
 lastname: '6th',
 token:
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMTFjNjM2MC02NDI5LTQyNzYtYjg0Zi1iNjEzMjQ5OTU5YWUiLCJzdWIiOiJVU0VSNiIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjYuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVI2LioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSNi4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVI2IiwiY2lkIjoiVVNFUjYiLCJhenAiOiJVU0VSNiIsInVzZXJfaWQiOiJVU0VSNiIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjY2OTg3NTk5LCJleHAiOjE5NzgwMjc1OTksImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVI2Il0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.tU5qeQvGnrHGvaK3rvUjBG-tAIzKHznsXTQTSGjFgrY' }
const user7 =  { userid: 'USER7',
 fullname: 'User 7',
 firstname: 'User',
 lastname: '7th',
 token:
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYzc0YmE4OS04MTRlLTRhMjYtYWRkMy05YTYyN2YwZThiMjMiLCJzdWIiOiJVU0VSNyIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjcuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVI3LioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSNy4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVI3IiwiY2lkIjoiVVNFUjciLCJhenAiOiJVU0VSNyIsInVzZXJfaWQiOiJVU0VSNyIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjY2OTg3NTk5LCJleHAiOjE5NzgwMjc1OTksImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVI3Il0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.AFiUXZTLlaiGdY9f1qjxwpIZrnLwYwN9htQmHmPW09Y' }
  const user8 =  { userid: 'USER8',
  fullname: 'User 8',
  firstname: 'User',
  lastname: '8th',
  token:
   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyNjE3ZTEzMi1jNWUyLTQ1MWYtYTY5YS0wNWY2YjI3ZmQyM2IiLCJzdWIiOiJVU0VSOCIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjguKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVI4LioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSOC4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVI4IiwiY2lkIjoiVVNFUjgiLCJhenAiOiJVU0VSOCIsInVzZXJfaWQiOiJVU0VSOCIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjY3MDYzNTMwLCJleHAiOjE5NzgxMDM1MzAsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVI4Il0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.DH3HtelGdIk6qlAGFVbzUgj-mJz_AFB2KXYC53KOcvg' }
const user9 =  { userid: 'USER9',
  fullname: 'User 9',
  firstname: 'User',
  lastname: '9th',
  token:
   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI5NTY1Yjg5Mi1hMDI0LTRiNjAtOWY5Ny0xNDljNTUwYzMyNGQiLCJzdWIiOiJVU0VSOSIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjkuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVI5LioiLCJyYWJiaXRtcS53cml0ZToqLyovYXBwcy50aWxlY2hhdC5vdXRnb2luZy51c2Vycy5VU0VSOS4qIiwicmFiYml0bXEuY29uZmlndXJlOiovKi8qIl0sImNsaWVudF9pZCI6IlVTRVI5IiwiY2lkIjoiVVNFUjkiLCJhenAiOiJVU0VSOSIsInVzZXJfaWQiOiJVU0VSOSIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjY3MDYzNTMwLCJleHAiOjE5NzgxMDM1MzAsImF1ZCI6WyJyYWJiaXRtcSIsIlVTRVI5Il0sImtpZCI6InRpbGVkZXNrLWtleSIsInRpbGVkZXNrX2FwaV9yb2xlcyI6InVzZXIifQ.472NDDTcr9gOWP5-pS8FrrLr0XV_hMnzJJ3hAZ7AOT0' }

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
// const config = {
// 	APPID: process.env.TEST_APPID || 'tilechat',
// 	MQTT_ENDPOINT: process.env.TEST_MQTT_ENDPOINT || 'ws://localhost:15675/ws',
// 	API_ENDPOINT: process.env.TEST_API_ENDPOINT || 'http://localhost:8010/api',
// 	CLIENT_API_LOG: client_api_log,
// 	HTTP_SERVER_LOG_LEVEL: process.env.TEST_HTTP_SERVER_LOG_LEVEL || 'error',
// 	OBSERVER_LOG_LEVEL: process.env.TEST_OBSERVER_LOG_LEVEL || 'error',
// 	LOCAL_STACK: local_stack
// }

// ** **LOCAL MACHINE COMPONENTS ****
// ** RABBITMQ, RUN IT WITH DOCKER
// ** RUN LOCAL MONGODB, EX: mongod --dbpath /usr/local/var/mongodb
// ** RUN LOCAL CHAT-HTTP-SERVER ON "API_ENDPOINT"
// ** RUN LOCAL CHAT-OBSERVER (ENSURE: ONLY ONE INSTANCE!)
const config = {
	APPID: 'tilechat',
	MQTT_ENDPOINT: 'ws://localhost:15675/ws',
	API_ENDPOINT: 'http://localhost:8004/api',
	CLIENT_API_LOG: false,
	HTTP_SERVER_LOG_LEVEL: 'ERROR',
	OBSERVER_LOG_LEVEL: 'ERROR',
	LOCAL_STACK: false
}

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
let chatClient2;
let chatClient3;
let http_api_server;
let webhook_app;

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
		console.log("before.....")
		chatClient1 = new Chat21Client(
			{
				appId: config.APPID,
				MQTTendpoint: config.MQTT_ENDPOINT,
				APIendpoint: config.API_ENDPOINT,
				log: config.CLIENT_API_LOG
			}
		);
		chatClient2 = new Chat21Client(
			{
				appId: config.APPID,
				MQTTendpoint: config.MQTT_ENDPOINT,
				APIendpoint: config.API_ENDPOINT,
				log: config.CLIENT_API_LOG
			}
		);
		chatClient3 = new Chat21Client(
			{
				appId: config.APPID,
				MQTTendpoint: config.MQTT_ENDPOINT,
				APIendpoint: config.API_ENDPOINT,
				log: config.CLIENT_API_LOG
			}
		);
		// chatClient4 = new Chat21Client(
		// 	{
		// 		appId: config.APPID,
		// 		MQTTendpoint: config.MQTT_ENDPOINT,
		// 		APIendpoint: config.API_ENDPOINT,
		// 		log: config.CLIENT_API_LOG
		// 	}
		// );
		chatClient1.connect(user1.userid, user1.token, () => {
			console.log("chatClient1 Connected...");
			chatClient2.connect(user2.userid, user2.token, () => {
				console.log("chatClient2 Connected...");
				chatClient3.connect(user3.userid, user3.token, async () => {
					console.log("chatClient3 Connected...");
					// chatClient4.connect(user4.userid, user4.token, async () => {
					// 	logger.log("chatClient4 Connected...");
						// **************************
						// STARTS ALL STACK:
						// 0. RABBITMQ (start separately with docker)
						// 1. HTTP-API-SERVER
						// 2. OBSERVER
						// 3. WEBHOOK ENDPOINT APPLICATION
						// **************************
						if (config.LOCAL_STACK) {
							console.log("local stack")
							chat21HttpServer.logger.setLog(config.HTTP_SERVER_LOG_LEVEL);
							http_api_server = chat21HttpServer.app.listen(8010, async() => {
								console.log('HTTP server started.');
								console.log('Starting AMQP publisher...');
								await chat21HttpServer.startAMQP(
									{
										rabbitmq_uri: process.env.RABBITMQ_URI,
										mongodb_uri: process.env.MONGODB_URI
									}
								);
								console.log('HTTP server AMQP connection started.');
								observer.logger.setLog(config.OBSERVER_LOG_LEVEL);//(config.OBSERVER_LOG_LEVEL);
								// const webhook_endpoints = ["http://localhost:8002/postdata","http://localhost:8002/postdata2"];
								// observer.setWebHookEndpoints();
								observer.setWebHookEnabled(true);
								// observer_config = {rabbitmq_uri: process.env.RABBITMQ_URI};
								observer.setAutoRestart(false);
								console.log("Starting observer...");
								await observer.startServer(
									{
										rabbitmq_uri: process.env.RABBITMQ_URI,
										mongodb_uri: process.env.MONGODB_URI,
										redis_enabled: process.env.CHAT21OBSERVER_CACHE_ENABLED,
										redis_host: process.env.CHAT21OBSERVER_REDIS_HOST,
										redis_port: process.env.CHAT21OBSERVER_REDIS_PORT
									}
								);
								console.log("Ready to start tests in 2 seconds...");
								await new Promise(resolve => setTimeout(resolve, 2000));
								console.log("Observer ready...");
								done();
							});
						}
						else {
							done();
						}
					// });
				});
			});
		});
	});
	
	after(function(done) {
		logger.log("after - Ending test...");
		chatClient1.close(async () => {
			logger.log("after - ...chatClient1 successfully disconnected.");
			chatClient2.close(async () => {
				logger.log("after - ...chatClient2 successfully disconnected.");
				chatClient3.close(async () => {
					logger.log("after - ...chatClient3 successfully disconnected.");
					// chatClient4.close(async () => {
						// logger.log("after - ...chatClient4 successfully disconnected.");
						if (config.LOCAL_STACK) {
							http_api_server.close(async () => {
								logger.log("after - HTTP Server closed.");
								logger.log("after - Waiting 2s before stopping observer (allowing completion of pending publish->ack).");
								await new Promise(resolve => setTimeout(resolve, 2000));
								observer.stopServer(async () => {
									logger.log("after - Connection to AMQP closed.");
									logger.log("after - Waiting 2s after observer stop.");
									await new Promise(resolve => setTimeout(resolve, 2000));
									done();
								});
							});
						}
						else {
							logger.log("after() - end.");
							done();
						}
					// });
				});
			});
		});
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

	describe('TiledeskClient - Webhooks _test 14_', function() {
		it('test 14 - "message-sent" webhook event, 1 endpoint \
REUSE SHARED CHAT CLIENTS', function(done) {
			if (!config.LOCAL_STACK) {
				logger.log("LOCAL_STACK=false, skipping webhooks test 14");
				done();
				return;
			}
			logger.log("test 14 - start.");
			let SENT_MESSAGE = 'MESSAGE TEST 14';
			observer.setWebHookEndpoints(["http://localhost:10456/postdata3"]);
			// observer.setWebHookEnabled(true);
			let webhooksServer = express();
			webhooksServer.use(bodyParser.json());
			logger.log('setWebHookEndpoint ok.');
			webhooksServer.post('/postdata3', function (req, res) {
				logger.log("test 14 - message-sent received:", req.body);
				res.status(200).send({success: true});
				if (req.body.event_type === messageConstants.WEBHOOK_EVENTS.MESSAGE_SENT &&
					req.body.data.text === SENT_MESSAGE) {
					done();
					// observer.setWebHookEnabled(false);
					observer.setWebHookEndpoints(null);
					webhook_app.close();
				}
			});
			let webhook_app = webhooksServer.listen(10456, async function() {
				logger.log('test 14 - Webhooks App started.', webhook_app.address());
				chatClient1.sendMessage(
					SENT_MESSAGE,
					TYPE_TEXT,
					user2.userid,
					user2.fullname,
					user1.fullname,
					null,
					null,
					CHANNEL_TYPE_DIRECT,
					() => {
						logger.log("Message sent:", SENT_MESSAGE);
					}
				);
			});
		});
	});


	describe('TiledeskClient - Webhooks _test 16_', function() {
		it('test 16 - "message-sent" webhook event, 2 endpoints', function(done) {
			if (!config.LOCAL_STACK) {
				console.log("LOCAL_STACK=false, skipping webhooks test 16");
				done();
				return;
			}
			console.log("test 16 - start.");
			let _chatClient4 = new Chat21Client(
				{
					appId: config.APPID,
					MQTTendpoint: config.MQTT_ENDPOINT,
					APIendpoint: config.API_ENDPOINT,
					log: true //config.CLIENT_API_LOG
				}
			);
			observer.setWebHookEndpoints(
				[
					"http://localhost:10456/delivered-endpoint",
					"http://localhost:10456/sent-endpoint"
				]
			);
			observer.setWebHookEvents(
				[
					messageConstants.WEBHOOK_EVENTS.MESSAGE_SENT,
					messageConstants.WEBHOOK_EVENTS.MESSAGE_DELIVERED
				]
			);
			// observer.setWebHookEnabled(true);
			let webhooksServer = express();
			webhooksServer.use(bodyParser.json());
			console.log('setWebHookEndpoint ok.');
			let delivered_in_history_count = 0;
			webhooksServer.post('/delivered-endpoint', function (req, res) {
				console.log("req.body.event_type", req.body.event_type)
				res.status(200).send({success: true});
				if (req.body.event_type !== 'message-delivered') {
					return;
				}
				console.log("test 16 WEBHOOK - Delivered endpoint event_type:", req.body.event_type, " delivered_to", req.body.delivered_to);
				console.log("test 16 WEBHOOK - Delivered endpoint text:", req.body.data.text, " __history?", req.body.data.__history);
				if (req.body.data.__history) {
					console.log("Adding to delivered history:", req.body.data.text);
					delivered_in_history_count++;
				}
				
				// 1. test 16 WEBHOOK - Delivered endpoint text: Group created  __history? true
				// 2. test 16 WEBHOOK - Delivered endpoint text: USER1 joined group on creation  __history? true
				// 3. test 16 WEBHOOK - Delivered endpoint text: USER2 joined group on creation  __history? true
				// 4. test 16 WEBHOOK - Delivered endpoint text: test 16, user1, first message  __history? true
				
				if (delivered_in_history_count == 4) {
					// observer.setWebHookEnabled(false);
					observer.setWebHookEndpoints(null);
					webhook_app.close();
					_chatClient4.close(() => {
						console.log("test 16 - _chatClient4 successfully disconnected.");
						done();
					});
				}
			});
			webhooksServer.post('/sent-endpoint', function (req, res) {
				res.status(200).send({success: true});
				if (req.body.event_type !== 'message-sent') {
					return;
				}
				if (req.body.data.__history) {
					// test fails if "history messages" (__history = true) got through the "message-sent" event!
					assert.fail("'history messages' (__history = true) got through the 'message-sent' event");
				}
				console.log("test 16 WEBHOOK - Sent endpoint event_type:", req.body.event_type);
				console.log("test 16 WEBHOOK - Sent endpoint text:", req.body.data.text, " __history?", req.body.data.__history);
			});
			let webhook_app = webhooksServer.listen(10456, async function() {
				console.log('test 16 - Webhooks App started.', webhook_app.address());
				const group_id = "group-test16_" + uuidv4();
				const group_name = "group-join test16";
				const MESSAGE1_USER1 = "test 16, user1, first message";
				let group_members = {};
				// group_members[user1.userid] = 1;
				group_members[user2.userid] = 1;
				_chatClient4.connect(user4.userid, user4.token, () => {
					console.log("test 16 - _chatClient1 connected.");
					console.log("test 16 - creating group:", group_id);
						_chatClient4.groupCreate(
							group_name,
							group_id,
							group_members,
							async (err, result) => {
								assert(err == null);
								assert(result != null);
								assert(result.success == true);
								assert(result.group.name === group_name);
								logger.log("test 16 - group:", group_id, "created");
								_chatClient4.sendMessageRaw(
									{
										text: MESSAGE1_USER1,
										type: TYPE_TEXT,
										recipient_fullname: group_name,
										sender_fullname: user4.fullname,
										attributes: null,
										metadata: null,
										channel_type: CHANNEL_TYPE_GROUP
									},
									group_id, // recipient
									async (err, msg) => {
										if (err) {
											logger.log("test 11 - Error sending message:", err);
										}
										assert(err == null);
										logger.log("test 16 - message sent:", msg);
										logger.log("test 16 - waiting some time to allow the sent message to reach the 'persistent' status...");
										await new Promise(resolve => setTimeout(resolve, 1000)); // it gives time to join message to reach the "persistent" status
										logger.log("test 16 - end waiting.");
										_chatClient4.groupJoin(group_id, user3.userid, (err, json) => {
											if (err) {
												logger.log("test 16 - member joinned error:", err);
											}
											assert(err == null);
											logger.log("test 16 - member joined json:", json);
										});
									}
								);
							}
						);
					// });
				});
			});
		});
	});

});