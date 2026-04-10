#!/usr/bin/env node
/**
 * mongo_proof_compare.js
 *
 * Reads the raw JSON profiler dumps from mongo_proof.sh and prints
 * a side-by-side comparison of MongoDB operations with cache OFF vs ON.
 *
 * Usage:
 *   node perfomance/mongo_proof_compare.js
 *   # or with custom file paths:
 *   CACHE_OFF_RAW=path/to/raw_off.txt CACHE_ON_RAW=path/to/raw_on.txt node perfomance/mongo_proof_compare.js
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const offFile = process.env.CACHE_OFF_RAW || path.join(LOG_DIR, 'mongo_proof_raw_off.txt');
const onFile  = process.env.CACHE_ON_RAW  || path.join(LOG_DIR, 'mongo_proof_raw_on.txt');

function parseRaw(file) {
    if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
    }
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.trim());
    const byCollection = {};
    let total = 0;

    for (const line of lines) {
        let obj;
        try { obj = JSON.parse(line); } catch { continue; }

        if (obj._total !== undefined) {
            total = obj._total;
            continue;
        }

        const col = (obj._id && obj._id.collection) || 'unknown';
        const op  = (obj._id && obj._id.op)         || 'unknown';
        if (!byCollection[col]) byCollection[col] = {};
        byCollection[col][op] = {
            count:  obj.count  || 0,
            avgMs:  obj.avgMs  || 0,
            maxMs:  obj.maxMs  || 0,
        };
    }
    return { byCollection, total };
}

function opsForCollection(data, col) {
    const all = data.byCollection[col] || {};
    return Object.values(all).reduce((sum, v) => sum + v.count, 0);
}

function formatPct(a, b) {
    if (b === 0) return 'N/A';
    const pct = ((b - a) / b * 100).toFixed(1);
    return `${pct}% fewer`;
}

let off, on;
try {
    off = parseRaw(offFile);
    on  = parseRaw(onFile);
} catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
}

// Collect all collections seen in either run
const allCols = new Set([
    ...Object.keys(off.byCollection),
    ...Object.keys(on.byCollection),
]);

const pad  = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║           MongoDB Operations: Cache OFF vs Cache ON               ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(pad('Collection', 22) + pad('Op-type', 10) + rpad('Cache OFF', 12) + rpad('Cache ON', 12) + '  Reduction');
console.log('─'.repeat(70));

for (const col of [...allCols].sort()) {
    const offOps = off.byCollection[col] || {};
    const onOps  = on.byCollection[col]  || {};
    const allOps = new Set([...Object.keys(offOps), ...Object.keys(onOps)]);

    for (const op of [...allOps].sort()) {
        const offCount = (offOps[op] || {}).count || 0;
        const onCount  = (onOps[op]  || {}).count || 0;
        const reduction = offCount > onCount
            ? `-${offCount - onCount} (${formatPct(onCount, offCount)})`
            : offCount < onCount
                ? `+${onCount - offCount} (more)`
                : 'same';

        const highlight = col === 'groups' ? ' ◀' : '';
        console.log(
            pad(col, 22) +
            pad(op, 10) +
            rpad(offCount, 12) +
            rpad(onCount, 12) +
            '  ' + reduction + highlight
        );
    }
}

console.log('─'.repeat(70));
console.log(pad('TOTAL (all ops)', 22) + pad('', 10) + rpad(off.total, 12) + rpad(on.total, 12));
console.log('');

// Key metric: groups reads
const groupsOff = opsForCollection(off, 'groups');
const groupsOn  = opsForCollection(on,  'groups');

console.log('Key finding:');
console.log(`  groups READ ops  — Cache OFF: ${groupsOff}  Cache ON: ${groupsOn}  (${formatPct(groupsOn, groupsOff)})`);

const writesOff = opsForCollection(off, 'messages') + opsForCollection(off, 'conversations');
const writesOn  = opsForCollection(on,  'messages') + opsForCollection(on,  'conversations');
console.log(`  message+conv ops — Cache OFF: ${writesOff}  Cache ON: ${writesOn}  (writes always hit MongoDB)`);
console.log('');
console.log('→  groups.findOne is bypassed by the Redis group cache.');
console.log('   Write operations (messages, conversations) always go to MongoDB');
console.log('   regardless of cache state — only reads benefit from the cache.');
console.log('');
