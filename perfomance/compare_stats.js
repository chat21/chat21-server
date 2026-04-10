#!/usr/bin/env node

/**
 * Reads cache_on.log and cache_off.log from the perfomance/logs/ directory
 * (or paths supplied via --cache-on-log / --cache-off-log flags) and prints
 * a side-by-side statistics comparison table.
 *
 * Usage:
 *   node perfomance/compare_stats.js
 *   node perfomance/compare_stats.js --cache-on-log ./logs/cache_on.log --cache-off-log ./logs/cache_off.log
 */

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const LOG_DIR       = path.join(__dirname, 'logs');
const cacheOnPath   = getArg('--cache-on-log')  || path.join(LOG_DIR, 'cache_on.log');
const cacheOffPath  = getArg('--cache-off-log') || path.join(LOG_DIR, 'cache_off.log');

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

function parseDelays(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return null;
    }
    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    // Skip header row
    const data = lines.slice(1).filter(Boolean).map(line => {
        const cols = line.split(',');
        return parseInt(cols[2], 10); // delay_ms is column index 2
    }).filter(v => !isNaN(v));
    return data;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function percentile(sorted, p) {
    if (sorted.length === 0) return null;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

function computeStats(delays) {
    if (!delays || delays.length === 0) return null;
    const sorted = [...delays].sort((a, b) => a - b);
    return {
        count : delays.length,
        avg   : Math.round(delays.reduce((s, v) => s + v, 0) / delays.length),
        min   : sorted[0],
        p50   : percentile(sorted, 50),
        p95   : percentile(sorted, 95),
        p99   : percentile(sorted, 99),
        max   : sorted[sorted.length - 1],
    };
}

// ---------------------------------------------------------------------------
// Comparison table printer
// ---------------------------------------------------------------------------

function fmt(val) {
    return val !== null && val !== undefined ? `${val} ms` : 'N/A';
}

function diffLabel(a, b) {
    if (a === null || b === null) return '';
    const delta = a - b;
    const pct   = b !== 0 ? ((delta / b) * 100).toFixed(1) : '∞';
    const sign  = delta > 0 ? '+' : '';
    return `${sign}${delta} ms (${sign}${pct}%)`;
}

function printTable(onStats, offStats) {
    const COL1 = 12, COL2 = 18, COL3 = 18, COL4 = 28;

    const line = () => console.log(
        '-'.repeat(COL1) + '+' + '-'.repeat(COL2) + '+' + '-'.repeat(COL3) + '+' + '-'.repeat(COL4)
    );
    const row = (label, on, off, diff) => {
        const c1 = label.padEnd(COL1);
        const c2 = on.padStart(COL2 - 1).padEnd(COL2);
        const c3 = off.padStart(COL3 - 1).padEnd(COL3);
        const c4 = diff.padStart(COL4 - 1).padEnd(COL4);
        console.log(`${c1}|${c2}|${c3}|${c4}`);
    };

    console.log('\n========== Cache ON vs Cache OFF — Comparison ==========\n');
    console.log(`  cache_on  log : ${cacheOnPath}`);
    console.log(`  cache_off log : ${cacheOffPath}`);
    console.log('');

    line();
    row('Metric', 'Cache ON', 'Cache OFF', 'Difference (ON - OFF)');
    line();

    const metrics = [
        { key: 'count', label: 'Count',   noUnit: true },
        { key: 'avg',   label: 'Avg'  },
        { key: 'min',   label: 'Min'  },
        { key: 'p50',   label: 'p50'  },
        { key: 'p95',   label: 'p95'  },
        { key: 'p99',   label: 'p99'  },
        { key: 'max',   label: 'Max'  },
    ];

    for (const m of metrics) {
        const onVal  = onStats  ? onStats[m.key]  : null;
        const offVal = offStats ? offStats[m.key] : null;
        const onFmt  = m.noUnit ? String(onVal  ?? 'N/A') : fmt(onVal);
        const offFmt = m.noUnit ? String(offVal ?? 'N/A') : fmt(offVal);
        const diff   = m.noUnit ? '' : diffLabel(onVal, offVal);
        row(m.label, onFmt, offFmt, diff);
    }

    line();
    console.log('');

    // Interpretation hint
    if (onStats && offStats && onStats.avg !== null && offStats.avg !== null) {
        const delta = onStats.avg - offStats.avg;
        if (delta < 0) {
            console.log(`✅  Cache ON is faster by ${Math.abs(delta)} ms on average (${(Math.abs(delta) / offStats.avg * 100).toFixed(1)}% improvement).`);
        } else if (delta > 0) {
            console.log(`⚠️  Cache ON is SLOWER by ${delta} ms on average. Review cache configuration.`);
        } else {
            console.log('ℹ️  No average latency difference detected between the two conditions.');
        }
        console.log('');
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const onDelays  = parseDelays(cacheOnPath);
const offDelays = parseDelays(cacheOffPath);

const onStats  = computeStats(onDelays);
const offStats = computeStats(offDelays);

if (!onStats && !offStats) {
    console.error('No data found in either log file. Run the tests first.');
    process.exit(1);
}

printTable(onStats, offStats);
