#!/bin/bash

# Initialize log file with header if it doesn't exist
LOG_FILE="./logs/performance_delay.log"
if [ ! -f "$LOG_FILE" ]; then
    mkdir -p ./logs
    echo "timestamp,message_uuid,delay_ms,time_sent,time_received" > "$LOG_FILE"
fi

ITERATIONS=10


# Run tests sequentially (wait for each to complete)
for i in {1..10}
do
   echo "Running test $i/10 ..."
   node ./benchmarks/support_group-with_chatbot_back_and_forth_test_performance.js
   if [ $? -ne 0 ]; then
       echo "Test $i failed with exit code $?"
   fi
done
echo "All tests completed. Results saved to: $LOG_FILE"