#!/usr/bin/env node

/**
 * Module dependencies.
 */
 
require('dotenv').config(); 

const logger = require('./tiledesk-logger').logger;

var observer = require('./observer');
var startServer = observer.startServer;


let subscription_topics_env_string = process.env.SUBSCRIPTION_TOPICS;
// let ALL_SUBSCRIPTIONS_TOPICS = [
//   'outgoing',
//   'update',
//   'persist',
//   'archive',
//   'presence',
//   'update_group',
//   'delivered'
// ];
let subscription_topics = {};
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
if (!subscription_topics_env_string) {
  subscription_topics = ALL_SUBSCRIPTIONS_TOPICS;
  logger.log("SUBSCRIPTION_TOPICS unset. Using default:", subscription_topics);
}
else {
  subscription_topics_env_array = subscription_topics_env_string.split(",");
  logger.log("SUBSCRIPTION_TOPICS found:", subscription_topics_env_array)
  if (subscription_topics_env_array.length == 0) {
    logger.error("SUBSCRIPTION_TOPICS length cant be ZERO.");
    logger.error("Use syntax: SUBSCRIPTION_TOPICS=outgoing,persist (valid topics: outgoing,update,persist,archive,presence,update_group,delivered)");
    process.exit(1);
  }
  subscription_topics_env_array.forEach((e,i) => {
    topic = e.trim();
    if (!ALL_SUBSCRIPTIONS_TOPICS[topic]) {
      logger.error("Invalid subscription topic:", topic);
      logger.error("Use syntax: SUBSCRIPTION_TOPICS=outgoing,persist (valid topics: outgoing,update,persist,archive,presence,update_group,delivered)");
      process.exit(1);
    }
    else {
      subscription_topics[topic] = true;
    }
  });
}
logger.debug("webhook_enabled: " + webhook_enabled);

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
      observer.setSubscriptionTopics(subscription_topics);
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

      await startServer({app_id: process.env.APP_ID, exchange: 'amq.topic', rabbitmq_uri:process.env.RABBITMQ_URI, mongo_uri: process.env.MONGODB_URI});
}
start();

module.exports = { observer: observer};

