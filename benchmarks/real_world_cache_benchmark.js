const mongodb = require("mongodb");
const { ChatDB } = require('../src/chatdb/index.js');
const { TdCache } = require('../src/TdCache.js');
const GroupService = require('../src/services/GroupService.js');
require('dotenv').config();

async function runBenchmark() {
    const mongouri = process.env.MONGODB_URI || 'mongodb://localhost/chat21';
    const redis_host = process.env.CACHE_REDIS_HOST || 'localhost';
    const redis_port = process.env.CACHE_REDIS_PORT || 6379;
    const redis_enabled = process.env.CACHE_ENABLED === 'true';

    console.log("--- Benchmark Configuration ---");
    console.log("MongoDB URI:", mongouri);
    console.log("Redis Enabled:", redis_enabled);
    if (redis_enabled) {
        console.log("Redis Host:", redis_host);
        console.log("Redis Port:", redis_port);
    }
    console.log("-------------------------------\n");

    let client;
    try {
        client = await mongodb.MongoClient.connect(mongouri);
    } catch (err) {
        console.error("Failed to connect to MongoDB. Ensure it is running or MONGODB_URI in .env is correct.");
        console.error("Error:", err.message);
        process.exit(1);
    }

    const db = client.db();
    const chatdb = new ChatDB({ database: db });
    
    let tdcache = null;
    if (redis_enabled) {
        tdcache = new TdCache({ host: redis_host, port: redis_port });
        try {
            await tdcache.connect();
            console.log("Connected to Redis successfully.\n");
        } catch (err) {
            console.error("Failed to connect to Redis. Caching will not work.");
            console.error("Error:", err.message);
            // We continue as GroupService handles missing cache, but benchmark results will be affected.
        }
    }

    const groupService = new GroupService({ chatdb, tdcache, redis_enabled });

    const test_group_id = "benchmark_group_" + Date.now();
    const test_group = {
        uid: test_group_id,
        name: "Performance Test Group",
        members: { "user1": 1, "user2": 1 },
        app_id: "tilechat"
    };

    // Prepare: Save group to DB
    console.log("Preparing test data...");
    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("MongoDB saveOrUpdateGroup timed out")), 30000);
            chatdb.saveOrUpdateGroup(test_group, (err) => {
                clearTimeout(timeout);
                if (err) reject(err);
                else resolve();
            });
        });
        console.log("Test group created in DB:", test_group_id);
    } catch (err) {
        console.error("Failed to prepare test data in MongoDB:", err.message);
        console.log("Falling back to simulated benchmark mode...");
        return runSimulatedBenchmark(redis_enabled, tdcache);
    }

    // Clear cache for a clean start if redis is enabled
    if (redis_enabled && tdcache && tdcache.client) {
        const group_key = "chat21:messages:groups:" + test_group_id;
        await tdcache.del(group_key);
        console.log("Cache cleared for test group.\n");
    }

    const iterations = 100;
    
    // 1. First retrieval (Cache Miss)
    console.log("Running retrieval iterations...");
    const startMiss = process.hrtime.bigint();
    const groupMiss = await new Promise((resolve) => {
        groupService.getGroup(test_group_id, (err, group) => {
            resolve(group);
        });
    });
    const endMiss = process.hrtime.bigint();
    const timeMiss = Number(endMiss - startMiss) / 1_000_000; // ms

    console.log(`Iteration 1 (Cache Miss): ${timeMiss.toFixed(4)} ms`);

    // 2. Subsequent retrievals (Cache Hits)
    let totalHitTime = 0;
    for (let i = 0; i < iterations; i++) {
        const startHit = process.hrtime.bigint();
        await new Promise((resolve) => {
            groupService.getGroup(test_group_id, (err, group) => {
                resolve(group);
            });
        });
        const endHit = process.hrtime.bigint();
        totalHitTime += Number(endHit - startHit) / 1_000_000;
    }

    const avgHitTime = totalHitTime / iterations;
    console.log(`Average of ${iterations} Subsequent Iterations: ${avgHitTime.toFixed(4)} ms`);

    console.log("\n--- Results Summary ---");
    if (redis_enabled) {
        const speedup = timeMiss / avgHitTime;
        console.log(`Speedup (First vs Avg): ${speedup.toFixed(2)}x`);
        if (speedup > 1.5) {
            console.log("Result: Cache provides significant improvement.");
        } else {
            console.log("Result: Cache improvement is negligible or Redis is slow.");
        }
    } else {
        console.log("Caching was disabled. Performance remains constant (DB-only).");
    }
    console.log("-----------------------\n");

    // Cleanup
    await db.collection('groups').deleteOne({ uid: test_group_id });
    if (tdcache && tdcache.client) {
        const group_key = "chat21:messages:groups:" + test_group_id;
        await tdcache.del(group_key);
        await tdcache.client.quit();
    }
    await client.close();
}

async function runSimulatedBenchmark(redis_enabled, tdcache) {
    console.log("\n--- Starting Simulated Benchmark ---");
    const test_group_id = "simulated_group_" + Date.now();
    const mock_group = { uid: test_group_id, name: "Simulated Group" };
    
    // Mocking GroupService behavior
    const iterations = 100;
    const db_delay = 10; // ms
    const redis_delay = 1; // ms

    console.log("1. Simulated Cache Miss (DB Fetch)...");
    const startMiss = process.hrtime.bigint();
    // Simulate DB fetch
    await new Promise(resolve => setTimeout(resolve, db_delay));
    const endMiss = process.hrtime.bigint();
    const timeMiss = Number(endMiss - startMiss) / 1_000_000;
    console.log(`Iteration 1 (Simulated Miss): ${timeMiss.toFixed(4)} ms`);

    console.log(`2. Running ${iterations} Simulated Cache Hits...`);
    let totalHitTime = 0;
    for (let i = 0; i < iterations; i++) {
        const startHit = process.hrtime.bigint();
        // Simulate Redis fetch
        await new Promise(resolve => setTimeout(resolve, redis_delay));
        const endHit = process.hrtime.bigint();
        totalHitTime += Number(endHit - startHit) / 1_000_000;
    }

    const avgHitTime = totalHitTime / iterations;
    console.log(`Average of ${iterations} Simulated Hits: ${avgHitTime.toFixed(4)} ms`);

    console.log("\n--- Results Summary (Simulated) ---");
    const speedup = timeMiss / avgHitTime;
    console.log(`Speedup: ${speedup.toFixed(2)}x`);
    console.log("-----------------------------------\n");
    
    if (tdcache && tdcache.client) {
        await tdcache.client.quit();
    }
}

runBenchmark().catch(err => {
    console.error("Benchmark failed:", err);
});
