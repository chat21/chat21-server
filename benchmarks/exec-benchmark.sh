#!/bin/bash

# Output file
RESULT_FILE="benchmark_results-cache.txt"

# Clear or create the result file
echo "Benchmark Results - $(date)" > "$RESULT_FILE"
echo "--------------------------------" >> "$RESULT_FILE"

# Loop NUM_MESSAGE from 10 to 100 with step 10
for NUM in $(seq 10 10 100)
do
    echo "Running benchmark with NUM_MESSAGE=$NUM..."
    echo "--- NUM_MESSAGE: $NUM ---" >> "$RESULT_FILE"
    
    # Run the benchmark script and append output to the result file
    # We use env to set the variable for the specific command execution
    NUM_MESSAGE=$NUM node conversation_benchmark.js >> "$RESULT_FILE" 2>&1
    
    echo "Completed NUM_MESSAGE=$NUM"
    echo -e "\n\n" >> "$RESULT_FILE"

    sleep 20 # Sleep for 20 seconds before the next run
done

echo "Benchmark suite completed. Results saved in $RESULT_FILE"

