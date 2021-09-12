var assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
var chat21HttpServer = require('@chat21/chat21-http-server');
let observer = require('../index').observer;
let express = require('express');
const loggers = new require('../tiledesk-logger');
let logger = new loggers.TiledeskLogger("debug");
// logger.setLog('DEBUG');
// let bodyParser = require('body-parser');

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

const user4 = {
	userid: 'USER4',
	fullname: 'User 4',
	firstname: 'User',
	lastname: '4',
	token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0NjUzYTVkYy02YWFjLTQ2Y2ItYTFlYi03OTE1NWQ2Y2Q3OWUiLCJzdWIiOiJVU0VSNCIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjQuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVI0LioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiVVNFUjQiLCJjaWQiOiJVU0VSNCIsImF6cCI6IlVTRVI0IiwidXNlcl9pZCI6IlVTRVI0IiwiYXBwX2lkIjoidGlsZWNoYXQiLCJpYXQiOjE2Mjc3NDg2MTEsImV4cCI6MTkzODc4ODYxMSwiYXVkIjpbInJhYmJpdG1xIiwiVVNFUjQiXSwia2lkIjoidGlsZWRlc2sta2V5IiwidGlsZWRlc2tfYXBpX3JvbGVzIjoidXNlciJ9.ZeC2JYQpjfZsczvd2Fjpf7WIJ1bRIoxIYp8BTyWDmHE'
};

const user5 = {
	userid: 'USER5',
	fullname: 'User 5',
	firstname: 'User',
	lastname: '5',
	token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxYjMyOTIyMC1kMmFlLTQ4N2ItYmNlMy05N2I5NjYzNGRhZTMiLCJzdWIiOiJVU0VSNSIsInNjb3BlIjpbInJhYmJpdG1xLnJlYWQ6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuVVNFUjUuKiIsInJhYmJpdG1xLndyaXRlOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLlVTRVI1LioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiVVNFUjUiLCJjaWQiOiJVU0VSNSIsImF6cCI6IlVTRVI1IiwidXNlcl9pZCI6IlVTRVI1IiwiYXBwX2lkIjoidGlsZWNoYXQiLCJpYXQiOjE2Mjc3NDg2MTEsImV4cCI6MTkzODc4ODYxMSwiYXVkIjpbInJhYmJpdG1xIiwiVVNFUjUiXSwia2lkIjoidGlsZWRlc2sta2V5IiwidGlsZWRlc2tfYXBpX3JvbGVzIjoidXNlciJ9.7xzZhSAXzceHQwyObbLxQrOWs0xUVDyJ1J4rbh4fd-g'
};

// ** ALL-IN-ONE
// ** RABBITMQ, RUN IT WITH DOCKER
// ** RUN LOCAL MONGODB, EX: mongod --dbpath /usr/local/var/mongodb
// const MQTT_ENDPOINT = 'ws://localhost:15675/ws';
// const API_ENDPOINT = 'http://localhost:8010/api'
// const CLIENT_API_LOG = false;
// const HTTP_SERVER_LOG_LEVEL = 'DEBUG';
// const OBSERVER_LOG_LEVEL = 'DEBUG';
// const LOCAL_STACK = true;

// ** LOCAL MACHINE COMPONENTS
// ** RABBITMQ, RUN IT WITH DOCKER
// ** RUN LOCAL MONGODB, EX: mongod --dbpath /usr/local/var/mongodb
// ** RUN LOCAL CHAT-HTTP-SERVER ON "API_ENDPOINT"
// ** RUN LOCAL CHAT-OBSERVER (ENSURE: ONLY ONE INSTANCE!)
const MQTT_ENDPOINT = 'ws://localhost:15675/ws';
const API_ENDPOINT = 'http://localhost:8004/api'
const CLIENT_API_LOG = false;
LOCAL_STACK = false;

// REMOTE ON AWS
// const MQTT_ENDPOINT = 'ws://99.80.197.164:15675/ws';
// const API_ENDPOINT = 'http://99.80.197.164:8004/api';
// const CLIENT_API_LOG = false;
// LOCAL_STACK = false

const APPID = 'tilechat';
const TYPE_TEXT = 'text';
const CHANNEL_TYPE_GROUP = 'group';
const CHANNEL_TYPE_DIRECT = 'direct';

let chatClient1;
let chatClient2;
let chatClient3;
let http_server;
let webhook_app;

