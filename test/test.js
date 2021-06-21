var assert = require('assert');
const { uuid } = require('uuidv4');
const { Chat21Client } = require('../mqttclient/chat21client.js');

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

// LOCAL
const MQTT_ENDPOINT = 'ws://localhost:15675/ws';
const API_ENDPOINT = 'http://localhost:8004/api'

// REMOTE
// const MQTT_ENDPOINT = 'mqtt://99.80.197.164:15675/ws';
// const API_ENDPOINT = 'http://99.80.197.164:8004/api';

const APPID = 'tilechat';

describe('TiledeskClient - test 1', function() {
  describe('User connects', function() {
      it('User connects to the RabbbitMQ server through MQTT client', function(done) {
        let chatClient = new Chat21Client(
			{
				appId: APPID,
				MQTTendpoint: MQTT_ENDPOINT
			}
		);
		chatClient.connect(user1.userid, user1.token, () => {
			console.log("Connected...");
			chatClient.close(() => {
				console.log("...and successfully disconnected.");
				done();
			})
		});
      });
  });
});

describe('TiledeskClient - test 2', function() {
	describe('Direct message', function() {
		it('User sends a direct message using client.sendMessage()', function(done) {
		  let chatClient = new Chat21Client(
			  {
				  appId: APPID,
				  MQTTendpoint: MQTT_ENDPOINT
			  }
		  );
		  chatClient.connect(user1.userid, user1.token, () => {
			  console.log("Connected...");
			  chatClient.sendMessage(
				  'test',
				  'text',
				  user2.userid,
				  user2.fullname,
				  user1.fullname,
				  null,
				  null,
				  'direct',
				  () => {
					  console.log("Message sent.");
					  chatClient.close(() => {
						console.log("...and successfully disconnected.");
						done();
					  });
			  	  }
			  );
		  });
		});
	});
  });

describe('TiledeskClient - test 3', function() {
	describe('Direct message', function() {
		it('User1 sends a direct message and User2 receives the message', function(done) {
		  let chatClient1 = new Chat21Client(
			  {
				  appId: APPID,
				  MQTTendpoint: MQTT_ENDPOINT
			  }
		  );
		  let chatClient2 = new Chat21Client(
			{
				appId: APPID,
				MQTTendpoint: MQTT_ENDPOINT
			}
		  );
		  chatClient2.connect(user2.userid, user2.token, () => {
				console.log("User2 connected...");
				chatClient2.onMessageAdded((message, topic) => {
					console.log("message added:", message);
					assert(message != null);
        			assert(message.text != null);
					assert(message.text === 'test');
					chatClient2.close(() => {
						console.log("...and Client 2 successfully disconnected.");
						done();
					});
				});
		  });

		  chatClient1.connect(user1.userid, user1.token, () => {
			  console.log("User1 connected...");
			  chatClient1.sendMessage(
				  'test',
				  'text',
				  user2.userid,
				  user2.fullname,
				  user1.fullname,
				  null,
				  null,
				  'direct',
				  () => {
					  console.log("Message sent.");
					  chatClient1.close(() => {
						console.log("...and Client 1 successfully disconnected.");
					  });
			  	  }
			  );
		  });
		});
	});
  });

describe('TiledeskClient - test 4', function() {
	describe('Create group', function() {
		it('Creates a group', function(done) {
			const group_id = "group-" + uuid();
			const group_name = "test group";
			const group_members = {}
			group_members[user2.userid] = 1;
			let chatClient = new Chat21Client(
				{
					appId: APPID,
					MQTTendpoint: MQTT_ENDPOINT,
					APIendpoint: API_ENDPOINT
				}
			);
			chatClient.connect(user1.userid, user1.token, () => {
				console.log("Connected...");
				chatClient.createGroup(
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
						console.log("Group created:", result);
						chatClient.close(() => {
							console.log("...successfully disconnected.");
							done();
						});
					}
				);
			});
		});
	});
  });

