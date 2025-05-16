/* 
    ver 0.1.1
    Andrea Sponziello - (c) Tiledesk.com
*/

require('dotenv').config();

const LogLevel = {
  'ERROR': 0,
  'WARN': 1,
  'INFO': 2,
  'VERBOSE': 3,
  'DEBUG':4
}

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
    this.levels = {'ERROR': LogLevel.ERROR, 'WARN': LogLevel.WARN, 'INFO': LogLevel.INFO, 'VERBOSE':LogLevel.VERBOSE, 'DEBUG': LogLevel.DEBUG };
    if (log_level) {
      this.logLevel = this.levels[log_level.toUpperCase()]
    }
    else if (process.env.LOG_LEVEL) {
      this.logLevel = this.levels[process.env.LOG_LEVEL.toUpperCase()]
    }
    else {
      this.logLevel = LogLevel.DEBUG
    }

    //fallback to DEBUG default value
    if (this.logLevel === undefined) {
      this.logLevel = LogLevel.DEBUG;
    }
  }

  setLog(log_level) {
    if (log_level) {
      this.logLevel = this.levels[log_level.toUpperCase()];
    }
  }

  error(...args) {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error.apply(console,args)
    }
  }

  warn(...args) {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn.apply(console,args)
    }
  }

  info(...args) {
    if (this.logLevel >= LogLevel.INFO) {
      console.info.apply(console,args)
    }
  }

  verbose(...args) {
    if (this.logLevel >= LogLevel.VERBOSE) {
      console.log.apply(console,args)
    }
  }

  debug(...args) {
    if (this.logLevel == LogLevel.DEBUG) {
      console.debug.apply(console,args)
    }
  }

  log(...args) {
    if (this.logLevel == LogLevel.DEBUG) {
      console.log.apply(console,args)
    }
  }



  

  

  

}

module.exports = {logger: new TiledeskLogger(), TiledeskLogger: TiledeskLogger};