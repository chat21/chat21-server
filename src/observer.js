const mongodb = require("mongodb");
const { ChatDB } = require('./chatdb/index.js');
const { Webhooks } = require("./webhooks");
const { TdCache } = require('./TdCache.js');
const RateManager = require('./services/RateManager.js');
const logger = require('./tiledesk-logger').logger;

const MQService = require('./services/MQService');
const GroupService = require('./services/GroupService');
const MessageService = require('./services/MessageService');

let app_id, exchange, chatdb, webhooks, tdcache, rate_manager;
let mqService, groupService, messageService;
let webhook_enabled = true, presence_enabled, durable_enabled, redis_enabled = false;
let autoRestartProperty, prefetch_messages = 10;
let webhook_endpoints_array, webhook_events_array;
let active_queues = { 'messages': true, 'persist': true };

async function startServer(config = {}) {
  app_id = config.app_id || "tilechat";
  exchange = config.exchange || 'amq.topic';
  const rabbitmq_uri = config.rabbitmq_uri || process.env.RABBITMQ_URI;
  const mongouri = config.mongodb_uri || process.env.MONGODB_URI;

  if (!rabbitmq_uri || !mongouri) throw new Error('Missing RABBITMQ_URI or MONGODB_URI');

  const client = await mongodb.MongoClient.connect(mongouri);
  chatdb = new ChatDB({ database: client.db() });

  if (config.redis_enabled && (config.redis_enabled === "true" || config.redis_enabled === true)) {
    redis_enabled = true;
    tdcache = new TdCache({ host: config.redis_host, port: config.redis_port, password: config.redis_password });
    await tdcache.connect().catch(() => process.exit(1));
    rate_manager = new RateManager({ tdCache: tdcache });
  }

  if (webhook_enabled) {
    webhooks = new Webhooks({
      appId: app_id, RABBITMQ_URI: rabbitmq_uri, exchange,
      webhook_endpoints: webhook_endpoints_array, webhook_events: webhook_events_array,
      queue_name: 'webhooks', durable_enabled, prefetch_messages, logger
    });
    webhooks.enabled = true;
    await webhooks.start();
  }

  mqService = new MQService({
    rabbitmq_uri, exchange, prefetch_messages, durable_enabled, active_queues,
    autoRestart: (process.env.AUTO_RESTART || autoRestartProperty) !== "false"
  });

  groupService = new GroupService({ chatdb, tdcache, redis_enabled });

  messageService = new MessageService({
    app_id, mqService, chatdb, webhooks, groupService, rate_manager,
    presence_enabled, webhook_enabled, exchange, webhook_endpoints_array
  });

  await mqService.connect();
  
  const topics = {
    messages: [
      `apps.${app_id}.outgoing.users.*.messages.*.outgoing`,
      `apps.${app_id}.users.#.update`,
      `apps.${app_id}.users.#.archive`,
      `apps.${app_id}.users.*.presence.*`,
      `apps.observer.${app_id}.groups.update`,
      `apps.observer.${app_id}.users.*.messages.*.delivered`
    ],
    persist: [`apps.observer.${app_id}.users.*.messages.*.persist`]
  };

  mqService.startWorker(topics, (msg) => messageService.processMsg(msg));
  logger.info("Observer started.");
}

function stopServer(callback) {
  if (mqService) mqService.close(callback);
  else if (callback) callback();
}

module.exports = {
  startServer, stopServer,
  setAutoRestart: (v) => autoRestartProperty = v,
  getWebhooks: () => webhooks,
  setWebHookEnabled: (v) => { webhook_enabled = v; if (webhooks) webhooks.setWebHookEnabled(v); },
  setWebHookEndpoints: (v) => { webhook_endpoints_array = v; if (webhooks) webhooks.setWebHookEndpoints(v); },
  setWebHookEvents: (v) => { webhook_events_array = v; if (webhooks) webhooks.setWebHookEvents(v); },
  setPresenceEnabled: (v) => presence_enabled = v,
  setDurableEnabled: (v) => durable_enabled = v,
  setActiveQueues: (v) => active_queues = v,
  setPrefetchMessages: (v) => prefetch_messages = v,
  logger
};
