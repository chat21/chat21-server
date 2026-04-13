/**
 * Analytics integration test.
 *
 * Verifies all three analytics events (message.delivered, message.return_receipt,
 * user.presence_changed) are correctly published to the tiledesk.analytics exchange
 * with the right id_project values.
 *
 * Prerequisites: RabbitMQ and MongoDB running (see docker-compose.yml).
 * Run via: npm run test:integration
 *
 * Design notes:
 *  - No MongoDB pre-seeding is required. id_project is resolved entirely from the
 *    in-memory messageProjectCache / userProjectCache that are populated during
 *    message.delivered processing — zero database round-trips.
 *  - Tests 2 and 3 each begin by publishing an outgoing message (triggering
 *    message.delivered and populating the cache), then fire the event under test.
 *  - Env vars are set in the before() hook, BEFORE startServer() is called.
 *  - A separate AMQP consumer connection declares the tiledesk.analytics exchange
 *    and binds a temp exclusive queue to capture emitted events for assertions.
 *  - AUTO_RESTART=false prevents the observer from looping on connection close.
 */

import amqp from 'amqplib/callback_api';
import mongodb from 'mongodb';
import assert from 'assert';
import {
  startServer,
  stopServer,
  setWebHookEnabled,
  setPresenceEnabled,
} from '../../observer';

// ─── Configuration ────────────────────────────────────────────────────────────

const RABBITMQ_URI          = process.env.RABBITMQ_URI           ?? 'amqp://guest:guest@localhost:5672';
const ANALYTICS_RABBITMQ_URI = process.env.ANALYTICS_RABBITMQ_URI ?? 'amqp://guest:guest@localhost:5673';
const MONGODB_URI            = process.env.MONGODB_URI            ?? 'mongodb://localhost:27017/chat21_integration_test';
const ANALYTICS_EXCHANGE     = 'tiledesk.analytics';

const TEST_PROJECT  = 'test-project-001';
const TEST_PROJECT2 = 'test-project-002';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsEnvelope {
  event_id:       string;
  event_type:     string;
  id_project:     string;
  timestamp:      string;
  source_service: string;
  event_version:  string;
  payload:        Record<string, unknown>;
}

// ─── Shared state ─────────────────────────────────────────────────────────────

let receivedEvents: AnalyticsEnvelope[] = [];
/** AMQP connection to the analytics broker — used only to consume analytics events. */
let consumerConn: amqp.Connection;
/** Channel on the analytics broker for consuming analytics events. */
let consumerChannel: amqp.Channel;
/**
 * Channel on the MAIN broker for publishing trigger messages.
 * The observer's worker queue is bound to the main broker, so trigger messages
 * (outgoing messages, updates, presence events) must be sent there.
 */
let publishConn: amqp.Connection;
let publishChannel: amqp.Channel;
let mongoClient: mongodb.MongoClient;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Polls receivedEvents until an event with the given type appears, or times out.
 */
function waitForEvent(eventType: string, timeoutMs = 8000): Promise<AnalyticsEnvelope> {
  return new Promise((resolve, reject) => {
    const start    = Date.now();
    const interval = setInterval(() => {
      const found = receivedEvents.find(e => e.event_type === eventType);
      if (found) {
        clearInterval(interval);
        resolve(found);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error(
          `Timed out waiting for analytics event '${eventType}' after ${timeoutMs}ms. ` +
          `Received so far: [${receivedEvents.map(e => e.event_type).join(', ')}]`
        ));
      }
    }, 100);
  });
}

/**
 * Promisified nested callback chain for AMQP consumer setup.
 * Opens a channel on consumerConn (analytics broker), declares the analytics
 * exchange, creates an exclusive queue bound with '#', and starts consuming
 * into receivedEvents.
 */
