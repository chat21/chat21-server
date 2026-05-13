/*
    ver 0.1.1
    Andrea Sponziello - (c) Tiledesk.com
*/

import 'dotenv/config';

export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  VERBOSE: 3,
  DEBUG: 4,
} as const;

type LogLevelKey = keyof typeof LogLevel;
type LogLevelValue = (typeof LogLevel)[LogLevelKey];

/** Tiledesk logger */
export class TiledeskLogger {
  private logLevel: LogLevelValue;
  private readonly levels: Record<string, LogLevelValue>;

  constructor(log_level?: string) {
    this.levels = { ERROR: LogLevel.ERROR, WARN: LogLevel.WARN, INFO: LogLevel.INFO, VERBOSE: LogLevel.VERBOSE, DEBUG: LogLevel.DEBUG };

    if (log_level) {
      this.logLevel = this.levels[log_level.toUpperCase()] ?? LogLevel.DEBUG;
    } else if (process.env.LOG_LEVEL) {
      this.logLevel = this.levels[process.env.LOG_LEVEL.toUpperCase()] ?? LogLevel.DEBUG;
    } else {
      this.logLevel = LogLevel.DEBUG;
    }
  }

  setLog(log_level: string | undefined): void {
    if (log_level) {
      this.logLevel = this.levels[log_level.toUpperCase()] ?? this.logLevel;
    }
  }

  error(...args: unknown[]): void {
    if (this.logLevel >= LogLevel.ERROR) {
      console.error(...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.logLevel >= LogLevel.WARN) {
      console.warn(...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.logLevel >= LogLevel.INFO) {
      console.info(...args);
    }
  }

  verbose(...args: unknown[]): void {
    if (this.logLevel >= LogLevel.VERBOSE) {
      console.log(...args);
    }
  }

  debug(...args: unknown[]): void {
    if (this.logLevel === LogLevel.DEBUG) {
      console.debug(...args);
    }
  }

  log(...args: unknown[]): void {
    if (this.logLevel === LogLevel.DEBUG) {
      console.log(...args);
    }
  }
}

export const logger = new TiledeskLogger();
