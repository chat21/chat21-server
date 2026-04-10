#!/usr/bin/env node

/**
 * Cache ON vs OFF performance test.
 *
 * Simulates a realistic user session: one anonymous user opens a support group
 * and exchanges PERFORMANCE_TEST_NUM_MESSAGES (default 10) messages with the chatbot,
 * measuring the round-trip delay of each reply.
 *
 * Why message 1 is excluded from logged stats by default:
 *   The first message triggers the full cold-start pipeline: tiledesk-server creates the
 *   request, creates the chat21 group in MongoDB, and assigns the bot. This always takes
 *   the same time regardless of cache state. Only messages 2-N exercise the cache path
 *   (Redis HIT vs MongoDB HIT). To avoid skewing averages, message 1 is printed to
 *   stdout as [cold-start] but NOT written to the CSV log. Set
 *   PERFORMANCE_TEST_SKIP_FIRST=false to include it.
 *
 * Results are appended as CSV rows to logs/{PERFORMANCE_TEST_LABEL}.log.
 * At the end of the session, per-run statistics (avg, p50, p95, p99) are printed.
 *
 * Required env vars:
 *   PERFORMANCE_TEST_TILEDESK_PROJECT_ID
 *   PERFORMANCE_TEST_MQTT_ENDPOINT
 *   PERFORMANCE_TEST_API_ENDPOINT
 *   PERFORMANCE_TEST_CHAT_API_ENDPOINT
 *   PERFORMANCE_TEST_LABEL            — e.g. "cache_on" or "cache_off" (default: "unlabeled")
 *
 * Optional env vars:
 *   PERFORMANCE_TEST_NUM_MESSAGES     — number of send/reply exchanges per session (default: 10)
 *   PERFORMANCE_TEST_REPLY_TIMEOUT_MS — ms before aborting if no reply arrives (default: 120000)
 *   PERFORMANCE_TEST_SKIP_FIRST       — exclude message 1 (cold-start) from CSV log (default: true)
 */

const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration from env
// ---------------------------------------------------------------------------

function requireEnv(name) {
    const val = process.env[name];
    if (!val) throw new Error(`.env.${name} is mandatory`);
    return val;
}

const TILEDESK_PROJECT_ID = requireEnv('PERFORMANCE_TEST_TILEDESK_PROJECT_ID');
const MQTT_ENDPOINT       = requireEnv('PERFORMANCE_TEST_MQTT_ENDPOINT');
const API_ENDPOINT        = requireEnv('PERFORMANCE_TEST_API_ENDPOINT');
const CHAT_API_ENDPOINT   = requireEnv('PERFORMANCE_TEST_CHAT_API_ENDPOINT');

const LABEL          = process.env.PERFORMANCE_TEST_LABEL || 'unlabeled';
const NUM_MESSAGES   = parseInt(process.env.PERFORMANCE_TEST_NUM_MESSAGES  || '10', 10);
const REPLY_TIMEOUT  = parseInt(process.env.PERFORMANCE_TEST_REPLY_TIMEOUT_MS || '120000', 10);
const SKIP_FIRST     = process.env.PERFORMANCE_TEST_SKIP_FIRST !== 'false'; // default: true

const MESSAGE_PREFIX = 'Performance-test';

// ---------------------------------------------------------------------------
// Log file setup
// ---------------------------------------------------------------------------

const LOG_DIR  = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, `${LABEL}.log`);

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'timestamp,message_uuid,delay_ms,time_sent,time_received\n', 'utf8');
}

function logDelay(message_uuid, delay_ms, time_sent, time_received) {
    const row = `${new Date().toISOString()},${message_uuid},${delay_ms},${time_sent},${time_received}\n`;
    fs.appendFileSync(LOG_FILE, row, 'utf8');
}

// ---------------------------------------------------------------------------
// Statistics helpers
// ---------------------------------------------------------------------------

function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

function printStats(delays, coldStartMs) {
    if (delays.length === 0) {
        console.log('No delay data recorded.');
        return;
    }
    const sorted = [...delays].sort((a, b) => a - b);
    const avg = Math.round(delays.reduce((s, v) => s + v, 0) / delays.length);
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    const p99 = percentile(sorted, 99);
    console.log(`\n--- Run stats [label: ${LABEL}] ---`);
    if (coldStartMs !== undefined) {
        console.log(`  Cold-start (msg 1, excluded): ${coldStartMs} ms`);
    }
    console.log(`  Messages : ${delays.length}`);
    console.log(`  Avg      : ${avg} ms`);
    console.log(`  p50      : ${p50} ms`);
    console.log(`  p95      : ${p95} ms`);
    console.log(`  p99      : ${p99} ms`);
    console.log('----------------------------------\n');
}

// ---------------------------------------------------------------------------
// MQTT client setup
// ---------------------------------------------------------------------------

