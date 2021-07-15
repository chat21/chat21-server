#!/usr/bin/env node

/**
 * Module dependencies. Used by test cases to load observer and start it async
 */

require('dotenv').config();

var observer = require('./observer');

module.exports = { observer: observer};
