import {assert} from "chai";
import {Logger} from "../Logger";

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

describe("Logger", function () {

  it('basic', function () {
    let traceLogger1 = new TestLogger(Logger.TRACE);
    let traceLogger2 = new TestLogger(Logger.TRACE_AND_ABOVE);
    let debugLogger1 = new TestLogger(Logger.DEBUG);
    let debugLogger2 = new TestLogger(Logger.DEBUG_AND_ABOVE);
    let fineLogger1 = new TestLogger(Logger.FINE);
    let fineLogger2 = new TestLogger(Logger.FINE_AND_ABOVE);
    let warnLogger1 = new TestLogger(Logger.WARN);
    let warnLogger2 = new TestLogger();
    let infoLogger1 = new TestLogger(Logger.INFO);
    let infoLogger2 = new TestLogger(Logger.INFO_AND_ABOVE);
    let errorLogger1 = new TestLogger(Logger.ERROR);
    let errorLogger2 = new TestLogger(Logger.ERROR_AND_ABOVE);
    let configLogger1 = new TestLogger(Logger.CONFIG);
    let configLogger2 = new TestLogger(Logger.CONFIG_AND_ABOVE);
    let fatalLogger1 = new TestLogger(Logger.FATAL);

    Logger.trace('trace');
    Logger.debug('debug');
    Logger.fine('fine');
    Logger.warn('warn');
    Logger.info('info');
    traceLogger2.cancel(); // cancel before other logs
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
    let logger = new TestLogger();
    let count = 0;
    let message = () => {
      ++count;
      return 'message';
    };

    Logger.trace(message);

    assert.equal(count, 0, 'callback should not be called');
    assert.isEmpty(logger.logs);

    Logger.info(message);

    assert.equal(count, 1);
    assert.deepEqual(logger.logs, ['message']);
    logger.cancel();
  });

});
