var assert = require('assert');
const { uuid } = require('uuidv4');
const { Chat21Client } = require('../mqttclient/chat21client.js');
var chat21HttpServer = require('@chat21/chat21-http-server');
let observer = require('../index').observer;
let express = require('express');
const loggers = new require('../tiledesk-logger');
let logger = new loggers.TiledeskLogger("DEBUG");
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

// ALL-IN-ONE (EXCEPT RABBITMQ, RUN IT WITH DOCKER)
const MQTT_ENDPOINT = 'ws://localhost:15675/ws';
const API_ENDPOINT = 'http://localhost:8010/api'
const CLIENT_API_LOG = false;
const HTTP_SERVER_LOG_LEVEL = 'DEBUG';
const OBSERVER_LOG_LEVEL = 'DEBUG';
const LOCAL_STACK = true;

// LOCAL MACHINE COMPONENTS
// const MQTT_ENDPOINT = 'ws://localhost:15675/ws';
// const API_ENDPOINT = 'http://localhost:8004/api'
// const CLIENT_API_LOG = false;
// LOCAL_STACK = false;

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

describe('hooks', function() {
	before(function(done) {
		console.log("Running Basic tests...");
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
		chatClient1.connect(user1.userid, user1.token, () => {
			logger.log("chatClient1 Connected...");
			chatClient2.connect(user2.userid, user2.token, () => {
				logger.log("chatClient2 Connected...");
				chatClient3.connect(user3.userid, user3.token, async () => {
					logger.log("chatClient3 Connected...");
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
							var serverClient = express();
							// serverClient.use(bodyParser.json());
							serverClient.post('/postdata', function (req, res) {
								res.status(200).send({success: true})
							});
							webhook_app = serverClient.listen(8002, '0.0.0.0', async function() {
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
	
	after(function() {
		chatClient1.close(() => {
			logger.log("...chatClient1 successfully disconnected.");
			chatClient2.close(() => {
				logger.log("...chatClient2 successfully disconnected.");
				chatClient3.close(async () => {
					logger.log("...chatClient3 successfully disconnected.");
					if (LOCAL_STACK) {
						http_server.close(); // REMOVE IF NOT ALL-IN-ONE
						logger.log("HTTP Server closed."); // REMOVE IF NOT ALL-IN-ONE
						webhook_app.close();
						logger.log("Webhooks endpoint closed.");
						observer.stopServer(); // REMOVE IF NOT ALL-IN-ONE
						await new Promise(resolve => setTimeout(resolve, 500)); // REMOVE IF NOT ALL-IN-ONE
					}
					done();
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
		describe('test 1 - Direct message', function() {
			it('User1 sends a direct message to User2 using client.sendMessage()', function(done) {
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
	});

	describe('TiledeskClient - Direct - test 2', function() {
		describe('test 2 - Direct message', function() {
			it('User1 sends a direct message and User2 receives the message', function(done) {
				let SENT_MESSAGE = 'FIRST MESSAGE 2';
				chatClient2.onMessageAdded((message, topic) => {
					logger.log("test 2 - message added:", message);
					logger.log("test 2 - topic:", topic);
					if (
						message &&
						message.text &&
						!message.attributes &&
						message.text === SENT_MESSAGE &&
						message.sender === user1.userid &&
						topic.conversWith === user1.userid) {
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
	});

	describe('TiledeskClient - Groups - test 3', function() {
		it('test 3 - Creates a group', function(done) {
			const group_id = "group-" + uuid();
			const group_name = "test group " + group_id;
			const group_members = {}
			group_members[user2.userid] = 1;
			chatClient1.createGroup(
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
					logger.log("Group created:", result);
					done();
				}
			);
		});
	});

	describe('TiledeskClient - Groups - test 4', function() {
		it('test 4 - Create group info messages. User1 creates a group with 2 members (user1, user2). User2 receives all the group info messages(user1.GROUP_CREATED, user1.MEMBER_JOINED_GROUP, user2.MEMBER_JOINED_GROUP)', function(done) {
			const group_id = "group-" + "TEST5";
			const group_name = "Test Group " + group_id;
			const group_members = {}
			group_members[user2.userid] = 1;
			let messages = {}
			const GROUP_CREATED_KEY = 'group created';
			const USER1_JOINED_KEY = 'user1 joined';
			const USER2_JOINED_KEY = 'user2 joined';
			chatClient2.onMessageAdded((message, topic) => {
				logger.log("test 5 - message added:", JSON.stringify(message));
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
					messages[GROUP_CREATED_KEY] = true;
					if (Object.keys(messages).length == 3) { // all 3 messages were successfully received
						logger.log("...test4 - all messages received.");
						done();
					}
				}
				if (
					message &&
					message.recipient === group_id &&
					message.attributes &&
					message.attributes.messagelabel &&
					message.attributes.messagelabel.key &&
					message.attributes.messagelabel.parameters &&
					message.attributes.messagelabel.parameters.member_id &&
					message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
					message.attributes.messagelabel.parameters.member_id === user2.userid) {
					messages[USER2_JOINED_KEY] = true;
					if (Object.keys(messages).length == 3) { // all 3 messages were successfully received
						logger.log("...test4 - all messages received.");
						done();
					}
				}
				if (
					message &&
					message.recipient === group_id &&
					message.attributes &&
					message.attributes.messagelabel &&
					message.attributes.messagelabel.key &&
					message.attributes.messagelabel.parameters &&
					message.attributes.messagelabel.parameters.member_id &&
					message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
					message.attributes.messagelabel.parameters.member_id === user1.userid) {
					messages[USER1_JOINED_KEY] = true;
					if (Object.keys(messages).length == 3) { // all 3 messages were successfully received
						logger.log("...test4 - all messages received.");
						done();
					}
				}
			});
			chatClient1.createGroup(
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
		it('test 5 - Send message to group. User1 creates a group. Group creator (User1) sends a message to the group and receives the sent message back.', function(done) {
			const group_id = "group-" + "TEST6";
			const group_name = "Test Group " + group_id;
			const group_members = {}
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			group_members[user3.userid] = 1;
			const SENT_MESSAGE = 'Hello guys';
			chatClient1.onMessageAdded((message, topic) => {
				// logger.log("message added:", JSON.stringify(message));
				if (
					message &&
					message.text &&
					!message.attributes &&
					message.text === SENT_MESSAGE
					) {
					done();
				}
			});
			chatClient1.createGroup(
				group_name,
				group_id,
				group_members,
				(err, result) => {
					assert(err == null);
					assert(result != null);
					assert(result.success == true);
					assert(result.group.name === group_name);
					chatClient1.sendMessage(
						SENT_MESSAGE,
						TYPE_TEXT,
						group_id, // recipient id
						group_name, // recipient fullname
						user1.fullname, // sender fullname
						null,
						null,
						'group',
						() => {
							logger.log("Message sent to group", group_name);
						}
					);
				}
			);
		});
	});

	describe('TiledeskClient - Groups - test 6', function() {
		it('test 6 - Leave group. Creates group with 3 members, user1 creates group, user1 removes user3 from the group, user1 & user2 receive e group/clientupdate notification', function(done) {
			const group_id = "group-" + uuid();
			const group_name = "group-update test 8";
			let group_members = {};
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			group_members[user3.userid] = 1;
			let update_notifications = {};
			chatClient1.onGroupUpdated((group, topic) => {
				logger.log("test 6 - chatClient1 - group updated:", JSON.stringify(group), update_notifications);
				if (group.uid === group_id) {
					update_notifications[user1.userid] = 1;
					if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1 && update_notifications[user3.userid] === 1) {
						logger.log("test 6 - chatClient1 done - update");
						done();
					}
				}
			});
			chatClient2.onGroupUpdated((group, topic) => {
				logger.log("test 6 - chatClient2 - group updated:", JSON.stringify(group), update_notifications);
				if (group.uid === group_id) {
					update_notifications[user2.userid] = 1;
					if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1 && update_notifications[user3.userid] === 1) {
						logger.log("test 6 - chatClient2 done - update");
						done();
					}
				}
			});
			chatClient3.onGroupUpdated((group, topic) => {
				logger.log("test 6 - chatClient3 - group updated:", JSON.stringify(group), update_notifications);
				if (group.uid === group_id) {
					update_notifications[user3.userid] = 1;
					if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1 && update_notifications[user3.userid] === 1) {
						logger.log("test 6 - chatClient2 done - update");
						done();
					}
				}
			});
			chatClient1.createGroup(
				group_name,
				group_id,
				group_members,
				(err, result) => {
					assert(err == null);
					assert(result != null);
					assert(result.success == true);
					assert(result.group.name === group_name);
					chatClient1.leaveGroup(group_id, user3.userid, (err, json) => {
						if (err) {
							logger.log("test 6 - member removed error:", err);
						}
						logger.log("test 6 - member removed json:", json);
					});
				}
			);
		});
	});

	describe('TiledeskClient - Groups - test 7', function() {
		it('test 7 - Join group (group/clientupdate notification subscription). Creates group with 2 members. User1 creates group, user1 (owner) adds user3 to the group, user1 & user2 receive e group/clientupdate notification', function(done) {
			const group_id = "group-" + uuid();
			const group_name = "group-update test 7";
			let group_members = {};
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			let update_notifications = {};
			chatClient1.onGroupUpdated((group, topic) => {
				logger.log("test 7 - chatClient1 - group updated:", JSON.stringify(group), update_notifications);
				if (group.uid === group_id) {
					if (group.members[user3.userid]) {
						update_notifications[user1.userid] = 1;
						if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1) {
							logger.log("test 7 - chatClient1 done - update ok");
							done();
						}
					}
				}
			});
			chatClient2.onGroupUpdated((group, topic) => {
				logger.log("test 7 - chatClient2 - group updated:", JSON.stringify(group), update_notifications);
				if (group.uid === group_id) {
					if (group.members[user3.userid]) {
						update_notifications[user2.userid] = 1;
						if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1) {
							logger.log("test 7 - chatClient2 done - update ok");
							done();
						}
					}
				}
			});
			chatClient1.createGroup(
				group_name,
				group_id,
				group_members,
				(err, result) => {
					assert(err == null);
					assert(result != null);
					assert(result.success == true);
					assert(result.group.name === group_name);
					chatClient1.joinGroup(group_id, user3.userid, (err, json) => {
						if (err) {
							logger.log("test 7 - member removed error:", err);
						}
						logger.log("test 7 - member removed json:", json);
					});
				}
			);
		});
	});

	describe('TiledeskClient - test 8', function() {
		it('test 8 - Join group (group info messages). User1 (owner) creates a group with 2 members (User1, User2). User1 adds User3 to the group, user1 & user2 receive e MEMBER_JOINED_GROUP message', function(done) {
			const group_id = "group-" + uuid();
			const group_name = "group-update test 8";
			let group_members = {};
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			let update_notifications = {};
			chatClient1.onMessageAdded((message, topic) => {
				logger.log("test 8 - message added:", JSON.stringify(message));
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
					update_notifications[user1.userid] = 1;
					if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1) {
						logger.log("test 8 - - MEMBER_JOINED_GROUP message received.");
						done();
					}
				}
			});
			chatClient2.onMessageAdded((message, topic) => {
				logger.log("test 8 - message added:", JSON.stringify(message));
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
					update_notifications[user2.userid] = 1;
					if (update_notifications[user1.userid] === 1 && update_notifications[user2.userid] === 1) {
						logger.log("test 8 - - MEMBER_JOINED_GROUP message received.");
						done();
					}
				}
			});
			chatClient1.createGroup(
				group_name,
				group_id,
				group_members,
				(err, result) => {
					assert(err == null);
					assert(result != null);
					assert(result.success == true);
					assert(result.group.name === group_name);
					logger.log("test 8 - group:", group_id, "created");
					chatClient1.joinGroup(group_id, user3.userid, (err, json) => {
						logger.log("test 8 - member removed error:", err);
						logger.log("test 8 - member removed json:", json);
					});
				}
			);
		});
	});

	describe('TiledeskClient - Groups - test 9', function() {
		it('test 9 - Join group, complete notifications (testing receiving of both info messages & group/update notifications). User1 creates a group with 2 members. User1 adds user3 to the group, user1 & user2 receive e MEMBER_JOINED_GROUP message & group/updated notification', function(done) {
			const group_id = "group-" + uuid();
			const group_name = "group-update test 10";
			let group_members = {};
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			let update_notifications = {};
			chatClient1.onMessageAdded((message, topic) => {
				logger.log("test 9 - message added:", JSON.stringify(message));
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
					if (update_notifications['message_' + user1.userid] === 1 && update_notifications['message_' + user2.userid] === 1 &&
						update_notifications['group_update_notification_' + user1.userid] === 1 && update_notifications['group_update_notification_' + user2.userid] === 1) {
						logger.log("test 9 - ALL NOTIFICATIONS RECEIVED");
						done();
					}
				}
			});
			chatClient2.onMessageAdded((message, topic) => {
				logger.log("test 9 - message added:", JSON.stringify(message));
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
					if (update_notifications['message_' + user1.userid] === 1 && update_notifications['message_' + user2.userid] === 1 &&
						update_notifications['group_update_notification_' + user1.userid] === 1 && update_notifications['group_update_notification_' + user2.userid] === 1) {
						logger.log("test 9 - ALL NOTIFICATIONS RECEIVED");
						done();
					}
				}
			});
			chatClient1.onGroupUpdated((group, topic) => {
				logger.log("test 9 - group updated - chatClient1:", JSON.stringify(group));
				if (group.uid === group_id) {
					if (group.notification &&
						group.notification.messagelabel &&
						group.notification.messagelabel.key === "MEMBER_JOINED_GROUP" &&
						group.notification.messagelabel.parameters &&
						group.notification.messagelabel.parameters.member_id === "USER3") {
						update_notifications['group_update_notification_' + user1.userid] = 1;
						if (update_notifications['message_' + user1.userid] === 1 && update_notifications['message_' + user2.userid] === 1 &&
							update_notifications['group_update_notification_' + user1.userid] === 1 && update_notifications['group_update_notification_' + user2.userid] === 1) {
							logger.log("test 9 - ALL NOTIFICATIONS RECEIVED");
							done();
						}
					}
				}
			});
			chatClient2.onGroupUpdated((group, topic) => {
				logger.log("test 9 - group updated - chatClient2:", JSON.stringify(group));
				if (group.uid === group_id) {
					if (group.notification &&
						group.notification.messagelabel &&
						group.notification.messagelabel.key === "MEMBER_JOINED_GROUP" &&
						group.notification.messagelabel.parameters &&
						group.notification.messagelabel.parameters.member_id === "USER3") {
						update_notifications['group_update_notification_' + user2.userid] = 1;
						if (update_notifications['message_' + user1.userid] === 1 && update_notifications['message_' + user2.userid] === 1 &&
							update_notifications['group_update_notification_' + user1.userid] === 1 && update_notifications['group_update_notification_' + user2.userid] === 1) {
							logger.log("test 9 - ALL NOTIFICATIONS RECEIVED");
							done();
						}
					}
				}
			});
			chatClient1.createGroup(
				group_name,
				group_id,
				group_members,
				(err, result) => {
					assert(err == null);
					assert(result != null);
					assert(result.success == true);
					assert(result.group.name === group_name);
					logger.log("test 9 - group", group_id, "created");
					chatClient1.joinGroup(group_id, user3.userid, (err, json) => {
						if (err) {
							logger.log("test 9 - member removed error:", err);
						}
						logger.log("test 9 - member removed json:", json);
					});
				}
			);
		});
	});

	describe('TiledeskClient - test 10', function() {
		it('test 10 - Join group (get group messages history, 1 message). User1 (owner) creates a group with 2 members (User1, User2). \
User1 sends 1 message. \
User1 adds User3 to the group. \
User3 receives the (only) message previously sent by User1 to the group', function(done) {
			const group_id = "group-" + uuid();
			const group_name = "group-update test 8";
			const MESSAGE1_USER1 = "user1, first";
			let group_members = {};
			// group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			chatClient3.onMessageAdded((message, topic) => {
				logger.log("test 10 - Client3 - message added:", JSON.stringify(message));
				if (
					message &&
					message.recipient === group_id &&
					message.text === MESSAGE1_USER1) {
					logger.log("test 10 - MESSAGE1_USER1 message received:", message.text);
					done();
				}
			});
			chatClient1.createGroup(
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
								logger.log("Error sending message:", err);
							}
							logger.log("Message sent:", msg);
							await new Promise(resolve => setTimeout(resolve, 1000)); // it gives time to message to reach the "persistent" status
							chatClient1.joinGroup(group_id, user3.userid, (err, json) => {
								if (err) {
									logger.log("test 10 - member joinned error:", err);
								}
								logger.log("test 10 - member joined json:", json);
							});
						}
					);
				}
			);
		});
	});

// 	describe('TiledeskClient - test 11', function() {
// 		it('\
// test 11 - Join group (get FULL group messages history). \
// User1 (owner) creates a group with 2 members (User1, User2). \
// User1 sends 1 message. \
// User1 adds User3 to the group. \
// User3 receives all the 4 group messages: \
// all info messages (GROUP_CREATED, USER1 MEMBER_JOINED_GROUP, USER2 MEMBER_JOINED_GROUP, USER3 MEMBER_JOINED_GROUP) \
// and the message sent by USER1 \
// previously sent by user1 & user2', function(done) {
// 			const group_id = "group-" + uuid();
// 			const group_name = "group-update test 8";
// 			const MESSAGE1_USER1 = "user1, first";
// 			let group_members = {};
// 			group_members[user1.userid] = 1;
// 			group_members[user2.userid] = 1;
// 			let history_messages = {};
// 			chatClient3.onMessageAdded((message, topic) => {
// 				logger.log("test 11 - Client3 - message added:", JSON.stringify(message));
// 				if (
// 					message &&
// 					message.recipient === group_id &&
// 					message.text === MESSAGE1_USER1) {
// 					logger.log("test 11 - MESSAGE1_USER1 message received:", message.text);
// 					history_messages['MESSAGE1_USER1'] = 1;
// 					// logger.log("****** HISTORY: ", history_messages)
// 					// if (history_messages['MESSAGE1_USER1'] === 1 &&
// 					// 	history_messages['GROUP_CREATED'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user1'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user2'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user3'] === 1) {
// 					// 	logger.log("test 11 - ALL HISTORY RECEIVED");
// 					// 	done();
// 					// }
// 				}
// 				else if (
// 					message &&
// 					message.recipient === group_id &&
// 					message.attributes &&
// 					message.attributes.messagelabel &&
// 					message.attributes.messagelabel.key &&
// 					message.attributes.messagelabel.parameters &&
// 					message.attributes.messagelabel.parameters.creator &&
// 					message.attributes.messagelabel.key === 'GROUP_CREATED' &&
// 					message.attributes.messagelabel.parameters.creator === user1.userid) {
// 					logger.log("test 11 - GROUP_CREATED message received:", message.text);
// 					history_messages['GROUP_CREATED'] = 1;
// 					// if (history_messages['MESSAGE1_USER1'] === 1 &&
// 					// 	history_messages['GROUP_CREATED'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user1'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user2'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user3'] === 1) {
// 					// 	logger.log("test 11 - ALL HISTORY RECEIVED");
// 					// 	done();
// 					// }
// 				}
// 				else if (
// 					message &&
// 					message.recipient === group_id &&
// 					message.attributes &&
// 					message.attributes.messagelabel &&
// 					message.attributes.messagelabel.key &&
// 					message.attributes.messagelabel.parameters &&
// 					message.attributes.messagelabel.parameters.member_id &&
// 					message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
// 					message.attributes.messagelabel.parameters.member_id === user1.userid) {
// 					logger.log("test 11 - MEMBER_JOINED_GROUP_user1 message received:", message.text);
// 					history_messages['MEMBER_JOINED_GROUP_user1'] = 1;
// 					// if (history_messages['MESSAGE1_USER1'] === 1 &&
// 					// 	history_messages['GROUP_CREATED'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user1'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user2'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user3'] === 1) {
// 					// 	logger.log("test 11 - ALL HISTORY RECEIVED");
// 					// 	done();
// 					// }
// 				}
// 				else if (
// 					message &&
// 					message.recipient === group_id &&
// 					message.attributes &&
// 					message.attributes.messagelabel &&
// 					message.attributes.messagelabel.key &&
// 					message.attributes.messagelabel.parameters &&
// 					message.attributes.messagelabel.parameters.member_id &&
// 					message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
// 					message.attributes.messagelabel.parameters.member_id === user2.userid) {
// 					logger.log("test 11 - MEMBER_JOINED_GROUP_user2 message received:", message.text);
// 					history_messages['MEMBER_JOINED_GROUP_user2'] = 1;
// 					// if (history_messages['MESSAGE1_USER1'] === 1 &&
// 					// 	history_messages['GROUP_CREATED'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user1'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user2'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user3'] === 1) {
// 					// 	logger.log("test 11 - ALL HISTORY RECEIVED");
// 					// 	done();
// 					// }
// 				}
// 				else if (
// 					message &&
// 					message.recipient === group_id &&
// 					message.attributes &&
// 					message.attributes.messagelabel &&
// 					message.attributes.messagelabel.key &&
// 					message.attributes.messagelabel.parameters &&
// 					message.attributes.messagelabel.parameters.member_id &&
// 					message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
// 					message.attributes.messagelabel.parameters.member_id === user3.userid) {
// 					logger.log("test 11 - MEMBER_JOINED_GROUP_user3 message received:", message.text);
// 					history_messages["MEMBER_JOINED_GROUP_user3"] = 1;
// 					// if (history_messages['MESSAGE1_USER1'] === 1 &&
// 					// 	history_messages['GROUP_CREATED'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user1'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user2'] === 1 &&
// 					// 	history_messages['MEMBER_JOINED_GROUP_user3'] === 1) {
// 					// 	logger.log("test 11 - ALL HISTORY RECEIVED");
// 					// 	done();
// 					// }
// 				}
// 				if (history_messages['MESSAGE1_USER1'] === 1 &&
// 					history_messages['GROUP_CREATED'] === 1 &&
// 					history_messages['MEMBER_JOINED_GROUP_user1'] === 1 &&
// 					history_messages['MEMBER_JOINED_GROUP_user2'] === 1 &&
// 					history_messages['MEMBER_JOINED_GROUP_user3'] === 1) {
// 					logger.log("test 11 - ALL HISTORY RECEIVED");
// 					done();
// 				}
// 			});
// 			chatClient1.createGroup(
// 				group_name,
// 				group_id,
// 				group_members,
// 				async (err, result) => {
// 					assert(err == null);
// 					assert(result != null);
// 					assert(result.success == true);
// 					assert(result.group.name === group_name);
// 					logger.log("test 11 - group:", group_id, "created");
// 					chatClient1.sendMessageRaw(
// 						{
// 							text: MESSAGE1_USER1,
// 							type: TYPE_TEXT,
// 							recipient_fullname: group_name,
// 							sender_fullname: user1.fullname,
// 							attributes: null,
// 							metadata: null,
// 							channel_type: CHANNEL_TYPE_GROUP
// 						},
// 						group_id, // recipient
// 						async (err, msg) => {
// 							if (err) {
// 								logger.log("Error sending message:", err);
// 							}
// 							logger.log("Message sent:", msg);
// 							await new Promise(resolve => setTimeout(resolve, 1000)); // it gives time to message to reach the "persistent" status
// 							chatClient1.joinGroup(group_id, user3.userid, (err, json) => {
// 								if (err) {
// 									logger.log("test 11 - member joinned error:", err);
// 								}
// 								logger.log("test 11 - member joined json:", json);
// 							});
// 						}
// 					);
// 				}
// 			);
// 		});
// 	});

});
