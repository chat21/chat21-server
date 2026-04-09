#!/usr/bin/env node

const { v4: uuidv4 } = require('uuid');
const { Chat21Client } = require('../mqttclient/chat21client.js');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const mongodb = require('mongodb');

/**
 * Questo script esegue un test di performance per misurare la latenza (in millisecondi)
 * nella ricezione delle risposte dal chatbot Tiledesk tramite protocollo MQTT.
 * 
 * Il test funziona così:
 * - Viene generato un utente anonimo e stabilita una connessione MQTT tramite Chat21Client.
 * - L'utente entra in un nuovo gruppo di supporto su Tiledesk.
 * - Viene inviato un messaggio di test al bot, identificato da un UUID univoco.
 * - Al ricevimento della risposta dal chatbot, viene calcolato il ritardo effettivo 
 *   (differenza tra il timestamp di invio e quello di ricezione).
 * - Il risultato della misurazione (timestamp, UUID messaggio, delay, tempi di invio/ricezione) 
 *   viene salvato nel file logs/performance_delay.log in formato CSV.
 * 
 * Questo script è usato anche in ciclo multiplo da uno script bash, per generare dati
 * statistici sulle prestazioni e la reattività del bot e della piattaforma Tilechat.
 * 
 * MongoDB Profiling (opzionale):
 * - Se ENABLE_MONGO_PROFILING=true, lo script abilita il MongoDB profiler prima del test
 *   e raccoglie statistiche sulle query eseguite durante il test.
 * - Il profiler viene automaticamente disabilitato al termine del test.
 * - Le statistiche includono: numero totale di query, tempo medio, p95, top 5 query più lente.
 * - Richiede MONGODB_URI configurato nell'ambiente.
 */


/**
 * MQTT SECTION
 */

let TILEDESK_PROJECT_ID = "";
if (process.env && process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID) {
	TILEDESK_PROJECT_ID = process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID
}
else {
    throw new Error(".env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID is mandatory");
}

let MQTT_ENDPOINT = "";
if (process.env && process.env.PERFORMANCE_TEST_MQTT_ENDPOINT) {
	MQTT_ENDPOINT = process.env.PERFORMANCE_TEST_MQTT_ENDPOINT
}
else {
    throw new Error(".env.PERFORMANCE_TEST_MQTT_ENDPOINT is mandatory");
}

let API_ENDPOINT = "";
if (process.env && process.env.PERFORMANCE_TEST_API_ENDPOINT) {
	API_ENDPOINT = process.env.PERFORMANCE_TEST_API_ENDPOINT
}
else {
    throw new Error(".env.PERFORMANCE_TEST_API_ENDPOINT is mandatory");
}

let CHAT_API_ENDPOINT = "";
if (process.env && process.env.PERFORMANCE_TEST_CHAT_API_ENDPOINT) {
	CHAT_API_ENDPOINT = process.env.PERFORMANCE_TEST_CHAT_API_ENDPOINT
}
else {
    throw new Error(".env.PERFORMANCE_TEST_CHAT_API_ENDPOINT is mandatory");
}

// MongoDB Profiling Configuration
const ENABLE_MONGO_PROFILING = process.env.ENABLE_MONGO_PROFILING === 'true' || process.env.ENABLE_MONGO_PROFILING === '1';
let MONGODB_URI = "";
if (ENABLE_MONGO_PROFILING) {
    if (process.env && process.env.MONGODB_URI) {
        MONGODB_URI = process.env.MONGODB_URI;
    } else {
        throw new Error(".env.MONGODB_URI is mandatory when ENABLE_MONGO_PROFILING is enabled");
    }
}

// MongoDB connection and profiling state
let mongoClient = null;
let mongoDb = null;
let testStartTime = null;
let testEndTime = null;

let config = {
    MQTT_ENDPOINT: MQTT_ENDPOINT,
    CHAT_API_ENDPOINT: CHAT_API_ENDPOINT,
    APPID: 'tilechat',
    TILEDESK_PROJECT_ID: TILEDESK_PROJECT_ID,
    MESSAGE_PREFIX: "Performance-test",
}

const logs = false;

// Log file path
const LOG_DIR = path.join(__dirname, '.', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'messages_delay_no_cache.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize log file with header if it doesn't exist
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'timestamp,message_uuid,delay_ms,time_sent,time_received\n', 'utf8');
}

