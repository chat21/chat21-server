#!/usr/bin/env bash
# =============================================================================
# mongo_proof.sh — Evidence that cache ON reduces MongoDB queries
#
# What it does:
#   For each phase (cache_off / cache_on):
#   1. Clears MongoDB system.profile so only this run's queries are counted
#   2. Runs ITERATIONS × NUM_MESSAGES benchmark sessions
#   3. Queries system.profile and saves per-collection op counts
#   Then calls mongo_proof_compare.js for a side-by-side report.
#
# Usage:
#   ITERATIONS=10 NUM_MESSAGES=30 ./perfomance/mongo_proof.sh
#
# Requirements:
#   - kubectl configured for the target cluster
#   - benchmarks/.env with PERFORMANCE_TEST_* vars
#   - MONGO_POD auto-detected (or set via env var)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Load environment variables ────────────────────────────────────────────────
# Load benchmarks/.env first (cluster config), then root .env as fallback.
BENCH_ENV="${REPO_ROOT}/benchmarks/.env"
ROOT_ENV="${REPO_ROOT}/.env"

if [ -f "${BENCH_ENV}" ]; then
    set -o allexport
    # shellcheck disable=SC1091
    source "${BENCH_ENV}"
    set +o allexport
elif [ -f "${ROOT_ENV}" ]; then
    set -o allexport
    # shellcheck disable=SC1091
    source "${ROOT_ENV}"
    set +o allexport
else
    echo "ERROR: No .env file found at ${BENCH_ENV} or ${ROOT_ENV}"
    exit 1
fi

# ── Parameters ────────────────────────────────────────────────────────────────
ITERATIONS="${ITERATIONS:-10}"
NUM_MESSAGES="${NUM_MESSAGES:-30}"
MONGO_NS="tiledesk"
MONGO_DB="chat21"
MONGO_POD="${MONGO_POD:-$(kubectl get pods -n "$MONGO_NS" --no-headers \
    -o custom-columns=':metadata.name' 2>/dev/null | grep mongo | head -1)}"

LOG_DIR="${SCRIPT_DIR}/logs"
mkdir -p "$LOG_DIR"

RAW_OFF="${LOG_DIR}/mongo_proof_raw_off.txt"
RAW_ON="${LOG_DIR}/mongo_proof_raw_on.txt"

# ── Validate ──────────────────────────────────────────────────────────────────
for var in PERFORMANCE_TEST_TILEDESK_PROJECT_ID PERFORMANCE_TEST_MQTT_ENDPOINT \
           PERFORMANCE_TEST_API_ENDPOINT PERFORMANCE_TEST_CHAT_API_ENDPOINT; do
    if [ -z "${!var:-}" ]; then
        echo "❌  Missing required env var: ${var}"
        echo "    Set it in benchmarks/.env or export it before running this script."
        exit 1
    fi
done

if [ -z "${MONGO_POD}" ]; then
    echo "❌  Could not detect MongoDB pod. Set MONGO_POD env var manually."
    exit 1
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

clear_profiler() {
    echo "  [mongo] Clearing system.profile and re-enabling profiler..."
    kubectl exec -n "$MONGO_NS" "$MONGO_POD" -- \
        mongosh "$MONGO_DB" --quiet --eval \
        "db.setProfilingLevel(0);
         try { db.system.profile.drop(); } catch(e) {}
         db.setProfilingLevel(1, {slowms: 0});
         print('OK');" 2>/dev/null
}

collect_profiler() {
    local raw_out="$1"
    echo "  [mongo] Querying system.profile..."
    kubectl exec -n "$MONGO_NS" "$MONGO_POD" -- \
        mongosh "$MONGO_DB" --quiet --eval \
        "db.setProfilingLevel(0);
         var agg = db.system.profile.aggregate([
           { \$match: { ns: { \$not: /system\\.profile/ } } },
           { \$group: {
               _id: {
                 collection: { \$arrayElemAt: [{ \$split: ['\$ns', '.'] }, 1] },
                 op: '\$op'
               },
               count:  { \$sum: 1 },
               avgMs:  { \$avg: '\$millis' },
               maxMs:  { \$max: '\$millis' }
           }},
           { \$sort: { count: -1 } }
         ]).toArray();
         agg.forEach(function(r) {
           print(JSON.stringify(r));
         });
         var total = db.system.profile.countDocuments({ ns: { \$not: /system\\.profile/ } });
         print(JSON.stringify({ _total: total }));
         db.setProfilingLevel(1, {slowms: 0});" \
        2>/dev/null > "$raw_out"
}

run_benchmark() {
    local label="$1"
    local failed=0
    echo ""
    echo "  Running ${ITERATIONS} iterations × ${NUM_MESSAGES} messages ..."
    for i in $(seq 1 "${ITERATIONS}"); do
        printf "\r  → iteration %d/%d" "$i" "$ITERATIONS"
        PERFORMANCE_TEST_LABEL="${label}" \
        PERFORMANCE_TEST_NUM_MESSAGES="${NUM_MESSAGES}" \
        PERFORMANCE_TEST_SKIP_FIRST="true" \
        node "${SCRIPT_DIR}/messages_delay_cachetest.js" 2>/dev/null || { failed=$((failed+1)); }
    done
    echo ""
    echo "  Done. Failed sessions: ${failed}/${ITERATIONS}"
}

# ── Phase 1: Cache OFF ────────────────────────────────────────────────────────

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║       MongoDB Query Evidence: Cache ON vs OFF             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
printf "  MongoDB pod : %s\n" "$MONGO_POD"
printf "  Iterations  : %s × %s messages\n" "$ITERATIONS" "$NUM_MESSAGES"
echo ""
echo "━━━━  PHASE 1: CACHE OFF  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Disable cache and restart the deployment:"
echo "    kubectl patch configmap tiledesk-config -n tiledesk --type merge \\"
echo "      -p '{\"data\":{\"CHAT21OBSERVER_CACHE_ENABLED\":\"false\"}}'"
echo "    kubectl rollout restart deployment/tiledesk-c21srv -n tiledesk"
echo "    kubectl rollout status deployment/tiledesk-c21srv -n tiledesk"
echo ""
read -rp "  Press ENTER when cache is OFF and deployment is ready ..."

clear_profiler
run_benchmark "mongo_proof_off"
collect_profiler "$RAW_OFF"
echo "  Raw data saved to: $RAW_OFF"

# ── Phase 2: Cache ON ─────────────────────────────────────────────────────────

echo ""
echo "━━━━  PHASE 2: CACHE ON   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Enable cache and restart the deployment:"
echo "    kubectl patch configmap tiledesk-config -n tiledesk --type merge \\"
echo "      -p '{\"data\":{\"CHAT21OBSERVER_CACHE_ENABLED\":\"true\"}}'"
echo "    kubectl rollout restart deployment/tiledesk-c21srv -n tiledesk"
echo "    kubectl rollout status deployment/tiledesk-c21srv -n tiledesk"
echo ""
read -rp "  Press ENTER when cache is ON and deployment is ready ..."

clear_profiler
run_benchmark "mongo_proof_on"
collect_profiler "$RAW_ON"
echo "  Raw data saved to: $RAW_ON"

# ── Final report ──────────────────────────────────────────────────────────────
echo ""
echo "━━━━  RESULTS  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
node "${SCRIPT_DIR}/mongo_proof_compare.js"