describe('TiledeskClient - test 5', function() {
	describe('Creates group with 2 members', function() {
		it('Creates a group with 2 members, each added member receives the MEMBER_JOINED_GROUP message', function(done) {
			const group_id = "group-" + uuid();
			const group_name = "test group";
			const group_members = {}
			group_members[user2.userid] = 1;
			let chatClient1 = new Chat21Client( // group creator
				{
					appId: APPID,
					MQTTendpoint: MQTT_ENDPOINT,
					APIendpoint: API_ENDPOINT
				}
			);
			let chatClient2 = new Chat21Client( // group member, will receive added-to-group message
				{
					appId: APPID,
					MQTTendpoint: MQTT_ENDPOINT
				}
			  );
			  chatClient2.connect(user2.userid, user2.token, () => {
					console.log("User2 connected...");
					let messages = {}
					console.log("messages:", messages);
					const GROUP_CREATED_KEY = 'group created';
					const USER1_JOINED_KEY = 'user1 joined';
					const USER2_JOINED_KEY = 'user2 joined';
					chatClient2.onMessageAdded((message, topic) => {
						console.log("message added:", JSON.stringify(message));
						if (
							message &&
							message.attributes &&
							message.attributes.messagelabel &&
							message.attributes.messagelabel.key &&
							message.attributes.messagelabel.parameters &&
							message.attributes.messagelabel.parameters.creator &&
							message.attributes.messagelabel.key === 'GROUP_CREATED' &&
							message.attributes.messagelabel.parameters.creator === user1.userid) {
							messages[GROUP_CREATED_KEY] = true;
						}
						if (
							message &&
							message.attributes &&
							message.attributes.messagelabel &&
							message.attributes.messagelabel.key &&
							message.attributes.messagelabel.parameters &&
							message.attributes.messagelabel.parameters.member_id &&
							message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
							message.attributes.messagelabel.parameters.member_id === user2.userid) {
							messages[USER2_JOINED_KEY] = true;
						}
						if (
							message &&
							message.attributes &&
							message.attributes.messagelabel &&
							message.attributes.messagelabel.key &&
							message.attributes.messagelabel.parameters &&
							message.attributes.messagelabel.parameters.member_id &&
							message.attributes.messagelabel.key === 'MEMBER_JOINED_GROUP' &&
							message.attributes.messagelabel.parameters.member_id === user1.userid) {
							messages[USER1_JOINED_KEY] = true;
						}
						if (Object.keys(messages).length == 3) { // all 3 messages were successfully received
							chatClient2.close(() => {
								console.log("...all messages received and Client2 disconnected.");
								done();
							});
						}
					});
			  });
			chatClient1.connect(user1.userid, user1.token, () => {
				console.log("Connected...");
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
						console.log("Group created:", result);
						chatClient1.close(() => {
							console.log("...successfully disconnected.");
						});
					}
				);
			});
		});
	});
  });

