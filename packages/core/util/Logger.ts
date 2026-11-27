type LoggerMessageType = string | (() => string);
type PrintCallback = (s: string, level: number, source: any) => unknown;

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
  static _preFilter = 0;

  // when filter == WARN, it only logs one level!
  // when filter == _WARN_, it also logs all the levels above: WARN, INFO, ERROR, CONFIG, FATAL
  static add(logger: PrintCallback, filter: number = Logger.WARN_AND_ABOVE) {
    Logger._loggers.set(logger, filter);
    Logger.updateFilter();
  }

  static remove(logger: PrintCallback) {
    if (Logger._loggers.delete(logger)) Logger.updateFilter();
  }

  private static updateFilter() {
    let mask = 0;
    for (const filter of Logger._loggers.values()) mask |= filter;
    Logger._preFilter = mask;
  }

  static isEnabled(level: number) {
    return (level & Logger._preFilter) !== 0;
  }

  static log(msg: LoggerMessageType, level: number, source?: unknown) {
    if (!Logger.isEnabled(level)) return;

    if (typeof msg !== 'string') {
      try {
        msg = msg();
      } catch {
        return;
      }
    }

    for (const [logger, filter] of Logger._loggers) {
      if (filter & level) {
        try {
          const result = logger(msg, level, source);
          if (result instanceof Promise) result.catch(() => {});
        } catch {
          // A diagnostic sink must not interrupt its caller or silence the remaining sinks.
        }
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

export type FlowLogLevel = 'debug' | 'info' | 'warn' | 'error';

export function writeConsole(level: FlowLogLevel, message: string, data?: unknown) {
  if (data === undefined) console[level](message);
  else console[level](message, data);
}

function printConsole(message: string, level: number, source: unknown) {
  switch (level) {
    case Logger.TRACE:
    case Logger.DEBUG:
    case Logger.FINE:
      return writeConsole('debug', message, source);
    case Logger.WARN:
      return writeConsole('warn', message, source);
    case Logger.ERROR:
    case Logger.FATAL:
      return writeConsole('error', message, source);
    default:
      return writeConsole('info', message, source);
  }
}

// Numeric arguments preserve the public bitmask API. Named thresholds use severity order.
const minLevelMasks = {
  trace: Logger.TRACE_AND_ABOVE,
  debug: Logger.DEBUG_AND_ABOVE,
  info: Logger.INFO | Logger.CONFIG | Logger.WARN | Logger.ERROR | Logger.FATAL,
  warn: Logger.WARN | Logger.ERROR | Logger.FATAL,
  error: Logger.ERROR | Logger.FATAL,
};

export function addConsoleLogger(minLevel: number | keyof typeof minLevelMasks = Logger.WARN_AND_ABOVE) {
  Logger.add(printConsole, typeof minLevel === 'number' ? minLevel : minLevelMasks[minLevel]);
  return () => Logger.remove(printConsole);
}
