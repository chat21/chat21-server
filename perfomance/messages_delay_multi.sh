#!/bin/bash

# Initialize log file with header if it doesn't exist
LOG_FILE="/logs/messages_delay.log"
if [ ! -f "$LOG_FILE" ]; then
    mkdir -p ./logs
    echo "timestamp,message_uuid,delay_ms,time_sent,time_received" > "$LOG_FILE"
fi

ITERATIONS=10


# Run tests sequentially (wait for each to complete)
for i in {1..10}
do
   echo "Running test $i/10 ..."
   node ./perfomance/messages_delay.js
   if [ $? -ne 0 ]; then
       echo "Test $i failed with exit code $?"
   fi
done
echo "All tests completed. Results saved to: $LOG_FILE"