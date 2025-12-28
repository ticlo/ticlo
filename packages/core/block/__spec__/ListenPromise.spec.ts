import {expect} from 'vitest';
import {Flow} from '../Flow.js';
import {ErrorEvent} from '../Event.js';
import {shouldReject} from '../../util/test-util.js';

describe('ListenPromise', function () {
  it('basic', async function () {
    const flow = new Flow();

    setTimeout(() => flow.setValue('a', 1), 0);
    expect(await flow.waitValue('a')).toBe(1);

    expect(await flow.waitValue('a')).toBe(1);
    setTimeout(() => flow.setValue('a', 2), 0);
    expect(await flow.waitNextValue('a')).toBe(2);

    setTimeout(() => flow.setValue('c', new ErrorEvent('')), 0);
    expect(await shouldReject(flow.waitValue('c'))).toBeInstanceOf(ErrorEvent);
  });

  it('validator', async function () {
    const flow = new Flow();

    let count = 0;
    const timer = setInterval(() => flow.setValue('b', ++count), 1);
    const result = await flow.waitValue('b', (val) => (val as number) > 5);
    expect(result).toBe(6);
    clearInterval(timer);
  });

  it('destroyed dispatcher', async function () {
    const flow = new Flow();
    const block = flow.createBlock('a');

    setTimeout(() => flow.deleteValue('a'), 0);
    expect(await shouldReject(block.waitValue('v'))).toBeInstanceOf(ErrorEvent);
  });
});
