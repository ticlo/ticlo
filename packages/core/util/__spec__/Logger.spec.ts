import {expect} from 'vitest';
import {Logger} from '../Logger.js';

export class TestLogger {
  logs: string[] = [];

  constructor(filter: number = Logger.WARN_AND_ABOVE) {
    Logger.add(this.log, filter);
  }

  log = (s: string, level: number, source: any) => {
    this.logs.push(s);
  };

  cancel() {
    Logger.remove(this.log);
  }
}

describe('Logger', function () {
  it('basic', function () {
    const traceLogger1 = new TestLogger(Logger.TRACE);
    const traceLogger2 = new TestLogger(Logger.TRACE_AND_ABOVE);
    const debugLogger1 = new TestLogger(Logger.DEBUG);
    const debugLogger2 = new TestLogger(Logger.DEBUG_AND_ABOVE);
    const fineLogger1 = new TestLogger(Logger.FINE);
    const fineLogger2 = new TestLogger(Logger.FINE_AND_ABOVE);
    const warnLogger1 = new TestLogger(Logger.WARN);
    const warnLogger2 = new TestLogger();
    const infoLogger1 = new TestLogger(Logger.INFO);
    const infoLogger2 = new TestLogger(Logger.INFO_AND_ABOVE);
    const errorLogger1 = new TestLogger(Logger.ERROR);
    const errorLogger2 = new TestLogger(Logger.ERROR_AND_ABOVE);
    const configLogger1 = new TestLogger(Logger.CONFIG);
    const configLogger2 = new TestLogger(Logger.CONFIG_AND_ABOVE);
    const fatalLogger1 = new TestLogger(Logger.FATAL);

    Logger.trace('trace');
    Logger.debug('debug');
    Logger.fine('fine');
    Logger.warn('warn');
    Logger.info('info');
    traceLogger2.cancel(); // cancel before other logs
    Logger.error('error');
    Logger.config('config');
    Logger.fatal('fatal');

    expect(traceLogger1.logs).toEqual(['trace']);
    expect(traceLogger2.logs).toEqual(['trace', 'debug', 'fine', 'warn', 'info']);
    expect(debugLogger1.logs).toEqual(['debug']);
    expect(debugLogger2.logs).toEqual(['debug', 'fine', 'warn', 'info', 'error', 'config', 'fatal']);
    expect(fineLogger1.logs).toEqual(['fine']);
    expect(fineLogger2.logs).toEqual(['fine', 'warn', 'info', 'error', 'config', 'fatal']);
    expect(warnLogger1.logs).toEqual(['warn']);
    expect(warnLogger2.logs).toEqual(['warn', 'info', 'error', 'config', 'fatal']);
    expect(infoLogger1.logs).toEqual(['info']);
    expect(infoLogger2.logs).toEqual(['info', 'error', 'config', 'fatal']);
    expect(errorLogger1.logs).toEqual(['error']);
    expect(errorLogger2.logs).toEqual(['error', 'config', 'fatal']);
    expect(configLogger1.logs).toEqual(['config']);
    expect(configLogger2.logs).toEqual(['config', 'fatal']);
    expect(fatalLogger1.logs).toEqual(['fatal']);

    traceLogger1.cancel();
    debugLogger1.cancel();
    debugLogger2.cancel();
    fineLogger1.cancel();
    fineLogger2.cancel();
    warnLogger1.cancel();
    warnLogger2.cancel();
    infoLogger1.cancel();
    infoLogger2.cancel();
    errorLogger1.cancel();
    errorLogger2.cancel();
    configLogger1.cancel();
    configLogger2.cancel();
    fatalLogger1.cancel();
  });

  it('message lambda', function () {
    const logger = new TestLogger();
    let count = 0;
    const message = () => {
      ++count;
      return 'message';
    };

    Logger.trace(message);

    expect(count).toBe(0);
    expect(logger.logs).toEqual([]);

    Logger.info(message);

    expect(count).toBe(1);
    expect(logger.logs).toEqual(['message']);
    logger.cancel();
  });
});
