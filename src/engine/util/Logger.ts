type LoggerMessageType = string | (() => string);
type PrintCallback = (s: string) => void;

export class Logger {

  static readonly ALL = 0x00;
  static readonly TRACE = 0x01;
  static readonly DEBUG = 0x02;
  static readonly FINE = 0x04;
  static readonly WARN = 0x08;
  static readonly INFO = 0x10;
  static readonly ERROR = 0x20;
  static readonly ADMIN = 0x40;
  static readonly FATAL = 0x80;
  static readonly NONE = 0xFF;

  static _instance: Logger = new Logger((str) => console.log(str));

  static get _(): Logger {
    return Logger._instance;
  }

  static set _(val: Logger) {
    Logger._instance = val;
  }


  _printCallback: PrintCallback;

  constructor(callback: PrintCallback) {
    this._printCallback = callback;
  }

  level: number = Logger.INFO;
  filter: number = 0xFF;


  log(level: number, msg: LoggerMessageType) {
    if (level < this.level) return;
    if ((level | this.filter) === 0) return;

    if (typeof msg === "string") {
      this._printCallback(msg);
    } else {
      this._printCallback(msg());
    }
  }

  static debug(msg: LoggerMessageType) {
    Logger._.log(Logger.DEBUG, msg);
  }

  static fine(msg: LoggerMessageType) {
    Logger._.log(Logger.FINE, msg);
  }

  static warn(msg: LoggerMessageType) {
    Logger._.log(Logger.WARN, msg);
  }

  static info(msg: LoggerMessageType) {
    Logger._.log(Logger.INFO, msg);
  }

  static error(msg: LoggerMessageType) {
    Logger._.log(Logger.ERROR, msg);
  }

}


