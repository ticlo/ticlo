type LoggerMessageType = string | (() => string);
type PrintCallback = (s: string, level: number, source: any) => void;

export class Logger {
  static readonly TRACE = 0x01;
  static readonly DEBUG = 0x02;
  static readonly FINE = 0x04;
  static readonly WARN = 0x08;
  static readonly INFO = 0x10;
  static readonly ERROR = 0x20;
  static readonly CONFIG = 0x40;
  static readonly FATAL = 0x80;

  static readonly _NONE = 0;
  static readonly CONFIG_AND_ABOVE = Logger.FATAL | Logger.CONFIG;
  static readonly ERROR_AND_ABOVE = Logger.CONFIG_AND_ABOVE | Logger.ERROR;
  static readonly INFO_AND_ABOVE = Logger.ERROR_AND_ABOVE | Logger.INFO;
  static readonly WARN_AND_ABOVE = Logger.INFO_AND_ABOVE | Logger.WARN;
  static readonly FINE_AND_ABOVE = Logger.WARN_AND_ABOVE | Logger.FINE;
  static readonly DEBUG_AND_ABOVE = Logger.FINE_AND_ABOVE | Logger.DEBUG;
  static readonly TRACE_AND_ABOVE = Logger.DEBUG_AND_ABOVE | Logger.TRACE;

  static _loggers: Map<PrintCallback, number> = new Map<PrintCallback, number>();
  static _preFilter: number;

  // when filter == WARN, it only logs one level!
  // when filter == _WARN_, it also logs all the levels above: WARN, INFO, ERROR, CONFIG, FATAL
  static add(logger: PrintCallback, filter: number = Logger.WARN_AND_ABOVE) {
    Logger._loggers.set(logger, filter);
    Logger._preFilter = 0;
    // cache the level to improve logger performance
    for (const [logger, filter] of Logger._loggers) {
      Logger._preFilter |= filter;
    }
  }

  static remove(logger: PrintCallback) {
    Logger._loggers.delete(logger);
  }

  static log(msg: LoggerMessageType, level: number, source: any) {
    if ((level & Logger._preFilter) === 0) return;

    if (typeof msg !== 'string') {
      msg = msg();
    }

    for (const [logger, filter] of Logger._loggers) {
      if ((filter & level) as number) {
        logger(msg, level, source);
      }
    }
  }

  static trace(msg: LoggerMessageType, source?: any) {
    Logger.log(msg, Logger.TRACE, source);
  }

  static debug(msg: LoggerMessageType, source?: any) {
    Logger.log(msg, Logger.DEBUG, source);
  }

  static fine(msg: LoggerMessageType, source?: any) {
    Logger.log(msg, Logger.FINE, source);
  }

  static warn(msg: LoggerMessageType, source?: any) {
    Logger.log(msg, Logger.WARN, source);
  }

  static info(msg: LoggerMessageType, source?: any) {
    Logger.log(msg, Logger.INFO, source);
  }

  static error(msg: LoggerMessageType, source?: any) {
    Logger.log(msg, Logger.ERROR, source);
  }

  static config(msg: LoggerMessageType, source?: any) {
    Logger.log(msg, Logger.CONFIG, source);
  }

  static fatal(msg: LoggerMessageType, source?: any) {
    Logger.log(msg, Logger.FATAL, source);
  }
}

export function addConsoleLogger(level = Logger.WARN_AND_ABOVE) {
  Logger.add(function (msg, level, source) {
    switch (level) {
      case Logger.WARN:
        console.warn(source, msg);
        break;
      case Logger.ERROR:
      case Logger.FATAL:
        console.error(source, msg);
        break;
      default:
        console.log(source, msg);
    }
  }, level);
}
