#!/usr/bin/env node

/**
 * Module dependencies.
 */
 
require('dotenv').config(); 

const logger = require('./tiledesk-logger').logger;

var observer = require('./observer');
var startServer = observer.startServer;


let active_queues_env_string = null;

if (process.env.ACTIVE_QUEUES) {
  logger.debug("Found process.env.ACTIVE_QUEUES:", process.env.ACTIVE_QUEUES);
  if (process.env.ACTIVE_QUEUES.trim().toLowerCase() === "none") {
    active_queues_env_string = "none";
  }
  else {
    active_queues_env_string = process.env.ACTIVE_QUEUES;
  }
}
// let ALL_SUBSCRIPTIONS_TOPICS = [
//   'outgoing',
//   'update',
//   'persist',
//   'archive',
//   'presence',
//   'update_group',
//   'delivered'
// ];
let active_queues = {};
// let ALL_SUBSCRIPTIONS_TOPICS = {
//   'outgoing': true,
//   'update': true,
//   'persist': true,
//   'archive': true,
//   'presence': true,
//   'update_group': true,
//   'delivered': true
// };
let ALL_SUBSCRIPTIONS_TOPICS = {
  'messages': true,
  'persist': true
};
// let ALL_SUBSCRIPTIONS_TOPICS_AS_KEYS;
// ALL_SUBSCRIPTIONS_TOPICS.forEach(e => {ALL_SUBSCRIPTIONS_TOPICS_AS_KEYS[e] = true});
if (active_queues_env_string === null) {
  active_queues = ALL_SUBSCRIPTIONS_TOPICS;
  logger.info("(Observer) ACTIVE_QUEUES unset. Using default (all: messages & persist):", active_queues);
}
else if (active_queues_env_string === "none") {
  logger.error("(Observer) Not ACTIVE_QUEUES enabled. Going on anyway...");
  logger.error("(Observer) To activate queues use syntax: active_queues=messages,persist (valid topics: messages | persist | messages,persist)");
}
else {
  let active_queues_env_array = active_queues_env_string.split(",");
  logger.info("(Observer) ACTIVE_QUEUES found:", active_queues_env_array);
  if (active_queues_env_array.length == 0) {
    logger.error("(Observer) Not ACTIVE_QUEUES enabled.");
    logger.error("(Observer) To activate queues use syntax: active_queues=messages,persist (valid topics: messages | persist | messages,persist)");
    process.exit(1);
  }
  else {
    active_queues_env_array.forEach((e,i) => {
      topic = e.trim();
      if (!ALL_SUBSCRIPTIONS_TOPICS[topic]) {
        logger.error("Invalid subscription topic:", topic);
        logger.error("Use syntax: active_queues=outgoing,persist (valid topics: outgoing,update,persist,archive,presence,update_group,delivered)");
        process.exit(1);
      }
      else {
        active_queues[topic] = true;
      }
    });
  }
}

var webhook_enabled = process.env.WEBHOOK_ENABLED;
if (webhook_enabled == undefined || webhook_enabled === "true" || webhook_enabled === true ) {
  webhook_enabled = true;
}else {
  webhook_enabled = false;
}
logger.debug("webhook_enabled: " + webhook_enabled);

let webhook_endpoints_array = null;
let env_webhook_endpoints = process.env.WEBHOOK_ENDPOINTS;
if (env_webhook_endpoints) {
  webhook_endpoints_array = env_webhook_endpoints.split(/\s*[,]\s*/);
}
logger.debug("webhook_endpoints_array: ", webhook_endpoints_array);

let webhook_events_array = null;
if (process.env.WEBHOOK_EVENTS) {
  // logger.log(typeof process.env.WEBHOOK_EVENTS);
  const webhook_events = process.env.WEBHOOK_EVENTS;
  webhook_events_array = webhook_events.split(",");
}
logger.info("(Observer) webhook_events_array: " , webhook_events_array);

let presence_enabled = false;
logger.debug("process.env.PRESENCE_ENABLED:", process.env.PRESENCE_ENABLED)
if (process.env.PRESENCE_ENABLED && process.env.PRESENCE_ENABLED === "true") {
  presence_enabled = true;
  logger.debug("(Observer) Presence manager enabled.");
}
else {
  logger.debug("(Observer) Presence manager disabled.");
}

let durable_enabled = true;
// logger.debug("process.env.DURABLE_ENABLED:", process.env.DURABLE_ENABLED)
// if (process.env.DURABLE_ENABLED && process.env.DURABLE_ENABLED === "false") {
//   durable_enabled = false;
//   logger.info("(Observer) Durable disabled.");
// }


logger.info("Starting observer (DURABLE_ENABLED disabled)");
async function start() {
  observer.setPresenceEnabled(presence_enabled);
  observer.setDurableEnabled(durable_enabled);
  observer.setWebHookEnabled(webhook_enabled);
  observer.setWebHookEndpoints(webhook_endpoints_array);
  observer.setWebHookEvents(webhook_events_array);
  observer.setActiveQueues(active_queues);
  if (process.env.PREFETCH_MESSAGES) {// && process.env.PREFETCH_MESSAGES > 0) {
    prefetch = parseInt(process.env.PREFETCH_MESSAGES);
    if (prefetch > 0) {
      logger.log("Set prefetch messages number:", prefetch);
      observer.setPrefetchMessages(prefetch);
    }
  }
  else {
    logger.log("Using default prefetch messages number.");
  }
  // observer.setPersistentMessages(true);

  await startServer({
    app_id: process.env.APP_ID,
    exchange: 'amq.topic',
    rabbitmq_uri:process.env.RABBITMQ_URI,
    mongo_uri: process.env.MONGODB_URI,
    redis_enabled: process.env.CHAT21OBSERVER_CACHE_ENABLED,
    redis_host: process.env.CHAT21OBSERVER_REDIS_HOST,
    redis_port: process.env.CHAT21OBSERVER_REDIS_PORT,
    redis_password: process.env.CHAT21OBSERVER_REDIS_PASSWORD
  });
}
start();

module.exports = { observer: observer};

