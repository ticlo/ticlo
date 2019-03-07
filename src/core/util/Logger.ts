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
  static readonly _FATAL = Logger.FATAL;
  static readonly _CONFIG = Logger._FATAL | Logger.CONFIG;
  static readonly _ERROR = Logger._CONFIG | Logger.ERROR;
  static readonly _INFO = Logger._ERROR | Logger.INFO;
  static readonly _WARN = Logger._INFO | Logger.WARN;
  static readonly _FINE = Logger._WARN | Logger.FINE;
  static readonly _DEBUG = Logger._FINE | Logger.DEBUG;
  static readonly _TRACE = Logger._DEBUG | Logger.TRACE;

  static _loggers: Map<PrintCallback, number> = new Map<PrintCallback, number>();
  static _filter: number;

  // when filter == WARN, it only logs one level!
  // when filter == _WARN_, it also logs all the levels above: WARN, INFO, ERROR, CONFIG, FATAL
  static add(logger: PrintCallback, filter: number = Logger._WARN) {
    Logger._loggers.set(logger, filter);
    Logger._filter = 0;
    // cache the level to improve logger performance
    for (let [logger, filter] of Logger._loggers) {
      Logger._filter |= filter;
    }
  }

  static remove(logger: PrintCallback) {
    Logger._loggers.delete(logger);
  }

  static log(msg: LoggerMessageType, level: number, source: any) {
    if ((level & Logger._filter) === 0) return;

    if (typeof msg !== "string") {
      msg = msg();
    }

    for (let [logger, filter] of Logger._loggers) {
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


