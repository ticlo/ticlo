import expect from 'expect';
import {Flow} from '../Flow';
import {ErrorEvent} from '../Event';
import {shouldReject} from '../../util/test-util';

describe('ListenPromise', function () {
  it('basic', async function () {
    let flow = new Flow();

    setTimeout(() => flow.setValue('a', 1), 0);
    expect(await flow.waitValue('a')).toBe(1);

    expect(await flow.waitValue('a')).toBe(1);
    setTimeout(() => flow.setValue('a', 2), 0);
    expect(await flow.waitNextValue('a')).toBe(2);

    setTimeout(() => flow.setValue('c', new ErrorEvent('')), 0);
    expect(await shouldReject(flow.waitValue('c'))).toBeInstanceOf(ErrorEvent);
  });

  it('validator', async function () {
    let flow = new Flow();

    let timer;
    let count = 0;
    timer = setInterval(() => flow.setValue('b', ++count), 1);
    let result = await flow.waitValue('b', (val) => val > 5);
    expect(result).toBe(6);
    clearInterval(timer);
  });

  it('destroyed dispatcher', async function () {
    let flow = new Flow();
    let block = flow.createBlock('a');

    setTimeout(() => flow.deleteValue('a'), 0);
    expect(await shouldReject(block.waitValue('v'))).toBeInstanceOf(ErrorEvent);
  });
});