function setupConsumer(): Promise<amqp.Channel> {
  return new Promise((resolve, reject) => {
    consumerConn.createChannel((err, ch) => {
      if (err) return reject(new Error(`createChannel: ${err.message}`));

      // Declare the analytics exchange (topic, non-durable).
      // Must happen before startServer() so the observer can publish to it.
      ch.assertExchange(ANALYTICS_EXCHANGE, 'topic', { durable: false }, (err2) => {
        if (err2) return reject(new Error(`assertExchange: ${err2.message}`));

        // Exclusive, auto-delete queue — scoped to this connection.
        ch.assertQueue('', { exclusive: true }, (err3, ok) => {
          if (err3) return reject(new Error(`assertQueue: ${err3.message}`));

          // '#' matches all routing keys on the exchange.
          ch.bindQueue(ok.queue, ANALYTICS_EXCHANGE, '#', {}, (err4) => {
            if (err4) return reject(new Error(`bindQueue: ${err4.message}`));

            ch.consume(ok.queue, (msg) => {
              if (!msg) return;
              try {
                receivedEvents.push(
                  JSON.parse(msg.content.toString()) as AnalyticsEnvelope
                );
              } catch { /* ignore malformed messages */ }
            }, { noAck: true }, (err5) => {
              if (err5) return reject(new Error(`consume: ${err5.message}`));
              resolve(ch);
            });
          });
        });
      });
    });
  });
}

/**
 * Opens a plain channel on the main broker for publishing trigger messages.
 * The observer's worker queues are bound to the main broker (RABBITMQ_URI),
 * so outgoing messages / updates / presence events must be sent there.
 */