const user = { fullname: 'User 1', firstname: 'User', lastname: '1' };

const chatClient = new Chat21Client({
    appId: 'tilechat',
    MQTTendpoint: MQTT_ENDPOINT,
    APIendpoint: CHAT_API_ENDPOINT,
    log: false,
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
    let userdata;
    try {
        userdata = await createAnonymousUser(TILEDESK_PROJECT_ID);
    } catch (err) {
        console.error('Anonymous auth failed:', err.message);
        process.exit(1);
    }

    user.userid = userdata.userid;
    user.token  = userdata.token;

    const group_id   = 'support-group-' + TILEDESK_PROJECT_ID + '-' + uuidv4().replace(/-/g, '');
    const group_name = 'cachetest => ' + group_id;

    chatClient.connect(user.userid, user.token, () => {
        runSession(group_id, group_name);
    });
})();

// ---------------------------------------------------------------------------
// Session logic
// ---------------------------------------------------------------------------

function runSession(group_id, group_name) {
    const message_uuid = uuidv4().replace(/-/g, '');
    const delays = [];
    let coldStartMs = undefined;
    let counter  = 0;
    let time_sent;
    let replyTimer = null;

    function armTimeout() {
        clearTimer();
        replyTimer = setTimeout(() => {
            console.error(`Timeout: no reply within ${REPLY_TIMEOUT} ms (group ${group_id}). Aborting.`);
            printStats(delays, coldStartMs);
            process.exit(1);
        }, REPLY_TIMEOUT);
    }

    function clearTimer() {
        if (replyTimer !== null) {
            clearTimeout(replyTimer);
            replyTimer = null;
        }
    }

    chatClient.onMessageAdded((message) => {
        if (isValidReply(message, group_id)) {
            clearTimer();
            const time_received = Date.now();
            const delay_ms      = time_received - time_sent;

            const isFirstMessage = (counter === 0);

            if (isFirstMessage && SKIP_FIRST) {
                // Message 1 is the cold-start: tiledesk-server creates the request,
                // creates the chat21 group in MongoDB, and assigns the bot. This pipeline
                // runs the same regardless of cache state, so it would skew comparisons.
                coldStartMs = delay_ms;
                console.log(`Reply 1/${NUM_MESSAGES} — delay: ${delay_ms} ms [cold-start, excluded from log]`);
            } else {
                delays.push(delay_ms);
                logDelay(message_uuid, delay_ms, time_sent, time_received);
                console.log(`Reply ${counter + 1}/${NUM_MESSAGES} — delay: ${delay_ms} ms`);
            }

            counter++;
            if (counter < NUM_MESSAGES) {
                time_sent = Date.now();
                armTimeout();
                sendMessage(message_uuid, group_id, group_name);
            } else {
                printStats(delays, coldStartMs);
                process.exit(0);
            }
        } else if (isInvalidReply(message, group_id)) {
            clearTimer();
            console.warn('Bot replied with unexpected message:', message.text);
            console.warn('The chatbot must echo the message. Check the flow and try again.');
            printStats(delays, coldStartMs);
            process.exit(0);
        }
    });

    // Send the first message
    time_sent = Date.now();
    armTimeout();
    sendMessage(message_uuid, group_id, group_name);
}

function sendMessage(message_uuid, group_id, group_name) {
    chatClient.sendMessage(
        `${MESSAGE_PREFIX}/${message_uuid}`,
        'text',
        group_id,
        group_name,
        user.fullname,
        { projectId: TILEDESK_PROJECT_ID },
        null,
        'group',
        (err) => { if (err) console.error('Send error:', err); }
    );
}

function isValidReply(message, group_id) {
    return (
        message &&
        message.text.startsWith(MESSAGE_PREFIX) &&
        message.sender_fullname !== 'User 1' &&
        message.sender_fullname !== 'System' &&
        message.recipient === group_id
    );
}

function isInvalidReply(message, group_id) {
    return (
        message &&
        !message.text.startsWith(MESSAGE_PREFIX) &&
        message.sender_fullname !== 'User 1' &&
        message.sender_fullname !== 'System' &&
        message.recipient === group_id
    );
}

// ---------------------------------------------------------------------------
// Anonymous auth helpers
// ---------------------------------------------------------------------------

async function createAnonymousUser(projectId) {
    const anonRes = await axios.post(
        `${API_ENDPOINT}/auth/signinAnonymously`,
        { id_project: projectId },
        { headers: { 'Content-Type': 'application/json' } }
    );
    const tokenRes = await axios.post(
        `${API_ENDPOINT}/chat21/native/auth/createCustomToken`,
        null,
        { headers: { Authorization: anonRes.data.token } }
    );
    return { userid: tokenRes.data.userid, token: tokenRes.data.token };
}
