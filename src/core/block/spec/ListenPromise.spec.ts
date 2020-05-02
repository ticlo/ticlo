import {assert, AssertionError} from 'chai';
import {Flow} from '../Flow';
import {ErrorEvent} from '../Event';
import {shouldReject} from '../../util/test-util';

describe('ListenPromise', function () {
  it('basic', async function () {
    let flow = new Flow();

    setTimeout(() => flow.setValue('a', 1), 0);
    assert.equal(await flow.waitValue('a'), 1);

    assert.equal(await flow.waitValue('a'), 1, 'wait current value');
    setTimeout(() => flow.setValue('a', 2), 0);
    assert.equal(await flow.waitNextValue('a'), 2, 'wait next value');

    setTimeout(() => flow.setValue('c', new ErrorEvent('')), 0);
    assert.instanceOf(await shouldReject(flow.waitValue('c')), ErrorEvent, 'waitValue should be rejected on ErrorEvent');
  });

  it('validator', async function () {
    let flow = new Flow();

    let timer;
    let count = 0;
    timer = setInterval(() => flow.setValue('b', ++count), 1);
    let result = await flow.waitValue('b', (val) => val > 5);
    assert.equal(result, 6, 'listen promise with validator');
    clearInterval(timer);
  });

  it('destroyed dispatcher', async function () {
    let flow = new Flow();
    let block = flow.createBlock('a');

    setTimeout(() => flow.deleteValue('a'), 0);
    assert.instanceOf(
      await shouldReject(block.waitValue('v')),
      ErrorEvent,
      'waitValue should be rejected when parent is destroyed'
    );
  });
});
