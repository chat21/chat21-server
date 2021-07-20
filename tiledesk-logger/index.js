/* 
    ver 0.1.1
    Andrea Sponziello - (c) Tiledesk.com
*/

require('dotenv').config();

const LEVEL_DEBUG = 0
const LEVEL_VERBOSE = 1
const LEVEL_INFO = 2
const LEVEL_ERROR = 3
const LEVEL_LOG = LEVEL_DEBUG

/**
 * Tiledesk logger
 */
class TiledeskLogger {
  /**
   * Constructor
   *
   * @example
   * const logger = require('tiledesk-logger');
   */
  
  constructor(log_level) {
    this.levels = {'DEBUG': LEVEL_DEBUG, 'VERBOSE':LEVEL_VERBOSE, 'ERROR': LEVEL_ERROR, 'INFO': LEVEL_INFO, 'LOG': LEVEL_LOG};
    if (log_level) {
      this.logLevel = this.levels[log_level.toUpperCase()] || LEVEL_DEBUG
    }
    else if (process.env.LOG_LEVEL) {
      this.logLevel = this.levels[process.env.LOG_LEVEL.toUpperCase()] || LEVEL_DEBUG
    }
    else {
      this.logLevel = LEVEL_DEBUG
    }
  }

  setLog(log_level) {
    if (log_level) {
      this.logLevel = this.levels[log_level.toUpperCase()];
    }
  }

  debug(...args) {
    if (this.logLevel == LEVEL_DEBUG) {
      console.debug.apply(console,args)
    }
  }

  log(...args) {
    if (this.logLevel == LEVEL_DEBUG) {
      console.log.apply(console,args)
    }
  }

  verbose(...args) {
    if (this.logLevel <= LEVEL_VERBOSE) {
      console.log.apply(console,args)
    }
  }

  info(...args) {
    if (this.logLevel <= LEVEL_INFO) {
      console.info.apply(console,args)
    }
  }

  error(...args) {
    if (this.logLevel <= LEVEL_ERROR) {
      console.error.apply(console,args)
    }
  }

}

module.exports = {logger: new TiledeskLogger(), TiledeskLogger: TiledeskLogger};