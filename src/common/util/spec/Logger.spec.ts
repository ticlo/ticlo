import {assert} from "chai";
import {Logger} from "../Logger";

export class TestLogger {

  logs: string[] = [];

  constructor(filter: number) {
    Logger.add(this.log, filter);
  }

  log = (s: string, level: number, source: any) => {
    this.logs.push(s);
  };

  clear() {
    this.logs.length = 0;
  }

  cancel() {
    Logger.remove(this.log);
  }
}

describe("Logger", function () {

  it('basic', function () {

    let traceLogger1 = new TestLogger(Logger.TRACE);
    let traceLogger2 = new TestLogger(Logger._TRACE);
    let debugLogger1 = new TestLogger(Logger.DEBUG);
    let debugLogger2 = new TestLogger(Logger._DEBUG);
    let fineLogger1 = new TestLogger(Logger.FINE);
    let fineLogger2 = new TestLogger(Logger._FINE);
    let warnLogger1 = new TestLogger(Logger.WARN);
    let warnLogger2 = new TestLogger(Logger._WARN);
    let infoLogger1 = new TestLogger(Logger.INFO);
    let infoLogger2 = new TestLogger(Logger._INFO);
    let errorLogger1 = new TestLogger(Logger.ERROR);
    let errorLogger2 = new TestLogger(Logger._ERROR);
    let configLogger1 = new TestLogger(Logger.CONFIG);
    let configLogger2 = new TestLogger(Logger._CONFIG);
    let fatalLogger1 = new TestLogger(Logger.FATAL);
    let fatalLogger2 = new TestLogger(Logger._FATAL);

    Logger.trace('trace');
    Logger.debug('debug');
    Logger.fine('fine');
    Logger.warn('warn');
    Logger.info('info');
    traceLogger2.cancel();
    Logger.error('error');
    Logger.config('config');
    Logger.fatal('fatal');

    assert.deepEqual(traceLogger1.logs, ['trace']);
    assert.deepEqual(traceLogger2.logs, ['trace', 'debug', 'fine', 'warn', 'info'], 'logger canceled');
    assert.deepEqual(debugLogger1.logs, ['debug']);
    assert.deepEqual(debugLogger2.logs, ['debug', 'fine', 'warn', 'info', 'error', 'config', 'fatal']);
    assert.deepEqual(fineLogger1.logs, ['fine']);
    assert.deepEqual(fineLogger2.logs, ['fine', 'warn', 'info', 'error', 'config', 'fatal']);
    assert.deepEqual(warnLogger1.logs, ['warn']);
    assert.deepEqual(warnLogger2.logs, ['warn', 'info', 'error', 'config', 'fatal']);
    assert.deepEqual(infoLogger1.logs, ['info']);
    assert.deepEqual(infoLogger2.logs, ['info', 'error', 'config', 'fatal']);
    assert.deepEqual(errorLogger1.logs, ['error']);
    assert.deepEqual(errorLogger2.logs, ['error', 'config', 'fatal']);
    assert.deepEqual(configLogger1.logs, ['config']);
    assert.deepEqual(configLogger2.logs, ['config', 'fatal']);
    assert.deepEqual(fatalLogger1.logs, ['fatal']);
    assert.deepEqual(fatalLogger2.logs, ['fatal']);


  });
});
