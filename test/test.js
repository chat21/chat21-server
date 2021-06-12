var assert = require('assert');
const { Chat21Client } = require('../mqttclient/chat21client.js');

const user1 = {
	userid: '03-ANDREALEO',
	fullname: 'Andrea Leo',
	firstname: 'Andrea',
	lastname: 'Leo',
	token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzMDFjMDZjYi0zYTE3LTQzOGMtOWY1Yy1jODM0Mjk2NzJjYzAiLCJzdWIiOiIwMy1BTkRSRUFMRU8iLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjAzLUFORFJFQUxFTy4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuMDMtQU5EUkVBTEVPLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiMDMtQU5EUkVBTEVPIiwiY2lkIjoiMDMtQU5EUkVBTEVPIiwiYXpwIjoiMDMtQU5EUkVBTEVPIiwidXNlcl9pZCI6IjAzLUFORFJFQUxFTyIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjIzNTA4OTQ4LCJleHAiOjE5MzQ1NDg5NDgsImF1ZCI6WyJyYWJiaXRtcSIsIjAzLUFORFJFQUxFTyJdLCJraWQiOiJ0aWxlZGVzay1rZXkiLCJ0aWxlZGVza19hcGlfcm9sZXMiOiJ1c2VyIn0.QfRvEoibSw-p3AjIHWu4obQeNzrpWom0DLDZOuruShM'
};
const user2 = {
	userid: '82004a48ed067c0012dd32dd',
	fullname: 'Nico Lanzo',
	firstname: 'Nico',
	lastname: 'Lanzo',
	token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzNjMxODgxYy00NzQ1LTRlYTQtODliNC01YjI4MjY3YzU5YWYiLCJzdWIiOiI4MjAwNGE0OGVkMDY3YzAwMTJkZDMyZGQiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZC4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwiY2lkIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwiYXpwIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwidXNlcl9pZCI6IjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZCIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjIzNTA4OTQ4LCJleHAiOjE5MzQ1NDg5NDgsImF1ZCI6WyJyYWJiaXRtcSIsIjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZCJdLCJraWQiOiJ0aWxlZGVzay1rZXkiLCJ0aWxlZGVza19hcGlfcm9sZXMiOiJ1c2VyIn0.-EFs5wQomfnLA8zcFKI7g_pThwskQFw7w3QKspC8fwc'
}

describe('TiledeskClient', function() {
  describe('User connects', function() {
      it('User connects to the RabbbitMQ server through MQTT client', function(done) {
        let chatClient = new Chat21Client(
			{
				appId: "tilechat",
				MQTTendpoint: 'ws://localhost:15675/ws'
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

describe('TiledeskClient', function() {
	describe('Direct message', function() {
		it('User sends a direct message using client.sendMessage()', function(done) {
		  let chatClient = new Chat21Client(
			  {
				  appId: "tilechat",
				  MQTTendpoint: 'ws://localhost:15675/ws'
			  }
		  );
		  chatClient.connect(user1.userid, user1.token, () => {
			  console.log("Connected...");
			  chatClient.sendMessage(
				  'test',
				  'direct',
				  user2.userid,
				  user2.fullname,
				  user1.fullname,
				  null,
				  null,
				  'chat21',
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

  describe('TiledeskClient', function() {
	describe('Direct message', function() {
		it('User1 sends a direct message and User2 receives the message', function(done) {
		  let chatClient1 = new Chat21Client(
			  {
				  appId: "tilechat",
				  MQTTendpoint: 'ws://localhost:15675/ws'
			  }
		  );
		  let chatClient2 = new Chat21Client(
			{
				appId: "tilechat",
				MQTTendpoint: 'ws://localhost:15675/ws'
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
				  'direct',
				  user2.userid,
				  user2.fullname,
				  user1.fullname,
				  null,
				  null,
				  'chat21',
				  () => {
					  console.log("Message sent.");
					  chatClient1.close(() => {
						console.log("...and CLient 1 successfully disconnected.");
					  });
			  	  }
			  );
		  });
		});
	});
  });