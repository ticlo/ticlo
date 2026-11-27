import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {DoneEvent, ErrorEvent, Logger, WAIT, WarningEvent, Root, type Block, type Flow} from '../../../index.ts';

let root: Root;
let flow: Flow;
let log: Block;

beforeEach(() => {
  root = new Root();
  flow = root.addFlow('Main', {log: {'#is': 'log', 'message': 'Payment received', 'data': {order: 12}}});
  log = flow.getValue('log') as Block;
});

afterEach(() => {
  root.destroy();
  vi.restoreAllMocks();
});

function call() {
  log.updateValue('#call', {});
  root.runAll();
}

it('writes one console record per execution and respects a disabled block', () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  root.runAll();
  expect(log.getPriority()).toBe(3);
  expect(info).not.toHaveBeenCalled();
  call();
  expect(info.mock.calls).toEqual([['[Main.log] Payment received', {order: 12}]]);
  log.setValue('#disabled', true);
  call();
  expect(info).toHaveBeenCalledTimes(1);
});

it('uses display text for non-string messages and keeps strings literal', () => {
  const write = vi.fn();
  log.updateValue('provider', {write});
  log.deleteValue('data');
  for (const value of ['plain', 0, false, null, -Infinity, ['x', 2], {count: 2}]) {
    log.updateValue('message', value);
    call();
  }
  expect(write.mock.calls.map(([record]) => record.message)).toEqual([
    'plain',
    '0',
    'false',
    'null',
    '-Inf',
    '["x",2]',
    '{"count":2}',
  ]);
});

it('bounds formatted messages and error summaries including their three-dot suffix', () => {
  const write = vi.fn();
  log.updateValue('provider', {write});
  log.setValue('message', 'x'.repeat(4097));
  call();
  expect(write.mock.lastCall[0].message).toBe('x'.repeat(4093) + '...');

  log.setValue('maxLength', 6);
  for (const message of ['123456', {a: 1}, 'ab😀cde']) {
    log.updateValue('message', message);
    call();
  }
  expect(write.mock.calls.slice(1).map(([record]) => record.message)).toEqual(['123456', '{"a...', 'ab...']);

  log.setValue('maxLength', 3);
  const failure = new ErrorEvent('timeout', new Error('Slow query'));
  log.updateValue('#call', failure);
  root.runAll();
  expect(write.mock.lastCall[0]).toMatchObject({message: '...', level: 'error', data: failure.detail});
  expect(log.getValue('#emit')).toBe(failure);
});

it('uses only the bound provider and reports missing, invalid and failed writes on the calling block', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  class ProviderPromise extends Promise<void> {}
  const pending = Promise.withResolvers<void>();
  const write = vi.fn(() => new ProviderPromise((resolve, reject) => pending.promise.then(resolve, reject)));
  log.setBinding('provider', '^appLog.#output');
  call();
  expect(log.getValue('#emit')).toBeInstanceOf(ErrorEvent);
  const service = flow.createBlock('^appLog');
  service.output({});
  call();
  expect(log.getValue('#emit')).toBeInstanceOf(ErrorEvent);
  service.output({write});
  call();
  expect(write.mock.calls).toEqual([
    [{time: expect.any(Number), blockPath: 'Main.log', level: 'info', message: 'Payment received', data: {order: 12}}],
  ]);
  expect(log.getValue('#wait')).toBe(true);
  const reason = new Error('destination offline');
  pending.reject(reason);
  await vi.waitFor(() => expect(log.getValue('#emit')).toMatchObject({type: ErrorEvent.AsyncError, detail: reason}));
  expect(info).not.toHaveBeenCalled();
  log.setBinding('provider', null);
  call();
  expect(info).toHaveBeenCalledTimes(1);
  expect(log.getValue('#emit')).toBeInstanceOf(DoneEvent);
});

it.each([false, true])('handles errors on #call and preserves their source through forwarding (sync=%s)', (sync) => {
  const source = flow.createBlock('query');
  const relay = flow.createBlock('relay');
  relay.setValue('#is', 'add');
  relay.setBinding('#call', '##.query.#emit');
  log.setBinding('#call', '##.relay.#emit');
  log.setValue('#sync', sync);
  log.setValue('#mode', 'onChange');
  const write = vi.fn();
  log.updateValue('provider', {write});
  root.runAll();
  write.mockClear();
  const detail = new Error('Connection refused');
  const failure = Object.freeze(new ErrorEvent(ErrorEvent.AsyncError, detail));
  source.emitOnly(failure);
  expect(relay.getValue('#emit')).toBe(failure);
  expect(write).toHaveBeenCalledTimes(sync ? 1 : 0);
  root.runAll();
  expect(write).toHaveBeenCalledExactlyOnceWith({
    time: expect.any(Number),
    blockPath: 'Main.log',
    originPath: 'Main.query',
    level: 'error',
    message: 'AsyncError: Connection refused',
    data: detail,
  });
  expect(log.getValue('#emit')).toBe(failure);
  log.setValue('message', 'updated');
  root.runAll();
  expect(write).toHaveBeenLastCalledWith(expect.objectContaining({level: 'info', message: 'updated'}));
});

