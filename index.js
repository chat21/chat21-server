#!/usr/bin/env node

/**
 * Module dependencies.
 */
 
require('dotenv').config(); 

const winston = require("./winston");

var observer = require('./observer');
var startServer = observer.startServer;

winston.info("Starting observer")
async function start() {
      await startServer();
}
start();

module.exports = { observer: observer};

