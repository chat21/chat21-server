const axios = require('axios');
require('dotenv').config();
const { Chat21Client } = require('../mqttclient/chat21client.js');

let TILEDESK_PROJECT_ID = "";
if (process.env && process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID) {
	TILEDESK_PROJECT_ID = process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID
    // console.log("TILEDESK_PROJECT_ID:", TILEDESK_PROJECT_ID);
}
else {
    throw new Error(".env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID is mandatory");
}

// console.log("process.env.PERFORMANCE_TEST_MQTT_ENDPOINT:", process.env.PERFORMANCE_TEST_MQTT_ENDPOINT);
let MQTT_ENDPOINT = "";
if (process.env && process.env.PERFORMANCE_TEST_MQTT_ENDPOINT) {
	MQTT_ENDPOINT = process.env.PERFORMANCE_TEST_MQTT_ENDPOINT
    // console.log("MQTT_ENDPOINT:", MQTT_ENDPOINT);
}
else {
    throw new Error(".env.PERFORMANCE_TEST_MQTT_ENDPOINT is mandatory");
}

let API_ENDPOINT = "";
if (process.env && process.env.PERFORMANCE_TEST_API_ENDPOINT) {
	API_ENDPOINT = "http://35.198.150.252/api"; //process.env.PERFORMANCE_TEST_API_ENDPOINT
    // console.log("API_ENDPOINT:", API_ENDPOINT);
}
else {
    throw new Error(".env.PERFORMANCE_TEST_API_ENDPOINT is mandatory");
}

let data = JSON.stringify({
  "id_project": TILEDESK_PROJECT_ID
});

ANONYMOUS_TOKEN_URL = API_ENDPOINT + '/auth/signinAnonymously';
// console.log("Getting ANONYMOUS_TOKEN_URL:", ANONYMOUS_TOKEN_URL);

let config = {
  method: 'post',
//   maxBodyLength: Infinity,
  url: ANONYMOUS_TOKEN_URL, //'https://api.tiledesk.com/v3/auth/signinAnonymously',
  headers: { 
    'Content-Type': 'application/json'
  },
  data : data
};

axios.request(config)
.then((response) => {
//   console.log("Got Anonymous Token:", JSON.stringify(response.data.token));
  CHAT21_TOKEN_URL = API_ENDPOINT + '/chat21/native/auth/createCustomToken';
//   console.log("Getting CHAT21_TOKEN_URL:", CHAT21_TOKEN_URL);
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: CHAT21_TOKEN_URL, //'https://api.tiledesk.com/v3/chat21/native/auth/createCustomToken',
        headers: { 
            'Authorization': response.data.token
        }
    };

    axios.request(config)
    .then((response) => {
        // console.log("response.data:", typeof response.data, response.data);
        const mqtt_token = response.data.token;
        const chat21_userid = response.data.userid;
        console.log("chat21 userid:", chat21_userid);
        // console.log("chat21 token:", mqtt_token);
        goMQTTConnection(chat21_userid, mqtt_token);
    })
    .catch((error) => {
        console.log(error);
    });

})
.catch((error) => {
  console.log(error);
});

function goMQTTConnection(userid, mqtt_token) {
    let chatClient1 = new Chat21Client(
        {
            appId: "tilechat",
            MQTTendpoint: MQTT_ENDPOINT,
            APIendpoint: API_ENDPOINT,
            log: false
        });
        console.log("Connecting...");
        chatClient1.connect(userid, mqtt_token, () => {
            console.log("chatClient1 Subscribed...");
        });
}