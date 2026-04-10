#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# run_cache_comparison.sh
#
# Runs the cache ON/OFF performance comparison test against the K8s cluster.
#
# Usage:
#   ITERATIONS=50 ./perfomance/run_cache_comparison.sh
#
# Required env vars (can also be set in a .env file):
#   PERFORMANCE_TEST_TILEDESK_PROJECT_ID
#   PERFORMANCE_TEST_MQTT_ENDPOINT
#   PERFORMANCE_TEST_API_ENDPOINT
#   PERFORMANCE_TEST_CHAT_API_ENDPOINT
#
# Optional env vars:
#   ITERATIONS                       — number of test sessions per condition (default: 50)
#   PERFORMANCE_TEST_NUM_MESSAGES    — exchanges per session (default: 10)
#   PERFORMANCE_TEST_REPLY_TIMEOUT_MS — ms before aborting if no reply (default: 120000)
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load .env if present
if [ -f "${SCRIPT_DIR}/../.env" ]; then
    set -o allexport
    # shellcheck disable=SC1091
    source "${SCRIPT_DIR}/../.env"
    set +o allexport
fi

ITERATIONS="${ITERATIONS:-50}"
NUM_MESSAGES="${PERFORMANCE_TEST_NUM_MESSAGES:-10}"

LOG_DIR="${SCRIPT_DIR}/logs"
ON_LOG="${LOG_DIR}/cache_on.log"
OFF_LOG="${LOG_DIR}/cache_off.log"

mkdir -p "${LOG_DIR}"

# ---------------------------------------------------------------------------
# Validate required env vars
# ---------------------------------------------------------------------------

for var in PERFORMANCE_TEST_TILEDESK_PROJECT_ID PERFORMANCE_TEST_MQTT_ENDPOINT \
           PERFORMANCE_TEST_API_ENDPOINT PERFORMANCE_TEST_CHAT_API_ENDPOINT; do
    if [ -z "${!var:-}" ]; then
        echo "❌  Missing required env var: ${var}"
        echo "    Set it in .env or export it before running this script."
        exit 1
    fi
done

# ---------------------------------------------------------------------------
# Helper: run one phase
# ---------------------------------------------------------------------------

run_phase() {
    local label="$1"
    local log="$2"
    local phase_num="$3"

    echo ""
    echo "============================================================"
    echo "  Phase ${phase_num}: ${label^^} (${ITERATIONS} iterations × ${NUM_MESSAGES} messages)"
    echo "  Log file: ${log}"
    echo "============================================================"
    echo ""

    # Write CSV header if file does not exist yet
    if [ ! -f "${log}" ]; then
        echo "timestamp,message_uuid,delay_ms,time_sent,time_received" > "${log}"
    fi

    local failed=0
    for i in $(seq 1 "${ITERATIONS}"); do
        echo "  → Iteration ${i}/${ITERATIONS} [${label}] ..."
        PERFORMANCE_TEST_LABEL="${label}" \
        PERFORMANCE_TEST_NUM_MESSAGES="${NUM_MESSAGES}" \
        node "${SCRIPT_DIR}/messages_delay_cachetest.js" || {
            echo "  ⚠️  Iteration ${i} failed (exit code $?). Continuing..."
            failed=$((failed + 1))
        }
    done

    echo ""
    echo "  Phase ${phase_num} complete. Failed iterations: ${failed}/${ITERATIONS}"
    echo ""
}

# ---------------------------------------------------------------------------
# Phase 1 — Cache ON
# ---------------------------------------------------------------------------

echo ""
echo "================================================================="
echo "  Cache ON vs OFF — Performance Comparison"
echo "  Iterations : ${ITERATIONS}  |  Messages/session : ${NUM_MESSAGES}"
echo "================================================================="
echo ""
echo "PHASE 1 — Cache ON"
echo ""
echo "  ➡️  Please ENABLE the Redis cache on your K8s deployment now."
echo "      Example:"
echo "        kubectl set env deployment/<name> CACHE_ENABLED=true"
echo "      Then wait for pods to restart and press [ENTER] to start testing."
read -r -p "  Press ENTER when the cluster is ready with cache ENABLED... "

run_phase "cache_on" "${ON_LOG}" "1"

# ---------------------------------------------------------------------------
# Phase 2 — Cache OFF
# ---------------------------------------------------------------------------

echo "PHASE 2 — Cache OFF"
echo ""
echo "  ➡️  Please DISABLE the Redis cache on your K8s deployment now."
echo "      Example:"
echo "        kubectl set env deployment/<name> CACHE_ENABLED=false"
echo "      Then wait for pods to restart and press [ENTER] to start testing."
read -r -p "  Press ENTER when the cluster is ready with cache DISABLED... "

run_phase "cache_off" "${OFF_LOG}" "2"

# ---------------------------------------------------------------------------
# Final comparison
# ---------------------------------------------------------------------------

echo "================================================================="
echo "  All phases complete. Generating comparison report..."
echo "================================================================="
echo ""

node "${SCRIPT_DIR}/compare_stats.js" \
    --cache-on-log  "${ON_LOG}" \
    --cache-off-log "${OFF_LOG}"
