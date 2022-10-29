#!/bin/bash
for i in {1..1000}
do
   echo "TEST #$i"
   npm test
   # ./test/single_test.sh
   echo "TEST #$i end."
done