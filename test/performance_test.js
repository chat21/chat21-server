var loadtest = require('loadtest');
var should = require('should');
let express = require('express');
var http = require('http');

let webapp;
// var noRequestPerHour = 100000;
let noRequestPerSecond = 1;
let avgRequestTime = 160;
let MAX_SECONDS = 1;
// var host = 'https://loadtest.andreasponziell.repl.co'
let host = 'http://localhost:3000' // 3002 embedded
let group_id; // got in before()

describe("Performance Test", function() {
    // before(function(done) {
    //     var options = {
    //         host: 'localhost',
    //         port: 3000,
    //         path: '/createGroup'
    //     };
    //     http.request(options, (response) => {
    //         var data = '';
    //         response.on('data', function (chunk) {
    //             data += chunk;
    //         });
    //         response.on('end', function () {
    //             console.log(data);
    //             response = JSON.parse(data);
    //             group_id = response.group.uid;
    //             console.log("group_id:", group_id);
    //             done();
    //         });
    //     }).end();




    //     // DEPRECATED CODE
    //     // var app = express();
    //     // app.get('/', (req, res) => {
    //     //     res.send('Hello');
    //     // });
    //     // // var count = 0;
    //     // // first api which just responds to the request without any processing
    //     // app.get('/ping', (req, res) => {
    //     //     // console.log("/ping: " + count);
    //     //     // count++;
    //     //     res.send('pong');
    //     // });
    //     // // var hcount = 0;
    //     // // second api which waits for 50 millis before responding
    //     // app.get('/heavy-ping', (req, res) => {
    //     //     // console.log("/heavy-ping: " + hcount);
    //     //     // hcount++;
    //     //     setTimeout(() => {
    //     //         res.send('heavy pong');
    //     //     }, 50)
    //     // });
    //     // webapp = app.listen(3002, () => {
    //     //     console.log('server started');
    //     //     done();
    //     // });
	// });
	
	// after(function() {
	// 	webapp.close();
	// });

    it("performance testing", function(done) {
        this.timeout(1000 * 70);

        var options = {
            // "url": host + '/ping',
            // "url": host + "/sendGroupMessage/" + group_id,
            "url": host + "/sendDirectMessage",
            "requestsPerSecond": noRequestPerSecond,
            "maxSeconds": MAX_SECONDS,
            "concurrency": 1,
            "statusCallback": statusCallback
        };

        var gLatency;

        function statusCallback(latency, result, error) {
            console.log("Got latency:", latency);
            gLatency = latency;
        }

        var operation = loadtest.loadTest(options, function(error) {
            if (error) {
                console.error('Got an error: %s', error);
            } else if (operation.running == false) {
                console.info("\n=========================================================================================================\n")
                //console.info("\tThreshold : No of request per hour = " + noRequestPerHour  + ", Avg request time in millis = " + avgRequestTime)
                console.info("\tThreshold : No of request per second = " + noRequestPerSecond  + ", Avg request time in millis = " + avgRequestTime)
                console.info("\n=========================================================================================================\n")
                console.info("Total Requests :", gLatency.totalRequests);
                console.info("Total Failures :", gLatency.totalErrors);
                console.info("Requests Per Second :", gLatency.rps);
                console.info("Requests Per Minute :", (gLatency.rps * 60));
                console.info("Average Request Time(Mills) :", gLatency.meanLatencyMs);
                console.info("Minimum Request Time(Mills) :", gLatency.minLatencyMs);
                console.info("Maximum Request Time(Mills) :", gLatency.maxLatencyMs);
                console.info("Percentiles :", gLatency.percentiles)
                console.info("\n=========================================================================================================\n")

                gLatency.totalErrors.should.equal(0);
                // (gLatency.rps * 3600).should.be.greaterThan(noRequestPerHour);
                (gLatency.meanLatencyMs).should.be.below(avgRequestTime);

                done();
            }
        });
    });

    // it("performance testing /heaving-ping", function(done) {
    //     this.timeout(1000 * 60);

    //     var options = {
    //         "url": host + '/heavy-ping',
    //         "maxSeconds": 30,
    //         "concurrency": 25,
    //         "statusCallback": statusCallback
    //     };

    //     var gLatency;

    //     function statusCallback(latency, result, error) {
    //         gLatency = latency;
    //     }

    //     var operation = loadtest.loadTest(options, function(error) {
    //         if (error) {
    //             console.error('Got an error: %s', error);
    //         } else if (operation.running == false) {
    //             console.info("\n=========================================================================================================\n")
    //             console.info("\tThreshold : No of request per hour = " + noRequestPerHour  + ", Avg request time in millis = " + avgRequestTime)
    //             console.info("\n=========================================================================================================\n")
    //             console.info("Total Requests :", gLatency.totalRequests);
    //             console.info("Total Failures :", gLatency.totalErrors);
    //             console.info("Requests Per Second :", gLatency.rps);
    //             console.info("Requests Per Hour :", (gLatency.rps * 3600));
    //             console.info("Average Request Time(Mills) :", gLatency.meanLatencyMs);
    //             console.info("Minimum Request Time(Mills) :", gLatency.minLatencyMs);
    //             console.info("Maximum Request Time(Mills) :", gLatency.maxLatencyMs);
    //             console.info("Percentiles :", gLatency.percentiles)
    //             console.info("\n=========================================================================================================\n")

    //             gLatency.totalErrors.should.equal(0);
    //             (gLatency.rps * 3600).should.be.greaterThan(noRequestPerHour);
    //             (gLatency.meanLatencyMs).should.be.below(avgRequestTime);

    //             done();
    //         }
    //     });
    // });
});