describe('Main', function() {
	before(function(done) {
		chatClient1 = new Chat21Client(
			{
				appId: APPID,
				MQTTendpoint: MQTT_ENDPOINT,
				APIendpoint: API_ENDPOINT,
				log: CLIENT_API_LOG
			}
		);
		chatClient2 = new Chat21Client(
			{
				appId: APPID,
				MQTTendpoint: MQTT_ENDPOINT,
				APIendpoint: API_ENDPOINT,
				log: CLIENT_API_LOG
			}
		);
		chatClient3 = new Chat21Client(
			{
				appId: APPID,
				MQTTendpoint: MQTT_ENDPOINT,
				APIendpoint: API_ENDPOINT,
				log: CLIENT_API_LOG
			}
		);
		chatClient4 = new Chat21Client(
			{
				appId: APPID,
				MQTTendpoint: MQTT_ENDPOINT,
				APIendpoint: API_ENDPOINT,
				log: CLIENT_API_LOG
			}
		);
		chatClient1.connect(user1.userid, user1.token, () => {
			logger.log("chatClient1 Connected...");
			chatClient2.connect(user2.userid, user2.token, () => {
				logger.log("chatClient2 Connected...");
				chatClient3.connect(user3.userid, user3.token, async () => {
					logger.log("chatClient3 Connected...");
					chatClient4.connect(user4.userid, user4.token, async () => {
						logger.log("chatClient4 Connected...");
						// **************************
						// STARTS ALL STACK:
						// 0. RABBITMQ (start separately with docker)
						// 1. HTTP-API-SERVER
						// 2. OBSERVER
						// 3. WEBHOOK ENDPOINT APPLICATION
						// **************************
						if (LOCAL_STACK) {
							chat21HttpServer.logger.setLog(HTTP_SERVER_LOG_LEVEL);
							http_server = chat21HttpServer.app.listen(8010, async() => {
								logger.log('HTTP server started.');
								logger.log('Starting AMQP publisher...');
								await chat21HttpServer.startAMQP({rabbitmq_uri: process.env.RABBITMQ_URI});
								logger.log('HTTP server AMQP connection started.');
								observer.logger.setLog(OBSERVER_LOG_LEVEL);
								observer.setWebHookEndpoint("http://localhost:8002/postdata");
								observer.setAutoRestart(false);
								await observer.startServer({rabbitmq_uri: process.env.RABBITMQ_URI});
								logger.log("observer started.");
								// THE SERVER CLIENT FOR WEBHOOKS
								var webhooksServer = express();
								// serverClient.use(bodyParser.json());
								webhooksServer.post('/postdata', function (req, res) {
									res.status(200).send({success: true})
								});
								webhook_app = webhooksServer.listen(8002, '0.0.0.0', async function() {
									logger.log('Node Client Express started.', webhook_app.address());
									logger.log("Local http Express server started.");
									logger.log("Everything is ok to start testing in 2 seconds...");
									await new Promise(resolve => setTimeout(resolve, 2000));
									logger.log("Ready!");
									done();
								});
							});
						}
						else {
							done();
						}
					});
				});
			});
		});
	});
	
	after(function(done) {
		logger.log("after - Ending test...");
		chatClient1.close(() => {
			logger.log("after - ...chatClient1 successfully disconnected.");
			chatClient2.close(() => {
				logger.log("after - ...chatClient2 successfully disconnected.");
				chatClient3.close(async () => {
					logger.log("after - ...chatClient3 successfully disconnected.");
					chatClient4.close(async () => {
						logger.log("after - ...chatClient4 successfully disconnected.");
						if (LOCAL_STACK) {
							http_server.close();
							logger.log("after - HTTP Server closed.");
							webhook_app.close();
							logger.log("after - Webhooks endpoint closed.");
							logger.log("after - Waiting some seconds before stopping observer (it allows completing pending publish->ack).");
							await new Promise(resolve => setTimeout(resolve, 5000));
							observer.stopServer();
							logger.log("after - Waiting 1 second after observer stop.");
							await new Promise(resolve => setTimeout(resolve, 1000));
						}
						logger.log("after() - end.");
						done();
					});
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

	describe('TiledeskClient - Direct - test 1', function() {
		it('User1 sends a direct message to User2 using client.sendMessage() \
REUSE SHARED CHAT CLIENTS', function(done) {
			logger.log("test 1 - start.");
			let SENT_MESSAGE = 'FIRST MESSAGE 1';
			chatClient1.sendMessage(
				SENT_MESSAGE,
				TYPE_TEXT,
				user2.userid, // recipient id
				user2.fullname, // recipient fullname
				user1.fullname, // sender fullname
				null,
				null,
				CHANNEL_TYPE_DIRECT,
				() => {
					logger.log("Message sent.");
					done();
				}
			);
		});
	});

	describe('TiledeskClient - Direct - test 2', function() {
		it('User1 sends a direct message and User2 receives the message \
REUSE SHARED CHAT CLIENTS', function(done) {
			logger.log("test 2 - start.");
			let SENT_MESSAGE = 'FIRST MESSAGE 2';
			let handler = chatClient2.onMessageAdded((message, topic) => {
				logger.log("test 2 - message added:", message);
				logger.log("test 2 - topic:", topic);
				if (
					message &&
					message.text &&
					!message.attributes &&
					message.text === SENT_MESSAGE &&
					message.sender === user1.userid &&
					topic.conversWith === user1.userid) {
						chatClient2.removeOnMessageAddedHandler(handler);
						done();
				}
			});
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

	describe('TiledeskClient - Groups - test 3', function() {
		it('test 3 - Creates a group \
REUSE SHARED CHAT CLIENTS', function(done) {
			logger.log("test 3 - start.");
			const group_id = "group-test3_" + uuidv4();
			const group_name = "test3 group " + group_id;
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
					logger.log("test 3 - Group created:", result);
					chatClient1.groupData(group_id, (err, json) => {
						logger.log("test 3 - Verified group updated:", group_id, "data:", json);
						assert(err == null);
						assert(json != null);
						assert(json.success == true);
						assert(json.result != null);
						assert(json.result.uid === group_id);
						assert(json.result.owner === user1.userid);
						assert(json.result.members != null);
						assert(json.result.members[user1.userid] != null);
						assert(json.result.members[user2.userid] != null);
						logger.log("test 3 - assertions ok -> done()");
						done();
					});
				}
			);
		});
	});

	describe('TiledeskClient - Groups - test 4', function() {
		it('test 4 - Create group info messages. \
User1 creates a group with 2 members (user1, user2). \
User2 receives all the group info messages(user1.GROUP_CREATED, user1.MEMBER_JOINED_GROUP, user2.MEMBER_JOINED_GROUP) \
REUSE SHARED CHAT CLIENTS', function(done) {
			logger.log("test 4 - start.");
			const group_id = "group-test4_" + uuidv4();
			const group_name = "Test Group " + group_id;
			const group_members = {}
			group_members[user2.userid] = 1;
			let messages = {}
			const GROUP_CREATED_KEY = 'group created';
			const USER1_JOINED_KEY = 'user1 joined';
			const USER2_JOINED_KEY = 'user2 joined';
			let handler_message_added_client2 = chatClient2.onMessageAdded((message, topic) => {
				logger.log("test 4 - message added:", JSON.stringify(message));
				if (
					message &&
					message.recipient === group_id &&
					message.attributes &&
					message.attributes.messagelabel &&
					message.attributes.messagelabel.key &&
					message.attributes.messagelabel.parameters &&
					message.attributes.messagelabel.parameters.creator &&
					message.attributes.messagelabel.key === 'GROUP_CREATED' &&
					message.attributes.messagelabel.parameters.creator === user1.userid) {
						logger.log("test 4 - GROUP_CREATED (user1) message added");
						messages[GROUP_CREATED_KEY] = true;
				}
				else if (
					message &&
					message.recipient === group_id &&
					message.attributes &&
					message.attributes.messagelabel &&
					message.attributes.messagelabel.key &&
					message.attributes.messagelabel.parameters &&
					message.attributes.messagelabel.parameters.member_id &&
					message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
					message.attributes.messagelabel.parameters.member_id === user2.userid) {
						logger.log("test 4 - MEMBER_JOINED_GROUP (user2) message added");
						messages[USER2_JOINED_KEY] = true;
				}
				else if (
					message &&
					message.recipient === group_id &&
					message.attributes &&
					message.attributes.messagelabel &&
					message.attributes.messagelabel.key &&
					message.attributes.messagelabel.parameters &&
					message.attributes.messagelabel.parameters.member_id &&
					message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
					message.attributes.messagelabel.parameters.member_id === user1.userid) {
						logger.log("test 4 - MEMBER_JOINED_GROUP (user1) message added");
						messages[USER1_JOINED_KEY] = true;
				}
				if (Object.keys(messages).length == 3) { // all 3 messages were successfully received
					logger.log("test4 - all messages received.");
					chatClient2.removeOnMessageAddedHandler(handler_message_added_client2);
					logger.log("test 4 -> done()");
					done();
				}
			});
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
					logger.log("test4 - Group created:", result);
			});
		});
	});

	describe('TiledeskClient - Groups - test 5', function() {
		it('test 5 - Send message to group. \
User1 creates a group. \
Group creator (User1) sends a message to the group and receives the sent message back. \
NEW CHAT CLIENTS', function(done) {
			logger.log("test 5 - start.");
			const group_id = "group-test5_" + uuidv4();
			const group_name = "Test Group " + group_id;
			const group_members = {}
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			group_members[user3.userid] = 1;
			const SENT_MESSAGE = 'test 5, Hello guys';
			let _chatClient1 = new Chat21Client(
				{
					appId: APPID,
					MQTTendpoint: MQTT_ENDPOINT,
					APIendpoint: API_ENDPOINT,
					log: CLIENT_API_LOG
				}
			);
			_chatClient1.connect(user1.userid, user1.token, () => {
				logger.log("test 5 - _chatClient1 connected.");
				let handler_message_added_client1 = _chatClient1.onMessageAdded((message, topic) => {
					// logger.log("message added:", JSON.stringify(message));
					if (
						message &&
						message.text &&
						!message.attributes &&
						message.text === SENT_MESSAGE
						) {
							logger.log("test 5 - removing handler:", handler_message_added_client1);
							_chatClient1.removeOnMessageAddedHandler(handler_message_added_client1);
							_chatClient1.close(() => {
								logger.log("test 5 - _chatClient1 successfully disconnected.");
								logger.log("test 5 -> done()");
								done();
							});
					}
				});
				logger.log("test 5 - Creating group:", group_id);
				_chatClient1.groupCreate(
					group_name,
					group_id,
					group_members,
					(err, result) => {
						assert(err == null);
						assert(result != null);
						assert(result.success == true);
						assert(result.group.name === group_name);
						logger.log("test 5 - Group created:", group_id);
						logger.log("test 5 - Sending message to group:", SENT_MESSAGE);
						_chatClient1.sendMessage(
							SENT_MESSAGE,
							TYPE_TEXT,
							group_id, // recipient id
							group_name, // recipient fullname
							user1.fullname, // sender fullname
							null,
							null,
							'group',
							() => {
								logger.log("test 5 - Message sent to group", group_id);
							}
						);
					}
				);
			});
		});
	});

	describe('TiledeskClient - Groups - test 6', function() {
		it('test 6 - Leave group. \
Creates group with 3 members, \
user1 creates group, \
user1 removes user3 from the group, \
user1 & user2 receive e group/clientupdate notification \
REUSE SHARED CHAT CLIENTS', function(done) {
			logger.log("test 6 - start.");
			const group_id = "group-test6_" + uuidv4();
			const group_name = "group-update test 8";
			let group_members = {};
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			group_members[user3.userid] = 1;
			let update_notifications = {};
			chatClient1.onGroupUpdated((group, topic) => {
				if (group.uid === group_id) {
					logger.log("test 6 - chatClient1 - group updated:", JSON.stringify(group), update_notifications);
					update_notifications[user1.userid] = 1;
					if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1 && update_notifications[user3.userid] === 1) {
						logger.log("test 6 - chatClient1 - update -> done()");
						done();
					}
				}
			});
			chatClient2.onGroupUpdated((group, topic) => {
				if (group.uid === group_id) {
					logger.log("test 6 - chatClient2 - group updated:", JSON.stringify(group), update_notifications);
					update_notifications[user2.userid] = 1;
					if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1 && update_notifications[user3.userid] === 1) {
						logger.log("test 6 - chatClient2 - update -> done()");
						done();
					}
				}
			});
			chatClient3.onGroupUpdated((group, topic) => {
				if (group.uid === group_id) {
					logger.log("test 6 - chatClient3 - group updated:", JSON.stringify(group), update_notifications);
					update_notifications[user3.userid] = 1;
					if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1 && update_notifications[user3.userid] === 1) {
						logger.log("test 6 - chatClient2 - update -> done()");
						done();
					}
				}
			});
			chatClient1.groupCreate(
				group_name,
				group_id,
				group_members,
				(err, result) => {
					assert(err == null);
					assert(result != null);
					assert(result.success == true);
					assert(result.group.name === group_name);
					chatClient1.groupLeave(group_id, user3.userid, (err, json) => {
						if (err) {
							logger.log("test 6 - member removed error:", err);
						}
						assert(err == null);
						logger.log("test 6 - member removed json:", json);
					});
				}
			);
		});
	});

	describe('TiledeskClient - Groups - test 7 - Join group with group-updated callback', function() {
		it('test 7 - Join group (group/clientupdate notification subscription). \
Creates group with 2 members. \
User1 creates group, user1 (owner) adds user3 to the group, user1 & user2 receive e group/clientupdate notification \
REUSE SHARED CHAT CLIENTS', function(done) {
			logger.log("test 7 - start.");
			const group_id = "group-test7_" + uuidv4();
			const group_name = "group-update test 7";
			let group_members = {};
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			let update_notifications = {};
			chatClient1.onGroupUpdated((group, topic) => {
				if (group.uid === group_id) {
					logger.log("test 7 - chatClient1 - group updated:", JSON.stringify(group));
					if (group.members[user3.userid]) {
						logger.log("test 7 - chatClient1 - group updated (group.uid with user3 member):", group_id);
						update_notifications[user1.userid] = 1;
						if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1) {
							logger.log("test 7 - chatClient1 - update ok -> done()");
							done();
						}
					}
				}
			});
			chatClient2.onGroupUpdated((group, topic) => {
				if (group.uid === group_id) {
					logger.log("test 7 - chatClient2 - group updated:", JSON.stringify(group));
					if (group.members[user3.userid]) {
						logger.log("test 7 - chatClient2 - group updated (group.uid with user3 member):", group_id);
						update_notifications[user2.userid] = 1;
						if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1) {
							logger.log("test 7 - chatClient2 - update ok -> done()");
							done();
						}
					}
				}
			});
			chatClient1.groupCreate(
				group_name,
				group_id,
				group_members,
				(err, result) => {
					assert(err == null);
					assert(result != null);
					assert(result.success == true);
					assert(result.group.name === group_name);
					chatClient1.groupJoin(group_id, user3.userid, (err, json) => {
						if (err) {
							logger.log("test 7 - member joined error:", err);
						}
						assert(err == null);
						logger.log("test 7 - member joined json:", json);
					});
				}
			);
		});
	});

	describe('TiledeskClient - test 8 - Join group with JOINED_MEMBER message notification', function() {
		it('test 8 - Join group (group info messages). \
User1 (owner) creates a group with 2 members (User1, User2). \
User1 adds User3 to the group, user1 & user2 receive e MEMBER_JOINED_GROUP message \
REUSE SHARED CHAT CLIENTS', function(done) {
			logger.log("test 8 - start.");
			const group_id = "group-test8_" + uuidv4();
			const group_name = "group-update test 8";
			let group_members = {};
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			let update_notifications = {};
			let handler1 = chatClient1.onMessageAdded((message, topic) => {
				if (message.recipient === group_id) {
					logger.log("test 8 - message added (chatClient1):", JSON.stringify(message));
					if (
						message &&
						message.recipient === group_id &&
						message.attributes &&
						message.attributes.messagelabel &&
						message.attributes.messagelabel.key &&
						message.attributes.messagelabel.parameters &&
						message.attributes.messagelabel.parameters.member_id &&
						message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
						message.attributes.messagelabel.parameters.member_id === user3.userid) {
							logger.log("test 8 - MEMBER_JOINED_GROUP user3 (chatClient1)");
							update_notifications[user1.userid] = 1;
							if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1) {
								logger.log("test 8 - MEMBER_JOINED_GROUP (user3) messages received.");
								chatClient1.removeOnMessageAddedHandler(handler1);
								logger.log("test 8 chatClient1 -> done()");
								done();
							}
					}
				}
			});
			let handler2 = chatClient2.onMessageAdded((message, topic) => {
				if (message.recipient === group_id) {
					logger.log("test 8 - message added (chatClient2):", JSON.stringify(message));
					if (
						message &&
						message.recipient === group_id &&
						message.attributes &&
						message.attributes.messagelabel &&
						message.attributes.messagelabel.key &&
						message.attributes.messagelabel.parameters &&
						message.attributes.messagelabel.parameters.member_id &&
						message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
						message.attributes.messagelabel.parameters.member_id === user3.userid) {
							logger.log("test 8 - MEMBER_JOINED_GROUP user3 (chatClient2)");
							update_notifications[user2.userid] = 1;
							if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1) {
								logger.log("test 8 - MEMBER_JOINED_GROUP (user3) messages received.");
								chatClient2.removeOnMessageAddedHandler(handler2);
								logger.log("test 8 chatClient2 -> done()");
								done();
							}
					}
				}
			});
			chatClient1.groupCreate(
				group_name,
				group_id,
				group_members,
				(err, result) => {
					assert(err == null);
					assert(result != null);
					assert(result.success == true);
					assert(result.group.name === group_name);
					logger.log("test 8 - group:", group_id, "created");
					chatClient1.groupJoin(group_id, user3.userid, (err, json) => {
						logger.log("test 8 - member joined error:", err);
						logger.log("test 8 - member joined json:", json);
					});
				}
			);
		});
	});

	describe('TiledeskClient - Groups - test 9 - Join group - full notifications (group-update, JOINED_MEMBER messages)', function() {
		it('test 9 - Join group, complete notifications (testing receiving of both info-messages & group-update notifications). \
User1 creates a group with 2 members. \
User1 adds user3 to the group.\
User1 & user2 receive e MEMBER_JOINED_GROUP message & group-updated notification \
REUSE SHARED CHAT CLIENTS', function(done) {
			logger.log("test 9 - start.");
			const group_id = "group-test9_" + uuidv4();
			const group_name = "group-update test 9";
			let group_members = {};
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			let update_notifications = {};
			// let _chatClient1 = new Chat21Client(
			// 	{
			// 		appId: APPID,
			// 		MQTTendpoint: MQTT_ENDPOINT,
			// 		APIendpoint: API_ENDPOINT,
			// 		log: CLIENT_API_LOG
			// 	}
			// );
			// let _chatClient2 = new Chat21Client(
			// 	{
			// 		appId: APPID,
			// 		MQTTendpoint: MQTT_ENDPOINT,
			// 		APIendpoint: API_ENDPOINT,
			// 		log: CLIENT_API_LOG
			// 	}
			// );
			// _chatClient1.connect(user1.userid, user1.token, () => {
			// 	logger.log("test 9 - _chatClient1 connected.");
			// 	_chatClient2.connect(user1.userid, user1.token, () => {
			// 		logger.log("test 9 - _chatClient2 connected.");
					let handler_message_added_client1 = chatClient1.onMessageAdded((message, topic) => {
						if (message.recipient === group_id) {
							logger.log("test 9 - message added - chatClient1:", JSON.stringify(message));
							if (
								message &&
								message.recipient === group_id &&
								message.attributes &&
								message.attributes.messagelabel &&
								message.attributes.messagelabel.key &&
								message.attributes.messagelabel.parameters &&
								message.attributes.messagelabel.parameters.member_id &&
								message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
								message.attributes.messagelabel.parameters.member_id === user3.userid) {
									update_notifications['message_' + user1.userid] = 1;
									check_if_done();
							}
						}
					});
					let handler_message_added_client2 = chatClient2.onMessageAdded((message, topic) => {
						if (message.recipient === group_id) {
							logger.log("test 9 - message added - chatClient2:", JSON.stringify(message));
							if (
								message &&
								message.recipient === group_id &&
								message.attributes &&
								message.attributes.messagelabel &&
								message.attributes.messagelabel.key &&
								message.attributes.messagelabel.parameters &&
								message.attributes.messagelabel.parameters.member_id &&
								message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
								message.attributes.messagelabel.parameters.member_id === user3.userid) {
									update_notifications['message_' + user2.userid] = 1;
									check_if_done();
							}
						}
					});
					let handler_group_updated_client1 = chatClient1.onGroupUpdated((group, topic) => {
						if (group.uid === group_id) {
							logger.log("test 9 - group updated - chatClient1:", JSON.stringify(group));
							if (group.notification &&
								group.notification.messagelabel &&
								group.notification.messagelabel.key === "MEMBER_JOINED_GROUP" &&
								group.notification.messagelabel.parameters &&
								group.notification.messagelabel.parameters.member_id === "USER3") {
									update_notifications['group_update_notification_' + user1.userid] = 1;
									check_if_done();
							}
						}
					});
					let handler_group_updated_client2 = chatClient2.onGroupUpdated((group, topic) => {
						if (group.uid === group_id) {
							logger.log("test 9 - group updated - chatClient2:", JSON.stringify(group));
							if (group.notification &&
								group.notification.messagelabel &&
								group.notification.messagelabel.key === "MEMBER_JOINED_GROUP" &&
								group.notification.messagelabel.parameters &&
								group.notification.messagelabel.parameters.member_id === "USER3") {
									update_notifications['group_update_notification_' + user2.userid] = 1;
									check_if_done();
							}
						}
					});
					function check_if_done() {
						if (update_notifications['message_' + user1.userid] === 1 &&
							update_notifications['message_' + user2.userid] === 1 &&
							update_notifications['group_update_notification_' + user1.userid] === 1 &&
							update_notifications['group_update_notification_' + user2.userid] === 1) {
								logger.log("test 9 - ALL NOTIFICATIONS RECEIVED");
								chatClient1.removeOnMessageAddedHandler(handler_message_added_client1);
								logger.log("test 9 - chatClient1.removeOnMessageAddedHandler(handler_message_added_client1) OK.", handler_message_added_client1);
								chatClient1.removeOnMessageAddedHandler(handler_message_added_client2);
								logger.log("test 9 - chatClient1.removeOnMessageAddedHandler(handler_message_added_client2) OK.", handler_message_added_client2);
								chatClient1.removeOnGroupUpdatedHandler(handler_group_updated_client1);
								logger.log("test 9 - chatClient1.removeOnGroupUpdatedHandler(handler_group_updated_client1) OK.", handler_group_updated_client1);
								chatClient1.removeOnGroupUpdatedHandler(handler_group_updated_client2);
								logger.log("test 9 - chatClient1.removeOnGroupUpdatedHandler(handler_group_updated_client2) OK.", handler_group_updated_client2);
								// chatClient1.close(() => {
								// 	logger.log("test 9 - _chatClient1 successfully disconnected.");
								// 	chatClient2.close(() => {
								// 		logger.log("test 9 - _chatClient2 successfully disconnected.");
								done();
								logger.log("test 9 - done()");
								// 	});
								// });
						}
					}
					chatClient1.groupCreate(
						group_name,
						group_id,
						group_members,
						(err, result) => {
							assert(err == null);
							assert(result != null);
							assert(result.success == true);
							assert(result.group.name === group_name);
							logger.log("test 9 - group", group_id, "created");
							chatClient1.groupJoin(group_id, user3.userid, (err, json) => {
								if (err) {
									logger.log("test 9 - member joined error!", err);
								}
								assert(err == null);
								logger.log("test 9 - member joined json:", json);
							});
						}
					);
			// 	});
			// });
		});
	});

	describe('TiledeskClient - test 10 - Join group - history messages 1', function() {
		it('test 10 - Join group (get group messages history, 1 message). User1 (owner) creates a group with 2 members (User1, User2). \
User1 sends 1 message. \
User1 adds User3 to the group. \
User3 receives the (only) message previously sent by User1 to the group \
REUSE SHARED CHAT CLIENTS', function(done) {
			logger.log("test 10 - start.");
			const group_id = "group-test10_" + uuidv4();
			const group_name = "group-update test 10";
			const MESSAGE1_USER1 = "test 10, user1, first";
			let group_members = {};
			// group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			chatClient3.onMessageAdded((message, topic) => {
				if ( message.recipient === group_id ) {
					logger.log("test 10 - Client3 - message added:", JSON.stringify(message));
					if (
						message &&
						message.recipient === group_id &&
						message.text === MESSAGE1_USER1) {
							logger.log("test 10 - MESSAGE1_USER1 message received:", message.text);
							logger.log("test 10 -> done()");
							done();
					}
				}
			});
			chatClient1.groupCreate(
				group_name,
				group_id,
				group_members,
				async (err, result) => {
					assert(err == null);
					assert(result != null);
					assert(result.success == true);
					assert(result.group.name === group_name);
					logger.log("test 10 - group:", group_id, "created");
					chatClient1.sendMessageRaw(
						{
							text: MESSAGE1_USER1,
							type: TYPE_TEXT,
							recipient_fullname: group_name,
							sender_fullname: user1.fullname,
							attributes: null,
							metadata: null,
							channel_type: CHANNEL_TYPE_GROUP
						},
						group_id, // recipient
						async (err, msg) => {
							if (err) {
								logger.log("test 10 - Error sending message:", err);
							}
							assert(err == null);
							logger.log("test 10 - Message sent:", msg);
							logger.log("test 10 - Waiting a bit to allow message persistence...");
							await new Promise(resolve => setTimeout(resolve, 1000)); // it gives time to message to reach the "persistent" status
							logger.log("test 10 - End waiting.");
							chatClient1.groupJoin(group_id, user3.userid, (err, json) => {
								if (err) {
									logger.log("test 10 - member joinned error:", err);
								}
								assert(err == null);
								logger.log("test 10 - member joined json:", json);
							});
						}
					);
				}
			);
		});
	});

	describe('TiledeskClient - test 11 -  - history messages 2 (full history)', function() {
		it('\
test 11 - Join group (get FULL group messages history). \
User1 (owner) creates a group with 2 members (User1, User2). \
User1 sends 1 message. \
User1 adds User3 to the group. \
User3 receives 5 messages. \
1. All the 4 group info messages: FIRST_MESSAGE, GROUP_CREATED, USER1 MEMBER_JOINED_GROUP, USER2 MEMBER_JOINED_GROUP, USER3 MEMBER_JOINED_GROUP \
2. The message sent by USER1. \
NEW CHAT CLIENTS', function(done) {
			logger.log("test 11 - start.");
			const group_id = "group-test11_" + uuidv4();
			const group_name = "group-join test11";
			const MESSAGE1_USER1 = "test 11, user1, first message";
			let group_members = {};
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			let history_messages = {};
			let _chatClient1 = new Chat21Client(
				{
					appId: APPID,
					MQTTendpoint: MQTT_ENDPOINT,
					APIendpoint: API_ENDPOINT,
					log: CLIENT_API_LOG
				}
			);
			let _chatClient3 = new Chat21Client(
				{
					appId: APPID,
					MQTTendpoint: MQTT_ENDPOINT,
					APIendpoint: API_ENDPOINT,
					log: CLIENT_API_LOG
				}
			);
			_chatClient1.connect(user1.userid, user1.token, () => {
				logger.log("test 11 - _chatClient1 connected.");
				_chatClient3.connect(user3.userid, user3.token, () => { // TODO if token is wrong it mustreply with an error!
					logger.log("test 11 - _chatClient3 connected.");
					let added_handler3 = _chatClient3.onMessageAdded((message, topic) => {
						if (message.recipient === group_id) {
							logger.log("test 11 - Client3 - message added:", JSON.stringify(message));
							if (
								message &&
								message.recipient === group_id &&
								message.text === MESSAGE1_USER1) {
								logger.log("test 11 - MESSAGE1_USER1 message received:", message.text);
								history_messages['MESSAGE1_USER1'] = 1;
							}
							else if (
								message &&
								message.recipient === group_id &&
								message.attributes &&
								message.attributes.messagelabel &&
								message.attributes.messagelabel.key &&
								message.attributes.messagelabel.parameters &&
								message.attributes.messagelabel.parameters.creator &&
								message.attributes.messagelabel.key === 'GROUP_CREATED' &&
								message.attributes.messagelabel.parameters.creator === user1.userid) {
								logger.log("test 11 - GROUP_CREATED message received:", message.text);
								history_messages['GROUP_CREATED'] = 1;
							}
							else if (
								message &&
								message.recipient === group_id &&
								message.attributes &&
								message.attributes.messagelabel &&
								message.attributes.messagelabel.key &&
								message.attributes.messagelabel.parameters &&
								message.attributes.messagelabel.parameters.member_id &&
								message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
								message.attributes.messagelabel.parameters.member_id === user1.userid) {
								logger.log("test 11 - MEMBER_JOINED_GROUP_user1 message received:", message.text);
								history_messages['MEMBER_JOINED_GROUP_user1'] = 1;
							}
							else if (
								message &&
								message.recipient === group_id &&
								message.attributes &&
								message.attributes.messagelabel &&
								message.attributes.messagelabel.key &&
								message.attributes.messagelabel.parameters &&
								message.attributes.messagelabel.parameters.member_id &&
								message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
								message.attributes.messagelabel.parameters.member_id === user2.userid) {
								logger.log("test 11 - MEMBER_JOINED_GROUP_user2 message received:", message.text);
								history_messages['MEMBER_JOINED_GROUP_user2'] = 1;
							}
							else if (
								message &&
								message.recipient === group_id &&
								message.attributes &&
								message.attributes.messagelabel &&
								message.attributes.messagelabel.key &&
								message.attributes.messagelabel.parameters &&
								message.attributes.messagelabel.parameters.member_id &&
								message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
								message.attributes.messagelabel.parameters.member_id === user3.userid) {
								logger.log("test 11 - MEMBER_JOINED_GROUP_user3 message received:", message.text);
								history_messages["MEMBER_JOINED_GROUP_user3"] = 1;
							}
							if (message &&
								message.recipient === group_id &&
								history_messages['MESSAGE1_USER1'] === 1 &&
								history_messages['GROUP_CREATED'] === 1 &&
								history_messages['MEMBER_JOINED_GROUP_user1'] === 1 &&
								history_messages['MEMBER_JOINED_GROUP_user2'] === 1 &&
								history_messages['MEMBER_JOINED_GROUP_user3'] === 1) {
								logger.log("test 11 - FULL HISTORY RECEIVED.");
								_chatClient3.removeOnMessageAddedHandler(added_handler3);
								_chatClient1.close(() => {
									logger.log("test 11 - _chatClient1 successfully disconnected.");
									_chatClient3.close(() => {
										logger.log("test 11 - _chatClient3 successfully disconnected.");
										logger.log("test 11 -> done()");
										done();
									});
								});
							}
						}
					});
					logger.log("test 11 - creating group:", group_id);
					_chatClient1.groupCreate(
						group_name,
						group_id,
						group_members,
						async (err, result) => {
							assert(err == null);
							assert(result != null);
							assert(result.success == true);
							assert(result.group.name === group_name);
							logger.log("test 11 - group:", group_id, "created");
							_chatClient1.sendMessageRaw(
								{
									text: MESSAGE1_USER1,
									type: TYPE_TEXT,
									recipient_fullname: group_name,
									sender_fullname: user1.fullname,
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
									logger.log("test 11 - message sent:", msg);
									logger.log("test 11 - waiting some time to allow the sent message to reach the 'persistent' status...");
									await new Promise(resolve => setTimeout(resolve, 1000)); // it gives time to join message to reach the "persistent" status
									logger.log("test 11 - end waiting.");
									_chatClient1.groupJoin(group_id, user3.userid, (err, json) => {
										if (err) {
											logger.log("test 11 - member joinned error:", err);
										}
										assert(err == null);
										logger.log("test 11 - member joined json:", json);
									});
								}
							);
						}
					);
				});
			});
		});
	});

	describe('TiledeskClient - test 12', function() {
		it('\
test 12 - Set Members (not testing messages history). \
User1 (owner) creates a group with 2 members: User1, User2 \
User1 re-sets the whole members to: User1, User3, User4. \
User1, stays, will receive group-update notification (original member)\
User2, removed, will receive group-update notification (original member) \
NEW CHAT CLIENTS', function(done) {
			logger.log("test 12 - start.");
			const group_id = "group-test12_" + uuidv4();
			const group_name = "group-set-members test";
			let original_group_members = {};
			original_group_members[user1.userid] = 1;
			original_group_members[user2.userid] = 1;
			let new_group_members = {};
			new_group_members[user1.userid] = 1;
			new_group_members[user3.userid] = 1;
			new_group_members[user4.userid] = 1;
			let update_notifications = {};
			// NOTE: Only original members will receive the group-update notification
			chatClient1.onGroupUpdated((group, topic) => {
				if (group.uid === group_id) {
					logger.log("test 12 - group updated - chatClient1:", JSON.stringify(group));
					update_notifications[user1.userid] = 1;
					if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1) {
						logger.log("test 12 - chatClient1 - ALL NOTIFICATIONS RECEIVED -> done()");
						done();
					}
				}
			});
			chatClient2.onGroupUpdated((group, topic) => {
				if (group.uid === group_id) {
					logger.log("test 12 - group updated - chatClient2:", JSON.stringify(group));
					update_notifications[user2.userid] = 1;
					if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1) {
						logger.log("test 12 - chatClient2 - ALL NOTIFICATIONS RECEIVED -> done()");
						done();
					}
				}
			});
			chatClient1.groupCreate(
				group_name,
				group_id,
				original_group_members,
				async (err, result) => {
					assert(err == null);
					assert(result != null);
					assert(result.success == true);
					assert(result.group.name === group_name);
					logger.log("test 12 - group:", group_id, "created");
					chatClient1.groupSetMembers(
						group_id,
						new_group_members,
						async (err, result) => {
							assert(err == null);
							assert(result != null);
							assert(result.success == true);
							logger.log("test 12 - group:", group_id, "members successfully set to:", new_group_members);
							chatClient1.groupData(group_id, (err, json) => {
								logger.log("test 12 - group updated (API):", group_id);
								assert(err == null);
								assert(json != null);
								assert(json.success == true);
								assert(json.result != null);
								assert(json.result.uid === group_id);
								assert(json.result.owner === user1.userid);
								assert(json.result.members != null);
								assert(json.result.members[user1.userid] != null);
								assert(json.result.members[user3.userid] != null);
								assert(json.result.members[user4.userid] != null);
							});
						}
					);
				}
			);
		});
	});

});