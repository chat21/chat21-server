var appRoot = require('app-root-path');
var winston = require('winston');

var level = process.env.LOG_LEVEL || 'debug'

var options = {
    file: {
      level:level ,
      filename: `${appRoot}/logs/chat-server.log`,
      handleExceptions: true,
      json: false,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      colorize: false,
      format: winston.format.simple()
    },
    console: {
      level: level,
      handleExceptions: true,
      json: true,
      colorize: true,      
      format: winston.format.simple()       
    },
  };



  let logger = winston.createLogger({    
    transports: [
     new (winston.transports.Console)(options.console),
     new (winston.transports.File)(options.file),     
    ],
    exitOnError: false, // do not exit on handled exceptions
  });




  logger.stream = { 
    write: function(message, encoding) {
      logger.info(message);
    },
  };


module.exports = logger;
