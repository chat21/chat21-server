#!/usr/bin/env node

/**
 * Module dependencies.
 */
 
 
var observer = require('./observer');
var startServer = observer.startServer;

console.log("Starting observer")
async function start() {
      await startServer();
}
start();