function setupPublisher(): Promise<amqp.Channel> {
  return new Promise((resolve, reject) => {
    amqp.connect(RABBITMQ_URI, (err, conn) => {
      if (err) return reject(new Error(`publisher AMQP connect failed: ${err.message}`));
      publishConn = conn;
      conn.createChannel((chErr, ch) => {
        if (chErr) return reject(new Error(`publisher createChannel: ${chErr.message}`));
        publishChannel = ch;
        resolve(ch);
      });
    });
  });
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Analytics integration', function () {
  this.timeout(30_000);

  // ── Global setup ────────────────────────────────────────────────────────────

  before(async function () {
    // Env vars are read by startServer() at call time — set them here before invoking it.
    process.env.ANALYTICS_ENABLED  = 'true';
    process.env.ANALYTICS_EXCHANGE = ANALYTICS_EXCHANGE;
    process.env.AUTO_RESTART       = 'false'; // prevent reconnect loops in tests
    process.env.METRICS_PORT       = '9191';  // avoid port 9090 collision

    // 1. Connect consumer AMQP to the analytics broker, declare analytics exchange, set up receiver.
    await new Promise<void>((resolve, reject) => {
      amqp.connect(ANALYTICS_RABBITMQ_URI, (err, conn) => {
        if (err) return reject(new Error(`AMQP connect failed: ${err.message}`));
        consumerConn = conn;
        resolve();
      });
    });
    consumerChannel = await setupConsumer();

    // 2. Connect publisher AMQP to the MAIN broker for sending trigger messages.
    //    (The observer's worker queues are bound to the main broker, not the analytics broker.)
    publishChannel = await setupPublisher();

    // 2. MongoDB client (used only for teardown / DB drop — no pre-seeding needed).
    mongoClient = await mongodb.MongoClient.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // 3. Configure and start the observer in-process.
    setWebHookEnabled(false);   // no webhook side-effects
    setPresenceEnabled(true);   // required for presence analytics to fire

    await startServer({
      rabbitmq_uri:          RABBITMQ_URI,
      analytics_rabbitmq_uri: ANALYTICS_RABBITMQ_URI,
      mongodb_uri:           MONGODB_URI,
    });

    // Allow the observer's worker channel to finish asserting the queue and bindings.
    await new Promise<void>(r => setTimeout(r, 1000));
  });

  // ── Global teardown ─────────────────────────────────────────────────────────

  after(async function () {
    // Drop the test database so subsequent runs start clean.
    await mongoClient.db().dropDatabase();
    await mongoClient.close();

    // Close the observer's AMQP connection.
    await new Promise<void>(r => stopServer(r));

    // Close the publisher connection (main broker).
    await new Promise<void>((resolve, reject) =>
      publishConn.close((err) => (err ? reject(err) : resolve()))
    );

    // Close the consumer connection (analytics broker).
    await new Promise<void>((resolve, reject) =>
      consumerConn.close((err) => (err ? reject(err) : resolve()))
    );
  });

  // Clear captured events before each test so assertions are isolated.
  beforeEach(function () {
    receivedEvents = [];
  });

  // ── Test 1: message.delivered ────────────────────────────────────────────────

  it('emits message.delivered with correct id_project', async function () {
    const payload = JSON.stringify({
      text: 'hello integration test',
      attributes: { projectId: TEST_PROJECT },
    });

    // Routing key triggers process_outgoing() → deliverMessage() with status=DELIVERED.
    publishChannel.publish(
      'amq.topic',
      'apps.tilechat.outgoing.users.intuser1.messages.intuser2.outgoing',
      Buffer.from(payload)
    );

    const evt = await waitForEvent('message.delivered');

    assert.strictEqual(evt.id_project,          TEST_PROJECT, 'id_project should match projectId attribute');
    assert.strictEqual(evt.source_service,      'c21srv',     'source_service should be c21srv');
    assert.ok(typeof evt.payload.id_message === 'string' && evt.payload.id_message !== '',
      'payload.id_message should be a non-empty string (UUID assigned by observer)');
    assert.strictEqual(evt.payload.recipient_id, 'intuser2',  'recipient_id should be the message recipient');
  });

  // ── Test 2: message.return_receipt ───────────────────────────────────────────
  //
  // Strategy: publish an outgoing message first so deliverMessage() populates
  // the messageProjectCache (message_id → projectId). Then send the .update
  // message using the message_id captured from the message.delivered event.
  // Zero MongoDB queries — id_project is resolved from in-memory cache.

  it('emits message.return_receipt with correct id_project', async function () {
    // 2a. Publish an outgoing message to seed the in-memory cache.
    const outPayload = JSON.stringify({
      text: 'test message for return receipt',
      attributes: { projectId: TEST_PROJECT },
    });
    publishChannel.publish(
      'amq.topic',
      'apps.tilechat.outgoing.users.intuser3.messages.intuser4.outgoing',
      Buffer.from(outPayload)
    );

    // 2b. Wait for message.delivered — its payload.id_message is the UUID the
    //     observer assigned, which is the same key stored in messageProjectCache.
    const deliveredEvt = await waitForEvent('message.delivered');
    const msg_id = deliveredEvt.payload.id_message as string;
    assert.ok(msg_id, 'message.delivered must carry a non-empty id_message');

    // Clear events before the actual assertion target fires.
    receivedEvents = [];

    // 2c. Now send the return-receipt update using the captured message ID.
    //     Topic: apps.tilechat.users.<user_id>.messages.<convers_with>.<msg_id>.update
    publishChannel.publish(
      'amq.topic',
      `apps.tilechat.users.intuser3.messages.intuser4.${msg_id}.update`,
      Buffer.from(JSON.stringify({ status: 200 }))
    );

    const evt = await waitForEvent('message.return_receipt');

    assert.strictEqual(evt.id_project,        TEST_PROJECT, 'id_project should match projectId from cache');
    assert.strictEqual(evt.payload.id_message, msg_id,      'payload.id_message should match the message UUID');
  });

  // ── Test 3: user.presence_changed ────────────────────────────────────────────
  //
  // Strategy: publish an outgoing message from intuser5 first so deliverMessage()
  // populates the userProjectCache (user_id → projectId). Then send the presence
  // message. Zero MongoDB queries — id_project is resolved from in-memory cache.

  it('emits user.presence_changed with correct id_project', async function () {
    const PRES_USER_ID = 'intuser5';

    // 3a. Publish an outgoing message from PRES_USER_ID to seed the user cache.
    const outPayload = JSON.stringify({
      text: 'seed message for presence test',
      attributes: { projectId: TEST_PROJECT2 },
    });
    publishChannel.publish(
      'amq.topic',
      `apps.tilechat.outgoing.users.${PRES_USER_ID}.messages.intuser6.outgoing`,
      Buffer.from(outPayload)
    );

    // 3b. Wait for message.delivered to confirm the cache has been populated.
    await waitForEvent('message.delivered');

    // Clear events before the actual assertion target fires.
    receivedEvents = [];

    // 3c. Now send the presence event.
    publishChannel.publish(
      'amq.topic',
      `apps.tilechat.users.${PRES_USER_ID}.presence.client1`,
      Buffer.from(JSON.stringify({ connected: true }))
    );

    const evt = await waitForEvent('user.presence_changed');

    assert.strictEqual(evt.id_project,      TEST_PROJECT2, 'id_project should match projectId from cache');
    assert.strictEqual(evt.payload.status,  'online',      'status should be online when connected=true');
    assert.strictEqual(evt.payload.user_id, PRES_USER_ID,  'user_id should match the presence user');
  });
});
