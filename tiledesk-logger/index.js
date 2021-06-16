/* 
    ver 0.1
    Andrea Sponziello - (c) Tiledesk.com
*/

require('dotenv').config();

const LEVEL_DEBUG = 0
const LEVEL_INFO = 1
const LEVEL_ERROR = 2
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
  
  constructor() {
    this.levels = {'DEBUG': LEVEL_DEBUG, 'ERROR': LEVEL_ERROR, 'INFO': LEVEL_INFO, 'LOG': LEVEL_LOG};
    this.logLevel = this.levels[process.env.LOG_LEVEL] || LEVEL_DEBUG
    // console.log("actual logLevel", this.logLevel)
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

  info(...args) {
    if (this.logLevel <= LEVEL_INFO) {
      console.info.apply(console,args)
    }
  }

  error(...args) {
    // if (this.logLevel <= LEVEL_ERROR) {
      console.error.apply(console,args)
    // }
  }

}



module.exports.logger = new TiledeskLogger();