// Function to log delay to file
function logDelay(message_UUID, delay, time_sent, time_received) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp},${message_UUID},${delay},${time_sent},${time_received}\n`;
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
}

/**
 * MongoDB Profiling Functions
 * 
 * IMPORTANTE: Il MongoDB profiler funziona a livello di DATABASE.
 * Quando abilitato su un database, registra TUTTE le query eseguite
 * su quel database da QUALSIASI processo/client (observer.js, HTTP server, ecc.).
 * 
 * Quindi, anche se questo test usa solo Chat21Client (MQTT), il profiler
 * catturerà tutte le query MongoDB eseguite da observer.js e altri componenti
 * che processano i messaggi durante il test.
 * 
 * Assicurati che:
 * 1. MONGODB_URI punti allo stesso database usato da observer.js
 * 2. observer.js sia in esecuzione durante il test
 * 3. Il profiler sia abilitato PRIMA che inizino le query
 */

async function connectMongoDB() {
    if (!ENABLE_MONGO_PROFILING) {
        return;
    }
    
    try {
        mongoClient = await mongodb.MongoClient.connect(MONGODB_URI, { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        mongoDb = mongoClient.db();
        const dbName = mongoDb.databaseName;
        console.log("MongoDB connected for profiling");
        console.log("Database name:", dbName);
        console.log("MongoDB URI:", MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
        
        // Verify we can access the database
        const adminDb = mongoClient.db().admin();
        const serverStatus = await adminDb.serverStatus();
        console.log("MongoDB server version:", serverStatus.version);
        
        // Warn if database name doesn't match common observer.js database name
        if (dbName !== 'chatdb' && dbName !== 'test') {
            console.warn(`WARNING: Database name is "${dbName}".`);
            console.warn("         observer.js typically uses 'chatdb' database.");
            console.warn("         Make sure this matches the database used by observer.js!");
        } else if (dbName === 'test') {
            console.warn("WARNING: Using 'test' database.");
            console.warn("         observer.js typically uses 'chatdb' database.");
            console.warn("         If observer.js uses a different database, queries won't be captured!");
        }
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        throw error;
    }
}

async function enableMongoProfiler() {
    if (!ENABLE_MONGO_PROFILING || !mongoDb) {
        return;
    }
    
    try {
        // First, check current profiler status
        const currentStatus = await mongoDb.command({ profile: -1 });
        console.log("Current profiler status before enabling:", JSON.stringify(currentStatus));
        
        // Clear existing profiler data to avoid confusion
        try {
            const profileCollection = mongoDb.collection('system.profile');
            const countBefore = await profileCollection.countDocuments({});
            if (countBefore > 0) {
                console.log(`Clearing ${countBefore} existing profiler entries...`);
                await profileCollection.deleteMany({});
            }
        } catch (clearError) {
            console.warn("Could not clear profiler data (this is OK if collection doesn't exist yet):", clearError.message);
        }
        
        // Set profiling level to 1 (profile all operations) and slowms to 0 (log all queries)
        const result = await mongoDb.command({ profile: 1, slowms: 0 });
        console.log("MongoDB profiler enabled (level 1, slowms: 0)");
        console.log("Profiler command result:", JSON.stringify(result));
        
        // Verify profiler is enabled
        const profileStatus = await mongoDb.command({ profile: -1 });
        console.log("Current profiler status after enabling:", JSON.stringify(profileStatus));
        
        if (profileStatus.was !== 1 && profileStatus.was !== 2) {
            console.warn("WARNING: Profiler might not be enabled correctly. Expected 'was' to be 1 or 2, got:", profileStatus.was);
        }
    } catch (error) {
        console.error("Error enabling MongoDB profiler:", error);
        throw error;
    }
}

async function disableMongoProfiler() {
    if (!ENABLE_MONGO_PROFILING || !mongoDb) {
        return;
    }
    
    try {
        // Set profiling level to 0 (disable profiling)
        await mongoDb.command({ profile: 0 });
        console.log("MongoDB profiler disabled");
    } catch (error) {
        console.error("Error disabling MongoDB profiler:", error);
    }
}

async function getProfilerData() {
    if (!ENABLE_MONGO_PROFILING || !mongoDb || !testStartTime || !testEndTime) {
        console.error("MongoDB profiling not enabled or data not available");
        return null;
    }
    
    try {
        // Convert timestamps to MongoDB Date objects
        const startDate = new Date(testStartTime);
        const endDate = new Date(testEndTime);
        
        console.log("\n=== MongoDB Profiler Query Debug ===");
        console.log("Test start time (ms):", testStartTime);
        console.log("Test end time (ms):", testEndTime);
        console.log("Test duration (ms):", testEndTime - testStartTime);
        console.log("Start date:", startDate.toISOString());
        console.log("End date:", endDate.toISOString());
        
        // Query system.profile collection for operations within test time range
        const profileCollection = mongoDb.collection('system.profile');
        
        // First, check if there are ANY queries in the profiler
        const totalQueries = await profileCollection.countDocuments({});
        console.log("Total queries in system.profile:", totalQueries);
        
        // Check profiler status
        const profileStatus = await mongoDb.command({ profile: -1 });
        console.log("Profiler status:", JSON.stringify(profileStatus));
        
        if (totalQueries === 0) {
            console.warn("⚠️  WARNING: No queries found in profiler. Possible reasons:");
            console.warn("  1. No MongoDB queries were executed during the test");
            console.warn("  2. Queries were executed by a different process/database");
            console.warn("  3. Profiler was not enabled correctly");
            console.warn("  4. The test duration was too short to capture queries");
            console.warn("  5. Observer.js might not be processing messages (check if it's running)");
            console.warn("\nNOTE: MongoDB queries are typically executed by observer.js process.");
            console.warn("      If using port forwarding to AWS, make sure observer.js on AWS is running.");
            
            // Check if profiler is still enabled
            const currentProfilerStatus = await mongoDb.command({ profile: -1 });
            if (currentProfilerStatus.was === 0) {
                console.warn("⚠️  Profiler appears to be DISABLED now. It might have been disabled by another process.");
            }
        } else {
            // Get a sample query to see the format of the 'ts' field
            const sampleQuery = await profileCollection.findOne({}, { sort: { ts: -1 } });
            if (sampleQuery && sampleQuery.ts) {
                console.log("\nSample query (most recent):");
                console.log("  ts field type:", typeof sampleQuery.ts);
                console.log("  ts value:", sampleQuery.ts);
                if (sampleQuery.ts instanceof Date) {
                    console.log("  ts as ISO:", sampleQuery.ts.toISOString());
                }
                console.log("  op:", sampleQuery.op);
                console.log("  ns:", sampleQuery.ns);
                console.log("  millis:", sampleQuery.millis);
            }
            
            // Get all queries to see the time range
            const allQueries = await profileCollection.find({}).sort({ ts: 1 }).toArray();
            if (allQueries.length > 0) {
                const firstTs = allQueries[0].ts;
                const lastTs = allQueries[allQueries.length - 1].ts;
                console.log("\nProfiler data time range:");
                console.log("  First query ts:", firstTs instanceof Date ? firstTs.toISOString() : firstTs);
                console.log("  Last query ts:", lastTs instanceof Date ? lastTs.toISOString() : lastTs);
            }
        }
        
        // Query with the test time range
        // MongoDB profiler uses Timestamp objects, so we need to handle both Date and Timestamp
        let queries = await profileCollection.find({
            ts: {
                $gte: startDate,
                $lte: endDate
            }
        }).sort({ ts: 1 }).toArray();

        // If no results with Date comparison, try with a wider range
        if (queries.length === 0 && totalQueries > 0) {
            // Try querying with a wider range to see what we get
            const widerStart = new Date(testStartTime - 30000); // 30 seconds before
            const widerEnd = new Date(testEndTime + 30000); // 30 seconds after
            const widerQueries = await profileCollection.find({
                ts: {
                    $gte: widerStart,
                    $lte: widerEnd
                }
            }).sort({ ts: 1 }).toArray();
            console.log("Queries in wider time range (+/-30s):", widerQueries.length);
            
            if (widerQueries.length > 0) {
                console.log("✓ Found queries in wider range! Using them for statistics.");
                console.log("  This indicates queries were executed slightly outside the exact test window.");
                // Use wider range queries
                queries = widerQueries;
            } else {
                // Check if there are ANY queries around the test time (even further out)
                const veryWideStart = new Date(testStartTime - 300000); // 5 minutes before
                const veryWideEnd = new Date(testEndTime + 300000); // 5 minutes after
                const veryWideQueries = await profileCollection.find({
                    ts: {
                        $gte: veryWideStart,
                        $lte: veryWideEnd
                    }
                }).sort({ ts: 1 }).toArray();
                
                if (veryWideQueries.length > 0) {
                    console.log("⚠️  Found queries in very wide range (+/-5min):", veryWideQueries.length);
                    console.log("    This suggests queries are being executed, but timing might be off.");
                    console.log("    Consider using a longer test or checking observer.js processing delays.");
                    
                    // Show time difference
                    const firstQuery = veryWideQueries[0];
                    const lastQuery = veryWideQueries[veryWideQueries.length - 1];
                    if (firstQuery.ts && lastQuery.ts) {
                        const firstTs = firstQuery.ts instanceof Date ? firstQuery.ts.getTime() : new Date(firstQuery.ts).getTime();
                        const lastTs = lastQuery.ts instanceof Date ? lastQuery.ts.getTime() : new Date(lastQuery.ts).getTime();
                        const testStartDiff = Math.abs(firstTs - testStartTime);
                        const testEndDiff = Math.abs(lastTs - testEndTime);
                        console.log(`    First query: ${Math.round(testStartDiff/1000)}s from test start`);
                        console.log(`    Last query: ${Math.round(testEndDiff/1000)}s from test end`);
                    }
                } else {
                    console.log("⚠️  No queries found even in very wide range (+/-5min).");
                    console.log("    This suggests no MongoDB activity during or around the test period.");
                }
            }
        }

        console.log("\nQueries in test time range:", queries.length);
        if (queries.length > 0) {
            console.log("Query operations:", [...new Set(queries.map(q => q.op))]);
            console.log("Query namespaces:", [...new Set(queries.map(q => q.ns))]);
            
            // Separate system queries from application queries
            const systemQueries = queries.filter(q => q.ns && q.ns.includes('system.profile'));
            const appQueries = queries.filter(q => !q.ns || !q.ns.includes('system.profile'));
            
            console.log(`  - System queries (profiler metadata): ${systemQueries.length}`);
            console.log(`  - Application queries (real data): ${appQueries.length}`);
            
            if (appQueries.length === 0 && systemQueries.length > 0) {
                console.warn("\n⚠️  WARNING: Only system.profile queries found!");
                console.warn("   This means no real application queries were captured.");
                console.warn("   Possible reasons:");
                console.warn("   1. Database name mismatch (using 'test' but observer.js uses 'chatdb')");
                console.warn("   2. Observer.js is not processing messages during the test");
                console.warn("   3. Observer.js is using a different database");
                console.warn("\n   Solution: Make sure MONGODB_URI points to the SAME database used by observer.js");
            } else if (appQueries.length > 0) {
                console.log(`✓ Found ${appQueries.length} real application queries!`);
                const appNamespaces = [...new Set(appQueries.map(q => q.ns))];
                console.log("  Application collections:", appNamespaces.join(", "));
            }
        }
        console.log("=====================================\n");
        
        return queries;
    } catch (error) {
        console.error("Error retrieving profiler data:", error);
        return null;
    }
}

function calculateStatistics(queries) {
    if (!queries || queries.length === 0) {
        return null;
    }
    
    // Filter only command operations (exclude system operations)
    // IMPORTANT: Exclude queries on system.profile itself (these are profiler metadata, not real app queries)
    const commandQueries = queries.filter(q => {
        // Exclude system.profile queries (profiler metadata)
        if (q.ns && q.ns.includes('system.profile')) {
            return false;
        }
        // Include only real database operations
        return q.op === 'command' || q.op === 'query' || q.op === 'update' || q.op === 'remove' || q.op === 'insert';
    });
    
    if (commandQueries.length === 0) {
        return null;
    }
    
    // Extract durations in milliseconds
    const durations = commandQueries
        .map(q => q.millis || 0)
        .filter(d => d >= 0)
        .sort((a, b) => a - b);
    
    if (durations.length === 0) {
        return null;
    }
    
    // Calculate statistics
    const totalQueries = durations.length;
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / totalQueries;
    
    // Calculate p95 (95th percentile)
    const p95Index = Math.ceil(totalQueries * 0.95) - 1;
    const p95 = durations[Math.min(p95Index, durations.length - 1)];
    
    // Get top 5 slowest queries
    const top5Slowest = commandQueries
        .map(q => ({
            collection: q.ns ? q.ns.split('.')[1] : 'unknown',
            duration: q.millis || 0,
            command: q.command ? JSON.stringify(q.command).substring(0, 100) : 'unknown'
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5);
    
    return {
        totalQueries,
        avgDuration,
        p95,
        top5Slowest
    };
}

async function printProfilerStatistics() {
    if (!ENABLE_MONGO_PROFILING) {
        return;
    }
    
    try {
        const queries = await getProfilerData();
        const stats = calculateStatistics(queries);
        
        if (!stats) {
            console.log("\n=== MongoDB Profiling Statistics ===");
            console.log("No queries found in the test time range.");
            return;
        }
        
        console.log("\n=== MongoDB Profiling Statistics ===");
        console.log(`Total queries executed: ${stats.totalQueries}`);
        console.log(`Average query duration: ${stats.avgDuration.toFixed(2)} ms`);
        console.log(`P95 query duration: ${stats.p95.toFixed(2)} ms`);
        console.log("\nTop 5 slowest queries:");
        stats.top5Slowest.forEach((query, index) => {
            console.log(`  ${index + 1}. Collection: ${query.collection}, Duration: ${query.duration.toFixed(2)} ms`);
        });
        console.log("=====================================\n");
    } catch (error) {
        console.error("Error printing profiler statistics:", error);
    }
}

async function cleanupMongoDB() {
    if (!ENABLE_MONGO_PROFILING) {
        return;
    }
    
    try {
        testEndTime = Date.now();
        
        // IMPORTANT: Retrieve profiler data BEFORE disabling the profiler
        await printProfilerStatistics();
        
        // Now disable the profiler
        await disableMongoProfiler();
        
        if (mongoClient) {
            await mongoClient.close();
            console.log("MongoDB connection closed");
        }
    } catch (error) {
        console.error("Error during MongoDB cleanup:", error);
    }
}

let user1 = {
	fullname: 'User 1',
	firstname: 'User',
	lastname: '1',
};

let chatClient1 = new Chat21Client(
{
    appId: config.APPID,
    MQTTendpoint: config.MQTT_ENDPOINT,
    APIendpoint: config.CHAT_API_ENDPOINT,
    log: false
});

// Handle process termination to ensure MongoDB profiler is disabled
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, cleaning up...');
    await cleanupMongoDB();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, cleaning up...');
    await cleanupMongoDB();
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await cleanupMongoDB();
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    await cleanupMongoDB();
    process.exit(1);
});

(async () => {
    // Setup MongoDB profiling if enabled
    if (ENABLE_MONGO_PROFILING) {
        try {
            await connectMongoDB();
            await enableMongoProfiler();
        } catch (error) {
            console.error("Error setting up MongoDB profiling:", error);
            process.exit(1);
        }
    }
    
    let userdata;
    try {
        userdata = await createAnonymousUser(TILEDESK_PROJECT_ID);
    }
    catch(error) {
        console.error("An error occurred during anonym auth:", error);
        await cleanupMongoDB();
        process.exit(0);
    }
    
    user1.userid = userdata.userid;
    user1.token = userdata.token;

    let group_id;
    let group_name;

    if (logs) {
        console.log("Message delay check.");
        console.log("MQTT endpoint:", config.MQTT_ENDPOINT);
        console.log("API endpoint:", config.CHAT_API_ENDPOINT);
        console.log("Tiledesk Project Id:", config.TILEDESK_PROJECT_ID);
    }

    if (logs) { console.log("Connecting...") }
    chatClient1.connect(user1.userid, user1.token, () => {
        console.log("Chat client connected and subscribed");
        //group_id = "support-group-" + "64690469599137001a6dc6f5-" + uuidv4().replace(/-+/g, "");
        group_id = "support-group-" + TILEDESK_PROJECT_ID + "-" + uuidv4().replace(/-+/g, "");
        group_name = "benchmarks group => " + group_id;
        send(group_id, group_name);
    });
})();


async function send(group_id, group_name) {
    // Save test start time for MongoDB profiling
    testStartTime = Date.now();
    
    // Start periodic profiler check if enabled
    let profilerCheckInterval = null;
    if (ENABLE_MONGO_PROFILING && mongoDb) {
        profilerCheckInterval = setInterval(async () => {
            try {
                const profileCollection = mongoDb.collection('system.profile');
                const count = await profileCollection.countDocuments({});
                if (count > 0) {
                    console.log(`[Profiler] Currently tracking ${count} queries...`);
                }
            } catch (error) {
                // Silently fail - this is just monitoring
            }
        }, 2000); // Check every 2 seconds
    }

    let time_sent;
    let total_conversation_time = Date.now();
    let message_UUID = uuidv4().replace(/-+/g, "");
    let counter = 0;
    let max_counter = 10;
    chatClient1.onMessageAdded(async (message, topic) => {
        if (validMessageFromChatbot(message, group_id)) {
            let time_received = Date.now();
            let delay = time_received - time_sent;
            console.log("Reply delay: ", delay, "ms");
            logDelay(message_UUID, delay, time_sent, time_received);

            if (counter < max_counter) {
                counter++;
                time_sent = Date.now();
                sendMessage(message_UUID, recipient_id, recipient_fullname);
            } else {
                console.log("Max counter reached. Stopping...")
                total_conversation_time = Date.now() - total_conversation_time;
                console.log("Total conversation time: ", total_conversation_time, "ms");
                
                // Stop profiler check interval
                if (profilerCheckInterval) {
                    clearInterval(profilerCheckInterval);
                }
                
                await cleanupMongoDB();
                process.exit(0);
            }
        }
        else if (invalidMessageFromChatbot(message, group_id)) {
            console.warn("Chatbot replied with an invalid message: ", message.text);
            console.warn("Chatbot must echo the message. Check the flow and try again.")
            
            // Stop profiler check interval
            if (profilerCheckInterval) {
                clearInterval(profilerCheckInterval);
            }
            
            await cleanupMongoDB();
            process.exit(0);
        } else {
            //console.log("Message not computed:", message.text);
        }

    });

    time_sent = Date.now();
    let recipient_id = group_id;
    let recipient_fullname = group_name;
    sendMessage(message_UUID, recipient_id, recipient_fullname);
}

function sendMessage(message_UUID, recipient_id, recipient_fullname, callback) {
    const sent_message = config.MESSAGE_PREFIX + "/"+ message_UUID;
    //console.log("Sending message with text:", sent_message);
    
    chatClient1.sendMessage(
        sent_message,
        'text',
        recipient_id,
        recipient_fullname,
        user1.fullname,
        {projectId: config.TILEDESK_PROJECT_ID},
        null, // no metadata
        'group',
        (err, msg) => {
            if (err) {
                console.error("Error send:", err);
            }
            console.log("Message Sent");
        }
    );
}

function validMessageFromChatbot(message, group_id) {
    return message && message.text.startsWith(config.MESSAGE_PREFIX) && (message.sender_fullname !== "User 1" && message.sender_fullname !== "System") && message.recipient === group_id;
}

function invalidMessageFromChatbot(message, group_id) {
    return message && !message.text.startsWith(config.MESSAGE_PREFIX) && (message.sender_fullname !== "User 1" && message.sender_fullname !== "System") && message.recipient === group_id;
}

async function createAnonymousUser(tiledeskProjectId) {
    ANONYMOUS_TOKEN_URL = API_ENDPOINT + '/auth/signinAnonymously';
    // console.log("Getting ANONYMOUS_TOKEN_URL:", ANONYMOUS_TOKEN_URL);
    return new Promise((resolve, reject) => {
        let data = JSON.stringify({
            "id_project": tiledeskProjectId
        });
    
        let axios_config = {
            method: 'post',
            url: ANONYMOUS_TOKEN_URL, //'https://api.tiledesk.com/v3/auth/signinAnonymously',
            headers: { 
                'Content-Type': 'application/json'
            },
            data : data
        };
    
        axios.request(axios_config)
        .then((response) => {
        // console.log("Got Anonymous Token:", JSON.stringify(response.data.token));
        CHAT21_TOKEN_URL = API_ENDPOINT + '/chat21/native/auth/createCustomToken';
            let config = {
                method: 'post',
                maxBodyLength: Infinity,
                url: CHAT21_TOKEN_URL,
                headers: { 
                    'Authorization': response.data.token
                }
            };
    
            axios.request(config)
            .then((response) => {
                const mqtt_token = response.data.token;
                const chat21_userid = response.data.userid;
                resolve({
                    userid: chat21_userid,
                    token:  mqtt_token
                });
            })
            .catch((error) => {
                console.log(error);
                reject(error);
            });
        })
        .catch((error) => {
            console.log(error);
            reject(error)
        });
    });
}