it('writes only errors when message and data are empty, and consumes only accepted calls', () => {
  const write = vi.fn();
  log.updateValue('provider', {write});
  log.setValue('message', '');
  log.deleteValue('data');
  log.getProperty('#emit');
  call();
  expect(log.getValue('#emit')).toBeInstanceOf(DoneEvent);
  const failure = new ErrorEvent('validation', {field: 'price'});
  log.updateValue('#call', failure);
  for (const ignored of [WAIT, new WarningEvent('OutOfSync'), false, null]) log.updateValue('#call', ignored);
  root.runAll();
  expect(write).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({level: 'error', message: 'validation', data: failure.detail})
  );
  expect(log.getValue('#emit')).toBe(failure);
  log.updateValue('#call', new ErrorEvent('superseded'));
  log.setValue('data', false);
  call();
  expect(write).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenLastCalledWith(expect.objectContaining({level: 'info', data: false}));
});

it.each(['success', 'throw', 'reject', 'unbound target'])(
  'preserves the original error when the provider reports %s',
  async (outcome) => {
    const diagnostics = vi.fn();
    Logger.add(diagnostics, Logger.ERROR);
    const pending = Promise.withResolvers<void>();
    const providerFailure = new Error('provider offline');
    try {
      const write = vi.fn(() => {
        if (outcome === 'throw') throw providerFailure;
        return pending.promise;
      });
      if (outcome === 'unbound target') log.setBinding('provider', '^missing.#output');
      else log.updateValue('provider', {write});
      const source = flow.createBlock('source');
      log.setBinding('#call', '##.source.#emit');
      const original = new ErrorEvent('timeout', 'query expired');
      source.emit(original);
      root.runAll();
      if (outcome === 'success' || outcome === 'reject') {
        expect(log.getValue('#wait')).toBe(true);
        if (outcome === 'success') pending.resolve();
        else pending.reject(providerFailure);
        await vi.waitFor(() => expect(log.getValue('#wait')).toBeUndefined());
      }
      expect(log.getValue('#emit')).toBe(original);
      expect(original.originPath).toBe('Main.source');
      expect(diagnostics).toHaveBeenCalledTimes(outcome === 'success' ? 0 : 1);
      if (outcome !== 'unbound target') {
        expect(write).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({level: 'error', message: 'timeout: query expired'})
        );
      }
    } finally {
      Logger.remove(diagnostics);
    }
  }
);

it('ignores a stale asynchronous error completion after a newer input-driven execution', async () => {
  const pending = Promise.withResolvers<void>();
  log.setValue('#mode', 'onChange');
  log.updateValue('provider', {write: vi.fn().mockReturnValueOnce(pending.promise)});
  log.updateValue('#call', new ErrorEvent('timeout'));
  log.getProperty('#emit');
  root.runAll();
  expect(log.getValue('#wait')).toBe(true);
  log.setValue('message', 'next');
  root.runAll();
  const done = log.getValue('#emit');
  expect(done).toBeInstanceOf(DoneEvent);
  pending.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(log.getValue('#emit')).toBe(done);
});

it('uses the upstream #emit block path when #call is bound to another block #emit', () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  const step = flow.createBlock('step');
  log.setBinding('#call', '##.step.#emit');

  step.emit(undefined);
  root.runAll();
  expect(info.mock.calls).toEqual([['[Main.step] Payment received', {order: 12}]]);

  const write = vi.fn();
  log.updateValue('provider', {write});
  step.emit(undefined);
  root.runAll();
  expect(write).toHaveBeenCalledExactlyOnceWith({
    time: expect.any(Number),
    blockPath: 'Main.log',
    originPath: 'Main.step',
    level: 'info',
    message: 'Payment received',
    data: {order: 12},
  });

  write.mockClear();
  info.mockClear();
  log.setBinding('#call', '##.step.#output');
  step.output({});
  root.runAll();
  expect(write).toHaveBeenCalledExactlyOnceWith({
    time: expect.any(Number),
    blockPath: 'Main.log',
    originPath: undefined,
    level: 'info',
    message: 'Payment received',
    data: {order: 12},
  });

  log.setValue('provider', undefined);
  step.output({next: true});
  root.runAll();
  expect(info).toHaveBeenCalledExactlyOnceWith('[Main.log] Payment received', {order: 12});

  write.mockClear();
  info.mockClear();
  log.updateValue('provider', {write});
  log.setBinding('#call', '##.missing.#emit');
  call();
  expect(write).toHaveBeenLastCalledWith(expect.objectContaining({blockPath: 'Main.log', originPath: undefined}));

  log.setValue('provider', undefined);
  log.setBinding('#call', null);
  call();
  expect(info).toHaveBeenLastCalledWith('[Main.log] Payment received', {order: 12});
});
