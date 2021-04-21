#!/usr/bin/env node

/**
 * Module dependencies. Used by test cases to load observer and start it async
 */
 
 require('dotenv').config(); 

 const winston = require("./winston");
 
 var observer = require('./observer');
 
 module.exports = { observer: observer};
 
 