describe('TiledeskClient - test 6', function() {
	describe('Creates group with 3 members, group creator (User1) sends a message to the group and receives the sent message', function() {
		it('Group creator (User1) sends a message to the group and receives the sent message.', function(done) {
			const group_id = "group-" + uuid();
			const group_name = "Test Group";
			const group_members = {}
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			group_members[user3.userid] = 1;
			const SENT_MESSAGE = 'Hello guys';
			let chatClient1 = new Chat21Client( // group creator
				{
					appId: APPID,
					MQTTendpoint: MQTT_ENDPOINT,
					APIendpoint: API_ENDPOINT
				}
			);
			chatClient1.connect(user1.userid, user1.token, () => {
				console.log("User1 (group owner) connected...");
				chatClient1.createGroup(
					group_name,
					group_id,
					group_members,
					(err, result) => {
						assert(err == null);
						assert(result != null);
						assert(result.success == true);
						assert(result.group.name === group_name);
						chatClient1.onMessageAdded((message, topic) => {
							console.log("message added:", JSON.stringify(message));
							if (
								message &&
								message.text &&
								!message.attributes &&
								message.text === SENT_MESSAGE
								) {
								chatClient1.close(() => {
									console.log("...and Client 1 successfully disconnected.");
									done();
								});
							}
						});
						chatClient1.sendMessage(
							SENT_MESSAGE,
							'text',
							'group-527984e5-4305-43db-873e-5f899e764c7f',
							group_name,
							user1.fullname,
							null,
							null,
							'group',
							() => {
								console.log("Message sent to group", group_name);
							}
						);
					}
				);
			});
		});
	});
  });

  describe('TiledeskClient - test 7', function() {
	describe('Creates group with 3 members, group creator sends a message to the group', function() {
		it('Creates group with 3 members, group creator (User1) sends a message to the group. User2 & User3 verify the reception of the creator message', function(done) {
			const group_id = "group-" + uuid();
			const group_name = "test send message group";
			const group_members = {}
			group_members[user1.userid] = 1;
			group_members[user2.userid] = 1;
			group_members[user3.userid] = 1;
			let received_messages = {}
			const USER1_RECEIVED_KEY = 'user1';
			const USER2_RECEIVED_KEY = 'user2';
			const USER3_RECEIVED_KEY = 'user3';
			const SENT_MESSAGE = "Welcome everybody 2";
			let chatClient1 = new Chat21Client( // group creator
				{
					appId: APPID,
					MQTTendpoint: MQTT_ENDPOINT,
					APIendpoint: API_ENDPOINT
				}
			);
			let chatClient2 = new Chat21Client( // group member, will receive sent message
				{
					appId: APPID,
					MQTTendpoint: MQTT_ENDPOINT
				}
			  );
			  let chatClient3 = new Chat21Client( // group member, will receive sent message
				{
					appId: APPID,
					MQTTendpoint: MQTT_ENDPOINT
				}
			  );
			  chatClient2.connect(user2.userid, user2.token, () => {
					console.log("User2 connected...");
					chatClient2.onMessageAdded((message, topic) => {
						console.log("message added:", JSON.stringify(message));
						if (
							message &&
							message.text &&
							!message.attributes &&
							message.text === SENT_MESSAGE
							) {
								received_messages[USER2_RECEIVED_KEY] = true;
						}
						if (Object.keys(received_messages).length == 3) { // the message was successfully delivered
							chatClient1.close(() => {
								chatClient2.close(() => {
									chatClient3.close(() => {
										console.log("...all messages received and Client2 disconnected.");
										done();
									});
								});
							});
						}
					});
					chatClient3.connect(user3.userid, user3.token, () => {
						console.log("User3 connected...");
						chatClient3.onMessageAdded((message, topic) => {
							console.log("message added:", JSON.stringify(message));
							if (
								message &&
								message.text &&
								!message.attributes &&
								message.text === SENT_MESSAGE
								) {
									received_messages[USER3_RECEIVED_KEY] = true;
							}
							if (Object.keys(received_messages).length == 3) { // the message was successfully delivered
								chatClient1.close(() => {
									chatClient2.close(() => {
										chatClient3.close(() => {
											console.log("...all messages received and Client2 disconnected.");
											done();
										});
									});
								});
							}
						});
						chatClient1.connect(user1.userid, user1.token, () => {
							console.log("User1 (group owner) connected...");
							chatClient1.createGroup(
								group_name,
								group_id,
								group_members,
								(err, result) => {
									assert(err == null);
									assert(result != null);
									assert(result.success == true);
									assert(result.group.name === group_name);
									chatClient1.onMessageAdded((message, topic) => {
										console.log("message added:", JSON.stringify(message));
										if (
											message &&
											message.text &&
											!message.attributes &&
											message.text === SENT_MESSAGE
											) {
												received_messages[USER1_RECEIVED_KEY] = true;
										}
										if (Object.keys(received_messages).length == 3) { // the message was successfully delivered
											chatClient1.close(() => {
												chatClient2.close(() => {
													chatClient3.close(() => {
														console.log("...all messages received and Client2 disconnected.");
														done();
													});
												});
											});
										}
									});
									chatClient1.sendMessage(
										SENT_MESSAGE,
										'text',
										group_id,
										group_name,
										user1.fullname,
										null,
										null,
										'group',
										() => {
											console.log("Message sent to group", group_name);
										}
									);
								}
							);
						});
				  });
			  });
		});
	});
  });