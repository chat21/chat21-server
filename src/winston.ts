import appRoot from 'app-root-path';
import * as winston from 'winston';

const level = process.env.LOG_LEVEL || 'debug';

const options = {
  file: {
    level: level,
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

const logger: any = winston.createLogger({
  transports: [
    new (winston.transports.Console)(options.console),
    new (winston.transports.File)(options.file),
  ],
  exitOnError: false, // do not exit on handled exceptions
});

logger.stream = {
  write: function (message: string, encoding: any) {
    logger.info(message);
  },
};

export default logger;
