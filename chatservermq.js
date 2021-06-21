#!/usr/bin/env node

/**
 * Module dependencies.
 */
 
require('dotenv').config(); 

// const winston = require("./winston");
const logger = require('./tiledesk-logger').logger;

var observer = require('./observer');
var startServer = observer.startServer;




var webhook_enabled = process.env.WEBHOOK_ENABLED;
if (webhook_enabled == undefined || webhook_enabled === "true" || webhook_enabled === true ) {
  webhook_enabled = true;
}else {
  webhook_enabled = false;
}
logger.debug("webhook_enabled: " + webhook_enabled);


var webhook_endpoint = process.env.WEBHOOK_ENDPOINT;
logger.debug("webhook_endpoint: " + webhook_endpoint);


let webhook_events_array = null;
if (process.env.WEBHOOK_EVENTS) {
  // logger.log(typeof process.env.WEBHOOK_EVENTS);
  const webhook_events = process.env.WEBHOOK_EVENTS;
  webhook_events_array = webhook_events.split(",");
}
logger.info("webhook_events_array: " , webhook_events_array);



logger.info("Starting observer")
async function start() {

      observer.setWebHookEnabled(webhook_enabled);
      observer.setWebHookEndpoint(webhook_endpoint);
      observer.setWebHookEvents(webhook_events_array);
      // observer.setPersistentMessages(true);

      await startServer({app_id: process.env.APP_ID, exchange: 'amq.topic', rabbitmq_uri:process.env.RABBITMQ_URI, mongo_uri: process.env.MONGODB_URI});
}
start();

module.exports = { observer: observer};

