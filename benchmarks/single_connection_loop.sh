for i in {1..5}
do
   echo "Connecting Client $i ..."
   nohup node ./benchmarks/single_connections_tiledesk_anonymous.js
done
echo "waiting..."